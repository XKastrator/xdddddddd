"""Build a small dev fixture of REAL books (weighted-sampled from the published
library) so the browser demo's MockRgs can serve a faithful distribution without
a real RGS. Output: frontend/src/dev/devBooks.json  { mode: [book, ...] }.

Each book is sampled with probability proportional to its published weight, so a
uniform pick from the list reproduces the real distribution. This is a DEV
fixture only — production uses the real RGS.
"""
import csv
import json
import random
from pathlib import Path

import zstandard as zstd

ROOT = Path(__file__).resolve().parents[3]
PUB = ROOT / "math" / "publish_files"
OUT = Path(__file__).resolve().parent / "devBooks.json"
COUNTS = {"base": 100, "ante": 50, "bonus": 60, "super": 50}
random.seed(7)


def load_books(mode):
    dctx = zstd.ZstdDecompressor()
    with open(PUB / f"books_{mode}.jsonl.zst", "rb") as f:
        text = dctx.stream_reader(f).read().decode()
    return {json.loads(l)["id"]: json.loads(l) for l in text.splitlines() if l}


def load_weights(mode):
    ids, ws = [], []
    with open(PUB / f"lookUpTable_{mode}.csv") as f:
        for sid, w, _p in csv.reader(f):
            ids.append(int(sid)); ws.append(int(w))
    return ids, ws


def main():
    out = {}
    for mode, n in COUNTS.items():
        books = load_books(mode)
        ids, ws = load_weights(mode)
        picks = random.choices(ids, weights=ws, k=n)
        out[mode] = [books[i] for i in picks]
        wins = sorted(b["payoutMultiplier"] / 100 for b in out[mode])
        print(f"{mode}: {n} books  min={wins[0]:.2f}x med={wins[n//2]:.2f}x max={wins[-1]:.0f}x")
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
