"""Pre-upload acceptance check for the Stake Engine publish files.

This does NOT trust the simulation log. It re-reads exactly what would be
uploaded — `index.json`, every `lookUpTable_*.csv` and every `books_*.jsonl.zst`
— and recomputes the numbers from those bytes. If a lookup table and its book
library ever disagree, this is what catches it before a certifier does.

Checks per mode:
    format      every CSV row is `simId,weight,payoutMultiplier`, ints, weight > 0
    coverage    every simId in the CSV exists in the books, and vice versa
    agreement   CSV payoutMultiplier == the book's own payoutMultiplier
    RTP         sum(weight * payout) / sum(weight) / 100 / cost
    wincap      no book exceeds the declared max win
    events      every book ends with roundEnd and reports finalWin

    python3 math/tools/verify_publish.py
"""
from __future__ import annotations

import csv
import io
import json
import sys
from fractions import Fraction
from pathlib import Path

import zstandard as zstd

ROOT = Path(__file__).resolve().parents[2]
PUB = ROOT / "math" / "publish_files"

TARGET_RTP = Fraction(965, 1000)
# Integer weights cannot in general land on an exact rational target, so the
# tolerance is what a certifier actually cares about: 1e-6 is 0.0001 percentage
# points of RTP. Measured worst case here is 1.0e-7 (super).
RTP_TOLERANCE = Fraction(1, 1_000_000)
MAX_WIN_X = 15000


def read_books(path: Path) -> dict[int, dict]:
    out: dict[int, dict] = {}
    with open(path, "rb") as fh:
        reader = zstd.ZstdDecompressor().stream_reader(fh)
        for line in io.TextIOWrapper(reader, encoding="utf-8"):
            line = line.strip()
            if not line:
                continue
            b = json.loads(line)
            out[int(b["id"])] = b
    return out


def check_mode(name: str, cost: float, weights_file: str, events_file: str,
               fail: list[str]) -> None:
    lut_path = PUB / weights_file
    books_path = PUB / events_file
    for p in (lut_path, books_path):
        if not p.exists():
            fail.append(f"[{name}] missing {p.name}")
            return

    rows: list[tuple[int, int, int]] = []
    with open(lut_path, newline="") as fh:
        for i, row in enumerate(csv.reader(fh), start=1):
            if len(row) != 3:
                fail.append(f"[{name}] {lut_path.name}:{i} expected 3 columns, got {len(row)}")
                return
            try:
                sim_id, weight, payout = (int(row[0]), int(row[1]), int(row[2]))
            except ValueError:
                fail.append(f"[{name}] {lut_path.name}:{i} non-integer field: {row}")
                return
            if weight <= 0:
                fail.append(f"[{name}] {lut_path.name}:{i} weight must be > 0, got {weight}")
                return
            if payout < 0:
                fail.append(f"[{name}] {lut_path.name}:{i} negative payout {payout}")
                return
            rows.append((sim_id, weight, payout))

    books = read_books(books_path)

    lut_ids = {r[0] for r in rows}
    missing = lut_ids - books.keys()
    orphan = books.keys() - lut_ids
    if missing:
        fail.append(f"[{name}] {len(missing)} simIds in the lookup table have no book "
                    f"(e.g. {sorted(missing)[:5]})")
    if orphan:
        fail.append(f"[{name}] {len(orphan)} books are unreachable from the lookup table "
                    f"(e.g. {sorted(orphan)[:5]})")

    mismatched = 0
    over_cap = 0
    bad_tail = 0
    for sim_id, _w, payout in rows:
        b = books.get(sim_id)
        if b is None:
            continue
        if int(b["payoutMultiplier"]) != payout:
            mismatched += 1
        if payout > MAX_WIN_X * 100:
            over_cap += 1
        types = [e["type"] for e in b["events"]]
        if not types or types[-1] != "roundEnd" or "finalWin" not in types:
            bad_tail += 1
    if mismatched:
        fail.append(f"[{name}] {mismatched} rows disagree with their book's payoutMultiplier")
    if over_cap:
        fail.append(f"[{name}] {over_cap} books exceed the {MAX_WIN_X}x cap")
    if bad_tail:
        fail.append(f"[{name}] {bad_tail} books do not end with finalWin + roundEnd")

    total_w = sum(r[1] for r in rows)
    # Exact rational arithmetic: the whole point of this check is that the RTP
    # is derived from the uploaded bytes, so it must not pick up float error of
    # its own on the way. payoutMultiplier is an integer x100 of the BASE bet,
    # so the mode's cost divides out before this is an RTP.
    rtp = (Fraction(sum(r[1] * r[2] for r in rows), total_w)
           / 100 / Fraction(str(cost)))
    hit = Fraction(sum(r[1] for r in rows if r[2] > 0), total_w)
    p_max = Fraction(sum(r[1] for r in rows if r[2] >= MAX_WIN_X * 100), total_w)

    delta = rtp - TARGET_RTP
    ok = abs(delta) <= RTP_TOLERANCE
    if not ok:
        fail.append(f"[{name}] RTP {float(rtp):.9f} is {float(delta):+.2e} from "
                    f"{float(TARGET_RTP)} (tolerance {float(RTP_TOLERANCE):.0e})")

    print(f"  {name:6s} cost {cost:6.2f}x  sims {len(rows):>7,}  "
          f"RTP {float(rtp) * 100:.5f}% ({float(delta):+.1e})  "
          f"hit {float(hit) * 100:5.2f}%  "
          f"P(max) {'1/%d' % round(1 / p_max) if p_max else 'none':>12s}  "
          f"{'OK' if ok else 'FAIL'}")


def main() -> int:
    index_path = PUB / "index.json"
    if not index_path.exists():
        print(f"missing {index_path}", file=sys.stderr)
        return 1
    index = json.loads(index_path.read_text())

    fail: list[str] = []
    print(f"verifying {PUB}")
    for m in index["modes"]:
        check_mode(m["name"], float(m["cost"]), m["weights"], m["events"], fail)

    total = sum((PUB / f).stat().st_size for f in
                [m["events"] for m in index["modes"]]
                + [m["weights"] for m in index["modes"]] + ["index.json"])
    print(f"  upload payload: {total / 1024 / 1024:.1f} MB")

    if fail:
        print("\nFAILED:")
        for f in fail:
            print(f"  - {f}")
        return 1
    print("\nAll publish-file checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
