/**
 * Demo app entry — boots PixiJS, wires the DEV MockRgs to BookPlayer +
 * PixiPresenter, and hooks the UI (spin, mode, buy confirmation, help, turbo,
 * skip, audio).
 *
 * Production differs in exactly one place: swap MockRgs for RgsClient (see
 * src/main.ts). Everything below the RGS boundary is production code.
 */
import { Application } from 'pixi.js';
import { BookPlayer } from './game/BookPlayer';
import { PixiPresenter } from './render/PixiPresenter';
import { PerfGuard } from './render/PerfGuard';
import { createSession } from './rgs/session';
import { RgsClientError } from './rgs/RgsClient';
import { AssetLoader } from './assets/AssetLoader';
import { AudioManager } from './audio/AudioManager';
import { WebAudioBackend } from './audio/WebAudioBackend';
import { HelpScreen } from './ui/HelpScreen';
import { BuyPanel } from './ui/BuyPanel';
import { AutoplayPanel } from './ui/AutoplayPanel';
import { AutoplaySession } from './game/Autoplay';
import { LoadingScreen } from './ui/LoadingScreen';
import { setLang, t } from './i18n/strings';
import { formatMoney } from './rgs/currency';
import { modeInfo } from './game/gameInfo';
import { readLaunchParams } from './rgs/params';
import { betLevelsFrom, snapBet, defaultBet } from './rgs/betLevels';
import type { BetModeName } from './types/events';
import { MODES } from './game/gameInfo';

