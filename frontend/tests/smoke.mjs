/**
 * Browser smoke test for the PixiJS renderer.
 * Serves dist/, loads the game, spins each bet mode, asserts the canvas renders
 * and the balance/total actually change, and captures screenshots.
 *
 *   node tests/smoke.mjs            (expects `npm run build` first)
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SHOTS = path.join(ROOT, 'tests', 'shots');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png' };

function serve(dir) {
  const srv = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    let file = path.join(dir, url === '/' ? 'index.html' : decodeURIComponent(url));
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dir, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((r) => srv.listen(0, () => r({ srv, port: srv.address().port })));
}

const fail = [];
function check(name, cond, extra = '') {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) fail.push(name);
}

const { srv, port } = await serve(DIST);
fs.mkdirSync(SHOTS, { recursive: true });

// Use the environment's pre-installed Chromium when the bundled revision is absent.
const PREINSTALLED = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const launchOpts = fs.existsSync(PREINSTALLED) ? { executablePath: PREINSTALLED } : {};
const browser = await chromium.launch(launchOpts);

for (const [label, vp] of [['mobile', { width: 390, height: 844 }],
                            ['desktop', { width: 1280, height: 800 }]]) {
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#stage canvas', { timeout: 10000 });

  const size = await page.$eval('#stage canvas', (c) => ({ w: c.width, h: c.height }));
  check(`[${label}] canvas has size`, size.w > 0 && size.h > 0, `${size.w}x${size.h}`);
  check(`[${label}] balance initialised`,
    (await page.textContent('#balance')) === '$1000.00', await page.textContent('#balance'));
  await page.screenshot({ path: path.join(SHOTS, `${label}-idle.png`) });

  for (const mode of ['base', 'bonus', 'super']) {
    await page.selectOption('#mode', mode);
    const balBefore = await page.textContent('#balance');
    await page.click('#spin');
    await page.waitForTimeout(150);
    await page.click('#skip');                       // fast-forward the presentation
    await page.waitForFunction(() => !document.querySelector('#spin').disabled,
      null, { timeout: 25000 });
    const balAfter = await page.textContent('#balance');
    check(`[${label}] ${mode}: round completed & balance moved`, balBefore !== balAfter,
      `${balBefore} -> ${balAfter}`);
    if (mode === 'super') await page.screenshot({ path: path.join(SHOTS, `${label}-super.png`) });
  }

  check(`[${label}] no page errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

await browser.close();
srv.close();
console.log(fail.length ? `\n${fail.length} CHECK(S) FAILED` : '\nAll smoke checks passed');
process.exit(fail.length ? 1 : 0);
