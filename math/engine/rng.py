"""Deterministic RNG wrapper.

Every simulated round is produced from a single integer seed so that any book
can be *exactly* reproduced (Stake Engine deterministic-replay / audit
requirement). The frontend never uses this RNG; it only replays recorded events.
"""

from __future__ import annotations

import random
from typing import Sequence


class Rng:
    """Thin wrapper over Python's Mersenne-Twister with a recorded seed."""

    def __init__(self, seed: int):
        self.seed = int(seed)
        self._r = random.Random(self.seed)

    def choice_weighted(self, symbols: Sequence[int], weights: Sequence[float]) -> int:
        return self._r.choices(symbols, weights=weights, k=1)[0]

    def choices_weighted(self, symbols: Sequence[int], weights: Sequence[float], k: int):
        return self._r.choices(symbols, weights=weights, k=k)

    def random(self) -> float:
        return self._r.random()

    def randint(self, a: int, b: int) -> int:
        return self._r.randint(a, b)

    def shuffle(self, seq) -> None:
        self._r.shuffle(seq)
