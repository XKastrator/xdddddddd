"""Author THE EMBERWRIGHT — the forge's hooded smith — as separate rig parts.

The character is deliberately split into bones-worth of pieces so the renderer
can animate it as a skeleton (idle sway, hammer raise + strike, victory lift)
rather than playing a baked sprite sequence. Parts are drawn around their PIVOT
so rotation happens at the joint, exactly as a skeletal rig expects.

Design constraints (ART_BIBLE.md §3, brief §6): an ADULT, heavy, imposing
silhouette — broad shoulders, long hooded cloak, no visible face (only ember
eye-light), no youthful or childlike proportions. Rim-lit by the forge so the
figure reads as a dark shape against the lava glow.

Parts (pivot at the local origin of each cell):
  body      — cloak + shoulders, pivot at the hips
  head      — hood, pivot at the neck
  armBack   — far arm, pivot at the shoulder
  armFront  — near arm, pivot at the shoulder (hammer is drawn into it)

Output: assets/build/character.html (+ character.json frames) -> rasterize.mjs
"""
from __future__ import annotations

import json
from pathlib import Path

OUT = Path(__file__).resolve().parent / "build"
CELL = 512          # generous: the cloak is tall
COLS = 2

CLOAK_D = "#100b08"      # cloak base (near-silhouette)
CLOAK_L = "#241812"      # lit fold
RIM = "#ff8c22"          # forge rim light
RIM_SOFT = "#ffb347"
STEEL = "#8f9aa3"
STEEL_L = "#dfe6ea"


def defs() -> str:
    return f"""
<defs>
  <linearGradient id="cloak" x1="0.2" y1="0" x2="0.8" y2="1">
    <stop offset="0" stop-color="{CLOAK_L}"/>
    <stop offset="0.55" stop-color="{CLOAK_D}"/>
    <stop offset="1" stop-color="#070504"/>
  </linearGradient>
  <linearGradient id="steel" x1="0" y1="0" x2="0.4" y2="1">
    <stop offset="0" stop-color="{STEEL_L}"/><stop offset="0.5" stop-color="{STEEL}"/>
    <stop offset="1" stop-color="#4d565d"/>
  </linearGradient>
  <radialGradient id="eye" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#fff2cc"/><stop offset="0.4" stop-color="{RIM}"/>
    <stop offset="1" stop-color="{RIM}" stop-opacity="0"/>
  </radialGradient>
  <filter id="cglow" x="-60%" y="-60%" width="220%" height="220%">
    <feGaussianBlur stdDeviation="10"/>
  </filter>
</defs>"""


def body() -> str:
    """Cloak, broad shoulders and a ragged hem. Pivot (0,0) at the hips.

    The silhouette is the whole point: a heavy trapezoid of shoulder tapering to
    the waist, so the figure still reads as a smith at thumbnail size.
    """
    # torso: narrow neck -> wide shoulder yoke -> waist
    torso = ("M-26,-268 C-64,-262 -104,-236 -116,-198 "
             "C-124,-170 -112,-140 -100,-116 C-92,-84 -88,-42 -84,0 "
             "L84,0 C88,-42 92,-84 100,-116 C112,-140 124,-170 116,-198 "
             "C104,-236 64,-262 26,-268 Z")
    # skirt with a torn hem so the cloak never looks cut off
    skirt = ("M-84,0 C-96,44 -104,92 -104,132 L-76,116 L-52,140 L-26,118 "
             "L0,142 L26,118 L52,140 L76,116 L104,132 "
             "C104,92 96,44 84,0 Z")
    return f"""
<g>
  <path d="{skirt}" fill="url(#cloak)"/>
  <path d="{torso}" fill="url(#cloak)"/>
  <!-- shoulder yoke: a pauldron edge catches the forge light -->
  <path d="M-116,-198 C-104,-236 -64,-262 -26,-268"
        stroke="{RIM}" stroke-width="9" fill="none" opacity="0.85"/>
  <path d="M-100,-116 C-92,-84 -88,-42 -84,0 C-96,44 -104,92 -104,132"
        stroke="{RIM}" stroke-width="6" fill="none" opacity="0.6"/>
  <path d="M-116,-198 C-104,-236 -64,-262 -26,-268"
        stroke="{RIM_SOFT}" stroke-width="3" fill="none" opacity="0.95"/>
  <!-- leather belt + buckle at the waist -->
  <path d="M-86,-26 C-40,-6 40,-6 86,-26 L86,10 C40,30 -40,30 -86,10 Z"
        fill="#1c120c" stroke="#3a2418" stroke-width="3"/>
  <rect x="-18" y="-14" width="36" height="30" rx="6" fill="#6b4f2a"
        stroke="{RIM_SOFT}" stroke-width="2" opacity="0.9"/>
</g>"""


