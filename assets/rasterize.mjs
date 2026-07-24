/**
 * Rasterise the authored SVG symbol sheet into a texture atlas PNG.
 *
 * Uses the environment's headless Chromium (via Playwright) as the SVG renderer,
 * so gradients, blur filters and strokes rasterise exactly as a browser will
 * display them. One screenshot of the deterministic grid produces the whole
 * atlas — a single texture keeps draw calls low on mobile (ART_BIBLE §11).
 *
 *   python3 assets/generate_art.py && node assets/rasterize.mjs
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

const meta = JSON.parse(fs.readFileSync(path.join(BUILD, 'atlas.json'), 'utf8'));
const { w, h } = meta.size;

const PREINSTALLED = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(
  fs.existsSync(PREINSTALLED) ? { executablePath: PREINSTALLED } : {});
const page = await browser.newPage({
  viewport: { width: w, height: h },
  deviceScaleFactor: 1,
});
await page.goto('file://' + path.join(BUILD, 'atlas.html'), { waitUntil: 'networkidle' });

fs.mkdirSync(OUT, { recursive: true });
await page.screenshot({
  path: path.join(OUT, 'atlas.png'),
  omitBackground: true,            // transparent — symbols composite over the board
  clip: { x: 0, y: 0, width: w, height: h },
});
fs.copyFileSync(path.join(BUILD, 'atlas.json'), path.join(OUT, 'atlas.json'));

await browser.close();
const bytes = fs.statSync(path.join(OUT, 'atlas.png')).size;
console.log(`atlas.png ${w}x${h} — ${(bytes / 1024).toFixed(0)} kB, ` +
  `${Object.keys(meta.frames).length} frames -> ${OUT}`);
