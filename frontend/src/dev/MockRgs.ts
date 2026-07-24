/**
 * MockRgs — DEV ONLY. Serves real, weight-sampled books from the published math
 * library so the renderer can be driven end-to-end without a live RGS. It mimics
 * the Stake Engine wallet contract (authenticate/play/end-round), including
 * 6-dp integer money and the jurisdiction flags. Production uses RgsClient.
 */
import type { Book, BetModeName } from '../types/events';
import type { AuthResponse, PlayResponse } from '../rgs/RgsClient';

const COST: Record<BetModeName, number> = { base: 1, ante: 1.25, bonus: 100, super: 500 };

type Pool = Record<BetModeName, Book[]>;
let POOL: Pool | null = null;

/** Lazy-load the dev fixture so it never bloats the main game bundle. */
async function pool(): Promise<Pool> {
  if (!POOL) {
    const mod = await import('./devBooks.json');
    POOL = (mod.default ?? mod) as unknown as Pool;
  }
  return POOL;
}

export class MockRgs {
  private balanceUnits = 1_000_000_000; // 1000.00 in 6-dp integer units
  private open: { book: Book; mode: BetModeName } | null = null;

  async authenticate(): Promise<AuthResponse> {
    return {
      balance: { amount: this.balanceUnits, currency: 'USD' },
      config: {
        minBet: 100_000, maxBet: 1_000_000_000, stepBet: 100_000,
        defaultBetLevel: 1_000_000,
        betLevels: [100_000, 200_000, 500_000, 1_000_000, 2_000_000, 5_000_000],
        jurisdiction: { socialCasino: false, disabledFullscreen: false, disabledTurbo: false },
      },
      ...(this.open ? { round: { active: true, book: this.open.book, mode: this.open.mode } } : {}),
    };
  }

  async play(amount: number, mode: BetModeName): Promise<PlayResponse> {
    const debit = Math.round(amount * COST[mode]);
    if (debit > this.balanceUnits) throw new Error('ERR_IPB');
    this.balanceUnits -= debit;
    const books = (await pool())[mode];
    const book = books[Math.floor(Math.random() * books.length)];
    this.open = { book, mode };
    return {
      balance: { amount: this.balanceUnits, currency: 'USD' },
      round: { book, mode },
    };
  }

  /** Credit the win and close the round (payout comes from the book only). */
  async endRound(baseBetUnits: number): Promise<{ balance: { amount: number; currency: string } }> {
    if (this.open) {
      const winUnits = Math.round(this.open.book.payoutMultiplier / 100 * baseBetUnits);
      this.balanceUnits += winUnits;
      this.open = null;
    }
    return { balance: { amount: this.balanceUnits, currency: 'USD' } };
  }

  get balance(): number { return this.balanceUnits; }
}
