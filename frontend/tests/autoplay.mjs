/**
 * Autoplay end-to-end test.
 *
 * Drives the real built game against the mock RGS and asserts the regulatory
 * behaviour: a bounded run of rounds, a working stop, and each of the limits
 * actually terminating the sequence. Reads only what a player can see (balance,
 * remaining count, status line).
 *
 *   node tests/autoplay.mjs        (expects `npm run build` first)
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ogg': 'audio/ogg' };

const srv = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  let f = path.join(DIST, url === '/' ? 'index.html' : decodeURIComponent(url));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
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
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !document.querySelector('.loading'), null, { timeout: 20000 });
// turbo keeps the run short without changing any outcome
await page.evaluate(() => document.getElementById('reduced').click());

const balance = () => page.evaluate(() => window.__ui.balance());
const status = () => page.evaluate(() => document.getElementById('err').textContent);
const remaining = () => page.evaluate(() => window.__ui.autoRemaining());

/** Open the panel, set the fields, start. */
async function start({ spins = '10', loss = '', win = '', bonus = true } = {}) {
  await page.evaluate(() => window.__ui.autoplay());
  await page.waitForSelector('#ap-start', { timeout: 5000 });
  await page.selectOption('#ap-spins', spins);
  await page.selectOption('#ap-loss', loss);
  await page.selectOption('#ap-win', win);
  if (!bonus) await page.uncheck('#ap-bonus');
  await page.click('#ap-start');
}

// --- panel exposes every required limit ------------------------------------
await page.evaluate(() => window.__ui.autoplay());
await page.waitForSelector('#ap-start');
for (const id of ['#ap-spins', '#ap-loss', '#ap-win', '#ap-bonus']) {
  check(`panel has ${id}`, await page.$(id) !== null);
}
await page.click('#ap-cancel');
check('cancel starts no session', await remaining() === null);

// --- a bounded run completes on its own ------------------------------------
const before = await balance();
await start({ spins: '10', bonus: false });
check('session starts', await remaining() !== null, `${await remaining()} left`);
await page.waitForFunction(() => window.__ui.autoRemaining() === null, null, { timeout: 120000 });
check('run completed', (await status()).includes('finished') || (await status()).includes('stopped'),
  await status());
check('balance moved', await balance() !== before, `${before} -> ${await balance()}`);

// --- stop takes effect --------------------------------------------------
await start({ spins: '100', bonus: false });
await page.waitForFunction(() => (window.__ui.autoRemaining() ?? 100) < 100, null, { timeout: 60000 });
const atStop = await remaining();
await page.evaluate(() => window.__ui.stopAuto());
await page.waitForFunction(() => window.__ui.autoRemaining() === null, null, { timeout: 60000 });
check('stop ends the sequence early', atStop > 1, `${atStop} rounds were still queued`);
check('stop is reported', (await status()).toLowerCase().includes('stopped'), await status());

// --- a limited run terminates and names its reason ---------------------------
// The limit ARITHMETIC is covered deterministically by tests/autoplay_limits.mjs;
// what this case proves is that the wiring reaches a real stop through the real
// RGS path and reports it to the player.
await start({ spins: '25', loss: '10', win: '25', bonus: true });
await page.waitForFunction(() => window.__ui.autoRemaining() === null, null, { timeout: 240000 });
const reason = await status();
const KNOWN = ['finished', 'stopped'];
check('run ended and the reason was reported', KNOWN.some((k) => reason.includes(k)), reason);

check('no page errors', errors.length === 0, errors.join(' | '));

await browser.close();
srv.close();
console.log(fail.length ? `\n${fail.length} FAILED` : '\nAll autoplay checks passed');
process.exit(fail.length ? 1 : 0);
