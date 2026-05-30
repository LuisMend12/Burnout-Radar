"use client";

import { motion } from "framer-motion";
import { Activity, Brain, Wifi, WifiOff, Zap } from "lucide-react";
import type { Metrics } from "@/types";
import { getReadinessColor, getReadinessLabel } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface HeaderProps {
  isConnected: boolean;
  metrics: Metrics;
}

export function Header({ isConnected, metrics }: HeaderProps) {
  const readinessColor = getReadinessColor(metrics.mental_readiness);
  const readinessLabel = getReadinessLabel(metrics.mental_readiness);

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="sticky top-0 z-50 bg-[rgba(8,8,18,0.85)] backdrop-blur-2xl border-b border-white/[0.06]"
    >
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-neon/20 to-purple-neon/20 border border-cyan-neon/30 flex items-center justify-center">
              <Brain className="w-5 h-5 text-cyan-neon" />
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyan-neon live-indicator" />
          </div>
          <div>
            <h1 className="font-display text-base font-bold tracking-widest gradient-text-brand">
              BURNOUT RADAR
            </h1>
            <p className="text-[10px] text-slate-500 tracking-wider uppercase">
              Neural Wellness Intelligence
            </p>
          </div>
        </div>

        {/* Center status pills */}
        <div className="hidden md:flex items-center gap-2">
          <StatusPill
            label="Voice Analysis"
            active={true}
            color="cyan"
            icon={<Activity className="w-3 h-3" />}
          />
          <StatusPill
            label="EEG Stream"
            active={true}
            color="purple"
            icon={<Zap className="w-3 h-3" />}
          />
          <StatusPill
            label={isConnected ? "Backend Connected" : "Simulation Mode"}
            active={isConnected}
            color={isConnected ? "green" : "orange"}
            icon={isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          />
        </div>

        {/* Right: readiness indicator */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest">Readiness</div>
            <div
              className="text-lg font-display font-bold leading-tight"
              style={{ color: readinessColor, textShadow: `0 0 20px ${readinessColor}60` }}
            >
              {Math.round(metrics.mental_readiness)}
            </div>
          </div>
          <div className="relative w-10 h-10">
            <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
              <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
              <circle
                cx="20" cy="20" r="16"
                fill="none"
                stroke={readinessColor}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 16}`}
                strokeDashoffset={`${2 * Math.PI * 16 * (1 - metrics.mental_readiness / 100)}`}
                style={{
                  transition: "stroke-dashoffset 0.8s ease, stroke 0.8s ease",
                  filter: `drop-shadow(0 0 4px ${readinessColor}80)`,
                }}
              />
            </svg>
            <div
              className="absolute inset-0 flex items-center justify-center text-[9px] font-bold"
              style={{ color: readinessColor }}
            >
              {readinessLabel.slice(0, 3).toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    </motion.header>
  );
}

function StatusPill({
  label,
  active,
  color,
  icon,
}: {
  label: string;
  active: boolean;
  color: "cyan" | "purple" | "green" | "orange";
  icon: React.ReactNode;
}) {
  const colorMap = {
    cyan:   { bg: "bg-cyan-neon/10",   border: "border-cyan-neon/20",   text: "text-cyan-neon",   dot: "bg-cyan-neon" },
    purple: { bg: "bg-purple-neon/10", border: "border-purple-neon/20", text: "text-purple-neon", dot: "bg-purple-neon" },
    green:  { bg: "bg-green-500/10",   border: "border-green-500/20",   text: "text-green-400",   dot: "bg-green-400" },
    orange: { bg: "bg-orange-500/10",  border: "border-orange-500/20",  text: "text-orange-400",  dot: "bg-orange-400" },
  };
  const c = colorMap[color];

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium",
      c.bg, c.border, c.text
    )}>
      <div className={cn("w-1.5 h-1.5 rounded-full", c.dot, active && "pulse-dot")} />
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </div>
  );
}
