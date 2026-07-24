"""Synthesize the MOLTEN CROWN audio set and encode it as OGG Vorbis.

Every sound is generated from scratch with numpy (no samples used), following
the layer plan in ART_BIBLE.md §10:

  beds   : base / bonus / super ambience — seamless loops, layered drones
  sfx    : spin, forge clank, heat tick, cinder teaser, retrigger
  stings : bonus start, super start, pour, big win, max win

Design notes
  * The forge clank is filtered noise with a metallic resonant bank, so it reads
    as struck metal rather than a beep.
  * Beds loop seamlessly: every partial completes a whole number of cycles over
    the loop length, so start and end phases match exactly.
  * Everything is mono 32 kHz — plenty for these textures and small over the wire.

    python3 assets/generate_audio.py
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import soundfile as sf

SR = 32000
OUT = Path(__file__).resolve().parents[1] / "frontend" / "public" / "assets" / "audio"
rng = np.random.default_rng(11)


# --- helpers -----------------------------------------------------------------
def t_axis(dur: float) -> np.ndarray:
    return np.linspace(0, dur, int(SR * dur), endpoint=False)


def adsr(n: int, a=0.005, d=0.08, s=0.35, r=0.3) -> np.ndarray:
    """Simple ADSR envelope over n samples (times in seconds)."""
    A, D, R = int(SR * a), int(SR * d), int(SR * r)
    S = max(0, n - A - D - R)
    return np.concatenate([
        np.linspace(0, 1, A, endpoint=False) if A else np.array([]),
        np.linspace(1, s, D, endpoint=False) if D else np.array([]),
        np.full(S, s),
        np.linspace(s, 0, R) if R else np.array([]),
    ])[:n]


def decay(n: int, k: float) -> np.ndarray:
    return np.exp(-k * np.linspace(0, 1, n))


def resonator(x: np.ndarray, freq: float, q: float, gain: float) -> np.ndarray:
    """Two-pole resonant band-pass — gives noise a struck-metal ring."""
    w = 2 * np.pi * freq / SR
    r = np.exp(-w / (2 * q))
    a1, a2 = -2 * r * np.cos(w), r * r
    y = np.zeros_like(x)
    for i in range(2, len(x)):
        y[i] = x[i] - a1 * y[i - 1] - a2 * y[i - 2]
    return y * gain


def mix(base: np.ndarray, layer: np.ndarray, at: float = 0.0, gain: float = 1.0) -> np.ndarray:
    """Add `layer` into `base` starting at `at` seconds, clipping to base length."""
    start = int(SR * at)
    end = min(len(base), start + len(layer))
    if start < len(base):
        base[start:end] += layer[:end - start] * gain
    return base


def normalize(x: np.ndarray, peak=0.85) -> np.ndarray:
    m = np.max(np.abs(x))
    return x * (peak / m) if m > 0 else x


def save(name: str, x: np.ndarray, quality=0.5) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / f"{name}.ogg"
    sf.write(p, normalize(x).astype(np.float32), SR, format="OGG", subtype="VORBIS")
    print(f"  {name}.ogg  {p.stat().st_size / 1024:6.1f} kB  {len(x) / SR:.2f}s")


# --- looping beds -------------------------------------------------------------
def bed(dur: float, root: float, partials, noise_lvl: float, wobble: float) -> np.ndarray:
    """Seamless drone: each partial completes whole cycles across the loop."""
    t = t_axis(dur)
    out = np.zeros_like(t)
    for mult, amp in partials:
        f = root * mult
        cycles = max(1, round(f * dur))           # snap to whole cycles => seamless
        out += amp * np.sin(2 * np.pi * cycles * t / dur)
    # slow breathing, also whole-cycle so it loops
    out *= 1.0 + wobble * np.sin(2 * np.pi * 2 * t / dur)
    if noise_lvl:
        n = rng.normal(0, 1, len(t))
        # crossfade the noise with itself so the seam is inaudible
        half = len(t) // 2
        fade = np.linspace(0, 1, half)
        n[:half] = n[:half] * (1 - fade) + n[half:half * 2][::-1] * fade
        out += noise_lvl * resonator(n, root * 6, 3.0, 0.35)
    return out


def make_beds() -> None:
    print("beds:")
    # base: deep, patient forge room
    save("bed_base", bed(8.0, 55.0, [(1, 0.55), (1.5, 0.22), (2, 0.16), (3, 0.07)],
                         noise_lvl=0.30, wobble=0.10) * 0.9)
    # bonus: same room, hotter — brighter partials and more air
    save("bed_bonus", bed(8.0, 65.4, [(1, 0.5), (1.5, 0.26), (2, 0.2), (3, 0.12), (4, 0.06)],
                          noise_lvl=0.42, wobble=0.14))
    # super: the core — a fifth below plus a bright shimmer
    save("bed_super", bed(8.0, 43.7, [(1, 0.6), (2, 0.24), (3, 0.16), (4.5, 0.1), (6, 0.06)],
                          noise_lvl=0.5, wobble=0.18))


# --- one-shots ----------------------------------------------------------------
def clank(dur=0.42, bright=1.0) -> np.ndarray:
    """Struck metal: noise burst through a bank of metallic resonators."""
    n = int(SR * dur)
    exc = rng.normal(0, 1, n) * decay(n, 55)          # short percussive excitation
    modes = [(430, 26, 1.0), (712, 30, 0.75), (1183, 34, 0.55),
             (1970, 30, 0.35), (3120, 26, 0.22)]
    y = np.zeros(n)
    for f, q, g in modes:
        y += resonator(exc, f * bright, q, g)
    y *= decay(n, 6.5)
    y += 0.25 * rng.normal(0, 1, n) * decay(n, 90)    # initial transient bite
    return y


def ping(dur=0.30, f0=880.0, f1=1500.0) -> np.ndarray:
    """Rising tick used for the Heat counter."""
    t = t_axis(dur)
    f = np.linspace(f0, f1, len(t))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR)
    y += 0.35 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    return y * decay(len(t), 6)


def chord(freqs, dur=1.6, spread=0.06, shimmer=True) -> np.ndarray:
    """Bell-ish stacked partials with a slight arpeggio spread."""
    n = int(SR * dur)
    y = np.zeros(n)
    for i, f in enumerate(freqs):
        off = int(SR * spread * i)
        seg = n - off
        t = t_axis(seg / SR)
        v = (np.sin(2 * np.pi * f * t)
             + 0.5 * np.sin(2 * np.pi * f * 2 * t)
             + 0.25 * np.sin(2 * np.pi * f * 3.01 * t))
        v *= decay(seg, 3.2)
        y[off:off + seg] += v
    if shimmer:
        y += 0.08 * rng.normal(0, 1, n) * decay(n, 5)
    return y


def whoosh(dur=0.55) -> np.ndarray:
    """Air/steam for the spin."""
    n = int(SR * dur)
    x = rng.normal(0, 1, n)
    y = resonator(x, 500, 1.2, 0.8) + 0.4 * resonator(x, 1400, 1.5, 0.5)
    return y * np.sin(np.pi * np.linspace(0, 1, n)) ** 1.5


def rumble(dur=2.4) -> np.ndarray:
    """Lava pour: swelling low noise + descending groan."""
    n = int(SR * dur)
    t = t_axis(dur)
    swell = np.sin(np.pi * np.linspace(0, 1, n)) ** 1.2
    low = resonator(rng.normal(0, 1, n), 70, 2.0, 1.0)
    mid = resonator(rng.normal(0, 1, n), 240, 1.5, 0.5)
    groan = np.sin(2 * np.pi * np.cumsum(np.linspace(150, 60, n)) / SR) * 0.4
    return (low + mid + groan) * swell * (1 + 0.3 * np.sin(2 * np.pi * 3 * t))


def make_sfx() -> None:
    print("sfx:")
    save("sfx_spin", whoosh() * 0.8)
    save("sfx_forge", clank())
    save("sfx_forge_big", clank(0.7, bright=0.82) * 1.1)   # bigger rank jump
    save("sfx_heat", ping())
    save("sfx_cinder", chord([784, 1046.5], dur=0.7, spread=0.04) * 0.8)
    save("sfx_retrigger", chord([659.3, 880, 1174.7], dur=1.0, spread=0.05))


def make_stings() -> None:
    print("stingers:")
    # bonus: bright major triad struck by a hammer blow
    b = chord([261.6, 329.6, 392.0, 523.3], dur=2.0)
    save("sting_bonus", mix(b, clank(0.42), at=0.0, gain=0.8))

    # super: darker, wider — root, fifth, octave over a low drop
    s = chord([130.8, 196.0, 261.6, 392.0], dur=2.6, spread=0.09)
    save("sting_super", mix(s, rumble(1.6), at=0.0, gain=0.5))

    # pour: the culmination — rumble first, resolving chord underneath
    p = rumble(2.4)
    save("sting_pour", mix(p, chord([98, 147, 196], dur=1.6), at=0.6, gain=0.6))

    save("sting_bigwin", chord([392, 523.3, 659.3, 784], dur=2.0, spread=0.05))

    # max win: full bell chorus, longest tail
    m = chord([523.3, 659.3, 784.0, 1046.5, 1318.5], dur=3.4, spread=0.08)
    save("sting_maxwin", mix(m, clank(0.7, bright=0.9), at=0.0, gain=0.6))


if __name__ == "__main__":
    make_beds()
    make_sfx()
    make_stings()
    total = sum(f.stat().st_size for f in OUT.glob("*.ogg"))
    print(f"\ntotal audio: {total / 1024:.0f} kB in {len(list(OUT.glob('*.ogg')))} files -> {OUT}")
