/**
 * Session wiring — pick the real RGS or the dev mock, and never fail silently.
 *
 * The built game is uploaded to Stake Engine and served from
 * `https://{team}.cdn.stake-engine.com/{gameID}/{version}/index.html?...&rgs_url=...`.
 * If `rgs_url` is present we are running for a real player and MUST talk to the
 * RGS; without it we are in a local demo and fall back to the mock library.
 * Shipping a build that always used the mock would look fine on screen while
 * placing no real bets at all.
 */
import { RgsClient, type AuthResponse, type PlayResponse } from './RgsClient';
import { MockRgs } from '../dev/MockRgs';
import type { BetModeName } from '../types/events';
import type { LaunchParams } from './params';

/** The subset of RGS behaviour the app actually uses. */
export interface Session {
  readonly live: boolean;
  authenticate(): Promise<AuthResponse>;
  play(amount: number, mode: BetModeName): Promise<PlayResponse>;
  endRound(baseBetUnits: number): Promise<{ balance: { amount: number; currency: string } }>;
}

class LiveSession implements Session {
  readonly live = true;
  private rgs: RgsClient;
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

class DemoSession implements Session {
  readonly live = false;
  private mock = new MockRgs();
  authenticate(): Promise<AuthResponse> { return this.mock.authenticate(); }
  play(amount: number, mode: BetModeName): Promise<PlayResponse> {
    return this.mock.play(amount, mode);
  }
  endRound(bet: number): Promise<{ balance: { amount: number; currency: string } }> {
    return this.mock.endRound(bet);
  }
}

export function createSession(params: LaunchParams): Session {
  return params.rgsUrl ? new LiveSession(params) : new DemoSession();
}
