"""Write Stake Engine publication files in the exact documented format.

Per docs/rgs_docs/data_format.md, one bet mode needs three files:
  * index.json         -> {"modes":[{name, cost, events, weights}, ...]}
  * lookUpTable_*.csv   -> rows of uint64: simulation_id, round_probability, payoutMultiplier
  * books_*.jsonl.zst   -> one JSON object per line: {id, events, payoutMultiplier}, zstd-compressed

The three id/payoutMultiplier keys are required for every round. payoutMultiplier
is an integer where 1150 == 11.5x.
"""

from __future__ import annotations

import io
import json
import os

import zstandard as zstd


def write_books_jsonl_zst(path: str, books: list) -> int:
    """books: list of dicts each already {id, events, payoutMultiplier}."""
    cctx = zstd.ZstdCompressor(level=10)
    buf = io.BytesIO()
    with cctx.stream_writer(buf, closefd=False) as w:
        for b in books:
            line = json.dumps(b, separators=(",", ":")) + "\n"
            w.write(line.encode("utf-8"))
    data = buf.getvalue()
    with open(path, "wb") as f:
        f.write(data)
    return len(data)


def write_lookup_csv(path: str, ids: list, weights: list, payouts: list) -> None:
    """Rows: simulation_id, round_probability(weight), payoutMultiplier — all uint64."""
    with open(path, "w") as f:
        for sid, w, p in zip(ids, weights, payouts):
            f.write(f"{int(sid)},{int(w)},{int(p)}\n")


def write_index(path: str, modes: list) -> None:
    """modes: list of {name, cost, events(filename), weights(filename)}.

    Only the four strictly-required keys are written (extra bookkeeping keys such
    as `_compressed_bytes` are stripped) to satisfy the strict index.json schema.
    """
    clean = [{k: m[k] for k in ("name", "cost", "events", "weights")} for m in modes]
    with open(path, "w") as f:
        json.dump({"modes": clean}, f, indent=2)


def publish_mode(out_dir: str, game_id: str, mode_name: str, cost: float,
                 books: list, ids: list, weights: list, payouts: list) -> dict:
    """Write the two per-mode files, return the index 'mode' entry."""
    os.makedirs(out_dir, exist_ok=True)
    events_file = f"books_{mode_name}.jsonl.zst"
    weights_file = f"lookUpTable_{mode_name}.csv"
    size = write_books_jsonl_zst(os.path.join(out_dir, events_file), books)
    write_lookup_csv(os.path.join(out_dir, weights_file), ids, weights, payouts)
    return {"name": mode_name, "cost": float(cost),
            "events": events_file, "weights": weights_file,
            "_compressed_bytes": size}
