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

  <!-- secondary materials: relics are not single-material objects. A hammer is
       iron on ash, a sword is steel on wrapped leather. Overdrawing these on top
       of the body gradient is what stops every symbol reading as "one shape,
       one colour". -->
  <linearGradient id="gWood" x1="0.15" y1="0" x2="0.85" y2="1">
    <stop offset="0" stop-color="#a4763f"/><stop offset="0.34" stop-color="#7c5528"/>
    <stop offset="0.72" stop-color="#4e3315"/><stop offset="1" stop-color="#2a1a0a"/>
  </linearGradient>
  <linearGradient id="gLeather" x1="0.15" y1="0" x2="0.85" y2="1">
    <stop offset="0" stop-color="#6b4a2c"/><stop offset="0.4" stop-color="#4a3018"/>
    <stop offset="1" stop-color="#22150a"/>
  </linearGradient>

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
  <!-- one dark matrix for every ore variant: the rock is the same worthless
       stone everywhere, only the mineral in it differs -->
  <linearGradient id="oreMatrix" x1="0.2" y1="0" x2="0.8" y2="1">
    <stop offset="0" stop-color="#4a443c"/><stop offset="0.4" stop-color="#332e28"/>
    <stop offset="1" stop-color="#171310"/>
  </linearGradient>
  <!-- ore sits in shadow far harder than polished metal does -->
  <linearGradient id="oreShade" x1="0.25" y1="0" x2="0.75" y2="1">
    <stop offset="0" stop-color="#000000" stop-opacity="0"/>
    <stop offset="0.5" stop-color="#000000" stop-opacity="0.22"/>
    <stop offset="1" stop-color="#000000" stop-opacity="0.5"/>
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


# One crystal cluster, shared by every variant and clipped to the variant's own
# silhouette. Sharing it is deliberate: the SHAPE carries variant identity (the
# colour-blind cue), the HUE carries the separation, and a shared cluster keeps
# all five reading as the same material.
CLUSTER = [
    # (cx, cy, half-width, half-height, tilt°) — the tilts matter: three upright
    # prisms of graded height read as a bar chart, not as crystal.
    (116, 128, 30, 64, -6),
    (168, 154, 22, 44, 13),
    (84, 170, 18, 38, -15),
    (142, 190, 14, 26, 5),
]


def crystal(cx: int, cy: int, w: int, h: int, tilt: float,
            light: str, mid: str, dark: str) -> str:
    """A single faceted prism, lit from the upper left."""
    body = (f"M{cx},{cy - h} L{cx + w},{cy - h * 0.5:.0f} "
            f"L{cx + w},{cy + h * 0.72:.0f} L{cx},{cy + h} "
            f"L{cx - w},{cy + h * 0.72:.0f} L{cx - w},{cy - h * 0.5:.0f} Z")
    lit = (f"M{cx},{cy - h} L{cx},{cy + h} L{cx - w},{cy + h * 0.72:.0f} "
           f"L{cx - w},{cy - h * 0.5:.0f} Z")
    shade = (f"M{cx},{cy - h} L{cx + w},{cy - h * 0.5:.0f} "
             f"L{cx + w},{cy + h * 0.72:.0f} L{cx},{cy + h} Z")
    return (f'<g transform="rotate({tilt} {cx} {cy})">'
            f'<path d="{body}" fill="{mid}"/>'
            f'<path d="{lit}" fill="{light}" opacity="0.8"/>'
            f'<path d="{shade}" fill="{dark}" opacity="0.6"/>'
            # a hard specular streak is what separates "crystal" from "paint"
            f'<path d="M{cx - w * 0.55:.0f},{cy - h * 0.42:.0f} '
            f'L{cx - w * 0.2:.0f},{cy - h * 0.5:.0f} '
            f'L{cx - w * 0.2:.0f},{cy + h * 0.3:.0f} '
            f'L{cx - w * 0.55:.0f},{cy + h * 0.42:.0f} Z" '
            f'fill="#ffffff" opacity="0.55"/>'
            f'<path d="{body}" fill="none" stroke="{light}" stroke-width="2.5" '
            f'opacity="0.7" stroke-linejoin="round"/></g>')


