"""Configuration primitives mirroring the Stake Engine Math SDK.

These classes intentionally use the same names/fields as the official SDK
(`BetMode`, `Distribution`, `Config`) so a game defined here ports cleanly into
`StakeEngine/math-sdk`. See docs: math_docs/gamestate_section/configuration_section.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Distribution:
    """A win-criteria class inside a bet mode.

    `quota` is the target share of *accepted* books that must satisfy `criteria`.
    `conditions` carries generation hints (weights, forced flags) used by the
    round generator to bias sampling toward the criteria.
    """
    criteria: str
    quota: float
    conditions: dict = field(default_factory=dict)
    win_criteria: Optional[float] = None


@dataclass
class BetMode:
    """A purchasable / selectable bet mode.

    Mirrors SDK BetMode: cost multiplier, target rtp, wincap, resume/feature
    flags, and a list of Distribution criteria.
    """
    name: str
    cost: float
    rtp: float
    max_win: float
    distributions: list
    auto_close_disabled: bool = False   # True => bonus is resumable on disconnect
    is_feature: bool = False            # True => frontend keeps mode without re-confirm
    is_buybonus: bool = False           # True => purchased directly (asset swap)


class Config:
    """Base game config. Games subclass and fill `bet_modes`, paytable, weights."""

    def __init__(self):
        self.game_id: str = ""
        self.working_name: str = ""
        self.provider_number: int = 0
        self.num_reels: int = 6
        self.num_rows: int = 5
        self.wincap: float = 0.0
        self.rtp: float = 0.0
        self.bet_modes: list = []

    def mode(self, name: str) -> BetMode:
        for m in self.bet_modes:
            if m.name == name:
                return m
        raise KeyError(f"unknown bet mode: {name}")
