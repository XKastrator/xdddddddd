/**
 * RGS client — thin wrapper over the Stake Engine wallet/bet endpoints
 * (docs/rgs_docs/RGS.md). All money is integer with 6 decimal places.
 * The client NEVER computes payouts; it only relays server responses.
 */
import type { Book, BetModeName } from '../types/events';

export interface Balance { amount: number; currency: string; }
export interface Jurisdiction {
  socialCasino: boolean;
  disabledFullscreen: boolean;
  disabledTurbo: boolean;
}
export interface AuthConfig {
  minBet: number; maxBet: number; stepBet: number; defaultBetLevel: number;
  betLevels: number[]; jurisdiction: Jurisdiction;
}
export interface Round { active: boolean; book?: Book; mode?: BetModeName; }
export interface AuthResponse { balance: Balance; config: AuthConfig; round?: Round; }
export interface PlayResponse { balance: Balance; round: { book: Book; mode: BetModeName }; }

export type RgsError =
  | 'ERR_VAL' | 'ERR_IPB' | 'ERR_IS' | 'ERR_ATE' | 'ERR_GLE' | 'ERR_LOC'
  | 'ERR_GEN' | 'ERR_MAINTENANCE';

export class RgsClientError extends Error {
  constructor(public code: RgsError, public status: number) {
    super(`RGS ${code} (${status})`);
  }
}

export class RgsClient {
  constructor(private rgsUrl: string, private sessionID: string) {}

  private async post<T>(path: string, body: object): Promise<T> {
    const res = await fetch(`${this.rgsUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionID: this.sessionID, ...body }),
    });
    if (!res.ok) {
      let code: RgsError = 'ERR_GEN';
      try { code = (await res.json())?.error ?? code; } catch { /* noop */ }
      throw new RgsClientError(code, res.status);
    }
    return res.json() as Promise<T>;
  }

  authenticate(): Promise<AuthResponse> {
    return this.post<AuthResponse>('/wallet/authenticate', {});
  }
  balance(): Promise<{ balance: Balance }> {
    return this.post('/wallet/balance', {});
  }
  /** amount is the base bet in 6-dp integer units; mode multiplies the debit. */
  play(amount: number, mode: BetModeName): Promise<PlayResponse> {
    return this.post<PlayResponse>('/wallet/play', { amount, mode });
  }
  endRound(): Promise<{ balance: Balance }> {
    return this.post('/wallet/end-round', {});
  }
  /** Persist in-progress action so a disconnected round can resume. */
  event(event: string): Promise<{ event: string }> {
    return this.post('/bet/event', { event });
  }
}
