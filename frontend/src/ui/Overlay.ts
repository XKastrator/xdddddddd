/**
 * Overlay — accessible modal base for the help screen and buy panel.
 * DOM (not canvas) so it inherits screen-reader support, text selection,
 * font scaling and RTL for free. Traps focus and closes on Escape.
 */
export class Overlay {
  readonly root: HTMLDivElement;
  readonly body: HTMLDivElement;
  private lastFocus: Element | null = null;
  private onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') this.close(); };

  constructor(titleText: string, closeLabel: string) {
    this.root = document.createElement('div');
    this.root.className = 'overlay';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.hidden = true;

    const card = document.createElement('div');
    card.className = 'overlay-card';

    const head = document.createElement('div');
    head.className = 'overlay-head';
    const title = document.createElement('h2');
    title.textContent = titleText;
    const close = document.createElement('button');
    close.className = 'overlay-close';
    close.setAttribute('aria-label', closeLabel);
    close.textContent = '✕';
    close.addEventListener('click', () => this.close());
    head.append(title, close);

    this.body = document.createElement('div');
    this.body.className = 'overlay-body';

    card.append(head, this.body);
    this.root.append(card);
    this.root.addEventListener('click', (e) => { if (e.target === this.root) this.close(); });
    document.body.appendChild(this.root);
  }

  setTitle(text: string): void {
    const h = this.root.querySelector('h2');
    if (h) h.textContent = text;
  }

  open(): void {
    this.lastFocus = document.activeElement;
    this.root.hidden = false;
    document.addEventListener('keydown', this.onEsc);
    this.root.querySelector<HTMLElement>('button, [tabindex]')?.focus();
  }

  close(): void {
    this.root.hidden = true;
    document.removeEventListener('keydown', this.onEsc);
    (this.lastFocus as HTMLElement | null)?.focus?.();
  }

  get isOpen(): boolean { return !this.root.hidden; }
}
