import random
import math
import time
from typing import Dict, List


# Global state for smooth metric drift
_metric_state = {
    "stress": 45.0,
    "calmness": 62.0,
    "focus": 68.0,
    "fatigue": 38.0,
}


def _drift(value: float, speed: float = 1.5, min_val: float = 10.0, max_val: float = 90.0) -> float:
    return max(min_val, min(max_val, value + random.gauss(0, speed)))


def get_burnout_level(score: float) -> str:
    if score < 30:
        return "Low"
    elif score < 55:
        return "Moderate"
    elif score < 75:
        return "High"
    return "Critical"


def generate_voice_metrics() -> Dict:
    global _metric_state
    _metric_state["stress"] = random.uniform(25, 80)
    _metric_state["focus"] = random.uniform(35, 90)
    _metric_state["fatigue"] = random.uniform(20, 72)
    _metric_state["calmness"] = max(10, 100 - _metric_state["stress"] + random.gauss(0, 8))

    stress = _metric_state["stress"]
    fatigue = _metric_state["fatigue"]
    focus = _metric_state["focus"]
    burnout_score = round(0.5 * stress + 0.3 * fatigue + 0.2 * (1 - focus / 100) * 100, 1)
    mental_readiness = round(max(0, 100 - burnout_score * 0.7), 1)

    return {
        "stress": round(stress, 1),
        "calmness": round(min(100, _metric_state["calmness"]), 1),
        "focus": round(focus, 1),
        "fatigue": round(fatigue, 1),
        "burnout_score": min(100, burnout_score),
        "mental_readiness": mental_readiness,
        "burnout_level": get_burnout_level(burnout_score),
        "timestamp": time.time(),
    }


def get_streaming_metrics() -> Dict:
    global _metric_state
    for key in ["stress", "calmness", "focus", "fatigue"]:
        _metric_state[key] = _drift(_metric_state[key])

    stress = _metric_state["stress"]
    fatigue = _metric_state["fatigue"]
    focus = _metric_state["focus"]
    burnout_score = round(0.5 * stress + 0.3 * fatigue + 0.2 * (1 - focus / 100) * 100, 1)
    mental_readiness = round(max(0, 100 - burnout_score * 0.7), 1)

    return {
        "stress": round(stress, 1),
        "calmness": round(min(100, _metric_state["calmness"]), 1),
        "focus": round(focus, 1),
        "fatigue": round(fatigue, 1),
        "burnout_score": min(100, burnout_score),
        "mental_readiness": mental_readiness,
        "burnout_level": get_burnout_level(burnout_score),
        "timestamp": time.time(),
    }


def generate_eeg_data(t: float) -> Dict:
    noise = lambda amp: random.gauss(0, amp)
    delta = 0.80 * math.sin(2 * math.pi * 2.0 * t) + noise(0.15)
    theta = 0.60 * math.sin(2 * math.pi * 6.0 * t) + noise(0.12)
    alpha = 0.70 * math.sin(2 * math.pi * 10.0 * t) + noise(0.10)
    beta = 0.50 * math.sin(2 * math.pi * 20.0 * t) + noise(0.18)
    gamma = 0.30 * math.sin(2 * math.pi * 40.0 * t) + noise(0.08)

    focus_index = max(0, min(100, (beta / (abs(alpha) + abs(theta) + 0.1)) * 50 + 50))
    calmness_index = max(0, min(100, (alpha / (abs(beta) + abs(gamma) + 0.1)) * 50 + 50))

    return {
        "delta": round(delta, 4),
        "theta": round(theta, 4),
        "alpha": round(alpha, 4),
        "beta": round(beta, 4),
        "gamma": round(gamma, 4),
        "focus_index": round(focus_index, 1),
        "calmness_index": round(calmness_index, 1),
        "timestamp": time.time(),
    }


def get_recommendations(metrics: Dict) -> List[Dict]:
    recs = []
    stress = metrics.get("stress", 50)
    fatigue = metrics.get("fatigue", 50)
    focus = metrics.get("focus", 50)
    burnout = metrics.get("burnout_score", 50)

    if stress > 65:
        recs.append({
            "type": "breathing",
            "priority": "high",
            "title": "4-7-8 Breathing Protocol",
            "description": "Elevated cortisol signatures detected. Activate your parasympathetic nervous system with the 4-7-8 breathing technique to reduce stress markers.",
            "duration": "5 min",
            "icon": "Wind",
        })
    elif stress > 40:
        recs.append({
            "type": "breathing",
            "priority": "medium",
            "title": "Box Breathing",
            "description": "Moderate stress detected. Box breathing (4-4-4-4) can regulate your autonomic nervous system.",
            "duration": "3 min",
            "icon": "Wind",
        })

    if fatigue > 60:
        recs.append({
            "type": "break",
            "priority": "high",
            "title": "Microrecovery Break",
            "description": "High neural fatigue detected. Step away from screens, walk, and hydrate for optimal cognitive recovery.",
            "duration": "15 min",
            "icon": "Coffee",
        })

    if focus < 45:
        recs.append({
            "type": "mindfulness",
            "priority": "medium",
            "title": "Focus Reset Meditation",
            "description": "Alpha brainwave suppression detected. A brief mindfulness session can restore attentional control and boost your concentration.",
            "duration": "10 min",
            "icon": "Brain",
        })

    if burnout > 65:
        recs.append({
            "type": "alert",
            "priority": "critical",
            "title": "Burnout Risk Alert",
            "description": "Critical burnout indicators across multiple biomarkers. Prioritize rest, defer non-urgent tasks, and consider discussing workload sustainability.",
            "duration": "30+ min",
            "icon": "AlertTriangle",
        })

    recs.append({
        "type": "audio",
        "priority": "low",
        "title": "Neural Entrainment Audio",
        "description": "Binaural beats calibrated to your current brainwave state to guide your mind toward optimal focus or calm.",
        "duration": "15 min",
        "icon": "Headphones",
    })

    if focus > 70 and stress < 40:
        recs.append({
            "type": "flow",
            "priority": "low",
            "title": "Flow State Detected",
            "description": "Optimal cognitive performance window open. This is the perfect time for deep work and complex problem-solving.",
            "duration": "Now",
            "icon": "Zap",
        })

    return recs
