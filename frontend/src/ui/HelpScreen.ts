/**
 * HelpScreen — rules, paytable, bet modes, RTP, max win and the responsible
 * gaming note. Stake Engine requires RTP and max win to be visible to the
 * player, so both are rendered here from gameInfo.ts.
 */
import { Overlay } from './Overlay';
import { t } from '../i18n/strings';
import { LADDER, MODES, RTP, MAX_WIN, FUSE_THRESHOLD, JUMP_STEP } from '../game/gameInfo';
import { Sym } from '../types/events';

/** Atlas frame name per symbol — the help screen shows the real artwork. */
const FRAME: Partial<Record<Sym, string>> = {
  [Sym.O1]: 'O1', [Sym.BRONZE]: 'BRONZE', [Sym.IRON]: 'IRON', [Sym.SILVER]: 'SILVER',
  [Sym.GOLD]: 'GOLD', [Sym.MYTHRIL]: 'MYTHRIL', [Sym.CROWN]: 'CROWN',
  [Sym.FLUX]: 'FLUX', [Sym.CINDER]: 'CINDER',
};
const ATLAS_CELL = 256, ATLAS_COLS = 4;
const ORDER = ['O1', 'O2', 'O3', 'O4', 'O5', 'BRONZE', 'IRON', 'SILVER',
  'GOLD', 'MYTHRIL', 'CROWN', 'FLUX', 'CINDER'];

/** Crop the shared atlas with background-position — one request, no extra art. */
function swatch(sym: Sym): string {
  const name = FRAME[sym];
  const i = name ? ORDER.indexOf(name) : -1;
  if (i < 0) return '<span class="swatch"></span>';
  const x = (i % ATLAS_COLS) * ATLAS_CELL, y = Math.floor(i / ATLAS_COLS) * ATLAS_CELL;
  const scale = 34 / ATLAS_CELL;
  return `<span class="swatch" style="background-image:url(assets/atlas.png);
    background-size:${ATLAS_COLS * ATLAS_CELL * scale}px auto;
    background-position:-${x * scale}px -${y * scale}px"></span>`;
}

export class HelpScreen extends Overlay {
  constructor() {
    super(t('help.title'), t('ui.close'));
    this.render();
  }

  /** Rebuild content (also used after a language change). */
  render(): void {
    this.setTitle(t('help.title'));
    const ladderRows = LADDER.map((l) => `
      <tr>
        <td>${swatch(l.sym)}</td>
        <td>${t(l.key)}</td>
        <td class="num">${l.value === 0 ? '—' : l.value.toFixed(2) + '×'}</td>
      </tr>`).join('');

    const modeRows = MODES.map((m) => `
      <tr>
        <td><b>${t(m.titleKey)}</b><div class="dim">${t(m.descKey)}</div></td>
        <td class="num">${m.cost.toFixed(2)}×</td>
        <td class="num">${(RTP * 100).toFixed(2)}%</td>
      </tr>`).join('');

    this.body.innerHTML = `
      <div class="kpis">
        <div><span class="dim">${t('buy.rtp')}</span><b>${(RTP * 100).toFixed(2)}%</b></div>
        <div><span class="dim">${t('buy.maxwin')}</span><b>${MAX_WIN.toLocaleString()}×</b></div>
      </div>

      <p>${t('help.core', { n: FUSE_THRESHOLD, j: JUMP_STEP })}</p>
      <p>${t('help.pay')}</p>
      <p>${t('help.heat')}</p>

      <h3>${t('help.ladder')}</h3>
      <div class="scroll">
        <table>
          <thead><tr><th></th><th>${t('help.symbol')}</th><th class="num">${t('help.value')}</th></tr></thead>
          <tbody>${ladderRows}</tbody>
        </table>
      </div>

      <h3>${t('help.special')}</h3>
      <ul>
        <li>${swatch(Sym.FLUX)} <b>${t('sym.flux')}</b> — ${t('help.flux')}</li>
        <li>${swatch(Sym.CINDER)} <b>${t('sym.cinder')}</b> — ${t('help.cinder')}</li>
      </ul>

      <h3>${t('help.bonus')}</h3>
      <p>${t('help.bonus.desc')}</p>
      <h3>${t('help.super')}</h3>
      <p>${t('help.super.desc')}</p>

      <h3>${t('help.modes')}</h3>
      <div class="scroll">
        <table>
          <thead><tr><th>${t('help.mode')}</th><th class="num">${t('help.cost')}</th><th class="num">${t('buy.rtp')}</th></tr></thead>
          <tbody>${modeRows}</tbody>
        </table>
      </div>

      <h3>${t('help.rg')}</h3>
      <p class="dim">${t('help.rg.desc')}</p>
    `;
  }
}
