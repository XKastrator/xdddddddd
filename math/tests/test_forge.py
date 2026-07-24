"""Unit tests for the forge/fusion mechanic and board operations."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from engine import symbols as S
from engine import board as B
from engine.rng import Rng


def test_rank_jump_curve():
    # minimal group climbs +1; +1 more rank per 3 extra cells
    assert B.rank_jump(4, 3) == 1
    assert B.rank_jump(6, 3) == 1
    assert B.rank_jump(7, 3) == 2
    assert B.rank_jump(10, 3) == 3
    assert B.rank_jump(4, 0) == 1  # jumps disabled


def test_simple_fusion_makes_bronze():
    # a 2x2 block of identical ore -> one BRONZE (rank 1)
    board = [[S.O1, S.O1, S.EMPTY, S.EMPTY],
             [S.O1, S.O1, S.EMPTY, S.EMPTY]]
    step = B.resolve_fusions(board, jump_step=3)
    assert len(step.fusions) == 1
    f = step.fusions[0]
    assert f.to_sym == S.BRONZE
    assert S.rank_of(f.to_sym) == 1
    # exactly one product cell placed, rest cleared
    flat = [c for row in board for c in row]
    assert flat.count(S.BRONZE) == 1
    assert flat.count(S.O1) == 0


def test_below_threshold_does_not_fuse():
    board = [[S.O1, S.O1, S.O2],
             [S.O1, S.O2, S.O2]]  # 3xO1 (below 4), should not fuse
    step = B.resolve_fusions(board, jump_step=3)
    assert step.fusions == []


def test_big_group_rank_jumps():
    # 8 connected identical ore -> +2 ranks -> IRON (rank 2)
    board = [[S.O3] * 4,
             [S.O3] * 4]
    step = B.resolve_fusions(board, jump_step=3)
    assert len(step.fusions) == 1
    assert step.fusions[0].to_sym == S.IRON  # rank 0 + jump(8)=+2 -> rank 2


def test_wild_completes_group():
    # 3 O1 + 1 adjacent Flux -> reaches threshold 4 -> fuses
    board = [[S.O1, S.O1, S.WILD],
             [S.O1, S.O5, S.O5]]
    step = B.resolve_fusions(board, jump_step=3)
    assert len(step.fusions) == 1
    assert step.fusions[0].to_sym == S.BRONZE
    assert len(step.fusions[0].wild_cells) == 1


def test_crown_does_not_fuse_further():
    board = [[S.CROWN] * 4,
             [S.O1, S.O2, S.O3, S.O4]]
    step = B.resolve_fusions(board, jump_step=3)
    # 4 crowns are top rank -> no fusion from them
    assert all(f.to_sym != S.EMPTY for f in step.fusions)
    assert all(S.rank_of(f.from_sym) < S.TOP_RANK for f in step.fusions)


def test_gravity_and_refill_fills_board():
    board = [[S.EMPTY, S.O1],
             [S.O2, S.EMPTY]]
    rng = Rng(1)
    spawned = B.apply_gravity_and_refill(board, rng, [S.O1, S.O2], [1.0, 1.0])
    # no EMPTY cells remain
    assert all(c != S.EMPTY for row in board for c in row)
    # existing symbols sank to the bottom of their columns
    assert board[1][0] == S.O2
    assert board[1][1] == S.O1
    assert len(spawned) == 2


def test_determinism_same_seed_same_board():
    r1 = Rng(42); r2 = Rng(42)
    b1 = B.new_board(r1, 6, 5, [S.O1, S.O2, S.O3], [1, 1, 1])
    b2 = B.new_board(r2, 6, 5, [S.O1, S.O2, S.O3], [1, 1, 1])
    assert b1 == b2


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn(); print("ok", fn.__name__)
    print(f"\n{len(fns)} forge tests passed")
