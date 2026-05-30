"use client";

import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { GlowCard } from "./GlowCard";
import type { TimelinePoint } from "@/types";

interface TimelineViewProps {
  data: TimelinePoint[];
}

const SERIES = [
  { key: "stress",  label: "Stress",  color: "#ff4757", gradId: "grad-stress" },
  { key: "focus",   label: "Focus",   color: "#00f5ff", gradId: "grad-focus"  },
  { key: "fatigue", label: "Fatigue", color: "#a855f7", gradId: "grad-fatigue"},
  { key: "calmness",label: "Calmness",color: "#22c55e", gradId: "grad-calm"   },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[rgba(12,12,30,0.96)] border border-white/10 rounded-xl px-4 py-3 text-xs backdrop-blur-xl shadow-xl">
      <div className="text-slate-500 mb-2 font-mono">{label}</div>
      <div className="space-y-1">
        {payload.map((p: { name: string; value: number; color: string }) => (
          <div key={p.name} className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              <span className="text-slate-400 capitalize">{p.name}</span>
            </div>
            <span className="font-mono font-semibold" style={{ color: p.color }}>
              {Math.round(p.value)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomLegend({ payload }: any) {
  return (
    <div className="flex items-center justify-center gap-4 mt-1">
      {payload?.map((p: { value: string; color: string }) => (
        <div key={p.value} className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 rounded" style={{ background: p.color }} />
          <span className="text-[11px] text-slate-500 capitalize">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function TimelineView({ data }: TimelineViewProps) {
  return (
    <GlowCard variant="cyan" delay={0.3} className="p-5 flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-cyan-neon/10 border border-cyan-neon/25 flex items-center justify-center">
            <Clock className="w-3.5 h-3.5 text-cyan-neon" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-200 tracking-wide">Neural Timeline</h2>
            <p className="text-[10px] text-slate-500">Live 60-second biomarker history</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-neon pulse-dot" />
          LIVE
        </div>
      </div>

      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <defs>
              {SERIES.map(({ color, gradId }) => (
                <linearGradient key={gradId} id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.0}  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.04)"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              tick={{ fill: "#475569", fontSize: 10, fontFamily: "var(--font-inter)" }}
              interval="preserveStartEnd"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "#475569", fontSize: 10, fontFamily: "var(--font-inter)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
            {SERIES.map(({ key, color, gradId }) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={color}
                strokeWidth={1.5}
                fill={`url(#${gradId})`}
                dot={false}
                isAnimationActive={false}
                strokeOpacity={0.9}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlowCard>
  );
}
