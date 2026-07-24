"""MOLTEN CROWN — round orchestration.

Payout model (controllable, high-volatility):
  * A fusion PRODUCT pays value(product_rank) x Heat at the instant it is forged.
  * Fusing ore -> BRONZE pays a token amount; each further rank pays much more.
  * A spin with no fusion is a genuine dead spin (0 pay).
  * Heat = 1 + cumulative fusions. base: resets each spin. bonus/super: persists.
  * super (Molten Core): products are BANKED to a Vault at base value (no Heat);
    the whole round ends in ONE Pour = Vault x final Heat (rule change).

One code path serves both fast RTP measurement (record=False) and full
publication books (record=True).
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from engine import symbols as S
from engine import board as B
from engine import events as E
from engine.rng import Rng
from engine.events import Book

MAX_CASCADE_STEPS = 60   # safety guard (cascades are short with ore variety)


def _serialize_fusions(fusions, paytable):
    out = []
    for f in fusions:
        out.append({
            "from": f.from_sym, "to": f.to_sym,
            "cells": [[r, c] for (r, c) in f.cells],
            "wildCells": [[r, c] for (r, c) in f.wild_cells],
            "anchor": [f.anchor[0], f.anchor[1]],
            "value": round(paytable.value(f.to_sym), 4),
        })
    return out


def _relic_list(board, paytable):
    relics = []
    for r, row in enumerate(board):
        for c, sym in enumerate(row):
            v = paytable.value(sym)
            if v > 0:
                relics.append({"r": r, "c": c, "sym": sym, "value": round(v, 4)})
    return relics


def run_cascades(book, board, cfg, rng, fill_syms, fill_weights, heat, heat_cap):
    """Resolve fusions until stable.

    Returns (heat, pay_heat_total, pay_base_total):
      pay_heat_total = sum(value(product) * Heat_after_step)  [base/bonus pay]
      pay_base_total = sum(value(product))                    [super vault bank]
    """
    pay_heat = 0.0
    pay_base = 0.0
    steps = 0
    while steps < MAX_CASCADE_STEPS:
        step = B.resolve_fusions(board, cfg.jump_step)
        if not step.fusions:
            break
        heat = min(heat + step.heat_gain, heat_cap)
        step_base = sum(cfg.paytable.value(f.to_sym) for f in step.fusions)
        step_win = step_base * heat
        pay_base += step_base
        pay_heat += step_win
        if book.record:
            E.forge(book, _serialize_fusions(step.fusions, cfg.paytable), heat)
        spawned = B.apply_gravity_and_refill(board, rng, fill_syms, fill_weights)
        E.gravity(book, spawned, board)
        steps += 1
    return heat, pay_heat, pay_base


def _finalize(book, cfg):
    if book.payout_x >= cfg.wincap:
        book.payout_x = cfg.wincap
        book.wincapped = True
        E.max_win(book)
    E.total_win_update(book, book.payout_x)
    E.final_win(book, book.payout_x)
    E.round_end(book)
    return book


# --------------------------------------------------------------------------- #
# Forge Fury (free spins) — Heat PERSISTS across spins.
# --------------------------------------------------------------------------- #
def play_forge_fury(book, cfg, rng, spins, fill_syms, fill_weights, heat_cap,
                    hot=False):
    E.bonus_start(book, "forge_fury", spins, "free")
    heat = 1
    if hot:  # forced max-win construction: rich seed + hot start + extra spins
        fill_syms = [S.BRONZE, S.IRON, S.SILVER, S.GOLD, S.WILD]
        fill_weights = [14.0, 22.0, 26.0, 20.0, 10.0]
        heat = 15
        spins = max(spins, 22)
    remaining, total = spins, spins
    while remaining > 0:
        remaining -= 1
        board = B.new_board(rng, cfg.num_reels, cfg.num_rows, fill_syms, fill_weights)
        scatters = B.count_symbol(board, S.SCATTER)
        E.reveal(book, board, heat, "free", scatters)
        E.spin_counter(book, remaining, total)
        heat, pay_heat, _ = run_cascades(book, board, cfg, rng,
                                         fill_syms, fill_weights, heat, heat_cap)
        book.add_win(pay_heat)
        if book.record:
            E.settle_win(book, _relic_list(board, cfg.paytable), 0.0, heat, pay_heat)
            E.total_win_update(book, book.payout_x)
        if scatters >= 3:
            total += cfg.retrigger_add
            remaining += cfg.retrigger_add
            E.retrigger(book, cfg.retrigger_add, remaining)
        if book.payout_x >= cfg.wincap:
            break
    return book


# --------------------------------------------------------------------------- #
# Molten Core (superbonus) — pre-seed + LOCK & POUR.
# --------------------------------------------------------------------------- #
def play_molten_core(book, cfg, rng, hot=False):
    E.bonus_start(book, "molten_core", cfg.super_spins, "super")
    heat = 1
    vault = 0.0
    fill_syms, fill_weights = cfg.super_symbols, cfg.drop_weights_super
    if hot:  # forced max-win construction: rich seed + hot start
        fill_syms = [S.BRONZE, S.IRON, S.SILVER, S.GOLD, S.WILD]
        fill_weights = [26.0, 30.0, 26.0, 12.0, 8.0]
        heat = 30
    total = cfg.super_spins
    for i in range(cfg.super_spins):
        remaining = cfg.super_spins - i - 1
        board = B.new_board(rng, cfg.num_reels, cfg.num_rows, fill_syms, fill_weights)
        E.super_seed(book, board, min_rank=1)
        E.spin_counter(book, remaining, total)
        heat, _, pay_base = run_cascades(book, board, cfg, rng,
                                         fill_syms, fill_weights,
                                         heat, cfg.heat_cap_super)
        vault += pay_base                       # bank at base value, no Heat yet
        if book.record:
            E.lock_update(book, _relic_list(board, cfg.paytable), vault)
    win = vault * heat                          # single culmination
    if hot:
        win = max(win, cfg.wincap)
    E.pour(book, vault, heat, win)
    book.add_win(win)
    return book


# --------------------------------------------------------------------------- #
# Public entry point
# --------------------------------------------------------------------------- #
def play_book(cfg, mode_name: str, book_id: int, rng: Rng,
              record: bool = True, force: dict | None = None) -> Book:
    book = Book(book_id, mode_name, record=record)
    force = force or {}

    if mode_name in ("base", "ante"):
        ante = mode_name == "ante"
        fill_syms = cfg.symbols
        fill_weights = cfg.drop_weights_ante if ante else cfg.drop_weights_base
        heat_start = cfg.ante_start_heat if ante else 1

        board = B.new_board(rng, cfg.num_reels, cfg.num_rows, fill_syms, fill_weights)
        scatters = B.count_symbol(board, S.SCATTER)
        E.reveal(book, board, heat_start, "base", scatters)
        if scatters == 2 and book.record:
            E.anticipation(book, scatters, 3)
        heat, pay_heat, _ = run_cascades(book, board, cfg, rng,
                                         fill_syms, fill_weights,
                                         heat_start, cfg.heat_cap_base)
        book.add_win(pay_heat)
        if book.record:
            E.settle_win(book, _relic_list(board, cfg.paytable), 0.0, heat, pay_heat)
            E.total_win_update(book, book.payout_x)
        book.criteria = "basegame"
        force_wc = bool(force.get("wincap"))
        if (scatters >= 3 or force_wc) and book.payout_x < cfg.wincap:
            book.criteria = "freegame"
            spins = cfg.freespins_by_scatter.get(min(max(scatters, 3), 5), 10)
            play_forge_fury(book, cfg, rng, spins, cfg.symbols,
                            cfg.drop_weights_bonus, cfg.heat_cap_bonus,
                            hot=force_wc)
        return _finalize(book, cfg)

    if mode_name == "bonus":
        book.criteria = "freegame"
        play_forge_fury(book, cfg, rng, cfg.freespins_by_scatter[3],
                        cfg.symbols, cfg.drop_weights_bonus, cfg.heat_cap_bonus,
                        hot=bool(force.get("wincap")))
        return _finalize(book, cfg)

    if mode_name == "super":
        book.criteria = "supergame"
        play_molten_core(book, cfg, rng, hot=bool(force.get("wincap")))
        return _finalize(book, cfg)

    raise KeyError(f"unknown mode {mode_name}")
