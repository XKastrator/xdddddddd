/**
 * AutoplayPanel — sets the limits BEFORE an autoplay sequence starts.
 *
 * Everything a certifier looks for is set here and nowhere else: the number of
 * rounds, a loss limit, a single-win limit, and stop-on-feature. Nothing on this
 * panel can be changed once the sequence is running — the only control available
 * mid-sequence is STOP, which lives on the spin button itself.
 *
 * Limits are expressed as multiples of the ROUND COST (not the base bet), so
 * they mean the same thing in the base game and in a 500× buy, and they are
 * converted to integer units here so the session never compares floats.
 */
import { Overlay } from './Overlay';
import { t } from '../i18n/strings';
import { formatMoney } from '../rgs/currency';
import type { AutoplayLimits } from '../game/Autoplay';

const SPIN_CHOICES = [10, 25, 50, 100];
const LOSS_CHOICES: (number | null)[] = [null, 10, 25, 50, 100];
const WIN_CHOICES: (number | null)[] = [null, 25, 50, 100, 500];

export class AutoplayPanel extends Overlay {
  private resolver: ((v: AutoplayLimits | null) => void) | null = null;

  constructor() {
    super(t('auto.title'), t('ui.close'));
  }

  /** Resolves with the chosen limits, or null if the player backed out. */
  configure(costUnits: number, currency: string): Promise<AutoplayLimits | null> {
    this.setTitle(t('auto.title'));
    const money = (mult: number): string => formatMoney(costUnits * mult, currency);

    const opts = (choices: (number | null)[], noneLabel: string): string =>
      choices.map((c) => `<option value="${c ?? ''}">${
        c === null ? noneLabel : `${c}× · ${money(c)}`}</option>`).join('');

    this.body.innerHTML = `
      <p class="dim">${t('auto.intro')}</p>
      <label class="field">
        <span>${t('auto.rounds')}</span>
        <select id="ap-spins">${
          SPIN_CHOICES.map((n) => `<option value="${n}">${n}</option>`).join('')}</select>
      </label>
      <label class="field">
        <span>${t('auto.loss')}</span>
        <select id="ap-loss">${opts(LOSS_CHOICES, t('auto.nolimit'))}</select>
      </label>
      <label class="field">
        <span>${t('auto.singlewin')}</span>
        <select id="ap-win">${opts(WIN_CHOICES, t('auto.nolimit'))}</select>
      </label>
      <label class="tg" style="margin-top:12px">
        <input type="checkbox" id="ap-bonus" checked>
        <span>${t('auto.stopbonus')}</span>
      </label>
      <p class="dim" style="margin-top:14px">${t('auto.note')}</p>
      <div class="row-actions">
        <button id="ap-cancel">${t('ui.cancel')}</button>
        <button id="ap-start" class="primary">${t('auto.start')}</button>
      </div>
    `;

    const num = (id: string): number | null => {
      const v = this.body.querySelector<HTMLSelectElement>(id)?.value ?? '';
      return v === '' ? null : Number(v);
    };

    this.body.querySelector('#ap-cancel')?.addEventListener('click', () => this.finish(null));
    this.body.querySelector('#ap-start')?.addEventListener('click', () => {
      const lossMult = num('#ap-loss');
      const winMult = num('#ap-win');
      this.finish({
        spins: num('#ap-spins') ?? SPIN_CHOICES[0],
        stopOnBonus: this.body.querySelector<HTMLInputElement>('#ap-bonus')?.checked ?? true,
        lossLimitUnits: lossMult === null ? null : Math.round(costUnits * lossMult),
        singleWinUnits: winMult === null ? null : Math.round(costUnits * winMult),
      });
    });

    this.open();
    this.body.querySelector<HTMLElement>('#ap-start')?.focus();
    return new Promise((r) => { this.resolver = r; });
  }

  private finish(v: AutoplayLimits | null): void {
    const r = this.resolver;
    this.resolver = null;
    this.close();
    r?.(v);
  }

  /** Escape / backdrop dismiss counts as backing out. */
  override close(): void {
    super.close();
    const r = this.resolver;
    this.resolver = null;
    r?.(null);
  }
}
