# AWEAR Aperiodic Extraction — Frontend Handoff

This service does the EEG → **aperiodic exponent** (1/f brain-state marker) extraction
and exposes it as JSON. The frontend never touches Python, specparam, or the AWEAR key —
**it just polls one HTTP endpoint.**

```
EEG patch ──BLE──► AWEAR iPhone app ──► AWEAR cloud ──REST──►  server.py  ──JSON──►  your frontend
                                        (~3 min behind)        (this repo)            (Lovable)
```

The AWEAR cloud serves data **up to ~3 minutes old**, so this is "live monitoring," not
instant biofeedback. Every response includes `as_of` and `lag_seconds` so you can show the
honest delay.

---

## 1. Run the backend

Requires **Python 3.12** (specparam/scipy wheels). One-time setup:

```bash
python3.12 -m venv .venv
./.venv/bin/pip install -r requirements.txt
# create .env with the AWEAR research-portal key (server-side only, never shipped to frontend):
echo 'AWEAR_API_KEY=awr_sk_xxxxxxxx' > .env
```

Start it:

```bash
./.venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8000
```

Check it: `curl http://localhost:8000/health` → `{"ok": true, ...}`

A working reference client is **`live.html`** (open it in a browser; it polls the API every 3 s).

---

## 2. The endpoint you need: `GET /live`

Query params (both optional):
- `participant` — AWEAR participant id (e.g. `P-T8QCYK`). Omit → auto-picks the member with an active device.
- `lookback` — minutes of history to pull (default `6`).

### Response

```jsonc
{
  "participant": "P-T8QCYK",
  "device": "AWEAR-E22AC805",
  "fs": 256,
  "as_of": "2026-05-30T18:22:00+00:00",   // timestamp of the most recent EEG sample
  "lag_seconds": 182.0,                    // how far behind real time (cloud delay)
  "current": {
    "exponent": 0.95,                      // latest 1/f exponent (raw)
    "exponent_smoothed": 0.92,             // ← USE THIS for the live readout (rolling median)
    "relative_alpha_pct": 18.1,            // 8–12 Hz share of power (relaxation)
    "alpha_peak_pw": 0.34,                 // periodic alpha height above 1/f (may be null)
    "r2": 0.96,                            // fit quality
    "quality": true,                       // false = noisy/motion window
    "brain_state_score": 47                // 0–100, higher = steeper = calmer (see below)
  },
  "series": [                              // recent windows for a live chart (oldest→newest)
    {"t":"2026-05-30T18:19:02+00:00","exponent":0.88,"exponent_smoothed":0.90,
     "relative_alpha_pct":17.2,"alpha_peak_pw":0.31,"r2":0.95,"quality":true},
    ...
  ],
  "config": { "fit_lo":2.0, "fit_hi":75.0, "win_sec":4.0, "step_sec":1.0,
              "highpass_hz":0.5, "notch_hz":60.0, "mains_interp":true }
}
```

Other endpoints: `GET /health`, `GET /members` (list participants).

---

## 3. What to display

| Field | Meaning | UI idea |
|---|---|---|
| `current.exponent_smoothed` | **the brain-state marker** — steeper (higher) = calmer | big number / the 1/f slope |
| `current.brain_state_score` | 0–100, higher = calmer | speedometer / gauge |
| `current.relative_alpha_pct` | relaxation (alpha rhythm) | secondary meter |
| `as_of` + `lag_seconds` | data freshness | "data as of 18:22 · 3 min ago" |
| `series[]` | recent exponent over time | live line chart / sparkline |
| `current.quality` | window is clean | dim/flag when `false` (motion) |

**`brain_state_score`** is a simple fixed map: `exponent 0.4 → 0`, `1.4 → 100`, clamped.
(See `SCORE_LO/SCORE_HI` in `server.py` to retune.) It needs no per-user baseline.

### Interpretation (important)
The AWEAR API returns **ADC counts, not microvolts**, so absolute power/offset are *not*
meaningful. Everything exposed here is **gain-invariant**: the **exponent** (a unitless log-log
slope) and **relative alpha** (a ratio). That's deliberate — the offset is intentionally not
exposed. Steeper exponent ⇄ more inhibition ⇄ calmer (the validated meditation effect).

---

## 4. Frontend integration

CORS is open (`*`), so you can call it directly from the browser:

```js
async function poll() {
  const r = await fetch("http://YOUR_BACKEND:8000/live?lookback=6");
  const d = await r.json();
  if (d.error) return;                 // e.g. nobody streaming yet
  show(d.current.exponent_smoothed,    // live 1/f exponent
       d.current.brain_state_score,    // 0–100 gauge
       d.current.relative_alpha_pct,
       d.as_of, d.lag_seconds,         // freshness
       d.series);                      // chart
}
setInterval(poll, 3000);               // 3 s is plenty (data is minutes old anyway)
```

**Deployment:** if the frontend runs in the cloud (Lovable) it can't reach `localhost`.
Either run both on the same machine for the demo, or expose the backend with
`ngrok http 8000` and point the app at the public URL.

---

## 5. File map

| File | Role |
|---|---|
| **`server.py`** | the FastAPI service (what you run) |
| `features.py` | the extraction engine: preprocess → sliding-window specparam → exponent/alpha. All tunables live in the `Config` dataclass. |
| `awear.py` | AWEAR cloud client (reads `AWEAR_API_KEY` from `.env`) |
| `.env` | the AWEAR key (do not commit / ship) |
| `live.html` | reference client that polls `/live` (open in a browser) |
| `requirements.txt` | pinned deps (Python 3.12) |
| `demo.html` + `export_demo_data.py` | offline replay demo (speedometer of recorded sessions) |
| `viz_exponent_steepening.py` | the "1/f steepens during meditation" figure |

The signal config (256 Hz, fit 2–75 Hz with 60 Hz mains interpolation, 0.5 Hz highpass,
4 s/1 s windows) is validated and lives in `features.Config` — change it there if needed.
