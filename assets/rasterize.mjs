/**
 * Rasterise every authored SVG page into the game's binary assets.
 *
 * Uses the environment's headless Chromium (via Playwright) as the SVG renderer,
 * so gradients, blur filters and strokes rasterise exactly as a browser will
 * display them.
 *
 *   symbols   -> atlas.png      (PNG, transparent — composited over the board)
 *   character -> character.png  (PNG, transparent — rig parts)
 *   scenes    -> scene_*.jpg    (JPEG — full-bleed, no alpha needed, far smaller)
 *   lobby     -> lobby.jpg      (JPEG — store/lobby tile)
 *
 *   npm run assets     (from frontend/)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// playwright is a devDependency of frontend/, so resolve it from there
const require = createRequire(path.join(HERE, '..', 'frontend', 'package.json'));
const { chromium } = require('playwright');

const BUILD = path.join(HERE, 'build');
const OUT = path.join(HERE, '..', 'frontend', 'public', 'assets');

/** page: html in build/, out: file in public/assets, meta: optional json to copy */
const JOBS = [
  { page: 'atlas.html', out: 'atlas.png', meta: 'atlas.json', type: 'png' },
  { page: 'character.html', out: 'character.png', meta: 'character.json', type: 'png' },
  { page: 'scene_base.html', out: 'scene_base.jpg', type: 'jpeg', quality: 82 },
  { page: 'scene_bonus.html', out: 'scene_bonus.jpg', type: 'jpeg', quality: 82 },
  { page: 'scene_super.html', out: 'scene_super.jpg', type: 'jpeg', quality: 82 },
  { page: 'lobby.html', out: 'lobby.jpg', type: 'jpeg', quality: 88 },
];

/** Read the intended pixel size straight from the page's own <svg> attributes. */
async function pageSize(page) {
  return page.$eval('svg', (s) => ({
    w: Number(s.getAttribute('width')), h: Number(s.getAttribute('height')),
  }));
}

const PREINSTALLED = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(
  fs.existsSync(PREINSTALLED) ? { executablePath: PREINSTALLED } : {});

fs.mkdirSync(OUT, { recursive: true });
let total = 0;

for (const job of JOBS) {
  const src = path.join(BUILD, job.page);
  if (!fs.existsSync(src)) { console.log(`  skip ${job.page} (not generated)`); continue; }

  const page = await browser.newPage({ viewport: { width: 64, height: 64 },
    deviceScaleFactor: 1 });
  await page.goto('file://' + src, { waitUntil: 'networkidle' });
  const { w, h } = await pageSize(page);
  await page.setViewportSize({ width: w, height: h });

  const dest = path.join(OUT, job.out);
  await page.screenshot({
    path: dest,
    type: job.type,
    ...(job.type === 'jpeg' ? { quality: job.quality } : { omitBackground: true }),
    clip: { x: 0, y: 0, width: w, height: h },
  });
  if (job.meta) fs.copyFileSync(path.join(BUILD, job.meta), path.join(OUT, job.meta));

  const kb = fs.statSync(dest).size / 1024;
  total += kb;
  console.log(`  ${job.out.padEnd(18)} ${w}x${h}  ${kb.toFixed(0)} kB`);
  await page.close();
}

await browser.close();
console.log(`total images: ${total.toFixed(0)} kB -> ${OUT}`);
