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


# --------------------------------------------------------------------------- #
# THE VEIN  —  the mechanic that replaces rank fusion.
#
# A vein is a connected run of one ore type that reaches ALL THE WAY DOWN: it
# must touch the top row (the seam face the miners are cutting) AND the bottom
# row (the crucible). Nothing else pays. Flux substitutes for any ore, so it can
# bridge a gap, and one Flux cell may serve several veins at once.
#
# Why this instead of "4+ alike fuse up a rank":
#   * There is ONE question on screen for the whole spin — does it get through?
#     The player reads the board top-to-bottom looking for a specific thing,
#     instead of scanning for any four cells that happen to touch.
#   * The near-miss is REAL and visible: a vein that stops one row short of the
#     crucible is a fact about the board, not a manufactured tease.
#   * It pays on SHAPE, not on count. A vein that snakes across all six columns
#     is a different event from a straight drop, and it looks like one.
# --------------------------------------------------------------------------- #

@dataclass
class VeinRecord:
    """One vein that connected the seam to the crucible."""
    sym: int                 # the ore it is made of
    cells: list              # [(r, c), ...] ore cells
    wild_cells: list         # [(r, c), ...] Flux cells bridging it
    columns: int             # how many distinct columns it crosses
    value: float             # x bet, BEFORE Heat


@dataclass
class VeinStep:
    veins: list = field(default_factory=list)
    heat_gain: int = 0


def find_veins(board) -> list:
    """Every seam-to-crucible run on the board, one entry per ore type.

    Flooded per ore type with WILD traversable, so a Flux can carry a vein
    across a gap without silently welding two different ores into one run.
    A wild may appear in more than one vein; an ore cell cannot.
    """
    rows, cols = len(board), len(board[0])
    out = []
    for ore in S.ORE_VARIANTS:
        seen = [[False] * cols for _ in range(rows)]
        for r0 in range(rows):
            for c0 in range(cols):
                if seen[r0][c0] or board[r0][c0] != ore:
                    continue
                q = deque([(r0, c0)])
                seen[r0][c0] = True
                ore_cells, wild_cells = [], []
                touch_top = touch_bottom = False
                while q:
                    r, c = q.popleft()
                    if board[r][c] == S.WILD:
                        wild_cells.append((r, c))
                    else:
                        ore_cells.append((r, c))
                    if r == 0:
                        touch_top = True
                    if r == rows - 1:
                        touch_bottom = True
                    for nr, nc in _neighbors(r, c, rows, cols):
                        if seen[nr][nc]:
                            continue
                        nsym = board[nr][nc]
                        if nsym == ore or nsym == S.WILD:
                            seen[nr][nc] = True
                            q.append((nr, nc))
                if touch_top and touch_bottom:
                    columns = len({c for _, c in ore_cells + wild_cells})
                    out.append({"sym": ore, "cells": ore_cells,
                                "wild_cells": wild_cells, "columns": columns})
    return out


def resolve_veins(board, column_pay, length_bonus: float) -> VeinStep:
    """Pay and clear every vein on the board (mutates board).

    All veins resolve together. Ore cells are consumed; a Flux is consumed too,
    but only once even if several veins ran through it.
    """
    rows = len(board)
    step = VeinStep()
    found = find_veins(board)
    for v in found:
        n = len(v["cells"]) + len(v["wild_cells"])
        base = column_pay.get(v["columns"], column_pay[max(column_pay)])
        # a vein longer than the shortest possible one is worth proportionally
        # more, but the COLUMN count is what drives the tail
        value = base * (1.0 + length_bonus * max(0, n - rows))
        step.veins.append(VeinRecord(
            sym=v["sym"], cells=list(v["cells"]),
            wild_cells=list(v["wild_cells"]), columns=v["columns"],
            value=value,
        ))
    for v in step.veins:
        for (r, c) in v.cells:
            board[r][c] = S.EMPTY
        for (r, c) in v.wild_cells:
            board[r][c] = S.EMPTY
    step.heat_gain = len(step.veins)
    return step
