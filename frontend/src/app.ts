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
import { MockRgs } from './dev/MockRgs';
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
  });
  host.appendChild(app.canvas);
  loading.set(0.1);

  // preload the texture atlas + audio; progress is real, not a timer
  const assets = new AssetLoader();
  await assets.load('assets/', (p) => loading.set(0.1 + p * 0.8));

  const backend = new WebAudioBackend((id) => assets.audioBuffer(id));
  const audio = new AudioManager(backend);
  const presenter = new PixiPresenter(app, audio, (sym) => assets.texture(sym));

  const rgs = new MockRgs();
  const auth = await rgs.authenticate();
  loading.set(0.95);

  const help = new HelpScreen();
  const buyPanel = new BuyPanel();

  // jurisdiction gating (identical rule to production main.ts)
  const turboBtn = document.getElementById('turbo') as HTMLButtonElement;
  if (auth.config.jurisdiction.disabledTurbo) turboBtn.style.display = 'none';

  const currency = auth.balance.currency;
  let bet = auth.config.defaultBetLevel;
  let mode: BetModeName = 'base';
  let turbo = false;
  let busy = false;
  let audioReady = false;
  let player: BookPlayer | null = null;

  const $ = (id: string) => document.getElementById(id) as HTMLElement;
  const setBal = (u: number) => { $('balance').textContent = formatMoney(u, currency); };
  const setCost = () => {
    $('cost').textContent = formatMoney(Math.round(bet * modeInfo(mode).cost), currency);
  };

  // localise the static shell
  $('spin').textContent = t('ui.spin');
  $('skip').textContent = t('ui.skip');
  turboBtn.textContent = t('ui.turbo');
  $('helpBtn').textContent = t('ui.help');
  $('lblBalance').textContent = t('ui.balance');
  $('lblCost').textContent = t('ui.betcost');
  $('lblReduced').textContent = t('ui.reduced');

  setBal(auth.balance.amount);
  setCost();
  presenter.setMode(mode);

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
    ($('spin') as HTMLButtonElement).disabled = true;
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
      ($('spin') as HTMLButtonElement).disabled = false;
      player = null;
    }
  }

  function doSkip(): void { presenter.skip = true; player?.skip(); }

  $('spin').addEventListener('click', () => void spin());
  $('skip').addEventListener('click', doSkip);
  $('helpBtn').addEventListener('click', () => { help.render(); help.open(); });
  turboBtn.addEventListener('click', () => {
    turbo = !turbo;
    turboBtn.dataset.on = String(turbo);
    presenter.reduced = turbo || reducedWanted();   // turbo shortens presentation only
  });
  ($('mute') as HTMLInputElement).addEventListener('change', (e) => {
    audio.setMuted((e.target as HTMLInputElement).checked);
  });
  ($('mode') as HTMLSelectElement).addEventListener('change', (e) => {
    mode = (e.target as HTMLSelectElement).value as BetModeName;
    presenter.setMode(mode); setCost();
  });
  ($('bet') as HTMLSelectElement).addEventListener('change', (e) => {
    bet = Number((e.target as HTMLSelectElement).value); setCost();
  });
  window.addEventListener('keydown', (e) => {
    if (help.isOpen || buyPanel.isOpen) return;
    if (e.code === 'Space') { e.preventDefault(); void spin(); }
    if (e.key.toLowerCase() === 's') doSkip();
  });

  await loading.done();
}

void main();
