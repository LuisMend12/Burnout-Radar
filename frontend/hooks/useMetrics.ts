"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Metrics, TimelinePoint } from "@/types";
import { generateDefaultMetrics, computeBurnoutScore, getBurnoutLevel, formatTime } from "@/lib/utils";
import { fetchTimeline } from "@/lib/api";

const TIMELINE_MAX = 3600;

const SESSION_START = new Date();

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

  useEffect(() => {
    let destroyed = false;

    function connect() {
      if (destroyed) return;
      try {
        const ws = new WebSocket("ws://localhost:8000/metrics_stream");
        wsRef.current = ws;

        ws.onopen = () => setIsConnected(true);

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data) as Metrics;
            updateMetrics(data);
          } catch { /* ignore */ }
        };

        ws.onerror = () => setIsConnected(false);

        ws.onclose = () => {
          setIsConnected(false);
          if (!destroyed) setTimeout(connect, 3000);
        };
      } catch {
        if (!destroyed) setTimeout(connect, 3000);
      }
    }

    connect();

    return () => {
      destroyed = true;
      wsRef.current?.close();
    };
  }, [updateMetrics]);

  // Seed timeline from real historical data only
  useEffect(() => {
    fetchTimeline(60).then((history) => {
      if (history.length > 0) {
        setTimeline(history);
        tickRef.current = history.length;
      }
    });
  }, []);

  const triggerAnalysis = useCallback((newMetrics?: Metrics) => {
    if (newMetrics) updateMetrics(newMetrics);
  }, [updateMetrics]);

  return { metrics, timeline, isConnected, triggerAnalysis };
}
