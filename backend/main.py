import asyncio
import datetime as dt
import os
import time
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from models import MetricsResponse, RecommendationsResponse
from mock_data import (
    generate_voice_metrics,
    generate_eeg_data,
    get_recommendations,
    get_streaming_metrics,
)
import awear_client

try:
    import features as _F
    _HAS_FEATURES = True
except ImportError:
    _HAS_FEATURES = False

# brain-state score: exponent 0.4 → 0, 1.4 → 100 (higher = steeper = calmer)
_SCORE_LO, _SCORE_HI = 0.4, 1.4


def _aperiodic_score(exp: float) -> int:
    return int(round(float(np.clip((exp - _SCORE_LO) / (_SCORE_HI - _SCORE_LO) * 100, 0, 100))))

# Load .env from project root (one level up from backend/)
_env_path = Path(__file__).parent.parent / ".env"
if _env_path.exists():
    for line in _env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

_api_key = os.environ.get("API_KEY")
if _api_key:
    awear_client.init(_api_key)

app = FastAPI(title="Burnout Radar API", version="1.0.0", description="Real-time wellness biomarker analysis")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000",
                   "http://localhost:3001", "http://127.0.0.1:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_current_metrics = get_streaming_metrics()


def _get_metrics() -> dict:
    if _api_key:
        real = awear_client.get_metrics()
        if real:
            _current_metrics.update(real)
            return dict(_current_metrics)
    metrics = get_streaming_metrics()
    _current_metrics.update(metrics)
    return metrics


def _get_eeg_frame(t: float) -> dict:
    if _api_key:
        real = awear_client.get_eeg_frame()
        if real:
            return real
    return generate_eeg_data(t)


@app.get("/")
async def root():
    source = "awear_api" if _api_key else "mock"
    return {"message": "Burnout Radar API", "status": "online", "version": "1.0.0", "data_source": source}


@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": time.time()}


@app.post("/analyze_voice")
async def analyze_voice(file: Optional[UploadFile] = File(None)):
    await asyncio.sleep(1.8)
    metrics = generate_voice_metrics()
    _current_metrics.update(metrics)
    return {
        "success": True,
        "metrics": metrics,
        "analysis": {
            "pitch_variation_hz":   round(__import__("random").uniform(12, 45), 2),
            "speech_rate_wpm":      round(__import__("random").uniform(115, 185), 1),
            "voice_energy_db":      round(__import__("random").uniform(-24, -6), 1),
            "tremor_index":         round(__import__("random").uniform(0.01, 0.28), 3),
            "jitter_percent":       round(__import__("random").uniform(0.1, 2.4), 2),
            "shimmer_percent":      round(__import__("random").uniform(1.0, 8.5), 2),
            "confidence_score":     round(__import__("random").uniform(0.88, 0.99), 3),
            "processing_time_ms":   round(__import__("random").uniform(800, 1800), 0),
        },
    }


@app.get("/metrics")
async def get_metrics():
    return _get_metrics()


@app.get("/timeline")
async def get_timeline(minutes: int = 60):
    """Historical timeline bucketed into 2-minute intervals."""
    if _api_key:
        data = awear_client.get_historical_timeline(minutes=minutes, bucket_minutes=2)
        if data:
            return {"timeline": data, "source": "awear_api"}
    return {"timeline": [], "source": "mock"}


@app.get("/recommendations")
async def get_recommendations_endpoint():
    recs = get_recommendations(_current_metrics)
    return {"recommendations": recs, "generated_at": time.time()}


@app.get("/members")
async def get_members():
    """List AWEAR participants registered to this API key."""
    if not _api_key:
        return {"error": "no API key configured"}
    try:
        import requests as _req
        r = _req.get(
            "https://awear-b2b-2026.vercel.app/api/v1/members",
            headers={"Authorization": f"Bearer {_api_key}"},
            timeout=10,
        )
        r.raise_for_status()
        return r.json()
    except Exception as exc:
        return {"error": str(exc)}


