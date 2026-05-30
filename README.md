# Burnout Radar

Real-time mental wellness dashboard powered by live EEG data from the AWEAR B2B API, combining brainwave analysis, spectral signal processing, and voice biomarker detection.

## Data Source

Metrics are derived from **real EEG recordings** fetched via the [AWEAR B2B API](https://awear-b2b-2026.vercel.app/). The backend reads raw EEG waveforms (256 samples @ 256 Hz, right temporal lobe / TP10), computes brainwave band powers (delta, theta, alpha, beta, gamma) via FFT, and maps them to wellness metrics in real time.

To enable live data, add your AWEAR API key to a `.env` file in the project root:

```
API_KEY=awr_sk_your_key_here
```

If no key is present the backend falls back to simulated data automatically.

---

## Quick Start

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev        # dev server → http://localhost:3000
npm run build      # production build
npm start          # serve production build
```

### Backend (FastAPI) — optional

```bash
cd backend
pip install -r requirements.txt
python main.py     # → http://localhost:8000
```

The backend automatically reads `API_KEY` from the root `.env` file and switches to live AWEAR data. The `/` endpoint reports `"data_source": "awear_api"` when live data is active. Without a running backend the frontend operates fully in simulation mode.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| npm | 9+ |
| Python | 3.10+ |

---

## Project Structure

```
Burnout-Radar/
├── .env                       # API_KEY=awr_sk_... (not committed)
├── frontend/                  # Next.js 14 app
│   ├── app/
│   │   ├── globals.css        # Design tokens, animations
│   │   ├── layout.tsx         # Root layout + fonts
│   │   └── page.tsx           # Main dashboard
│   ├── components/
│   │   ├── Header.tsx                 # Sticky nav with live status pills
│   │   ├── MentalReadinessScore.tsx   # Gauge + Focus/Calm/Energy breakdown
│   │   ├── VoiceRecorder.tsx          # Mic capture + waveform canvas
│   │   ├── EEGPanel.tsx               # Brainwave chart, power ratios, spectral features
│   │   ├── MetricCard.tsx             # Metric tile with trend indicator + sparkline
│   │   ├── MetricsDashboard.tsx       # 4-card metrics grid
│   │   ├── TimelineView.tsx           # Full-session area chart (oldest → live)
│   │   ├── RecommendationEngine.tsx   # AI intervention cards
│   │   └── GlowCard.tsx              # Glassmorphism card wrapper
│   ├── hooks/
│   │   ├── useMetrics.ts      # WebSocket metrics stream + session-anchored timeline
│   │   ├── useEEGStream.ts    # EEG stream + band powers + power ratios + spectral features
│   │   └── useVoiceRecorder.ts
│   ├── lib/
│   │   ├── api.ts
│   │   └── utils.ts
│   └── types/index.ts         # Metrics, EEGDataPoint, BandPowers, PowerRatios, SpectralFeatures
│
└── backend/                   # FastAPI
    ├── main.py                # All endpoints
    ├── awear_client.py        # AWEAR API client + FFT band power computation
    ├── features.py            # Aperiodic (1/f) extraction: filtering, specparam, sliding windows
    ├── mock_data.py           # Fallback simulation generators
    ├── models.py              # Pydantic schemas
    └── requirements.txt
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Service info and data source mode |
| GET | `/health` | Health check |
| GET | `/metrics` | Current wellness metrics snapshot |
| GET | `/members` | List AWEAR participants registered to the API key |
| GET | `/live` | Aperiodic (1/f) features for the active participant (see below) |
| GET | `/timeline` | Historical timeline bucketed into 2-minute intervals |
| POST | `/analyze_voice` | Upload audio, returns acoustic stress biomarkers |
| GET | `/recommendations` | AI-generated wellness suggestions |
| WS | `/eeg_stream` | Live EEG brainwave data at 10 Hz |
| WS | `/metrics_stream` | Live metrics updates every 2 s |

### `GET /live`

Query params:
- `lookback` — minutes of EEG history to pull (default `6`)
- `participant` — AWEAR participant ID; auto-picks the active member if omitted

```jsonc
{
  "participant": "P-T8QCYK",
  "device": "AWEAR-E22AC805",
  "fs": 256,
  "as_of": "2026-05-30T20:11:04+00:00",   // timestamp of most recent EEG sample
  "lag_seconds": 183.0,                    // AWEAR cloud is typically ~3 min behind
  "current": {
    "exponent": 1.898,                     // latest raw 1/f exponent
    "exponent_smoothed": 1.899,            // rolling-median smoothed — use this for display
    "relative_alpha_pct": 7.8,             // 8–12 Hz share of 1–40 Hz power (relaxation)
    "alpha_peak_pw": 21.451,               // periodic alpha height above 1/f floor (null if absent)
    "r2": 0.597,                           // specparam fit quality (0–1)
    "quality": false,                      // false = noisy/motion window (r2 < 0.8 or exp out of range)
    "brain_state_score": 100              // 0–100, higher = steeper exponent = calmer
  },
  "series": [ ... ],                       // per-window history (oldest → newest) for charting
  "config": { "fit_lo": 2.0, "fit_hi": 75.0, "win_sec": 4.0, "step_sec": 1.0,
              "highpass_hz": 0.5, "notch_hz": 60.0, "mains_interp": true }
}
```

`brain_state_score` maps `exponent 0.4 → 0`, `1.4 → 100` (clamped). Higher = steeper 1/f slope = calmer/more inhibited state — validated for relaxation/meditation monitoring.

---

## Burnout Score Formula

```
burnout = 0.5 × stress + 0.3 × fatigue + 0.2 × (1 − focus) × 100
```

| Score | Level |
|-------|-------|
| 0–29 | Low |
| 30–54 | Moderate |
| 55–74 | High |
| 75–100 | Critical |

---

## How Metrics Are Computed

The backend fetches the last 30 minutes of EEG records from the AWEAR API, runs FFT on each 256-sample waveform, and derives band powers:

| Band | Hz | Reflects |
|------|----|----------|
| Delta | 1–4 | Deep rest / fatigue |
| Theta | 4–8 | Drowsiness / mental load |
| Alpha | 8–13 | Relaxed wakefulness |
| Beta | 13–30 | Active thinking / stress |
| Gamma | 30–45 | High cognitive effort |

Metrics are then calculated from band ratios:

| Metric | Derivation |
|--------|-----------|
| Stress | `(beta + gamma) / total` |
| Focus | `beta / (theta + alpha)` |
| Calmness | `alpha / (beta + gamma)` |
| Fatigue | `(delta + theta) / total` |

Results are smoothed with an exponential moving average (α=0.3) and cached for 4 seconds to avoid excessive API calls.

---

## EEG Signal Processing (Frontend)

The frontend computes additional signal features from the 80-sample rolling buffer every 100 ms.

### Band Powers

RMS (root mean square) power for each band extracted from the buffer:

```
P_band = sqrt( mean(x²) )   over the rolling 80-sample window
```

### Power Ratios

Standard neurofeedback ratios derived from band powers:

| Ratio | Formula | Interpretation |
|-------|---------|----------------|
| θ/β | theta / beta | High = drowsy / inattentive |
| α/β | alpha / beta | High = relaxed / low arousal |
| β/(α+θ) | beta / (alpha + theta) | High = cognitively engaged |
| θ/α | theta / alpha | High = mental fatigue |

### Spectral Features

| Feature | Method | Interpretation |
|---------|--------|---------------|
| Spectral Entropy | Normalized Shannon entropy over band power distribution | 0 = one band dominates; 1 = all bands equal |
| Mean Frequency | Power-weighted centroid: `Σ(fᵢ·Pᵢ) / Σ(Pᵢ)` | Overall frequency balance in Hz |
| SEF 95% | Lowest band whose cumulative power exceeds 95% of total | Spectral edge frequency |
| Decaying Exponent β | OLS slope of log(P) vs log(f) across all bands; β = −slope | Aperiodic 1/fᵝ component of PSD |

---

## Aperiodic Exponent Extraction (Backend)

`backend/features.py` implements a full spectral parameterization pipeline that runs server-side on raw EEG waveforms fetched from the AWEAR cloud. This is exposed via `GET /live`.

### Pipeline

```
raw waveform rows  →  concatenate  →  highpass 0.5 Hz  →  notch 60 Hz
→  sliding 4-s windows (1-s step)  →  Welch PSD  →  specparam fit  →  exponent array
→  rolling-median smooth (n=7)  →  JSON response
```

### Signal configuration

| Parameter | Value | Notes |
|-----------|-------|-------|
| Sample rate | 256 Hz | AWEAR TP10 channel |
| Fit range | 2–75 Hz | Avoids DC and aliasing |
| Window | 4 s / 1 s step | 1024 samples per window |
| Highpass | 0.5 Hz | 4th-order Butterworth |
| Notch | 60 Hz (Q=30) | Mains interference |

### Aperiodic fit

Uses [specparam](https://specparam-tools.github.io/) (formerly FOOOF) in `fixed` mode. Falls back to plain OLS log-log regression if specparam is not installed:

```
log(P) = offset − β · log(f)   over the fit range
β = aperiodic exponent  (the 1/f slope)
```

### Interpretation

| `exponent_smoothed` | `brain_state_score` | State |
|---------------------|---------------------|-------|
| ≤ 0.4 | 0 | Highly activated / noisy |
| ~0.8 | ~40 | Moderate arousal |
| ~1.0 | ~60 | Relaxed wakefulness |
| ≥ 1.4 | 100 | Deep calm / meditation |

The exponent is **gain-invariant** — AWEAR returns raw ADC counts, so absolute power is meaningless. Only the log-log slope and relative band ratios are exposed.

---

## Neural Timeline

The timeline retains the full session (up to 1 hour / 3600 points at 2 s/tick). All timestamps are anchored to the session start time so data can be aligned and labeled against real-world events.

- **Oldest recorded point → current live time** always visible without windowing
- **Session span** displayed in the header (`HH:MM:SS – HH:MM:SS`)
- **Live point count** updates every 2 seconds
- Five series rendered: Stress, Focus, Fatigue, Calmness, Burnout

---

## Metric Cards

Each metric card shows:
- **Animated value** with eased counter
- **Status badge** (Low / Moderate / High)
- **Trend indicator** — compares last 3 samples vs previous 3; shows ↑ / ↓ / — colored green (improving) or red (worsening), correctly inverted for adverse metrics (stress, fatigue, burnout)
- **Sparkline** with gradient area fill

---

## Mental Readiness Score

The central gauge displays the composite Mental Readiness Index (0–100). Below the gauge, a live breakdown row shows:

| Label | Source | Color |
|-------|--------|-------|
| Focus | `metrics.focus` | Cyan |
| Calm | `metrics.calmness` | Purple |
| Energy | `100 − metrics.fatigue` | Green |

Each entry shows the current percentage and an animated mini progress bar.

---

## Voice Analysis Pipeline

### 1. Microphone capture (`useVoiceRecorder.ts`)

When the user presses **Record**:

1. **Permission request** — `getUserMedia` asks the browser for mic access with echo cancellation and noise suppression at 44,100 Hz.
2. **Web Audio API (visualizer only)** — an `AnalyserNode` with `fftSize = 2048` drives the live waveform canvas; it does not record anything.
3. **MediaRecorder (actual capture)** — records the stream in `audio/webm;codecs=opus` format, firing `ondataavailable` every 100 ms to accumulate audio chunks.
4. **Timer** — counts elapsed seconds and hard-stops at 60 seconds.

When the user presses **Stop**, all chunks are merged into a single `audio/webm` Blob.

### 2. Upload & analysis (`VoiceRecorder.tsx` → `/analyze_voice`)

Pressing **Analyze** POSTs the Blob to `POST /analyze_voice`. The backend returns acoustic stress biomarkers:

| Field | Description |
|-------|-------------|
| `pitch_variation_hz` | Pitch range in Hz |
| `speech_rate_wpm` | Words per minute estimate |
| `voice_energy_db` | Signal energy in dB |
| `tremor_index` | Voice tremor score (0–1) |
| `jitter_percent` | Cycle-to-cycle pitch variation |
| `shimmer_percent` | Cycle-to-cycle amplitude variation |
| `confidence_score` | Model confidence (0–1) |

The returned `metrics` are injected into the dashboard, overriding the current EEG-derived values.

### 3. Cleanup

After recording stops, the mic track is released, the `AudioContext` is closed, and the analyser node is cleared.

### Known limitations

| Issue | Detail |
|-------|--------|
| `isAnalyzing` never activates | The loading state lives in the hook but the `analyzeVoice` call is made outside it, so the spinner never shows |
| Voice not fused with EEG | `/analyze_voice` returns values independent of EEG metrics; scores are not fused |
| No playback | The recorded blob is not played back to the user |
| Microphone permission | If denied, click the lock icon in the address bar → allow Microphone, then refresh |

---

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Charts**: Recharts
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Backend**: Python FastAPI, Uvicorn, WebSockets
- **Signal processing**: scipy (filtering), specparam (aperiodic/FOOOF fit), numpy
- **EEG Data**: AWEAR B2B API (live single-channel EEG, TP10)
