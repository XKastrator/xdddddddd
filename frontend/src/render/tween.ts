/**
 * Minimal promise-based tween with skip support and reduced-motion awareness.
 * No external deps. Presenters poll `shouldSkip()` so a "skip" fast-forwards the
 * remaining animation to its end state without changing any outcome.
 */
export type Ease = (t: number) => number;

export const easeOutCubic: Ease = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutQuad: Ease = (t) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
export const easeOutBack: Ease = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export interface TweenOpts {
  duration: number;                 // ms
  onUpdate: (t: number) => void;    // t in [0,1] after easing
  ease?: Ease;
  shouldSkip?: () => boolean;       // if true, jump to end immediately
  reducedMotion?: boolean;          // collapse to a minimal duration
}

export function tween(o: TweenOpts): Promise<void> {
  const ease = o.ease ?? easeOutCubic;
  const dur = o.reducedMotion ? Math.min(o.duration, 40) : o.duration;
  // Already skipping: jump to the end state SYNCHRONOUSLY. Waiting even one
  // frame per tween is what turns a skipped bonus round into a multi-second
  // stall, because a long round awaits hundreds of them in sequence.
  if (o.shouldSkip?.()) { o.onUpdate(1); return Promise.resolve(); }
  return new Promise((resolve) => {
    if (dur <= 0) { o.onUpdate(1); resolve(); return; }
    const start = performance.now();
    const frame = (now: number) => {
      if (o.shouldSkip?.()) { o.onUpdate(1); resolve(); return; }
      const p = Math.min(1, (now - start) / dur);
      o.onUpdate(ease(p));
      if (p >= 1) resolve();
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

/** Await a fixed delay that also respects skip / reduced motion. */
export function wait(ms: number, shouldSkip?: () => boolean, reduced?: boolean): Promise<void> {
  return tween({ duration: ms, onUpdate: () => {}, shouldSkip, reducedMotion: reduced });
}
