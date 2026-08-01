/**
 * Presenter interface — separates game logic from presentation.
 *
 * BookPlayer drives a Presenter through the event stream. A PixiJS renderer, a
 * DOM renderer (see player/index.html) or a headless test double can all
 * implement this. Each method returns a Promise that resolves when its
 * animation finishes; `skip()`/turbo shorten these without changing outcomes.
 */
import type {
  Board, Fusion, Relic, Spawned, SpinKind,
} from '../types/events';

export interface Presenter {
  /**
   * Optional: start the reels before the outcome is known.
   *
   * The bet request has latency, and a still board during it is dead air the
   * player reads as the game being slow. Presenters that cannot spin ahead
   * simply do not implement this.
   */
  beginSpin?(): void;
  /** Stop a `beginSpin` that will never receive an outcome. */
  abortSpin?(): void;
  revealBoard(board: Board, heat: number, kind: SpinKind, scatters: number): Promise<void>;
  anticipation(scatters: number, needed: number): Promise<void>;
  forge(fusions: Fusion[], heat: number): Promise<void>;
  gravity(spawned: Spawned[], board: Board): Promise<void>;
  heat(heat: number): Promise<void>;
  settleWin(relics: Relic[], heat: number, win: number): Promise<void>;
  bonusStart(mode: string, spins: number, kind: SpinKind): Promise<void>;
  spinCounter(remaining: number, total: number): Promise<void>;
  retrigger(added: number, spins: number): Promise<void>;
  superSeed(board: Board, minRank: number): Promise<void>;
  lockUpdate(locked: Relic[], vault: number): Promise<void>;
  pour(vault: number, heat: number, win: number): Promise<void>;
  totalWin(totalWin: number): Promise<void>;
  maxWin(): Promise<void>;
  finalWin(amount: number): Promise<void>;
  roundEnd(): Promise<void>;
}

/** Presentation timing; turbo/instant respect jurisdiction (disabledTurbo). */
export interface Timing { turbo: boolean; instant: boolean; reducedMotion: boolean; }
