#!/usr/bin/env python3
"""Generate the Petalworks sound set.

Original procedural synthesis only (numpy + scipy). No samples are loaded
or downloaded. Writes Ogg Vorbis and MP3 fallbacks into assets/audio/, plus
AUDIO_MANIFEST.md and LICENSE.md.

Requires ffmpeg with libvorbis and libmp3lame on PATH.

    python3 assets/audio/_source/generate_audio.py
    python3 assets/audio/_source/generate_audio.py --plots /tmp/petal-audio
"""

from __future__ import annotations

import argparse
import subprocess
import tempfile
import wave
import zlib
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, resample_poly, sosfilt

SR = 44100
SEED = 20261101
PEAK_CEILING = 10 ** (-1.5 / 20.0)  # about -1.5 dBFS sample peak; true peak checked too
OUT_DIR = Path(__file__).resolve().parents[1]

# 72 BPM. Each beat is exactly 36,750 samples, so 108 beats = 90.000 s.
BPM = 72.0
BEAT_SAMPLES = SR * 60 // int(BPM)  # 36750
BEAT_SEC = BEAT_SAMPLES / SR
MUSIC_BEATS = 108  # 27 bars of 4/4
MUSIC_SAMPLES = MUSIC_BEATS * BEAT_SAMPLES  # 3_969_000


# ---------------------------------------------------------------------------
# Loudness (ITU-R BS.1770 K-weighting)
# ---------------------------------------------------------------------------

def _k_weighting_sos(sr: int) -> np.ndarray:
    """High-shelf + RLB high-pass from BS.1770, bilinear design.

    The 48 kHz shelf matches the published coefficients. The high-pass is the
    same poles with numerator normalized (a fraction of a dB off the printed
    unnormalized b coefficients, which is immaterial here).
    """

    def shelf() -> np.ndarray:
        f0 = 1681.974450955533
        gain_db = 3.999843853973347
        q = 0.7071752369554196
        k = np.tan(np.pi * f0 / sr)
        vh = 10.0 ** (gain_db / 20.0)
        vb = vh ** 0.4996667741545416
        a0 = 1.0 + k / q + k * k
        b0 = (vh + vb * k / q + k * k) / a0
        b1 = 2.0 * (k * k - vh) / a0
        b2 = (vh - vb * k / q + k * k) / a0
        a1 = 2.0 * (k * k - 1.0) / a0
        a2 = (1.0 - k / q + k * k) / a0
        return np.array([b0, b1, b2, 1.0, a1, a2], dtype=np.float64)

    def hipass() -> np.ndarray:
        f0 = 38.13547087602444
        q = 0.5003270373238773
        k = np.tan(np.pi * f0 / sr)
        a0 = 1.0 + k / q + k * k
        b0 = 1.0 / a0
        b1 = -2.0 / a0
        b2 = 1.0 / a0
        a1 = 2.0 * (k * k - 1.0) / a0
        a2 = (1.0 - k / q + k * k) / a0
        return np.array([b0, b1, b2, 1.0, a1, a2], dtype=np.float64)

    return np.vstack([shelf(), hipass()])


def _assert_k_weighting_reference() -> None:
    sos = _k_weighting_sos(48000)
    expected_b = np.array([1.53512485958697, -2.69169618940638, 1.19839281085285])
    expected_a = np.array([-1.69065929318241, 0.73248077421585])
    if np.max(np.abs(sos[0, :3] - expected_b)) > 1e-9:
        raise RuntimeError("K-weighting shelf does not match BS.1770 48 kHz coefficients")
    if np.max(np.abs(sos[0, 4:] - expected_a)) > 1e-9:
        raise RuntimeError("K-weighting shelf poles do not match BS.1770")


def integrated_lufs(audio: np.ndarray, sr: int) -> float:
    """Integrated loudness. Files shorter than 400 ms use an ungated mean square."""
    channels = _channels(audio)
    sos = _k_weighting_sos(sr)
    filtered = [sosfilt(sos, ch) for ch in channels]
    n = len(filtered[0])
    win = int(0.4 * sr)
    hop = int(0.1 * sr)
    if n < win:
        ms = sum(float(np.mean(ch**2)) for ch in filtered)
        return float(-0.691 + 10.0 * np.log10(max(ms, 1e-20)))
    n_blocks = 1 + (n - win) // hop
    powers = np.empty(n_blocks, dtype=np.float64)
    for i in range(n_blocks):
        a = i * hop
        b = a + win
        powers[i] = sum(float(np.mean(ch[a:b] ** 2)) for ch in filtered)
    loud = -0.691 + 10.0 * np.log10(np.maximum(powers, 1e-20))
    absolute = loud > -70.0
    if not np.any(absolute):
        return float(np.mean(loud))
    ungated = float(np.mean(powers[absolute]))
    relative_gate = -0.691 + 10.0 * np.log10(max(ungated, 1e-20)) - 10.0
    gated = loud >= relative_gate
    if not np.any(gated):
        gated = absolute
    ms = float(np.mean(powers[gated]))
    return float(-0.691 + 10.0 * np.log10(max(ms, 1e-20)))


def true_peak(audio: np.ndarray) -> float:
    channels = _channels(audio)
    peak = 0.0
    for ch in channels:
        up = resample_poly(ch, 4, 1)
        peak = max(peak, float(np.max(np.abs(up))))
    return peak


def _channels(audio: np.ndarray) -> list[np.ndarray]:
    if audio.ndim == 1:
        return [audio]
    return [audio[:, i] for i in range(audio.shape[1])]


# ---------------------------------------------------------------------------
# DSP helpers
# ---------------------------------------------------------------------------

def rng_for(key: str) -> np.random.Generator:
    token = (zlib.crc32(key.encode("utf-8")) ^ SEED) & 0xFFFFFFFF
    return np.random.default_rng(token)


def midi_hz(midi: float, cents: float = 0.0) -> float:
    return 440.0 * 2.0 ** ((midi - 69.0 + cents / 100.0) / 12.0)


def highpass(audio: np.ndarray, sr: int, cutoff: float) -> np.ndarray:
    sos = butter(2, cutoff, btype="highpass", fs=sr, output="sos")
    return sosfilt(sos, audio)


def lowpass(audio: np.ndarray, sr: int, cutoff: float) -> np.ndarray:
    sos = butter(2, cutoff, btype="lowpass", fs=sr, output="sos")
    return sosfilt(sos, audio)


def bandpass(audio: np.ndarray, sr: int, lo: float, hi: float, order: int = 4) -> np.ndarray:
    sos = butter(order, [lo, hi], btype="bandpass", fs=sr, output="sos")
    return sosfilt(sos, audio)


