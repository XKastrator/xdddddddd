"""Author the MOLTEN CROWN symbol art as layered SVG illustration.

This is not "a polygon with a numeral". Every symbol is built from stacked
passes that together read as a forged object:

    bloom      soft emissive halo (rank-scaled)
    shadow     contact shadow so the piece sits in the cell
    body       the silhouette, filled with a directional metal gradient
    inset      a darker inner plate -> thickness / bevel
    ornament   engraving, rivets, hatching, molten seams
    specular   a diagonal light sweep across the upper-left
    rim        emissive edge catching the forge glow
    numeral    engraved rank mark (relics only)

Ore stays deliberately matte and unlit (it is fuel, it pays nothing); relics
gain bloom, specular and ornament as rank climbs, so the ladder is legible
peripherally and never depends on colour alone.

Output: assets/build/atlas.html -> rasterize.mjs -> atlas.png + atlas.json
"""
from __future__ import annotations

import json
from pathlib import Path

CELL = 256
COLS = 4
OUT = Path(__file__).resolve().parent / "build"

AMBER, AMBER2, TEAL, GOLD = "#ff7a18", "#ffb347", "#37e0c8", "#f2c14e"


def defs() -> str:
    return f"""
<defs>
  <!-- Halo as a radial gradient: smooth (no 8-bit ring banding from a wide
       blur on an opaque fill) and bounded so it cannot bleed into the
       neighbouring atlas cell. -->
  <radialGradient id="haloAmber" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#ff9a3c" stop-opacity="0.85"/>
    <stop offset="0.45" stop-color="#ff7a18" stop-opacity="0.38"/>
    <stop offset="1" stop-color="#ff7a18" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="haloTeal" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#7ff5e2" stop-opacity="0.8"/>
    <stop offset="0.45" stop-color="#37e0c8" stop-opacity="0.34"/>
    <stop offset="1" stop-color="#37e0c8" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="haloWhite" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#ffffff" stop-opacity="0.7"/>
    <stop offset="0.45" stop-color="#ffe9b8" stop-opacity="0.28"/>
    <stop offset="1" stop-color="#ffe9b8" stop-opacity="0"/>
  </radialGradient>
  <filter id="glowTight" x="-35%" y="-35%" width="170%" height="170%">
    <feGaussianBlur stdDeviation="7"/></filter>
  <filter id="glowWide" x="-45%" y="-45%" width="190%" height="190%">
    <feGaussianBlur stdDeviation="12"/></filter>
  <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="9"/></filter>

  <!-- metal gradients: light from upper-left, deep falloff bottom-right -->
  <linearGradient id="gBronze" x1="0.1" y1="0" x2="0.75" y2="1">
    <stop offset="0" stop-color="#f0cf9c"/><stop offset="0.3" stop-color="#c39a63"/>
    <stop offset="0.62" stop-color="#8d6b3c"/><stop offset="1" stop-color="#4a3418"/>
  </linearGradient>
  <linearGradient id="gIron" x1="0.1" y1="0" x2="0.75" y2="1">
    <stop offset="0" stop-color="#f2f6f9"/><stop offset="0.32" stop-color="#b3bcc3"/>
    <stop offset="0.62" stop-color="#78838c"/><stop offset="1" stop-color="#39424a"/>
  </linearGradient>
  <linearGradient id="gSilver" x1="0.1" y1="0" x2="0.75" y2="1">
    <stop offset="0" stop-color="#ffffff"/><stop offset="0.28" stop-color="#e4ebf1"/>
    <stop offset="0.58" stop-color="#a9b5bf"/><stop offset="1" stop-color="#5d6873"/>
  </linearGradient>
  <linearGradient id="gGold" x1="0.1" y1="0" x2="0.75" y2="1">
    <stop offset="0" stop-color="#fff8d8"/><stop offset="0.28" stop-color="#ffd868"/>
    <stop offset="0.6" stop-color="#d19a24"/><stop offset="1" stop-color="#6f4a0c"/>
  </linearGradient>
  <linearGradient id="gMythril" x1="0.1" y1="0" x2="0.75" y2="1">
    <stop offset="0" stop-color="#f2fffc"/><stop offset="0.28" stop-color="#8ff0da"/>
    <stop offset="0.6" stop-color="#35b39b"/><stop offset="1" stop-color="#0d5548"/>
  </linearGradient>
  <linearGradient id="gCrown" x1="0.1" y1="0" x2="0.7" y2="1">
    <stop offset="0" stop-color="#fffbe8"/><stop offset="0.24" stop-color="#ffe08a"/>
    <stop offset="0.55" stop-color="#ff9422"/><stop offset="0.82" stop-color="#e0490a"/>
    <stop offset="1" stop-color="#6d1d00"/>
  </linearGradient>
  <radialGradient id="gFlux" cx="0.38" cy="0.32" r="0.78">
    <stop offset="0" stop-color="#f2fffd"/><stop offset="0.22" stop-color="#7ff5e2"/>
    <stop offset="0.6" stop-color="#1fae9a"/><stop offset="1" stop-color="#04241f"/>
  </radialGradient>
  <radialGradient id="gCinder" cx="0.4" cy="0.34" r="0.72">
    <stop offset="0" stop-color="#fffdf2"/><stop offset="0.2" stop-color="#ffe3a0"/>
    <stop offset="0.55" stop-color="#ff9422"/><stop offset="1" stop-color="#5c1f04"/>
  </radialGradient>

  <!-- specular sweep: a soft diagonal band of light -->
  <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ffffff" stop-opacity="0"/>
    <stop offset="0.34" stop-color="#ffffff" stop-opacity="0.55"/>
    <stop offset="0.52" stop-color="#ffffff" stop-opacity="0.12"/>
    <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="innerShade" x1="0.2" y1="0" x2="0.8" y2="1">
    <stop offset="0" stop-color="#000000" stop-opacity="0.02"/>
    <stop offset="1" stop-color="#000000" stop-opacity="0.42"/>
  </linearGradient>

  <!-- rough rock texture for ore -->
  <filter id="rock" x="-20%" y="-20%" width="140%" height="140%">
    <feTurbulence type="fractalNoise" baseFrequency="0.055" numOctaves="4" seed="9"
                  result="n"/>
    <feDiffuseLighting in="n" lighting-color="#ffffff" surfaceScale="2.6" result="l">
      <feDistantLight azimuth="215" elevation="58"/>
    </feDiffuseLighting>
    <feComposite in="l" in2="SourceGraphic" operator="in"/>
    <feBlend in2="SourceGraphic" mode="multiply"/>
  </filter>
</defs>"""