def ore(shape: str, light: str, mid: str, deep: str, seed: int) -> str:
    """Raw ore: a dark rock matrix with a saturated crystal cluster growing out.

    The previous version was a faceted brown rock, and since ore fills most of
    the board most of the time, the whole grid read as one muddy earth tone with
    nothing separating the five variants at a glance. Ore is now MINERAL: one
    shared dark matrix so it still reads as worthless fuel, and a strongly
    hue-separated crystal cluster so the board has colour and the variants are
    distinguishable peripherally.
    """
    body = ORE_SHAPES[shape]
    cluster = "".join(crystal(cx, cy, w, h, tilt, light, mid, deep)
                      for cx, cy, w, h, tilt in CLUSTER)
    return f"""
<g>
  <g filter="url(#softShadow)" opacity="0.55">
    <path d="{body}" fill="#000000" transform="translate(4,8)"/>
  </g>
  <path d="{body}" fill="url(#oreMatrix)"/>
  <g clip-path="url(#clip{seed})">
    <path d="{body}" fill="#3a332b" filter="url(#rock)" opacity="0.55"/>
    <!-- the matrix takes the shade pass, the crystal does NOT: laying the ramp
         over the mineral desaturated it straight back to mud -->
    <path d="{body}" fill="url(#oreShade)"/>
    <g filter="url(#glowTight)" opacity="0.5">{cluster}</g>
    {cluster}
  </g>
  <path d="{body}" fill="none" stroke="#0a0806" stroke-width="8" stroke-linejoin="round"/>
  <path d="{body}" fill="none" stroke="{mid}" stroke-width="2.5"
        stroke-linejoin="round" opacity="0.55"/>
</g>"""


def ore_clip(shape: str, seed: int) -> str:
    return f'<clipPath id="clip{seed}"><path d="{ORE_SHAPES[shape]}"/></clipPath>'


# --------------------------------------------------------------------------- #
# RELICS — layered forged metal.
# --------------------------------------------------------------------------- #
def relic(body: str, grad: str, rim: str, numeral: str, glow: float,
          ornament: str = "", nx: int = 128, ny: int = 172,
          inset: str | None = None, halo: str = "haloWhite",
          nsize: int = 60) -> str:
    """Stack: halo -> shadow -> body -> form shade -> ornament -> sweep -> rim.

    There is deliberately NO inset outline pass. A relic body is often several
    subpaths (a hammer is head + haft, a sword is blade + guard + grip +
    pommel), and stroking the body traced every subpath separately, cutting dark
    rings through the middle of the object. Form now comes from the `innerShade`
    gradient, which reads correctly however many parts the silhouette has.

    Rim weights are kept low on purpose: a thick light outline is what makes
    vector art look like a sticker rather than a forged object.
    """
    _ = inset
    # glow hugs the silhouette and stays inside the 256 cell
    return f"""
<g>
  <g filter="url(#{halo})" opacity="{glow:.2f}"><path d="{body}" fill="{rim}"/></g>
  <g filter="url(#softShadow)" opacity="0.5">
    <path d="{body}" fill="#000000" transform="translate(3,7)"/>
  </g>
  <path d="{body}" fill="url(#{grad})"/>
  <path d="{body}" fill="url(#innerShade)"/>
  {ornament}
  <path d="{body}" fill="url(#sweep)" opacity="0.42"/>
  <path d="{body}" fill="none" stroke="{rim}" stroke-width="3.5"
        stroke-linejoin="round" opacity="0.85"/>
  <path d="{body}" fill="none" stroke="#ffffff" stroke-width="1.1"
        stroke-linejoin="round" opacity="0.3"/>
  <text x="{nx}" y="{ny}" font-family="Georgia,'Times New Roman',serif" font-size="{nsize}"
        font-weight="700" text-anchor="middle" fill="#120a04" opacity="0.55">{numeral}</text>
  <text x="{nx}" y="{ny - 2}" font-family="Georgia,'Times New Roman',serif" font-size="{nsize}"
        font-weight="700" text-anchor="middle" fill="#ffffff" opacity="0.30">{numeral}</text>
</g>"""


