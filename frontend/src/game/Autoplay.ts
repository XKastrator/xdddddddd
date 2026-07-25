/**
 * Autoplay — a bounded sequence of ordinary bets.
 *
 * Regulatory shape (UKGC RTS 8, MGA and most EU regimes require all of these):
 *   - the player sets the number of rounds BEFORE the sequence starts;
 *   - a loss limit and a single-win limit can be set, and stop the sequence;
 *   - the sequence stops automatically when a bonus feature is entered
 *     (optional but default-on here);
 *   - the player can stop at any time, and the stop takes effect at the end of
 *     the round in flight.
 *
 * What autoplay explicitly is NOT, per the brief's hard constraints: it does not
 * carry state into the maths, does not change odds, does not alter RTP, and does
 * not make any decision that affects a payout. Every round it triggers is the
 * same independent, stateless bet the SPIN button places. This class only
 * COUNTS; it never touches the RGS or the presentation.
 *
 * All monetary values are in bet units (the same integer units the RGS uses), so
 * there is no float drift in the limit comparisons.
 */
export interface AutoplayLimits {
  /** Number of rounds to play. */
  spins: number;
  /** Stop as soon as a round enters Forge Fury / Molten Core. */
  stopOnBonus: boolean;
  /** Stop once cumulative net loss reaches this many units. `null` = no limit. */
  lossLimitUnits: number | null;
  /** Stop if any single round wins at least this many units. `null` = no limit. */
  singleWinUnits: number | null;
}

export type AutoplayStop =
  | 'completed'      // ran the requested number of rounds
  | 'user'           // player pressed stop
  | 'bonus'          // feature entered
  | 'loss-limit'
  | 'single-win'
  | 'error';         // round failed / insufficient balance

export interface RoundOutcome {
  /** What the round cost, in units (bet × mode cost). */
  costUnits: number;
  /** What the round paid, in units. */
  winUnits: number;
  /** True when the book contained a bonus entry. */
  bonus: boolean;
}

export class AutoplaySession {
  private left: number;
  private netUnits = 0;
  private stop: AutoplayStop | null = null;

  constructor(readonly limits: AutoplayLimits) {
    this.left = Math.max(0, Math.floor(limits.spins));
    if (this.left === 0) this.stop = 'completed';
  }

  /** Rounds still to play. */
  get remaining(): number { return this.left; }
  /** Cumulative win minus cost, in units. Negative means down. */
  get net(): number { return this.netUnits; }
  get stopReason(): AutoplayStop | null { return this.stop; }
  get running(): boolean { return this.stop === null && this.left > 0; }

  /** Player-initiated stop. Takes effect after the round in flight completes. */
  cancel(): void { if (this.stop === null) this.stop = 'user'; }

  /** A round could not be placed or played. */
  fail(): void { if (this.stop === null) this.stop = 'error'; }

  /**
   * Record one completed round and re-evaluate the limits.
   * Returns true when autoplay should continue.
   *
   * Limits are checked in the order a player would expect to hear about them:
   * a big win beats a loss limit, and both beat simply running out of rounds.
   */
  record(o: RoundOutcome): boolean {
    // A round already in flight when the player pressed stop still counts
    // towards the running total — the sequence is over, but the money moved.
    this.left -= 1;
    this.netUnits += o.winUnits - o.costUnits;
    if (this.stop !== null) return false;

    const { singleWinUnits, lossLimitUnits, stopOnBonus } = this.limits;
    if (singleWinUnits !== null && o.winUnits >= singleWinUnits) this.stop = 'single-win';
    else if (stopOnBonus && o.bonus) this.stop = 'bonus';
    else if (lossLimitUnits !== null && -this.netUnits >= lossLimitUnits) this.stop = 'loss-limit';
    else if (this.left <= 0) this.stop = 'completed';
    return this.running;
  }
}
