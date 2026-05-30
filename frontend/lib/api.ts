import type { Metrics, Recommendation, VoiceAnalysisResult } from "@/types";
import { generateDefaultMetrics } from "./utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchWithFallback<T>(url: string, fallback: T, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(url, { ...options, signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export async function fetchMetrics(): Promise<Metrics> {
  return fetchWithFallback<Metrics>(`${API_BASE}/metrics`, generateDefaultMetrics());
}

export async function fetchRecommendations(): Promise<Recommendation[]> {
  const data = await fetchWithFallback<{ recommendations: Recommendation[] }>(
    `${API_BASE}/recommendations`,
    { recommendations: [] }
  );
  return data.recommendations;
}

export async function analyzeVoice(audioBlob?: Blob): Promise<VoiceAnalysisResult | null> {
  try {
    const formData = new FormData();
    if (audioBlob) {
      formData.append("file", audioBlob, "recording.webm");
    }
    const res = await fetch(`${API_BASE}/analyze_voice`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as VoiceAnalysisResult;
  } catch {
    return null;
  }
}

export function createMetricsWebSocket(onMessage: (data: Metrics) => void): WebSocket | null {
  try {
    const ws = new WebSocket(`ws://localhost:8000/metrics_stream`);
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as Metrics;
        onMessage(data);
      } catch { /* ignore parse errors */ }
    };
    return ws;
  } catch {
    return null;
  }
}

export function createEEGWebSocket(onMessage: (data: unknown) => void): WebSocket | null {
  try {
    const ws = new WebSocket(`ws://localhost:8000/eeg_stream`);
    ws.onmessage = (e) => {
      try {
        onMessage(JSON.parse(e.data));
      } catch { /* ignore parse errors */ }
    };
    return ws;
  } catch {
    return null;
  }
}
