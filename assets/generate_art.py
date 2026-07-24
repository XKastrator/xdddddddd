"""Author the MOLTEN CROWN symbol art as SVG and emit an atlas page.

The art is hand-authored vector (gradients, facets, bevels, emissive rims)
following ART_BIBLE.md: matte dark ore that reads as fuel, emissive metallic
relics whose glow intensity climbs with rank, teal Flux, ember Cinder. Each
symbol carries a distinct SILHOUETTE and a rank numeral so rank is never
communicated by colour alone (colour-blind requirement).

Output: assets/build/atlas.html — a deterministic grid of every symbol, which
`rasterize.mjs` screenshots once to produce atlas.png + atlas.json.
"""
from __future__ import annotations

import json
from pathlib import Path

CELL = 256          # atlas cell size in px
COLS = 4
OUT = Path(__file__).resolve().parent / "build"

# --- palette (ART_BIBLE.md) ---------------------------------------------------
AMBER, AMBER2, TEAL, GOLD = "#ff7a18", "#ffb347", "#37e0c8", "#f2c14e"


def defs() -> str:
    """Shared gradients and filters."""
    return f"""
<defs>
  <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="6"/>
  </filter>
  <filter id="soft2" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="14"/>
  </filter>
  <filter id="grain" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7"/>
    <feColorMatrix type="saturate" values="0"/>
    <feComposite operator="in" in2="SourceGraphic"/>
    <feBlend in="SourceGraphic" mode="multiply" opacity="0.5"/>
  </filter>
  <linearGradient id="bronze" x1="0" y1="0" x2="0.4" y2="1">
    <stop offset="0" stop-color="#e0b880"/><stop offset="0.45" stop-color="#b08d57"/>
    <stop offset="1" stop-color="#6b4f2a"/>
  </linearGradient>
  <linearGradient id="iron" x1="0" y1="0" x2="0.35" y2="1">
    <stop offset="0" stop-color="#e8eef3"/><stop offset="0.4" stop-color="#9fa7ad"/>
    <stop offset="1" stop-color="#4d565d"/>
  </linearGradient>
  <linearGradient id="silver" x1="0" y1="0" x2="0.35" y2="1">
    <stop offset="0" stop-color="#ffffff"/><stop offset="0.45" stop-color="#d6dde3"/>
    <stop offset="1" stop-color="#8f9aa3"/>
  </linearGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="0.35" y2="1">
    <stop offset="0" stop-color="#fff3c4"/><stop offset="0.4" stop-color="{GOLD}"/>
    <stop offset="1" stop-color="#a3761c"/>
  </linearGradient>
  <linearGradient id="mythril" x1="0" y1="0" x2="0.35" y2="1">
    <stop offset="0" stop-color="#e6fffa"/><stop offset="0.4" stop-color="#6fe3c8"/>
    <stop offset="1" stop-color="#1d7d6b"/>
  </linearGradient>
  <linearGradient id="crown" x1="0" y1="0" x2="0.3" y2="1">
    <stop offset="0" stop-color="#fff6d0"/><stop offset="0.35" stop-color="#ffd76b"/>
    <stop offset="0.72" stop-color="{AMBER}"/><stop offset="1" stop-color="#8f2d00"/>
  </linearGradient>
  <radialGradient id="fluxg" cx="0.4" cy="0.35" r="0.75">
    <stop offset="0" stop-color="#d8fff7"/><stop offset="0.35" stop-color="{TEAL}"/>
    <stop offset="1" stop-color="#06322c"/>
  </radialGradient>
  <radialGradient id="cinderg" cx="0.42" cy="0.38" r="0.7">
    <stop offset="0" stop-color="#fff6dc"/><stop offset="0.4" stop-color="{AMBER2}"/>
    <stop offset="1" stop-color="#61230a"/>
  </radialGradient>
</defs>"""


def ore(shape: str, base: str, light: str, dark: str) -> str:
    """A matte rock chunk: faceted, unlit, deliberately low-contrast.

    Ore variants are all rank 0, so they deliberately carry NO numeral — a
    numeral would imply a rank they do not have and collide with the relics.
    Variants are told apart by silhouette first (the player must spot groups of
    4+ at a glance) with tint as a secondary cue.
    """
    shapes = {
        "shard": "M128,34 L206,92 L182,206 L74,206 L50,92 Z",
        "cube": "M128,40 L208,84 L208,180 L128,224 L48,180 L48,84 Z",
        "rhomb": "M128,32 L216,128 L128,224 L40,128 Z",
        "hex": "M128,36 L204,72 L220,158 L128,220 L36,158 L52,72 Z",
        "nodule": "M128,38 C186,38 222,80 220,132 C218,190 176,222 126,222 "
                  "C74,222 38,186 38,130 C38,78 74,38 128,38 Z",
    }
    facet = {
        "shard": "M128,34 L206,92 L128,120 Z",
        "cube": "M128,40 L208,84 L128,124 L48,84 Z",
        "rhomb": "M128,32 L216,128 L128,128 Z",
        "hex": "M128,36 L204,72 L128,118 L52,72 Z",
        "nodule": "M128,38 C186,38 222,80 220,132 C180,96 150,80 128,38 Z",
    }
    return f"""
<g>
  <path d="{shapes[shape]}" fill="{base}" stroke="{dark}" stroke-width="6"/>
  <path d="{facet[shape]}" fill="{light}" opacity="0.5"/>
  <path d="{shapes[shape]}" fill="none" stroke="{light}" stroke-width="2" opacity="0.35"/>
</g>"""