def release(audio: np.ndarray, sr: int, fade: float = 0.03) -> np.ndarray:
    """Take the last few milliseconds exactly to zero so a voice never ends on a step."""
    y = np.array(audio, dtype=np.float64, copy=True)
    n = min(len(y) // 2, max(2, int(round(fade * sr))))
    y[-n:] *= np.cos(np.linspace(0.0, np.pi / 2.0, n)) ** 2
    y[-1] = 0.0
    return y


def apply_fades(audio: np.ndarray, sr: int, fade_in: float, fade_out: float) -> np.ndarray:
    y = np.array(audio, dtype=np.float64, copy=True)
    n_in = min(len(y) // 2, max(2, int(round(fade_in * sr))))
    n_out = min(len(y) // 2, max(2, int(round(fade_out * sr))))
    y[:n_in] *= np.sin(np.linspace(0.0, np.pi / 2.0, n_in)) ** 2
    y[-n_out:] *= np.cos(np.linspace(0.0, np.pi / 2.0, n_out)) ** 2
    y[0] = 0.0
    y[-1] = 0.0
    return y


def trim_tail(audio: np.ndarray, sr: int, thresh: float = 1.2e-4, pad: float = 0.045) -> np.ndarray:
    idx = np.flatnonzero(np.abs(audio) > thresh)
    if len(idx) == 0:
        return audio[: max(8, int(0.05 * sr))]
    start = max(0, int(idx[0]) - int(0.004 * sr))
    end = min(len(audio), int(idx[-1]) + int(pad * sr))
    return audio[start:end]


def match_loudness(audio: np.ndarray, sr: int, target: float) -> tuple[np.ndarray, float]:
    current = integrated_lufs(audio, sr)
    gain = 10.0 ** ((target - current) / 20.0)
    y = audio * gain
    peak = true_peak(y)
    if peak > PEAK_CEILING:
        y *= PEAK_CEILING / peak
    return y, integrated_lufs(y, sr)


def scale_to_peak(audio: np.ndarray, peak_db: float) -> np.ndarray:
    peak = float(np.max(np.abs(audio))) + 1e-12
    target = 10.0 ** (peak_db / 20.0)
    return audio * (target / peak)


def finish_oneshot(
    audio: np.ndarray,
    sr: int,
    target_lufs: float,
    fade_in: float = 0.006,
    fade_out: float = 0.03,
    lp: float | None = 6800.0,
    hp: float = 40.0,
) -> np.ndarray:
    y = np.asarray(audio, dtype=np.float64)
    y = highpass(y, sr, hp)
    if lp is not None:
        y = lowpass(y, sr, lp)
    y = trim_tail(y, sr)
    y = apply_fades(y, sr, fade_in, fade_out)
    # Mean removal shifts the faded endpoints; a second short fade puts them
    # back on zero and leaves only a negligible residual offset.
    for _ in range(2):
        y -= np.mean(y)
        y = apply_fades(y, sr, min(fade_in, 0.003), min(fade_out, 0.008))
    y, _ = match_loudness(y, sr, target_lufs)
    y[0] = 0.0
    y[-1] = 0.0
    return y


# ---------------------------------------------------------------------------
# Instruments
# ---------------------------------------------------------------------------

def music_box_tine(
    freq: float,
    dur: float,
    sr: int,
    decay: float = 3.2,
    brightness: float = 0.45,
) -> np.ndarray:
    """Soft struck tine. Partials are gently inharmonic, like a small music box."""
    n = max(8, int(round(dur * sr)))
    t = np.arange(n, dtype=np.float64) / sr
    ratios = (1.0, 2.0, 2.76, 4.07, 5.43, 6.95)
    amps = (1.0, 0.26, 0.14 * brightness, 0.055 * brightness, 0.026 * brightness, 0.012 * brightness)
    decays = (
        decay,
        decay * 1.65,
        decay * 2.5,
        decay * 3.6,
        decay * 4.8,
        decay * 6.2,
    )
    y = np.zeros(n, dtype=np.float64)
    for ratio, amp, dec in zip(ratios, amps, decays):
        f = freq * ratio * (1.0 + 0.0011 * ratio)
        if f >= sr * 0.45:
            continue
        y += amp * np.exp(-dec * t) * np.sin(2.0 * np.pi * f * t)
    if freq < 700.0:
        y += 0.10 * np.exp(-decay * 0.55 * t) * np.sin(2.0 * np.pi * freq * 0.5 * t)
    att = max(2, int(0.0035 * sr))
    y[:att] *= np.linspace(0.0, 1.0, att) ** 2
    return release(y, sr, 0.035)


def plucked_string(
    freq: float,
    dur: float,
    sr: int,
    decay: float = 2.3,
    brightness: float = 0.32,
) -> np.ndarray:
    """Warm nylon-like pluck: fast-rolling harmonics, no bright pick noise."""
    n = max(8, int(round(dur * sr)))
    t = np.arange(n, dtype=np.float64) / sr
    y = np.zeros(n, dtype=np.float64)
    harmonic = 1
    while harmonic <= 16:
        f = freq * harmonic * np.sqrt(1.0 + 0.00055 * harmonic * harmonic)
        if f >= sr * 0.40:
            break
        amp = harmonic ** -(1.62 - 0.45 * brightness)
        dec = decay * (1.0 + 0.20 * (harmonic - 1))
        y += amp * np.exp(-dec * t) * np.sin(2.0 * np.pi * f * t)
        harmonic += 1
    att = max(2, int(0.006 * sr))
    y[:att] *= np.linspace(0.0, 1.0, att) ** 2
    return release(y, sr, 0.04)


def wood_tap(
    sr: int,
    pitch: float = 240.0,
    dur: float = 0.24,
    brightness: float = 0.35,
    rng: np.random.Generator | None = None,
) -> np.ndarray:
    """A rounded wooden knock: a few fast body resonances plus a soft beater."""
    n = max(8, int(round(dur * sr)))
    t = np.arange(n, dtype=np.float64) / sr
    modes = (
        (pitch, 1.0, 14.0),
        (pitch * 2.03, 0.38, 26.0),
        (pitch * 2.71, 0.18 * (0.45 + brightness), 38.0),
        (pitch * 3.92, 0.07 * brightness, 52.0),
        (pitch * 5.4, 0.035 * brightness, 68.0),
    )
    y = np.zeros(n, dtype=np.float64)
    generator = rng if rng is not None else np.random.default_rng(1)
    for freq, amp, decay in modes:
        phase = float(generator.uniform(0.0, 0.25))
        y += amp * np.exp(-decay * t) * np.sin(2.0 * np.pi * freq * t + phase)
    click_n = min(n, int(0.005 * sr))
    noise = generator.standard_normal(click_n)
    noise = np.diff(noise, prepend=noise[0])
    noise *= np.exp(-np.arange(click_n) / sr * 420.0)
    y[:click_n] += 0.055 * brightness * noise
    att = max(2, int(0.0045 * sr))
    y[:att] *= np.linspace(0.0, 1.0, att) ** 2
    return release(y, sr, min(0.03, dur * 0.35))


def paper_rustle(sr: int, dur: float, rng: np.random.Generator) -> np.ndarray:
    n = max(8, int(round(dur * sr)))
    noise = rng.standard_normal(n)
    y = bandpass(noise, sr, 700.0, 3400.0, order=3)
    env = np.zeros(n, dtype=np.float64)
    bumps = int(rng.integers(5, 8))
    for _ in range(bumps):
        center = int(rng.uniform(0.08, 0.82) * n)
        width = int(rng.uniform(0.018, 0.055) * sr)
        a = max(0, center - width)
        b = min(n, center + width)
        if b <= a:
            continue
        local = np.linspace(-1.0, 1.0, b - a)
        env[a:b] += float(rng.uniform(0.35, 1.0)) * np.exp(-3.2 * local * local)
    env = lowpass(env, sr, 45.0)
    env = np.maximum(env, 0.0)
    window = np.sin(np.linspace(0.0, np.pi, n)) ** 1.15
    return release(y * env * window, sr, 0.025)


def bubble_pop(sr: int, f_start: float = 860.0, f_end: float = 360.0, dur: float = 0.16) -> np.ndarray:
    n = max(8, int(round(dur * sr)))
    t = np.arange(n, dtype=np.float64) / sr
    freq = f_end + (f_start - f_end) * np.exp(-t * 26.0)
    phase = 2.0 * np.pi * np.cumsum(freq) / sr
    amp = np.exp(-t * 12.5) * (1.0 - np.exp(-t * 350.0))
    y = np.sin(phase) * amp
    y += 0.22 * np.sin(2.0 * np.pi * f_end * t) * np.exp(-t * 9.0)
    return release(y, sr, min(0.04, dur * 0.4))


def render_tines(
    events: list[tuple[float, float, float, float, float]],
    sr: int,
    brightness: float = 0.42,
) -> np.ndarray:
    """events: (time_sec, midi, velocity, decay, dur_sec)."""
    if not events:
        return np.zeros(8, dtype=np.float64)
    voices: list[tuple[int, np.ndarray]] = []
    for time_sec, midi, vel, decay, dur in events:
        wave = music_box_tine(midi_hz(midi), dur, sr, decay=decay, brightness=brightness)
        wave *= vel**1.35
        voices.append((int(round(time_sec * sr)), wave))
    n = max(start + len(wave) for start, wave in voices) + 4
    y = np.zeros(n, dtype=np.float64)
    for start, wave in voices:
        y[start : start + len(wave)] += wave
    return y


# ---------------------------------------------------------------------------
# One-shot and loop synthesis
# ---------------------------------------------------------------------------

def synth_ui_click(sr: int, rng: np.random.Generator) -> np.ndarray:
    body = wood_tap(sr, pitch=392.0, dur=0.16, brightness=0.42, rng=rng)
    tick = wood_tap(sr, pitch=586.0, dur=0.09, brightness=0.28, rng=rng)
    y = np.zeros(max(len(body), len(tick)), dtype=np.float64)
    y[: len(body)] += body
    y[: len(tick)] += 0.35 * tick
    return y


def synth_ui_hover(sr: int, rng: np.random.Generator) -> np.ndarray:
    """A fingertip on paper. Very quiet, almost pitchless."""
    n = int(0.07 * sr)
    noise = rng.standard_normal(n)
    y = bandpass(noise, sr, 1400.0, 2800.0, order=2)
    env = np.sin(np.linspace(0.0, np.pi, n)) ** 2
    return y * env * 0.25


def synth_ui_error(sr: int, rng: np.random.Generator) -> np.ndarray:
    """Two muffled wooden taps, a soft falling minor third. Not a buzzer."""
    a = wood_tap(sr, pitch=174.0, dur=0.22, brightness=0.16, rng=rng)
    b = wood_tap(sr, pitch=146.0, dur=0.26, brightness=0.14, rng=rng)
    y = np.zeros(int(0.42 * sr), dtype=np.float64)
    y[: len(a)] += a
    start = int(0.11 * sr)
    end = min(len(y), start + len(b))
    y[start:end] += 0.85 * b[: end - start]
    return y


def synth_build_place(sr: int, rng: np.random.Generator) -> np.ndarray:
    body = wood_tap(sr, pitch=168.0, dur=0.28, brightness=0.30, rng=rng)
    low = wood_tap(sr, pitch=92.0, dur=0.32, brightness=0.08, rng=rng)
    y = np.zeros(max(len(body), len(low)), dtype=np.float64)
    y[: len(body)] += body
    y[: len(low)] += 0.32 * low
    return y


def synth_build_rotate(sr: int, rng: np.random.Generator) -> np.ndarray:
    a = wood_tap(sr, pitch=520.0, dur=0.10, brightness=0.34, rng=rng)
    b = wood_tap(sr, pitch=640.0, dur=0.09, brightness=0.28, rng=rng)
    y = np.zeros(int(0.18 * sr), dtype=np.float64)
    y[: len(a)] += a
    start = int(0.038 * sr)
    end = min(len(y), start + len(b))
    y[start:end] += 0.7 * b[: end - start]
    return y


def synth_build_remove(sr: int, rng: np.random.Generator) -> np.ndarray:
    rustle = paper_rustle(sr, 0.34, rng)
    lift = wood_tap(sr, pitch=210.0, dur=0.16, brightness=0.22, rng=rng)
    y = np.zeros(max(len(rustle), len(lift)), dtype=np.float64)
    y[: len(rustle)] += rustle
    y[: len(lift)] += 0.7 * lift
    return y


def synth_undo(sr: int, _rng: np.random.Generator) -> np.ndarray:
    events = [
        (0.00, 72, 0.46, 3.4, 0.55),  # C5
        (0.09, 69, 0.36, 3.2, 0.55),  # A4
        (0.18, 65, 0.42, 2.6, 0.70),  # F4
    ]
    return render_tines(events, sr, brightness=0.32)


def synth_item_pop(sr: int, _rng: np.random.Generator) -> np.ndarray:
    pop = bubble_pop(sr, f_start=820.0, f_end=392.0, dur=0.15)
    spark = music_box_tine(midi_hz(84), 0.28, sr, decay=5.5, brightness=0.35) * 0.35
    n = max(len(pop), len(spark) + int(0.03 * sr))
    y = np.zeros(n, dtype=np.float64)
    y[: len(pop)] += pop
    start = int(0.025 * sr)
    y[start : start + len(spark)] += spark
    return y


def synth_flower_bloom(sr: int, _rng: np.random.Generator) -> np.ndarray:
    events = [
        (0.00, 69, 0.40, 2.5, 1.15),  # A4
        (0.13, 72, 0.44, 2.4, 1.10),  # C5
        (0.27, 76, 0.36, 2.6, 1.05),  # E5
        (0.44, 81, 0.26, 2.8, 0.95),  # A5, softer glint
    ]
    y = render_tines(events, sr, brightness=0.40)
    bed = plucked_string(midi_hz(53), 0.8, sr, decay=3.2, brightness=0.2) * 0.22
    out = np.zeros(max(len(y), len(bed)), dtype=np.float64)
    out[: len(y)] += y
    out[: len(bed)] += bed
    return out


def synth_blocked(sr: int, _rng: np.random.Generator) -> np.ndarray:
    """Gentle two-note warning, descending, still in the music-box voice."""
    events = [
        (0.00, 64, 0.40, 2.8, 0.55),  # E4
        (0.16, 60, 0.46, 2.4, 0.70),  # C4
    ]
    return render_tines(events, sr, brightness=0.28)


def synth_coins(sr: int, _rng: np.random.Generator) -> np.ndarray:
    events = [
        (0.00, 72, 0.34, 4.6, 0.40),
        (0.065, 76, 0.32, 4.8, 0.38),
        (0.13, 79, 0.30, 5.0, 0.36),
        (0.20, 84, 0.36, 4.2, 0.42),
    ]
    return render_tines(events, sr, brightness=0.30)


def synth_order_complete(sr: int, _rng: np.random.Generator) -> np.ndarray:
    """Warm F-major motif: F4 A4 C5, then a soft F5."""
    events = [
        (0.00, 65, 0.50, 2.5, 1.35),
        (0.16, 69, 0.46, 2.5, 1.25),
        (0.33, 72, 0.52, 2.3, 1.20),
        (0.58, 77, 0.34, 2.6, 1.05),
    ]
    return render_tines(events, sr, brightness=0.40)


def synth_unlock(sr: int, _rng: np.random.Generator) -> np.ndarray:
    notes = (65, 67, 69, 72, 74, 77)
    events = []
    for i, midi in enumerate(notes):
        events.append((i * 0.095, midi, 0.30 + i * 0.035, 3.6 - i * 0.15, 0.85))
    return render_tines(events, sr, brightness=0.48)


def synth_final_celebration(sr: int, _rng: np.random.Generator) -> np.ndarray:
    """The order motif, opened up a little, then a soft F-major bloom."""
    events = [
        (0.00, 65, 0.48, 2.4, 2.4),
        (0.16, 69, 0.44, 2.4, 2.3),
        (0.33, 72, 0.50, 2.3, 2.2),
        (0.62, 74, 0.36, 2.6, 1.6),
        (0.82, 72, 0.34, 2.5, 1.5),
        (1.02, 69, 0.36, 2.4, 1.6),
        (1.28, 77, 0.42, 2.3, 1.8),
        (1.72, 65, 0.40, 2.0, 2.2),
        (1.72, 69, 0.34, 2.0, 2.2),
        (1.72, 72, 0.32, 2.1, 2.2),
        (1.90, 53, 0.22, 1.8, 2.0),
    ]
    return render_tines(events, sr, brightness=0.40)


def synth_deliver(sr: int, rng: np.random.Generator) -> np.ndarray:
    """Paper settling into the packing crate. Softer and shorter than remove."""
    return paper_rustle(sr, 0.26, rng) * 0.85


def synth_belt_tick(sr: int, rng: np.random.Generator) -> np.ndarray:
    """One soft knock near the start of a 0.75 s silent bed, so it loops cleanly."""
    tick = wood_tap(sr, pitch=250.0, dur=0.11, brightness=0.18, rng=rng)
    tick = highpass(tick, sr, 50.0)
    tick = lowpass(tick, sr, 3200.0)
    tick = apply_fades(tick, sr, 0.003, 0.02)
    tick -= np.mean(tick)
    tick = apply_fades(tick, sr, 0.002, 0.012)
    tick = scale_to_peak(tick, -20.0)
    n = int(round(0.75 * sr))
    y = np.zeros(n, dtype=np.float64)
    start = int(0.012 * sr)
    y[start : start + len(tick)] = tick
    y[0] = 0.0
    y[-1] = 0.0
    return y


def synth_machine_working(sr: int, rng: np.random.Generator) -> np.ndarray:
    """Two-second seamless loop: a quiet hum and two soft alternating plucks.

    Hum frequencies are integer cycles over exactly 2.0 s, so the bed itself
    has no seam. Plucks sit well inside the buffer and fade to zero.
    """
    n = 2 * sr  # 88200
    t = np.arange(n, dtype=np.float64) / sr
    hum = (
        0.20 * np.sin(2.0 * np.pi * 196.0 * t)
        + 0.06 * np.sin(2.0 * np.pi * 392.0 * t)
        + 0.045 * np.sin(2.0 * np.pi * 294.0 * t)
    )
    y = hum * 0.18
    for time_sec, midi, vel in ((0.22, 55, 0.55), (1.22, 62, 0.42)):
        wave = plucked_string(midi_hz(midi), 0.62, sr, decay=4.6, brightness=0.22)
        wave = lowpass(wave, sr, 2800.0)
        wave = apply_fades(wave, sr, 0.008, 0.05)
        wave -= np.mean(wave)
        wave = apply_fades(wave, sr, 0.004, 0.02)
        wave *= vel
        start = int(round(time_sec * sr))
        y[start : start + len(wave)] += wave
    # Hum frequencies complete an integer number of cycles in exactly 2.0 s,
    # and neither pluck reaches the buffer edge, so the join is the hum alone.
    return y


def _place_wrapped(buffer: np.ndarray, wave: np.ndarray, start: int) -> None:
    n = len(buffer)
    idx = (np.arange(len(wave)) + int(start)) % n
    np.add.at(buffer, idx, wave)


def synth_music(sr: int, rng: np.random.Generator) -> np.ndarray:
    """90 second seamless loop in F major. Music box lead, soft plucked harmony."""
    if BEAT_SAMPLES != 36750 or MUSIC_SAMPLES != 3_969_000:
        raise RuntimeError("Music grid is no longer an integer sample loop")

    lead = np.zeros(MUSIC_SAMPLES, dtype=np.float64)
    harmony = np.zeros(MUSIC_SAMPLES, dtype=np.float64)
    sparkle = np.zeros(MUSIC_SAMPLES, dtype=np.float64)

    lead_notes = [
        (0.0, 1.4, 65, 0.52),
        (2.0, 0.9, 69, 0.40),
        (3.0, 0.9, 72, 0.46),
        (4.0, 1.6, 69, 0.38),
        (6.0, 1.4, 65, 0.36),
        (8.0, 1.4, 67, 0.40),
        (10.0, 1.4, 70, 0.34),
        (12.0, 1.8, 69, 0.42),
        (14.0, 1.8, 65, 0.36),
        (16.0, 0.9, 72, 0.48),
        (17.0, 0.9, 74, 0.40),
        (18.0, 1.4, 72, 0.38),
        (20.0, 1.8, 69, 0.40),
        (22.0, 1.6, 64, 0.32),
        (24.0, 0.7, 65, 0.38),
        (25.0, 0.7, 67, 0.32),
        (26.0, 0.7, 69, 0.34),
        (27.0, 0.8, 72, 0.36),
        (28.0, 3.2, 65, 0.50),
        (32.0, 1.4, 72, 0.50),
        (34.0, 0.9, 74, 0.38),
        (35.0, 0.9, 77, 0.42),
        (36.0, 1.6, 74, 0.36),
        (38.0, 1.4, 72, 0.34),
        (40.0, 1.4, 69, 0.38),
        (42.0, 1.4, 72, 0.34),
        (44.0, 1.8, 74, 0.40),
        (46.0, 1.6, 72, 0.34),
        (48.0, 0.9, 76, 0.40),
        (49.0, 0.9, 77, 0.38),
        (50.0, 1.4, 76, 0.32),
        (52.0, 1.8, 72, 0.38),
        (54.0, 1.6, 69, 0.32),
        (56.0, 0.7, 67, 0.34),
        (57.0, 0.7, 69, 0.30),
        (58.0, 0.7, 72, 0.32),
        (59.0, 0.8, 74, 0.34),
        (60.0, 3.2, 72, 0.46),
        (64.0, 1.8, 69, 0.42),
        (66.0, 1.6, 67, 0.32),
        (68.0, 1.4, 65, 0.38),
        (70.0, 1.4, 69, 0.34),
        (72.0, 1.8, 72, 0.44),
        (74.0, 1.6, 70, 0.30),
        (76.0, 0.9, 69, 0.36),
        (77.0, 0.9, 67, 0.30),
        (78.0, 1.6, 65, 0.36),
        (80.0, 1.8, 67, 0.34),
        (82.0, 1.6, 69, 0.36),
        (84.0, 1.4, 72, 0.40),
        (86.0, 1.4, 69, 0.32),
        (88.0, 1.6, 67, 0.30),
        (90.0, 1.6, 65, 0.36),
        (92.0, 3.4, 69, 0.42),
        (96.0, 1.4, 72, 0.46),
        (98.0, 1.4, 69, 0.36),
        (100.0, 0.9, 67, 0.32),
        (101.0, 0.9, 65, 0.34),
        (102.0, 1.6, 67, 0.30),
        (104.0, 3.6, 65, 0.50),
    ]

    for beat, dur, midi, vel in lead_notes:
        if 0.08 <= beat <= 107.7:
            beat = beat + float(rng.uniform(-0.010, 0.012))
        cents = float(rng.uniform(-3.5, 3.5))
        decay = 3.15 - 0.28 * min(dur, 3.0)
        tail = 4.2
        wave = music_box_tine(midi_hz(midi, cents), tail, sr, decay=decay, brightness=0.40)
        wave *= (vel * 0.90) ** 1.25
        _place_wrapped(lead, wave, int(round(beat * BEAT_SAMPLES)))

    chords = [
        (41, 53, 60),
        (41, 57, 60),
        (43, 55, 58),
        (41, 53, 60),
        (48, 52, 55),
        (45, 57, 60),
        (41, 53, 60),
        (41, 53, 60),
        (48, 52, 55),
        (45, 53, 57),
        (45, 57, 60),
        (46, 58, 62),
        (48, 52, 55),
        (41, 53, 60),
        (48, 52, 55),
        (48, 52, 55),
        (41, 53, 60),
        (41, 53, 60),
        (48, 52, 55),
        (45, 57, 64),
        (43, 55, 58),
        (41, 53, 60),
        (48, 52, 55),
        (41, 57, 60),
        (48, 52, 55),
        (48, 52, 55),
        (41, 53, 60),
    ]
    if len(chords) != 27:
        raise RuntimeError(f"expected 27 chords, got {len(chords)}")

    for bar, (bass, low, high) in enumerate(chords):
        downbeat = bar * 4
        cents = float(rng.uniform(-2.0, 2.0))
        bass_wave = plucked_string(midi_hz(bass, cents), 3.6, sr, decay=1.55, brightness=0.18)
        bass_wave *= 0.62
        _place_wrapped(harmony, bass_wave, int(round(downbeat * BEAT_SAMPLES)))
        for extra, midi, vel in ((0.0, low, 0.30), (0.015, high, 0.24)):
            wave = plucked_string(
                midi_hz(midi, float(rng.uniform(-4.0, 4.0))),
                2.4,
                sr,
                decay=2.15,
                brightness=0.28,
            )
            wave *= vel
            sample = int(round((downbeat + extra) * BEAT_SAMPLES))
            _place_wrapped(harmony, wave, sample)
        if bar % 4 != 3:
            off = downbeat + 2.0 + float(rng.uniform(0.0, 0.02))
            wave = plucked_string(midi_hz(high, float(rng.uniform(-3.0, 3.0))), 1.8, sr, decay=2.4, brightness=0.24)
            wave *= 0.14
            _place_wrapped(harmony, wave, int(round(off * BEAT_SAMPLES)))

    # Quiet F chord just before the downbeat, long enough to ring across the
    # loop point, so the cadence is still humming when the melody starts again.
    glue_at = int(round(105.5 * BEAT_SAMPLES))
    for midi, vel in ((41, 0.20), (53, 0.13), (60, 0.10)):
        wave = plucked_string(midi_hz(midi), 6.0, sr, decay=1.05, brightness=0.16)
        wave *= vel
        _place_wrapped(harmony, wave, glue_at)

    for beat, midi in ((6.5, 81), (22.5, 84), (38.5, 81), (54.5, 84), (70.5, 81), (86.5, 84), (102.5, 81)):
        wave = music_box_tine(midi_hz(midi, float(rng.uniform(-5.0, 5.0))), 1.3, sr, decay=5.2, brightness=0.34)
        wave *= 0.16
        _place_wrapped(sparkle, wave, int(round(beat * BEAT_SAMPLES)))

    dry = lead * 0.92 + harmony * 0.50 + sparkle * 0.55
    peak = float(np.max(np.abs(dry))) + 1e-12
    dry *= 0.45 / peak

    wet_l = _circular_convolve(dry, _room_ir(sr, rng_for("music-ir-l"), side="l"))
    wet_r = _circular_convolve(dry, _room_ir(sr, rng_for("music-ir-r"), side="r"))
    left = dry * 0.90 + wet_l * 0.22
    right = dry * 0.90 + wet_r * 0.22

    # Memoryless warmth keeps the loop periodic.
    drive = 1.12
    left = np.tanh(left * drive) / np.tanh(drive)
    right = np.tanh(right * drive) / np.tanh(drive)

    t = np.arange(MUSIC_SAMPLES, dtype=np.float64) / sr
    breath = 1.0 + 0.025 * np.sin(2.0 * np.pi * 3.0 * t / 90.0)
    left *= breath
    right *= breath

    stereo = np.column_stack([left, right])
    stereo = _circular_filter_stereo(stereo, sr)
    stereo, _ = match_loudness(stereo, sr, -18.0)
    return stereo


def _room_ir(sr: int, rng: np.random.Generator, side: str) -> np.ndarray:
    seconds = 1.35
    n = int(seconds * sr)
    t = np.arange(n, dtype=np.float64) / sr
    ir = rng.standard_normal(n) * np.exp(-t / 0.72)
    delays = (0.012, 0.019, 0.027, 0.041) if side == "l" else (0.014, 0.021, 0.033, 0.046)
    amps = (0.40, 0.24, 0.14, 0.08) if side == "l" else (0.34, 0.22, 0.13, 0.07)
    for delay, amp in zip(delays, amps):
        i = int(delay * sr)
        if i < n:
            ir[i] += amp
    ir = lowpass(ir, sr, 3000.0)
    ir = highpass(ir, sr, 90.0)
    ir[0] = 0.0
    ir /= np.sqrt(np.mean(ir**2)) + 1e-12
    ir *= 0.12
    return ir


def _circular_convolve(audio: np.ndarray, impulse: np.ndarray) -> np.ndarray:
    n = len(audio)
    spec = np.fft.rfft(audio)
    kernel = np.fft.rfft(impulse, n=n)
    return np.fft.irfft(spec * kernel, n=n)


def _circular_filter_stereo(audio: np.ndarray, sr: int) -> np.ndarray:
    """High-pass and gentle low-pass with state warmed by a previous copy."""
    hp = butter(2, 40.0, btype="highpass", fs=sr, output="sos")
    lp = butter(2, 8800.0, btype="lowpass", fs=sr, output="sos")
    out = np.empty_like(audio)
    for i in range(audio.shape[1]):
        ch = audio[:, i]
        twice = np.concatenate([ch, ch])
        filtered = sosfilt(lp, sosfilt(hp, twice))
        out[:, i] = filtered[len(ch) :]
    return out


# ---------------------------------------------------------------------------
# Catalog
# ---------------------------------------------------------------------------

@dataclass
class Cue:
    key: str
    loop: bool
    channels: int
    suggested_volume: float
    when: str
    description: str
    target_lufs: float | None = -18.0
    # Sparse loops are peak-staged instead of loudness-staged.
    peak_staged: bool = False
    lufs_min: float = -21.0
    lufs_max: float = -15.5
    duration_bounds: tuple[float, float] = (0.04, 5.0)
    builder: object = field(repr=False, default=None)


def catalog() -> list[Cue]:
    return [
        Cue(
            key="ui_click",
            loop=False,
            channels=1,
            suggested_volume=0.55,
            when="A button, palette item, toggle, or menu row is activated.",
            description="Short rounded wooden tick.",
            builder=synth_ui_click,
            duration_bounds=(0.05, 0.20),
        ),
        Cue(
            key="ui_hover",
            loop=False,
            channels=1,
            suggested_volume=0.40,
            target_lufs=-26.0,
            lufs_min=-29.0,
            lufs_max=-23.0,
            when="The pointer enters a button or build-palette item. Play at most once per control entry, and ignore retriggers closer than about 80 ms.",
            description="Very subtle paper fingertip. Mastered quieter than the other interface cues.",
            builder=synth_ui_hover,
            duration_bounds=(0.04, 0.12),
        ),
        Cue(
            key="ui_error",
            loop=False,
            channels=1,
            suggested_volume=0.50,
            target_lufs=-20.0,
            lufs_min=-23.0,
            lufs_max=-17.0,
            when="The player tries something the garden refuses: invalid placement, occupied tile, or not enough coins.",
            description="Two soft low wooden taps, a falling minor third. Dull on purpose, not a buzzer.",
            builder=synth_ui_error,
            duration_bounds=(0.20, 0.55),
        ),
        Cue(
            key="build_place",
            loop=False,
            channels=1,
            suggested_volume=0.62,
            when="A bed, belt, or machine is placed, including each tile of a belt drag.",
            description="Warm wooden set-down, lower and rounder than the UI click.",
            builder=synth_build_place,
            duration_bounds=(0.12, 0.40),
        ),
        Cue(
            key="build_rotate",
            loop=False,
            channels=1,
            suggested_volume=0.50,
            when="A placed or ghosted structure rotates (the R key or the rotate control).",
            description="A tiny two-step wooden ratchet.",
            builder=synth_build_rotate,
            duration_bounds=(0.08, 0.24),
        ),
        Cue(
            key="build_remove",
            loop=False,
            channels=1,
            suggested_volume=0.55,
            when="The delete tool removes an empty structure.",
            description="A soft paper rustle with a small wooden lift.",
            builder=synth_build_remove,
            duration_bounds=(0.18, 0.50),
        ),
        Cue(
            key="undo",
            loop=False,
            channels=1,
            suggested_volume=0.52,
            when="A build action is undone (Z).",
            description="Three quiet music-box notes stepping down, C A F.",
            builder=synth_undo,
            duration_bounds=(0.25, 1.05),
        ),
        Cue(
            key="belt_tick",
            loop=True,
            channels=1,
            suggested_volume=0.30,
            target_lufs=None,
            peak_staged=True,
            lufs_min=-55.0,
            lufs_max=-28.0,
            when=(
                "While at least one item is riding a belt. Loop it as a slow cadence, "
                "or play it once each time an item advances a tile. Do not stack copies. "
                "Stop it while the game is paused. It is mostly silence with one soft knock, "
                "so do not turn it up to chase the integrated-loudness number."
            ),
            description="Very subtle wooden cadence. 0.75 s seamless loop; the knock occupies the first tenth.",
            builder=synth_belt_tick,
            duration_bounds=(0.74, 0.76),
        ),
        Cue(
            key="item_pop",
            loop=False,
            channels=1,
            suggested_volume=0.60,
            when="A machine finishes a product (Daisy Bundle, Lavender Sachet, or Mixed Bouquet) and the sprite pops onto the output.",
            description="A small warm bubble with a short music-box glint.",
            builder=synth_item_pop,
            duration_bounds=(0.10, 0.40),
        ),
        Cue(
            key="flower_bloom",
            loop=False,
            channels=1,
            suggested_volume=0.62,
            when="A flower bed reaches ready and a bloom is waiting on the chute.",
            description="A slow A–C–E–A opening, with a quiet plucked root underneath.",
            builder=synth_flower_bloom,
            duration_bounds=(0.6, 1.5),
        ),
        Cue(
            key="machine_working",
            loop=True,
            channels=1,
            suggested_volume=0.38,
            target_lufs=-22.0,
            lufs_min=-25.5,
            lufs_max=-18.5,
            when=(
                "While any machine is processing. Keep a single shared loop no matter how many "
                "machines are busy, and pause it with the game. It should sit under the belts, not replace them."
            ),
            description="Two-second seamless loop: a soft G/D hum and two alternating plucks. Not a motor.",
            builder=synth_machine_working,
            duration_bounds=(1.99, 2.01),
        ),
        Cue(
            key="blocked",
            loop=False,
            channels=1,
            suggested_volume=0.46,
            target_lufs=-20.0,
            lufs_min=-23.0,
            lufs_max=-17.0,
            when="Edge-trigger when a bed or machine becomes blocked (output full or nowhere to go). Do not retrigger every tick while it stays blocked.",
            description="A gentle falling E–C music-box pair. Distinct from the duller ui_error taps.",
            builder=synth_blocked,
            duration_bounds=(0.25, 1.15),
        ),
        Cue(
            key="coins",
            loop=False,
            channels=1,
            suggested_volume=0.50,
            when=(
                "When the coin count increases outside a celebration, such as a refund. "
                "On order complete, either skip this or play it quietly about 0.35 s after order_complete "
                "so the two do not stack at full level."
            ),
            description="Four quick honey-colored tines. Ceramic, not a harsh coin shower.",
            builder=synth_coins,
            duration_bounds=(0.22, 0.90),
        ),
        Cue(
            key="order_complete",
            loop=False,
            channels=1,
            suggested_volume=0.70,
            when="Orders 1 through 5 are fulfilled. For order 6, play final_celebration instead of this.",
            description="Warm F–A–C chime with a soft F above it. About a second and a half.",
            builder=synth_order_complete,
            duration_bounds=(1.05, 1.90),
        ),
        Cue(
            key="unlock",
            loop=False,
            channels=1,
            suggested_volume=0.68,
            when="A new bed, machine, or recipe becomes available after an order.",
            description="A short rising F-major run, F G A C D F.",
            builder=synth_unlock,
            duration_bounds=(0.65, 1.70),
        ),
        Cue(
            key="final_celebration",
            loop=False,
            channels=1,
            suggested_volume=0.74,
            when="The sixth order (the Mixed Bouquet) is delivered, in place of order_complete. Then continue in the sandbox with the music still playing.",
            description="The order motif opened into a small phrase and a soft F-major chord. The longest celebratory cue.",
            builder=synth_final_celebration,
            duration_bounds=(2.6, 5.4),
        ),
        Cue(
            key="deliver",
            loop=False,
            channels=1,
            suggested_volume=0.48,
            target_lufs=-20.0,
            lufs_min=-23.5,
            lufs_max=-17.0,
            when="An item is accepted by the Packing Station. Skip it if several items arrive in the same moment and just play it once.",
            description="A short paper rustle, softer than build_remove. Included so packing has its own cue.",
            builder=synth_deliver,
            duration_bounds=(0.14, 0.45),
        ),
        Cue(
            key="music",
            loop=True,
            channels=2,
            suggested_volume=0.42,
            target_lufs=-18.0,
            lufs_min=-20.5,
            lufs_max=-16.0,
            when=(
                "The calm background loop, from the main menu through play and the sandbox after order 6. "
                "Honor the music toggle separately from sound effects. Fade it down while paused rather than cutting it. "
                "Loop the Ogg buffer; it is 90 seconds and seamless."
            ),
            description="Music-box lead and soft plucked harmony in F major, narrow stereo, 90 second seamless loop.",
            builder=synth_music,
            duration_bounds=(89.95, 90.05),
        ),
    ]


# ---------------------------------------------------------------------------
# Quality checks, encoding, manifest
# ---------------------------------------------------------------------------

@dataclass
class Rendered:
    cue: Cue
    audio: np.ndarray
    lufs: float
    peak_db: float
    true_peak_db: float
    dc: float
    seam: float
    duration: float


def _analyze(cue: Cue, audio: np.ndarray) -> Rendered:
    if not np.all(np.isfinite(audio)):
        raise RuntimeError(f"{cue.key} contains NaN or Inf")
    channels = _channels(audio)
    if len(channels) != cue.channels:
        raise RuntimeError(f"{cue.key} channel count {len(channels)} != {cue.channels}")
    peak = max(float(np.max(np.abs(ch))) for ch in channels)
    if peak >= 0.98:
        raise RuntimeError(f"{cue.key} clips at {peak:.4f}")
    dc = max(abs(float(np.mean(ch))) for ch in channels)
    # 5e-4 is about −66 dBFS. Endpoints are faded to zero, so this cannot click.
    if dc > 5e-4:
        raise RuntimeError(f"{cue.key} DC offset {dc:.6e}")
    seam = 0.0
    for ch in channels:
        if cue.loop:
            jump = abs(float(ch[0] - ch[-1]))
            seam = max(seam, jump)
            # A click is a kink, not a steep-but-smooth slope. Compare the
            # circular second difference at the join with the rest of the file.
            d2 = np.abs(np.diff(ch, n=2))
            join = abs(float(ch[1] - 2.0 * ch[0] + ch[-1]))
            typical = float(np.percentile(d2, 99.5))
            if join > max(2.5e-4, typical * 6.0):
                raise RuntimeError(
                    f"{cue.key} loop kink {join:.6e} vs typical {typical:.6e} (jump {jump:.6e})"
                )
        else:
            edge = max(abs(float(ch[0])), abs(float(ch[-1])))
            if edge > 1e-6:
                raise RuntimeError(f"{cue.key} endpoint is {edge:.6e}, expected silence")
            n = min(len(ch) // 4, max(2, int(0.002 * SR)))
            if peak > 0 and float(np.max(np.abs(ch[:n]))) > peak * 0.55:
                raise RuntimeError(f"{cue.key} rises too abruptly in the first 2 ms")
    duration = len(channels[0]) / SR
    lo, hi = cue.duration_bounds
    if not lo <= duration <= hi:
        raise RuntimeError(f"{cue.key} duration {duration:.3f}s outside {lo:.3f}-{hi:.3f}")
    lufs = integrated_lufs(audio, SR)
    if not cue.lufs_min <= lufs <= cue.lufs_max:
        raise RuntimeError(f"{cue.key} loudness {lufs:.2f} LUFS outside {cue.lufs_min:.1f}..{cue.lufs_max:.1f}")
    tp = true_peak(audio)
    if tp > 10 ** (-1.0 / 20.0):
        raise RuntimeError(f"{cue.key} true peak {20*np.log10(tp+1e-12):.2f} dBTP")
    return Rendered(
        cue=cue,
        audio=audio,
        lufs=lufs,
        peak_db=20.0 * np.log10(peak + 1e-12),
        true_peak_db=20.0 * np.log10(tp + 1e-12),
        dc=dc,
        seam=seam,
        duration=duration,
    )


def _write_wav(path: Path, audio: np.ndarray) -> None:
    data = np.clip(audio, -1.0, 1.0).astype(np.float32)
    wavfile.write(path, SR, data)


def _encode(wav_path: Path, ogg_path: Path, mp3_path: Path, channels: int, title: str) -> None:
    meta = [
        "-metadata", f"title={title}",
        "-metadata", "artist=Petalworks",
        "-metadata", "comment=Original synthesis for Petalworks. No third-party samples.",
    ]
    ac = str(channels)
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav_path), *meta,
         "-c:a", "libvorbis", "-q:a", "6", "-ar", str(SR), "-ac", ac, str(ogg_path)],
        check=True,
    )
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav_path), *meta,
         "-c:a", "libmp3lame", "-q:a", "2", "-ar", str(SR), "-ac", ac, str(mp3_path)],
        check=True,
    )


