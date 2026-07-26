/**
 * Real pointer input against the in-canvas control bar.
 *
 * Every other browser test drives the game through `window.__ui`, which calls
 * the same callbacks the buttons call. That verifies the round logic and
 * verifies nothing at all about whether a human can actually press the button:
 * the controls are drawn INSIDE the canvas, so they depend entirely on PixiJS
 * hit-testing, and no test ever exercised it. A live upload where the
 * background parallaxes under the mouse but SPIN does nothing is exactly the
 * shape of failure that gap allows.
 *
 * So this clicks at real screen coordinates and asserts the game responds.
 *
 *   node tests/click.mjs             (expects `npm run build` first)
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ogg': 'audio/ogg',
};

const srv = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(DIST, url === '/' ? 'index.html' : url);
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

for (const [label, vp] of [['desktop', { width: 1366, height: 820 }],
                            ['mobile', { width: 390, height: 844 }]]) {
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ui, null, { timeout: 25000 });
  await page.waitForTimeout(600);

  // The panel reports where it drew its controls, in CSS pixels relative to the
  // canvas. Asking the game itself avoids a test that hardcodes a layout and
  // silently stops testing the button the day the layout moves.
  const hit = await page.evaluate(() => window.__ui.hitPoints?.() ?? null);
  check(`[${label}] the panel exposes its control positions`, !!hit,
    hit ? Object.keys(hit).join(',') : 'missing');
  if (!hit) { await page.close(); continue; }

  const box = await page.$eval('#stage canvas', (c) => {
    const r = c.getBoundingClientRect();
    return { x: r.x, y: r.y };
  });
  const clickAt = async (p) => {
    await page.mouse.move(box.x + p.x, box.y + p.y);
    await page.mouse.down();
    await page.mouse.up();
  };

  // --- SPIN: a real click must place a real bet ---
  const before = await page.evaluate(() => window.__ui.balance());
  await clickAt(hit.spin);
  await page.waitForFunction(
    (b) => window.__ui.balance() !== b, before, { timeout: 30000 },
  ).catch(() => {});
  const after = await page.evaluate(() => window.__ui.balance());
  check(`[${label}] clicking SPIN places a bet`, after !== before, `${before} -> ${after}`);
  await page.waitForFunction(() => window.__ui.idle(), null, { timeout: 60000 }).catch(() => {});

  // --- HELP: a real click must open the overlay ---
  await clickAt(hit.help);
  await page.waitForTimeout(500);
  check(`[${label}] clicking HELP opens the paytable`,
    await page.evaluate(() => !!document.querySelector('.overlay:not([hidden])')));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // --- bet stepper: a real click must change the displayed bet ---
  const betBefore = await page.evaluate(() => window.__ui.betText?.() ?? '');
  await clickAt(hit.betUp);
  await page.waitForTimeout(300);
  const betAfter = await page.evaluate(() => window.__ui.betText?.() ?? '');
  check(`[${label}] clicking + raises the bet`, betAfter !== betBefore,
    `${betBefore} -> ${betAfter}`);

  // --- TURBO: a real click must toggle it ---
  await clickAt(hit.turbo);
  await page.waitForTimeout(300);
  check(`[${label}] clicking TURBO toggles it`,
    await page.evaluate(() => window.__ui.turboOn?.() === true));

  check(`[${label}] no page errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

await browser.close();
srv.close();
console.log(fail.length ? `\n${fail.length} FAILED` : '\nAll pointer-input checks passed');
process.exit(fail.length ? 1 : 0);
