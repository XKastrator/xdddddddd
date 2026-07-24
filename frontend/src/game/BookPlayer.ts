/**
 * BookPlayer — replays a Book's events through a Presenter.
 *
 * This is the heart of the event-driven architecture: it owns NO game maths, it
 * only walks the recorded events (the single source of truth) and asks the
 * Presenter to show each one. It supports skip (jump current animation to end),
 * pause/resume (for round resume after disconnect) and reports total win from
 * the `finalWin` event only — never recomputed on the client.
 */
import type { Book, GameEvent } from '../types/events';
import type { Presenter } from './Presenter';

export class BookPlayer {
  private idx = 0;
  private skipRequested = false;
  private aborted = false;

  constructor(private book: Book, private presenter: Presenter) {}

  /** Jump the currently-playing animation to its end state. */
  skip(): void { this.skipRequested = true; }
  abort(): void { this.aborted = true; }

  /** Presenters poll this to shorten the in-flight animation. */
  get skipping(): boolean { return this.skipRequested; }

  /** Resume from a given event index (round resume after reconnect). */
  async play(fromIndex = 0): Promise<number> {
    this.idx = fromIndex;
    for (; this.idx < this.book.events.length; this.idx++) {
      if (this.aborted) break;
      await this.dispatch(this.book.events[this.idx]);
      this.skipRequested = false;
    }
    return this.book.payoutMultiplier / 100; // reported, not computed
  }

  get currentIndex(): number { return this.idx; }

  private async dispatch(ev: GameEvent): Promise<void> {
    const p = this.presenter;
    switch (ev.type) {
      case 'revealBoard': return p.revealBoard(ev.board, ev.heat, ev.spinKind, ev.scatters);
      case 'anticipation': return p.anticipation(ev.scatters, ev.needed);
      case 'forge': return p.forge(ev.fusions, ev.heat);
      case 'gravity': return p.gravity(ev.spawned, ev.board);
      case 'heatUpdate': return p.heat(ev.heat);
      case 'settleWin': return p.settleWin(ev.relics, ev.heat, ev.win);
      case 'bonusStart': return p.bonusStart(ev.mode, ev.spins, ev.kind);
      case 'spinCounter': return p.spinCounter(ev.remaining, ev.total);
      case 'retrigger': return p.retrigger(ev.added, ev.spins);
      case 'superSeed': return p.superSeed(ev.board, ev.minRank);
      case 'lockUpdate': return p.lockUpdate(ev.locked, ev.vault);
      case 'pour': return p.pour(ev.vault, ev.heat, ev.win);
      case 'totalWinUpdate': return p.totalWin(ev.totalWin);
      case 'maxWin': return p.maxWin();
      case 'finalWin': return p.finalWin(ev.amount);
      case 'roundEnd': return p.roundEnd();
      default: {
        // exhaustiveness guard
        const _never: never = ev;
        return Promise.resolve(_never as unknown as void);
      }
    }
  }
}
