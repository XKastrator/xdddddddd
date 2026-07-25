"""Author the MOLTEN CROWN scene backgrounds and the lobby tile as SVG.

Three scenes match the three round states (ART_BIBLE.md §5), so the player can
feel the state change without reading a word:

  base   — the Deepforge at rest: cold basalt, banked embers, a single anvil
  bonus  — Forge Fury: the same room stoked, brighter lava veins, rising heat haze
  super  — Molten Core: descent to the lava lake, the room itself is molten

Every scene is deliberately LOW CONTRAST in the centre so the board and HUD stay
readable on top of it (the background must never compete with the grid).

Also emits the lobby tile: one focal point (the crown), no small text, a palette
that stands apart from the usual red/gold and candy thumbnails (RESEARCH.md §7).

Output: assets/build/scene_*.html + lobby.html — rasterised by rasterize.mjs.
"""
from __future__ import annotations

from pathlib import Path

OUT = Path(__file__).resolve().parent / "build"
W = H = 1024                     # square: cover-fits portrait and landscape
TILE = 512                       # lobby tile


def sky(top: str, mid: str, bottom: str, glow: str, glow_op: float) -> str:
    """Cavern gradient plus the forge glow rising from the floor."""
    return f"""
  <defs>
    <linearGradient id="cav" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{top}"/>
      <stop offset="0.55" stop-color="{mid}"/>
      <stop offset="1" stop-color="{bottom}"/>
    </linearGradient>
    <radialGradient id="forgeglow" cx="0.5" cy="1.02" r="0.75">
      <stop offset="0" stop-color="{glow}" stop-opacity="{glow_op}"/>
      <stop offset="1" stop-color="{glow}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.75">
      <stop offset="0.45" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.72"/>
    </radialGradient>
    <filter id="blur18" x="-120%" y="-600%" width="340%" height="1300%">
      <feGaussianBlur stdDeviation="18"/></filter>
    <filter id="blur40" x="-120%" y="-400%" width="340%" height="900%">
      <feGaussianBlur stdDeviation="40"/></filter>
  </defs>
  <rect width="{W}" height="{H}" fill="url(#cav)"/>
  <rect width="{W}" height="{H}" fill="url(#forgeglow)"/>"""


def pillars(col: str, op: float) -> str:
    """Basalt columns framing the scene — keeps the centre clear for the board."""
    out = []
    for x, w in ((-10, 130), (110, 70), (824, 70), (904, 130)):
        out.append(f'<rect x="{x}" y="-20" width="{w}" height="{H + 40}" '
                   f'fill="{col}" opacity="{op}"/>')
        out.append(f'<rect x="{x}" y="-20" width="{max(6, w // 8)}" height="{H + 40}" '
                   f'fill="#ffffff" opacity="0.05"/>')
    return "".join(out)


def lava_cracks(seedpaths, col: str, op: float, width: int) -> str:
    """A molten seam: a wide blurred bloom, a hot amber body, a thin white core.

    Three passes are what sell "glowing lava" rather than "drawn line" — the
    bloom does the lighting, the core does the heat.
    """
    return "".join(
        f'<path d="{d}" stroke="{col}" stroke-width="{width * 2}" fill="none" '
        f'opacity="{op * 0.85}" stroke-linecap="round" filter="url(#blur18)"/>'
        f'<path d="{d}" stroke="#ff9a3c" stroke-width="{max(3, width // 2)}" fill="none" '
        f'opacity="{op}" stroke-linecap="round"/>'
        f'<path d="{d}" stroke="#ffe9b8" stroke-width="{max(1, width // 5)}" fill="none" '
        f'opacity="{op * 0.85}" stroke-linecap="round"/>'
        for d in seedpaths)


CRACKS_A = [
    "M0,880 C160,860 240,930 400,900 C560,872 640,940 1024,905",
    "M0,975 C200,950 300,1000 520,975 C740,950 860,1000 1024,972",
    "M120,820 C180,846 210,800 260,830",
]
CRACKS_B = CRACKS_A + [
    "M760,800 C820,830 860,790 930,822",
    "M0,760 C120,742 190,790 300,768",
]


def anvil(x: int, y: int, s: float, dark: str, rim: str) -> str:
    """Silhouetted anvil — the room's one recognisable prop."""
    body = ("M-70,40 L-46,-2 L-58,-10 L-30,-34 L58,-34 L70,-16 L34,-6 L44,40 Z")
    return (f'<g transform="translate({x},{y}) scale({s})">'
            f'<path d="{body}" fill="{dark}"/>'
            f'<path d="{body}" fill="none" stroke="{rim}" stroke-width="3" opacity="0.55"/>'
            f'<rect x="-52" y="40" width="104" height="26" rx="6" fill="{dark}"/>'
            f'</g>')


