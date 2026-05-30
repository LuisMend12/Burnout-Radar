"""
Mock data generators — used when no AWEAR API key is configured.
All functions return the same shapes as the real awear_client equivalents.
"""
from __future__ import annotations

import math
import random
import time
from typing import Dict, List, Optional

import numpy as np

# ── Shared drift state ────────────────────────────────────────────────────────
_state: Dict[str, float] = {
    "stress":   45.0,
    "calmness": 55.0,
    "focus":    60.0,
    "fatigue":  35.0,
    # EEG band amplitudes (relative)
    "delta": 0.8,
    "theta": 0.6,
    "alpha": 0.7,
    "beta":  0.5,
    "gamma": 0.3,
    # Aperiodic exponent (slowly drifts)
    "exponent": 0.9,
    "alpha_cf": 10.0,
}


def _drift(v: float, speed: float = 1.2, lo: float = 8.0, hi: float = 92.0) -> float:
    return max(lo, min(hi, v + (random.random() - 0.5) * speed * 2))


def _update_state() -> None:
    _state["stress"]   = _drift(_state["stress"],   1.5, 5, 95)
    _state["calmness"] = _drift(_state["calmness"], 1.2, 5, 95)
    _state["focus"]    = _drift(_state["focus"],    1.8, 5, 95)
    _state["fatigue"]  = _drift(_state["fatigue"],  1.0, 5, 95)
    _state["exponent"] = _drift(_state["exponent"], 0.04, 0.3, 1.8)
    _state["alpha_cf"] = _drift(_state["alpha_cf"], 0.2, 8.0, 12.5)


# ── Metrics ───────────────────────────────────────────────────────────────────
def _burnout(stress: float, fatigue: float, focus: float) -> float:
    return round(0.5 * stress + 0.3 * fatigue + 0.2 * (1 - focus / 100) * 100, 1)


def _level(score: float) -> str:
    if score < 30:  return "Low"
    if score < 55:  return "Moderate"
    if score < 75:  return "High"
    return "Critical"


def get_streaming_metrics() -> Dict:
    _update_state()
    s = _state["stress"]
    c = _state["calmness"]
    f = _state["focus"]
    fa = _state["fatigue"]
    bs = _burnout(s, fa, f)
    return {
        "stress":           round(s,  1),
        "calmness":         round(c,  1),
        "focus":            round(f,  1),
        "fatigue":          round(fa, 1),
        "burnout_score":    min(100.0, bs),
        "mental_readiness": round(max(0.0, 100.0 - bs * 0.7), 1),
        "burnout_level":    _level(bs),
        "timestamp":        time.time(),
    }


def generate_voice_metrics() -> Dict:
    return get_streaming_metrics()


# ── EEG frame ─────────────────────────────────────────────────────────────────
def generate_eeg_data(t: float) -> Dict:
    n = lambda amp: (random.random() - 0.5) * amp
    delta = 0.8 * math.sin(2 * math.pi * 2.0 * t) + n(0.15)
    theta = 0.6 * math.sin(2 * math.pi * 6.0 * t) + n(0.12)
    alpha = 0.7 * math.sin(2 * math.pi * 10.0 * t) + n(0.10)
    beta  = 0.5 * math.sin(2 * math.pi * 20.0 * t) + n(0.18)
    gamma = 0.3 * math.sin(2 * math.pi * 40.0 * t) + n(0.08)
    focus_index    = max(0.0, min(100.0, beta  / (abs(alpha) + abs(theta) + 0.1) * 50 + 50))
    calmness_index = max(0.0, min(100.0, alpha / (abs(beta)  + abs(gamma) + 0.1) * 50 + 50))
    return {
        "delta":          round(delta, 4),
        "theta":          round(theta, 4),
        "alpha":          round(alpha, 4),
        "beta":           round(beta,  4),
        "gamma":          round(gamma, 4),
        "focus_index":    round(focus_index,    1),
        "calmness_index": round(calmness_index, 1),
        "timestamp":      time.time(),
    }


