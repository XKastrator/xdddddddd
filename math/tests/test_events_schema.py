"""Validate the event contract: every book conforms to the documented schema,
payoutMultiplier is a non-negative integer, and books are deterministic.

This is the frontend contract guarantee — the frontend can reconstruct any
round purely from these events.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from game.game_config import GameConfig
from game.gamestate import play_book
from engine.rng import Rng

VALID_TYPES = {
    "revealBoard", "anticipation", "forge", "strike", "gravity", "heatUpdate",
    "settleWin", "bonusStart", "spinCounter", "retrigger", "superSeed",
    "lockUpdate", "pour", "totalWinUpdate", "maxWin", "finalWin", "roundEnd",
}
REQUIRED_FIELDS = {
    "revealBoard": {"board", "heat", "spinKind", "scatters"},
    "forge": {"fusions", "heat"},
    "strike": {"veins", "heat"},
    "gravity": {"spawned", "board"},
    "settleWin": {"win", "heat"},
    "bonusStart": {"mode", "spins", "kind"},
    "spinCounter": {"remaining", "total"},
    "pour": {"vault", "heat", "win"},
    "finalWin": {"amount"},
}


def _check_book(bd, cfg):
    assert set(bd.keys()) == {"id", "events", "payoutMultiplier"}, bd.keys()
    pm = bd["payoutMultiplier"]
    assert isinstance(pm, int) and pm >= 0, pm
    assert pm <= int(cfg.wincap * 100), f"exceeds cap: {pm}"
    idxs = []
    for ev in bd["events"]:
        assert "index" in ev and "type" in ev
        assert ev["type"] in VALID_TYPES, ev["type"]
        idxs.append(ev["index"])
        for f in REQUIRED_FIELDS.get(ev["type"], set()):
            assert f in ev, f"{ev['type']} missing {f}"
        if ev["type"] == "strike":
            # A vein the renderer cannot draw is worse than no event: it must
            # carry the path, the Flux cells that bridged it, and the shape it
            # was paid for. Checked here because the front end reconstructs the
            # whole round from these events and nothing else.
            assert ev["veins"], "strike with no veins"
            for v in ev["veins"]:
                assert set(v.keys()) == {"sym", "cells", "wildCells",
                                         "columns", "value"}, v.keys()
                assert v["cells"], "vein with no ore cells"
                rows = {r for r, _ in v["cells"] + v["wildCells"]}
                assert 0 in rows, "vein does not touch the seam"
                assert max(rows) == cfg.num_rows - 1, "vein misses the crucible"
                assert 1 <= v["columns"] <= cfg.num_reels, v["columns"]
                assert v["value"] > 0, v["value"]
    # indices are contiguous 0..n-1
    assert idxs == list(range(len(idxs)))
    # a completed round always ends with roundEnd and has a finalWin
    types = [e["type"] for e in bd["events"]]
    assert types[-1] == "roundEnd"
    assert "finalWin" in types
    # finalWin amount matches payoutMultiplier
    final = [e for e in bd["events"] if e["type"] == "finalWin"][-1]
    assert abs(final["amount"] * 100 - pm) <= 1, (final["amount"], pm)


def test_all_modes_schema():
    cfg = GameConfig()
    for mode in ["base", "ante", "bonus", "super"]:
        for i in range(400):
            b = play_book(cfg, mode, i, Rng(1234 + i), record=True)
            _check_book(b.to_dict(), cfg)


def test_forced_maxwin_schema_and_cap():
    cfg = GameConfig()
    for mode in ["base", "bonus", "super"]:
        b = play_book(cfg, mode, 1, Rng(7), record=True, force={"wincap": True})
        bd = b.to_dict()
        _check_book(bd, cfg)
        assert bd["payoutMultiplier"] == int(cfg.wincap * 100)
        assert any(e["type"] == "maxWin" for e in bd["events"])


def test_determinism_same_seed_same_book():
    cfg = GameConfig()
    a = play_book(cfg, "bonus", 5, Rng(99), record=True).to_dict()
    b = play_book(cfg, "bonus", 5, Rng(99), record=True).to_dict()
    assert a == b


if __name__ == "__main__":
    test_all_modes_schema(); print("ok schema (all modes)")
    test_forced_maxwin_schema_and_cap(); print("ok forced maxwin + cap")
    test_determinism_same_seed_same_book(); print("ok determinism")
    print("\nevent-schema tests passed")
