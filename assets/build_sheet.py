#!/usr/bin/env python3
"""
build_sheet.py — turn four generated key frames into a looping spritesheet.

Image generators cannot draw a spritesheet (see SPRITESHEET_PROMPTS.md §0), so
they draw four key frames of a heat ramp and this makes the loop. Three jobs:

  1. key out the magenta backing and despill the fringe it leaves
  2. normalise every frame to the same trimmed, centred cell
  3. ping-pong the keys into a seamless loop and pack them into one strip

The ping-pong matters: a heat ramp played 1-2-3-4 and then jumped back to 1
pops, because frame 4 (white hot) is nothing like frame 1 (cold). Walking back
down 3-2 costs no extra artwork and the loop closes on itself.

    python3 assets/build_sheet.py bronze <cold.png> <warm.png> <hot.png> <white.png>
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

CELL = 256          # output cell size, matching the symbol atlas
FRAMES = 12         # frames in the finished loop
FIT = 0.92          # fraction of the cell the artwork fills


def key_magenta(img: Image.Image) -> Image.Image:
    """Cut the #FF00FF backing, then pull the residual purple out of the edge."""
    a = np.asarray(img.convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]

    # The backing is the only thing that is bright in R and B while dark in G.
    # A generated fill is never exactly #FF00FF, hence the bands rather than ==.
    bg = (r > 170) & (b > 170) & (g < 110)

    # Despill: anywhere magenta is bleeding, R and B sit above G for no reason
    # the artwork can justify. Clamping them to G kills the purple rim without
    # touching genuinely warm pixels, where R is high but B is not.
    spill = np.minimum(r, b) - g
    hot = np.clip(spill, 0, None) * ((r > g) & (b > g))
    r = r - hot * 0.9
    b = b - hot * 0.9

    # SOFT key, not a hard one. A glow drawn over the backing blends orange
    # into magenta, and the result is pink but nowhere near #FF00FF — a hard
    # threshold leaves it opaque and the finished frame wears a pink halo.
    # Alpha falls off with how magenta a pixel is, so the corona keeps its
    # brightness and loses its colour cast.
    magenta = np.clip(spill / 70.0, 0, 1)
    alpha = np.where(bg, 0.0, 255.0 * (1.0 - magenta))

    out = np.dstack([r, g, b, alpha]).clip(0, 255).astype(np.uint8)
    # RGB under zero alpha must be zeroed or it bleeds back in when scaled
    out[alpha == 0] = 0
    return Image.fromarray(out, 'RGBA')


def fit_cell(img: Image.Image) -> Image.Image:
    """Trim to the artwork and centre it in a CELL square at a fixed scale."""
    box = img.getbbox()
    if box:
        img = img.crop(box)
    side = max(img.size)
    target = int(CELL * FIT)
    scale = target / side
    img = img.resize((max(1, round(img.width * scale)),
                      max(1, round(img.height * scale))), Image.LANCZOS)
    cell = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    cell.alpha_composite(img, ((CELL - img.width) // 2, (CELL - img.height) // 2))
    return cell


def loop(keys: list[Image.Image]) -> list[Image.Image]:
    """Ping-pong the keys and crossfade between them to FRAMES frames."""
    path = keys + keys[-2:0:-1]          # 1 2 3 4 3 2
    out = []
    for i in range(FRAMES):
        t = i / FRAMES * len(path)
        a = path[int(t) % len(path)]
        b = path[(int(t) + 1) % len(path)]
        out.append(Image.blend(a, b, t - int(t)))
    return out


def main() -> int:
    if len(sys.argv) < 6:
        print(__doc__)
        return 2
    name, paths = sys.argv[1], sys.argv[2:6]
    keys = [fit_cell(key_magenta(Image.open(p))) for p in paths]
    frames = loop(keys)

    sheet = Image.new('RGBA', (CELL * len(frames), CELL), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f, (i * CELL, 0), f)

    for out in (Path('frontend/public/assets'), Path('assets/build')):
        out.mkdir(parents=True, exist_ok=True)
        sheet.save(out / f'sym_{name}_win.png')
    print(f'sym_{name}_win.png — {len(frames)} frames, {sheet.width}x{sheet.height}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
