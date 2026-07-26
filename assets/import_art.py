"""Import the delivered artwork into the game's asset layout.

The delivered masters live in `assets/source/`: 1254px illustrations on a flat
magenta key, plus three opaque far-plane scenes and a lobby thumbnail. This
script does the whole conversion:

    chroma key      magenta -> straight alpha, with despill on the edge ring
    trim + centre   every symbol gets the same optical size in its cell
    pack            13 symbols -> atlas.webp (256px cells) + atlas.json
    scenes          far -> JPEG, mid/near -> transparent WebP
    character       single transparent illustration
    lobby           square JPEG tile

Keying uses a FLOOD FILL from the image border, not a plain colour distance.
The amethyst ore and the molten-gold highlights come close enough to the key in
RGB that a distance threshold either eats the artwork or leaves a magenta halo;
filling from the outside can only ever remove background that is actually
connected to the border.

    python3 assets/import_art.py
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "source"             # delivered masters
OUT = ROOT / "frontend" / "public" / "assets"

CELL = 256          # atlas cell
ART = 236           # how much of the cell the artwork occupies
COLS = 4
SCENE_PX = 1024
LOBBY_PX = 512

# delivered file -> atlas frame name (the names AssetLoader.FRAME_OF expects)
SYMBOLS: list[tuple[str, str]] = [
    ("sym 1.png", "O1"),
    ("sym 2 (2).png", "O2"),
    ("sym 3 (2).png", "O3"),
    ("sym 4 (2).png", "O4"),
    ("sym 5 (2).png", "O5"),
    ("sym bronze.png", "BRONZE"),
    ("sym mlot.png", "IRON"),
    ("sym shield.png", "SILVER"),
    ("sym gold.png", "GOLD"),
    ("sym sword.png", "MYTHRIL"),
    ("sym crown.png", "CROWN"),
    ("sym kropla.png", "FLUX"),
    ("sym star.png", "CINDER"),
]

SCENES_FAR = {
    "base": "scene base.png",
    "bonus": "scene bonus.png",
    "super": "scene super bonus.png",
}
SCENES_MID = {
    "base": "scene mid base.png",
    "bonus": "scene mid bonus.png",
    "super": "scene mid super bous.png",
}
NEAR_SRC = "scene near.png"

# --------------------------------------------------------------------------- #
# chroma key
# --------------------------------------------------------------------------- #
KEY_RADIUS = 130        # RGB distance that still counts as "could be background"
FEATHER_LO, FEATHER_HI = 0.22, 0.72


def _box_blur(a: np.ndarray, k: int = 3) -> np.ndarray:
    return ndimage.uniform_filter(a, size=k, mode="nearest")


def chroma_key(im: Image.Image) -> Image.Image:
    """Magenta -> alpha. Returns RGBA with despilled edges."""
    rgb = np.asarray(im.convert("RGB"), dtype=np.float32)
    h, w, _ = rgb.shape

    # the key colour is whatever the border actually is, not a nominal #FF00FF —
    # the delivered files are lossy and the border drifts by a dozen levels
    border = np.concatenate([
        rgb[0:3].reshape(-1, 3), rgb[h - 3:h].reshape(-1, 3),
        rgb[:, 0:3].reshape(-1, 3), rgb[:, w - 3:w].reshape(-1, 3),
    ])
    key = np.median(border, axis=0)

    dist = np.linalg.norm(rgb - key, axis=2)
    candidate = dist < KEY_RADIUS

    # keep only the region connected to the border: interior pixels that happen
    # to sit near the key in RGB (violet crystal, hot pink rim light) survive
    labels, n = ndimage.label(candidate)
    if n:
        edge_labels = set(labels[0].tolist()) | set(labels[-1].tolist()) \
            | set(labels[:, 0].tolist()) | set(labels[:, -1].tolist())
        edge_labels.discard(0)

        # ENCLOSED background also has to go. The gap between the smith's
        # forearm and his hammer haft is a hole in the silhouette, not connected
        # to the border, and border-only filling left a magenta streak sitting on
        # the character. Such holes are near-PURE key colour, whereas the closest
        # artwork (amethyst crystal, hot pink rim light) is >100 away, so a tight
        # mean-distance test removes them without touching anything painted.
        ids = np.arange(1, n + 1)
        means = ndimage.mean(dist, labels=labels, index=ids)
        sizes = ndimage.sum(np.ones_like(dist), labels=labels, index=ids)
        enclosed = {int(i) for i, m, sz in zip(ids, means, sizes)
                    if m < 40.0 and sz >= 150}
        bg = np.isin(labels, list(edge_labels | enclosed))
    else:
        bg = np.zeros_like(candidate)

    # soften the 1-2px aliased ring without eating into the interior
    alpha = _box_blur((~bg).astype(np.float32), 3)
    alpha = np.clip((alpha - FEATHER_LO) / (FEATHER_HI - FEATHER_LO), 0.0, 1.0)

    # Despill the semi-transparent ring: magenta contaminates R and B equally,
    # so pull both back toward G by the excess. Without this every symbol keeps
    # a pink halo that is obvious against a dark board.
    ring = (alpha > 0.0) & (alpha < 0.995)
    spill = np.clip((rgb[..., 0] + rgb[..., 2]) * 0.5 - rgb[..., 1], 0, None)
    rgb[..., 0] = np.where(ring, rgb[..., 0] - spill * 0.85, rgb[..., 0])
    rgb[..., 2] = np.where(ring, rgb[..., 2] - spill * 0.85, rgb[..., 2])

    # Fully transparent pixels must not carry magenta: bilinear sampling on the
    # GPU blends their RGB into the visible edge regardless of alpha.
    rgb[alpha <= 0.0] = 0.0

    out = np.dstack([np.clip(rgb, 0, 255), alpha * 255.0]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def trim(im: Image.Image) -> Image.Image:
    """Crop to the alpha bounding box."""
    a = np.asarray(im)[..., 3]
    ys, xs = np.nonzero(a > 8)
    if not len(ys):
        return im
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def fit_cell(im: Image.Image, box: int) -> Image.Image:
    """Scale the longest side to `box` and centre it in a CELL square.

    Fitting the LONGEST side (rather than area or height) is what makes a wide
    hammer and a tall sword read as the same size on the grid.
    """
    w, h = im.size
    s = box / max(w, h)
    im = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    cell.paste(im, ((CELL - im.width) // 2, (CELL - im.height) // 2))
    return cell


def dominant_hue(im: Image.Image) -> str:
    """Reported so the ore->variant mapping can be eyeballed from the log."""
    a = np.asarray(im.convert("RGBA")).astype(np.float32)
    m = a[..., 3] > 200
    if not m.any():
        return "—"
    r, g, b = a[..., 0][m].mean(), a[..., 1][m].mean(), a[..., 2][m].mean()
    return f"rgb({r:.0f},{g:.0f},{b:.0f})"


def warm_grade(im: Image.Image, amount: float) -> Image.Image:
    """Push an image warmer/hotter — used so the shared foreground plane still
    reacts when the round heats up."""
    a = np.asarray(im).astype(np.float32)
    a[..., 0] = np.clip(a[..., 0] * (1 + 0.28 * amount) + 14 * amount, 0, 255)
    a[..., 1] = np.clip(a[..., 1] * (1 + 0.06 * amount), 0, 255)
    a[..., 2] = np.clip(a[..., 2] * (1 - 0.16 * amount), 0, 255)
    return Image.fromarray(a.astype(np.uint8), im.mode)


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    # ---- symbol atlas ----------------------------------------------------- #
    rows = (len(SYMBOLS) + COLS - 1) // COLS
    sheet = Image.new("RGBA", (COLS * CELL, rows * CELL), (0, 0, 0, 0))
    frames: dict[str, dict[str, int]] = {}

    print("symbols:")
    for i, (src, name) in enumerate(SYMBOLS):
        path = SRC / src
        if not path.exists():
            raise SystemExit(f"missing source file: {src}")
        art = fit_cell(trim(chroma_key(Image.open(path))), ART)
        x, y = (i % COLS) * CELL, (i // COLS) * CELL
        sheet.paste(art, (x, y))
        frames[name] = {"x": x, "y": y, "w": CELL, "h": CELL}
        print(f"  {name:8s} <- {src:18s} {dominant_hue(art)}")

    # WebP everywhere alpha is needed: the same atlas is 1069 kB as PNG and
    # 224 kB as WebP, and a slot that ships 7 MB of art loses players on mobile
    # before the first spin. Opaque scenes stay JPEG, which is universally safe.
    sheet.save(OUT / "atlas.webp", "WEBP", quality=90, method=6)
    (OUT / "atlas.png").unlink(missing_ok=True)
    (OUT / "atlas.json").write_text(json.dumps({
        "image": "atlas.webp", "cell": CELL,
        "size": {"w": sheet.width, "h": sheet.height},
        "frames": frames,
    }, indent=2))
    print(f"  -> atlas.webp {sheet.width}x{sheet.height} "
          f"({(OUT / 'atlas.webp').stat().st_size / 1024:.0f} kB)")

    # ---- scenes ----------------------------------------------------------- #
    print("scenes:")
    for name, src in SCENES_FAR.items():
        im = Image.open(SRC / src).convert("RGB").resize(
            (SCENE_PX, SCENE_PX), Image.LANCZOS)
        dst = OUT / f"scene_{name}.jpg"
        im.save(dst, quality=84, optimize=True)
        print(f"  far  {name:6s} -> {dst.name} ({dst.stat().st_size / 1024:.0f} kB)")

    for name, src in SCENES_MID.items():
        im = chroma_key(Image.open(SRC / src)).resize(
            (SCENE_PX, SCENE_PX), Image.LANCZOS)
        dst = OUT / f"scene_{name}_mid.webp"
        im.save(dst, "WEBP", quality=86, method=6)
        (OUT / f"scene_{name}_mid.png").unlink(missing_ok=True)
        print(f"  mid  {name:6s} -> {dst.name} ({dst.stat().st_size / 1024:.0f} kB)")

    # One foreground plane was delivered; it is shared across all three states
    # and graded warmer as the round heats up, so the near plane still reacts.
    near = chroma_key(Image.open(SRC / NEAR_SRC)).resize(
        (SCENE_PX, SCENE_PX), Image.LANCZOS)
    for name, amount in (("base", 0.0), ("bonus", 0.45), ("super", 1.0)):
        im = near if amount == 0 else warm_grade(near, amount)
        dst = OUT / f"scene_{name}_near.webp"
        im.save(dst, "WEBP", quality=86, method=6)
        (OUT / f"scene_{name}_near.png").unlink(missing_ok=True)
        print(f"  near {name:6s} -> {dst.name} ({dst.stat().st_size / 1024:.0f} kB)")

    # ---- character -------------------------------------------------------- #
    ch = trim(chroma_key(Image.open(SRC / "character.png")))
    scale = 1200 / ch.height
    ch = ch.resize((round(ch.width * scale), 1200), Image.LANCZOS)
    ch.save(OUT / "character.webp", "WEBP", quality=90, method=6)
    # the delivered figure is one illustration, not the old part-based rig, so
    # both the rig sheet and its pivot metadata are retired here
    (OUT / "character.png").unlink(missing_ok=True)
    (OUT / "character.json").unlink(missing_ok=True)
    print(f"character -> character.webp {ch.width}x{ch.height} "
          f"({(OUT / 'character.webp').stat().st_size / 1024:.0f} kB)")

    # ---- lobby tile ------------------------------------------------------- #
    lobby = Image.open(SRC / "thumbnail.png").convert("RGB").resize(
        (LOBBY_PX, LOBBY_PX), Image.LANCZOS)
    lobby.save(OUT / "lobby.jpg", quality=88, optimize=True)
    print(f"lobby     -> lobby.jpg ({(OUT / 'lobby.jpg').stat().st_size / 1024:.0f} kB)")


if __name__ == "__main__":
    build()
