/**
 * LoadingScreen — covers the stage while assets and the first RGS handshake
 * complete, then fades out. Progress is driven by the caller so it reflects real
 * work (preload + authenticate), never a fake timer.
 */
import { t } from '../i18n/strings';

export class LoadingScreen {
  private root: HTMLDivElement;
  private bar: HTMLDivElement;

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'loading';
    this.root.innerHTML = `
      <div class="loading-inner">
        <div class="loading-title">MOLTEN CROWN</div>
        <div class="loading-track"><div class="loading-bar"></div></div>
        <div class="loading-text">${t('ui.loading')}</div>
      </div>`;
    document.body.appendChild(this.root);
    this.bar = this.root.querySelector('.loading-bar') as HTMLDivElement;
  }

  /** progress in [0,1] */
  set(progress: number): void {
    this.bar.style.width = `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`;
  }

  async done(): Promise<void> {
    this.set(1);
    this.root.classList.add('is-hidden');
    await new Promise((r) => setTimeout(r, 320));
    this.root.remove();
  }
}
