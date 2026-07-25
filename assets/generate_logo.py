"""Author the MOLTEN CROWN wordmark as a real image asset.

A slot's title is not a line of HUD text set in the body face — it is a piece of
artwork with its own weight, bevel and light. Rendering it from the same glyph
skeletons as the display face (generate_font.py) keeps the family consistent
while letting the logo carry treatment the HUD never should: a wide cut edge, a
molten gradient body, a rim bloom, and metal cooling into drips.

Construction, back to front:

    bloom      wide blurred amber behind the whole lockup
    cut        very wide dark stroke  -> the letter is carved out of the dark
    body       molten gradient stroke -> the face
    core       thin white stroke      -> light along the top-left bevel
    drips      metal running off the lower terminals of CROWN

Output: assets/build/logo.html -> rasterize.mjs -> logo.png (transparent)
"""
from __future__ import annotations

from pathlib import Path

from generate_font import G, advance

OUT = Path(__file__).resolve().parent / "build"
W, H = 1024, 540

# stroke weights in GRID units, matching generate_font.py's proportions so the
# wordmark reads as the same typeface, just cut heavier
CUT, BODY, CORE = 2.6, 1.5, 0.42

CROWN_MARK = ("M64,320 L88,150 L146,224 L208,100 L270,224 L328,150 L352,320 "
              "C352,338 340,348 322,348 L94,348 C76,348 64,338 64,320 Z")


def defs() -> str:
    return """
<defs>
  <linearGradient id="lgMolten" x1="0" y1="0" x2="0.18" y2="1">
    <stop offset="0" stop-color="#fffbe8"/>
    <stop offset="0.22" stop-color="#ffe08a"/>
    <stop offset="0.48" stop-color="#ffb347"/>
    <stop offset="0.74" stop-color="#ff7a18"/>
    <stop offset="1" stop-color="#8f2d00"/>
  </linearGradient>
  <linearGradient id="lgSub" x1="0" y1="0" x2="0.1" y2="1">
    <stop offset="0" stop-color="#ffe9c2"/>
    <stop offset="0.55" stop-color="#ffb347"/>
    <stop offset="1" stop-color="#c25200"/>
  </linearGradient>
  <linearGradient id="lgCrown" x1="0" y1="0" x2="0.25" y2="1">
    <stop offset="0" stop-color="#fff6d0"/><stop offset="0.35" stop-color="#ffd76b"/>
    <stop offset="0.72" stop-color="#ff7a18"/><stop offset="1" stop-color="#8f2d00"/>
  </linearGradient>
  <!-- The lockup's glow is a radial GRADIENT, not a blur filter.
       Blurring letterforms this heavy produces near-solid coverage, and the
       filter region then clips it into a visible pale rectangle behind the
       wordmark. A gradient has no region to clip. -->
  <radialGradient id="lglow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#ff7a18" stop-opacity="0.42"/>
    <stop offset="0.45" stop-color="#ff7a18" stop-opacity="0.16"/>
    <stop offset="1" stop-color="#ff7a18" stop-opacity="0"/>
  </radialGradient>
  <filter id="lbloomS" x="-120%" y="-120%" width="340%" height="340%">
    <feGaussianBlur stdDeviation="5"/></filter>
</defs>"""


def word_paths(text: str, tracking: float) -> tuple[str, float]:
    """Concatenated skeleton path for `text`, plus its width in GRID units.

    `tracking` is extra advance per letter, also in grid units, so the caller can
    letter-space the lockup without the strokes changing weight.
    """
    parts: list[str] = []
    x = 0.0
    for ch in text:
        strokes = G.get(ch)
        if strokes is None:
            x += 2.4 + tracking
            continue
        for pts in strokes:
            parts.append(" ".join(
                f"{'M' if i == 0 else 'L'}{px + x:.2f},{py:.2f}"
                for i, (px, py) in enumerate(pts)))
        x += advance(ch) + tracking
    return " ".join(parts), max(0.0, x - tracking)


def word(text: str, cap_px: float, cx: float, baseline_y: float,
         grad: str, tracking: float) -> tuple[str, float]:
    """Place one word centred on `cx` with its baseline on `baseline_y`.

    Returns the markup and the word's rendered width in px, so callers can hang
    drips off the real letters instead of guessing at offsets.
    """
    scale = cap_px / 8.6                      # grid cap height is 0.8..9.4
    d, grid_w = word_paths(text, tracking)
    px_w = grid_w * scale
    x0 = cx - px_w / 2
    y0 = baseline_y - 9.4 * scale
    common = 'fill="none" stroke-linecap="round" stroke-linejoin="round"'
    svg = f"""
<g transform="translate({x0:.2f},{y0:.2f}) scale({scale:.4f})">
  <path d="{d}" {common} stroke="#1a0d04" stroke-width="{CUT:.2f}"/>
  <path d="{d}" {common} stroke="url(#{grad})" stroke-width="{BODY:.2f}"/>
  <path d="{d}" {common} stroke="#fff6e2" stroke-width="{CORE:.2f}"
        transform="translate(-0.18,-0.22)" opacity="0.9"/>
</g>"""
    return svg, px_w