@app.get("/live")
async def live_aperiodic(
    lookback: float = Query(6.0, description="Minutes of EEG history to pull"),
    participant: Optional[str] = Query(None, description="Participant ID; auto-picks if omitted"),
):
    """
    Latest aperiodic (1/f) features for the active participant.

    Returns exponent_smoothed (brain-state marker), brain_state_score (0-100),
    relative_alpha_pct, data freshness (as_of / lag_seconds), and a series[]
    of recent windows for charting. Compatible with the handoff HANDOFF.md spec.
    """
    if not _api_key:
        return {"error": "no API key configured — set API_KEY in .env"}
    if not _HAS_FEATURES:
        return {"error": "spectral features unavailable — install scipy and specparam"}

    pid, rows = awear_client.get_raw_records(lookback_minutes=lookback, participant=participant)
    if pid is None:
        return {"error": "no members joined to your study code"}
    if not rows:
        return {"participant": pid, "as_of": None, "error": "no data in window"}

    cfg = _F.Config()
    runs = _F.contiguous_runs(rows)
    run = runs[-1] if runs and len(runs[-1]) >= cfg.win_sec else rows

    sig, _ = _F.rows_to_signal(run, cfg.fs)
    sig = _F.preprocess(sig, cfg)
    sl = _F.sliding_features(sig, cfg)

    last_row = rows[-1]
    as_of = dt.datetime.fromisoformat(last_row["timestamp"].replace("Z", "+00:00"))
    lag = (dt.datetime.now(dt.timezone.utc) - as_of).total_seconds()

    if not sl["exponent"].size:
        return {
            "participant": pid,
            "as_of": as_of.isoformat(),
            "lag_seconds": round(lag, 1),
            "error": "not enough clean signal yet",
        }

    exp = sl["exponent"]
    exp_s = _F.smooth(exp, 7)
    rel = sl["bands"]["rel_alpha"] * 100.0
    apw = sl["alpha_peak_pw"]
    r2 = sl["r2"]
    t0 = dt.datetime.fromisoformat(run[0]["timestamp"].replace("Z", "+00:00"))

    series = []
    for i in range(len(sl["t"])):
        e = float(exp[i])
        es = float(exp_s[i])
        apw_v = float(apw[i]) if np.isfinite(apw[i]) else None
        series.append({
            "t": (t0 + dt.timedelta(seconds=float(sl["t"][i]))).isoformat(),
            "exponent":            round(e, 3)  if np.isfinite(e)  else None,
            "exponent_smoothed":   round(es, 3) if np.isfinite(es) else None,
            "relative_alpha_pct":  round(float(rel[i]), 1),
            "alpha_peak_pw":       round(apw_v, 3) if apw_v is not None else None,
            "r2":                  round(float(r2[i]), 3),
            "quality":             bool(float(r2[i]) >= 0.8 and np.isfinite(e) and 0.1 < e < 2.5),
        })

    if not series:
        return {
            "participant": pid, "as_of": as_of.isoformat(),
            "lag_seconds": round(lag, 1), "error": "no clean windows computed",
        }

    last = series[-1]
    exp_last = last["exponent_smoothed"] or last["exponent"] or 0.0
    current = {k: last[k] for k in
               ("exponent", "exponent_smoothed", "relative_alpha_pct",
                "alpha_peak_pw", "r2", "quality")}
    current["brain_state_score"] = _aperiodic_score(exp_last)

    return {
        "participant": pid,
        "device": last_row.get("device_id"),
        "fs": cfg.fs,
        "as_of": as_of.isoformat(),
        "lag_seconds": round(lag, 1),
        "current": current,
        "series": series,
        "config": {
            "fit_lo": cfg.fit_lo, "fit_hi": cfg.fit_hi,
            "win_sec": cfg.win_sec, "step_sec": cfg.step_sec,
            "highpass_hz": cfg.highpass_hz, "notch_hz": cfg.notch_hz,
            "mains_interp": cfg.mains_interp,
        },
    }


@app.websocket("/eeg_stream")
async def eeg_websocket(websocket: WebSocket):
    await websocket.accept()
    t = 0.0
    try:
        while True:
            data = _get_eeg_frame(t)
            await websocket.send_json(data)
            t += 0.1
            await asyncio.sleep(0.1)
    except (WebSocketDisconnect, Exception):
        pass


@app.websocket("/metrics_stream")
async def metrics_websocket(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            metrics = _get_metrics()
            await websocket.send_json(metrics)
            await asyncio.sleep(2.0)
    except (WebSocketDisconnect, Exception):
        pass


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
