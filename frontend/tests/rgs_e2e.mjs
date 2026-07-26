/**
 * End-to-end test of the RELEASE build against a stand-in RGS.
 *
 * Every other test in this suite exercises the demo build, which serves books
 * from a bundled fixture. That proves the presentation layer works; it proves
 * nothing about the bytes that actually get uploaded, because the release build
 * has the mock stripped out and can only talk over HTTP.
 *
 * So this stands up a server implementing the Stake Engine wallet contract —
 * /wallet/authenticate, /wallet/play, /wallet/end-round — serves dist-release
 * from a CDN-style sub-path, and drives real rounds through it. Books are drawn
 * from the PUBLISHED library (books_base.jsonl.zst), so the client is replaying
 * exactly what the RGS would send in production.
 *
 * Money is integer with 6 decimal places, as the RGS docs specify.
 *
 *   node tests/rgs_e2e.mjs           (expects `npm run build:release` first)
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const DIST = path.join(ROOT, 'dist-release');
const BASE = '/myteam/molten_crown/1.0.0';
const U = 1_000_000;                 // one currency unit, 6 dp

const fail = [];
const check = (name, cond, extra = '') => {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) fail.push(name);
};

if (!fs.existsSync(DIST)) {
  console.error(`missing ${DIST} — run \`npm run build:release\` first`);
  process.exit(1);
}

// --- book library, straight out of the published files ----------------------
const books = JSON.parse(execFileSync('python3', ['-c', `
import io, json, sys, zstandard as zstd
out = []
with open(${JSON.stringify(path.join(REPO, 'math/publish_files/books_base.jsonl.zst'))}, 'rb') as fh:
    r = zstd.ZstdDecompressor().stream_reader(fh)
    for i, line in enumerate(io.TextIOWrapper(r, encoding='utf-8')):
        if i >= 400: break
        out.append(json.loads(line))
json.dump(out, sys.stdout)
`], { maxBuffer: 256 * 1024 * 1024 }));
console.log(`loaded ${books.length} real books from the published library\n`);

// --- stand-in RGS -----------------------------------------------------------
const state = { balance: 1000 * U, active: null, calls: [], lastBody: null };
const MODE_COST = { base: 1, ante: 1.25, bonus: 100, super: 500 };

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ogg': 'audio/ogg',
};

function json(res, code, body) {
  const s = JSON.stringify(body);
  res.writeHead(code, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'content-length': Buffer.byteLength(s),
  });
  res.end(s);
}

const srv = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'POST, OPTIONS',
    }).end();
    return;
  }

  // ---- wallet endpoints ----
  if (url.startsWith('/rgs/')) {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {};
      state.calls.push(url);
      state.lastBody = body;

      if (!body.sessionID) return json(res, 400, { error: 'ERR_VAL' });

      if (url === '/rgs/wallet/authenticate') {
        return json(res, 200, {
          balance: { amount: state.balance, currency: 'USD' },
          config: {
            minBet: 0.1 * U, maxBet: 100 * U, stepBet: 0.1 * U,
            defaultBetLevel: 1 * U,
            betLevels: [0.2, 0.5, 1, 2, 5, 10].map((v) => v * U),
            jurisdiction: {
              socialCasino: false, disabledFullscreen: false, disabledTurbo: false,
            },
          },
          round: state.active ? { active: true, book: state.active.book } : { active: false },
        });
      }

      if (url === '/rgs/wallet/play') {
        const cost = Math.round(body.amount * (MODE_COST[body.mode] ?? 1));
        if (cost > state.balance) return json(res, 402, { error: 'ERR_IPB' });
        const book = books[Math.floor(Math.random() * books.length)];
        state.balance -= cost;
        state.active = { book, bet: body.amount };
        return json(res, 200, {
          balance: { amount: state.balance, currency: 'USD' },
          round: { book, mode: body.mode },
        });
      }

      if (url === '/rgs/wallet/end-round') {
        if (state.active) {
          // payoutMultiplier is an integer x100 of the BASE bet
          const win = Math.round(state.active.bet * state.active.book.payoutMultiplier / 100);
          state.balance += win;
          state.active = null;
        }
        return json(res, 200, { balance: { amount: state.balance, currency: 'USD' } });
      }

      if (url === '/rgs/wallet/balance') {
        return json(res, 200, { balance: { amount: state.balance, currency: 'USD' } });
      }
      if (url === '/rgs/bet/event') return json(res, 200, { event: body.event });
      return json(res, 404, { error: 'ERR_GEN' });
    });
    return;
  }

  // ---- the game itself, from a CDN-style sub-path ----
  if (!url.startsWith(BASE)) { res.writeHead(404).end(); return; }
  let rel = url.slice(BASE.length);
  if (rel === '' || rel === '/') rel = '/index.html';
  const file = path.join(DIST, rel);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {
    'content-type': TYPES[path.extname(rel)] ?? 'application/octet-stream',
  });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => srv.listen(0, r));
const port = srv.address().port;
const origin = `http://127.0.0.1:${port}`;

const PRE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(fs.existsSync(PRE) ? { executablePath: PRE } : {});

// --- 1. release build refuses to run without launch params -------------------
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${origin}${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const alert = await page.evaluate(() =>
    document.querySelector('[role="alert"]')?.textContent ?? '');
  check('release build refuses to run with no rgs_url',
    alert.includes('rgs_url'), alert.slice(0, 70).replace(/\s+/g, ' '));
  await page.close();
}

// --- 2. a real round over HTTP ----------------------------------------------
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
state.calls.length = 0;

const launch = `${origin}${BASE}/?sessionID=test-session-42&lang=en&device=desktop`
  + `&rgs_url=${encodeURIComponent(`${origin}/rgs`)}`;
await page.goto(launch, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !document.querySelector('.loading'),
  null, { timeout: 25000 });

check('boots against a live RGS', await page.evaluate(() => !!window.__ui));
check('authenticate was called', state.calls.includes('/rgs/wallet/authenticate'));
check('sessionID is forwarded from the URL', state.lastBody?.sessionID === 'test-session-42',
  String(state.lastBody?.sessionID));

const shown = await page.evaluate(() => window.__ui.balance());
check('balance comes from the RGS', shown.includes('1,000') || shown.includes('1000'), shown);

const serverBefore = state.balance;
await page.evaluate(() => window.__ui.spin());
await page.waitForFunction(() => window.__ui.idle(), null, { timeout: 60000 });

check('play was called', state.calls.includes('/rgs/wallet/play'));
check('end-round was called', state.calls.includes('/rgs/wallet/end-round'));
check('the server debited the bet', state.balance !== serverBefore,
  `${serverBefore / U} -> ${state.balance / U}`);

const shownAfter = await page.evaluate(() => window.__ui.balance());
const expected = (state.balance / U).toFixed(2);
check('the client shows the server balance, not its own arithmetic',
  shownAfter.replace(/[^0-9.]/g, '') === expected, `${shownAfter} vs ${expected}`);

// --- 3. insufficient balance is surfaced, not swallowed ----------------------
state.balance = 0;
await page.evaluate(() => window.__ui.spin());
await page.waitForTimeout(2500);
const status = await page.evaluate(() => document.getElementById('err')?.textContent ?? '');
// not merely "an error appeared": the player must be told it is the BALANCE
check('ERR_IPB is reported as insufficient balance',
  /balance|saldo|guthaben/i.test(status), status);

check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
srv.close();
console.log(fail.length ? `\n${fail.length} FAILED` : '\nAll RGS end-to-end checks passed');
process.exit(fail.length ? 1 : 0);
