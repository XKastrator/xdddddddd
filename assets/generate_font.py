"""Author the MOLTEN CROWN display typeface — "Emberwright Slab".

There is no bespoke display face available in this environment and a slot that
renders its win counter in the OS UI font reads as a prototype instantly. So the
face is authored here rather than licensed.

Construction: every glyph is a SKELETON of polylines on a 6x10 grid, rendered in
three passes that give it a chiselled, forged look:

    outline    a wide dark stroke  -> the cut edge
    body       the main stroke     -> the face of the letter
    highlight  a thin offset stroke-> light catching the top-left bevel

Glyphs are rendered WHITE so PixiJS can tint them per use: multiply-tinting a
white body with a grey outline yields a darker bevel automatically, so one atlas
serves amber HUD text, gold win counters and white banners.

Digits are drawn on a fixed advance (tabular figures) so counters do not jitter
while they count up.

Output: assets/build/font.html (+ font.json metrics) -> rasterize.mjs
"""
from __future__ import annotations

import json
from pathlib import Path

OUT = Path(__file__).resolve().parent / "build"
CELL = 112          # atlas cell (px)
COLS = 8
GRID_W, GRID_H = 6.0, 10.0     # glyph design grid
MARGIN = 14         # px inset inside the cell

# --- glyph skeletons: list of polylines in grid coordinates -------------------
# x: 0..6 left->right, y: 0..10 top->bottom (cap height 0 -> baseline 10)
G: dict[str, list[list[tuple[float, float]]]] = {
    "0": [[(1, 2), (3, 0.6), (5, 2), (5, 8), (3, 9.4), (1, 8), (1, 2)], [(1.6, 7.6), (4.4, 2.4)]],
    "1": [[(1.4, 2.2), (3, 0.8), (3, 9.4)], [(1.2, 9.4), (4.8, 9.4)]],
    "2": [[(1, 2.4), (3, 0.7), (5, 2.4), (5, 4), (1.2, 9.4), (5, 9.4)]],
    "3": [[(1.2, 1.4), (5, 1.4), (2.6, 4.6), (5, 5.2), (5, 8), (3, 9.4), (1.2, 8.4)]],
    "4": [[(4, 9.4), (4, 0.8), (1, 6.6), (5.2, 6.6)]],
    "5": [[(5, 1), (1.4, 1), (1.2, 4.6), (3.4, 4.2), (5, 5.6), (5, 8), (3, 9.4), (1.2, 8.6)]],
    "6": [[(4.6, 1.2), (2.4, 1.2), (1, 3), (1, 8), (3, 9.4), (5, 8), (5, 6), (3, 4.8), (1.1, 5.8)]],
    "7": [[(1, 1), (5, 1), (2.6, 9.4)]],
    "8": [[(3, 0.8), (5, 2.2), (5, 3.8), (3, 5), (1, 3.8), (1, 2.2), (3, 0.8)],
          [(3, 5), (5, 6.4), (5, 8.2), (3, 9.4), (1, 8.2), (1, 6.4), (3, 5)]],
    "9": [[(1.4, 8.8), (3.6, 8.8), (5, 7), (5, 2), (3, 0.7), (1, 2), (1, 4), (3, 5.2), (4.9, 4.2)]],

    "A": [[(0.9, 9.4), (3, 0.8), (5.1, 9.4)], [(1.7, 6.8), (4.3, 6.8)]],
    "B": [[(1.2, 9.4), (1.2, 1), (4.2, 1), (5, 2.2), (5, 4), (3.6, 5.1), (1.2, 5.1)],
          [(3.6, 5.1), (5.1, 6.3), (5.1, 8.2), (4.2, 9.4), (1.2, 9.4)]],
    "C": [[(5, 2.2), (3.4, 1), (2, 1.6), (1, 3.4), (1, 7), (2, 8.8), (3.4, 9.4), (5, 8.2)]],
    "D": [[(1.2, 9.4), (1.2, 1), (3.8, 1), (5, 2.6), (5, 7.8), (3.8, 9.4), (1.2, 9.4)]],
    "E": [[(5, 1), (1.2, 1), (1.2, 9.4), (5, 9.4)], [(1.2, 5.1), (4.2, 5.1)]],
    "F": [[(5, 1), (1.2, 1), (1.2, 9.4)], [(1.2, 5.1), (4.1, 5.1)]],
    "G": [[(5, 2.2), (3.4, 1), (2, 1.6), (1, 3.4), (1, 7), (2, 8.8), (3.4, 9.4), (5, 8.2), (5, 5.4), (3.4, 5.4)]],
    "H": [[(1.2, 1), (1.2, 9.4)], [(5, 1), (5, 9.4)], [(1.2, 5.1), (5, 5.1)]],
    "I": [[(3, 1), (3, 9.4)], [(1.4, 1), (4.6, 1)], [(1.4, 9.4), (4.6, 9.4)]],
    "J": [[(4.6, 1), (4.6, 7.6), (3.4, 9.3), (1.6, 8.6), (1.2, 7.2)]],
    "K": [[(1.2, 1), (1.2, 9.4)], [(5, 1), (1.2, 5.2), (5, 9.4)]],
    "L": [[(1.2, 1), (1.2, 9.4), (5, 9.4)]],
    "M": [[(1, 9.4), (1, 1), (3, 5.2), (5, 1), (5, 9.4)]],
    "N": [[(1.2, 9.4), (1.2, 1), (5, 9.4), (5, 1)]],
    "O": [[(3, 0.8), (5, 2.4), (5, 8), (3, 9.5), (1, 8), (1, 2.4), (3, 0.8)]],
    "P": [[(1.2, 9.4), (1.2, 1), (4.2, 1), (5.1, 2.4), (5.1, 4.4), (4.2, 5.6), (1.2, 5.6)]],
    "Q": [[(3, 0.8), (5, 2.4), (5, 8), (3, 9.5), (1, 8), (1, 2.4), (3, 0.8)], [(3.6, 7.4), (5.4, 9.8)]],
    "R": [[(1.2, 9.4), (1.2, 1), (4.2, 1), (5.1, 2.4), (5.1, 4.4), (4.2, 5.6), (1.2, 5.6)],
          [(3.2, 5.6), (5.2, 9.4)]],
    "S": [[(5, 2), (3.4, 1), (1.8, 1.6), (1.2, 3.2), (2.2, 4.6), (4.2, 5.4), (5, 6.8), (4.4, 8.8), (2.8, 9.4), (1.2, 8.4)]],
    "T": [[(1, 1), (5, 1)], [(3, 1), (3, 9.4)]],
    "U": [[(1.2, 1), (1.2, 7.6), (3, 9.4), (5, 7.6), (5, 1)]],
    "V": [[(1, 1), (3, 9.4), (5, 1)]],
    "W": [[(0.8, 1), (1.9, 9.4), (3, 4.4), (4.1, 9.4), (5.2, 1)]],
    "X": [[(1.1, 1), (5, 9.4)], [(5, 1), (1.1, 9.4)]],
    "Y": [[(1.1, 1), (3, 5.2), (5, 1)], [(3, 5.2), (3, 9.4)]],
    "Z": [[(1, 1), (5, 1), (1, 9.4), (5, 9.4)]],

    "×": [[(1.6, 3.4), (4.4, 7.4)], [(4.4, 3.4), (1.6, 7.4)]],   # multiplication sign
    "+": [[(3, 2.6), (3, 8.2)], [(1.2, 5.4), (4.8, 5.4)]],
    "-": [[(1.2, 5.4), (4.8, 5.4)]],
    "/": [[(1.2, 9.4), (4.8, 1)]],
    # Punctuation is CENTRED IN ITS OWN ADVANCE, not in the 6-unit design grid.
    # These used to be drawn at x=3 like a full-width letter while advancing only
    # 2.2 units, so a period landed on top of the digit that followed it and the
    # decimal point in "1000.00" was effectively invisible — a money readout with
    # no decimal separator. The ink now sits at bearing + advance/2.
    ":": [[(2.2, 3.2), (2.2, 3.3)], [(2.2, 7.4), (2.2, 7.5)]],
    # a short capsule rather than a zero-length dot: at a 26px cap the dot was
    # 4px across and dissolved into the bevel
    ".": [[(2.05, 9.15), (2.35, 9.15)]],
    ",": [[(2.35, 9.05), (1.85, 10.25)]],
    "%": [[(1.6, 2.2), (1.7, 2.3)], [(4.4, 8.4), (4.5, 8.5)], [(4.8, 1.6), (1.4, 9.2)]],
    "!": [[(3, 1), (3, 6.8)], [(3, 9.2), (3, 9.3)]],
    "?": [[(1.4, 2.4), (3, 1), (4.8, 2.4), (4.6, 4.4), (3, 5.6), (3, 6.8)], [(3, 9.2), (3, 9.3)]],
    "'": [[(3, 1), (3, 2.6)]],
    # chevrons for the mode stepper — the UI needs directional marks
    "<": [[(4.2, 1.8), (1.6, 5.2), (4.2, 8.6)]],
    ">": [[(1.8, 1.8), (4.4, 5.2), (1.8, 8.6)]],
}

