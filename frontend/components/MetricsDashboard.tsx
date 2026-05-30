"use client";

import { useMemo, useRef } from "react";
import { MetricCard } from "./MetricCard";
import type { Metrics, TimelinePoint } from "@/types";

interface MetricsDashboardProps {
  metrics: Metrics;
  timeline: TimelinePoint[];
}

const METRIC_KEYS: Array<{ key: keyof Metrics; timelineKey: keyof TimelinePoint }> = [
  { key: "stress",          timelineKey: "stress"   },
  { key: "focus",           timelineKey: "focus"    },
  { key: "fatigue",         timelineKey: "fatigue"  },
  { key: "burnout_score",   timelineKey: "burnout"  },
];

export function MetricsDashboard({ metrics, timeline }: MetricsDashboardProps) {
  const sparklines = useMemo(() => {
    return METRIC_KEYS.reduce((acc, { key, timelineKey }) => {
      acc[key as string] = timeline.map((t) => t[timelineKey] as number);
      return acc;
    }, {} as Record<string, number[]>);
  }, [timeline]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {METRIC_KEYS.map(({ key }, i) => (
        <MetricCard
          key={key}
          metricKey={key as string}
          value={metrics[key] as number}
          delay={0.05 * i}
          sparkline={sparklines[key as string]}
        />
      ))}
    </div>
  );
}
