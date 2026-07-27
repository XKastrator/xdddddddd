/**
 * Deterministic unit tests for the frame-rate guard.
 *
 * The guard is the one piece of the renderer whose job is to react to a device
 * being too slow — and "wait for a slow machine" is not a test. The clock and
 * the ticker are both injected here, so every rule (when a window closes, how
 * far a step goes, that a downgrade never reverses) is exercised against
 * frame times the test dictates.
 *
 *   node tests/perfguard.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(HERE, '..', 'package.json'));
const ts = require('typescript');

// PerfGuard imports Application as a TYPE only, so the transpiled module has no
// runtime dependency on pixi and can be loaded directly.
const src = fs.readFileSync(path.join(HERE, '..', 'src', 'render', 'PerfGuard.ts'), 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mc-')), 'PerfGuard.mjs');
fs.writeFileSync(tmp, js);
const { PerfGuard, MAX_TIER } = await import(pathToFileURL(tmp).href);

const fail = [];
function check(name, cond, extra = '') {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) fail.push(name);
}

/** Minimal stand-ins: a ticker we pump by hand and a renderer we can inspect. */
function rig(baseResolution = 2) {
  let clock = 1000;
  const fns = [];
  const app = {
    renderer: { resolution: baseResolution },
    ticker: {
      add: (fn, ctx) => fns.push(fn.bind(ctx)),
      remove: () => { fns.length = 0; },
    },
  };
  const target = { lowPower: false };
  const changes = [];
  const guard = new PerfGuard(app, target, (t) => changes.push(t), () => clock);
  return {
    app, target, guard, changes,
    now: () => clock,
    /** Advance the clock by `ms` and deliver one frame. */
    frame(ms) { clock += ms; fns.forEach((f) => f()); },
    frames(n, ms) { for (let i = 0; i < n; i++) this.frame(ms); },
    /** Empty the current measurement window, the way a tab switch does. */
    clear() { this.frame(2500); },
    /**
     * Advance past the settle window using HEALTHY frames, then empty the
     * buffer. Skipping the clock with a couple of huge frames would instead
     * feed the guard exactly the evidence these tests mean to withhold, and
     * leaving the healthy leftovers in the buffer would drag the median of the
     * window under test.
     */
    settle() { this.frames(60, 16); this.clear(); },
  };
}

// --- a healthy device is never touched -------------------------------------
{
  const r = rig();
  r.guard.start();
  r.settle();
  r.frames(200, 16);                 // ~60 fps for over three seconds
  check('60 fps leaves quality untouched', r.guard.tier === 0);
  check('60 fps leaves lowPower off', r.target.lowPower === false);
  check('60 fps leaves resolution alone', r.app.renderer.resolution === 2);
  check('60 fps reports no change', r.changes.length === 0);
}

// --- boot is not evidence ---------------------------------------------------
{
  const r = rig();
  r.guard.start();
  r.frames(2, 400);                  // 800 ms of stalls, all inside the settle
  check('frames inside the settle window are ignored', r.guard.tier === 0);
  // ...and the proof they were discarded rather than merely too few: the same
  // frame time trips the guard as soon as the settle window is behind us.
  r.frames(4, 400);
  check('the same frames past the settle window do trip it', r.guard.tier > 0,
    `tier ${r.guard.tier}`);
}

// --- a device that is merely short of smooth steps once ---------------------
{
  const r = rig();
  r.guard.start();
  r.settle();
  r.frames(30, 60);                  // 16 fps: over budget, not catastrophic
  check('16 fps steps down one tier at a time', r.guard.tier === 1, `tier ${r.guard.tier}`);
  check('tier 1 turns on lowPower', r.target.lowPower === true);
  check('tier 1 keeps full resolution', r.app.renderer.resolution === 2);
}

// --- a device far past the budget steps twice at once -----------------------
{
  const r = rig();
  r.guard.start();
  r.settle();
  r.frames(8, 500);                  // 2 fps: more than 4x the budget
  check('2 fps jumps two tiers in one window', r.guard.tier === 2, `tier ${r.guard.tier}`);
  check('tier 2 drops to 3/4 resolution', r.app.renderer.resolution === 1.5,
    String(r.app.renderer.resolution));
}

// --- and keeps going until it runs out of levers ----------------------------
{
  const r = rig();
  r.guard.start();
  r.settle();
  r.frames(60, 500);
  check('a hopeless device reaches the floor', r.guard.tier === MAX_TIER, `tier ${r.guard.tier}`);
  check('the floor is half resolution', r.app.renderer.resolution === 1,
    String(r.app.renderer.resolution));
  const seen = r.changes.length;
  r.frames(60, 500);
  check('the floor is a floor', r.guard.tier === MAX_TIER && r.changes.length === seen);
}

// --- a window needs enough frames AND enough time ---------------------------
{
  const r = rig();
  r.guard.start();
  r.settle();
  r.frames(3, 700);                  // 2.1 s of wall time but only 3 frames
  check('a window under MIN_FRAMES does not close', r.guard.tier === 0);
  r.frame(700);
  check('the fourth frame closes it', r.guard.tier > 0, `tier ${r.guard.tier}`);
}

// --- one enormous gap is a backgrounded tab, not a slow device --------------
{
  const r = rig();
  r.guard.start();
  r.settle();
  r.frames(3, 30);
  r.frame(60000);                    // tab hidden for a minute
  r.frames(3, 16);                   // then perfectly healthy again
  check('a backgrounded tab does not trip the guard', r.guard.tier === 0);
}

// --- recovery never happens automatically -----------------------------------
{
  const r = rig();
  r.guard.start();
  r.settle();
  r.frames(30, 60);
  const dropped = r.guard.tier;
  check('dropped a tier first', dropped >= 1);
  r.settle();
  r.frames(400, 8);                  // 125 fps for over three seconds
  check('quality never climbs back on its own', r.guard.tier === dropped,
    `tier ${r.guard.tier}`);
  check('lowPower stays on', r.target.lowPower === true);
}

// --- force() is one-way too --------------------------------------------------
{
  const r = rig();
  r.guard.force(2);
  check('force jumps straight to a tier', r.guard.tier === 2);
  check('force applies the resolution', r.app.renderer.resolution === 1.5);
  r.guard.force(1);
  check('force cannot raise quality', r.guard.tier === 2);
  r.guard.force(99);
  check('force is clamped to the floor', r.guard.tier === MAX_TIER);
}

// --- resolution never falls below the minimum Pixi can draw ------------------
{
  const r = rig(0.75);               // a host that already asked for less
  r.guard.force(MAX_TIER);
  check('resolution has a hard floor of 0.5', r.app.renderer.resolution === 0.5,
    String(r.app.renderer.resolution));
}

console.log(fail.length ? `\n${fail.length} FAILED` : '\nAll perf-guard checks passed');
process.exit(fail.length ? 1 : 0);
