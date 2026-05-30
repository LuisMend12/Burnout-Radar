"use client";

import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Upload, Loader2, CheckCircle, AlertCircle, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlowCard } from "./GlowCard";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { analyzeVoice } from "@/lib/api";
import type { Metrics } from "@/types";

interface VoiceRecorderProps {
  onAnalyze: (metrics?: Metrics) => void;
}

export function VoiceRecorder({ onAnalyze }: VoiceRecorderProps) {
  const {
    isRecording, isAnalyzing, duration, audioBlob, error,
    analyserNode, startRecording, stopRecording, reset,
  } = useVoiceRecorder();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>();
  const idlePhaseRef = useRef(0);

  // Draw waveform on canvas
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (analyserNode) {
      // Live mic waveform
      const bufLen = analyserNode.frequencyBinCount;
      const data = new Uint8Array(bufLen);
      analyserNode.getByteTimeDomainData(data);

      const grad = ctx.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, "rgba(0,245,255,0.3)");
      grad.addColorStop(0.5, "#00f5ff");
      grad.addColorStop(1, "rgba(168,85,247,0.8)");

      ctx.beginPath();
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#00f5ff";

      const slice = W / bufLen;
      let x = 0;
      for (let i = 0; i < bufLen; i++) {
        const v = data[i] / 128.0;
        const y = (v * H) / 2;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        x += slice;
      }
      ctx.stroke();
    } else {
      // Idle animated sine wave
      idlePhaseRef.current += 0.04;
      const phase = idlePhaseRef.current;

      const grad = ctx.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, "rgba(0,245,255,0.1)");
      grad.addColorStop(0.5, "rgba(0,245,255,0.35)");
      grad.addColorStop(1, "rgba(168,85,247,0.1)");

      ctx.beginPath();
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 6;
      ctx.shadowColor = "rgba(0,245,255,0.4)";

      for (let x = 0; x <= W; x++) {
        const t = x / W;
        const y =
          H / 2 +
          Math.sin(t * Math.PI * 6 + phase) * 8 +
          Math.sin(t * Math.PI * 12 + phase * 1.5) * 4;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    animFrameRef.current = requestAnimationFrame(drawWaveform);
  }, [analyserNode]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(drawWaveform);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [drawWaveform]);

  const handleAnalyze = async () => {
    const result = await analyzeVoice(audioBlob ?? undefined);
    if (result?.metrics) {
      onAnalyze(result.metrics as Metrics);
    } else {
      onAnalyze();
    }
    reset();
  };

  const formatDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <GlowCard variant="cyan" delay={0.1} className="p-5 flex flex-col gap-5 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-cyan-neon/10 border border-cyan-neon/25 flex items-center justify-center">
            <Mic className="w-3.5 h-3.5 text-cyan-neon" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-200 tracking-wide">Voice Analysis</h2>
            <p className="text-[10px] text-slate-500">Acoustic stress biomarkers</p>
          </div>
        </div>
        {isRecording && (
          <div className="flex items-center gap-1.5 text-red-400">
            <div className="relative w-2 h-2">
              <div className="absolute inset-0 bg-red-400 rounded-full recording-ring" />
              <div className="w-2 h-2 bg-red-400 rounded-full" />
            </div>
            <span className="font-display text-sm font-bold">{formatDuration(duration)}</span>
          </div>
        )}
      </div>

      {/* Waveform canvas */}
      <div className="relative rounded-xl overflow-hidden bg-[rgba(0,245,255,0.03)] border border-cyan-neon/10" style={{ height: 100 }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={100}
          className="w-full h-full"
        />
        {isRecording && <div className="scan-line" />}
        {!isRecording && !audioBlob && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[10px] text-slate-600 tracking-widest uppercase">
              Press Record to begin
            </span>
          </div>
        )}
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audio analysis result indicator */}
      <AnimatePresence>
        {audioBlob && !isRecording && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex items-center gap-2 text-green-400 text-xs bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2"
          >
            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
            Recording complete — {formatDuration(duration)} captured. Ready to analyze.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="flex items-center gap-3 mt-auto">
        {/* Main record / stop button */}
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={!!audioBlob}
          className={cn(
            "relative flex items-center justify-center gap-2 h-10 px-5 rounded-xl font-semibold text-sm transition-all duration-300",
            isRecording
              ? "bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30"
              : "bg-cyan-neon/10 border border-cyan-neon/30 text-cyan-neon hover:bg-cyan-neon/20",
            audioBlob && "opacity-40 cursor-not-allowed"
          )}
        >
          {isRecording ? (
            <>
              <div className="w-3 h-3 rounded-sm bg-red-400" />
              Stop
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5" />
              Record
            </>
          )}
        </motion.button>

        {/* Analyze button */}
        <AnimatePresence>
          {audioBlob && (
            <motion.button
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              whileTap={{ scale: 0.93 }}
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-gradient-to-r from-cyan-neon/20 to-purple-neon/20 border border-cyan-neon/30 text-sm font-semibold text-slate-200 hover:from-cyan-neon/30 hover:to-purple-neon/30 transition-all"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Activity className="w-3.5 h-3.5 text-cyan-neon" />
                  Analyze
                </>
              )}
            </motion.button>
          )}
        </AnimatePresence>

        {/* Upload button */}
        <label className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20 cursor-pointer transition-all">
          <Upload className="w-3.5 h-3.5" />
          <input type="file" accept="audio/*" className="sr-only" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onAnalyze();
          }} />
        </label>
      </div>

      {/* Frequency band labels */}
      <div className="flex items-center justify-between">
        {["Delta", "Theta", "Alpha", "Beta", "Gamma"].map((band, i) => (
          <div key={band} className="flex flex-col items-center gap-1">
            <div
              className="w-1 rounded-full wave-bar"
              style={{
                height: 16 + i * 3,
                background: `hsl(${180 + i * 30}, 80%, 60%)`,
                animationDelay: `${i * 0.15}s`,
                opacity: 0.6,
              }}
            />
            <span className="text-[9px] text-slate-600">{band}</span>
          </div>
        ))}
      </div>
    </GlowCard>
  );
}