# --------------------------------------------------------------------------- #
# ORE — matte, rough, faceted rock. No bloom, no specular: it is fuel.
# --------------------------------------------------------------------------- #
ORE_SHAPES = {
    "shard":  "M128,26 L212,88 L188,214 L70,214 L44,88 Z",
    "cube":   "M128,30 L216,78 L216,178 L128,228 L40,178 L40,78 Z",
    "rhomb":  "M128,24 L224,128 L128,232 L32,128 Z",
    "hex":    "M128,28 L210,66 L226,160 L128,226 L30,160 L46,66 Z",
    "nodule": ("M128,30 C192,26 228,74 226,132 C224,196 178,228 124,228 "
               "C68,228 32,190 30,130 C28,72 68,34 128,30 Z"),
}
ORE_FACETS = {
    "shard":  ["M128,26 L212,88 L128,124 Z", "M44,88 L128,124 L70,214 Z"],
    "cube":   ["M128,30 L216,78 L128,128 L40,78 Z", "M40,78 L128,128 L128,228 L40,178 Z"],
    "rhomb":  ["M128,24 L224,128 L128,140 Z", "M32,128 L128,140 L128,232 Z"],
    "hex":    ["M128,28 L210,66 L128,120 L46,66 Z", "M46,66 L128,120 L30,160 Z"],
    "nodule": ["M128,30 C192,26 228,74 226,132 C186,92 156,74 128,30 Z"],
}


