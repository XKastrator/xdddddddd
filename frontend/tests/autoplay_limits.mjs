/**
 * Deterministic unit tests for the autoplay limit logic.
 *
 * AutoplaySession is pure TypeScript with no imports, so it is transpiled here
 * with the TypeScript compiler API and exercised directly. That keeps the limit
 * arithmetic — which is the part a certifier actually cares about — under a
 * fast, repeatable test instead of relying on a random RGS run to happen to
 * cross a threshold.
 *
 *   node tests/autoplay_limits.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(HERE, '..', 'package.json'));
const ts = require('typescript');

const src = fs.readFileSync(path.join(HERE, '..', 'src', 'game', 'Autoplay.ts'), 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mc-')), 'Autoplay.mjs');
fs.writeFileSync(tmp, js);
const { AutoplaySession } = await import(pathToFileURL(tmp).href);

const fail = [];
const check = (name, cond, extra = '') => {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) fail.push(name);
};

const LIMITS = {
  spins: 10, stopOnBonus: false, lossLimitUnits: null, singleWinUnits: null,
};
const round = (winUnits, bonus = false) => ({ costUnits: 100, winUnits, bonus });

// --- round count ------------------------------------------------------------
{
  const s = new AutoplaySession({ ...LIMITS, spins: 3 });
  check('starts with the requested count', s.remaining === 3);
  s.record(round(0)); s.record(round(0));
  check('still running with rounds left', s.running === true, `${s.remaining} left`);
  s.record(round(0));
  check('completes after the last round', s.running === false && s.stopReason === 'completed');
  check('cannot overrun', s.record(round(0)) === false);
}

// --- zero rounds is not a session ------------------------------------------
{
  const s = new AutoplaySession({ ...LIMITS, spins: 0 });
  check('zero rounds never runs', s.running === false && s.stopReason === 'completed');
}

// --- loss limit -------------------------------------------------------------
{
  const s = new AutoplaySession({ ...LIMITS, spins: 100, lossLimitUnits: 250 });
  s.record(round(0));            // net -100
  s.record(round(0));            // net -200
  check('under the loss limit keeps going', s.running === true, `net ${s.net}`);
  s.record(round(0));            // net -300
  check('loss limit stops the run', s.stopReason === 'loss-limit', `net ${s.net}`);
}
{
  // wins offset losses: the limit is on NET, not on gross spend
  const s = new AutoplaySession({ ...LIMITS, spins: 100, lossLimitUnits: 250 });
  s.record(round(0)); s.record(round(0)); s.record(round(400));
  check('a win pushes the net back above the limit', s.running === true, `net ${s.net}`);
}

// --- single-win limit -------------------------------------------------------
{
  const s = new AutoplaySession({ ...LIMITS, spins: 100, singleWinUnits: 500 });
  s.record(round(499));
  check('a win below the limit does not stop', s.running === true);
  s.record(round(500));
  check('a win at the limit stops', s.stopReason === 'single-win');
}

// --- stop on feature --------------------------------------------------------
{
  const s = new AutoplaySession({ ...LIMITS, spins: 100, stopOnBonus: true });
  s.record(round(50, false));
  check('no feature, no stop', s.running === true);
  s.record(round(50, true));
  check('feature stops the run', s.stopReason === 'bonus');
}
{
  const s = new AutoplaySession({ ...LIMITS, spins: 100, stopOnBonus: false });
  s.record(round(50, true));
  check('feature is ignored when the option is off', s.running === true);
}

// --- player stop ------------------------------------------------------------
{
  const s = new AutoplaySession({ ...LIMITS, spins: 100 });
  s.record(round(0));
  s.cancel();
  check('cancel stops the run', s.running === false && s.stopReason === 'user');
  const netBefore = s.net;
  s.record(round(300));
  check('the round in flight still counts', s.net === netBefore + 200, `net ${s.net}`);
  check('cancel is not overwritten by a later reason', s.stopReason === 'user');
}

// --- precedence -------------------------------------------------------------
{
  // a big win on the round that also enters a feature reports the win, which is
  // the reason a player would expect to be told about first
  const s = new AutoplaySession({
    spins: 100, stopOnBonus: true, lossLimitUnits: 1, singleWinUnits: 500,
  });
  s.record(round(900, true));
  check('single-win outranks bonus and loss limit', s.stopReason === 'single-win');
}

// --- error ------------------------------------------------------------------
{
  const s = new AutoplaySession({ ...LIMITS, spins: 10 });
  s.fail();
  check('a failed round ends the sequence', s.running === false && s.stopReason === 'error');
}

console.log(fail.length ? `\n${fail.length} FAILED` : '\nAll autoplay limit checks passed');
process.exit(fail.length ? 1 : 0);
