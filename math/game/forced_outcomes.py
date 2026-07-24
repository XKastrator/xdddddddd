"""Generate a labelled catalogue of forced outcomes for QA and frontend replay.

Each entry is a full book (id, events, payoutMultiplier) plus the seed that
produces it, so any scenario is exactly reproducible. Output:
  math/forced/catalog.json      (labelled books, pretty)
  math/forced/<label>.json      (one book each, for the frontend replay harness)

Scenarios cover the brief's list: 0x, small, medium, strong, natural bonus,
retrigger, weak/good/extreme bonus, superbonus, max win, and edge cases.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from game.game_config import GameConfig
from game.gamestate import play_book
from engine.rng import Rng

OUT = Path(__file__).resolve().parents[1] / "forced"


def _has_event(book, etype):
    return any(e["type"] == etype for e in book.events)


def find(cfg, mode, predicate, max_seeds=200000, force=None):
    """Return the first (seed, book) whose book satisfies predicate."""
    for s in range(max_seeds):
        b = play_book(cfg, mode, s, Rng(1_000 + s), record=True, force=force)
        if predicate(b):
            return s, b
    raise RuntimeError(f"no book found for {mode} predicate")


def x(b):
    return b.payout_x


def main():
    cfg = GameConfig()
    OUT.mkdir(exist_ok=True)
    scenarios = []

    def add(label, mode, predicate, force=None):
        s, b = find(cfg, mode, predicate, force=force)
        scenarios.append({
            "label": label, "mode": mode, "seed": s,
            "payoutMultiplier": b.payout_multiplier(),
            "win_x": round(b.payout_x, 4), "criteria": b.criteria,
            "book": b.to_dict(),
        })
        print(f"  {label:22s} mode={mode:5s} seed={s:<7} win={b.payout_x:.2f}x")

    print("Building forced-outcome catalogue...")
    add("dead_spin_0x", "base", lambda b: x(b) == 0 and not _has_event(b, "forge"))
    add("base_small_win", "base", lambda b: 0.5 <= x(b) <= 2.0 and b.criteria == "basegame")
    add("base_medium_win", "base", lambda b: 8 <= x(b) <= 25 and b.criteria == "basegame")
    add("base_strong_win", "base", lambda b: 60 <= x(b) <= 300 and b.criteria == "basegame")
    add("base_natural_bonus", "base", lambda b: b.criteria == "freegame" and x(b) >= 20)
    add("base_bonus_retrigger", "base",
        lambda b: b.criteria == "freegame" and _has_event(b, "retrigger"))
    add("bonus_weak", "bonus", lambda b: x(b) <= 20)
    add("bonus_good", "bonus", lambda b: 60 <= x(b) <= 160)
    add("bonus_extreme", "bonus", lambda b: x(b) >= 500)
    add("bonus_retrigger", "bonus", lambda b: _has_event(b, "retrigger") and x(b) >= 50)
    add("super_typical", "super", lambda b: 200 <= x(b) <= 700)
    add("super_big", "super", lambda b: x(b) >= 2000)
    add("ante_bonus", "ante", lambda b: b.criteria == "freegame" and x(b) >= 30)
    # forced max wins (guaranteed via hot construction)
    add("maxwin_base", "base", lambda b: b.wincapped, force={"wincap": True})
    add("maxwin_bonus", "bonus", lambda b: b.wincapped, force={"wincap": True})
    add("maxwin_super", "super", lambda b: b.wincapped, force={"wincap": True})

    with open(OUT / "catalog.json", "w") as f:
        json.dump({"game_id": cfg.game_id, "scenarios": scenarios}, f, indent=2)
    for sc in scenarios:
        with open(OUT / f"{sc['label']}.json", "w") as f:
            json.dump(sc["book"], f, indent=2)
    print(f"\nWrote {len(scenarios)} scenarios to {OUT}")


if __name__ == "__main__":
    main()
