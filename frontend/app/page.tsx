"use client";

import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { MentalReadinessScore } from "@/components/MentalReadinessScore";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { EEGPanel } from "@/components/EEGPanel";
import { MetricsDashboard } from "@/components/MetricsDashboard";
import { TimelineView } from "@/components/TimelineView";
import { RecommendationEngine } from "@/components/RecommendationEngine";
import { useMetrics } from "@/hooks/useMetrics";
import { useEEGStream } from "@/hooks/useEEGStream";
import type { Metrics } from "@/types";

export default function Dashboard() {
  const { metrics, timeline, isConnected, triggerAnalysis } = useMetrics();
  const { eegBuffer, focusIndex, calmnessIndex, bandPowers, powerRatios } = useEEGStream();

  return (
    <>
      <Header isConnected={isConnected} metrics={metrics} />

      <main className="relative z-10 max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6 pb-16">
        {/* Hero: Mental Readiness Score */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex flex-col items-center py-6"
        >
          <MentalReadinessScore
            score={metrics.mental_readiness}
            burnoutScore={metrics.burnout_score}
            metrics={metrics}
          />
        </motion.section>

        {/* Row 1: Voice Recorder + EEG Panel */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <VoiceRecorder
            onAnalyze={(newMetrics?: Metrics) => triggerAnalysis(newMetrics)}
          />
          <EEGPanel
            eegBuffer={eegBuffer}
            focusIndex={focusIndex}
            calmnessIndex={calmnessIndex}
            bandPowers={bandPowers}
            powerRatios={powerRatios}
          />
        </section>

        {/* Row 2: Metrics Dashboard */}
        <section>
          <MetricsDashboard metrics={metrics} timeline={timeline} />
        </section>

        {/* Row 3: Timeline + Recommendations */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <TimelineView data={timeline} />
          </div>
          <div>
            <RecommendationEngine metrics={metrics} />
          </div>
        </section>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="text-center pt-4"
        >
          <p className="text-[10px] text-slate-700 tracking-widest uppercase">
            Burnout Radar · Neural Wellness Intelligence · All data is simulated for demo purposes
          </p>
        </motion.footer>
      </main>
    </>
  );
}
