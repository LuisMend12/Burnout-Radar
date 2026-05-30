"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { GlowCard } from "./GlowCard";
import { useAperiodicStream, type PeriodicPeakSpec } from "@/hooks/useAperiodicStream";

// ── SVG chart dimensions ──────────────────────────────────────────────────────
const W = 640, H = 280;
const ML = 52, MR = 20, MT = 24, MB = 36;
const CW = W - ML - MR;
const CH = H - MT - MB;

function xScale(f: number, fMin: number, fMax: number) {
  return ML + ((f - fMin) / (fMax - fMin)) * CW;
}
function yScale(p: number, pMin: number, pMax: number) {
  return MT + (1 - (p - pMin) / (pMax - pMin)) * CH;
}

function buildLinePath(
  freqs: number[], values: number[],
  fMin: number, fMax: number, pMin: number, pMax: number
): string {
  return freqs
    .map((f, i) => `${i === 0 ? "M" : "L"}${xScale(f, fMin, fMax).toFixed(1)},${yScale(values[i], pMin, pMax).toFixed(1)}`)
    .join(" ");
}

function gaussianAt(f: number, peak: PeriodicPeakSpec): number {
  const sigma = peak.bw / 2;
  return peak.pw * Math.exp(-0.5 * ((f - peak.cf) / sigma) ** 2);
}

function formatLag(s: number) {
  return s < 90 ? `${Math.round(s)}s ago` : `${Math.round(s / 60)}m ago`;
}

