"""MOLTEN CROWN — game configuration.

All numeric knobs live here so tuning is centralised. Final values are the ones
validated by simulation (see MATH_SPEC.md / PAR_REPORT.md). Parameter meaning:

* ``drop_weights_*`` : per-cell categorical weights for board fill / refill.
* ``paytable``       : per-relic base value (x bet) summed at settle, x Heat.
* ``heat_cap_*``     : maximum Heat multiplier per mode.
* Heat = 1 + cumulative fusions (base: resets each spin; bonus/super: persists).
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from engine import symbols as S
from engine.config import Config, BetMode, Distribution


class GameConfig(Config):
    def __init__(self):
        super().__init__()
        self.game_id = "molten_crown"
        self.working_name = "Molten Crown"
        self.provider_number = 1
        self.num_reels = 6
        self.num_rows = 5
        self.wincap = 15000.0          # max win (x bet)
        self.rtp = 0.965

        # --- Paytable: forged-product rank -> base value (x bet), before Heat --
        self.paytable = S.Paytable(values={
            1: 0.03,    # BRONZE (token; keeps small-win rhythm alive)
            2: 0.45,    # IRON
            3: 3.00,    # SILVER
            4: 18.0,    # GOLD
            5: 95.0,    # MYTHRIL
            6: 700.0,   # CROWN
        })

        # --- Drop-weight model (rank-0 ore variants + wild + cinder) ----------
        # Bronze+ never appear on fill; they exist only as fusion products.
        self.symbols = [S.O1, S.O2, S.O3, S.O4, S.O5, S.WILD, S.SCATTER]
        #                O1     O2    O3    O4    O5   WILD  CINDER
        self.drop_weights_base  = [18.0, 18.0, 18.0, 18.0, 18.0, 3.0, 1.10]
        # BONUS (Forge Fury): 4 denser variants + more Flux => longer chains,
        # bigger jumps, higher Heat under persistence (the bonus dynamic).
        self.drop_weights_bonus = [22.0, 22.0, 22.0, 22.0, 0.0, 7.0, 1.10]
        # STOKED ante: more Cinders (higher trigger) + a bit more Flux
        self.drop_weights_ante  = [17.0, 17.0, 17.0, 17.0, 17.0, 4.0, 2.00]

        # SUPER (Molten Core): pre-seeded high but diluted with ore so fusions
        # are not guaranteed; Heat capped LOW so Vault x Heat stays in range.
        self.super_symbols = [S.O1, S.O2, S.O3, S.BRONZE, S.IRON, S.SILVER, S.WILD]
        self.drop_weights_super = [12.0, 12.0, 12.0, 24.0, 18.0, 14.0, 6.0]

        # Rank-jump: a fusing group climbs +1 rank per `jump_step` extra cells
        self.jump_step = 3

        # --- Heat --------------------------------------------------------------
        self.heat_cap_base = 25
        self.heat_cap_bonus = 100
        self.heat_cap_super = 10
        self.ante_start_heat = 2       # STOKED starts the spin hotter

        # --- Free spins --------------------------------------------------------
        self.freespins_by_scatter = {3: 10, 4: 12, 5: 14}
        self.retrigger_add = 4         # +spins on 3+ cinders during Forge Fury
        self.super_spins = 8           # Molten Core fixed length

        # --- Bet modes ---------------------------------------------------------
        self.bet_modes = [
            BetMode(
                name="base", cost=1.0, rtp=self.rtp, max_win=self.wincap,
                auto_close_disabled=False, is_feature=False, is_buybonus=False,
                distributions=[
                    Distribution("wincap", 0.0008, {"force_wincap": True}, self.wincap),
                    Distribution("freegame", 0.006, {"force_freegame": True}),
                    Distribution("basegame", 0.9932, {}),
                ],
            ),
            BetMode(
                name="ante", cost=1.25, rtp=self.rtp, max_win=self.wincap,
                auto_close_disabled=False, is_feature=True, is_buybonus=False,
                distributions=[
                    Distribution("wincap", 0.0010, {"force_wincap": True}, self.wincap),
                    Distribution("freegame", 0.010, {"force_freegame": True}),
                    Distribution("basegame", 0.989, {}),
                ],
            ),
            BetMode(
                name="bonus", cost=100.0, rtp=self.rtp, max_win=self.wincap,
                auto_close_disabled=True, is_feature=False, is_buybonus=True,
                distributions=[
                    Distribution("wincap", 0.004, {"force_wincap": True}, self.wincap),
                    Distribution("freegame", 0.996, {"force_freegame": True}),
                ],
            ),
            BetMode(
                name="super", cost=500.0, rtp=self.rtp, max_win=self.wincap,
                auto_close_disabled=True, is_feature=False, is_buybonus=True,
                distributions=[
                    Distribution("wincap", 0.006, {"force_wincap": True}, self.wincap),
                    Distribution("supergame", 0.994, {"force_super": True}),
                ],
            ),
        ]
