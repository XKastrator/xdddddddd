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
const state = {
  balance: 1000 * U, active: null, calls: [], lastBody: null,
  // knobs the scenarios below flip to model legal RGS variations
  omitBetLevels: false,
  pendingRound: null,          // an unfinished round reported by authenticate
  rejectWhileActive: true,     // a real RGS refuses a bet while a round is open
  requireUpperMode: false,     // model an RGS that publishes modes upper-cased
  rejectAnyMode: false,        // model a game published with one default mode
  modesSeen: [],               // every mode string the client actually sent
  // The docs elide the round payload as `"round": { ... }`, so the nesting is
  // undocumented. These are the shapes a server plausibly sends.
  roundShape: 'book',          // 'book' | 'state' | 'flat' | 'nested'
};
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
            // betLevels is optional per the spec; omitting it must still work
            ...(state.omitBetLevels
              ? {}
              : { betLevels: [0.2, 0.5, 1, 2, 5, 10].map((v) => v * U) }),
            jurisdiction: {
              socialCasino: false, disabledFullscreen: false, disabledTurbo: false,
            },
          },
          round: state.pendingRound
            ? { active: true, book: state.pendingRound }
            : state.active ? { active: true, book: state.active.book }
              : { active: false },
        });
      }

      if (url === '/rgs/wallet/play') {
        // a round already open blocks new bets — this is what silently bricks a
        // client that never resumes
        if (state.rejectWhileActive && (state.active || state.pendingRound)) {
          return json(res, 409, { error: 'ERR_VAL' });
        }
        state.modesSeen.push(body.mode === undefined ? '<none>' : String(body.mode));
        if (state.rejectAnyMode && body.mode !== undefined) {
          // an unknown mode value is a validation refusal — no debit
          return json(res, 400, { error: 'ERR_VAL', message: 'unknown bet mode' });
        }
        if (state.requireUpperMode && body.mode !== String(body.mode).toUpperCase()) {
          // validation rejection: nothing is debited, exactly as a real RGS
          return json(res, 400, { error: 'ERR_VAL' });
        }
        const key = String(body.mode ?? 'base').toLowerCase();
        const cost = Math.round(body.amount * (MODE_COST[key] ?? 1));
        if (cost > state.balance) return json(res, 402, { error: 'ERR_IPB' });
        const book = books[Math.floor(Math.random() * books.length)];
        state.balance -= cost;
        state.active = { book, bet: body.amount };
        const shaped = {
          book: { book, mode: body.mode },
          state: { state: book, mode: body.mode },
          flat: { ...book, mode: body.mode },
          nested: { bet: { round: { book } }, mode: body.mode },
        }[state.roundShape];
        return json(res, 200, {
          balance: { amount: state.balance, currency: 'USD' },
          round: shaped,
        });
      }

      if (url === '/rgs/wallet/end-round') {
        state.pendingRound = null;
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

// --- 3. rgs_url WITHOUT a scheme (the live 405) ------------------------------
// This is the exact shape that took the first upload down: the parameter
// arrives as a bare host, fetch treats it as relative, the POST lands on the
// static host serving the game and comes back 405 Method Not Allowed.
{
  const p3 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p3.on('pageerror', (e) => errs.push(String(e)));
  state.calls.length = 0;
  state.balance = 1000 * U;
  const bare = `127.0.0.1:${port}/rgs`;               // no scheme, as delivered
  await p3.goto(`${origin}${BASE}/?sessionID=bare-host&lang=en`
    + `&rgs_url=${encodeURIComponent(bare)}`, { waitUntil: 'networkidle' });
  // Wait for a TERMINAL state — booted or failed — rather than for the loading
  // screen to vanish. Swallowing a timeout here made the assertions race the
  // page under load and report an empty alert with no ui, which looks like a
  // regression and is really just an early read.
  await p3.waitForFunction(
    () => !!window.__ui || !!document.querySelector('[role="alert"]'),
    null, { timeout: 60000 }).catch(() => {});

  const alert = await p3.evaluate(() =>
    document.querySelector('[role="alert"]')?.textContent ?? '');
  check('schemeless rgs_url still reaches the RGS',
    state.calls.includes('/rgs/wallet/authenticate'),
    alert.slice(0, 90).replace(/\s+/g, ' '));
  check('schemeless rgs_url boots the game',
    await p3.evaluate(() => !!window.__ui), `alert="${alert.slice(0, 60)}"`);
  check('no 405 against the page origin',
    !errs.some((e) => e.includes('405')), errs.slice(0, 1).join(''));
  await p3.close();
}

// --- 3b. a REAL CLICK on the in-canvas SPIN, against the live RGS ------------
// The pointer-input test runs on the demo build. This is the combination that
// actually ships: release bundle, real HTTP, real mouse.
{
  const p4 = await browser.newPage({ viewport: { width: 1366, height: 820 } });
  const errs = [];
  p4.on('pageerror', (e) => errs.push(String(e)));
  state.calls.length = 0;
  state.balance = 1000 * U;
  await p4.goto(`${origin}${BASE}/?sessionID=click-test&lang=en`
    + `&rgs_url=${encodeURIComponent(`${origin}/rgs`)}`, { waitUntil: 'networkidle' });
  await p4.waitForFunction(
    () => !!window.__ui || !!document.querySelector('[role="alert"]'),
    null, { timeout: 60000 }).catch(() => {});

  const hit = await p4.evaluate(() => window.__ui?.hitPoints?.() ?? null);
  check('release build draws the in-canvas control bar', !!hit,
    hit ? 'panel present' : 'NO PANEL — the display font failed to load');

  if (hit) {
    const box = await p4.$eval('#stage canvas', (c) => {
      const r = c.getBoundingClientRect();
      return { x: r.x, y: r.y };
    });
    const before = await p4.evaluate(() => window.__ui.balance());
    await p4.mouse.move(box.x + hit.spin.x, box.y + hit.spin.y);
    await p4.mouse.down();
    await p4.mouse.up();
    await p4.waitForFunction((b) => window.__ui.balance() !== b, before,
      { timeout: 30000 }).catch(() => {});
    const after = await p4.evaluate(() => window.__ui.balance());
    check('a real click on SPIN places a real bet', after !== before,
      `${before} -> ${after}; calls=${state.calls.join(',') || 'NONE'}`);
  }
  check('no page errors on the release build', errs.length === 0,
    errs.slice(0, 2).join(' | '));
  await p4.close();
}

// --- 3c. an interrupted round is resumed, not left blocking forever ----------
// The spec requires the frontend to continue an active round. While one is
// open the RGS refuses new bets, so a client that ignores it makes SPIN dead
// for that player permanently — across reloads, with no way out from the game.
{
  const p5 = await browser.newPage({ viewport: { width: 1366, height: 820 } });
  const errs = [];
  p5.on('pageerror', (e) => errs.push(String(e)));
  state.calls.length = 0;
  state.balance = 1000 * U;
  state.active = null;
  state.pendingRound = books[0];                 // a round left open
  await p5.goto(`${origin}${BASE}/?sessionID=resume-test&lang=en`
    + `&rgs_url=${encodeURIComponent(`${origin}/rgs`)}`, { waitUntil: 'networkidle' });
  await p5.waitForFunction(
    () => !!window.__ui || !!document.querySelector('[role="alert"]'),
    null, { timeout: 60000 }).catch(() => {});

  await p5.waitForFunction(() => window.__ui?.idle?.() === true,
    null, { timeout: 60000 }).catch(() => {});
  check('the open round is ended on boot',
    state.calls.includes('/rgs/wallet/end-round') && state.pendingRound === null,
    `calls=${state.calls.join(',')}`);

  // and the player can now actually bet
  const before = await p5.evaluate(() => window.__ui.balance());
  await p5.evaluate(() => window.__ui.spin());
  await p5.waitForFunction((b) => window.__ui.balance() !== b, before,
    { timeout: 30000 }).catch(() => {});
  const after = await p5.evaluate(() => window.__ui.balance());
  check('a bet is possible after resuming', after !== before, `${before} -> ${after}`);
  check('no page errors while resuming', errs.length === 0, errs.slice(0, 2).join(' | '));
  await p5.close();
  state.pendingRound = null;
}

// --- 3d. betLevels omitted (legal per the spec) ------------------------------
{
  const p6 = await browser.newPage({ viewport: { width: 1366, height: 820 } });
  const errs = [];
  p6.on('pageerror', (e) => errs.push(String(e)));
  state.calls.length = 0;
  state.balance = 1000 * U;
  state.active = null;
  state.omitBetLevels = true;
  await p6.goto(`${origin}${BASE}/?sessionID=no-levels&lang=en`
    + `&rgs_url=${encodeURIComponent(`${origin}/rgs`)}`, { waitUntil: 'networkidle' });
  await p6.waitForFunction(
    () => !!window.__ui || !!document.querySelector('[role="alert"]'),
    null, { timeout: 60000 }).catch(() => {});

  check('boots with no betLevels in the config',
    await p6.evaluate(() => !!window.__ui),
    await p6.evaluate(() => document.querySelector('[role="alert"]')?.textContent?.slice(0, 60) ?? ''));
  const before = await p6.evaluate(() => window.__ui?.balance?.() ?? '');
  await p6.evaluate(() => window.__ui?.spin?.());
  await p6.waitForFunction((b) => window.__ui.balance() !== b, before,
    { timeout: 30000 }).catch(() => {});
  check('a bet is placed with a derived bet ladder',
    (await p6.evaluate(() => window.__ui?.balance?.() ?? '')) !== before,
    `${before} -> ${await p6.evaluate(() => window.__ui?.balance?.() ?? '')}`);
  check('no page errors without betLevels', errs.length === 0, errs.slice(0, 2).join(' | '));
  await p6.close();
  state.omitBetLevels = false;
}

// --- 3e. an RGS that publishes bet modes upper-cased --------------------------
// The math SDK names modes lowercase; the RGS docs' play example sends "BASE".
// A validation rejection means nothing was debited, so one retry in upper case
// is safe — and must not be attempted for any other kind of failure.
{
  const p7 = await browser.newPage({ viewport: { width: 1366, height: 820 } });
  const errs = [];
  p7.on('pageerror', (e) => errs.push(String(e)));
  state.calls.length = 0;
  state.modesSeen.length = 0;
  state.balance = 1000 * U;
  state.active = null;
  state.pendingRound = null;
  state.requireUpperMode = true;
  await p7.goto(`${origin}${BASE}/?sessionID=upper-mode&lang=en`
    + `&rgs_url=${encodeURIComponent(`${origin}/rgs`)}`, { waitUntil: 'networkidle' });
  await p7.waitForFunction(
    () => !!window.__ui || !!document.querySelector('[role="alert"]'),
    null, { timeout: 60000 }).catch(() => {});

  const before = await p7.evaluate(() => window.__ui?.balance?.() ?? '');
  await p7.evaluate(() => window.__ui?.spin?.());
  await p7.waitForFunction((b) => window.__ui.balance() !== b, before,
    { timeout: 30000 }).catch(() => {});
  const after = await p7.evaluate(() => window.__ui?.balance?.() ?? '');
  check('a bet succeeds against an upper-case-only RGS', after !== before,
    `${before} -> ${after}; modes sent = ${state.modesSeen.join(',')}`);
  check('the rejected attempt was retried, not repeated blindly',
    state.modesSeen.length === 2 && state.modesSeen[1] === 'BASE',
    state.modesSeen.join(','));

  // and the working casing is remembered rather than re-probed every round.
  // The first round has to be fully CLOSED first: while it is open the fixture
  // rejects the bet before it ever records a mode, so the assertion would be
  // measuring the active-round guard instead of the casing memory.
  await p7.waitForFunction(() => window.__ui.idle(), null, { timeout: 60000 }).catch(() => {});
  state.modesSeen.length = 0;
  const before2 = await p7.evaluate(() => window.__ui?.balance?.() ?? '');
  await p7.evaluate(() => window.__ui?.spin?.());
  await p7.waitForFunction((b) => window.__ui.balance() !== b, before2,
    { timeout: 30000 }).catch(() => {});
  check('the accepted casing is reused for later bets',
    state.modesSeen.length === 1 && state.modesSeen[0] === 'BASE',
    state.modesSeen.join(','));
  check('no page errors against an upper-case RGS', errs.length === 0,
    errs.slice(0, 2).join(' | '));
  await p7.close();
  state.requireUpperMode = false;
}

// --- 3f. a rejection tells the player WHICH rejection it was -----------------
{
  const p8 = await browser.newPage({ viewport: { width: 1366, height: 820 } });
  state.calls.length = 0;
  state.balance = 1000 * U;
  state.active = null;
  state.pendingRound = null;
  await p8.goto(`${origin}${BASE}/?sessionID=diag&lang=en&debug=1`
    + `&rgs_url=${encodeURIComponent(`${origin}/rgs`)}`, { waitUntil: 'networkidle' });
  await p8.waitForFunction(() => !!window.__ui, null, { timeout: 60000 }).catch(() => {});
  check('the debug panel is available', await p8.evaluate(() => !!document.getElementById('diag')));
  check('diagnostics name the RGS the game is talking to',
    await p8.evaluate(() => (window.__ui.diagnostics().rgs || '').startsWith('http')),
    await p8.evaluate(() => window.__ui.diagnostics().rgs));
  await p8.close();
}

// --- 3g. the book is found wherever the round payload puts it ----------------
// `"round": { ... }` is elided in the docs, and assuming `round.book` produced
// "cannot read properties of undefined (reading 'events')" against the live RGS
// — after the bet had already been debited.
for (const shape of ['book', 'state', 'flat', 'nested']) {
  const p8 = await browser.newPage({ viewport: { width: 1366, height: 820 } });
  const errs = [];
  p8.on('pageerror', (e) => errs.push(String(e)));
  state.calls.length = 0;
  state.balance = 1000 * U;
  state.active = null;
  state.pendingRound = null;
  state.roundShape = shape;
  await p8.goto(`${origin}${BASE}/?sessionID=shape-${shape}&lang=en`
    + `&rgs_url=${encodeURIComponent(`${origin}/rgs`)}`, { waitUntil: 'networkidle' });
  await p8.waitForFunction(
    () => !!window.__ui || !!document.querySelector('[role="alert"]'),
    null, { timeout: 60000 }).catch(() => {});

  const before = await p8.evaluate(() => window.__ui?.balance?.() ?? '');
  await p8.evaluate(() => window.__ui?.spin?.());
  await p8.waitForFunction((b) => window.__ui.balance() !== b, before,
    { timeout: 30000 }).catch(() => {});
  const after = await p8.evaluate(() => window.__ui?.balance?.() ?? '');
  check(`a round plays with the book at round.${shape}`, after !== before,
    `${before} -> ${after}`);
  check(`no undefined dereference with round.${shape}`,
    !errs.some((e) => /undefined/i.test(e)), errs.slice(0, 1).join(''));
  await p8.close();
}
state.roundShape = 'book';

// --- 3h. an RGS that rejects every `mode` value -------------------------------
// A game published with a single default mode answers ERR_VAL to any mode
// string. The probe's last rung is a request with no `mode` field at all; every
// rung is only reached after a validation refusal, so nothing was ever debited.
{
  const p9 = await browser.newPage({ viewport: { width: 1366, height: 820 } });
  const errs = [];
  p9.on('pageerror', (e) => errs.push(String(e)));
  state.calls.length = 0;
  state.modesSeen.length = 0;
  state.balance = 1000 * U;
  state.active = null;
  state.pendingRound = null;
  state.rejectAnyMode = true;
  await p9.goto(`${origin}${BASE}/?sessionID=no-mode&lang=en`
    + `&rgs_url=${encodeURIComponent(`${origin}/rgs`)}`, { waitUntil: 'networkidle' });
  await p9.waitForFunction(
    () => !!window.__ui || !!document.querySelector('[role="alert"]'),
    null, { timeout: 60000 }).catch(() => {});

  const before = await p9.evaluate(() => window.__ui?.balance?.() ?? '');
  await p9.evaluate(() => window.__ui?.spin?.());
  await p9.waitForFunction((b) => window.__ui.balance() !== b, before,
    { timeout: 30000 }).catch(() => {});
  // the probe fires three requests; wait for the last one rather than racing it
  await p9.waitForFunction(() => window.__ui.idle(), null, { timeout: 60000 }).catch(() => {});
  const after = await p9.evaluate(() => window.__ui?.balance?.() ?? '');
  check('a bet succeeds against an RGS that rejects every mode value',
    after !== before && after !== '', `${before} -> ${after}; sent = ${state.modesSeen.join(',')}`);
  check('the probe walked the whole ladder and stopped at no-mode',
    state.modesSeen.length === 3 && state.modesSeen[2] === '<none>',
    state.modesSeen.join(','));

  // the accepted variant is reused rather than re-probed
  state.modesSeen.length = 0;
  const before2 = await p9.evaluate(() => window.__ui?.balance?.() ?? '');
  await p9.evaluate(() => window.__ui?.spin?.());
  await p9.waitForFunction((b) => window.__ui.balance() !== b, before2,
    { timeout: 30000 }).catch(() => {});
  check('later bets skip the probe', state.modesSeen.join(',') === '<none>',
    state.modesSeen.join(','));
  check('no page errors while probing', errs.length === 0, errs.slice(0, 2).join(' | '));
  await p9.close();
  state.rejectAnyMode = false;
}

// --- 4. insufficient balance is surfaced, not swallowed ----------------------
// clear any round the earlier scenarios left open, or /wallet/play answers with
// the active-round rejection instead of the balance one
state.active = null;
state.pendingRound = null;
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
