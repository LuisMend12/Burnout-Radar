import asyncio
import json
import time
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

app = FastAPI(title="Burnout Radar API", version="1.0.0", description="Real-time wellness biomarker analysis")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared metrics state
_current_metrics = get_streaming_metrics()


@app.get("/")
async def root():
    return {"message": "Burnout Radar API", "status": "online", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": time.time()}


@app.post("/analyze_voice")
async def analyze_voice(file: Optional[UploadFile] = File(None)):
    """Analyze voice recording for stress biomarkers using acoustic features."""
    await asyncio.sleep(1.8)  # Simulate ML inference latency

    metrics = generate_voice_metrics()
    _current_metrics.update(metrics)

    return {
        "success": True,
        "metrics": metrics,
        "analysis": {
            "pitch_variation_hz": round(__import__("random").uniform(12, 45), 2),
            "speech_rate_wpm": round(__import__("random").uniform(115, 185), 1),
            "voice_energy_db": round(__import__("random").uniform(-24, -6), 1),
            "tremor_index": round(__import__("random").uniform(0.01, 0.28), 3),
            "jitter_percent": round(__import__("random").uniform(0.1, 2.4), 2),
            "shimmer_percent": round(__import__("random").uniform(1.0, 8.5), 2),
            "confidence_score": round(__import__("random").uniform(0.88, 0.99), 3),
            "processing_time_ms": round(__import__("random").uniform(800, 1800), 0),
        },
    }


@app.get("/metrics")
async def get_metrics():
    """Get current wellness metrics snapshot."""
    metrics = get_streaming_metrics()
    _current_metrics.update(metrics)
    return metrics


@app.get("/recommendations")
async def get_recommendations_endpoint():
    """Get AI-generated wellness recommendations based on current metrics."""
    recs = get_recommendations(_current_metrics)
    return {"recommendations": recs, "generated_at": time.time()}


@app.websocket("/eeg_stream")
async def eeg_websocket(websocket: WebSocket):
    """Stream real-time simulated EEG brainwave data at 10 Hz."""
    await websocket.accept()
    t = 0.0
    try:
        while True:
            data = generate_eeg_data(t)
            await websocket.send_json(data)
            t += 0.1
            await asyncio.sleep(0.1)
    except (WebSocketDisconnect, Exception):
        pass


@app.websocket("/metrics_stream")
async def metrics_websocket(websocket: WebSocket):
    """Stream real-time wellness metrics with 2-second updates."""
    await websocket.accept()
    try:
        while True:
            metrics = get_streaming_metrics()
            _current_metrics.update(metrics)
            await websocket.send_json(metrics)
            await asyncio.sleep(2.0)
    except (WebSocketDisconnect, Exception):
        pass


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
