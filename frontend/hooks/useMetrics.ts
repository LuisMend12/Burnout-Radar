"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Metrics, TimelinePoint } from "@/types";
import { generateDefaultMetrics, computeBurnoutScore, getBurnoutLevel, formatTime } from "@/lib/utils";
import { fetchTimeline } from "@/lib/api";

const TIMELINE_MAX = 3600; // 1 hour at 2 s/tick — retain full session for labeling

// Session clock anchored to 13:57:00 — every tick advances 2 s from this base
const SESSION_START = new Date();
SESSION_START.setHours(13, 57, 0, 0);

function driftValue(v: number, speed = 1.2, min = 8, max = 92): number {
  return Math.max(min, Math.min(max, v + (Math.random() - 0.5) * speed * 2));
}

function simulateMetrics(prev: Metrics): Metrics {
  const stress = driftValue(prev.stress, 1.5);
  const calmness = driftValue(prev.calmness, 1.2);
  const focus = driftValue(prev.focus, 1.8);
  const fatigue = driftValue(prev.fatigue, 1.0);
  const burnout_score = Math.round(computeBurnoutScore(stress, fatigue, focus) * 10) / 10;
  const mental_readiness = Math.round(Math.max(0, 100 - burnout_score * 0.7) * 10) / 10;
  return {
    stress: Math.round(stress * 10) / 10,
    calmness: Math.round(calmness * 10) / 10,
    focus: Math.round(focus * 10) / 10,
    fatigue: Math.round(fatigue * 10) / 10,
    burnout_score,
    mental_readiness,
    burnout_level: getBurnoutLevel(burnout_score),
    timestamp: Date.now() / 1000,
  };
}

function metricsToTimelinePoint(m: Metrics, date: Date): TimelinePoint {
  return {
    time: formatTime(date),
    stress: Math.round(m.stress),
    focus: Math.round(m.focus),
    fatigue: Math.round(m.fatigue),
    calmness: Math.round(m.calmness),
    burnout: Math.round(m.burnout_score),
  };
}

function sessionDate(tick: number): Date {
  return new Date(SESSION_START.getTime() + tick * 2000);
}

export function useMetrics() {
  const [metrics, setMetrics] = useState<Metrics>(generateDefaultMetrics);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;
  const tickRef = useRef(0);

  const pushTimeline = useCallback((m: Metrics) => {
    const date = sessionDate(tickRef.current++);
    setTimeline((prev) => {
      const next = [...prev, metricsToTimelinePoint(m, date)];
      return next.length > TIMELINE_MAX ? next.slice(-TIMELINE_MAX) : next;
    });
  }, []);

  const updateMetrics = useCallback(
    (m: Metrics) => {
      setMetrics(m);
      pushTimeline(m);
    },
    [pushTimeline]
  );

  // Try WebSocket first, fall back to local simulation
  useEffect(() => {
    let destroyed = false;

    function startSimulation() {
      if (destroyed) return;
      intervalRef.current = setInterval(() => {
        const next = simulateMetrics(metricsRef.current);
        updateMetrics(next);
      }, 2000);
    }

    try {
      const ws = new WebSocket("ws://localhost:8000/metrics_stream");
      wsRef.current = ws;

      const timeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          startSimulation();
        }
      }, 2500);

      ws.onopen = () => {
        clearTimeout(timeout);
        setIsConnected(true);
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as Metrics;
          updateMetrics(data);
        } catch { /* ignore */ }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        setIsConnected(false);
        startSimulation();
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (!destroyed) startSimulation();
      };
    } catch {
      startSimulation();
    }

    return () => {
      destroyed = true;
      wsRef.current?.close();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [updateMetrics]);

  // Seed the timeline with real historical data (falls back to simulated if unavailable)
  useEffect(() => {
    fetchTimeline(60).then((history) => {
      if (history.length > 0) {
        setTimeline(history);
      } else {
        const initial = generateDefaultMetrics();
        const SEED_COUNT = 10;
        const seed: TimelinePoint[] = Array.from({ length: SEED_COUNT }, (_, i) => {
          const t = simulateMetrics(initial);
          return metricsToTimelinePoint(t, sessionDate(i));
        });
        tickRef.current = SEED_COUNT;
        setTimeline(seed);
      }
    });
  }, []);

  const triggerAnalysis = useCallback((newMetrics?: Metrics) => {
    if (newMetrics) {
      updateMetrics(newMetrics);
    } else {
      const next = simulateMetrics(metricsRef.current);
      updateMetrics(next);
    }
  }, [updateMetrics]);

  return { metrics, timeline, isConnected, triggerAnalysis };
}
