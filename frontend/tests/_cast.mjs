import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const DIST = '/home/user/xdddddddd/frontend/dist';
const OUT = process.argv[3] ?? '/tmp/claude-0/-home-user-xdddddddd/c9b428d6-c0c8-538c-804e-9967516994aa/scratchpad/cast';
const MODE = process.argv[2] ?? 'base';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ogg': 'audio/ogg',
  '.webp': 'image/webp' };
const srv = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  let f = path.join(DIST, url === '/' ? 'index.html' : decodeURIComponent(url));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => srv.listen(0, r));
const port = srv.address().port;
const PRE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(fs.existsSync(PRE) ? { executablePath: PRE } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !document.querySelector('.loading'), null, { timeout: 20000 });
await page.waitForTimeout(500);
await page.evaluate(() => window.__ui.pinQuality(0));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const cdp = await page.context().newCDPSession(page);
let n = 0;
cdp.on('Page.screencastFrame', async (f) => {
  fs.writeFileSync(path.join(OUT, `c${String(n++).padStart(4, '0')}.jpg`),
    Buffer.from(f.data, 'base64'));
  await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 78, everyNthFrame: 1 });

if (MODE !== 'base') await page.evaluate((m) => window.__ui.setMode(m), MODE);
await page.evaluate(() => window.__ui.spin());
if (MODE !== 'base') {
  await page.waitForSelector('#buy-ok', { timeout: 8000 });
  await page.click('#buy-ok');
}
const deadline = Date.now() + 45000;
while (Date.now() < deadline) {
  await page.waitForTimeout(200);
  if (await page.evaluate(() => window.__ui.idle())) break;
}
await page.waitForTimeout(600);
await cdp.send('Page.stopScreencast').catch(() => {});
console.log('frames', n, 'quality', JSON.stringify(await page.evaluate(() => window.__ui.diagnostics().quality)),
  'balance', await page.evaluate(() => window.__ui.balance()));
console.log(errs.length ? 'ERRORS:\n' + errs.slice(0, 6).join('\n') : 'no console errors');
await browser.close(); srv.close();
