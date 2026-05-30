"""
AWEAR EEG API client.
Fetches real EEG waveforms and derives brainwave band powers + wellness metrics.

Waveform format: 256 raw ADC integer samples @ 256 Hz (RIGHT_TEMP / TP10 channel).
FFT resolution: 1 Hz per bin.
"""

import time
import math
import os
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional

import requests

_API_KEY: Optional[str] = None
_BASE_URL = "https://awear-b2b-2026.vercel.app/api/v1"

# Band frequency ranges (Hz) — FFT bin index == frequency at 256 Hz / 256 samples
_BANDS = {
    "delta": (1, 4),
    "theta": (4, 8),
    "alpha": (8, 13),
    "beta":  (13, 30),
    "gamma": (30, 45),
}

# Smoothed band state for stable streaming output
_band_state: Optional[Dict[str, float]] = None

# Cache: (timestamp, data)
_cache: Dict = {"ts": 0.0, "bands": None, "participant": None}
_CACHE_TTL = 4.0  # seconds


def init(api_key: str) -> None:
    global _API_KEY
    _API_KEY = api_key


def _headers() -> Dict[str, str]:
    return {"Authorization": f"Bearer {_API_KEY}"}


def _get_participant() -> Optional[str]:
    cached = _cache.get("participant")
    if cached:
        return cached
    try:
        r = requests.get(f"{_BASE_URL}/members", headers=_headers(), timeout=5)
        r.raise_for_status()
        members = r.json().get("members", [])
        if members:
            _cache["participant"] = members[0]["participantId"]
            return _cache["participant"]
    except Exception:
        pass
    return None


def _band_power(waveform: List[int], lo: int, hi: int) -> float:
    n = len(waveform)
    if n == 0:
        return 0.0
    mean = sum(waveform) / n
    centered = [v - mean for v in waveform]

    # FFT (DFT via Cooley-Tukey-style using cmath)
    # Use numpy if available for speed, else fall back to pure Python
    try:
        import numpy as np
        spectrum = np.abs(np.fft.rfft(centered)) ** 2
    except ImportError:
        import cmath
        spectrum = []
        half = n // 2 + 1
        for k in range(half):
            s = sum(centered[j] * cmath.exp(-2j * math.pi * k * j / n) for j in range(n))
            spectrum.append(abs(s) ** 2)

    return sum(spectrum[lo:hi])


def _waveforms_to_bands(records: List[Dict]) -> Dict[str, float]:
    totals = {b: 0.0 for b in _BANDS}
    count = 0
    for rec in records:
        wf = rec.get("waveform", [])
        if len(wf) < 32:
            continue
        for band, (lo, hi) in _BANDS.items():
            totals[band] += _band_power(wf, lo, hi)
        count += 1

    if count == 0:
        return {b: 1.0 for b in _BANDS}

    return {b: totals[b] / count for b in _BANDS}


def _smooth(new: Dict[str, float]) -> Dict[str, float]:
    global _band_state
    if _band_state is None:
        _band_state = dict(new)
        return _band_state
    alpha = 0.3
    _band_state = {k: (1 - alpha) * _band_state[k] + alpha * new[k] for k in new}
    return _band_state


def _bands_to_metrics(bands: Dict[str, float]) -> Dict[str, float]:
    delta = bands["delta"]
    theta = bands["theta"]
    alpha = bands["alpha"]
    beta  = bands["beta"]
    gamma = bands["gamma"]
    total = delta + theta + alpha + beta + gamma + 1e-9

    raw_focus    = beta / (theta + alpha + 1e-9)
    raw_calmness = alpha / (beta + gamma + 1e-9)
    raw_stress   = (beta + gamma) / total
    raw_fatigue  = (delta + theta) / total

    def norm(x: float, lo: float, hi: float) -> float:
        return max(0.0, min(100.0, (x - lo) / (hi - lo + 1e-9) * 100))

    focus    = norm(raw_focus,    0.05, 2.5)
    calmness = norm(raw_calmness, 0.1,  3.0)
    stress   = norm(raw_stress,   0.05, 0.6)
    fatigue  = norm(raw_fatigue,  0.1,  0.7)

    burnout_score    = round(0.5 * stress + 0.3 * fatigue + 0.2 * (1 - focus / 100) * 100, 1)
    mental_readiness = round(max(0.0, 100.0 - burnout_score * 0.7), 1)

    level_map = [(30, "Low"), (55, "Moderate"), (75, "High")]
    burnout_level = "Critical"
    for threshold, label in level_map:
        if burnout_score < threshold:
            burnout_level = label
            break

    return {
        "stress":           round(stress, 1),
        "calmness":         round(min(100.0, calmness), 1),
        "focus":            round(focus, 1),
        "fatigue":          round(fatigue, 1),
        "burnout_score":    min(100.0, burnout_score),
        "mental_readiness": mental_readiness,
        "burnout_level":    burnout_level,
        "timestamp":        time.time(),
    }


def _bands_to_eeg_frame(bands: Dict[str, float]) -> Dict:
    total = sum(bands.values()) + 1e-9

    def normalise(v: float) -> float:
        return round((v / total) * 2 - 1, 4)

    delta = normalise(bands["delta"])
    theta = normalise(bands["theta"])
    alpha = normalise(bands["alpha"])
    beta  = normalise(bands["beta"])
    gamma = normalise(bands["gamma"])

    focus_index    = max(0, min(100, beta / (abs(alpha) + abs(theta) + 0.1) * 50 + 50))
    calmness_index = max(0, min(100, alpha / (abs(beta) + abs(gamma) + 0.1) * 50 + 50))

    return {
        "delta":          delta,
        "theta":          theta,
        "alpha":          alpha,
        "beta":           beta,
        "gamma":          gamma,
        "focus_index":    round(float(focus_index), 1),
        "calmness_index": round(float(calmness_index), 1),
        "timestamp":      time.time(),
    }


def _fetch_recent_records(participant: str, n: int = 10) -> List[Dict]:
    now = datetime.now(timezone.utc)
    start = (now - timedelta(minutes=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
    end   = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        r = requests.get(
            f"{_BASE_URL}/members/{participant}/data",
            headers=_headers(),
            params={"start": start, "end": end, "limit": n, "sort": "desc"},
            timeout=6,
        )
        r.raise_for_status()
        return r.json().get("data", [])
    except Exception:
        return []


def get_live_bands() -> Optional[Dict[str, float]]:
    now = time.time()
    if now - _cache["ts"] < _CACHE_TTL and _cache["bands"] is not None:
        return _cache["bands"]

    participant = _get_participant()
    if not participant:
        return None

    records = _fetch_recent_records(participant, n=10)
    if not records:
        return None

    raw_bands = _waveforms_to_bands(records)
    smoothed  = _smooth(raw_bands)

    _cache["ts"]    = now
    _cache["bands"] = smoothed
    return smoothed


def get_metrics() -> Optional[Dict]:
    bands = get_live_bands()
    if bands is None:
        return None
    return _bands_to_metrics(bands)


def get_eeg_frame() -> Optional[Dict]:
    bands = get_live_bands()
    if bands is None:
        return None
    return _bands_to_eeg_frame(bands)
