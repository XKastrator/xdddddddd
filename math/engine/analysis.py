"""Weighted distribution analysis for the PAR report.

All statistics are computed on the *published* (weighted) distribution, so they
describe what a player actually experiences, not the raw Monte-Carlo pool.
"""

from __future__ import annotations

import math

# payout buckets in x-bet units (upper-exclusive), matching the brief
BUCKETS = [
    ("0x", 0.0, 1e-9),
    ("0-1x", 1e-9, 1.0),
    ("1-5x", 1.0, 5.0),
    ("5-10x", 5.0, 10.0),
    ("10-50x", 10.0, 50.0),
    ("50-100x", 50.0, 100.0),
    ("100-500x", 100.0, 500.0),
    ("500-1000x", 500.0, 1000.0),
    ("1000-10000x", 1000.0, 10000.0),
    (">10000x", 10000.0, float("inf")),
]


def weighted_stats(payouts_x, weights, cost):
    """payouts_x: list of float x-bet payouts. weights: list of float/int."""
    W = sum(weights)
    mean = sum(p * w for p, w in zip(payouts_x, weights)) / W
    var = sum(w * (p - mean) ** 2 for p, w in zip(payouts_x, weights)) / W
    std = math.sqrt(var)
    rtp = mean / cost
    hit = sum(w for p, w in zip(payouts_x, weights) if p > 0) / W
    # weighted median
    order = sorted(range(len(payouts_x)), key=lambda i: payouts_x[i])
    acc, med = 0.0, 0.0
    for i in order:
        acc += weights[i]
        if acc >= W / 2:
            med = payouts_x[i]
            break
    return {
        "rtp": rtp, "mean_x": mean, "median_x": med, "std_x": std,
        "variance": var, "hit_rate": hit,
        "vol_index": std / cost,     # std of payout in bet units (own volatility measure)
    }


def bucket_distribution(payouts_x, weights):
    W = sum(weights)
    rows = []
    for name, lo, hi in BUCKETS:
        p = sum(w for px, w in zip(payouts_x, weights) if lo <= px < hi) / W
        rows.append((name, p))
    return rows


def prob_at_least(payouts_x, weights, threshold):
    W = sum(weights)
    return sum(w for px, w in zip(payouts_x, weights) if px >= threshold) / W


def feature_contribution(payouts_x, weights, criteria, cost):
    """Share of total RTP coming from each criteria bucket (base/free/super)."""
    W = sum(weights)
    total = sum(px * w for px, w in zip(payouts_x, weights)) / W
    out = {}
    for crit in set(criteria):
        s = sum(px * w for px, w, c in zip(payouts_x, weights, criteria)
                if c == crit) / W
        out[crit] = {"rtp": s / cost, "share": (s / total) if total else 0.0}
    return out
