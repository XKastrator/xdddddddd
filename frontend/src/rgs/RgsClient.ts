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
  /**
   * `url` is part of the message on purpose. The first live failure of this
   * game was a 405 whose only clue was "RGS ERR_GEN (405)" — which reads like a
   * broken API when the actual cause was the request going to the static host
   * the game was served from. The URL makes that one glance instead of a hunt.
   */
  constructor(public code: RgsError, public status: number, public url = '') {
    super(`RGS ${code} (${status})${url ? ` at ${url}` : ''}`);
  }
}

export class RgsClient {
  constructor(private rgsUrl: string, private sessionID: string) {
    if (!/^https?:\/\//i.test(rgsUrl)) {
      // A relative base would silently POST to the page's own origin. Fail
      // here, where the cause is still obvious.
      throw new Error(`rgs_url must be absolute, got "${rgsUrl}"`);
    }
  }

  /** The resolved base, surfaced by the boot diagnostics. */
  get base(): string { return this.rgsUrl; }

  private async post<T>(path: string, body: object): Promise<T> {
    const url = `${this.rgsUrl}${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionID: this.sessionID, ...body }),
    });
    if (!res.ok) {
      let code: RgsError = 'ERR_GEN';
      try { code = (await res.json())?.error ?? code; } catch { /* noop */ }
      // 405 from a POST means this hit a static file host, not the RGS —
      // almost always a relative rgs_url resolved against the game's own origin
      if (res.status === 405) {
        throw new RgsClientError(code, 405,
          `${url} (405 on POST means this is a static host, not the RGS — `
          + 'check that rgs_url is absolute)');
      }
      throw new RgsClientError(code, res.status, url);
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