def rivets(points, r=7, col="#ffffff") -> str:
    return "".join(
        f'<circle cx="{x}" cy="{y}" r="{r}" fill="#000000" opacity="0.35"/>'
        f'<circle cx="{x}" cy="{y - 1.5}" r="{r - 1.5}" fill="{col}" opacity="0.55"/>'
        for x, y in points)


# --------------------------------------------------------------------------- #
# Silhouettes.
#
# Every relic is a RECOGNISABLE FORGE OBJECT, not a geometric plate with a
# numeral on it. The ladder tells its own story at a glance — bar, hammer,
# shield, chalice, sword, crown — and the shapes are deliberately different in
# outline (wide/low, tall/narrow, round, pointed) so they separate peripherally
# and at thumbnail size, before colour or rank mark is read.
# --------------------------------------------------------------------------- #
INGOT = ("M52,150 L82,98 L174,98 L204,150 L204,188 C204,200 194,208 182,208 "
         "L74,208 C62,208 52,200 52,188 Z")
INGOT_TOP = "M82,98 L174,98 L204,150 L52,150 Z"

HAFT = ("M114,118 L142,118 L148,228 C148,234 143,238 137,238 L119,238 "
        "C113,238 108,234 108,228 Z")
HAMMER_HEAD = "M28,58 L74,68 L182,68 L228,58 L228,134 L182,124 L74,124 L28,134 Z"
HAMMER = f"{HAMMER_HEAD} {HAFT}"

SHIELD = ("M128,26 L216,60 L216,132 C216,184 178,216 128,234 "
          "C78,216 40,184 40,132 L40,60 Z")

CHALICE_BOWL = "M50,46 L206,46 C206,116 182,158 128,170 C74,158 50,116 50,46 Z"
CHALICE_STEM = "M113,166 L143,166 L143,202 L113,202 Z"
CHALICE_FOOT = ("M66,200 L190,200 C198,200 204,210 202,220 L200,232 L56,232 "
                "L54,220 C52,210 58,200 66,200 Z")
CHALICE = f"{CHALICE_BOWL} {CHALICE_STEM} {CHALICE_FOOT}"

SWORD_BLADE = "M128,18 L150,60 L150,140 L106,140 L106,60 Z"
SWORD_GUARD = "M58,140 L198,140 L204,150 L198,168 L58,168 L52,150 Z"
SWORD_GRIP = "M112,168 L144,168 L144,202 L112,202 Z"
# A round pommel as tall as it is wide turns the grip into a lollipop. A
# flattened disc reads as a counterweight, which is what a pommel actually is.
SWORD_POMMEL = ("M128,196 C147,196 159,204 159,214 C159,226 147,233 128,233 "
                "C109,233 97,226 97,214 C97,204 109,196 128,196 Z")
SWORD = f"{SWORD_BLADE} {SWORD_GUARD} {SWORD_GRIP} {SWORD_POMMEL}"

CROWN_BODY = ("M38,198 L54,88 L92,138 L128,58 L164,138 L202,88 L218,198 "
              "C218,210 209,217 197,217 L59,217 C47,217 38,210 38,198 Z")
FLUX_BODY = ("M128,24 C170,70 232,84 232,128 C232,172 170,186 128,232 "
             "C86,186 24,172 24,128 C24,84 86,70 128,24 Z")
CINDER_BODY = ("M128,14 L154,94 L234,120 L154,146 L128,230 L102,146 L22,120 "
               "L102,94 Z")


