"use client";

import { useState, useEffect, useRef } from "react";

export interface PeriodicPeakSpec {
  cf: number;
  pw: number;
  bw: number;
  band: string;
}

export interface AperiodicPSDData {
  participant: string;
  as_of: string;
  lag_seconds: number;
  // PSD decomposition
  freqs: number[];
  log_psd: number[];
  exponent: number | null;
  offset: number | null;
  peaks: PeriodicPeakSpec[];
  r2: number;
  // summary stats
  exponent_smoothed: number | null;
  brain_state_score: number;
  relative_alpha_pct: number;
  quality: boolean;
}

export function useAperiodicStream(pollMs = 4000) {
  const [data, setData] = useState<AperiodicPSDData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let destroyed = false;

    async function poll() {
      if (destroyed) return;
      try {
        const r = await fetch("http://localhost:8000/live/psd?lookback=6");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        if (destroyed) return;
        if (d.error) {
          setError(d.error);
          setIsConnected(false);
        } else {
          setData(d as AperiodicPSDData);
          setError(null);
          setIsConnected(true);
        }
      } catch {
        if (!destroyed) {
          setIsConnected(false);
          setError("Cannot reach backend");
        }
      }
      if (!destroyed) {
        timerRef.current = setTimeout(poll, pollMs);
      }
    }

    poll();

    return () => {
      destroyed = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pollMs]);

  return { data, error, isConnected };
}
