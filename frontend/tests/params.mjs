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

console.log(fail.length ? `\n${fail.length} FAILED` : '\nAll launch-parameter checks passed');
process.exit(fail.length ? 1 : 0);
