"""Board mechanics: fill, connected-component detection, wild attachment,
fusion, gravity and refill.

Board layout: ``board[r][c]`` with ``r=0`` at the TOP. Gravity pulls symbols
toward the BOTTOM (increasing ``r``). All functions are pure with respect to the
RNG passed in, so a round is fully reproducible from its seed.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import Sequence

from . import symbols as S


@dataclass
class FusionRecord:
    """One fusion event: a group climbs one rank."""
    from_sym: int
    to_sym: int
    cells: list            # [(r, c), ...] cells consumed (relics/ore)
    wild_cells: list       # [(r, c), ...] wilds consumed
    anchor: tuple          # (r, c) where the new relic is placed


@dataclass
class StepResult:
    fusions: list = field(default_factory=list)   # list[FusionRecord]
    heat_gain: int = 0                            # +1 per fusion


def new_board(rng, cols: int, rows: int, symbols: Sequence[int],
              weights: Sequence[float]) -> list:
    """Independent per-cell categorical fill (drop-weight model)."""
    flat = rng.choices_weighted(symbols, weights, cols * rows)
    return [[flat[r * cols + c] for c in range(cols)] for r in range(rows)]


def count_symbol(board, sym: int) -> int:
    return sum(row.count(sym) for row in board)


def _neighbors(r, c, rows, cols):
    if r > 0:
        yield r - 1, c
    if r + 1 < rows:
        yield r + 1, c
    if c > 0:
        yield r, c - 1
    if c + 1 < cols:
        yield r, c + 1


def find_components(board) -> list:
    """Return connected components of identical ladder symbols (ore/relic).

    WILD and SCATTER are excluded here (wilds are attached separately).
    Each component: {"sym", "rank", "cells": [(r,c),...]}.
    """
    rows, cols = len(board), len(board[0])
    seen = [[False] * cols for _ in range(rows)]
    comps = []
    for r in range(rows):
        for c in range(cols):
            sym = board[r][c]
            if seen[r][c] or not S.is_ladder(sym):
                continue
            # BFS flood of identical symbol
            q = deque([(r, c)])
            seen[r][c] = True
            cells = []
            while q:
                cr, cc = q.popleft()
                cells.append((cr, cc))
                for nr, nc in _neighbors(cr, cc, rows, cols):
                    if not seen[nr][nc] and board[nr][nc] == sym:
                        seen[nr][nc] = True
                        q.append((nr, nc))
            comps.append({"sym": sym, "rank": S.rank_of(sym), "cells": cells})
    return comps


def _component_index_map(comps, rows, cols):
    idx = [[-1] * cols for _ in range(rows)]
    for i, comp in enumerate(comps):
        for (r, c) in comp["cells"]:
            idx[r][c] = i
    return idx


def attach_wilds(board, comps) -> dict:
    """Attach each WILD cell to the single best adjacent component.

    "Best" = highest rank, tie-broken by larger component size. A wild joins at
    most one component and never merges two components together.
    Returns {component_index: [wild_cell, ...]}.
    """
    rows, cols = len(board), len(board[0])
    idx = _component_index_map(comps, rows, cols)
    attached: dict = {}
    for r in range(rows):
        for c in range(cols):
            if board[r][c] != S.WILD:
                continue
            best_i, best_key = None, None
            for nr, nc in _neighbors(r, c, rows, cols):
                ci = idx[nr][nc]
                if ci < 0:
                    continue
                comp = comps[ci]
                key = (comp["rank"], len(comp["cells"]))
                if best_key is None or key > best_key:
                    best_key, best_i = key, ci
            if best_i is not None:
                attached.setdefault(best_i, []).append((r, c))
    return attached


def rank_jump(size: int, jump_step: int) -> int:
    """How many ranks a fusing group climbs, by its (effective) size.

    A minimal group (== FUSE_THRESHOLD) climbs +1 rank; every extra
    ``jump_step`` cells adds another rank. This makes a big ore cluster leap
    straight to a high relic, which is what gives the game a reachable, tunable
    tail (see MATH_SPEC.md). jump_step<=0 disables jumps (always +1).
    """
    if jump_step <= 0:
        return 1
    return 1 + (size - S.FUSE_THRESHOLD) // jump_step


def resolve_fusions(board, jump_step: int = 4) -> StepResult:
    """Find every qualifying component and fuse it up (mutates board).

    Qualifying = effective size (cells + attached wilds) >= FUSE_THRESHOLD and
    current rank < TOP_RANK. All qualifying components resolve simultaneously
    (they are disjoint). Consumed cells become EMPTY; ONE product cell is placed
    at the anchor (bottom-most, then left-most cell of the component). The
    product rank is ``min(rank + rank_jump(size), TOP_RANK)``.
    """
    comps = find_components(board)
    wilds = attach_wilds(board, comps)
    step = StepResult()
    for i, comp in enumerate(comps):
        if comp["rank"] >= S.TOP_RANK:
            continue
        wl = wilds.get(i, [])
        size = len(comp["cells"]) + len(wl)
        if size < S.FUSE_THRESHOLD:
            continue
        new_rank = min(comp["rank"] + rank_jump(size, jump_step), S.TOP_RANK)
        new_sym = S.SYMBOL_OF_RANK[new_rank]
        anchor = max(comp["cells"], key=lambda rc: (rc[0], -rc[1]))
        for (r, c) in comp["cells"]:
            board[r][c] = S.EMPTY
        for (r, c) in wl:
            board[r][c] = S.EMPTY
        board[anchor[0]][anchor[1]] = new_sym
        step.fusions.append(FusionRecord(
            from_sym=comp["sym"], to_sym=new_sym,
            cells=list(comp["cells"]), wild_cells=list(wl), anchor=anchor,
        ))
    step.heat_gain = len(step.fusions)
    return step


def apply_gravity_and_refill(board, rng, symbols: Sequence[int],
                             weights: Sequence[float]) -> list:
    """Drop non-empty cells down each column, refill EMPTY at the top.

    Returns the list of newly spawned cells [{"r","c","sym"}, ...] for events.
    """
    rows, cols = len(board), len(board[0])
    spawned = []
    for c in range(cols):
        # collect existing (non-empty) top-to-bottom, then re-seat at the bottom
        stack = [board[r][c] for r in range(rows) if board[r][c] != S.EMPTY]
        empties = rows - len(stack)
        new_top = rng.choices_weighted(symbols, weights, empties)
        col_syms = new_top + stack  # new symbols fill the top
        for r in range(rows):
            board[r][c] = col_syms[r]
        for r in range(empties):
            spawned.append({"r": r, "c": c, "sym": col_syms[r]})
    return spawned


def relic_payout(board, paytable: S.Paytable) -> float:
    """Sum of base values of every relic (IRON+) currently on the board."""
    total = 0.0
    for row in board:
        for sym in row:
            total += paytable.value(sym)
    return total


def clone(board) -> list:
    return [row[:] for row in board]
