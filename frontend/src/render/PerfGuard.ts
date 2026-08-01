/**
 * PerfGuard — keep the game playable on a device that cannot draw it.
 *
 * The renderer is fill-rate bound, not CPU bound: a CPU profile of an idle
 * frame put 99.9% of the time outside JavaScript, in rasterisation, and frame
 * cost tracked canvas AREA almost exactly (3.1x the pixels cost 3.05x the
 * time). That is the signature of a GPU — or a software rasteriser — running
 * out of fill, and no amount of JS tuning touches it.
 *
 * So the guard trades pixels for frames, in the order that costs the least:
 *
 *   1  drop the post-processing and ambient motion (`lowPower`)
 *   2  render at 3/4 resolution
 *   3  render at 1/2 resolution
 *
 * Layout is unaffected: `renderer.width/height` are logical screen units, and
 * `autoDensity` keeps the canvas the same CSS size, so lowering resolution
 * changes how many device pixels are rasterised and nothing else.
 *
 * Downgrades are ONE-WAY. A guard that also upgrades oscillates: it steps down,
 * frames recover *because* it stepped down, it steps back up, and the player
 * watches the game breathe. Quality is restored on the next page load, which is
 * the only moment a change in quality is not jarring.
 *
 * Timing is measured here rather than read from `Ticker.deltaMS`, which Pixi
 * clamps to `maxElapsedMS` (100 ms by default) — exactly the range that matters
 * would be invisible.
 */
import type { Application } from 'pixi.js';

/**
 * Median frame time above which the guard steps down, in ms (25 fps).
 *
 * Deliberately below "not quite 60": a downgrade lasts the whole session, so
 * the bar has to be clearly-not-smooth rather than merely imperfect. A phone
 * dipping to 40 fps during a big win should keep its effects.
 */
const SLOW_MS = 40;
/** Frames per measurement window. Long enough that one hitch cannot trip it. */
const WINDOW = 45;
/**
 * ...but a window is also closed on time. A device drawing at 1 fps would need
 * 45 SECONDS to fill a frame-counted window — the guard would still be making
 * up its mind long after the player gave up. The worse the device, the sooner
 * the decision has to come, which is the opposite of what counting frames does.
 */
const WINDOW_MS = 1500;
const MIN_FRAMES = 4;
/** Ignore this long after boot / after a change, while the new state settles. */
const SETTLE_MS = 900;

export interface QualityTarget {
  lowPower: boolean;
}

/** Lowest quality the guard will go to. */
export const MAX_TIER = 3;

export class PerfGuard {
  /** 0 = full quality. Exposed for diagnostics and tests. */
  tier = 0;
  /** Set by `pin`: the guard stops adjusting and holds whatever tier it has. */
  private pinned = false;
  private times: number[] = [];
  private last = 0;
  private opened = 0;
  private quietUntil = 0;
  private readonly baseResolution: number;

  /**
   * `now` is injectable so the escalation logic can be tested against a clock
   * the test drives, rather than by asking a machine to please be slow.
   */
  constructor(private app: Application, private target: QualityTarget,
              private onChange?: (tier: number) => void,
              private now: () => number = () => performance.now()) {
    this.baseResolution = app.renderer.resolution;
  }

  /**
   * Begin measuring. Called once the game is actually interactive — decoding
   * the atlas, compiling shaders and uploading textures all stall frames, and
   * a guard that watched those would conclude the device is slow before it has
   * drawn a single playable frame.
   */
  start(): void {
    this.quietUntil = this.now() + SETTLE_MS;
    this.last = this.now();
    this.app.ticker.add(this.sample, this);
  }

  /** Stop measuring — used by tests and on teardown. */
  stop(): void { this.app.ticker.remove(this.sample, this); }

  private sample(): void {
    const now = this.now();
    const dt = now - this.last;
    this.last = now;
    if (now < this.quietUntil) { this.times.length = 0; this.opened = now; return; }
    // A backgrounded tab produces one enormous gap; that is not a slow device.
    if (dt > 2000) { this.times.length = 0; this.opened = now; return; }
    if (!this.times.length) this.opened = now - dt;
    this.times.push(dt);
    const closed = this.times.length >= WINDOW
      || (this.times.length >= MIN_FRAMES && now - this.opened >= WINDOW_MS);
    if (!closed) return;

    const sorted = [...this.times].sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    this.times.length = 0;
    if (this.pinned || median <= SLOW_MS || this.tier >= MAX_TIER) return;
    // How far past the budget the device is decides how far to step. Walking
    // down one rung at a time is right for a device that is merely short of
    // 60 fps; a device at 1 fps needs every lever pulled at once, and making it
    // spend another window per rung is just more time spent unplayable.
    this.applyTo(Math.min(MAX_TIER, this.tier + (median > SLOW_MS * 4 ? 2 : 1)));
  }

  /** Jump straight to a tier. Used by the guard itself, by QA and by tests. */
  force(tier: number): void {
    this.applyTo(Math.max(this.tier, Math.min(MAX_TIER, Math.round(tier))));
  }

  /**
   * Hold a tier and stop measuring — QA and capture only.
   *
   * `force` is deliberately one-way UP, because a guard that can be talked back
   * down is not a guard. But that also means there is no way to LOOK at the
   * game at full quality on a machine that cannot render it in real time: a
   * capture harness stalls frames, the guard reads the stall as a weak device
   * and drops to half resolution with motion off, and every recording made that
   * way shows a degraded game. Pinning exists so a recording measures the game
   * rather than the harness.
   *
   * It changes how the game LOOKS and never what it pays.
   */
  pin(tier: number): number {
    this.pinned = true;
    const want = Math.max(0, Math.min(MAX_TIER, Math.round(tier)));
    // applyTo only climbs, so a downward pin is written out here
    this.tier = want;
    this.target.lowPower = want >= 1;
    const scale = want >= 3 ? 0.5 : want >= 2 ? 0.75 : 1;
    const next = Math.max(0.5, this.baseResolution * scale);
    if (next !== this.app.renderer.resolution) this.app.renderer.resolution = next;
    this.times.length = 0;
    this.onChange?.(want);
    return this.tier;
  }

  private applyTo(tier: number): void {
    if (tier <= this.tier) return;
    this.tier = tier;
    this.target.lowPower = tier >= 1;
    const scale = tier >= 3 ? 0.5 : tier >= 2 ? 0.75 : 1;
    const next = Math.max(0.5, this.baseResolution * scale);
    if (next !== this.app.renderer.resolution) this.app.renderer.resolution = next;
    this.quietUntil = this.now() + SETTLE_MS;
    this.onChange?.(tier);
  }
}
