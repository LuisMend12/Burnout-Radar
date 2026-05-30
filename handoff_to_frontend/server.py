"""AWEAR aperiodic extraction API — backend for the live demo.

Holds the AWEAR key server-side, pulls the most recent EEG (the AWEAR cloud is
~3 min behind real time), runs the SPRiNT-style aperiodic fit, and returns the
live exponent + alpha + a brain-state score as JSON. The frontend (Lovable)
just polls /live every few seconds.

Run:
  ./.venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8000
Then:
  curl http://localhost:8000/live | jq

Endpoints: /health, /members, /live  (see HANDOFF.md).
"""
from __future__ import annotations

import datetime as dt
from typing import Optional

import numpy as np
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

import awear
import features as F

cfg = F.Config()
app = FastAPI(title="AWEAR Aperiodic Extraction API", version="1.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

# brain-state score: map exponent -> 0..100 (higher = steeper = calmer).
# Simple fixed linear map so it's stable across requests (no baseline needed).
SCORE_LO, SCORE_HI = 0.4, 1.4


def _session():
    return awear.session(awear.load_api_key())


def _score(exp: float) -> int:
    return int(round(float(np.clip((exp - SCORE_LO) / (SCORE_HI - SCORE_LO) * 100, 0, 100))))


def _pick_participant(members: list) -> Optional[str]:
    """Prefer a member with an active device/slot over freshly-joined empties."""
    if not members:
        return None
    active = [m for m in members if m.get("deviceId") or m.get("hasSlot")]
    return (active[0] if active else members[0])["participantId"]


@app.get("/health")
def health():
    return {"ok": True, "service": "awear-aperiodic", "version": "1.0",
            "config": {"fs": cfg.fs, "fit_hz": [cfg.fit_lo, cfg.fit_hi],
                       "win_sec": cfg.win_sec, "step_sec": cfg.step_sec,
                       "highpass_hz": cfg.highpass_hz, "notch_hz": cfg.notch_hz},
            "score_map": {"exponent_lo": SCORE_LO, "exponent_hi": SCORE_HI}}


@app.get("/members")
def members():
    return awear.list_members(_session())


@app.get("/live")
def live(lookback: float = Query(6.0, description="minutes of history to pull"),
         participant: Optional[str] = None):
    """Latest aperiodic features for a participant, computed on recent EEG."""
    s = _session()
    if participant is None:
        participant = _pick_participant(awear.list_members(s).get("members", []))
        if participant is None:
            return {"error": "no members joined to your study code"}

    end = dt.datetime.now(dt.UTC).replace(tzinfo=None)
    start = end - dt.timedelta(minutes=lookback)
    rows = awear.get_data(s, participant, start, end, fmt="json").json()["data"]
    if not rows:
        return {"participant": participant, "as_of": None, "error": "no data in window"}

    # use the most recent contiguous run; fall back to all rows if it's short
    runs = F.contiguous_runs(rows)
    run = runs[-1] if len(runs[-1]) >= cfg.win_sec else rows
    sig = F.preprocess(F.rows_to_signal(run, cfg.fs)[0], cfg)
    sl = F.sliding_features(sig, cfg)

    as_of = dt.datetime.fromisoformat(rows[-1]["timestamp"])
    now = dt.datetime.now(dt.timezone.utc)
    lag = (now - as_of).total_seconds()

    if not sl["exponent"].size:
        return {"participant": participant, "as_of": as_of.isoformat(),
                "lag_seconds": round(lag, 1), "error": "not enough clean signal yet"}

    exp = sl["exponent"]; exp_s = F.smooth(exp, 7)
    rel = sl["bands"]["rel_alpha"] * 100.0
    apw = sl["alpha_peak_pw"]; r2 = sl["r2"]
    t0 = dt.datetime.fromisoformat(run[0]["timestamp"])

    series = [{
        "t": (t0 + dt.timedelta(seconds=float(sl["t"][i]))).isoformat(),
        "exponent": round(float(exp[i]), 3),
        "exponent_smoothed": round(float(exp_s[i]), 3),
        "relative_alpha_pct": round(float(rel[i]), 1),
        "alpha_peak_pw": None if not np.isfinite(apw[i]) else round(float(apw[i]), 3),
        "r2": round(float(r2[i]), 3),
        "quality": bool(r2[i] >= 0.8 and 0.1 < exp[i] < 2.5),
    } for i in range(len(sl["t"]))]

    last = series[-1]
    current = {**{k: last[k] for k in
                  ("exponent", "exponent_smoothed", "relative_alpha_pct",
                   "alpha_peak_pw", "r2", "quality")},
               "brain_state_score": _score(last["exponent_smoothed"])}

    return {
        "participant": participant,
        "device": rows[-1].get("device_id"),
        "fs": cfg.fs,
        "as_of": as_of.isoformat(),         # timestamp of most recent EEG sample
        "lag_seconds": round(lag, 1),       # how far behind real time (cloud delay)
        "current": current,
        "series": series,
        "config": {"fit_lo": cfg.fit_lo, "fit_hi": cfg.fit_hi, "win_sec": cfg.win_sec,
                   "step_sec": cfg.step_sec, "highpass_hz": cfg.highpass_hz,
                   "notch_hz": cfg.notch_hz, "mains_interp": cfg.mains_interp},
    }