async function main(): Promise<void> {
  const params = readLaunchParams();
  setLang(params.lang);

  const loading = new LoadingScreen();
  loading.set(0.04);

  const host = document.getElementById('stage') as HTMLDivElement;
  const app = new Application();
  // Multisampling is worth its fill-rate cost only where a device pixel is
  // large enough for a stair-step to be visible. At 2x it is not, and the
  // renderer is fill-bound — so buy the resolution, not the MSAA.
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  await app.init({
    background: 0x0a0806, antialias: dpr < 1.5, resizeTo: host,
    resolution: dpr, autoDensity: true,
    // custom filters ship a GLSL program only; WebGL is also the wider install
    // base on the mobile devices a casino game has to cover
    preference: 'webgl',
  });
  host.appendChild(app.canvas);
  loading.set(0.1);

  // preload the texture atlas + audio; progress is real, not a timer
  const assets = new AssetLoader();
  await assets.load('assets/', (p) => loading.set(0.1 + p * 0.8));

  if (assets.warnings.length) {
    console.warn('[molten-crown] assets degraded:\n' + assets.warnings.join('\n'));
  }

  const backend = new WebAudioBackend((id) => assets.audioBuffer(id));
  const audio = new AudioManager(backend);
  // forward declarations so the in-canvas panel can call into the round logic
  let spinFn: () => void = () => {};
  let skipFn: () => void = () => {};
  let betStepFn: (d: -1 | 1) => void = () => {};
  let modeStepFn: (d: -1 | 1) => void = () => {};
  let helpFn: () => void = () => {};
  let toggleTurboFn: () => boolean = () => false;
  let autoplayFn: () => void = () => {};
  let stopAutoFn: () => void = () => {};
  let bonusFn: () => void = () => {};

  const presenter = new PixiPresenter(app, audio, {
    getTexture: (sym) => assets.texture(sym),
    getWinLoop: (sym) => assets.winLoop(sym),
    scenes: assets.sceneTextures(),
    character: assets.character(),
    font: assets.font(),
    logo: assets.logo(),
    ui: {
      onSpin: () => spinFn(),
      onSkip: () => skipFn(),
      onHelp: () => helpFn(),
      onToggleTurbo: () => toggleTurboFn(),
      onBetStep: (d) => betStepFn(d),
      onModeStep: (d) => modeStepFn(d),
      onAutoplay: () => autoplayFn(),
      onStopAuto: () => stopAutoFn(),
      onBonus: () => bonusFn(),
    },
  });
  const panel = presenter.panel;

  // Watch the frame rate and trade pixels for smoothness if the device cannot
  // keep up. A slot that stutters is worse than one that is slightly softer,
  // and the players least able to run it are the ones on the weakest phones.
  const perf = new PerfGuard(app, presenter, (tier) => {
    console.info(`[molten-crown] frame rate low — quality tier ${tier}`);
  });

  const rgs = await createSession(params);
  const auth = await rgs.authenticate();
  loading.set(0.95);

  const help = new HelpScreen();
  const buyPanel = new BuyPanel();
  const autoPanel = new AutoplayPanel();

  // jurisdiction gating (identical rule to production main.ts)
  if (auth.config.jurisdiction.disabledTurbo) panel?.setTurboVisible(false);

  const currency = auth.balance.currency;
  // `betLevels` is OPTIONAL per the RGS spec; what is mandatory is that the bet
  // sits between minBet and maxBet and divides by stepBet. Reading the array
  // directly crashes against a legal RGS that omits it, and index-stepping can
  // walk the bet off the step grid — either way /wallet/play rejects the bet and
  // SPIN appears dead.
  const BET_LEVELS = betLevelsFrom(auth.config);
  let bet = defaultBet(auth.config, BET_LEVELS);
  let mode: BetModeName = 'base';
  let turbo = false;
  let busy = false;
  let audioReady = false;
  let player: BookPlayer | null = null;
  let autoSession: AutoplaySession | null = null;
  /** Last RGS rejection, surfaced for support without opening devtools. */
  let lastError: Record<string, unknown> | null = null;

  const $ = (id: string) => document.getElementById(id) as HTMLElement;
  let betIdx = Math.max(0, BET_LEVELS.indexOf(bet));

  let balanceText = '';
  const setBal = (u: number) => {
    balanceText = formatMoney(u, currency);
    panel?.setBalance(balanceText);
  };
  const costUnits = () => Math.round(bet * modeInfo(mode).cost);
  const setCost = () => {
    panel?.setBet(formatMoney(costUnits(), currency));
    panel?.setMode(t(modeInfo(mode).titleKey));
    // a feature buy is a single deliberate purchase, so it is never autoplayed
    panel?.setAutoplayAllowed(!modeInfo(mode).isBuy);
    presenter.setMode(mode);
  };

  /**
   * Player-facing status. Drawn ON THE CANVAS, and mirrored into the DOM strip
   * for assistive technology. The DOM-only version was invisible inside an
   * operator iframe, so a failing round was indistinguishable from a dead
   * button.
   */
  const notify = (msg: string) => {
    presenter.toast(msg);
    const el = document.getElementById('err');
    if (!el) return;
    el.textContent = msg;
    window.setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 4000);
  };

  // the control bar is inside the canvas and localised from the same catalogue
  panel?.setCaptions(t('ui.bet'), t('ui.balance'), t('ui.mode'));

  setBal(auth.balance.amount);
  setCost();

  /**
   * Resume an interrupted round.
   *
   * The RGS spec is explicit: "Frontends should continue the round if it remains
   * active." Skipping this is not cosmetic — while a round is open the RGS
   * refuses new bets, so ONE interrupted round makes SPIN do nothing for that
   * player from then on, across reloads, with no way out from inside the game.
   */
  if (auth.round?.active) {
    try {
      notify(t('err.resume'));
      presenter.reduced = true;               // replay briskly; this is catch-up
      // An active round with no book cannot be replayed, but it still has to be
      // CLOSED — leaving it open keeps every future bet blocked, which is the
      // whole failure this handles.
      if (auth.round.book) await new BookPlayer(auth.round.book, presenter).play();
      const end = await rgs.endRound(bet);
      setBal(end.balance.amount);
    } catch (e) {
      console.error('[molten-crown] could not resume the open round', e);
      notify(t('err.round'));
    } finally {
      presenter.reduced = reducedWanted();
    }
  }

  window.addEventListener('resize', () => presenter.resize(app.renderer.width, app.renderer.height));

  /** WebAudio may only start from a user gesture. */
  function ensureAudio(): void {
    if (audioReady) return;
    audioReady = true;
    backend.unlock();
    audio.enterState('base');
  }

  function reducedWanted(): boolean {
    return ($('reduced') as HTMLInputElement).checked
      || matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  const anyOverlayOpen = () => buyPanel.isOpen || help.isOpen || autoPanel.isOpen;

  /**
   * Place one bet and play the returned book to completion.
   *
   * Returns what the round did (for autoplay's limit checks) or null when it
   * could not be played. Autoplay and the SPIN button share this exact path, so
   * an autoplayed round is byte-for-byte the same bet as a manual one.
   */
  async function playRound(): Promise<{ winUnits: number; bonus: boolean } | null> {
    busy = true;
    panel?.setSpinEnabled(false);
    // Whether the bet was actually taken. Everything after that point runs with
    // a round open on the server, and a round left open refuses every later bet.
    let placed = false;
    try {
      const res = await rgs.play(bet, mode);
      placed = true;
      setBal(res.balance.amount);
      presenter.skip = false;
      presenter.reduced = turbo || reducedWanted();
      if (!res.round?.book) throw new Error('the RGS returned a round with no book');
      player = new BookPlayer(res.round.book, presenter);
      const winMult = await player.play();
      const end = await rgs.endRound(bet);
      setBal(end.balance.amount);
      return {
        winUnits: Math.round(bet * winMult),
        bonus: (res.round.book?.events ?? []).some((e) => e.type === 'bonusStart'),
      };
    } catch (e) {
      // RgsClientError carries the code in `.code`; its `.message` is the
      // human-readable "RGS ERR_IPB (402)". Comparing against `.message` meant
      // a live insufficient-balance response showed the generic round-failed
      // text instead of telling the player what actually happened.
      const code = e instanceof RgsClientError ? e.code
        : e instanceof Error ? e.message : '';
      if (code === 'ERR_IPB') {
        notify(t('err.balance'));
      } else {
        // Show the RGS's OWN verdict. "Round failed, please try again" is
        // useless to everyone: the player retries forever and support has
        // nothing to go on. The code and status say which side is refusing and
        // why, and they are short enough to read off a screen.
        const status = e instanceof RgsClientError ? e.status : 0;
        lastError = {
          code: code || 'unknown', status,
          mode, amount: bet, rgs: params.rgsUrl,
          detail: e instanceof Error ? e.message : String(e),
          // the RGS's own words about what it disliked
          response: e instanceof RgsClientError ? e.responseBody : '',
        };
        console.error('[molten-crown] play failed', lastError);
        notify(status ? `${t('err.round')} · ${code} (${status})`
          : `${t('err.round')} · ${code || 'network'}`);
      }
      // `placed` covers the ordinary path; `rgs.roundOpen` covers the one that
      // actually bit — a 200 from /wallet/play whose payload then failed to
      // parse, which throws out of `play()` itself and never reaches the line
      // below the call.
      if (placed || rgs.roundOpen) {
        // The bet was taken and a round is open on the server. Whatever failed
        // afterwards, leaving it open is the one outcome that must not happen:
        // the RGS refuses every later bet while a round is active, so a single
        // bad presentation would brick the game for this player — one failed
        // round, then nothing but "round failed" forever. Closing it also
        // settles whatever the round actually won, which the player is owed
        // regardless of whether the animation managed to show it.
        try {
          const end = await rgs.endRound(bet);
          setBal(end.balance.amount);
        } catch (closeErr) {
          console.error('[molten-crown] could not close the failed round', closeErr);
        }
      }
      return null;
    } finally {
      busy = false;
      panel?.setSpinEnabled(true);
      player = null;
    }
  }

  async function spin(): Promise<void> {
    if (busy || autoSession || anyOverlayOpen()) return;
    ensureAudio();

    // Buy modes require explicit confirmation BEFORE the bet is placed.
    if (modeInfo(mode).isBuy) {
      // The panel offers BOTH features, so what comes back is which one was
      // bought — not a yes/no about the one the bar happened to hold.
      const chosen = await buyPanel.confirm(mode, bet, currency);
      if (!chosen) { mode = 'base'; setCost(); return; }
      mode = chosen;
      setCost();
      try {
        await playRound();
      } finally {
        // BONUS is a one-shot entry point, not a sticky mode. Leaving it set
        // would make the next tap on SPIN silently cost a hundred times the
        // bet — the player asked for one feature buy, not a new price.
        mode = 'base';
        setCost();
      }
      return;
    }
    await playRound();
  }

  /**
   * Autoplay: a bounded run of ordinary bets.
   *
   * The limits are fixed before the first round and never re-read, the bet and
   * mode are locked for the duration, and the session only counts — it has no
   * influence whatsoever on any outcome (see game/Autoplay.ts).
   */
  async function startAutoplay(): Promise<void> {
    if (busy || autoSession || anyOverlayOpen() || modeInfo(mode).isBuy) return;
    ensureAudio();
    const cost = costUnits();
    const limits = await autoPanel.configure(cost, currency);
    if (!limits) return;

    const session = new AutoplaySession(limits);
    autoSession = session;
    panel?.setAutoplay(session.remaining);
    panel?.setSpinEnabled(true);

    while (session.running) {
      const out = await playRound();
      if (!out) { session.fail(); break; }
      session.record({ costUnits: cost, winUnits: out.winUnits, bonus: out.bonus });
      panel?.setAutoplay(session.running ? session.remaining : null);
      if (!session.running) break;
      // a beat between rounds so a sequence still reads as discrete bets
      await new Promise((r) => window.setTimeout(r, turbo ? 140 : 340));
    }

    autoSession = null;
    panel?.setAutoplay(null);
    panel?.setSpinEnabled(true);
    notify(t(`auto.stop.${session.stopReason ?? 'completed'}`));
  }

  function doSkip(): void { presenter.skip = true; player?.skip(); }

  spinFn = () => void spin();
  skipFn = doSkip;
  /**
   * The menu: paytable plus the two settings that used to sit in a strip under
   * the game. `render()` rebuilds the overlay body, so the block is re-attached
   * each time rather than once at boot.
   */
  helpFn = () => {
    help.render();
    const settings = document.getElementById('controls');
    if (settings) {
      settings.hidden = false;
      help.body.appendChild(settings);
    }
    help.open();
  };
  autoplayFn = () => void startAutoplay();
  stopAutoFn = () => { autoSession?.cancel(); };
  /**
   * BONUS opens the feature buy. It selects the mode and runs the ordinary spin
   * path, which puts the confirmation panel in front of the player — so the
   * rule that a buy is always confirmed before any money moves is untouched,
   * and cancelling drops straight back to the base game.
   */
  bonusFn = () => {
    if (busy || autoSession) return;
    mode = 'bonus';
    setCost();
    void spin();
  };
  toggleTurboFn = () => {
    turbo = !turbo;
    presenter.reduced = turbo || reducedWanted();   // turbo shortens presentation only
    return turbo;
  };
  betStepFn = (d) => {
    if (autoSession) return;          // the bet is locked for the whole sequence
    betIdx = Math.max(0, Math.min(BET_LEVELS.length - 1, betIdx + d));
    bet = snapBet(BET_LEVELS[betIdx], auth.config);
    setCost();
  };
  modeStepFn = (d) => {
    if (autoSession) return;
    const i = MODES.findIndex((m) => m.name === mode);
    mode = MODES[(i + d + MODES.length) % MODES.length].name;
    setCost();
  };
  ($('mute') as HTMLInputElement)?.addEventListener('change', (e) => {
    audio.setMuted((e.target as HTMLInputElement).checked);
  });
  window.addEventListener('keydown', (e) => {
    if (anyOverlayOpen()) return;
    if (e.code === 'Space') {
      e.preventDefault();
      // while a sequence runs, the primary action is STOP — on the keyboard too
      if (autoSession) autoSession.cancel(); else void spin();
    }
    if (e.key.toLowerCase() === 's') doSkip();
  });

  /**
   * Automation surface. The controls now live inside the canvas, where a test
   * driver cannot click DOM nodes, so the same intents the panel invokes are
   * also exposed here. Read-only state plus the identical callbacks — it adds
   * no capability a player does not already have through the UI.
   */
  (globalThis as Record<string, unknown>).__ui = {
    spin: () => spinFn(),
    skip: () => skipFn(),
    help: () => helpFn(),
    idle: () => !busy,
    balance: () => balanceText,
    labels: () => ({ spin: t('ui.spin'), skip: t('ui.skip'), help: t('ui.help') }),
    setMode: (m: BetModeName) => { mode = m; setCost(); },
    // read-only surface for the pointer-input test: it must be able to find the
    // in-canvas controls and observe their effect without a DOM node to query
    hitPoints: () => presenter.hitPoints(),
    // what the game is actually talking to, and what went wrong last — the two
    // questions any deployment problem starts with
    diagnostics: () => ({
      rgs: params.rgsUrl, session: params.sessionID, live: rgs.live,
      mode, bet, betLevels: BET_LEVELS, config: auth.config, lastError,
      lastRequest: rgs.lastRequest ?? null,
      lastResponse: rgs.lastResponse ?? null,
      quality: { tier: perf.tier, resolution: app.renderer.resolution },
    }),
    /** Quality tier chosen by the frame-rate guard. 0 = full. */
    perfTier: () => perf.tier,
    /** Force a quality tier. Changes how the game LOOKS, never what it pays. */
    setQuality: (n: number) => { perf.force(n); return perf.tier; },
    /**
     * Hold a quality tier and stop the guard adjusting it. Capture and QA only
     * — a screen-recording harness stalls frames, which the guard correctly
     * reads as a weak device, so an unpinned recording shows the degraded game
     * rather than the real one.
     */
    pinQuality: (n: number) => perf.pin(n),
    betText: () => formatMoney(costUnits(), currency),
    turboOn: () => turbo,
    autoplay: () => autoplayFn(),
    stopAuto: () => stopAutoFn(),
    autoRemaining: () => autoSession?.remaining ?? null,
  };

  /**
   * `?debug=1` panel. A deployment problem always starts with the same two
   * questions — what is the game talking to, and what exactly did it refuse —
   * and neither is answerable from a screenshot of "round failed". This puts
   * both on screen, where they can be photographed, without devtools.
   */
  if (new URLSearchParams(location.search).get('debug') === '1') {
    const box = document.createElement('pre');
    box.id = 'diag';
    box.style.cssText = [
      'position:fixed', 'left:8px', 'bottom:8px', 'z-index:60', 'margin:0',
      'max-width:min(560px,92vw)', 'max-height:46vh', 'overflow:auto',
      'padding:10px 12px', 'border-radius:10px', 'white-space:pre-wrap',
      'background:rgba(6,4,2,.92)', 'color:#f4ece0', 'border:1px solid #2a2018',
      'font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace',
    ].join(';');
    document.body.appendChild(box);
    const paint = () => {
      const d = (globalThis as Record<string, any>).__ui?.diagnostics?.();
      box.textContent = JSON.stringify(d, null, 1);
    };
    paint();
    window.setInterval(paint, 1000);
  }

  await loading.done();
  perf.start();
}