def ore(shape: str, base: str, light: str, dark: str, seed: int) -> str:
    body = ORE_SHAPES[shape]
    facets = "".join(
        f'<path d="{f}" fill="{light}" opacity="{0.30 - i * 0.09:.2f}"/>'
        for i, f in enumerate(ORE_FACETS[shape]))
    # chipped edges: short strokes along the silhouette
    return f"""
<g>
  <g filter="url(#softShadow)" opacity="0.55">
    <path d="{body}" fill="#000000" transform="translate(4,8)"/>
  </g>
  <path d="{body}" fill="{base}"/>
  <g clip-path="url(#clip{seed})">
    <path d="{body}" fill="{base}" filter="url(#rock)" opacity="0.92"/>
  </g>
  {facets}
  <path d="{body}" fill="url(#innerShade)"/>
  <path d="{body}" fill="none" stroke="{dark}" stroke-width="7" stroke-linejoin="round"/>
  <path d="{body}" fill="none" stroke="{light}" stroke-width="2.5"
        stroke-linejoin="round" opacity="0.34"/>
</g>"""


def ore_clip(shape: str, seed: int) -> str:
    return f'<clipPath id="clip{seed}"><path d="{ORE_SHAPES[shape]}"/></clipPath>'


# --------------------------------------------------------------------------- #
# RELICS — layered forged metal.
# --------------------------------------------------------------------------- #
def relic(body: str, grad: str, rim: str, numeral: str, glow: float,
          ornament: str = "", nx: int = 128, ny: int = 172,
          inset: str | None = None, halo: str = "haloWhite") -> str:
    """Stack: halo -> shadow -> body -> inset plate -> ornament -> sweep -> rim."""
    inset_path = inset or body
    # glow hugs the silhouette and stays inside the 256 cell
    return f"""
<g>
  <g filter="url(#{halo})" opacity="{glow:.2f}"><path d="{body}" fill="{rim}"/></g>
  <g filter="url(#softShadow)" opacity="0.5">
    <path d="{body}" fill="#000000" transform="translate(3,7)"/>
  </g>
  <path d="{body}" fill="url(#{grad})"/>
  <g opacity="0.55">
    <path d="{inset_path}" fill="none" stroke="#000000" stroke-width="9"
          transform="translate(0,3) scale(0.94)"
          transform-origin="128 128" opacity="0.30"/>
  </g>
  {ornament}
  <path d="{body}" fill="url(#sweep)" opacity="0.85"/>
  <path d="{body}" fill="none" stroke="{rim}" stroke-width="6" stroke-linejoin="round"/>
  <path d="{body}" fill="none" stroke="#ffffff" stroke-width="2"
        stroke-linejoin="round" opacity="0.55"/>
  <text x="{nx}" y="{ny}" font-family="Georgia,'Times New Roman',serif" font-size="60"
        font-weight="700" text-anchor="middle" fill="#120a04" opacity="0.55">{numeral}</text>
  <text x="{nx}" y="{ny - 2}" font-family="Georgia,'Times New Roman',serif" font-size="60"
        font-weight="700" text-anchor="middle" fill="#ffffff" opacity="0.30">{numeral}</text>
</g>"""


def rivets(points, r=7, col="#ffffff") -> str:
    return "".join(
        f'<circle cx="{x}" cy="{y}" r="{r}" fill="#000000" opacity="0.35"/>'
        f'<circle cx="{x}" cy="{y - 1.5}" r="{r - 1.5}" fill="{col}" opacity="0.55"/>'
        for x, y in points)


INGOT = ("M52,148 L80,96 L176,96 L204,148 L204,186 C204,198 194,206 182,206 "
         "L74,206 C62,206 52,198 52,186 Z")
BRACKET = "M42,46 L126,46 L126,138 L214,138 L214,216 L42,216 Z"
PLATE = ("M128,28 L212,66 L212,148 C212,192 174,220 128,232 C82,220 44,192 44,148 "
         "L44,66 Z")
COIN = "M128,28 C183,28 228,73 228,128 C228,183 183,228 128,228 C73,228 28,183 28,128 C28,73 73,28 128,28 Z"
CRYSTAL = "M128,20 L186,70 L212,150 L128,236 L44,150 L70,70 Z"
CROWN_BODY = ("M38,198 L54,88 L92,138 L128,58 L164,138 L202,88 L218,198 "
              "C218,210 209,217 197,217 L59,217 C47,217 38,210 38,198 Z")