def embers(n: int, col: str, y0: int, seed: int = 3) -> str:
    """Static ember specks — cheap depth without animation cost."""
    import random
    r = random.Random(seed)
    out = []
    for _ in range(n):
        x, y = r.randint(0, W), r.randint(y0, H)
        rad = r.choice([2, 2, 3, 4])
        out.append(f'<circle cx="{x}" cy="{y}" r="{rad}" fill="{col}" '
                   f'opacity="{r.uniform(0.18, 0.6):.2f}"/>')
    return "".join(out)


# --------------------------------------------------------------------------- #
# These files are the FAR plane only.
#
# The room's architecture (pillars), its foreground (floor lip, anvil, chains)
# and the vignette are drawn as separate, independently-parallaxing planes by
# frontend/src/render/Background.ts. Baking them into this image would flatten
# the scene back into a single sheet of wallpaper and double the vignette.
#
# `pillars()` and `anvil()` are kept because the same silhouettes are reused by
# the lobby tile and by anyone regenerating a flat single-plane scene.
# --------------------------------------------------------------------------- #
def scene_base() -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}">
  {sky('#0a0806', '#140f0a', '#20130a', '#ff7a18', 0.30)}
  {lava_cracks(CRACKS_A, '#ff7a18', 0.55, 14)}
  {embers(46, '#ffb347', 520)}
</svg>"""


def scene_bonus() -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}">
  {sky('#120a05', '#25130a', '#3a1c08', '#ff7a18', 0.55)}
  {lava_cracks(CRACKS_B, '#ff8c22', 0.8, 18)}
  <ellipse cx="512" cy="1010" rx="470" ry="130" fill="#ff9a3c" opacity="0.35"
           filter="url(#blur40)"/>
  {embers(90, '#ffcf8a', 380)}
</svg>"""


def scene_super() -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}">
  {sky('#1b0d05', '#3d1a07', '#7a2f05', '#ffb347', 0.75)}
  <ellipse cx="512" cy="1000" rx="520" ry="180" fill="#ff9a3c" opacity="0.55"
           filter="url(#blur40)"/>
  <ellipse cx="512" cy="1020" rx="360" ry="120" fill="#fff0c0" opacity="0.45"
           filter="url(#blur40)"/>
  {lava_cracks(CRACKS_B, '#ffc46a', 0.95, 22)}
  {embers(140, '#ffe3ab', 240)}
</svg>"""


def lobby_tile() -> str:
    """One focal point (the crown), no small text, amber-on-basalt + teal accent."""
    T = TILE
    crown = ("M64,320 L88,150 L146,224 L208,100 L270,224 L328,150 L352,320 "
             "C352,338 340,348 322,348 L94,348 C76,348 64,338 64,320 Z")
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{T}" height="{T}">
  <defs>
    <radialGradient id="bgt" cx="0.5" cy="0.62" r="0.8">
      <stop offset="0" stop-color="#3a1c08"/><stop offset="0.6" stop-color="#140d07"/>
      <stop offset="1" stop-color="#080605"/>
    </radialGradient>
    <linearGradient id="crg" x1="0" y1="0" x2="0.25" y2="1">
      <stop offset="0" stop-color="#fff6d0"/><stop offset="0.35" stop-color="#ffd76b"/>
      <stop offset="0.72" stop-color="#ff7a18"/><stop offset="1" stop-color="#8f2d00"/>
    </linearGradient>
    <filter id="g1"><feGaussianBlur stdDeviation="26"/></filter>
    <filter id="g2"><feGaussianBlur stdDeviation="9"/></filter>
  </defs>
  <rect width="{T}" height="{T}" fill="url(#bgt)"/>
  <ellipse cx="256" cy="392" rx="215" ry="66" fill="#ff7a18" opacity="0.5" filter="url(#g1)"/>
  <g transform="translate(50,52) scale(0.86)">
    <g filter="url(#g2)" opacity="0.95"><path d="{crown}" fill="#ff9a3c"/></g>
    <path d="{crown}" fill="url(#crg)" stroke="#ffd98a" stroke-width="6"/>
    <circle cx="146" cy="196" r="15" fill="#fff6d0"/>
    <circle cx="208" cy="150" r="19" fill="#fff6d0"/>
    <circle cx="270" cy="196" r="15" fill="#fff6d0"/>
  </g>
  <path d="M108,432 C180,412 332,412 404,432" stroke="#37e0c8" stroke-width="7"
        fill="none" opacity="0.85" stroke-linecap="round"/>
</svg>"""


def page(svg: str, w: int, h: int) -> str:
    return ("<!doctype html><meta charset='utf-8'>"
            "<style>html,body{margin:0;padding:0;background:#000}"
            f"svg{{display:block;width:{w}px;height:{h}px}}</style>{svg}")


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, svg in (("scene_base", scene_base()), ("scene_bonus", scene_bonus()),
                      ("scene_super", scene_super())):
        (OUT / f"{name}.html").write_text(page(svg, W, H))
    (OUT / "lobby.html").write_text(page(lobby_tile(), TILE, TILE))
    print(f"scenes: 3 x {W}x{H} + lobby {TILE}x{TILE} -> {OUT}")


if __name__ == "__main__":
    build()
