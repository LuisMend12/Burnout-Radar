"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity, Brain, Battery, AlertTriangle, Target, Heart, Zap,
  TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { cn, getMetricStatus } from "@/lib/utils";
import { GlowCard } from "./GlowCard";

const ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  stress: Activity,
  calmness: Heart,
  focus: Target,
  fatigue: Battery,
  burnout_score: AlertTriangle,
  mental_readiness: Brain,
};

const CONFIG: Record<string, {
  label: string;
  unit: string;
  invertStatus: boolean;
  glowVariant: "cyan" | "purple" | "red" | "orange" | "green";
  color: string;
  trackColor: string;
}> = {
  stress: {
    label: "Stress",
    unit: "%",
    invertStatus: true,
    glowVariant: "red",
    color: "#ff4757",
    trackColor: "rgba(255,71,87,0.12)",
  },
  calmness: {
    label: "Calmness",
    unit: "%",
    invertStatus: false,
    glowVariant: "green",
    color: "#22c55e",
    trackColor: "rgba(34,197,94,0.12)",
  },
  focus: {
    label: "Focus",
    unit: "%",
    invertStatus: false,
    glowVariant: "cyan",
    color: "#00f5ff",
    trackColor: "rgba(0,245,255,0.12)",
  },
  fatigue: {
    label: "Fatigue",
    unit: "%",
    invertStatus: true,
    glowVariant: "purple",
    color: "#a855f7",
    trackColor: "rgba(168,85,247,0.12)",
  },
  burnout_score: {
    label: "Burnout Risk",
    unit: "%",
    invertStatus: true,
    glowVariant: "orange",
    color: "#f97316",
    trackColor: "rgba(249,115,22,0.12)",
  },
  mental_readiness: {
    label: "Readiness",
    unit: "%",
    invertStatus: false,
    glowVariant: "green",
    color: "#22c55e",
    trackColor: "rgba(34,197,94,0.12)",
  },
};

const STATUS_COLOR: Record<string, string> = {
  Low:      "#22c55e",
  Moderate: "#f59e0b",
  High:     "#ff4757",
};

function getTrend(sparkline: number[], invertStatus: boolean): "improving" | "worsening" | "stable" {
  if (sparkline.length < 4) return "stable";
  const recent = sparkline.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const earlier = sparkline.slice(-6, -3).reduce((a, b) => a + b, 0) / Math.min(3, sparkline.length - 3);
  const delta = recent - earlier;
  if (Math.abs(delta) < 2) return "stable";
  const increasing = delta > 0;
  return (invertStatus ? !increasing : increasing) ? "improving" : "worsening";
}

function useAnimatedNumber(target: number): number {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = target;
    let frame: number;
    const start = performance.now();
    const dur = 600;

    const tick = (now: number) => {
      const t = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return display;
}

interface MetricCardProps {
  metricKey: string;
  value: number;
  delay?: number;
  sparkline?: number[];
}

export function MetricCard({ metricKey, value, delay = 0, sparkline = [] }: MetricCardProps) {
  const cfg = CONFIG[metricKey];
  if (!cfg) return null;

  const animated = useAnimatedNumber(value);
  const Icon = ICONS[metricKey] ?? Zap;
  const status = getMetricStatus(metricKey, value);
  const statusColor = STATUS_COLOR[status] ?? "#94a3b8";

  const isInverted = cfg.invertStatus;
  const trend = getTrend(sparkline, isInverted);
  const TrendIcon = trend === "improving" ? TrendingUp : trend === "worsening" ? TrendingDown : Minus;
  const trendColor = trend === "improving" ? "#22c55e" : trend === "worsening" ? "#ff4757" : "#475569";

  return (
    <GlowCard variant={cfg.glowVariant} delay={delay} className="p-5 flex flex-col gap-4 h-full min-h-[160px]">
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: cfg.trackColor, border: `1px solid ${cfg.color}25` }}
          >
            <Icon className="w-4 h-4" style={{ color: cfg.color }} />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 uppercase tracking-widest">{cfg.label}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendIcon className="w-3 h-3" style={{ color: trendColor }} />
          <div
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              color: statusColor,
              background: `${statusColor}18`,
              border: `1px solid ${statusColor}30`,
            }}
          >
            {status}
          </div>
        </div>
      </div>

      {/* Value */}
      <div className="flex items-end gap-1">
        <motion.span
          key={Math.round(animated)}
          className="text-4xl font-display font-bold leading-none"
          style={{ color: cfg.color, textShadow: `0 0 20px ${cfg.color}40` }}
        >
          {animated}
        </motion.span>
        <span className="text-lg text-slate-600 mb-0.5">{cfg.unit}</span>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: cfg.trackColor }}>
          <motion.div
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${cfg.color}80, ${cfg.color})`,
              boxShadow: `0 0 8px ${cfg.color}60`,
            }}
            initial={{ width: "0%" }}
            animate={{ width: `${Math.round(value)}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>

        {/* Sparkline */}
        {sparkline.length > 1 && (
          <MiniSparkline data={sparkline} color={cfg.color} metricKey={metricKey} />
        )}
      </div>
    </GlowCard>
  );
}

function MiniSparkline({ data, color, metricKey }: { data: number[]; color: string; metricKey: string }) {
  const height = 28;
  const width = 100;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const gradId = `spark-${metricKey}`;

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const linePoints = pts.join(" ");
  const areaPoints = `0,${height} ${pts[0]} ${linePoints} ${pts[pts.length - 1].split(",")[0]},${height}`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0"   />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradId})`} />
      <polyline
        points={linePoints}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.75"
      />
    </svg>
  );
}
