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
  // loading screen must disappear once boot completes
  await page.waitForFunction(() => !document.querySelector('.loading'), null, { timeout: 15000 });
  check(`[${label}] loading screen removed`, true);

  // the in-canvas control bar exposes intents on window for automation
  const size = await page.$eval('#stage canvas', (c) => ({ w: c.width, h: c.height }));
  check(`[${label}] canvas has size`, size.w > 0 && size.h > 0, `${size.w}x${size.h}`);
  check(`[${label}] balance initialised`,
    (await page.evaluate(() => window.__ui.balance())) === '$1000.00', await page.evaluate(() => window.__ui.balance()));
  await page.screenshot({ path: path.join(SHOTS, `${label}-idle.png`) });

  // --- help / paytable screen: must expose RTP and max win (Stake Engine rule)
  await page.evaluate(() => window.__ui.help());
  await page.waitForSelector('.overlay:not([hidden])', { timeout: 5000 });
  const helpText = await page.textContent('.overlay-body');
  check(`[${label}] help shows RTP`, helpText.includes('96.50%'));
  check(`[${label}] help shows max win`, helpText.includes('15,000×'));
  check(`[${label}] help lists the rank ladder`,
    helpText.includes('Mythril') && helpText.includes('Molten Crown'));
  await page.screenshot({ path: path.join(SHOTS, `${label}-help.png`) });
  await page.keyboard.press('Escape');               // Escape closes the overlay
  await page.waitForFunction(() => !document.querySelector('.overlay:not([hidden])'),
    null, { timeout: 5000 });
  check(`[${label}] help closes on Escape`, true);

  for (const mode of ['base', 'bonus', 'super']) {
    await page.evaluate((m) => window.__ui.setMode(m), mode);
    const balBefore = await page.evaluate(() => window.__ui.balance());
    await page.evaluate(() => window.__ui.spin());

    // buy modes must ask for confirmation BEFORE the bet is placed
    if (mode === 'bonus' || mode === 'super') {
      await page.waitForSelector('#buy-ok', { timeout: 5000 });
      const buyText = await page.textContent('.overlay-body');
      check(`[${label}] ${mode}: buy panel shows cost/RTP/max win`,
        buyText.includes('96.50%') && buyText.includes('15,000×'));
      check(`[${label}] ${mode}: bet not taken before confirming`,
        (await page.evaluate(() => window.__ui.balance())) === balBefore);
      if (mode === 'super') await page.screenshot({ path: path.join(SHOTS, `${label}-buy.png`) });
      await page.click('#buy-ok');
    }

    await page.waitForTimeout(150);
    await page.evaluate(() => window.__ui.skip());                       // fast-forward the presentation
    await page.waitForFunction(() => window.__ui.idle(),
      null, { timeout: 25000 });
    const balAfter = await page.evaluate(() => window.__ui.balance());
    check(`[${label}] ${mode}: round completed & balance moved`, balBefore !== balAfter,
      `${balBefore} -> ${balAfter}`);
    if (mode === 'super') await page.screenshot({ path: path.join(SHOTS, `${label}-super.png`) });
  }

  // cancelling a buy must not place a bet
  await page.evaluate(() => window.__ui.setMode('super'));
  const balBeforeCancel = await page.evaluate(() => window.__ui.balance());
  await page.evaluate(() => window.__ui.spin());
  await page.waitForSelector('#buy-cancel', { timeout: 5000 });
  await page.click('#buy-cancel');
  await page.waitForTimeout(200);
  check(`[${label}] cancelled buy places no bet`,
    (await page.evaluate(() => window.__ui.balance())) === balBeforeCancel);

  check(`[${label}] no page errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

// --- localisation: the RGS `lang` URL param must drive every player-facing string
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`http://127.0.0.1:${port}/?lang=pl&device=mobile`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !document.querySelector('.loading'), null, { timeout: 15000 });
  check('[i18n] spin button localised (pl)', (await page.evaluate(() => window.__ui.labels().spin)) === 'ZAKRĘĆ',
    await page.evaluate(() => window.__ui.labels().spin));
  check('[i18n] html lang attribute set', (await page.getAttribute('html', 'lang')) === 'pl');
  await page.evaluate(() => window.__ui.help());
  await page.waitForSelector('.overlay:not([hidden])', { timeout: 5000 });
  const pl = await page.textContent('.overlay-body');
  check('[i18n] help localised (pl)', pl.includes('Drabina rang') && pl.includes('Odpowiedzialna gra'));
  check('[i18n] RTP/max win still shown', pl.includes('96.50%') && pl.includes('15,000×'));
  await page.screenshot({ path: path.join(SHOTS, 'help-pl.png') });
  await page.close();
}

await browser.close();
srv.close();
console.log(fail.length ? `\n${fail.length} CHECK(S) FAILED` : '\nAll smoke checks passed');
process.exit(fail.length ? 1 : 0);
