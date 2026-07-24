/**
 * BuyPanel — pre-purchase confirmation for the buy bet modes.
 *
 * Shows everything the player must see BEFORE committing (GDD §20): mode name
 * and description, cost as a bet multiple and in currency, RTP, max win, and the
 * randomness/independence notice. The purchase decision is made before the bet
 * starts, so it never alters the payout of a round in progress.
 */
import { Overlay } from './Overlay';
import { t } from '../i18n/strings';
import { RTP, MAX_WIN, modeInfo } from '../game/gameInfo';
import { formatMoney } from '../rgs/currency';
import type { BetModeName } from '../types/events';

export class BuyPanel extends Overlay {
  private resolver: ((ok: boolean) => void) | null = null;

  constructor() {
    super(t('buy.title'), t('ui.close'));
  }

  /** Resolves true when the player confirms, false on cancel/close. */
  confirm(mode: BetModeName, betUnits: number, currency: string): Promise<boolean> {
    const info = modeInfo(mode);
    const costUnits = Math.round(betUnits * info.cost);
    this.setTitle(t('buy.title'));
    this.body.innerHTML = `
      <h3>${t(info.titleKey)}</h3>
      <p>${t(info.descKey)}</p>
      <div class="kpis">
        <div><span class="dim">${t('buy.cost')}</span><b>${info.cost.toFixed(2)}× · ${formatMoney(costUnits, currency)}</b></div>
        <div><span class="dim">${t('buy.rtp')}</span><b>${(RTP * 100).toFixed(2)}%</b></div>
        <div><span class="dim">${t('buy.maxwin')}</span><b>${MAX_WIN.toLocaleString()}×</b></div>
      </div>
      <p class="dim">${t('buy.random')}</p>
      <div class="row-actions">
        <button id="buy-cancel">${t('ui.cancel')}</button>
        <button id="buy-ok" class="primary">${t('ui.confirm')}</button>
      </div>
    `;
    this.body.querySelector('#buy-cancel')?.addEventListener('click', () => this.finish(false));
    this.body.querySelector('#buy-ok')?.addEventListener('click', () => this.finish(true));
    this.open();
    this.body.querySelector<HTMLElement>('#buy-ok')?.focus();
    return new Promise((r) => { this.resolver = r; });
  }

  private finish(ok: boolean): void {
    const r = this.resolver;
    this.resolver = null;
    this.close();
    r?.(ok);
  }

  /** Closing via Escape / backdrop counts as a cancel. */
  override close(): void {
    super.close();
    const r = this.resolver;
    this.resolver = null;
    r?.(false);
  }
}
