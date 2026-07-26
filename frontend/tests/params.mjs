/**
 * Unit tests for the launch-parameter parsing, specifically `rgs_url`.
 *
 * This is the code path that took the game down on its first live upload:
 * `rgs_url` arrives without a scheme, so using it raw made every wallet call a
 * RELATIVE fetch. The POST landed on the static host serving the game and came
 * back 405 Method Not Allowed, which reads like a broken RGS rather than a
 * broken URL. Cheap, deterministic coverage is worth more here than anywhere
 * else in the client.
 *
 *   node tests/params.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(HERE, '..', 'package.json'));
const ts = require('typescript');

const src = fs.readFileSync(path.join(HERE, '..', 'src', 'rgs', 'params.ts'), 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mc-')), 'params.mjs');
fs.writeFileSync(tmp, js);
const { normalizeRgsUrl } = await import(pathToFileURL(tmp).href);

const fail = [];
const eq = (name, got, want) => {
  const ok = got === want;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name} — ${JSON.stringify(got)}`
    + (ok ? '' : ` (expected ${JSON.stringify(want)})`));
  if (!ok) fail.push(name);
};

// the case that actually broke production
eq('bare host gets the page scheme',
  normalizeRgsUrl('rgs.stake-engine.com', 'https:'),
  'https://rgs.stake-engine.com');
eq('bare host with a path',
  normalizeRgsUrl('rgs.stake-engine.com/api', 'https:'),
  'https://rgs.stake-engine.com/api');
eq('bare host with a port',
  normalizeRgsUrl('127.0.0.1:8080/rgs', 'http:'),
  'http://127.0.0.1:8080/rgs');

// an explicit scheme is never rewritten
eq('https is left alone',
  normalizeRgsUrl('https://rgs.stake-engine.com', 'http:'),
  'https://rgs.stake-engine.com');
eq('http is left alone',
  normalizeRgsUrl('http://localhost:9000/rgs', 'https:'),
  'http://localhost:9000/rgs');

// protocol-relative
eq('protocol-relative takes the page scheme',
  normalizeRgsUrl('//rgs.stake-engine.com/v2', 'https:'),
  'https://rgs.stake-engine.com/v2');

// endpoint paths are appended as `/wallet/...`, so no trailing slash may survive
eq('single trailing slash is stripped',
  normalizeRgsUrl('https://rgs.stake-engine.com/', 'https:'),
  'https://rgs.stake-engine.com');
eq('repeated trailing slashes are stripped',
  normalizeRgsUrl('https://rgs.stake-engine.com/api///', 'https:'),
  'https://rgs.stake-engine.com/api');

// whitespace survives a copy/paste into an operator config
eq('surrounding whitespace is trimmed',
  normalizeRgsUrl('  https://rgs.stake-engine.com  ', 'https:'),
  'https://rgs.stake-engine.com');

// absent or unusable input must be falsy, so the caller reports it rather than
// building a relative URL out of nothing
eq('empty stays empty', normalizeRgsUrl('', 'https:'), '');
eq('whitespace-only stays empty', normalizeRgsUrl('   ', 'https:'), '');

// every result that is not empty must be absolute — that is the whole contract
for (const raw of ['rgs.example.com', '//rgs.example.com', 'https://rgs.example.com/x/']) {
  const got = normalizeRgsUrl(raw, 'https:');
  const ok = /^https?:\/\//.test(got);
  console.log(`${ok ? '  ok  ' : ' FAIL '} result is absolute for ${JSON.stringify(raw)} — ${got}`);
  if (!ok) fail.push(`absolute:${raw}`);
}

// --- bet levels: money must survive 6-decimal integers -----------------------
// `| 0` truncates to 32 bits, and a $10,000 maxBet is 10_000_000_000 — well past
// 2^31. A wrapped bound clamps the bet to a nonsense value and /wallet/play
// answers ERR_VAL, which is indistinguishable from a dead SPIN button.
const bl = await import(pathToFileURL(await (async () => {
  const src2 = fs.readFileSync(path.join(HERE, '..', 'src', 'rgs', 'betLevels.ts'), 'utf8')
    .replace(/^import[^;]+;$/gm, '');
  const js2 = ts.transpileModule(src2, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const t2 = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mc-')), 'betLevels.mjs');
  fs.writeFileSync(t2, js2);
  return t2;
})()).href);

const BIG = { minBet: 100_000, maxBet: 10_000_000_000, stepBet: 100_000,
  defaultBetLevel: 1_000_000, betLevels: [], jurisdiction: {} };
eq('a huge maxBet is not truncated to 32 bits',
  bl.snapBet(10_000_000_000, BIG), 10_000_000_000);
eq('the default bet survives a huge range',
  bl.defaultBet(BIG, bl.betLevelsFrom(BIG)), 1_000_000);
{
  const levels = bl.betLevelsFrom(BIG);
  const onGrid = levels.every((v) => v % BIG.stepBet === 0);
  const inRange = levels.every((v) => v >= BIG.minBet && v <= BIG.maxBet);
  console.log(`${onGrid && inRange && levels.length > 1 ? '  ok  ' : ' FAIL '} `
    + `derived ladder is on-grid and in range — ${levels.length} levels, `
    + `${levels[0]}..${levels[levels.length - 1]}`);
  if (!(onGrid && inRange && levels.length > 1)) fail.push('derived ladder');
}
eq('a bet is snapped onto the step grid',
  bl.snapBet(1_234_567, BIG), 1_200_000);
eq('a bet below minimum is raised', bl.snapBet(1, BIG), 100_000);
eq('a bet above maximum is capped', bl.snapBet(99_000_000_000, BIG), 10_000_000_000);

console.log(fail.length ? `\n${fail.length} FAILED` : '\nAll launch-parameter checks passed');
process.exit(fail.length ? 1 : 0);
