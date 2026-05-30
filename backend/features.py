"""
EEG spectral feature extraction — aperiodic (1/f) exponent, relative alpha, R².

Uses specparam (FOOOF) when available; falls back to plain OLS log-log regression.
scipy is used for filtering; falls back to no-op if not installed.
"""
from __future__ import annotations

import dataclasses
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import numpy as np

try:
    from scipy import signal as _sp
    _HAS_SCIPY = True
except ImportError:
    _HAS_SCIPY = False

try:
    from specparam import SpectralModel
    _HAS_SPECPARAM = True
except ImportError:
    _HAS_SPECPARAM = False


BAND_RANGES: dict = {
    "delta": (1.0,  4.0),
    "theta": (4.0,  8.0),
    "alpha": (8.0, 13.0),
    "beta":  (13.0, 30.0),
    "gamma": (30.0, 45.0),
}


def _assign_band(cf: float) -> str:
    for band, (lo, hi) in BAND_RANGES.items():
        if lo <= cf < hi:
            return band
    return "broadband"


@dataclasses.dataclass
class Config:
    fs: int = 256
    fit_lo: float = 2.0
    fit_hi: float = 75.0
    win_sec: float = 4.0
    step_sec: float = 1.0
    highpass_hz: float = 0.5
    notch_hz: float = 60.0
    mains_interp: bool = True


def rows_to_signal(rows: List[Dict], fs: int) -> Tuple[np.ndarray, List[str]]:
    """Concatenate waveform arrays from API rows into a 1-D float signal."""
    waves: List[np.ndarray] = []
    timestamps: List[str] = []
    for row in rows:
        wf = row.get("waveform", [])
        if len(wf) >= 32:
            waves.append(np.array(wf, dtype=float))
            timestamps.append(row.get("timestamp", ""))
    if not waves:
        return np.array([]), timestamps
    return np.concatenate(waves), timestamps


def contiguous_runs(rows: List[Dict], max_gap_sec: float = 5.0) -> List[List[Dict]]:
    """Split rows into contiguous segments; any gap > max_gap_sec starts a new run."""
    if not rows:
        return []
    runs: List[List[Dict]] = [[rows[0]]]
    for row in rows[1:]:
        try:
            t_prev = datetime.fromisoformat(runs[-1][-1]["timestamp"].replace("Z", "+00:00"))
            t_curr = datetime.fromisoformat(row["timestamp"].replace("Z", "+00:00"))
            if (t_curr - t_prev).total_seconds() > max_gap_sec:
                runs.append([row])
            else:
                runs[-1].append(row)
        except Exception:
            runs[-1].append(row)
    return runs


def preprocess(sig: np.ndarray, cfg: Config) -> np.ndarray:
    """Highpass + notch filter. No-op when scipy is unavailable or signal is too short."""
    if len(sig) < cfg.fs * 2 or not _HAS_SCIPY:
        return sig
    nyq = cfg.fs / 2.0
    sos = _sp.butter(4, cfg.highpass_hz / nyq, btype="high", output="sos")
    sig = _sp.sosfiltfilt(sos, sig)
    if cfg.notch_hz and cfg.notch_hz < nyq:
        b, a = _sp.iirnotch(cfg.notch_hz / nyq, Q=30.0)
        sig = _sp.filtfilt(b, a, sig)
    return sig


def _psd(window: np.ndarray, fs: int) -> Tuple[np.ndarray, np.ndarray]:
    if _HAS_SCIPY:
        return _sp.welch(window, fs=fs, nperseg=len(window), scaling="density")
    fft = np.fft.rfft(window)
    freqs = np.fft.rfftfreq(len(window), d=1.0 / fs)
    psd = (np.abs(fft) ** 2) / (fs * len(window))
    return freqs, psd


def _ols_exponent(
    freqs: np.ndarray, psd: np.ndarray, fit_lo: float, fit_hi: float
) -> Tuple[float, float, float]:
    """OLS log-log fit. Returns (exponent, offset, r2)."""
    mask = (freqs >= fit_lo) & (freqs <= fit_hi) & (freqs > 0) & (psd > 0)
    if mask.sum() < 5:
        return float("nan"), float("nan"), 0.0
    lf, lp = np.log10(freqs[mask]), np.log10(psd[mask])
    x = np.column_stack([np.ones_like(lf), lf])
    try:
        coeffs, _, _, _ = np.linalg.lstsq(x, lp, rcond=None)
        offset, slope = coeffs
        ss_res = float(np.sum((lp - x @ coeffs) ** 2))
        ss_tot = float(np.sum((lp - lp.mean()) ** 2))
        r2 = 1.0 - ss_res / (ss_tot + 1e-12)
        return float(-slope), float(offset), float(r2)
    except Exception:
        return float("nan"), float("nan"), 0.0


def _alpha_peak_pw(
    freqs: np.ndarray, psd: np.ndarray, exponent: float, offset: float
) -> Optional[float]:
    """Periodic alpha power above the aperiodic floor."""
    if not (np.isfinite(exponent) and np.isfinite(offset)):
        return None
    mask = (freqs >= 8) & (freqs <= 13)
    if not mask.any():
        return None
    floor = 10 ** (offset - exponent * np.log10(np.where(freqs > 0, freqs, 1.0)))
    peak = float(np.max(psd[mask] - floor[mask]))
    return peak if peak > 0 else None