# ── Recommendations ───────────────────────────────────────────────────────────
_RECS = [
    {
        "type": "breathing",
        "priority": "high",
        "title": "Box Breathing",
        "description": "4-4-4-4 pattern to activate the parasympathetic nervous system.",
        "duration": "5 min",
        "icon": "wind",
    },
    {
        "type": "movement",
        "priority": "medium",
        "title": "Micro-break Walk",
        "description": "A short walk lowers cortisol and boosts alpha oscillations.",
        "duration": "10 min",
        "icon": "activity",
    },
    {
        "type": "hydration",
        "priority": "low",
        "title": "Hydrate",
        "description": "Dehydration increases cognitive load. Drink 250 ml of water.",
        "duration": "1 min",
        "icon": "droplets",
    },
    {
        "type": "rest",
        "priority": "critical",
        "title": "Rest Now",
        "description": "High burnout detected. Step away from the screen for 20 minutes.",
        "duration": "20 min",
        "icon": "moon",
    },
    {
        "type": "focus",
        "priority": "medium",
        "title": "Pomodoro Reset",
        "description": "Use a 25/5 work-rest cycle to restore focus.",
        "duration": "30 min",
        "icon": "timer",
    },
]


def get_recommendations(metrics: Dict) -> List[Dict]:
    bs = metrics.get("burnout_score", 0)
    stress = metrics.get("stress", 0)
    if bs >= 75 or stress >= 80:
        priority_order = ["critical", "high", "medium"]
    elif bs >= 55:
        priority_order = ["high", "medium", "low"]
    else:
        priority_order = ["medium", "low"]
    out = [r for p in priority_order for r in _RECS if r["priority"] == p]
    return out[:3] or _RECS[:2]


# ── Mock PSD decomposition ────────────────────────────────────────────────────
def generate_mock_psd() -> Dict:
    """
    Generate a realistic mock PSD (log10 power vs frequency) for the aperiodic
    exponent panel. Evolves slowly via _state so successive polls look live.
    """
    _update_state()

    freqs = np.arange(2.0, 75.25, 0.25)
    exponent = float(_state["exponent"])
    offset   = float(random.uniform(0.8, 1.1))  # gain-invariant; just visual scale
    alpha_cf = float(_state["alpha_cf"])

    # Aperiodic baseline (log10 power)
    log_ap = offset - exponent * np.log10(freqs)

    # ── Periodic peaks ────────────────────────────────────────────────────────
    peaks = []

    # Alpha peak (always present)
    alpha_pw = random.uniform(0.25, 0.70)
    alpha_bw = random.uniform(2.0, 4.0)
    alpha_g  = alpha_pw * np.exp(-0.5 * ((freqs - alpha_cf) / (alpha_bw / 2)) ** 2)
    peaks.append({"cf": round(alpha_cf, 2), "pw": round(alpha_pw, 4),
                  "bw": round(alpha_bw, 2), "band": "alpha"})

    # Theta peak (60% chance)
    theta_g = np.zeros(len(freqs))
    if random.random() > 0.4:
        theta_cf = random.uniform(5.0, 7.5)
        theta_pw = random.uniform(0.1, 0.35)
        theta_bw = random.uniform(2.0, 4.0)
        theta_g  = theta_pw * np.exp(-0.5 * ((freqs - theta_cf) / (theta_bw / 2)) ** 2)
        peaks.append({"cf": round(theta_cf, 2), "pw": round(theta_pw, 4),
                      "bw": round(theta_bw, 2), "band": "theta"})

    # Beta peak (40% chance)
    beta_g = np.zeros(len(freqs))
    if random.random() > 0.6:
        beta_cf = random.uniform(18.0, 25.0)
        beta_pw = random.uniform(0.05, 0.18)
        beta_bw = random.uniform(3.0, 6.0)
        beta_g  = beta_pw * np.exp(-0.5 * ((freqs - beta_cf) / (beta_bw / 2)) ** 2)
        peaks.append({"cf": round(beta_cf, 2), "pw": round(beta_pw, 4),
                      "bw": round(beta_bw, 2), "band": "beta"})

    periodic  = alpha_g + theta_g + beta_g
    noise     = np.random.normal(0, 0.07, len(freqs))
    log_psd   = log_ap + periodic + noise

    r2      = round(random.uniform(0.78, 0.97), 4)
    exp_s   = round(exponent + random.uniform(-0.04, 0.04), 3)
    score   = int(round(min(100, max(0, (exp_s - 0.4) / (1.4 - 0.4) * 100))))
    rel_alp = round(random.uniform(12.0, 32.0), 1)

    return {
        "freqs":              [round(float(f), 3) for f in freqs],
        "log_psd":            [round(float(v), 4) for v in log_psd],
        "exponent":           round(exponent, 4),
        "offset":             round(offset,   4),
        "peaks":              peaks,
        "r2":                 r2,
        "exponent_smoothed":  exp_s,
        "brain_state_score":  score,
        "relative_alpha_pct": rel_alp,
        "quality":            r2 >= 0.8 and 0.1 < exponent < 2.5,
    }
