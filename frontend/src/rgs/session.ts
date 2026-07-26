/**
 * Session wiring — pick the real RGS or the dev mock, and never fail silently.
 *
 * The built game is uploaded to Stake Engine and served from
 * `https://{team}.cdn.stake-engine.com/{gameID}/{version}/index.html?...&rgs_url=...`.
 * If `rgs_url` is present we are running for a real player and MUST talk to the
 * RGS; without it we are in a local demo and fall back to the mock library.
 * Shipping a build that always used the mock would look fine on screen while
 * placing no real bets at all.
 *
 * The mock and its book fixture are excluded from a RELEASE build entirely.
 * `import.meta.env.MODE` is replaced with a literal at build time, so under
 * `--mode live` the whole branch is dead code and Rollup drops the 1.3 MB
 * fixture chunk with it. A live game has no business shipping a mock library.
 */
import { RgsClient, type AuthResponse, type PlayResponse } from './RgsClient';
import type { BetModeName } from '../types/events';
import type { LaunchParams } from './params';

/** True in the build that is uploaded to Stake Engine. */
export const IS_RELEASE = import.meta.env.MODE === 'live';

/** The subset of RGS behaviour the app actually uses. */
export interface Session {
  readonly live: boolean;
  /** Last request sent to the RGS, for diagnostics. Null for the demo mock. */
  readonly lastRequest?: { url: string; body: unknown } | null;
  authenticate(): Promise<AuthResponse>;
  play(amount: number, mode: BetModeName): Promise<PlayResponse>;
  endRound(baseBetUnits: number): Promise<{ balance: { amount: number; currency: string } }>;
}

class LiveSession implements Session {
  readonly live = true;
  private rgs: RgsClient;
  get lastRequest(): { url: string; body: unknown } | null { return this.rgs.lastRequest; }
  constructor(params: LaunchParams) {
    this.rgs = new RgsClient(params.rgsUrl, params.sessionID);
  }
  authenticate(): Promise<AuthResponse> { return this.rgs.authenticate(); }
  play(amount: number, mode: BetModeName): Promise<PlayResponse> {
    return this.rgs.play(amount, mode);
  }
  /** The live endpoint takes no bet argument; the signature is shared with the mock. */
  endRound(): Promise<{ balance: { amount: number; currency: string } }> {
    return this.rgs.endRound();
  }
}

export async function createSession(params: LaunchParams): Promise<Session> {
  if (params.rgsUrl) return new LiveSession(params);

  if (IS_RELEASE) {
    // Reaching here in a release build means the host opened the game without
    // its launch parameters. Say so plainly — the alternative is a game that
    // looks alive while every bet placed on it is imaginary.
    throw new Error(
      'No rgs_url in the launch URL. This build talks only to a real RGS; '
      + 'it must be opened through the operator lobby.');
  }

  const { MockRgs } = await import('../dev/MockRgs');
  const mock = new MockRgs();
  return {
    live: false,
    authenticate: () => mock.authenticate(),
    play: (amount, mode) => mock.play(amount, mode),
    endRound: (bet) => mock.endRound(bet),
  };
}