/**
 * Boot guard. A thrown error used to leave the player staring at a black canvas
 * with the static shell still visible — indistinguishable from a hung game. Any
 * failure now reports itself on screen (and to the console) so an upload problem
 * is diagnosable without devtools.
 */
function showBootError(message: string): void {
  document.querySelector('.loading')?.remove();
  const box = document.createElement('div');
  box.setAttribute('role', 'alert');
  box.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:100', 'display:flex',
    'align-items:center', 'justify-content:center', 'padding:24px',
    'background:#0a0806', 'color:#f4ece0',
    'font:14px/1.6 system-ui,-apple-system,sans-serif', 'text-align:center',
  ].join(';');
  box.innerHTML =
    '<div style="max-width:520px">'
    + '<div style="color:#ffb347;letter-spacing:4px;font-weight:800;margin-bottom:12px">'
    + 'MOLTEN CROWN</div>'
    + '<div style="color:#ff8a8a;margin-bottom:10px">The game could not start.</div>'
    + `<pre style="white-space:pre-wrap;color:#9a8c78;font-size:12px;margin:0">${
        message.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!))
      }</pre></div>`;
  document.body.appendChild(box);
}

void main().catch((e: unknown) => {
  const msg = e instanceof Error ? `${e.message}\n\n${e.stack ?? ''}` : String(e);
  console.error('[molten-crown] boot failed', e);
  showBootError(msg);
});
