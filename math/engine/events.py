"""Book + event contract.

A *book* is one game round: an ordered list of events plus an integer
`payoutMultiplier`. Events are the ONLY channel to the frontend — anything not
in the events cannot be shown (SDK rule, events_info.md). Payout is accumulated
in bet-multiplier units and converted to integer (x100) at the end.

Event contract (documented in full in TECH_ARCHITECTURE.md):
  revealBoard, anticipation, forge, gravity, heatUpdate, settleWin,
  bonusStart, spinCounter, retrigger, superSeed, lockUpdate, pour,
  totalWinUpdate, maxWin, finalWin, roundEnd
"""

from __future__ import annotations


class Book:
    def __init__(self, book_id: int, mode: str, record: bool = True):
        self.id = book_id
        self.mode = mode
        self.record = record           # False => fast RTP mode (no event objects)
        self.events: list = []
        self._idx = 0
        self.payout_x: float = 0.0     # accumulated win in bet-multiplier units
        self.criteria: str = "0"       # distribution criteria bucket (analysis)
        self.wincapped: bool = False

    # -- payout -------------------------------------------------------------
    def add_win(self, x: float) -> None:
        self.payout_x += x

    def payout_multiplier(self) -> int:
        """Integer payoutMultiplier (x100). 1150 == 11.5x (SDK convention)."""
        return int(round(self.payout_x * 100))

    # -- events -------------------------------------------------------------
    def emit(self, etype: str, **fields):
        if not self.record:
            return None
        ev = {"index": self._idx, "type": etype}
        ev.update(fields)
        self.events.append(ev)
        self._idx += 1
        return ev

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "events": self.events,
            "payoutMultiplier": self.payout_multiplier(),
        }


# --- Event builders (thin wrappers => single source of truth for the schema) --

def _snap(board):
    return [row[:] for row in board]


def reveal(book, board, heat, spin_kind, scatters):
    if not book.record:
        return None
    return book.emit("revealBoard", board=_snap(board), heat=heat,
                     spinKind=spin_kind, scatters=scatters)


def anticipation(book, scatters, needed):
    return book.emit("anticipation", scatters=scatters, needed=needed)


def forge(book, fusions, heat):
    return book.emit("forge", fusions=fusions, heat=heat)


def strike(book, veins, heat):
    """THE VEIN's payout event.

    Deliberately NOT reusing `forge`: a fusion turns several cells into one new
    cell of a different symbol, and a vein pays a path and clears it. They carry
    different data and the renderer has to draw different things, so sharing an
    event name would only make the player-facing animation guess which one it
    was looking at.
    """
    return book.emit("strike", veins=veins, heat=heat)


def gravity(book, spawned, board):
    if not book.record:
        return None
    return book.emit("gravity", spawned=spawned, board=_snap(board))


def heat_update(book, heat):
    return book.emit("heatUpdate", heat=heat)


def settle_win(book, relics, base_value, heat, win):
    return book.emit("settleWin", relics=relics, baseValue=round(base_value, 4),
                     heat=heat, win=round(win, 4))


def bonus_start(book, mode, spins, kind):
    return book.emit("bonusStart", mode=mode, spins=spins, kind=kind)


def spin_counter(book, remaining, total):
    return book.emit("spinCounter", remaining=remaining, total=total)


def retrigger(book, added, spins):
    return book.emit("retrigger", added=added, spins=spins)


def super_seed(book, board, min_rank):
    if not book.record:
        return None
    return book.emit("superSeed", board=_snap(board), minRank=min_rank)


def lock_update(book, locked, vault):
    return book.emit("lockUpdate", locked=locked, vault=round(vault, 4))


def pour(book, vault, heat, win):
    return book.emit("pour", vault=round(vault, 4), heat=heat, win=round(win, 4))


def total_win_update(book, total_win):
    return book.emit("totalWinUpdate", totalWin=round(total_win, 4))


def max_win(book):
    return book.emit("maxWin")


def final_win(book, amount):
    return book.emit("finalWin", amount=round(amount, 4))


def round_end(book):
    return book.emit("roundEnd")
