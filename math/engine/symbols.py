"""Symbol and rank definitions for the MOLTEN CROWN forge ladder.

Design intent (see GDD.md):
  * Rank 0 is *raw ore* and comes in several visually distinct VARIANTS
    (O1..O5). Variants only fuse with their own kind, which keeps 4+ connected
    same-symbol groups genuinely rare -> real dead spins and tunable volatility.
  * Fusing 4+ connected identical cells produces ONE cell of the next rank.
    Every rank >= 1 is a single symbol: BRONZE -> IRON -> SILVER -> GOLD ->
    MYTHRIL -> CROWN.
  * Payout is per fusion PRODUCT (value(new_symbol) x Heat) at the moment it is
    forged. No fusion in a spin => dead spin => zero pay. This makes hit-rate and
    RTP directly controllable, unlike "pay every relic on the board".
  * Heat (a global multiplier) is EARNED: +1 per fusion. It is not a random orb.
"""

from __future__ import annotations

from dataclasses import dataclass

# --- Symbol ids ---------------------------------------------------------------
EMPTY = 0
# rank-0 raw-ore variants (pay 0; fuel for the ladder)
O1 = 1
O2 = 2
O3 = 3
O4 = 4
O5 = 5
# single-symbol ranks 1..6
BRONZE = 6    # rank 1
IRON = 7      # rank 2
SILVER = 8    # rank 3
GOLD = 9      # rank 4
MYTHRIL = 10  # rank 5
CROWN = 11    # rank 6 - top relic / max-win trophy
WILD = 12     # "Flux" - joker joining one adjacent fusion group, pays 0
SCATTER = 13  # "Cinder" - bonus trigger, never fuses, pays 0

ORE_VARIANTS = (O1, O2, O3, O4, O5)

NAME = {
    EMPTY: "EMPTY", O1: "ORE_EMBER", O2: "ORE_SLAG", O3: "ORE_ASH",
    O4: "ORE_COAL", O5: "ORE_SOOT", BRONZE: "BRONZE", IRON: "IRON",
    SILVER: "SILVER", GOLD: "GOLD", MYTHRIL: "MYTHRIL", CROWN: "CROWN",
    WILD: "FLUX", SCATTER: "CINDER",
}

# ladder rank per symbol (None => not on the ladder)
RANK = {O1: 0, O2: 0, O3: 0, O4: 0, O5: 0,
        BRONZE: 1, IRON: 2, SILVER: 3, GOLD: 4, MYTHRIL: 5, CROWN: 6}
# canonical symbol for ranks 1..6 (rank 0 has variants -> no single symbol)
SYMBOL_OF_RANK = {1: BRONZE, 2: IRON, 3: SILVER, 4: GOLD, 5: MYTHRIL, 6: CROWN}

MIN_PAYING_RANK = 1      # BRONZE and above pay (ore variants pay 0)
TOP_RANK = 6             # CROWN
FUSE_THRESHOLD = 4       # 4+ connected identical cells fuse up one rank


def rank_of(sym: int):
    return RANK.get(sym)


def is_ladder(sym: int) -> bool:
    """True for any ore variant or relic (participates in fusion)."""
    return sym in RANK


def next_symbol(sym: int) -> int:
    """Symbol produced by fusing `sym` (must have rank < TOP_RANK)."""
    return SYMBOL_OF_RANK[RANK[sym] + 1]


def is_relic(sym: int) -> bool:
    r = RANK.get(sym)
    return r is not None and r >= MIN_PAYING_RANK


@dataclass(frozen=True)
class Paytable:
    """Rank index -> base value (x bet) of a forged product, before Heat.

    Final tuned values are validated by simulation (MATH_SPEC.md / PAR_REPORT.md).
    """
    values: dict

    def value_rank(self, rank: int) -> float:
        if rank is None or rank < MIN_PAYING_RANK:
            return 0.0
        return self.values.get(rank, 0.0)

    def value(self, sym: int) -> float:
        return self.value_rank(RANK.get(sym))
