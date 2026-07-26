/**
 * Deployment acceptance test.
 *
 * Stake Engine serves the game from `https://{team}.cdn.stake-engine.com/
 * {gameID}/{version}/` — a sub-path, sometimes requested without the trailing
 * slash. That single detail once shipped a black screen with no error at all:
 * relative URLs resolved against the PARENT folder, the module bundle 404'd, and
 * nothing ever ran to report it.
 *
 * So this serves `dist/` exactly the way the CDN does and asserts the game
 * boots in every form the URL can take, plus one degraded case where all the
 * artwork 404s — the game must still be playable on its procedural fallback.
 *
 *   node tests/deploy.mjs            (expects `npm run build` first)
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const BASE = '/myteam/molten_crown/1.0.0';

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ogg': 'audio/ogg',
};
/** Extensions treated as "artwork" by the all-art-404 scenario. */
const ART = new Set(['.png', '.jpg', '.webp']);

let blockArt = false;

const srv = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (!url.startsWith(BASE)) { res.writeHead(404).end('not found'); return; }
  let rel = url.slice(BASE.length);
  if (rel === '' || rel === '/') rel = '/index.html';
  const ext = path.extname(rel);
  if (blockArt && ART.has(ext)) { res.writeHead(404).end('blocked'); return; }
  const file = path.join(DIST, rel);
  // NOTE: no SPA fallback. A missing file must 404 exactly as the CDN would,
  // otherwise a broken asset path silently returns index.html and the test
  // passes on a bug.
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[ext] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => srv.listen(0, r));
const port = srv.address().port;

const fail = [];
const check = (name, cond, extra = '') => {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) fail.push(name);
};

const PRE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(fs.existsSync(PRE) ? { executablePath: PRE } : {});

/** Boot the game at `suffix` and report what actually rendered. */
async function boot(label, suffix, { art = true } = {}) {
  blockArt = !art;
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const url = `http://127.0.0.1:${port}${BASE}${suffix}`;
  await page.goto(url, { waitUntil: 'networkidle' });

  let booted = false;
  try {
    await page.waitForFunction(() => !document.querySelector('.loading'),
      null, { timeout: 25000 });
    booted = true;
  } catch { /* reported below */ }

  const state = await page.evaluate(() => ({
    canvas: !!document.querySelector('#stage canvas'),
    ui: typeof window.__ui?.spin === 'function',
    bootError: !!document.querySelector('[role="alert"]'),
    balance: window.__ui?.balance?.() ?? '',
  }));

  check(`[${label}] boots`, booted && state.canvas && state.ui,
    `canvas=${state.canvas} ui=${state.ui} bootError=${state.bootError}`);
  check(`[${label}] no page errors`, errors.length === 0, errors.slice(0, 2).join(' | '));

  // a bootable page is not the same as a playable one: place a real bet
  if (state.ui) {
    const before = state.balance;
    await page.evaluate(() => window.__ui.spin());
    await page.waitForFunction(() => window.__ui.idle(), null, { timeout: 60000 })
      .catch(() => {});
    const after = await page.evaluate(() => window.__ui.balance());
    check(`[${label}] a round completes`, after !== before && after !== '',
      `${before} -> ${after}`);
  }
  await page.close();
}

console.log(`serving dist/ at ${BASE} (as the CDN does)\n`);
await boot('no trailing slash', '');
await boot('trailing slash', '/');
await boot('explicit index.html', '/index.html');
await boot('all artwork 404s', '/', { art: false });

await browser.close();
srv.close();
console.log(fail.length ? `\n${fail.length} FAILED` : '\nAll deployment checks passed');
process.exit(fail.length ? 1 : 0);
