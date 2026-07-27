/**
 * RGS client — thin wrapper over the Stake Engine wallet/bet endpoints
 * (docs/rgs_docs/RGS.md). All money is integer with 6 decimal places.
 * The client NEVER computes payouts; it only relays server responses.
 */
import type { Book, BetModeName } from '../types/events';
import { findBook, describeShape, roundLooksActive, isActiveRoundRefusal } from './findBook';

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
    // Whether a round is still open is decided by SHAPE, not by one key name:
    // reading `round.active` alone was false against the live RGS while every
    // bet was being refused for exactly that reason.
    const active = roundLooksActive(raw);
    if (active) {
      res.round = {
        ...(res.round ?? {}),
        active: true,
        book: findBook(raw.round ?? raw) ?? undefined,
      };
    }
    return res;
  }
  balance(): Promise<{ balance: Balance }> {
    return this.post('/wallet/balance', {});
  }
  /**
   * Which request variant the RGS actually accepted, remembered for the session
   * so later bets go straight to it instead of re-probing every round.
   */
  private playVariant: number | null = null;

  /**
   * amount is the base bet in 6-dp integer units; mode multiplies the debit.
   *
   * The `mode` value has to match what the RGS published for this game, and
   * three plausible spellings exist with no way to tell them apart from the
   * client:
   *
   *   1. the name as configured — the math SDK writes modes lowercase
   *      (`name="base"` in src/config/betmode.py)
   *   2. upper case — the RGS docs' own play example sends `"mode": "BASE"`
   *   3. no `mode` field at all — a game published with a single default mode
   *      can reject any mode string as an unknown value
   *
   * So the first bet of a session walks that ladder and stops at whichever the
   * server accepts. This cannot double-bill: every step is taken ONLY after a
   * VALIDATION rejection, which means the bet was refused and no money moved,
   * making the next attempt a fresh first bet. Balance, session and network
   * failures are rethrown untouched — those may have moved money, and retrying
   * them blind is how a player gets charged twice.
   */
  async play(amount: number, mode: BetModeName): Promise<PlayResponse> {
    try {
      return await this.attemptPlay(amount, mode);
    } catch (e) {
      const body = e instanceof RgsClientError ? e.responseBody : '';
      if (this.clearing || !isActiveRoundRefusal(body)) throw e;
      // The server is holding a round the player never closed. Until it is
      // closed EVERY bet is refused, so this is not retrying a failed bet —
      // closing the old round is the only way this player ever bets again.
      // Safe by the same rule as the mode ladder: a validation refusal means
      // the bet was rejected before any debit, so the attempt below is a fresh
      // first bet, not a second charge for the same one.
      this.clearing = true;
      try {
        console.warn('[molten-crown] the RGS is holding an unfinished round; '
          + 'closing it and placing the bet again');
        await this.endRound();
        return await this.attemptPlay(amount, mode);
      } finally {
        this.clearing = false;
      }
    }
  }

  /** Guards against looping if `end-round` does not actually clear the round. */
  private clearing = false;

  private async attemptPlay(amount: number, mode: BetModeName): Promise<PlayResponse> {
    const variants: { label: string; body: Record<string, unknown> }[] = [
      { label: `mode="${mode}"`, body: { amount, mode } },
      { label: `mode="${mode.toUpperCase()}"`, body: { amount, mode: mode.toUpperCase() } },
      { label: 'no mode field', body: { amount } },
    ];

    const send = async (i: number): Promise<PlayResponse> => {
      const raw = await this.post<Record<string, unknown>>('/wallet/play', variants[i].body);
      return { ...(raw as unknown as PlayResponse), round: { book: bookOf(raw), mode } };
    };

    if (this.playVariant !== null) return send(this.playVariant);

    let lastErr: unknown;
    for (let i = 0; i < variants.length; i++) {
      try {
        const res = await send(i);
        this.playVariant = i;
        if (i > 0) {
          console.warn(`[molten-crown] the RGS accepted /wallet/play with `
            + `${variants[i].label}; using that for this session`);
        }
        return res;
      } catch (e) {
        lastErr = e;
        const validation = e instanceof RgsClientError
          && (e.code === 'ERR_VAL' || (e.status >= 400 && e.status < 500 && e.status !== 402));
        // anything that is not a plain validation refusal may have moved money
        if (!validation) throw e;
        // "player has active round" is a validation refusal about STATE, not
        // about the spelling of `mode`. Walking the ladder on it asks the same
        // rejected question three times and ends on a bogus "invalid amount"
        // from the no-mode rung — which is what the live console showed. Hand
        // it back so the caller can close the round instead.
        if (e instanceof RgsClientError && isActiveRoundRefusal(e.responseBody)) throw e;
        console.warn(`[molten-crown] /wallet/play refused ${variants[i].label}`
          + (e instanceof RgsClientError && e.responseBody
            ? ` — ${e.responseBody.slice(0, 200)}` : ''));
      }
    }
    throw lastErr;
  }

  endRound(): Promise<{ balance: Balance }> {
    return this.post('/wallet/end-round', {});
  }
  /** Persist in-progress action so a disconnected round can resume. */
  event(event: string): Promise<{ event: string }> {
    return this.post('/bet/event', { event });
  }
}