def head() -> str:
    """Hood. Pivot (0,0) at the neck; face is shadow with an ember eye-light."""
    hood = ("M0,0 C-46,-4 -66,-34 -66,-72 C-66,-118 -36,-150 0,-150 "
            "C36,-150 66,-118 66,-72 C66,-34 46,-4 0,0 Z")
    return f"""
<g>
  <path d="{hood}" fill="url(#cloak)"/>
  <!-- hood opening: deep shadow -->
  <ellipse cx="0" cy="-72" rx="40" ry="46" fill="#050403"/>
  <g filter="url(#cglow)" opacity="0.95">
    <ellipse cx="-13" cy="-76" rx="11" ry="7" fill="url(#eye)"/>
    <ellipse cx="13" cy="-76" rx="11" ry="7" fill="url(#eye)"/>
  </g>
  <ellipse cx="-13" cy="-76" rx="5" ry="3.4" fill="#fff2cc"/>
  <ellipse cx="13" cy="-76" rx="5" ry="3.4" fill="#fff2cc"/>
  <path d="M0,-150 C-36,-150 -66,-118 -66,-72" stroke="{RIM}" stroke-width="6"
        fill="none" opacity="0.8"/>
</g>"""


def arm_back() -> str:
    """Far arm, held low. Pivot (0,0) at the shoulder."""
    return f"""
<g>
  <path d="M0,-14 C-30,26 -40,80 -32,126 C-26,158 4,168 22,152
           C36,140 32,112 24,84 C14,50 10,20 14,-10 Z" fill="#0b0806"/>
  <circle cx="-6" cy="150" r="19" fill="#160e0a"/>
  <path d="M0,-14 C-30,26 -40,80 -32,126" stroke="{RIM}" stroke-width="5"
        fill="none" opacity="0.5"/>
</g>"""


def arm_front() -> str:
    """Near arm gripping the hammer. Pivot (0,0) at the shoulder.

    The hammer is part of this piece so the whole limb swings as one bone —
    the strike reads as a single heavy motion.
    """
    return f"""
<g>
  <!-- upper arm + forearm -->
  <path d="M0,0 C20,30 30,66 30,104 C30,132 14,146 -4,142 C-20,138 -22,116 -16,92
           C-8,60 -8,30 -14,4 Z" fill="#140d09"/>
  <path d="M0,0 C20,30 30,66 30,104" stroke="{RIM}" stroke-width="6"
        fill="none" opacity="0.8"/>
  <!-- fist -->
  <circle cx="8" cy="140" r="21" fill="#1c120c" stroke="{RIM}" stroke-width="3"
          opacity="0.95"/>
  <!-- hammer: haft then head, extending past the fist -->
  <g transform="translate(8,140) rotate(-8)">
    <rect x="-7" y="-96" width="14" height="150" rx="6" fill="#3a2418"
          stroke="#5c3a24" stroke-width="2"/>
    <g transform="translate(0,-104)">
      <rect x="-46" y="-26" width="92" height="52" rx="9" fill="url(#steel)"
            stroke="#eef3f6" stroke-width="3"/>
      <rect x="-46" y="-26" width="26" height="52" rx="9" fill="#ffffff" opacity="0.18"/>
      <rect x="30" y="-20" width="18" height="40" rx="6" fill="{RIM}" opacity="0.55"/>
    </g>
  </g>
</g>"""


# name -> (art, pivot within the cell)
PARTS = [
    ("body", body(), (CELL // 2, 340)),
    ("head", head(), (CELL // 2, 300)),
    ("armBack", arm_back(), (CELL // 2, 150)),
    ("armFront", arm_front(), (CELL // 2, 150)),
]


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    rows = (len(PARTS) + COLS - 1) // COLS
    w, h = COLS * CELL, rows * CELL
    tiles, frames = [], {}
    for i, (name, art, (px, py)) in enumerate(PARTS):
        cx, cy = (i % COLS) * CELL, (i // COLS) * CELL
        tiles.append(f'<g transform="translate({cx + px},{cy + py})">{art}</g>')
        frames[name] = {"x": cx, "y": cy, "w": CELL, "h": CELL,
                        "pivot": {"x": px, "y": py}}

    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}">'
           f'{defs()}{"".join(tiles)}</svg>')
    (OUT / "character.html").write_text(
        "<!doctype html><meta charset='utf-8'>"
        "<style>html,body{margin:0;padding:0;background:transparent}"
        f"svg{{display:block;width:{w}px;height:{h}px}}</style>{svg}")
    (OUT / "character.json").write_text(json.dumps(
        {"image": "character.png", "cell": CELL, "size": {"w": w, "h": h},
         "frames": frames}, indent=2))
    print(f"character: {len(PARTS)} rig parts, {w}x{h} -> {OUT}")


if __name__ == "__main__":
    build()
