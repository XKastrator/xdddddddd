"""Max-win enforcement and stateless-round guarantees."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from game.game_config import GameConfig
from game.gamestate import play_book
from engine.rng import Rng


def test_no_book_exceeds_cap():
    cfg = GameConfig()
    cap_mult = int(cfg.wincap * 100)
    for mode in ["base", "ante", "bonus", "super"]:
        for i in range(2000):
            b = play_book(cfg, mode, i, Rng(300000 + i), record=False)
            assert b.payout_multiplier() <= cap_mult, (mode, b.payout_multiplier())


def test_forced_wincap_hits_exact_cap_and_terminates():
    cfg = GameConfig()
    cap_mult = int(cfg.wincap * 100)
    for mode in ["base", "bonus", "super"]:
        b = play_book(cfg, mode, 1, Rng(11), record=True, force={"wincap": True})
        bd = b.to_dict()
        assert bd["payoutMultiplier"] == cap_mult
        types = [e["type"] for e in bd["events"]]
        # maxWin appears before the terminal events
        assert "maxWin" in types
        assert types.index("maxWin") < types.index("roundEnd")


def test_round_is_stateless():
    """The same seed produces the same result regardless of prior rounds — no
    cross-bet state (progression) leaks."""
    cfg = GameConfig()
    # play some unrelated rounds first
    for i in range(50):
        play_book(cfg, "base", i, Rng(i), record=False)
    a = play_book(cfg, "base", 777, Rng(777), record=False).payout_multiplier()
    # play more unrelated rounds, then repeat the same seed
    for i in range(123):
        play_book(cfg, "super", i, Rng(i), record=False)
    b = play_book(cfg, "base", 777, Rng(777), record=False).payout_multiplier()
    assert a == b


if __name__ == "__main__":
    test_no_book_exceeds_cap(); print("ok cap enforced")
    test_forced_wincap_hits_exact_cap_and_terminates(); print("ok forced cap")
    test_round_is_stateless(); print("ok stateless")
    print("\nmaxwin tests passed")
