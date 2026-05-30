import asyncio
import os
import time
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
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
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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
