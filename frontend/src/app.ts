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
import { createSession } from './rgs/session';
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
import type { BetModeName } from './types/events';
import { MODES } from './game/gameInfo';

async function main(): Promise<void> {
  const params = readLaunchParams();
  setLang(params.lang);

  const loading = new LoadingScreen();
  loading.set(0.04);

  const host = document.getElementById('stage') as HTMLDivElement;
  const app = new Application();
  await app.init({
    background: 0x0a0806, antialias: true, resizeTo: host,
    resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true,
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

  const presenter = new PixiPresenter(app, audio, {
    getTexture: (sym) => assets.texture(sym),
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
    },
  });
  const panel = presenter.panel;

  const rgs = createSession(params);
  const auth = await rgs.authenticate();
  loading.set(0.95);

  const help = new HelpScreen();
  const buyPanel = new BuyPanel();
  const autoPanel = new AutoplayPanel();

  // jurisdiction gating (identical rule to production main.ts)
  if (auth.config.jurisdiction.disabledTurbo) panel?.setTurboVisible(false);

  const currency = auth.balance.currency;
  let bet = auth.config.defaultBetLevel;
  let mode: BetModeName = 'base';
  let turbo = false;
  let busy = false;
  let audioReady = false;
  let player: BookPlayer | null = null;
  let autoSession: AutoplaySession | null = null;

  const $ = (id: string) => document.getElementById(id) as HTMLElement;
  const BET_LEVELS = auth.config.betLevels;
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

  /** Transient status line under the stage (also used for autoplay outcomes). */
  const notify = (msg: string) => {
    const el = document.getElementById('err');
    if (!el) return;
    el.textContent = msg;
    window.setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 4000);
  };

  // the control bar is inside the canvas and localised from the same catalogue
  panel?.setCaptions(t('ui.bet'), t('ui.balance'), t('ui.mode'));

  setBal(auth.balance.amount);
  setCost();

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
    try {
      const res = await rgs.play(bet, mode);
      setBal(res.balance.amount);
      presenter.skip = false;
      presenter.reduced = turbo || reducedWanted();
      player = new BookPlayer(res.round.book, presenter);
      const winMult = await player.play();
      const end = await rgs.endRound(bet);
      setBal(end.balance.amount);
      return {
        winUnits: Math.round(bet * winMult),
        bonus: res.round.book.events.some((e) => e.type === 'bonusStart'),
      };
    } catch (e) {
      notify(e instanceof Error && e.message === 'ERR_IPB'
        ? t('err.balance') : t('err.round'));
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
      const ok = await buyPanel.confirm(mode, bet, currency);
      if (!ok) return;
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
  helpFn = () => { help.render(); help.open(); };
  autoplayFn = () => void startAutoplay();
  stopAutoFn = () => { autoSession?.cancel(); };
  toggleTurboFn = () => {
    turbo = !turbo;
    presenter.reduced = turbo || reducedWanted();   // turbo shortens presentation only
    return turbo;
  };
  betStepFn = (d) => {
    if (autoSession) return;          // the bet is locked for the whole sequence
    betIdx = Math.max(0, Math.min(BET_LEVELS.length - 1, betIdx + d));
    bet = BET_LEVELS[betIdx];
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
    autoplay: () => autoplayFn(),
    stopAuto: () => stopAutoFn(),
    autoRemaining: () => autoSession?.remaining ?? null,
  };

  await loading.done();
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
