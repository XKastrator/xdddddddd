"""MOLTEN CROWN — generate, optimize, publish, analyse.

Pipeline per bet mode:
  1. Generate a published library of books WITH events (deterministic seeds),
     plus a small quota of forced max-win ("wincap") books so the library can
     actually reach the 15,000x cap.
  2. Optimize per-book weights (max-entropy tilt) so weighted RTP == target.
  3. Write Stake-Engine publication files (index.json + lookup CSV + books.jsonl.zst).
  4. Compute the weighted PAR statistics.
Also runs a large, fast, payout-only validation pass to report the honest
natural (un-reweighted) RTP as an independent check.

Usage:
  python game/run.py                         # quick defaults
  python game/run.py --pub 100000 --val 1000000 --out publish_files
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from engine import analysis, optimizer, publish
from engine.rng import Rng
from game.game_config import GameConfig
from game.gamestate import play_book

MODE_SEED = {"base": 10_000_000, "ante": 20_000_000,
             "bonus": 30_000_000, "super": 40_000_000}
# wincap quota per mode (matches the wincap Distribution quotas in game_config)
WINCAP_QUOTA = {"base": 0.0008, "ante": 0.0010, "bonus": 0.004, "super": 0.006}


def generate_pool(cfg, mode, n_pub, record=True):
    """Return (books_dicts, payouts_x, payouts_mult, criteria)."""
    seed0 = MODE_SEED[mode]
    n_forced = max(20, int(n_pub * WINCAP_QUOTA[mode]))
    books, px, pm, crit = [], [], [], []
    bid = 1
    for i in range(n_pub):
        b = play_book(cfg, mode, bid, Rng(seed0 + i), record=record)
        if record:
            books.append(b.to_dict())
        px.append(b.payout_x); pm.append(b.payout_multiplier()); crit.append(b.criteria)
        bid += 1
    for j in range(n_forced):
        b = play_book(cfg, mode, bid, Rng(seed0 + 900_000_000 + j),
                      record=record, force={"wincap": True})
        if record:
            books.append(b.to_dict())
        px.append(b.payout_x); pm.append(b.payout_multiplier())
        crit.append("wincap")
        bid += 1
    return books, px, pm, crit


def validate_natural(cfg, mode, n_val):
    """Fast payout-only pass -> honest natural stats (no reweighting)."""
    seed0 = MODE_SEED[mode] + 500_000_000
    cost = cfg.mode(mode).cost
    tot = 0.0; hit = 0; wc = 0; mx = 0.0; trig = 0
    for i in range(n_val):
        b = play_book(cfg, mode, i, Rng(seed0 + i), record=False)
        p = b.payout_x
        tot += p
        if p > 0: hit += 1
        if b.wincapped: wc += 1
        if b.criteria in ("freegame", "supergame"): trig += 1
        if p > mx: mx = p
    return {"n": n_val, "natural_rtp": tot / (n_val * cost),
            "hit_rate": hit / n_val, "max_x": mx, "wincaps": wc,
            "trigger_rate": (trig / n_val) if trig else 0.0}


def process_mode(cfg, mode, n_pub, n_val, out_dir):
    bm = cfg.mode(mode)
    t0 = time.time()
    books, px, pm, crit = generate_pool(cfg, mode, n_pub, record=True)
    opt = optimizer.optimize_weights(pm, bm.cost, bm.rtp)
    iw = optimizer.to_integer_weights(opt.weights)
    ach_rtp = optimizer.integer_weighted_rtp(pm, iw, bm.cost)

    ids = [b["id"] for b in books]
    mode_entry = publish.publish_mode(out_dir, cfg.game_id, mode, bm.cost,
                                       books, ids, iw, pm)

    stats = analysis.weighted_stats(px, iw, bm.cost)
    buckets = analysis.bucket_distribution(px, iw)
    p_maxwin = analysis.prob_at_least(px, iw, cfg.wincap)
    feat = analysis.feature_contribution(px, iw, crit, bm.cost)
    natural = validate_natural(cfg, mode, n_val)

    report = {
        "mode": mode, "cost": bm.cost, "target_rtp": bm.rtp,
        "pool_size": len(books), "forced_wincap_books": len(books) - n_pub,
        "optimizer": {"lambda": opt.lam, "ess": opt.ess,
                       "ess_frac": opt.ess / len(books),
                       "max_weight_share": opt.max_share,
                       "achieved_rtp_float": opt.achieved_rtp,
                       "achieved_rtp_int_weights": ach_rtp},
        "weighted": {**stats, "buckets": buckets,
                      "prob_maxwin": p_maxwin,
                      "prob_maxwin_1_in": (1 / p_maxwin) if p_maxwin else None,
                      "feature_contribution": feat},
        "natural_validation": natural,
        "compressed_bytes": mode_entry["_compressed_bytes"],
        "seconds": round(time.time() - t0, 1),
    }
    return mode_entry, report


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pub", type=int, default=None,
                    help="published books per mode (with events)")
    ap.add_argument("--val", type=int, default=None,
                    help="validation books per mode (fast, payout-only)")
    ap.add_argument("--out", default=None)
    ap.add_argument("--modes", default="base,ante,bonus,super")
    args = ap.parse_args()

    here = Path(__file__).resolve().parents[1]
    out_dir = args.out or str(here / "publish_files")
    cfg = GameConfig()
    modes = args.modes.split(",")

    # sensible per-mode defaults (bonus/super are heavier per book)
    default_pub = {"base": 30000, "ante": 20000, "bonus": 15000, "super": 10000}
    default_val = {"base": 300000, "ante": 150000, "bonus": 80000, "super": 50000}

    index_modes, reports = [], {}
    for mode in modes:
        n_pub = args.pub or default_pub[mode]
        n_val = args.val or default_val[mode]
        print(f"[{mode}] generating {n_pub} published + validating {n_val} ...",
              flush=True)
        entry, rep = process_mode(cfg, mode, n_pub, n_val, out_dir)
        index_modes.append(entry)
        reports[mode] = rep
        o = rep["optimizer"]; w = rep["weighted"]; nat = rep["natural_validation"]
        print(f"  RTP int-weights={o['achieved_rtp_int_weights']:.4f} "
              f"| natural={nat['natural_rtp']:.4f} "
              f"| hit={w['hit_rate']:.3f} vol={w['vol_index']:.1f} "
              f"| ESS={o['ess_frac']:.2f} maxShare={o['max_weight_share']*100:.2f}% "
              f"| P(max)={w['prob_maxwin']:.2e} | {rep['seconds']}s", flush=True)

    publish.write_index(os.path.join(out_dir, "index.json"), index_modes)
    with open(os.path.join(out_dir, "analysis.json"), "w") as f:
        json.dump(reports, f, indent=2)
    print(f"\nWrote {out_dir}/index.json + analysis.json")


if __name__ == "__main__":
    main()
