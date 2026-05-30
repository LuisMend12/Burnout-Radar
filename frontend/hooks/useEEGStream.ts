"use client";

import { useState, useEffect, useRef } from "react";
import type { EEGDataPoint, BandPowers, PowerRatios, SpectralFeatures } from "@/types";

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

// Center frequencies (Hz) for each simulated band
const BAND_KEYS = ["delta", "theta", "alpha", "beta", "gamma"] as const;
const BAND_FREQS: Record<string, number> = { delta: 2, theta: 6, alpha: 10, beta: 20, gamma: 40 };

function computeSpectralFeatures(p: BandPowers): SpectralFeatures {
  const eps = 1e-8;
  const ps = BAND_KEYS.map((k) => p[k]);
  const fs = BAND_KEYS.map((k) => BAND_FREQS[k]);
  const total = ps.reduce((a, b) => a + b, 0) + eps;

  // Normalized Shannon entropy
  const probs = ps.map((v) => (v + eps) / total);
  const entropy = -probs.reduce((s, prob) => s + prob * Math.log(prob), 0);
  const spectralEntropy = +(entropy / Math.log(BAND_KEYS.length)).toFixed(4);

  // Power-weighted mean frequency
  const meanFrequency = +(fs.reduce((s, f, i) => s + f * probs[i], 0)).toFixed(2);

  // Spectral edge 95 — lowest band whose cumulative power exceeds 95% of total
  let cumSum = 0;
  let sef95 = fs[fs.length - 1];
  for (let i = 0; i < ps.length; i++) {
    cumSum += ps[i];
    if (cumSum / total >= 0.95) { sef95 = fs[i]; break; }
  }

  // Decaying exponent β via log-log OLS: log(P) = c − β·log(f)
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

function generateEEGPoint(t: number): EEGDataPoint {
  const n = (amp: number) => (Math.random() - 0.5) * amp;
  const delta = 0.8 * Math.sin(2 * Math.PI * 2.0 * t) + n(0.15);
  const theta = 0.6 * Math.sin(2 * Math.PI * 6.0 * t) + n(0.12);
  const alpha = 0.7 * Math.sin(2 * Math.PI * 10.0 * t) + n(0.10);
  const beta  = 0.5 * Math.sin(2 * Math.PI * 20.0 * t) + n(0.18);
  const gamma = 0.3 * Math.sin(2 * Math.PI * 40.0 * t) + n(0.08);
  const focusIndex    = Math.max(0, Math.min(100, (beta  / (Math.abs(alpha) + Math.abs(theta) + 0.1)) * 50 + 50));
  const calmnessIndex = Math.max(0, Math.min(100, (alpha / (Math.abs(beta)  + Math.abs(gamma) + 0.1)) * 50 + 50));
  return {
    delta: +delta.toFixed(4),
    theta: +theta.toFixed(4),
    alpha: +alpha.toFixed(4),
    beta:  +beta.toFixed(4),
    gamma: +gamma.toFixed(4),
    focus_index:    +focusIndex.toFixed(1),
    calmness_index: +calmnessIndex.toFixed(1),
    timestamp: Date.now() / 1000,
  };
}

const ZERO_POWERS: BandPowers = { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 };
const ZERO_RATIOS: PowerRatios = { thetaBeta: 0, alphaBeta: 0, engagementIndex: 0, thetaAlpha: 0 };
const ZERO_SPECTRAL: SpectralFeatures = { spectralEntropy: 0, meanFrequency: 0, sef95: 0, decayingExponent: 0 };

export function useEEGStream() {
  const [eegBuffer, setEEGBuffer] = useState<EEGDataPoint[]>([]);
  const [focusIndex, setFocusIndex] = useState(62);
  const [calmnessIndex, setCalmnessIndex] = useState(58);
  const [bandPowers, setBandPowers] = useState<BandPowers>(ZERO_POWERS);
  const [powerRatios, setPowerRatios] = useState<PowerRatios>(ZERO_RATIOS);
  const [spectralFeatures, setSpectralFeatures] = useState<SpectralFeatures>(ZERO_SPECTRAL);
  const [isConnected, setIsConnected] = useState(false);
  const tRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const indexRef = useRef(0);
  const bufferRef = useRef<EEGDataPoint[]>([]);

  useEffect(() => {
    let destroyed = false;

    // Seed buffer
    const seed = Array.from({ length: BUFFER_SIZE }, (_, i) => ({
      ...generateEEGPoint(i * 0.1),
      index: i,
    }));
    bufferRef.current = seed;
    setEEGBuffer(seed);
    indexRef.current = BUFFER_SIZE;
    const seedPowers = computeBandPowers(seed);
    setBandPowers(seedPowers);
    setPowerRatios(computePowerRatios(seedPowers));
    setSpectralFeatures(computeSpectralFeatures(seedPowers));

    function pushPoint(point: EEGDataPoint) {
      const idx = indexRef.current++;
      const tagged = { ...point, index: idx };
      const next = [...bufferRef.current, tagged];
      bufferRef.current = next.length > BUFFER_SIZE ? next.slice(-BUFFER_SIZE) : next;
      setEEGBuffer(bufferRef.current);
      setFocusIndex(+(point.focus_index.toFixed(1)));
      setCalmnessIndex(+(point.calmness_index.toFixed(1)));
      const powers = computeBandPowers(bufferRef.current);
      setBandPowers(powers);
      setPowerRatios(computePowerRatios(powers));
      setSpectralFeatures(computeSpectralFeatures(powers));
    }

    function startSimulation() {
      if (destroyed) return;
      intervalRef.current = setInterval(() => {
        tRef.current += 0.1;
        pushPoint(generateEEGPoint(tRef.current));
      }, 100);
    }

    try {
      const ws = new WebSocket("ws://localhost:8000/eeg_stream");
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
          const data = JSON.parse(e.data) as EEGDataPoint;
          pushPoint(data);
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
  }, []);

  return { eegBuffer, focusIndex, calmnessIndex, bandPowers, powerRatios, spectralFeatures, isConnected };
}
