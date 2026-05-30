export interface Metrics {
  stress: number;
  calmness: number;
  focus: number;
  fatigue: number;
  burnout_score: number;
  mental_readiness: number;
  burnout_level: "Low" | "Moderate" | "High" | "Critical";
  timestamp: number;
}

export interface EEGDataPoint {
  delta: number;
  theta: number;
  alpha: number;
  beta: number;
  gamma: number;
  focus_index: number;
  calmness_index: number;
  timestamp: number;
  index?: number;
}

export interface BandPowers {
  delta: number;
  theta: number;
  alpha: number;
  beta: number;
  gamma: number;
}

export interface PowerRatios {
  thetaBeta: number;        // θ/β  — attention/drowsiness marker
  alphaBeta: number;        // α/β  — relaxation vs active thinking
  engagementIndex: number;  // β/(α+θ) — cognitive engagement
  thetaAlpha: number;       // θ/α  — mental fatigue indicator
}

export interface SpectralFeatures {
  spectralEntropy: number;  // 0-1, normalized Shannon entropy over band powers
  meanFrequency: number;    // Hz, power-weighted centroid
  sef95: number;            // Hz, frequency below which 95% of power lies
  decayingExponent: number; // β in 1/f^β — aperiodic slope of log-log PSD
}

export interface PeriodicPeak {
  cf: number;   // center frequency Hz
  pw: number;   // power above aperiodic floor (log units)
  bw: number;   // bandwidth Hz
  band: string; // delta | theta | alpha | beta | gamma | broadband
}

export interface TimelinePoint {
  time: string;
  stress: number;
  focus: number;
  fatigue: number;
  calmness: number;
  burnout: number;
}

export interface Recommendation {
  type: string;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  duration: string;
  icon: string;
}

export type MetricKey = "stress" | "calmness" | "focus" | "fatigue" | "burnout_score" | "mental_readiness";

export interface VoiceAnalysisResult {
  metrics: Metrics;
  analysis: {
    pitch_variation_hz: number;
    speech_rate_wpm: number;
    voice_energy_db: number;
    tremor_index: number;
    jitter_percent: number;
    shimmer_percent: number;
    confidence_score: number;
    processing_time_ms: number;
  };
}
