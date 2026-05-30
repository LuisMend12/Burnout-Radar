"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wind, Coffee, Brain, AlertTriangle, Headphones, Zap, Sparkles,
} from "lucide-react";
import { GlowCard } from "./GlowCard";
import { fetchRecommendations } from "@/lib/api";
import type { Metrics, Recommendation } from "@/types";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Wind, Coffee, Brain, AlertTriangle, Headphones, Zap,
};

const PRIORITY_CONFIG = {
  critical: { color: "#ff4757", bg: "bg-red-500/10",    border: "border-red-500/25",    badge: "bg-red-500/20 text-red-400"   },
  high:     { color: "#f97316", bg: "bg-orange-500/10", border: "border-orange-500/25", badge: "bg-orange-500/20 text-orange-400" },
  medium:   { color: "#f59e0b", bg: "bg-yellow-500/10", border: "border-yellow-500/25", badge: "bg-yellow-500/20 text-yellow-400" },
  low:      { color: "#00f5ff", bg: "bg-cyan-neon/10",  border: "border-cyan-neon/25",  badge: "bg-cyan-neon/10 text-cyan-neon"  },
};

const DEMO_RECS: Recommendation[] = [
  {
    type: "breathing", priority: "high",
    title: "4-7-8 Breathing Protocol",
    description: "Elevated stress detected. Activate parasympathetic nervous system with structured breathing.",
    duration: "5 min", icon: "Wind",
  },
  {
    type: "mindfulness", priority: "medium",
    title: "Focus Reset Meditation",
    description: "Alpha suppression detected. Brief mindfulness to restore attentional control.",
    duration: "10 min", icon: "Brain",
  },
  {
    type: "audio", priority: "low",
    title: "Neural Entrainment Audio",
    description: "Binaural beats calibrated to your current brainwave state for optimal flow.",
    duration: "15 min", icon: "Headphones",
  },
];

interface RecommendationEngineProps {
  metrics: Metrics;
}

export function RecommendationEngine({ metrics }: RecommendationEngineProps) {
  const [recs, setRecs] = useState<Recommendation[]>(DEMO_RECS);
  const [activeRec, setActiveRec] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const fresh = await fetchRecommendations();
    if (fresh.length > 0) setRecs(fresh);
    else {
      // Generate client-side recommendations
      const clientRecs: Recommendation[] = [];
      if (metrics.stress > 65) clientRecs.push(DEMO_RECS[0]);
      if (metrics.focus < 50) clientRecs.push(DEMO_RECS[1]);
      clientRecs.push(DEMO_RECS[2]);
      if (metrics.burnout_score > 65) {
        clientRecs.unshift({
          type: "alert", priority: "critical",
          title: "High Burnout Risk",
          description: "Multiple biomarkers in critical range. Prioritize recovery now.",
          duration: "30 min", icon: "AlertTriangle",
        });
      }
      setRecs(clientRecs);
    }
  }, [metrics]);

  useEffect(() => {
    refresh();
    // Refresh recommendations when metrics change significantly
  }, [metrics.burnout_score > 65, metrics.stress > 65]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <GlowCard variant="purple" delay={0.4} className="p-5 flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-purple-neon/10 border border-purple-neon/25 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-purple-neon" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-200 tracking-wide">AI Interventions</h2>
            <p className="text-[10px] text-slate-500">Personalized recommendations</p>
          </div>
        </div>
        <span className="text-[10px] text-slate-600 bg-white/5 px-2 py-0.5 rounded-full border border-white/[0.06]">
          {recs.length} active
        </span>
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto no-scrollbar flex-1" style={{ maxHeight: 380 }}>
        <AnimatePresence mode="popLayout">
          {recs.map((rec, i) => {
            const cfg = PRIORITY_CONFIG[rec.priority] ?? PRIORITY_CONFIG.low;
            const Icon = ICON_MAP[rec.icon] ?? Zap;
            const isActive = activeRec === rec.title;

            return (
              <motion.div
                key={rec.title}
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.35, delay: i * 0.05 }}
                onClick={() => setActiveRec(isActive ? null : rec.title)}
                className={cn(
                  "rounded-xl border p-3.5 cursor-pointer transition-all duration-300",
                  cfg.bg, cfg.border,
                  isActive && "scale-[0.99]"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: `${cfg.color}18`, border: `1px solid ${cfg.color}30` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-slate-200 leading-tight">{rec.title}</span>
                      <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0", cfg.badge)}>
                        {rec.priority}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      {rec.description}
                    </p>
                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 flex items-center justify-between"
                        >
                          <span className="text-[10px] text-slate-600">Duration: {rec.duration}</span>
                          <button
                            className="text-[11px] font-semibold px-3 py-1 rounded-lg transition-all"
                            style={{
                              color: cfg.color,
                              background: `${cfg.color}18`,
                              border: `1px solid ${cfg.color}30`,
                            }}
                          >
                            Start Now
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="pt-2 border-t border-white/[0.04]">
        <p className="text-[10px] text-slate-600 text-center">
          Tap any recommendation to start
        </p>
      </div>
    </GlowCard>
  );
}
