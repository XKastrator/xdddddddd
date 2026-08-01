/**
 * Load a provider's public demo and record it, so the motion grammar can be
 * STUDIED rather than remembered. Screencast via CDP, not page.screenshot —
 * a synchronous capture stalls the compositor and you end up recording your
 * own interference.
 *
 *   node tests/_ref.mjs <url> <outdir> [seconds]
 */
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';

const URL = process.argv[2];
const OUT = process.argv[3];
const SECS = Number(process.argv[4] ?? 25);
const PRE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(fs.existsSync(PRE) ? { executablePath: PRE } : {});
const ctx = await browser.newContext({
  viewport: { width: 1366, height: 820 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    + ' (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  locale: 'en-GB',
});
const page = await ctx.newPage();
const notes = [];
page.on('console', (m) => { if (m.type() === 'error') notes.push('ERR ' + m.text().slice(0, 160)); });
try {
  const resp = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  console.log('status', resp?.status(), '->', page.url());
} catch (e) {
  console.log('goto failed:', String(e).split('\n')[0]);
}
await page.waitForTimeout(4000);
console.log('title:', await page.title());
console.log('iframes:', page.frames().length);
for (const f of page.frames()) console.log('  frame:', f.url().slice(0, 140));
const canvases = await page.evaluate(() => Array.from(document.querySelectorAll('canvas'))
  .map((c) => `${c.width}x${c.height}`));
console.log('canvases:', JSON.stringify(canvases));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
await page.screenshot({ path: path.join(OUT, 'page.png') });

const cdp = await ctx.newCDPSession(page);
let n = 0;
cdp.on('Page.screencastFrame', async (f) => {
  fs.writeFileSync(path.join(OUT, `r${String(n++).padStart(4, '0')}.jpg`),
    Buffer.from(f.data, 'base64'));
  await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 76, everyNthFrame: 1 });
const end = Date.now() + SECS * 1000;
while (Date.now() < end) await page.waitForTimeout(500);
await cdp.send('Page.stopScreencast').catch(() => {});
console.log('frames', n, notes.length ? '| ' + notes.slice(0, 3).join(' | ') : '');
await browser.close();
