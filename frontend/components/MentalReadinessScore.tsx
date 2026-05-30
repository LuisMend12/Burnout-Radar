"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { getReadinessColor, getReadinessLabel } from "@/lib/utils";

interface MentalReadinessScoreProps {
  score: number;
  burnoutScore: number;
  metrics?: { focus: number; calmness: number; fatigue: number };
}

const SIZE = 240;
const STROKE = 12;
const R = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;
const FULL_ANGLE = 270; // degrees of arc (from -135° to +135°)

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = polarToXY(cx, cy, r, startDeg);
  const end = polarToXY(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function useAnimatedNumber(target: number, duration = 800) {
  const [display, setDisplay] = useState(target);
  const startRef = useRef(target);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const from = display;
    startRef.current = from;
    startTimeRef.current = null;

    const animate = (ts: number) => {
      if (!startTimeRef.current) startTimeRef.current = ts;
      const elapsed = ts - startTimeRef.current;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return display;
}

export function MentalReadinessScore({ score, burnoutScore, metrics }: MentalReadinessScoreProps) {
  const animatedScore = useAnimatedNumber(score);
  const color = getReadinessColor(score);
  const label = getReadinessLabel(score);

  const startDeg = -135;
  const endDeg = startDeg + FULL_ANGLE * (score / 100);

  const trackPath = arcPath(CENTER, CENTER, R, -135, 135);
  const fillPath = arcPath(CENTER, CENTER, R, startDeg, Math.max(startDeg + 0.1, endDeg));

  // Tick marks at 0, 25, 50, 75, 100
  const ticks = [0, 25, 50, 75, 100].map((v) => {
    const deg = -135 + FULL_ANGLE * (v / 100);
    const outer = polarToXY(CENTER, CENTER, R + 10, deg);
    const inner = polarToXY(CENTER, CENTER, R + 4, deg);
    return { outer, inner, v };
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="flex flex-col items-center gap-4"
    >
      {/* Label above */}
      <div className="text-xs font-display tracking-[0.3em] text-slate-500 uppercase">
        Mental Readiness Index
      </div>

      {/* Gauge */}
      <div className="relative" style={{ width: SIZE, height: SIZE * 0.85 }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ overflow: "visible" }}
        >
          {/* Outer glow filter */}
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="gaugeGradient" gradientUnits="userSpaceOnUse"
              x1="0" y1={CENTER} x2={SIZE} y2={CENTER}>
              <stop offset="0%" stopColor="#ff4757" />
              <stop offset="40%" stopColor="#f97316" />
              <stop offset="70%" stopColor="#00f5ff" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>

          {/* Background track */}
          <path
            d={trackPath}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />

          {/* Filled arc */}
          <motion.path
            d={fillPath}
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            filter="url(#glow)"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            style={{ transition: "d 0.8s cubic-bezier(0.25,0.46,0.45,0.94)" }}
          />

          {/* Tick marks */}
          {ticks.map(({ outer, inner, v }) => (
            <line
              key={v}
              x1={inner.x} y1={inner.y}
              x2={outer.x} y2={outer.y}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={v % 50 === 0 ? 2 : 1}
            />
          ))}

          {/* Center score */}
          <text
            x={CENTER}
            y={CENTER - 8}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={color}
            fontSize="52"
            fontFamily="var(--font-orbitron)"
            fontWeight="700"
            style={{ filter: `drop-shadow(0 0 12px ${color}80)` }}
          >
            {animatedScore}
          </text>
          <text
            x={CENTER}
            y={CENTER + 30}
            textAnchor="middle"
            fill="rgba(255,255,255,0.5)"
            fontSize="11"
            fontFamily="var(--font-inter)"
            letterSpacing="3"
          >
            / 100
          </text>
        </svg>
      </div>

      {/* Status label */}
      <div className="flex flex-col items-center gap-1">
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-xl font-display font-bold tracking-wider"
          style={{ color, textShadow: `0 0 30px ${color}50` }}
        >
          {label.toUpperCase()}
        </motion.div>
        <div className="text-xs text-slate-500 tracking-wider">
          Burnout Risk:{" "}
          <span
            className="font-semibold"
            style={{ color: burnoutScore > 65 ? "#ff4757" : burnoutScore > 40 ? "#f97316" : "#22c55e" }}
          >
            {Math.round(burnoutScore)}%
          </span>
        </div>
      </div>

      {/* Mini breakdown row */}
      <div className="flex items-center gap-5">
        {[
          { label: "Focus",  value: metrics?.focus   ?? null, color: "#00f5ff" },
          { label: "Calm",   value: metrics?.calmness ?? null, color: "#a855f7" },
          { label: "Energy", value: metrics ? Math.round(100 - metrics.fatigue) : null, color: "#22c55e" },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }} />
              <span className="text-[10px] text-slate-500 tracking-wider">{label}</span>
              {value !== null && (
                <span className="text-[10px] font-mono font-semibold" style={{ color }}>
                  {Math.round(value)}
                </span>
              )}
            </div>
            <div className="w-16 h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: color, boxShadow: `0 0 4px ${color}60` }}
                initial={{ width: 0 }}
                animate={{ width: value !== null ? `${Math.max(0, Math.min(100, value))}%` : "0%" }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
