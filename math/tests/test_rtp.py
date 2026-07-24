"""RTP / optimizer / distribution tests."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from engine import optimizer
from game.game_config import GameConfig
from game.gamestate import play_book
from engine.rng import Rng


def test_optimizer_hits_target_within_tolerance():
    """On a synthetic pool the optimizer must reach the target RTP exactly."""
    # a spread of payoutMultipliers (x100), including zeros and a big tail
    payouts = [0] * 500 + [50, 120, 300, 800, 2000, 5000, 15000 * 100] * 20
    for cost, rtp in [(1.0, 0.965), (100.0, 0.965), (500.0, 0.94)]:
        opt = optimizer.optimize_weights(payouts, cost, rtp)
        assert abs(opt.achieved_rtp - rtp) < 1e-4, (cost, opt.achieved_rtp)
        iw = optimizer.to_integer_weights(opt.weights)
        rtp_int = optimizer.integer_weighted_rtp(payouts, iw, cost)
        assert abs(rtp_int - rtp) < 2e-3, (cost, rtp_int)   # integer rounding tol


def test_pay_equals_events_payout():
    """payoutMultiplier equals the round total from settle/pour events."""
    cfg = GameConfig()
    for mode in ["base", "bonus", "super"]:
        for i in range(300):
            b = play_book(cfg, mode, i, Rng(500 + i), record=True)
            bd = b.to_dict()
            final = [e for e in bd["events"] if e["type"] == "finalWin"][-1]
            assert abs(int(round(final["amount"] * 100)) - bd["payoutMultiplier"]) <= 1


def test_natural_rtp_in_sane_range():
    """Small-sample sanity: each mode's natural RTP is in a plausible band
    (large-scale exact numbers are in PAR_REPORT.md)."""
    cfg = GameConfig()
    # base/ante RTP is dominated by rare feature wins => very high small-sample
    # variance; bands are wide on purpose (exact values live in PAR_REPORT.md).
    for mode, lo, hi in [("base", 0.2, 4.0), ("ante", 0.3, 4.0),
                          ("bonus", 0.5, 1.6), ("super", 0.7, 1.9)]:
        n = 8000
        tot = sum(play_book(cfg, mode, i, Rng(9000 + i), record=False).payout_x
                  for i in range(n))
        rtp = tot / (n * cfg.mode(mode).cost)
        assert lo <= rtp <= hi, f"{mode} natural rtp {rtp:.3f} out of [{lo},{hi}]"


if __name__ == "__main__":
    test_optimizer_hits_target_within_tolerance(); print("ok optimizer target")
    test_pay_equals_events_payout(); print("ok pay == events")
    test_natural_rtp_in_sane_range(); print("ok natural rtp band")
    print("\nrtp tests passed")
