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


def optimize_with_maxwin(payouts, cost, rtp, cap_mult, p_max, tol=1e-9):
    """Exact-RTP optimize while pinning the total probability of MAX-WIN books.

    Max-win books (payoutMultiplier == cap_mult) collectively receive probability
    `p_max` (a realistic, chosen target — the SDK 'wincap quota' idea). Non-cap
    books are exp-tilted to carry the residual RTP. This keeps the headline
    max-win frequency sane instead of letting the free tilt over-concentrate it.

    Returns OptResult where `weights` sum to N and reproduce (rtp, p_max) exactly.
    """
    n = len(payouts)
    cap_idx = [i for i, p in enumerate(payouts) if p >= cap_mult]
    non_idx = [i for i, p in enumerate(payouts) if p < cap_mult]
    if not cap_idx:
        raise ValueError("no max-win books in pool")
    if not non_idx:
        raise ValueError("pool is only max-win books")

    target_mean = rtp * cost * 100.0
    # overall mean = p_max*cap + (1-p_max)*mean_noncap  =>  solve mean_noncap
    mean_noncap = (target_mean - p_max * cap_mult) / (1.0 - p_max)
    non_payouts = [payouts[i] for i in non_idx]
    if not (min(non_payouts) <= mean_noncap <= max(non_payouts)):
        raise ValueError(
            f"residual non-cap mean {mean_noncap:.1f} outside "
            f"[{min(non_payouts)}, {max(non_payouts)}] — adjust p_max or generation")

    sub = optimize_weights(non_payouts, cost, mean_noncap / (cost * 100.0), tol=tol)
    # assemble full weight vector (sum = n)
    weights = [0.0] * n
    # non-cap: scale sub-weights (which sum to len(non_idx)) to total mass (1-p_max)*n
    s_noncap = sum(sub.weights)
    for w, i in zip(sub.weights, non_idx):
        weights[i] = w / s_noncap * (1.0 - p_max) * n
    # cap: split p_max*n equally
    for i in cap_idx:
        weights[i] = p_max * n / len(cap_idx)

    W = sum(weights)
    achieved_mean = sum(weights[i] * payouts[i] for i in range(n)) / W
    ess = (W ** 2) / sum(w * w for w in weights)
    return OptResult(
        weights=weights, lam=sub.lam, achieved_mean=achieved_mean,
        achieved_rtp=achieved_mean / (cost * 100.0),
        ess=ess, max_share=max(weights) / W, iterations=sub.iterations,
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
