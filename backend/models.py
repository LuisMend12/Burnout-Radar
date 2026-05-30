from pydantic import BaseModel
from typing import List, Optional


class VoiceAnalysisResponse(BaseModel):
    success: bool
    metrics: dict
    analysis: dict


class MetricsResponse(BaseModel):
    stress: float
    calmness: float
    focus: float
    fatigue: float
    burnout_score: float
    mental_readiness: float
    burnout_level: str
    timestamp: float


class EEGDataPoint(BaseModel):
    delta: float
    theta: float
    alpha: float
    beta: float
    gamma: float
    focus_index: float
    calmness_index: float
    timestamp: float


class Recommendation(BaseModel):
    type: str
    priority: str
    title: str
    description: str
    duration: str
    icon: str


class RecommendationsResponse(BaseModel):
    recommendations: List[Recommendation]
    generated_at: float