FLUX_BODY = ("M128,24 C170,70 232,84 232,128 C232,172 170,186 128,232 "
             "C86,186 24,172 24,128 C24,84 86,70 128,24 Z")
CINDER_BODY = ("M128,14 L154,94 L234,120 L154,146 L128,230 L102,146 L22,120 "
               "L102,94 Z")

SYMBOLS: list[tuple[str, str]] = [
    ("O1", ore("shard", "#5f3d17", "#a4712f", "#241304", 1)),
    ("O2", ore("cube", "#3b4430", "#71805f", "#161c10", 2)),
    ("O3", ore("rhomb", "#632d1c", "#a05a3c", "#2a0f06", 3)),
    ("O4", ore("hex", "#2d3a45", "#5f7186", "#111820", 4)),
    ("O5", ore("nodule", "#59461a", "#9a8038", "#241b06", 5)),

    ("BRONZE", relic(
        INGOT, "gBronze", "#e8c48c", "I", 0.30, halo="glowTight", ny=178,
        ornament=('<path d="M80,96 L176,96 L188,120 L68,120 Z" fill="#ffffff" opacity="0.16"/>'
                  + rivets([(74, 172), (182, 172)], 6, "#ffe9c2")))),

    ("IRON", relic(
        BRACKET, "gIron", "#dfe7ec", "II", 0.36, halo="glowTight", nx=170, ny=192,
        ornament=('<rect x="58" y="60" width="52" height="62" rx="6" fill="#000000" opacity="0.16"/>'
                  '<rect x="150" y="154" width="48" height="46" rx="6" fill="#000000" opacity="0.16"/>'
                  + rivets([(84, 88), (84, 176), (182, 176)], 8)))),

    ("SILVER", relic(
        PLATE, "gSilver", "#ffffff", "III", 0.45, halo="glowTight",
        ornament=('<path d="M128,52 L188,80 L188,144 C188,178 160,200 128,210 '
                  'C96,200 68,178 68,144 L68,80 Z" fill="none" stroke="#5d6873" '
                  'stroke-width="4" opacity="0.5"/>'
                  '<path d="M128,52 L188,80 L188,144 C188,178 160,200 128,210" '
                  'fill="none" stroke="#ffffff" stroke-width="3" opacity="0.55"/>'
                  + rivets([(128, 68), (86, 96), (170, 96)], 6)))),

    ("GOLD", relic(
        COIN, "gGold", "#fff2c4", "IV", 0.60, halo="glowTight",
        ornament=('<circle cx="128" cy="128" r="84" fill="none" stroke="#7d5410" '
                  'stroke-width="6" opacity="0.55"/>'
                  '<circle cx="128" cy="128" r="84" fill="none" stroke="#fff2c4" '
                  'stroke-width="2.5" opacity="0.5"/>'
                  '<circle cx="128" cy="128" r="66" fill="none" stroke="#7d5410" '
                  'stroke-width="3" opacity="0.4"/>'
                  # laurel ticks around the rim
                  + "".join(
                      f'<rect x="126" y="34" width="4" height="14" rx="2" fill="#7d5410" '
                      f'opacity="0.5" transform="rotate({a} 128 128)"/>'
                      for a in range(0, 360, 30))))),

    ("MYTHRIL", relic(
        CRYSTAL, "gMythril", "#c8fff2", "V", 0.70, halo="glowWide",
        ornament=('<path d="M128,20 L128,236 M70,70 L212,150 M186,70 L44,150" '
                  'stroke="#eafffb" stroke-width="2.5" opacity="0.45" fill="none"/>'
                  '<path d="M128,64 L176,96 L160,164 L128,190 L96,164 L80,96 Z" '
                  'fill="#ffffff" opacity="0.18"/>'
                  '<path d="M128,64 L176,96 L160,164 L128,190 L96,164 L80,96 Z" '
                  'fill="none" stroke="#f2fffc" stroke-width="2" opacity="0.5"/>'))),

    ("CROWN", relic(
        CROWN_BODY, "gCrown", "#ffb347", "", 0.85, halo="glowWide", ny=999,
        ornament=(
            # molten seams running down the crown
            '<path d="M92,138 L96,208 M128,58 L128,206 M164,138 L160,208" '
            'stroke="#fff3cf" stroke-width="4" opacity="0.55" fill="none"/>'
            # jewels
            '<circle cx="92" cy="122" r="13" fill="#fff6d0"/>'
            '<circle cx="92" cy="122" r="13" fill="none" stroke="#c2560a" stroke-width="3"/>'
            '<circle cx="128" cy="94" r="16" fill="#fff6d0"/>'
            '<circle cx="128" cy="94" r="16" fill="none" stroke="#c2560a" stroke-width="3"/>'
            '<circle cx="164" cy="122" r="13" fill="#fff6d0"/>'
            '<circle cx="164" cy="122" r="13" fill="none" stroke="#c2560a" stroke-width="3"/>'
            # base band
            '<rect x="46" y="176" width="164" height="22" rx="8" fill="#000000" opacity="0.22"/>'
            + rivets([(74, 187), (128, 187), (182, 187)], 6, "#fff3cf")))),

    ("FLUX", f"""
<g>
  <g filter="url(#glowWide)" opacity="0.85"><path d="{FLUX_BODY}" fill="#37e0c8"/></g>
  <path d="{FLUX_BODY}" fill="url(#gFlux)"/>
  <path d="M128,66 C154,98 190,110 190,128 C190,150 154,162 128,196
           C102,162 66,150 66,128 C66,110 102,98 128,66 Z"
        fill="#eafffb" opacity="0.38"/>
  <path d="M128,96 C142,114 164,120 164,128 C164,138 142,144 128,164
           C114,144 92,138 92,128 C92,120 114,114 128,96 Z"
        fill="#ffffff" opacity="0.55"/>
  <path d="{FLUX_BODY}" fill="url(#sweep)" opacity="0.6"/>
  <path d="{FLUX_BODY}" fill="none" stroke="#a6fbec" stroke-width="5"/>
  <path d="{FLUX_BODY}" fill="none" stroke="#ffffff" stroke-width="1.8" opacity="0.6"/>
</g>"""),

    ("CINDER", f"""
<g>
  <g filter="url(#glowWide)" opacity="0.9"><path d="{CINDER_BODY}" fill="#ff7a18"/></g>
  <path d="{CINDER_BODY}" fill="url(#gCinder)"/>
  <path d="M128,58 L142,112 L196,120 L142,128 L128,186 L114,128 L60,120 L114,112 Z"
        fill="#fff6de" opacity="0.5"/>
  <circle cx="128" cy="120" r="30" fill="#fffdf4" opacity="0.9" filter="url(#bloomS)"/>
  <path d="{CINDER_BODY}" fill="none" stroke="#ffe3a0" stroke-width="5"/>
  <path d="{CINDER_BODY}" fill="none" stroke="#ffffff" stroke-width="1.8" opacity="0.55"/>
</g>"""),
]


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    rows = (len(SYMBOLS) + COLS - 1) // COLS
    w, h = COLS * CELL, rows * CELL

    clips = "".join(ore_clip(s, i + 1) for i, s in
                    enumerate(["shard", "cube", "rhomb", "hex", "nodule"]))

    tiles, frames = [], {}
    for i, (name, art) in enumerate(SYMBOLS):
        cx, cy = (i % COLS) * CELL, (i // COLS) * CELL
        tiles.append(f'<g transform="translate({cx},{cy})">{art}</g>')
        frames[name] = {"x": cx, "y": cy, "w": CELL, "h": CELL}

    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
           f'viewBox="0 0 {w} {h}">{defs()}<defs>{clips}</defs>{"".join(tiles)}</svg>')

    (OUT / "atlas.html").write_text(
        "<!doctype html><meta charset='utf-8'>"
        "<style>html,body{margin:0;padding:0;background:transparent}"
        f"svg{{display:block;width:{w}px;height:{h}px}}</style>{svg}")
    (OUT / "atlas.json").write_text(json.dumps(
        {"image": "atlas.png", "cell": CELL, "size": {"w": w, "h": h}, "frames": frames},
        indent=2))
    print(f"atlas page: {w}x{h}px, {len(SYMBOLS)} symbols -> {OUT}")


if __name__ == "__main__":
    build()
