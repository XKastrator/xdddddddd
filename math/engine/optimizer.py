"""Weight optimizer: assign a probability weight to every generated book so the
weighted RTP hits the target exactly, with the *least* distortion of the natural
(Monte-Carlo) shape.

Method — maximum-entropy exponential tilt:
    w_i  =  base_i * exp(lambda * x_i)
choose the single scalar `lambda` so that  sum(w_i x_i) / sum(w_i) = target_mean,
where x_i is the integer payoutMultiplier and target_mean = rtp * cost * 100.

This is the minimum-KL reweighting subject to a mean constraint, so when the
natural pool is already close to target (as ours is), lambda is small and the
distribution is barely perturbed. We report the Effective Sample Size and the
largest single-book weight share as health metrics.

This mirrors, in spirit, the SDK's optimization step (which reshapes discrete
outcome weights to a target RTP) while being fully transparent and deterministic.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass
class OptResult:
    weights: list          # float weights, same order as payouts
    lam: float             # solved tilt parameter
    achieved_mean: float   # weighted mean payoutMultiplier
    achieved_rtp: float
    ess: float             # effective sample size (0..N)
    max_share: float       # largest single-book weight share
    iterations: int


def _stable_weights(y, lam):
    """exp(lam*y) normalised, computed with a max-subtraction for stability."""
    m = max((lam * yi) for yi in y) if y else 0.0
    return [math.exp(lam * yi - m) for yi in y]


def _weighted_mean(payouts, y, lam):
    w = _stable_weights(y, lam)
    den = sum(w)
    num = sum(wi * x for wi, x in zip(w, payouts))
    return num / den if den else 0.0


def optimize_weights(payouts, cost, rtp, tol=1e-9, max_iter=300):
    """payouts: list[int] payoutMultiplier (x100). cost: bet-mode cost multiplier.

    Tilt in NORMALISED space y=x/scale so exponents stay bounded regardless of
    the max-win anchor. Returns OptResult (weights normalised to sum = N).
    """
    n = len(payouts)
    if n == 0:
        raise ValueError("empty pool")
    target_mean = rtp * cost * 100.0
    if not (min(payouts) <= target_mean <= max(payouts)):
        raise ValueError(
            f"target mean {target_mean:.1f} outside pool range "
            f"[{min(payouts)}, {max(payouts)}] — widen generation")

    scale = float(max(payouts)) or 1.0
    y = [x / scale for x in payouts]            # in [0, 1]

    # mean is monotonically increasing in lambda; bracket then bisect
    lam_lo, lam_hi = -1.0, 1.0
    it = 0
    while _weighted_mean(payouts, y, lam_lo) > target_mean and it < 2000:
        lam_lo *= 2; it += 1
    while _weighted_mean(payouts, y, lam_hi) < target_mean and it < 4000:
        lam_hi *= 2; it += 1
    lam = 0.0
    for it in range(max_iter):
        lam = 0.5 * (lam_lo + lam_hi)
        m = _weighted_mean(payouts, y, lam)
        if abs(m - target_mean) <= tol * max(1.0, target_mean):
            break
        if m < target_mean:
            lam_lo = lam
        else:
            lam_hi = lam

    raw = _stable_weights(y, lam)
    s = sum(raw)
    weights = [w * n / s for w in raw]          # normalise to sum = n
    ess = (sum(weights) ** 2) / sum(w * w for w in weights)
    max_share = max(weights) / sum(weights)
    achieved_mean = _weighted_mean(payouts, y, lam)
    return OptResult(
        weights=weights, lam=lam, achieved_mean=achieved_mean,
        achieved_rtp=achieved_mean / (cost * 100.0),
        ess=ess, max_share=max_share, iterations=it + 1,
    )


def to_integer_weights(weights, precision=10_000):
    """Convert float weights to positive uint64-safe integers for the lookup CSV.

    The smallest positive weight maps to ~`precision`, preserving ratios up to
    rounding while keeping enough resolution for an accurate weighted RTP.
    """
    wmin = min(w for w in weights if w > 0)
    return [max(1, int(round(w / wmin * precision))) for w in weights]


def integer_weighted_rtp(payouts, int_weights, cost):
    num = sum(p * w for p, w in zip(payouts, int_weights))
    den = sum(int_weights) * cost * 100.0
    return num / den if den else 0.0
