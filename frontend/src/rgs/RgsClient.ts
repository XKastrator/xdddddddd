/**
 * RGS client — thin wrapper over the Stake Engine wallet/bet endpoints
 * (docs/rgs_docs/RGS.md). All money is integer with 6 decimal places.
 * The client NEVER computes payouts; it only relays server responses.
 */
import type { Book, BetModeName } from '../types/events';
import { findBook, describeShape } from './findBook';

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
  constructor(public code: RgsError, public status: number, public url = '',
              public responseBody = '') {
    super(`RGS ${code} (${status})${url ? ` at ${url}` : ''}`
      + (responseBody ? ` — ${responseBody.slice(0, 300)}` : ''));
  }
}

/**
 * Pull the book out of a play response, or fail with the response's actual
 * shape. Throwing here — after the debit — is unavoidable, but the message has
 * to say what came back, or the next person is guessing at nesting too.
 */
function bookOf(raw: unknown): Book {
  const book = findBook(raw);
  if (!book) {
    throw new Error('the RGS play response contained no book (no `events` array). '
      + `Response shape: ${describeShape(raw)}`);
  }
  return book;
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

  /** The last request body sent, for the diagnostics panel. */
  lastRequest: { url: string; body: unknown } | null = null;
  /** The last error response received, verbatim. */
  lastResponse: { url: string; status: number; body: string } | null = null;

  private async post<T>(path: string, body: object): Promise<T> {
    const url = `${this.rgsUrl}${path}`;
    this.lastRequest = { url, body: { sessionID: this.sessionID, ...body } };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionID: this.sessionID, ...body }),
    });
    if (!res.ok) {
      // Read the WHOLE body, not just `.error`. A 400 from the RGS normally
      // explains which field it disliked, and throwing that away left "ERR_VAL
      // (400)" — which says a request was invalid but not what about it.
      let raw = '';
      try { raw = await res.text(); } catch { /* body already consumed */ }
      let code: RgsError = 'ERR_GEN';
      try { code = (JSON.parse(raw) as { error?: RgsError })?.error ?? code; }
      catch { /* not JSON; the raw text is still reported below */ }

      this.lastResponse = { url, status: res.status, body: raw.slice(0, 1000) };

      // 405 from a POST means this hit a static file host, not the RGS —
      // almost always a relative rgs_url resolved against the game's own origin
      if (res.status === 405) {
        throw new RgsClientError(code, 405,
          `${url} (405 on POST means this is a static host, not the RGS — `
          + 'check that rgs_url is absolute)', raw);
      }
      throw new RgsClientError(code, res.status, url, raw);
    }
    return res.json() as Promise<T>;
  }

  async authenticate(): Promise<AuthResponse> {
    const raw = await this.post<Record<string, unknown>>('/wallet/authenticate', {});
    const res = raw as unknown as AuthResponse;
    // An active round has to carry its book through, wherever the server put it
    if (res.round?.active) res.round.book = findBook(raw.round ?? raw) ?? undefined;
    return res;
  }
  balance(): Promise<{ balance: Balance }> {
    return this.post('/wallet/balance', {});
  }
  /**
   * Bet mode casing that the RGS actually accepted, remembered for the session.
   * `null` until the first successful play.
   */
  private modeCase: 'as-is' | 'upper' | null = null;

  /**
   * amount is the base bet in 6-dp integer units; mode multiplies the debit.
   *
   * The mode string has to match what the RGS published for this game, and the
   * two sources disagree on case: the math SDK names modes lowercase
   * (`name="base"`) while the RGS docs' play example sends `"mode": "BASE"`.
   * Rather than guess, the first bet tries the name as configured and, if the
   * RGS answers with a VALIDATION error, retries once in upper case.
   *
   * This cannot double-bill: a validation rejection means the bet was refused,
   * so no debit happened and the retry is a fresh first attempt. Any other
   * failure (balance, session, network) is rethrown untouched — those may have
   * moved money and must never be retried blind.
   */
  async play(amount: number, mode: BetModeName): Promise<PlayResponse> {
    const send = async (m: string): Promise<PlayResponse> => {
      const raw = await this.post<Record<string, unknown>>('/wallet/play', { amount, mode: m });
      return { ...(raw as unknown as PlayResponse), round: { book: bookOf(raw), mode } };
    };

    if (this.modeCase === 'upper') return send(mode.toUpperCase());
    try {
      const res = await send(mode);
      this.modeCase = 'as-is';
      return res;
    } catch (e) {
      const validation = e instanceof RgsClientError
        && (e.code === 'ERR_VAL' || (e.status >= 400 && e.status < 500 && e.status !== 402));
      if (!validation || this.modeCase !== null) throw e;
      const res = await send(mode.toUpperCase());
      this.modeCase = 'upper';
      console.warn(`[molten-crown] RGS wanted the bet mode upper-cased ("${
        mode.toUpperCase()}"); using that for this session`);
      return res;
    }
  }
  endRound(): Promise<{ balance: Balance }> {
    return this.post('/wallet/end-round', {});
  }
  /** Persist in-progress action so a disconnected round can resume. */
  event(event: string): Promise<{ event: string }> {
    return this.post('/bet/event', { event });
  }
}