// ── Main component ────────────────────────────────────────────────────────────
export function AperiodicPanel() {
  const { data, error, isConnected } = useAperiodicStream();

  const chart = useMemo(() => {
    if (!data || data.exponent == null || data.offset == null) return null;
    const { freqs, log_psd, exponent, offset, peaks } = data;
    if (freqs.length < 4) return null;

    // Compute derived series
    const aperiodic = freqs.map((f) => offset - exponent * Math.log10(f));
    const periodic  = freqs.map((f) => peaks.reduce((s, pk) => s + gaussianAt(f, pk), 0));
    const model     = aperiodic.map((ap, i) => ap + periodic[i]);

    const fMin = freqs[0];
    const fMax = freqs[freqs.length - 1];
    const allY = [...log_psd, ...aperiodic, ...model];
    const pMin = Math.min(...allY) - 0.05;
    const pMax = Math.max(...allY) + 0.08;

    // Paths
    const spectrumPath  = buildLinePath(freqs, log_psd,    fMin, fMax, pMin, pMax);
    const aperiodicPath = buildLinePath(freqs, aperiodic,  fMin, fMax, pMin, pMax);
    const modelPath     = buildLinePath(freqs, model,      fMin, fMax, pMin, pMax);

    // Green fill area: model forward + aperiodic backward → closed polygon
    const fwdPts = freqs.map((f, i) => `${xScale(f, fMin, fMax).toFixed(1)},${yScale(model[i], pMin, pMax).toFixed(1)}`);
    const bwdPts = [...freqs].reverse().map((f, ri) => {
      const i = freqs.length - 1 - ri;
      return `${xScale(f, fMin, fMax).toFixed(1)},${yScale(aperiodic[i], pMin, pMax).toFixed(1)}`;
    });
    const fillPath = `M${fwdPts.join(" L")} L${bwdPts.join(" L")} Z`;

    // Y-axis gridlines at 0.5-unit intervals
    const gridMin = Math.ceil(pMin * 2) / 2;
    const gridMax = Math.floor(pMax * 2) / 2;
    const gridLines: number[] = [];
    for (let g = gridMin; g <= gridMax + 0.001; g += 0.5) gridLines.push(+g.toFixed(1));

    // X-axis tick positions (every 10 Hz)
    const xTicks: number[] = [];
    for (let t = Math.ceil(fMin / 10) * 10; t <= fMax; t += 10) xTicks.push(t);

    return { spectrumPath, aperiodicPath, modelPath, fillPath, fMin, fMax, pMin, pMax, gridLines, xTicks };
  }, [data]);

  return (
    <GlowCard variant="green" delay={0.25} className="p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-green-500/10 border border-green-500/25 flex items-center justify-center">
            <Activity className="w-3.5 h-3.5 text-green-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-200 tracking-wide">Aperiodic Exponent</h2>
            <p className="text-[10px] text-slate-500">1/f brain-state · steeper slope = calmer</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && data && (
            <span className="text-[10px] text-slate-600 font-mono">{formatLag(data.lag_seconds)}</span>
          )}
          <div
            className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-400" : "bg-slate-700"}`}
            style={isConnected ? { boxShadow: "0 0 6px #4ade80" } : {}}
          />
          <span className="text-[10px] text-slate-500">{isConnected ? "live" : "offline"}</span>
        </div>
      </div>

      {/* Offline state */}
      {!isConnected && (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <div className="text-slate-600 text-sm">Backend not connected</div>
          <div className="text-[10px] text-slate-700 max-w-xs">
            Start the backend with an AWEAR API key to see the live PSD decomposition
          </div>
          {error && <div className="text-[10px] text-orange-700/70 font-mono mt-1">{error}</div>}
        </div>
      )}

      {/* Stats row */}
      {isConnected && data && (
        <div className="flex items-center gap-5 flex-wrap">
          {[
            {
              label: "Exponent β",
              value: data.exponent_smoothed != null ? data.exponent_smoothed.toFixed(3) : "—",
              color: data.quality ? "#4ade80" : "#64748b",
              glow: data.quality,
            },
            { label: "Brain State", value: `${data.brain_state_score}/100`, color: "#4ade80", glow: false },
            { label: "Rel. Alpha", value: `${data.relative_alpha_pct.toFixed(0)}%`, color: "#00f5ff", glow: false },
            { label: "R²", value: data.r2.toFixed(3), color: data.r2 >= 0.8 ? "#a855f7" : "#f97316", glow: false },
          ].map(({ label, value, color, glow }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <div className="text-[9px] text-slate-600 uppercase tracking-widest">{label}</div>
              <div
                className="font-orbitron text-xl font-bold"
                style={{ color, filter: glow ? `drop-shadow(0 0 8px ${color}80)` : "none" }}
              >
                {value}
              </div>
            </div>
          ))}
          {!data.quality && (
            <span className="text-[9px] text-orange-500/80 uppercase tracking-wider ml-1">signal noisy</span>
          )}
          {data.peaks.length > 0 && (
            <div className="ml-auto text-[10px] text-slate-600">
              {data.peaks.length} periodic peak{data.peaks.length > 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      {/* Brain state bar */}
      {isConnected && data && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[9px] text-slate-700">
            <span>Active  (exp ≤ 0.4)</span>
            <span>(exp ≥ 1.4)  Calm</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden bg-white/[0.04]">
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, #f97316 0%, #22c55e 60%, #4ade80 100%)" }}
              animate={{ width: `${data.brain_state_score}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {/* PSD Chart */}
      {isConnected && (
        <div className="rounded-xl border border-green-500/10 bg-[rgba(0,10,20,0.6)] overflow-hidden">
          {!chart ? (
            <div className="flex items-center justify-center h-[280px] text-[10px] text-slate-700">
              Collecting signal…
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${W} ${H}`}
              width="100%"
              preserveAspectRatio="xMidYMid meet"
              style={{ display: "block" }}
            >
              {/* ── Grid ── */}
              {chart.gridLines.map((g) => {
                const y = yScale(g, chart.pMin, chart.pMax);
                return (
                  <g key={g}>
                    <line x1={ML} x2={ML + CW} y1={y} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
                    <text x={ML - 6} y={y + 3.5} textAnchor="end" fontSize={9} fill="#475569">
                      {g.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {/* ── X-axis ticks ── */}
              {chart.xTicks.map((t) => {
                const x = xScale(t, chart.fMin, chart.fMax);
                return (
                  <g key={t}>
                    <line x1={x} x2={x} y1={MT + CH} y2={MT + CH + 4} stroke="#334155" strokeWidth={1} />
                    <text x={x} y={MT + CH + 14} textAnchor="middle" fontSize={9} fill="#475569">{t}</text>
                  </g>
                );
              })}

              {/* ── Axis labels ── */}
              <text
                x={ML - 36} y={MT + CH / 2}
                textAnchor="middle" fontSize={10} fill="#475569"
                transform={`rotate(-90, ${ML - 36}, ${MT + CH / 2})`}
              >
                log(Power)
              </text>
              <text x={ML + CW / 2} y={H - 4} textAnchor="middle" fontSize={10} fill="#475569">
                Frequency (Hz)
              </text>

              {/* ── Clip path ── */}
              <defs>
                <clipPath id="chart-clip">
                  <rect x={ML} y={MT} width={CW} height={CH} />
                </clipPath>
              </defs>

              <g clipPath="url(#chart-clip)">
                {/* Green fill: periodic component between aperiodic and model */}
                <path d={chart.fillPath} fill="rgba(34,197,94,0.18)" stroke="none" />

                {/* Original spectrum — black */}
                <path d={chart.spectrumPath} fill="none" stroke="#e2e8f0" strokeWidth={1.2} strokeOpacity={0.85} />

                {/* Full model fit — red/salmon */}
                <path d={chart.modelPath} fill="none" stroke="#f87171" strokeWidth={2} strokeOpacity={0.9}
                      style={{ filter: "drop-shadow(0 0 3px rgba(248,113,113,0.4))" }} />

                {/* Aperiodic fit — blue dashed */}
                <path d={chart.aperiodicPath} fill="none" stroke="#818cf8" strokeWidth={1.8}
                      strokeDasharray="6 4" strokeOpacity={0.9}
                      style={{ filter: "drop-shadow(0 0 3px rgba(129,140,248,0.4))" }} />
              </g>

              {/* ── Axis borders ── */}
              <line x1={ML} x2={ML} y1={MT} y2={MT + CH} stroke="#1e293b" strokeWidth={1} />
              <line x1={ML} x2={ML + CW} y1={MT + CH} y2={MT + CH} stroke="#1e293b" strokeWidth={1} />

              {/* ── Legend ── */}
              {[
                { label: "Original Spectrum", color: "#e2e8f0", dash: false },
                { label: "Full Model Fit",    color: "#f87171", dash: false },
                { label: "Aperiodic Fit",     color: "#818cf8", dash: true  },
              ].map(({ label, color, dash }, i) => (
                <g key={label} transform={`translate(${ML + 12}, ${MT + 12 + i * 16})`}>
                  <line x1={0} x2={20} y1={5} y2={5} stroke={color} strokeWidth={1.8}
                        strokeDasharray={dash ? "5 3" : undefined} />
                  <text x={26} y={9} fontSize={9.5} fill="#94a3b8">{label}</text>
                </g>
              ))}
            </svg>
          )}
        </div>
      )}

      {/* Participant */}
      {isConnected && data?.participant && (
        <div className="text-[9px] text-slate-700 font-mono">{data.participant}</div>
      )}
    </GlowCard>
  );
}
