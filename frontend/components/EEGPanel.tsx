"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  ReferenceLine,
} from "recharts";
import { Zap } from "lucide-react";
import { GlowCard } from "./GlowCard";
import type { EEGDataPoint } from "@/types";

interface EEGPanelProps {
  eegBuffer: EEGDataPoint[];
  focusIndex: number;
  calmnessIndex: number;
}

const BANDS = [
  { key: "alpha", label: "Alpha",  color: "#00f5ff",  freq: "8–13 Hz" },
  { key: "beta",  label: "Beta",   color: "#a855f7",  freq: "13–30 Hz" },
  { key: "theta", label: "Theta",  color: "#22d3ee",  freq: "4–8 Hz" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[rgba(12,12,30,0.95)] border border-cyan-neon/20 rounded-lg px-3 py-2 text-xs backdrop-blur-xl">
      {payload.map((p: { name: string; value: number; color: string }) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-400 capitalize">{p.name}:</span>
          <span className="font-mono" style={{ color: p.color }}>
            {Number(p.value).toFixed(3)}
          </span>
        </div>
      ))}
    </div>
  );
}

function GaugeArc({ value, color, label, size = 90 }: { value: number; color: string; label: string; size?: number }) {
  const R = size / 2 - 8;
  const C = size / 2;
  const startDeg = -135;
  const endDeg = startDeg + 270 * (value / 100);

  function polar(deg: number) {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: C + R * Math.cos(rad), y: C + R * Math.sin(rad) };
  }
  function arc(from: number, to: number) {
    const s = polar(from), e = polar(to);
    const large = to - from > 180 ? 1 : 0;
    return `M${s.x.toFixed(2)} ${s.y.toFixed(2)} A${R} ${R} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <filter id={`glow-${label}`}>
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path d={arc(-135, 135)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" strokeLinecap="round" />
        <motion.path
          d={arc(startDeg, Math.max(startDeg + 1, endDeg))}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          filter={`url(#glow-${label})`}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{ transition: "d 0.6s ease" }}
        />
        <text x={C} y={C - 4} textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize="16" fontFamily="var(--font-orbitron)" fontWeight="700"
          style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}>
          {Math.round(value)}
        </text>
        <text x={C} y={C + 12} textAnchor="middle"
          fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="var(--font-inter)">
          {label}
        </text>
      </svg>
    </div>
  );
}

export function EEGPanel({ eegBuffer, focusIndex, calmnessIndex }: EEGPanelProps) {
  const chartData = useMemo(
    () => eegBuffer.map((d, i) => ({ ...d, i })),
    [eegBuffer]
  );

  return (
    <GlowCard variant="purple" delay={0.2} className="p-5 flex flex-col gap-5 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-purple-neon/10 border border-purple-neon/25 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-purple-neon" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-200 tracking-wide">EEG Biofeedback</h2>
            <p className="text-[10px] text-slate-500">Live brainwave simulation</p>
          </div>
        </div>
        {/* Band legend */}
        <div className="flex items-center gap-3">
          {BANDS.map((b) => (
            <div key={b.key} className="flex items-center gap-1">
              <div className="w-3 h-0.5 rounded" style={{ background: b.color }} />
              <span className="text-[10px] text-slate-500">{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* EEG Chart */}
      <div className="relative rounded-xl overflow-hidden bg-[rgba(168,85,247,0.03)] border border-purple-neon/10 flex-1" style={{ minHeight: 130 }}>
        <div className="scan-line" />
        <ResponsiveContainer width="100%" height={130}>
          <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
            <XAxis dataKey="i" hide />
            <YAxis domain={[-1.2, 1.2]} hide />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.05)" />
            {BANDS.map((b) => (
              <Line
                key={b.key}
                type="monotoneX"
                dataKey={b.key}
                stroke={b.color}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
                strokeOpacity={0.85}
                style={{ filter: `drop-shadow(0 0 3px ${b.color}60)` }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Frequency band info + Gauges */}
      <div className="flex items-center justify-between gap-4">
        {/* Band frequencies */}
        <div className="flex flex-col gap-2 flex-1">
          {BANDS.map((b) => (
            <div key={b.key} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: b.color, boxShadow: `0 0 4px ${b.color}` }} />
              <span className="text-[11px] text-slate-400 w-12">{b.label}</span>
              <span className="text-[10px] text-slate-600">{b.freq}</span>
            </div>
          ))}
        </div>

        {/* Focus + Calmness gauges */}
        <div className="flex items-center gap-3">
          <GaugeArc value={focusIndex} color="#00f5ff" label="Focus" size={88} />
          <GaugeArc value={calmnessIndex} color="#a855f7" label="Calm" size={88} />
        </div>
      </div>

      {/* Signal quality bar */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-600 uppercase tracking-widest">Signal</span>
        <div className="flex gap-0.5 items-end h-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.div
              key={i}
              className="w-1 rounded-sm bg-purple-neon/60"
              style={{ height: `${40 + i * 8}%` }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, delay: i * 0.1, repeat: Infinity }}
            />
          ))}
        </div>
        <span className="text-[10px] text-purple-neon ml-1">Optimal</span>
      </div>
    </GlowCard>
  );
}