def relic(body: str, grad: str, rim: str, numeral: str, glow: float, extra: str = "",
          nx: int = 128, ny: int = 168) -> str:
    """A forged relic: emissive rim + bevel; glow scales with rank.

    `nx`/`ny` place the rank numeral inside the shape's thickest mass so it stays
    legible on non-convex silhouettes (e.g. the Iron bracket).
    """
    return f"""
<g>
  <g filter="url(#soft2)" opacity="{glow:.2f}">
    <path d="{body}" fill="{rim}"/>
  </g>
  <path d="{body}" fill="url(#{grad})" stroke="{rim}" stroke-width="5"/>
  <path d="{body}" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.45"/>
  {extra}
  <text x="{nx}" y="{ny}" font-family="Georgia,serif" font-size="58" font-weight="700"
        fill="#1a0f05" opacity="0.72" text-anchor="middle">{numeral}</text>
</g>"""


# --- symbol bodies ------------------------------------------------------------
INGOT = ("M62,150 L84,104 L172,104 L194,150 L194,182 C194,192 186,198 176,198 "
         "L80,198 C70,198 62,192 62,182 Z")
BRACKET = ("M46,52 L124,52 L124,140 L212,140 L212,214 L46,214 Z")
PLATE = ("M128,36 L206,72 L206,150 C206,190 170,214 128,226 C86,214 50,190 50,150 "
         "L50,72 Z")
COIN = ("M128,32 C180,32 224,76 224,128 C224,180 180,224 128,224 C76,224 32,180 "
        "32,128 C32,76 76,32 128,32 Z")
CRYSTAL = ("M128,26 L182,74 L206,150 L128,230 L50,150 L74,74 Z")
CROWN_BODY = ("M44,196 L58,96 L92,140 L128,66 L164,140 L198,96 L212,196 "
              "C212,206 204,212 194,212 L62,212 C52,212 44,206 44,196 Z")
FLUX_BODY = ("M128,30 C168,74 226,88 226,128 C226,168 168,182 128,226 "
             "C88,182 30,168 30,128 C30,88 88,74 128,30 Z")
CINDER_BODY = ("M128,22 L152,96 L226,120 L152,144 L128,222 L104,144 L30,120 "
               "L104,96 Z")

SYMBOLS: list[tuple[str, str]] = [
    # tints pushed apart (warm brown / cold olive / rust / blue-grey / ochre)
    ("O1", ore("shard", "#5a3a16", "#8f6128", "#2a1706")),
    ("O2", ore("cube", "#39412e", "#657357", "#181d12")),
    ("O3", ore("rhomb", "#5e2c1d", "#93513a", "#2b1109")),
    ("O4", ore("hex", "#2f3841", "#57677a", "#141a20")),
    ("O5", ore("nodule", "#544219", "#8a7233", "#261d08")),
    ("BRONZE", relic(INGOT, "bronze", "#d8b57e", "I", 0.30, ny=176)),
    ("IRON", relic(BRACKET, "iron", "#d7dee3", "II", 0.38, nx=168, ny=192)),
    ("SILVER", relic(PLATE, "silver", "#ffffff", "III", 0.50)),
    ("GOLD", relic(COIN, "gold", "#fff0c0", "IV", 0.68,
                   extra='<circle cx="128" cy="128" r="76" fill="none" '
                         'stroke="#a3761c" stroke-width="4" opacity="0.7"/>')),
    ("MYTHRIL", relic(CRYSTAL, "mythril", "#bafff0", "V", 0.82,
                      extra='<path d="M128,26 L128,230 M74,74 L206,150 M182,74 L50,150" '
                            'stroke="#eafffb" stroke-width="2" opacity="0.5" fill="none"/>')),
    ("CROWN", relic(CROWN_BODY, "crown", "#ff9a3c", "", 1.0,
                    extra='<circle cx="92" cy="120" r="10" fill="#fff6d0"/>'
                          '<circle cx="128" cy="98" r="12" fill="#fff6d0"/>'
                          '<circle cx="164" cy="120" r="10" fill="#fff6d0"/>')),
    ("FLUX", f"""
<g>
  <g filter="url(#soft2)" opacity="0.9"><path d="{FLUX_BODY}" fill="{TEAL}"/></g>
  <path d="{FLUX_BODY}" fill="url(#fluxg)" stroke="#8ff5e4" stroke-width="4"/>
  <path d="M128,74 C150,102 182,112 182,128 C182,148 150,158 128,182
           C106,158 74,148 74,128 C74,112 106,102 128,74 Z"
        fill="#eafffb" opacity="0.45"/>
</g>"""),
    ("CINDER", f"""
<g>
  <g filter="url(#soft2)" opacity="1"><path d="{CINDER_BODY}" fill="{AMBER}"/></g>
  <path d="{CINDER_BODY}" fill="url(#cinderg)" stroke="#fff0c8" stroke-width="4"/>
  <circle cx="128" cy="120" r="26" fill="#fff8e2" opacity="0.85" filter="url(#soft)"/>
</g>"""),
]


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    rows = (len(SYMBOLS) + COLS - 1) // COLS
    w, h = COLS * CELL, rows * CELL

    tiles, frames = [], {}
    for i, (name, art) in enumerate(SYMBOLS):
        cx, cy = (i % COLS) * CELL, (i // COLS) * CELL
        tiles.append(f'<g transform="translate({cx},{cy})">{art}</g>')
        frames[name] = {"x": cx, "y": cy, "w": CELL, "h": CELL}

    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
           f'viewBox="0 0 {w} {h}">{defs()}{"".join(tiles)}</svg>')

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