# glyphs that must share one advance so counters do not jitter while counting
TABULAR = set("0123456789.,")
NARROW = {"I": 0.62, "J": 0.82, "1": 1.0, ".": 0.54, ",": 0.54, ":": 0.54,
          "!": 0.46, "'": 0.4, "-": 0.8, "/": 0.78, "<": 0.82, ">": 0.82}
WIDE = {"M": 1.14, "W": 1.2, "%": 1.1}


def advance(ch: str) -> float:
    """Advance width in grid units (ink spans ~0.8..5.2, so 5.2 leaves a
    natural sidebearing without the letters touching)."""
    if ch in TABULAR:
        return 5.2 if ch not in (".", ",") else 2.8
    return 5.2 * NARROW.get(ch, WIDE.get(ch, 1.0))


def glyph_svg(strokes) -> str:
    """Render one skeleton as outline + body + highlight."""
    def poly(pts):
        return " ".join(f"{'M' if i == 0 else 'L'}{x:.2f},{y:.2f}"
                        for i, (x, y) in enumerate(pts))
    d = " ".join(poly(p) for p in strokes)
    return f"""
  <path d="{d}" fill="none" stroke="#6e6e6e" stroke-width="2.15"
        stroke-linecap="round" stroke-linejoin="round"/>
  <path d="{d}" fill="none" stroke="#ffffff" stroke-width="1.35"
        stroke-linecap="round" stroke-linejoin="round"/>
  <path d="{d}" fill="none" stroke="#ffffff" stroke-width="0.42"
        stroke-linecap="round" stroke-linejoin="round"
        transform="translate(-0.16,-0.2)" opacity="0.95"/>"""


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    chars = list(G.keys())
    rows = (len(chars) + COLS - 1) // COLS
    w, h = COLS * CELL, rows * CELL

    inner = CELL - MARGIN * 2
    sx = inner / GRID_W
    sy = inner / GRID_H
    scale = min(sx, sy)

    tiles, glyphs = [], {}
    for i, ch in enumerate(chars):
        cx, cy = (i % COLS) * CELL, (i // COLS) * CELL
        tiles.append(
            f'<g transform="translate({cx + MARGIN},{cy + MARGIN}) scale({scale:.4f})">'
            f'{glyph_svg(G[ch])}</g>')
        glyphs[ch] = {
            "x": cx, "y": cy, "w": CELL, "h": CELL,
            # advance in ATLAS pixels at the atlas's own scale; the renderer
            # multiplies by its own scale factor, same as the glyph sprite
            "advance": round(advance(ch) * scale, 2),
        }

    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}">'
           f'{"".join(tiles)}</svg>')
    (OUT / "font.html").write_text(
        "<!doctype html><meta charset='utf-8'>"
        "<style>html,body{margin:0;padding:0;background:transparent}"
        f"svg{{display:block;width:{w}px;height:{h}px}}</style>{svg}")
    (OUT / "font.json").write_text(json.dumps({
        "image": "font.png", "cell": CELL, "size": {"w": w, "h": h},
        # y of the baseline inside a cell, and the cap height, both in px
        "baseline": MARGIN + 9.4 * scale,
        "capHeight": 8.6 * scale,
        "space": round(2.4 * scale, 2),
        "bearing": round(MARGIN + 0.8 * scale, 2),
        "glyphs": glyphs,
    }, indent=2))
    print(f"font: {len(chars)} glyphs, {w}x{h} -> {OUT}")


if __name__ == "__main__":
    build()