def drips(cx: float, word_w: float, baseline_y: float, cap_px: float) -> str:
    """Metal running off the wordmark — the one thing that says 'molten'.

    Drawn AFTER the letters so the runs read as metal leaving the type, and
    positioned as fractions of the word's measured width so they always land
    under actual letterforms.
    """
    out = []
    for frac, length, r in ((-0.33, 0.22, 7.0), (-0.08, 0.40, 9.0),
                            (0.18, 0.16, 6.0), (0.35, 0.30, 7.5)):
        x = cx + frac * word_w
        # begin above the baseline so the run emerges from behind the letters
        y = baseline_y - cap_px * 0.10
        ln = length * cap_px + cap_px * 0.10
        # NOTE: solid strokes, not `lgMolten`. An objectBoundingBox gradient on a
        # perfectly vertical line has a zero-width box and renders nothing —
        # which is exactly why the first pass showed detached droplets with no
        # runs attached to them.
        out.append(
            f'<path d="M{x:.1f},{y:.1f} L{x:.1f},{y + ln:.1f}" stroke="#ff7a18" '
            f'stroke-width="{r * 2.4:.1f}" stroke-linecap="round" fill="none" '
            f'opacity="0.45" filter="url(#lbloomS)"/>'
            f'<path d="M{x:.1f},{y:.1f} L{x:.1f},{y + ln:.1f}" stroke="#d95b00" '
            f'stroke-width="{r:.1f}" stroke-linecap="round" fill="none"/>'
            f'<path d="M{x - r * 0.22:.1f},{y:.1f} L{x - r * 0.22:.1f},'
            f'{y + ln - r * 0.5:.1f}" stroke="#ffc069" '
            f'stroke-width="{r * 0.42:.1f}" stroke-linecap="round" fill="none"/>'
            f'<circle cx="{x:.1f}" cy="{y + ln:.1f}" r="{r * 1.05:.1f}" fill="#ff9422"/>'
            f'<circle cx="{x - r * 0.2:.1f}" cy="{y + ln - r * 0.34:.1f}" '
            f'r="{r * 0.42:.1f}" fill="#fff6e2" opacity="0.9"/>')
    return "".join(out)


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    cx = W / 2

    # the crown mark sits above the lockup, scaled from its 416-unit design box
    # (its ink starts at y=58, so the translate pulls that up to the top margin)
    mark_scale = 0.42
    mark_w = 416 * mark_scale
    mark = (f'<g transform="translate({cx - mark_w / 2:.1f},{8 - 58 * mark_scale:.1f}) '
            f'scale({mark_scale})">'
            f'<g filter="url(#lbloomS)" opacity="0.9">'
            f'<path d="{CROWN_MARK}" fill="#ff9a3c"/></g>'
            f'<path d="{CROWN_MARK}" fill="url(#lgCrown)" stroke="#ffd98a" '
            f'stroke-width="7"/>'
            f'<circle cx="146" cy="196" r="15" fill="#fff6d0"/>'
            f'<circle cx="208" cy="150" r="19" fill="#fff6d0"/>'
            f'<circle cx="270" cy="196" r="15" fill="#fff6d0"/>'
            f'</g>')

    sub, _ = word('MOLTEN', 54, cx, 232, 'lgSub', 2.2)
    main, main_w = word('CROWN', 162, cx, 420, 'lgMolten', 1.1)
    rule_w = main_w * 0.52

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}">
  {defs()}
  <ellipse cx="{cx}" cy="330" rx="{main_w * 0.78:.0f}" ry="215" fill="url(#lglow)"/>
  {mark}
  {sub}
  {drips(cx, main_w, 420, 162)}
  {main}
  <path d="M{cx - rule_w:.0f},508 C{cx - rule_w * 0.5:.0f},492
           {cx + rule_w * 0.5:.0f},492 {cx + rule_w:.0f},508"
        stroke="#37e0c8" stroke-width="7" fill="none" opacity="0.8"
        stroke-linecap="round"/>
</svg>"""

    (OUT / "logo.html").write_text(
        "<!doctype html><meta charset='utf-8'>"
        "<style>html,body{margin:0;padding:0;background:transparent}"
        f"svg{{display:block;width:{W}px;height:{H}px}}</style>{svg}")
    print(f"logo: {W}x{H} -> {OUT}")


if __name__ == "__main__":
    build()