def wrap_lines(x0: int, x1: int, y0: int, y1: int, step: int,
               col: str = "#150c05") -> str:
    """Leather binding: short diagonals across a grip."""
    return "".join(
        f'<path d="M{x0},{y} L{x1},{y - 6}" stroke="{col}" stroke-width="3" '
        f'opacity="0.55" fill="none"/>'
        for y in range(y0, y1, step))


SYMBOLS: list[tuple[str, str]] = [
    # Five minerals, chosen for maximum hue separation from each other AND from
    # the specials: FLUX owns cyan-teal and CINDER owns amber, so ore takes
    # green, blue, red, lime and violet.
    ("O1", ore("shard", "#a8ffc6", "#2fbf6a", "#0b4227", 1)),      # malachite
    ("O2", ore("cube", "#a6d9ff", "#2f7fdf", "#0b2a5c", 2)),       # azurite
    ("O3", ore("rhomb", "#ffb3a0", "#e0452a", "#571004", 3)),      # cinnabar
    ("O4", ore("hex", "#f6ffa8", "#c9d423", "#4a5206", 4)),        # sulphur
    ("O5", ore("nodule", "#e2b6ff", "#9a4fe0", "#37115e", 5)),     # amethyst

    # I — a cast bronze bar, straight off the mould
    ("BRONZE", relic(
        INGOT, "gBronze", "#e8c48c", "I", 0.22, halo="glowTight", ny=184, nsize=50,
        ornament=(
                  # the cast face is in shade; the sloped top catches the light.
                  # Without this split the bar reads as a flat tag, not a solid.
                  '<path d="M52,150 L204,150 L204,188 C204,200 194,208 182,208 '
                  'L74,208 C62,208 52,200 52,188 Z" fill="#000000" opacity="0.28"/>'
                  f'<path d="{INGOT_TOP}" fill="#fff0cf" opacity="0.30"/>'
                  f'<path d="{INGOT_TOP}" fill="none" stroke="#3a2409" '
                  'stroke-width="4" opacity="0.5"/>'
                  # cooling seam down the cast face
                  '<path d="M128,150 L128,206" stroke="#3a2409" stroke-width="3" '
                  'opacity="0.28" fill="none"/>'
                  + rivets([(74, 178), (182, 178)], 6, "#ffe9c2")))),

    # II — the smith's own hammer: iron head, ash haft, iron collar
    ("IRON", relic(
        HAMMER, "gIron", "#dfe7ec", "II", 0.26, halo="glowTight", ny=110, nsize=44,
        ornament=(f'<path d="{HAFT}" fill="url(#gWood)"/>'
                  '<path d="M120,132 L125,230 M133,130 L138,230" stroke="#2a1a0a" '
                  'stroke-width="2.5" opacity="0.45" fill="none"/>'
                  # collar clamping the head to the haft
                  '<rect x="100" y="112" width="56" height="22" rx="7" fill="#8d979e"/>'
                  '<rect x="100" y="112" width="56" height="9" rx="4" fill="#ffffff" '
                  'opacity="0.42"/>'
                  # recessed cheek of the head
                  '<rect x="80" y="80" width="96" height="34" rx="9" fill="#000000" '
                  'opacity="0.20"/>'
                  # worn striking faces catch the forge light
                  '<path d="M28,58 L46,63 L46,129 L28,134 Z" fill="#ffffff" opacity="0.20"/>'
                  '<path d="M228,58 L210,63 L210,129 L228,134 Z" fill="#ffffff" opacity="0.14"/>'
                  + rivets([(60, 96), (196, 96)], 8)))),

    # III — a heater shield, bronze-banded, with a struck boss
    ("SILVER", relic(
        SHIELD, "gSilver", "#e8eef3", "III", 0.32, halo="glowTight", ny=190, nsize=44,
        ornament=('<rect x="40" y="98" width="176" height="30" fill="#8d6b3c" '
                  'opacity="0.55"/>'
                  '<rect x="40" y="98" width="176" height="8" fill="#f0cf9c" '
                  'opacity="0.40"/>'
                  '<circle cx="128" cy="113" r="27" fill="#c7d0d8"/>'
                  '<circle cx="128" cy="113" r="27" fill="none" stroke="#5d6873" '
                  'stroke-width="4"/>'
                  '<circle cx="121" cy="105" r="10" fill="#ffffff" opacity="0.55"/>'
                  # planked face + edge binding
                  '<path d="M84,44 L84,214 M172,44 L172,214" stroke="#5d6873" '
                  'stroke-width="3" opacity="0.32" fill="none"/>'
                  + rivets([(56, 74), (200, 74), (128, 214)], 6)))),

    # IV — a gold chalice brimming with molten metal
    ("GOLD", relic(
        CHALICE, "gGold", "#fff2c4", "IV", 0.45, halo="glowTight", ny=124, nsize=46,
        ornament=('<ellipse cx="128" cy="52" rx="72" ry="13" fill="#fff2c4" '
                  'opacity="0.55"/>'
                  '<path d="M50,46 L206,46 L204,68 L52,68 Z" fill="#ffffff" '
                  'opacity="0.20"/>'
                  '<path d="M62,78 C92,110 164,110 194,78" fill="none" stroke="#7d5410" '
                  'stroke-width="4" opacity="0.45"/>'
                  '<circle cx="88" cy="92" r="9" fill="#fff6d0" opacity="0.85"/>'
                  '<circle cx="168" cy="92" r="9" fill="#fff6d0" opacity="0.85"/>'
                  f'<path d="{CHALICE_STEM}" fill="#000000" opacity="0.18"/>'
                  '<circle cx="128" cy="184" r="13" fill="#ff9422"/>'
                  '<circle cx="128" cy="184" r="13" fill="none" stroke="#7d5410" '
                  'stroke-width="3"/>'
                  '<path d="M66,206 L190,206" stroke="#7d5410" stroke-width="4" '
                  'opacity="0.45" fill="none"/>'))),

    # V — a mythril blade: fullered steel, wrapped grip, gem pommel
    ("MYTHRIL", relic(
        SWORD, "gMythril", "#c8fff2", "V", 0.58, halo="glowWide", ny=118, nsize=40,
        ornament=(f'<path d="{SWORD_GRIP}" fill="url(#gLeather)"/>'
                  + wrap_lines(112, 144, 176, 202, 8)
                  + '<path d="M128,36 L128,132" stroke="#0d5548" stroke-width="8" '
                  'opacity="0.40" fill="none"/>'
                  '<path d="M128,36 L128,132" stroke="#f2fffc" stroke-width="2.5" '
                  'opacity="0.55" fill="none"/>'
                  # bevel down the near edge of the blade
                  '<path d="M128,18 L150,60 L150,140 L128,140 Z" fill="#000000" '
                  'opacity="0.14"/>'
                  f'<path d="{SWORD_GUARD}" fill="#ffffff" opacity="0.10"/>'
                  '<path d="M58,140 L198,140 L200,148 L56,148 Z" fill="#ffffff" '
                  'opacity="0.30"/>'
                  '<circle cx="128" cy="214" r="10" fill="#eafffb" opacity="0.92"/>'
                  '<circle cx="128" cy="214" r="10" fill="none" stroke="#0d5548" '
                  'stroke-width="2.5" opacity="0.7"/>'))),

    ("CROWN", relic(
        CROWN_BODY, "gCrown", "#ffb347", "", 0.75, halo="glowWide", ny=999,
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
  <!-- `bloomS` was never declared; an SVG element referencing a missing filter
       is not rendered at all, so the scatter's hot core was silently absent. -->
  <circle cx="128" cy="120" r="30" fill="#fffdf4" opacity="0.9" filter="url(#glowTight)"/>
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
