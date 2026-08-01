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
        # THE VEIN needs a denser board than fusion did: with five ore types a
        # seam-to-crucible run connected on 3.2% of spins, which is not a game.
        # Four types with Flux at 10 measures 21.5% — the normal band.
        self.drop_weights_base  = [18.0, 18.0, 18.0, 18.0, 0.0, 10.0, 1.35]
        # BONUS (Forge Fury): 4 denser variants + more Flux => longer chains,
        # bigger jumps, higher Heat under persistence (the bonus dynamic).
        # BONUS: three ore types and more Flux, so veins connect constantly and
        # the column meter compounds — this is where the five-figure tail lives.
        self.drop_weights_bonus = [18.0, 18.0, 18.0, 0.0, 0.0, 14.0, 1.35]
        # STOKED ante: more Cinders (higher trigger) + a bit more Flux
        self.drop_weights_ante  = [17.0, 17.0, 17.0, 17.0, 17.0, 4.0, 1.30]

        # SUPER (Molten Core): pre-seeded high but diluted with ore so fusions
        # are not guaranteed; Heat capped LOW so Vault x Heat stays in range.
        # MOLTEN CORE under THE VEIN: pre-seeded relics are meaningless because
        # only ore forms veins. The mode's identity moves to DENSITY — two ore
        # types and heavy Flux, so veins connect constantly and every one is
        # banked to the Vault at base value, to be multiplied once at the Pour.
        self.super_symbols = [S.O1, S.O2, S.O3, S.WILD]
        self.drop_weights_super = [20.0, 20.0, 20.0, 13.0]

        # Rank-jump: a fusing group climbs +1 rank per `jump_step` extra cells
        self.jump_step = 3

        # --- Core mechanic -----------------------------------------------------
        # "fusion" = 4+ alike climb a rank (the original).
        # "vein"   = THE VEIN: a run of one ore that connects the TOP row (the
        #            seam) to the BOTTOM row (the crucible) pays and clears.
        #            Nothing else pays. Flux substitutes for any ore and can be
        #            shared by several veins.
        #
        # Kept switchable rather than replaced outright: the published books,
        # the PAR report and the whole front end are built against fusion, and
        # a half-migrated engine that breaks the shipped game helps nobody.
        self.mechanic = "vein"
        # x bet BEFORE Heat, by how many COLUMNS the vein crosses. Calibrated by
        # measurement (math/tools/vein_probe.py): a flat-ish curve is what makes
        # RTP tunable at a ~21% hit rate; the tail is the bonus's job.
        # Scaled so the BONUS's natural RTP lands near 1.0. The first pass was
        # calibrated on the base game alone and left a bonus round paying 2023x
        # on average against a 100x buy — the optimizer can re-weight that, but
        # only by discarding most of the library, which wrecks effective sample
        # size. Better to put the natural distribution near the target and let
        # the weights do a small correction rather than a violent one.
        self.column_pay = {
            1: 0.00104, 2: 0.00229, 3: 0.00521, 4: 0.01250, 5: 0.03335, 6: 0.09900,
        }
        # extra value per cell beyond the shortest possible vein (one per row)
        self.vein_length_bonus = 0.34

        # --- Heat --------------------------------------------------------------
        self.heat_cap_base = 25
        # 400 is where the cap stops BINDING: below it a forced max-win round
        # cannot reach the ceiling (3 in 24 at 100), at 400 it reaches it every
        # time, and above it nothing changes because the meter never climbs
        # that far on its own. Measured, not chosen.
        self.heat_cap_bonus = 400
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
