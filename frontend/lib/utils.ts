import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Metrics } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatScore(value: number, decimals = 0): string {
  return value.toFixed(decimals);
}

export function getBurnoutLevel(score: number): "Low" | "Moderate" | "High" | "Critical" {
  if (score < 30) return "Low";
  if (score < 55) return "Moderate";
  if (score < 75) return "High";
  return "Critical";
}

export function getBurnoutColor(level: string): string {
  switch (level) {
    case "Low": return "#22c55e";
    case "Moderate": return "#f59e0b";
    case "High": return "#f97316";
    case "Critical": return "#ff4757";
    default: return "#94a3b8";
  }
}

export function getReadinessLabel(score: number): string {
  if (score >= 80) return "Optimal";
  if (score >= 65) return "Good";
  if (score >= 45) return "Fair";
  if (score >= 30) return "Impaired";
  return "Critical";
}

export function getReadinessColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 65) return "#00f5ff";
  if (score >= 45) return "#f59e0b";
  if (score >= 30) return "#f97316";
  return "#ff4757";
}

export function getMetricColor(key: string): string {
  const colors: Record<string, string> = {
    stress: "#ff4757",
    calmness: "#22c55e",
    focus: "#00f5ff",
    fatigue: "#a855f7",
    burnout_score: "#f97316",
    mental_readiness: "#22c55e",
  };
  return colors[key] ?? "#94a3b8";
}

export function getMetricStatus(key: string, value: number): string {
  if (key === "stress" || key === "fatigue" || key === "burnout_score") {
    if (value < 30) return "Low";
    if (value < 60) return "Moderate";
    return "High";
  }
  if (key === "focus" || key === "calmness" || key === "mental_readiness") {
    if (value >= 70) return "High";
    if (value >= 45) return "Moderate";
    return "Low";
  }
  return "—";
}

export function generateDefaultMetrics(): Metrics {
  return {
    stress: 42,
    calmness: 65,
    focus: 71,
    fatigue: 35,
    burnout_score: 33,
    mental_readiness: 76,
    burnout_level: "Low",
    timestamp: Date.now() / 1000,
  };
}

export function computeBurnoutScore(stress: number, fatigue: number, focus: number): number {
  return Math.min(100, 0.5 * stress + 0.3 * fatigue + 0.2 * (1 - focus / 100) * 100);
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