def _rel_alpha(freqs: np.ndarray, psd: np.ndarray) -> float:
    """Relative alpha (8–12 Hz) as a fraction of 1–40 Hz power."""
    total_m = (freqs >= 1) & (freqs <= 40)
    alpha_m = (freqs >= 8) & (freqs <= 12)
    _trapz = getattr(np, "trapezoid", None) or np.trapz  # numpy 2.0 renamed trapz → trapezoid
    total = float(_trapz(psd[total_m], freqs[total_m])) if total_m.any() else 0.0
    alpha = float(_trapz(psd[alpha_m], freqs[alpha_m])) if alpha_m.any() else 0.0
    return alpha / total if total > 1e-12 else 0.0


def _peaks_from_specparam(fm) -> List[Dict]:
    """Return periodic peaks [{cf, pw, bw, band}] from a fitted SpectralModel."""
    out: List[Dict] = []
    params = getattr(fm, "peak_params_", None)
    if params is None or len(params) == 0:
        return out
    for row in np.atleast_2d(params):
        cf, pw, bw = float(row[0]), float(row[1]), float(row[2])
        if np.isfinite(cf) and np.isfinite(pw) and np.isfinite(bw) and pw > 0:
            out.append({"cf": round(cf, 2), "pw": round(pw, 4), "bw": round(bw, 2), "band": _assign_band(cf)})
    return out


def _peaks_from_ols(
    freqs: np.ndarray, psd: np.ndarray,
    exponent: float, offset: float,
    fit_lo: float, fit_hi: float,
    min_pw: float = 0.05,
) -> List[Dict]:
    """Find local maxima in the log-space residual above the OLS aperiodic floor."""
    if not (np.isfinite(exponent) and np.isfinite(offset)):
        return []
    mask = (freqs >= fit_lo) & (freqs <= fit_hi) & (freqs > 0) & (psd > 0)
    if mask.sum() < 6:
        return []
    f, p = freqs[mask], psd[mask]
    floor_log = offset - exponent * np.log10(f)
    residual = np.log10(p) - floor_log
    n = len(residual)
    out: List[Dict] = []
    for i in range(1, n - 1):
        if residual[i] > residual[i - 1] and residual[i] > residual[i + 1] and residual[i] > min_pw:
            cf = float(f[i])
            pw = float(residual[i])
            half = pw / 2.0
            l, r = i, i
            while l > 0 and residual[l - 1] > half:
                l -= 1
            while r < n - 1 and residual[r + 1] > half:
                r += 1
            bw = max(0.5, float(f[r] - f[l]))
            out.append({"cf": round(cf, 2), "pw": round(pw, 4), "bw": round(bw, 2), "band": _assign_band(cf)})
    return out


def sliding_features(sig: np.ndarray, cfg: Config) -> Dict:
    """Slide a window across the signal and compute aperiodic + periodic features per window."""
    win_n = int(cfg.win_sec * cfg.fs)
    step_n = int(cfg.step_sec * cfg.fs)
    t_arr: List[float] = []
    exp_arr: List[float] = []
    r2_arr: List[float] = []
    apw_arr: List[Optional[float]] = []
    rel_arr: List[float] = []
    peaks_arr: List[List[Dict]] = []

    for start in range(0, len(sig) - win_n + 1, step_n):
        window = sig[start : start + win_n]
        freqs, psd = _psd(window, cfg.fs)
        t_arr.append(start / cfg.fs)

        if _HAS_SPECPARAM:
            try:
                fm = SpectralModel(
                    peak_width_limits=[1, 8], max_n_peaks=6,
                    aperiodic_mode="fixed", verbose=False,
                )
                fm.fit(freqs, psd, [cfg.fit_lo, cfg.fit_hi])
                exp = float(fm.aperiodic_params_[1])
                offset = float(fm.aperiodic_params_[0])
                r2 = float(fm.r_squared_)
                peaks = _peaks_from_specparam(fm)
            except Exception:
                exp, offset, r2 = _ols_exponent(freqs, psd, cfg.fit_lo, cfg.fit_hi)
                peaks = _peaks_from_ols(freqs, psd, exp, offset, cfg.fit_lo, cfg.fit_hi)
        else:
            exp, offset, r2 = _ols_exponent(freqs, psd, cfg.fit_lo, cfg.fit_hi)
            peaks = _peaks_from_ols(freqs, psd, exp, offset, cfg.fit_lo, cfg.fit_hi)

        exp_arr.append(exp)
        r2_arr.append(r2)
        apw_arr.append(_alpha_peak_pw(freqs, psd, exp, offset))
        rel_arr.append(_rel_alpha(freqs, psd))
        peaks_arr.append(peaks)

    nan_for_none = [x if x is not None else float("nan") for x in apw_arr]
    return {
        "t":              np.array(t_arr),
        "exponent":       np.array(exp_arr),
        "r2":             np.array(r2_arr),
        "alpha_peak_pw":  np.array(nan_for_none),
        "bands":          {"rel_alpha": np.array(rel_arr)},
        "periodic_peaks": peaks_arr,
    }


def smooth(arr: np.ndarray, n: int = 7) -> np.ndarray:
    """Rolling-median smoothing with window size n."""
    if len(arr) == 0:
        return arr
    half = n // 2
    out = np.empty_like(arr)
    for i in range(len(arr)):
        w = arr[max(0, i - half) : min(len(arr), i + half + 1)]
        valid = w[np.isfinite(w)]
        out[i] = float(np.median(valid)) if len(valid) else float("nan")
    return out
