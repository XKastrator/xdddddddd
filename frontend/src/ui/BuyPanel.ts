/**
 * BuyPanel — the feature-buy chooser.
 *
 * This used to confirm ONE mode, whichever the bar happened to have selected,
 * which meant the superbonus could not be bought at all: nothing in the new
 * control bar could ever select it. A buy panel offering a single option is not
 * a purchase decision — it is a yes/no on something already decided for you.
 *
 * So both features are on screen at once, as cards: art, name, price, and ONE
 * line saying what you get. The paragraph that used to sit here explained the
 * mechanic in full; the right place for that is the paytable, one tap away,
 * where a player goes when they want to read. At the moment of spending a
 * hundred times the bet they want the price and the gist.
 *
 * Everything a purchase must disclose before it commits (GDD §20) is still
 * here: cost as a bet multiple AND in currency, RTP, max win, and the
 * randomness notice. The decision is made before the bet starts, so it never
 * alters a round already in flight.
 */
import { Overlay } from './Overlay';
import { t } from '../i18n/strings';
import { RTP, MAX_WIN, modeInfo } from '../game/gameInfo';
import { formatMoney } from '../rgs/currency';
import type { BetModeName } from '../types/events';

/** The buyable features, in ascending price. */
const BUYS: BetModeName[] = ['bonus', 'super'];

/**
 * Card art, drawn as inline SVG.
 *
 * Inline because a feature card needs a picture and the alternative is another
 * pair of binary assets to load, cache-bust and keep in sync with the palette.
 * Two shapes each; they read at card size and cost nothing to ship.
 */
function art(mode: BetModeName): string {
  if (mode === 'super') {
    return `<svg viewBox="0 0 64 48" aria-hidden="true">
      <defs><linearGradient id="mcS" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffd98a"/><stop offset="1" stop-color="#e0621f"/>
      </linearGradient></defs>
      <ellipse cx="32" cy="41" rx="22" ry="5" fill="#e0621f" opacity=".35"/>
      <path d="M12 32 L18 15 L26 25 L32 11 L38 25 L46 15 L52 32 Z" fill="url(#mcS)"/>
      <rect x="12" y="32" width="40" height="6" rx="2" fill="#ffca6a"/>
      <circle cx="32" cy="8" r="3" fill="#fff0c8"/>
    </svg>`;
  }
  return `<svg viewBox="0 0 64 48" aria-hidden="true">
    <defs><linearGradient id="mcB" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffc46a"/><stop offset="1" stop-color="#c9451a"/>
    </linearGradient></defs>
    <ellipse cx="32" cy="42" rx="20" ry="5" fill="#c9451a" opacity=".35"/>
    <rect x="14" y="34" width="36" height="5" rx="2" fill="#4a4f58"/>
    <path d="M18 34 c0-9 6-13 14-13 s14 4 14 13 z" fill="#6b7280"/>
    <path d="M26 21 l6-13 6 13 z" fill="url(#mcB)"/>
    <circle cx="32" cy="27" r="4" fill="#ffca6a"/>
  </svg>`;
}

export class BuyPanel extends Overlay {
  private resolver: ((mode: BetModeName | null) => void) | null = null;
  private picked: BetModeName = 'bonus';

  constructor() {
    super(t('buy.pick'), t('ui.close'));
  }

  /**
   * Resolves with the mode the player bought, or null if they backed out.
   *
   * `preselect` is the card that starts highlighted, so opening the panel from
   * a mode already chosen lands on that card.
   */
  confirm(preselect: BetModeName, betUnits: number, currency: string):
  Promise<BetModeName | null> {
    this.picked = BUYS.includes(preselect) ? preselect : 'bonus';
    this.setTitle(t('buy.pick'));

    const card = (m: BetModeName): string => {
      const info = modeInfo(m);
      const cost = Math.round(betUnits * info.cost);
      return `<button class="buy-card${m === this.picked ? ' on' : ''}" data-mode="${m}"
                aria-pressed="${m === this.picked}">
        <span class="buy-art">${art(m)}</span>
        <span class="buy-name">${t(info.titleKey)}</span>
        <span class="buy-line">${t(`buy.short.${m}` as 'buy.short.bonus')}</span>
        <span class="buy-cost">${info.cost.toFixed(0)}× · ${formatMoney(cost, currency)}</span>
      </button>`;
    };

    this.body.innerHTML = `
      <div class="buy-cards">${BUYS.map(card).join('')}</div>
      <div class="kpis">
        <div><span class="dim">${t('buy.cost')}</span><b id="buy-cost">—</b></div>
        <div><span class="dim">${t('buy.rtp')}</span><b>${(RTP * 100).toFixed(2)}%</b></div>
        <div><span class="dim">${t('buy.maxwin')}</span><b>${MAX_WIN.toLocaleString()}×</b></div>
      </div>
      <p class="dim">${t('buy.random')}</p>
      <div class="row-actions">
        <button id="buy-cancel">${t('ui.cancel')}</button>
        <button id="buy-ok" class="primary">${t('ui.confirm')}</button>
      </div>
    `;

    const syncCost = () => {
      const info = modeInfo(this.picked);
      const cost = Math.round(betUnits * info.cost);
      const el = this.body.querySelector('#buy-cost');
      if (el) el.textContent = `${info.cost.toFixed(2)}× · ${formatMoney(cost, currency)}`;
    };
    syncCost();

    for (const el of Array.from(this.body.querySelectorAll<HTMLElement>('.buy-card'))) {
      el.addEventListener('click', () => {
        this.picked = (el.dataset.mode as BetModeName) ?? 'bonus';
        for (const other of Array.from(this.body.querySelectorAll('.buy-card'))) {
          const on = other === el;
          other.classList.toggle('on', on);
          other.setAttribute('aria-pressed', String(on));
        }
        syncCost();
      });
    }
    this.body.querySelector('#buy-cancel')?.addEventListener('click', () => this.finish(null));
    this.body.querySelector('#buy-ok')?.addEventListener('click', () => this.finish(this.picked));
    this.open();
    this.body.querySelector<HTMLElement>('#buy-ok')?.focus();
    return new Promise((r) => { this.resolver = r; });
  }

  private finish(mode: BetModeName | null): void {
    const r = this.resolver;
    this.resolver = null;
    this.close();
    r?.(mode);
  }

  /** Closing via Escape / backdrop counts as a cancel. */
  override close(): void {
    super.close();
    const r = this.resolver;
    this.resolver = null;
    r?.(null);
  }
}
