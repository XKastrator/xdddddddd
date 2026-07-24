/**
 * MOLTEN CROWN — application entry point (wiring only).
 *
 * Flow: read launch params -> authenticate -> resume any active round ->
 * on spin, call /play, replay the returned Book through the BookPlayer, then
 * /end-round. All payout truth comes from the Book's events + payoutMultiplier;
 * the client never computes wins. Presentation is injected (PixiPresenter in
 * production; the DOM harness in player/index.html demonstrates the same
 * contract).
 */
import { readLaunchParams } from './rgs/params';
import { RgsClient, RgsClientError } from './rgs/RgsClient';
import { BookPlayer } from './game/BookPlayer';
import type { Presenter, Timing } from './game/Presenter';
import type { BetModeName } from './types/events';

export interface AppDeps {
  createPresenter: (timing: Timing) => Presenter;
  onError: (code: string) => void;
}

export async function boot(deps: AppDeps): Promise<void> {
  const params = readLaunchParams();
  const rgs = new RgsClient(params.rgsUrl, params.sessionID);

  const auth = await rgs.authenticate();
  const j = auth.config.jurisdiction;
  const timing: Timing = {
    turbo: false,                       // user toggle, gated below
    instant: false,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
  const turboAllowed = !j.disabledTurbo;      // jurisdiction gate
  const fullscreenAllowed = !j.disabledFullscreen;
  const presenter = deps.createPresenter(timing);

  // Resume an interrupted round (auto_close_disabled bonus/super).
  if (auth.round?.active && auth.round.book) {
    const player = new BookPlayer(auth.round.book, presenter);
    await player.play();               // resume from start of recorded events
    await rgs.endRound();
  }

  async function spin(bet: number, mode: BetModeName): Promise<number> {
    try {
      const res = await rgs.play(bet, mode);
      const player = new BookPlayer(res.round.book, presenter);
      const win = await player.play();
      await rgs.endRound();
      return win;                      // in bet-multiplier units, from events only
    } catch (e) {
      if (e instanceof RgsClientError) deps.onError(e.code);
      throw e;
    }
  }

  // expose for the host shell / UI layer
  (globalThis as Record<string, unknown>).moltenCrown = {
    spin, turboAllowed, fullscreenAllowed, config: auth.config,
  };
}