def _decode(path: Path, wav_path: Path) -> np.ndarray:
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(path), "-ar", str(SR), str(wav_path)],
        check=True,
    )
    rate, data = wavfile.read(wav_path)
    if rate != SR:
        raise RuntimeError(f"decoded rate {rate}")
    if data.dtype == np.int16:
        audio = data.astype(np.float64) / 32768.0
    elif data.dtype == np.int32:
        audio = data.astype(np.float64) / 2147483648.0
    else:
        audio = data.astype(np.float64)
    return audio


def _verify_encoded(cue: Cue, source: np.ndarray, encoded: np.ndarray, label: str) -> None:
    """Encoded files may gain a few decoder samples. Endpoints must stay quiet,
    and a loop must not grow a click louder than the source seam."""
    if encoded.ndim == 1:
        channels = [encoded]
    else:
        channels = [encoded[:, i] for i in range(encoded.shape[1])]
    peak = max(float(np.max(np.abs(ch))) for ch in channels)
    if peak >= 0.999:
        raise RuntimeError(f"{cue.key} {label} clips ({peak:.4f})")
    if cue.loop:
        for ch in channels:
            jump = abs(float(ch[0] - ch[-1]))
            # Vorbis/MP3 padding can put the true seam a few samples in.
            # Search a short window for the quietest join and also reject large steps.
            window = min(len(ch) // 8, int(0.02 * SR))
            head = np.max(np.abs(ch[:window]))
            tail = np.max(np.abs(ch[-window:]))
            if cue.key == "belt_tick":
                if head > 0.02 or tail > 0.02:
                    # The knock is near the start but not in the first samples;
                    # allow the known tick while requiring the file end to be quiet.
                    if tail > 0.01:
                        raise RuntimeError(f"{cue.key} {label} tail is not quiet ({tail:.4f})")
            elif jump > 0.05 and head > 0.2 and tail > 0.2:
                raise RuntimeError(f"{cue.key} {label} seam jump {jump:.4f}")
    else:
        for ch in channels:
            if abs(float(ch[0])) > 0.02 or abs(float(ch[-1])) > 0.02:
                raise RuntimeError(
                    f"{cue.key} {label} endpoint {ch[0]:.4f} / {ch[-1]:.4f}"
                )
    # Duration should stay close. MP3 padding of ~50 ms is tolerated; more is not.
    src_n = source.shape[0]
    enc_n = encoded.shape[0]
    if abs(enc_n - src_n) > int(0.08 * SR):
        raise RuntimeError(f"{cue.key} {label} length {enc_n} vs source {src_n}")


def _fmt_seconds(seconds: float) -> str:
    if seconds >= 10:
        return f"{seconds:.2f} s"
    return f"{seconds:.3f} s"


def write_license(path: Path) -> None:
    path.write_text(
        """# Audio license

Everything in `assets/audio/` was created for Petalworks.

The `.ogg` and `.mp3` files are original procedural synthesis, produced by
`_source/generate_audio.py` with NumPy and SciPy. No recordings, sample
libraries, downloaded clips, or copyrighted material were used. Regenerating
the set from that script (same seed) reproduces these files.

You may use, modify, and redistribute these sounds and the generator as part
of Petalworks. If the rest of the repository later adopts a license, these
files follow that license.

There is no attribution requirement for third parties, because there are no
third-party audio sources.
""",
        encoding="utf-8",
    )


def write_manifest(path: Path, rendered: list[Rendered]) -> None:
    lines: list[str] = []
    lines.append("# Petalworks audio manifest")
    lines.append("")
    lines.append("Semantic keys for the game to load. Prefer the `.ogg` file (Vorbis).")
    lines.append("The `.mp3` beside it is a fallback for decoders without Vorbis.")
    lines.append("")
    lines.append("All of this was synthesized for the project. See `LICENSE.md` and")
    lines.append("`_source/generate_audio.py`. Sample rate is 44100 Hz.")
    lines.append("Sound effects are mono. `music` is a narrow stereo pair.")
    lines.append("")
    lines.append("## How to play them")
    lines.append("")
    lines.append("- Unlock Web Audio on the first pointer or key gesture, then decode each")
    lines.append("  file once and reuse the `AudioBuffer`.")
    lines.append("- **Suggested volume** is a linear gain on top of the mastered file")
    lines.append("  (`1.0` plays it as mastered). The set is already quiet.")
    lines.append("- Most effects are mastered around **−18 LUFS** (K-weighted, ITU-R BS.1770),")
    lines.append("  with true peak at or below about −1.5 dBTP. A few cues are quieter on")
    lines.append("  purpose: hover, the belt cadence, and the machine loop.")
    lines.append("- Keep **one** instance of `music`, **one** of `machine_working`, and **one**")
    lines.append("  of `belt_tick`. One-shots may overlap; they are short.")
    lines.append("- Honor separate sound-effects and music toggles. Fade `music` down on pause.")
    lines.append("  Stop `machine_working` and `belt_tick` while paused.")
    lines.append("- Loop flags below refer to the source waveform. Loop the Ogg buffer.")
    lines.append("  MP3 frame padding can leave a few milliseconds of gap or pre-roll on some")
    lines.append("  decoders, so do not loop the MP3 if the Ogg decoded.")
    lines.append("- `docs/ASSET_SPECS.md` §11 sketched an earlier, shorter list at about −14 LUFS")
    lines.append("  and an ambient bed of birds and breeze. This set is mastered quieter, uses")
    lines.append("  the keys below, and uses a music-box loop instead of nature ambience so the")
    lines.append("  whole game shares one voice. Map the old filenames like this if a caller")
    lines.append("  still uses them:")
    lines.append("")
    lines.append("| Earlier name | Use |")
    lines.append("| --- | --- |")
    lines.append("| `ui_click` | `ui_click` |")
    lines.append("| `place` | `build_place` |")
    lines.append("| `rotate` | `build_rotate` |")
    lines.append("| `remove` | `build_remove` |")
    lines.append("| `invalid` | `ui_error` |")
    lines.append("| `pop` | `item_pop` |")
    lines.append("| `deliver` | `deliver` |")
    lines.append("| `order_complete` | `order_complete` |")
    lines.append("| `unlock` | `unlock` |")
    lines.append("| `ambient_garden` | `music` |")
    lines.append("")
    lines.append("## Cues")
    lines.append("")
    lines.append("| Key | Files | Duration | Loop | Loudness | Suggested volume |")
    lines.append("| --- | --- | --- | --- | --- | --- |")
    for item in rendered:
        cue = item.cue
        files = f"`{cue.key}.ogg`, `{cue.key}.mp3`"
        loop = "yes" if cue.loop else "no"
        lines.append(
            f"| `{cue.key}` | {files} | {_fmt_seconds(item.duration)} | {loop} | "
            f"{item.lufs:.1f} LUFS | {cue.suggested_volume:.2f} |"
        )
    lines.append("")
    for item in rendered:
        cue = item.cue
        lines.append(f"### `{cue.key}`")
        lines.append("")
        lines.append(f"- **Files:** `{cue.key}.ogg`, `{cue.key}.mp3`")
        lines.append(f"- **Duration:** {_fmt_seconds(item.duration)}")
        lines.append(f"- **Channels:** {cue.channels}")
        lines.append(f"- **Loop:** {'yes, seamless' if cue.loop else 'no'}")
        lines.append(f"- **Loudness:** {item.lufs:.1f} LUFS integrated")
        lines.append(f"- **Peak:** {item.peak_db:.1f} dBFS sample, {item.true_peak_db:.1f} dBTP")
        lines.append(f"- **Suggested volume:** {cue.suggested_volume:.2f}")
        lines.append(f"- **Character:** {cue.description}")
        lines.append(f"- **When to play:** {cue.when}")
        lines.append("")
    lines.append("## Measured seam and offset")
    lines.append("")
    lines.append("Checked on the float render before encoding. DC is the largest absolute")
    lines.append("channel mean. Seam is the absolute jump from the last sample to the first")
    lines.append("(loops only).")
    lines.append("")
    lines.append("| Key | DC | Seam |")
    lines.append("| --- | --- | --- |")
    for item in rendered:
        seam = "—" if not item.cue.loop else f"{item.seam:.2e}"
        lines.append(f"| `{item.cue.key}` | {item.dc:.2e} | {seam} |")
    lines.append("")
    lines.append("Regenerate with `python3 assets/audio/_source/generate_audio.py`.")
    lines.append("The seed is fixed, so the same script version produces the same audio.")
    lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def save_plots(directory: Path, rendered: list[Rendered]) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    directory.mkdir(parents=True, exist_ok=True)
    sfx = [item for item in rendered if item.cue.key != "music"]
    cols = 3
    rows = int(np.ceil(len(sfx) / cols))
    fig, axes = plt.subplots(rows, cols, figsize=(12, 2.2 * rows), squeeze=False)
    for ax, item in zip(axes.ravel(), sfx):
        y = item.audio if item.audio.ndim == 1 else item.audio[:, 0]
        x = np.arange(len(y)) / SR
        ax.plot(x, y, color="#657C58", lw=0.6)
        ax.set_title(f"{item.cue.key}  {item.lufs:.1f} LUFS", fontsize=9)
        ax.set_ylim(-1, 1)
        ax.set_xlim(0, x[-1] if len(x) else 1)
        ax.axhline(0, color="#39463B", lw=0.3)
    for ax in axes.ravel()[len(sfx) :]:
        ax.axis("off")
    fig.tight_layout()
    fig.savefig(directory / "sfx_waveforms.png", dpi=110)
    plt.close(fig)

    music = next(item for item in rendered if item.cue.key == "music")
    left = music.audio[:, 0]
    # Envelope over the whole piece.
    hop = SR // 20
    frames = left[: len(left) // hop * hop].reshape(-1, hop)
    env = np.sqrt(np.mean(frames**2, axis=1) + 1e-12)
    fig, ax = plt.subplots(figsize=(12, 3))
    ax.plot(np.arange(len(env)) * hop / SR, env, color="#D77F70", lw=0.8)
    ax.set_title("music RMS envelope (left)")
    ax.set_xlabel("seconds")
    fig.tight_layout()
    fig.savefig(directory / "music_envelope.png", dpi=110)
    plt.close(fig)

    join_n = int(0.03 * SR)
    joined = np.concatenate([left[-join_n:], left[:join_n]])
    fig, ax = plt.subplots(figsize=(12, 3))
    ax.plot(np.arange(len(joined)) / SR * 1000.0, joined, color="#39463B", lw=0.7)
    ax.axvline(join_n / SR * 1000.0, color="#D77F70", lw=0.8, label="loop point")
    ax.set_title("music loop join, 30 ms each side (left)")
    ax.set_xlabel("ms")
    ax.legend(frameon=False)
    fig.tight_layout()
    fig.savefig(directory / "music_seam.png", dpi=120)
    plt.close(fig)

    # Spectrograms of a few representative cues plus 12 s of music.
    choices = ["ui_click", "build_place", "item_pop", "order_complete", "flower_bloom", "blocked"]
    fig, axes = plt.subplots(2, 3, figsize=(12, 6))
    for ax, key in zip(axes.ravel(), choices):
        item = next(r for r in rendered if r.cue.key == key)
        y = item.audio if item.audio.ndim == 1 else item.audio[:, 0]
        ax.specgram(y, NFFT=512, Fs=SR, noverlap=256, cmap="magma")
        ax.set_title(key, fontsize=9)
        ax.set_ylim(0, 8000)
    fig.tight_layout()
    fig.savefig(directory / "sfx_spectrograms.png", dpi=110)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(12, 4))
    snippet = left[: 12 * SR]
    ax.specgram(snippet, NFFT=2048, Fs=SR, noverlap=1536, cmap="magma")
    ax.set_ylim(0, 6000)
    ax.set_title("music first 12 s")
    fig.tight_layout()
    fig.savefig(directory / "music_spectrogram.png", dpi=110)
    plt.close(fig)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate the Petalworks audio set")
    parser.add_argument("--plots", type=Path, default=None, help="Also write waveform QA plots")
    parser.add_argument("--only", nargs="*", default=None, help="Generate just these keys")
    args = parser.parse_args()

    _assert_k_weighting_reference()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    cues = catalog()
    if args.only:
        wanted = set(args.only)
        cues = [cue for cue in cues if cue.key in wanted]
        unknown = wanted - {cue.key for cue in cues}
        if unknown:
            raise SystemExit(f"unknown keys: {', '.join(sorted(unknown))}")

    rendered: list[Rendered] = []
    with tempfile.TemporaryDirectory(prefix="petal-audio-") as tmp:
        tmp_dir = Path(tmp)
        for cue in cues:
            print(f"synthesizing {cue.key}…", flush=True)
            audio = cue.builder(SR, rng_for(cue.key))
            audio = np.asarray(audio, dtype=np.float64)
            if cue.key == "belt_tick":
                pass
            elif cue.key == "machine_working":
                audio, _ = match_loudness(audio, SR, -22.0)
            elif cue.key == "music":
                pass
            else:
                # Per-cue fade and filter choices live with the cue via finish defaults,
                # with a few softer lowpasses for dull sounds.
                lp = 6800.0
                hp = 40.0
                fade_in = 0.005
                fade_out = 0.028
                if cue.key == "ui_error":
                    lp = 2400.0
                    fade_out = 0.04
                elif cue.key == "ui_hover":
                    lp = 3600.0
                    fade_in = 0.008
                    fade_out = 0.018
                elif cue.key == "blocked":
                    lp = 4200.0
                    fade_out = 0.04
                elif cue.key in {"build_place", "build_remove", "deliver"}:
                    lp = 5000.0
                elif cue.key == "final_celebration":
                    fade_out = 0.06
                audio = finish_oneshot(
                    audio,
                    SR,
                    target_lufs=cue.target_lufs if cue.target_lufs is not None else -18.0,
                    fade_in=fade_in,
                    fade_out=fade_out,
                    lp=lp,
                    hp=hp,
                )
            item = _analyze(cue, audio)
            rendered.append(item)
            print(
                f"  {item.duration:.3f}s  {item.lufs:.1f} LUFS  "
                f"peak {item.peak_db:.1f} dBFS  true {item.true_peak_db:.1f} dBTP  "
                f"dc {item.dc:.2e}  seam {item.seam:.2e}",
                flush=True,
            )
            wav_path = tmp_dir / f"{cue.key}.wav"
            _write_wav(wav_path, audio)
            ogg_path = OUT_DIR / f"{cue.key}.ogg"
            mp3_path = OUT_DIR / f"{cue.key}.mp3"
            _encode(wav_path, ogg_path, mp3_path, cue.channels, cue.key)
            ogg_audio = _decode(ogg_path, tmp_dir / f"{cue.key}.ogg.wav")
            mp3_audio = _decode(mp3_path, tmp_dir / f"{cue.key}.mp3.wav")
            _verify_encoded(cue, audio, ogg_audio, "ogg")
            _verify_encoded(cue, audio, mp3_audio, "mp3")

    if args.only is None:
        write_license(OUT_DIR / "LICENSE.md")
        write_manifest(OUT_DIR / "AUDIO_MANIFEST.md", rendered)
    if args.plots:
        save_plots(args.plots, rendered)
        print(f"plots in {args.plots}")
    print(f"wrote {len(rendered)} cues to {OUT_DIR}")


if __name__ == "__main__":
    main()
