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

  const presenter = new PixiPresenter(app, audio, {
    getTexture: (sym) => assets.texture(sym),
    scenes: assets.sceneTextures(),
    rigParts: assets.rigParts(),
    font: assets.font(),
    ui: {
      onSpin: () => spinFn(),
      onSkip: () => skipFn(),
      onHelp: () => helpFn(),
      onToggleTurbo: () => toggleTurboFn(),
      onBetStep: (d) => betStepFn(d),
      onModeStep: (d) => modeStepFn(d),
    },
  });
  const panel = presenter.panel;

  const rgs = createSession(params);
  const auth = await rgs.authenticate();
  loading.set(0.95);

  const help = new HelpScreen();
  const buyPanel = new BuyPanel();

  // jurisdiction gating (identical rule to production main.ts)
  if (auth.config.jurisdiction.disabledTurbo) panel?.setTurboVisible(false);

  const currency = auth.balance.currency;
  let bet = auth.config.defaultBetLevel;
  let mode: BetModeName = 'base';
  let turbo = false;
  let busy = false;
  let audioReady = false;
  let player: BookPlayer | null = null;

  const $ = (id: string) => document.getElementById(id) as HTMLElement;
  const BET_LEVELS = auth.config.betLevels;
  let betIdx = Math.max(0, BET_LEVELS.indexOf(bet));

  let balanceText = '';
  const setBal = (u: number) => {
    balanceText = formatMoney(u, currency);
    panel?.setBalance(balanceText);
  };
  const setCost = () => {
    panel?.setBet(formatMoney(Math.round(bet * modeInfo(mode).cost), currency));
    panel?.setMode(t(modeInfo(mode).titleKey));
    presenter.setMode(mode);
  };

  // the control bar is inside the canvas and localised from the same catalogue
  panel?.setLabels(t('ui.spin'), t('ui.skip'), t('ui.turbo'), t('ui.help'));
  panel?.setCaptions(t('ui.bet'), t('ui.balance'));

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

  async function spin(): Promise<void> {
    if (busy || buyPanel.isOpen || help.isOpen) return;
    ensureAudio();

    // Buy modes require explicit confirmation BEFORE the bet is placed.
    if (modeInfo(mode).isBuy) {
      const ok = await buyPanel.confirm(mode, bet, currency);
      if (!ok) return;
    }

    busy = true;
    panel?.setSpinEnabled(false);
    try {
      const res = await rgs.play(bet, mode);
      setBal(res.balance.amount);
      presenter.skip = false;
      presenter.reduced = turbo || reducedWanted();
      player = new BookPlayer(res.round.book, presenter);
      await player.play();
      const end = await rgs.endRound(bet);
      setBal(end.balance.amount);
    } catch (e) {
      $('err').textContent = e instanceof Error && e.message === 'ERR_IPB'
        ? t('err.balance') : t('err.round');
      setTimeout(() => { $('err').textContent = ''; }, 3000);
    } finally {
      busy = false;
      panel?.setSpinEnabled(true);
      player = null;
    }
  }

  function doSkip(): void { presenter.skip = true; player?.skip(); }

  spinFn = () => void spin();
  skipFn = doSkip;
  helpFn = () => { help.render(); help.open(); };
  toggleTurboFn = () => {
    turbo = !turbo;
    presenter.reduced = turbo || reducedWanted();   // turbo shortens presentation only
    return turbo;
  };
  betStepFn = (d) => {
    betIdx = Math.max(0, Math.min(BET_LEVELS.length - 1, betIdx + d));
    bet = BET_LEVELS[betIdx];
    setCost();
  };
  modeStepFn = (d) => {
    const i = MODES.findIndex((m) => m.name === mode);
    mode = MODES[(i + d + MODES.length) % MODES.length].name;
    setCost();
  };
  ($('mute') as HTMLInputElement)?.addEventListener('change', (e) => {
    audio.setMuted((e.target as HTMLInputElement).checked);
  });
  window.addEventListener('keydown', (e) => {
    if (help.isOpen || buyPanel.isOpen) return;
    if (e.code === 'Space') { e.preventDefault(); void spin(); }
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
