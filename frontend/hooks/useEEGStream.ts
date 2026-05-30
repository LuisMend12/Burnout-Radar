"use client";

import { useState, useEffect, useRef } from "react";
import type { EEGDataPoint, BandPowers, PowerRatios, SpectralFeatures, PeriodicPeak } from "@/types";

const BUFFER_SIZE = 80;

function computeBandPowers(buffer: EEGDataPoint[]): BandPowers {
  const len = buffer.length;
  if (len === 0) return { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 };
  const sum = buffer.reduce(
    (acc, p) => ({
      delta: acc.delta + p.delta ** 2,
      theta: acc.theta + p.theta ** 2,
      alpha: acc.alpha + p.alpha ** 2,
      beta:  acc.beta  + p.beta  ** 2,
      gamma: acc.gamma + p.gamma ** 2,
    }),
    { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 }
  );
  return {
    delta: +(Math.sqrt(sum.delta / len)).toFixed(4),
    theta: +(Math.sqrt(sum.theta / len)).toFixed(4),
    alpha: +(Math.sqrt(sum.alpha / len)).toFixed(4),
    beta:  +(Math.sqrt(sum.beta  / len)).toFixed(4),
    gamma: +(Math.sqrt(sum.gamma / len)).toFixed(4),
  };
}

function computePowerRatios(p: BandPowers): PowerRatios {
  const eps = 0.0001;
  return {
    thetaBeta:       +(p.theta / (p.beta  + eps)).toFixed(3),
    alphaBeta:       +(p.alpha / (p.beta  + eps)).toFixed(3),
    engagementIndex: +(p.beta  / (p.alpha + p.theta + eps)).toFixed(3),
    thetaAlpha:      +(p.theta / (p.alpha + eps)).toFixed(3),
  };
}

const BAND_KEYS = ["delta", "theta", "alpha", "beta", "gamma"] as const;
const BAND_FREQS: Record<string, number> = { delta: 2, theta: 6, alpha: 10, beta: 20, gamma: 40 };
const BAND_BWS:   Record<string, number> = { delta: 3, theta: 4, alpha: 5,  beta: 17, gamma: 15 };

function computeSpectralFeatures(p: BandPowers): SpectralFeatures {
  const eps = 1e-8;
  const ps = BAND_KEYS.map((k) => p[k]);
  const fs = BAND_KEYS.map((k) => BAND_FREQS[k]);
  const total = ps.reduce((a, b) => a + b, 0) + eps;

  const probs = ps.map((v) => (v + eps) / total);
  const entropy = -probs.reduce((s, prob) => s + prob * Math.log(prob), 0);
  const spectralEntropy = +(entropy / Math.log(BAND_KEYS.length)).toFixed(4);

  const meanFrequency = +(fs.reduce((s, f, i) => s + f * probs[i], 0)).toFixed(2);

  let cumSum = 0;
  let sef95 = fs[fs.length - 1];
  for (let i = 0; i < ps.length; i++) {
    cumSum += ps[i];
    if (cumSum / total >= 0.95) { sef95 = fs[i]; break; }
  }

  const logF = fs.map((f) => Math.log(f));
  const logP = ps.map((v) => Math.log(v + eps));
  const n = logF.length;
  const sumX  = logF.reduce((a, b) => a + b, 0);
  const sumY  = logP.reduce((a, b) => a + b, 0);
  const sumXY = logF.reduce((s, x, i) => s + x * logP[i], 0);
  const sumX2 = logF.reduce((s, x) => s + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const decayingExponent = +(-slope).toFixed(3);

  return { spectralEntropy, meanFrequency, sef95, decayingExponent };
}

function computePeriodicPeaks(p: BandPowers): PeriodicPeak[] {
  const eps = 1e-8;
  const ps  = BAND_KEYS.map((k) => p[k]);
  const cfs = BAND_KEYS.map((k) => BAND_FREQS[k]);

  const logF = cfs.map((f) => Math.log(f));
  const logP  = ps.map((v) => Math.log(v + eps));
  const n     = logF.length;
  const sumX  = logF.reduce((a, b) => a + b, 0);
  const sumY  = logP.reduce((a, b) => a + b, 0);
  const sumXY = logF.reduce((s, x, i) => s + x * logP[i], 0);
  const sumX2 = logF.reduce((s, x) => s + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-12) return [];
  const slope     = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const peaks: PeriodicPeak[] = [];
  BAND_KEYS.forEach((band, i) => {
    const floorLog = intercept + slope * logF[i];
    const pw = logP[i] - floorLog;
    if (pw > 0.05) {
      peaks.push({ cf: cfs[i], pw: +pw.toFixed(4), bw: BAND_BWS[band], band });
    }
  });
  return peaks;
}

const ZERO_POWERS: BandPowers = { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 };
const ZERO_RATIOS: PowerRatios = { thetaBeta: 0, alphaBeta: 0, engagementIndex: 0, thetaAlpha: 0 };
const ZERO_SPECTRAL: SpectralFeatures = { spectralEntropy: 0, meanFrequency: 0, sef95: 0, decayingExponent: 0 };

export function useEEGStream() {
  const [eegBuffer, setEEGBuffer] = useState<EEGDataPoint[]>([]);
  const [focusIndex, setFocusIndex] = useState(0);
  const [calmnessIndex, setCalmnessIndex] = useState(0);
  const [bandPowers, setBandPowers] = useState<BandPowers>(ZERO_POWERS);
  const [powerRatios, setPowerRatios] = useState<PowerRatios>(ZERO_RATIOS);
  const [spectralFeatures, setSpectralFeatures] = useState<SpectralFeatures>(ZERO_SPECTRAL);
  const [periodicPeaks, setPeriodicPeaks] = useState<PeriodicPeak[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const indexRef = useRef(0);
  const bufferRef = useRef<EEGDataPoint[]>([]);

  useEffect(() => {
    let destroyed = false;

    function pushPoint(point: EEGDataPoint) {
      const idx = indexRef.current++;
      const tagged = { ...point, index: idx };
      const next = [...bufferRef.current, tagged];
      bufferRef.current = next.length > BUFFER_SIZE ? next.slice(-BUFFER_SIZE) : next;
      setEEGBuffer([...bufferRef.current]);
      setFocusIndex(+(point.focus_index.toFixed(1)));
      setCalmnessIndex(+(point.calmness_index.toFixed(1)));
      const powers = computeBandPowers(bufferRef.current);
      setBandPowers(powers);
      setPowerRatios(computePowerRatios(powers));
      setSpectralFeatures(computeSpectralFeatures(powers));
      setPeriodicPeaks(computePeriodicPeaks(powers));
    }

    function connect() {
      if (destroyed) return;
      try {
        const ws = new WebSocket("ws://localhost:8000/eeg_stream");
        wsRef.current = ws;

        ws.onopen = () => setIsConnected(true);

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data) as EEGDataPoint;
            pushPoint(data);
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
  }, []);

  return { eegBuffer, focusIndex, calmnessIndex, bandPowers, powerRatios, spectralFeatures, periodicPeaks, isConnected };
}
