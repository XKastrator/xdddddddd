/**
 * Demo app entry — boots PixiJS, wires the DEV MockRgs to BookPlayer +
 * PixiPresenter, and hooks the DOM controls (spin, mode, turbo, skip).
 *
 * Production differs in exactly one place: swap MockRgs for RgsClient (see
 * src/main.ts). Everything below the RGS boundary is production code.
 */
import { Application } from 'pixi.js';
import { BookPlayer } from './game/BookPlayer';
import { PixiPresenter } from './render/PixiPresenter';
import { MockRgs } from './dev/MockRgs';
import type { BetModeName } from './types/events';

const COST: Record<BetModeName, number> = { base: 1, ante: 1.25, bonus: 100, super: 500 };

function fmtUsd(units: number): string { return '$' + (units / 1_000_000).toFixed(2); }

async function main(): Promise<void> {
  const host = document.getElementById('stage') as HTMLDivElement;
  const app = new Application();
  await app.init({
    background: 0x0a0806, antialias: true, resizeTo: host,
    resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true,
  });
  host.appendChild(app.canvas);

  const presenter = new PixiPresenter(app);
  const rgs = new MockRgs();
  const auth = await rgs.authenticate();

  // jurisdiction gating (same rule as production main.ts)
  const turboBtn = document.getElementById('turbo') as HTMLButtonElement;
  if (auth.config.jurisdiction.disabledTurbo) turboBtn.style.display = 'none';

  let bet = auth.config.defaultBetLevel;
  let mode: BetModeName = 'base';
  let turbo = false;
  let busy = false;
  let player: BookPlayer | null = null;

  const $ = (id: string) => document.getElementById(id) as HTMLElement;
  const setBal = (u: number) => { $('balance').textContent = fmtUsd(u); };
  const setCost = () => { $('cost').textContent = fmtUsd(Math.round(bet * COST[mode])); };
  setBal(auth.balance.amount); setCost();
  presenter.setMode(mode);

  window.addEventListener('resize', () => {
    presenter.resize(app.renderer.width, app.renderer.height);
  });

  async function spin(): Promise<void> {
    if (busy) return;
    busy = true;
    ($('spin') as HTMLButtonElement).disabled = true;
    try {
      const res = await rgs.play(bet, mode);
      setBal(res.balance.amount);
      presenter.skip = false;
      presenter.reduced = ($('reduced') as HTMLInputElement).checked
        || matchMedia('(prefers-reduced-motion: reduce)').matches;
      player = new BookPlayer(res.round.book, presenter);
      await player.play();
      const end = await rgs.endRound(bet);
      setBal(end.balance.amount);
    } catch (e) {
      $('err').textContent = e instanceof Error && e.message === 'ERR_IPB'
        ? 'Insufficient balance for this bet mode.' : 'Round failed. Try again.';
      setTimeout(() => { $('err').textContent = ''; }, 3000);
    } finally {
      busy = false;
      ($('spin') as HTMLButtonElement).disabled = false;
      player = null;
    }
  }

  $('spin').addEventListener('click', () => void spin());
  $('skip').addEventListener('click', () => { presenter.skip = true; player?.skip(); });
  turboBtn.addEventListener('click', () => {
    turbo = !turbo;
    turboBtn.dataset.on = String(turbo);
    // turbo shortens presentation only — outcomes are unchanged
    presenter.reduced = turbo || ($('reduced') as HTMLInputElement).checked;
  });
  ($('mode') as HTMLSelectElement).addEventListener('change', (e) => {
    mode = (e.target as HTMLSelectElement).value as BetModeName;
    presenter.setMode(mode); setCost();
  });
  ($('bet') as HTMLSelectElement).addEventListener('change', (e) => {
    bet = Number((e.target as HTMLSelectElement).value); setCost();
  });
  // keyboard: space = spin, s = skip
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); void spin(); }
    if (e.key.toLowerCase() === 's') { presenter.skip = true; player?.skip(); }
  });
}

void main();
