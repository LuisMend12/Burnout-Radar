# Burnout Radar

Real-time AI-powered mental wellness dashboard combining voice biomarker analysis and EEG biofeedback.

## Quick Start

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Backend (FastAPI) — optional

The frontend runs fully standalone with simulated data. The backend adds real API endpoints.

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Backend runs at [http://localhost:8000](http://localhost:8000)

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| npm | 9+ |
| Python | 3.10+ (backend only) |

---

## Project Structure

```
Burnout-Radar/
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
│   │   ├── useMetrics.ts      # WebSocket metrics + local simulation
│   │   ├── useEEGStream.ts    # EEG brainwave data stream
│   │   └── useVoiceRecorder.ts
│   ├── lib/
│   │   ├── api.ts
│   │   └── utils.ts
│   └── types/index.ts
│
└── backend/                   # FastAPI
    ├── main.py                # All endpoints
    ├── mock_data.py           # Simulation generators
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

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Charts**: Recharts
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Backend**: Python FastAPI, Uvicorn, WebSockets
