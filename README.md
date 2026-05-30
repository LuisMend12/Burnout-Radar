# Burnout Radar

Real-time mental wellness dashboard powered by live EEG data from the AWEAR B2B API, combining brainwave analysis and voice biomarker detection.

## Data Source

Metrics are derived from **real EEG recordings** fetched via the [AWEAR B2B API](https://awear-b2b-2026.vercel.app/). The backend reads raw EEG waveforms (256 samples @ 256 Hz, right temporal lobe / TP10), computes brainwave band powers (delta, theta, alpha, beta, gamma) via FFT, and maps them to wellness metrics in real time.

To enable live data, add your AWEAR API key to a `.env` file in the project root:

```
API_KEY=awr_sk_your_key_here
```

If no key is present the backend falls back to simulated data automatically.

## Quick Start

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev        # dev server
npm run build      # production build
npm start          # serve production build
```

Open [http://localhost:3000](http://localhost:3000)

### Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Backend runs at [http://localhost:8000](http://localhost:8000)

The backend automatically reads `API_KEY` from the root `.env` file on startup and switches to live AWEAR data. The `/` endpoint reports `"data_source": "awear_api"` when live data is active.

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
│   │   ├── Header.tsx
│   │   ├── MentalReadinessScore.tsx
│   │   ├── VoiceRecorder.tsx
│   │   ├── EEGPanel.tsx
│   │   ├── MetricCard.tsx
│   │   ├── MetricsDashboard.tsx
│   │   ├── TimelineView.tsx
│   │   ├── RecommendationEngine.tsx
│   │   └── GlowCard.tsx
│   ├── hooks/
│   │   ├── useMetrics.ts      # WebSocket metrics stream
│   │   ├── useEEGStream.ts    # EEG brainwave data stream
│   │   └── useVoiceRecorder.ts
│   ├── lib/
│   │   ├── api.ts
│   │   └── utils.ts
│   └── types/index.ts
│
└── backend/                   # FastAPI
    ├── main.py                # All endpoints
    ├── awear_client.py        # AWEAR API client + FFT band power computation
    ├── mock_data.py           # Fallback simulation generators
    ├── models.py              # Pydantic schemas
    └── requirements.txt
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/metrics` | Current wellness metrics snapshot |
| POST | `/analyze_voice` | Upload audio, returns stress biomarkers |
| GET | `/recommendations` | AI-generated wellness suggestions |
| WS | `/eeg_stream` | Live EEG brainwave data at 10 Hz |
| WS | `/metrics_stream` | Live metrics updates every 2 s |

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

## Voice Analysis Pipeline

The Voice Analysis panel records audio from the microphone and sends it to the backend for processing. Here is the full data flow:

### 1. Microphone capture (`useVoiceRecorder.ts`)

When the user presses **Record**:

1. **Permission request** — `getUserMedia` asks the browser for mic access with echo cancellation and noise suppression at 44,100 Hz. Permission denied errors surface here.
2. **Web Audio API (visualizer only)** — an `AnalyserNode` with `fftSize = 2048` is connected to the mic stream. This is used exclusively to draw the live waveform on the canvas; it does not record anything.
3. **MediaRecorder (actual capture)** — records the stream in `audio/webm;codecs=opus` format, firing `ondataavailable` every 100 ms to accumulate audio chunks.
4. **Timer** — counts elapsed seconds and hard-stops the recording at 60 seconds.

When the user presses **Stop**, all 100 ms chunks are merged into a single `audio/webm` `Blob`.

### 2. Upload & analysis (`VoiceRecorder.tsx` → `/analyze_voice`)

Pressing **Analyze** POSTs the `Blob` to `POST /analyze_voice` on the backend. The backend returns acoustic stress biomarkers:

| Field | Description |
|-------|-------------|
| `pitch_variation_hz` | Pitch range in Hz |
| `speech_rate_wpm` | Words per minute estimate |
| `voice_energy_db` | Signal energy in dB |
| `tremor_index` | Voice tremor score (0–1) |
| `jitter_percent` | Cycle-to-cycle pitch variation |
| `shimmer_percent` | Cycle-to-cycle amplitude variation |
| `confidence_score` | Model confidence (0–1) |

The returned `metrics` (stress, focus, fatigue, calmness) are injected into the dashboard, overriding the current EEG-derived values.

### 3. Cleanup

After recording stops, the mic track is released, the `AudioContext` is closed, and the analyser node is cleared — stopping the waveform animation.

### Known limitations

| Issue | Detail |
|-------|--------|
| `isAnalyzing` never activates | The loading state lives in the hook but the `analyzeVoice` call is made outside it, so the spinner never shows |
| Voice not wired into EEG pipeline | The backend's `/analyze_voice` endpoint currently returns values independent of the EEG metrics; voice and EEG scores are not fused |
| No playback | The recorded blob is not played back to the user |
| Microphone permission | Requires browser permission. If denied, click the lock icon in the address bar → allow Microphone, then refresh |

---

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Charts**: Recharts
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Backend**: Python FastAPI, Uvicorn, WebSockets
- **EEG Data**: AWEAR B2B API (live single-channel EEG, TP10)
