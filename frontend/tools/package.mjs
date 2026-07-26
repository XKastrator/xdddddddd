/**
 * Package the Stake Engine upload bundles.
 *
 * Produces two archives in `release/`:
 *
 *   molten-crown-frontend.zip   the contents of dist-release/, uploaded as the
 *                               game client (directory structure preserved)
 *   molten-crown-math.zip       index.json + lookUpTable_*.csv + books_*.jsonl.zst
 *
 * It also REFUSES to package a build that still contains the dev mock. Shipping
 * the mock RGS to a live game would be a bundle that looks fine on screen while
 * placing no real bets, which is the single worst failure mode this project has,
 * so it is checked here rather than trusted to the build flags.
 *
 *   npm run release
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(FRONTEND, '..');
const DIST = path.join(FRONTEND, 'dist-release');
const MATH = path.join(ROOT, 'math', 'publish_files');
const OUT = path.join(ROOT, 'release');

const MATH_FILES = ['index.json'];
for (const m of ['base', 'ante', 'bonus', 'super']) {
  MATH_FILES.push(`lookUpTable_${m}.csv`, `books_${m}.jsonl.zst`);
}

function die(msg) {
  console.error(`\npackaging refused: ${msg}`);
  process.exit(1);
}

function walk(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full, base) : [path.relative(base, full)];
  });
}

const kb = (n) => `${(n / 1024).toFixed(0)} kB`;
const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;

// --- checks ----------------------------------------------------------------
if (!fs.existsSync(DIST)) die(`${DIST} does not exist — run \`npm run build:release\` first`);
const files = walk(DIST);

if (!files.includes('index.html')) die('dist-release has no index.html');

// the mock fixture is a ~1.3 MB chunk named after its source module
const mock = files.filter((f) => /devbooks|mockrgs/i.test(f));
if (mock.length) {
  die(`the dev mock is still in the bundle: ${mock.join(', ')}\n`
    + '  This build would place no real bets. Check that session.ts guards the\n'
    + "  import behind IS_RELEASE and that the build ran with `--mode live`.");
}

const missing = MATH_FILES.filter((f) => !fs.existsSync(path.join(MATH, f)));
if (missing.length) die(`missing math publish files: ${missing.join(', ')}`);

// --- package ---------------------------------------------------------------
fs.mkdirSync(OUT, { recursive: true });
const feZip = path.join(OUT, 'molten-crown-frontend.zip');
const mathZip = path.join(OUT, 'molten-crown-math.zip');
for (const z of [feZip, mathZip]) fs.rmSync(z, { force: true });

// zip from INSIDE each directory so index.json and index.html sit at the
// archive root — Stake Engine expects the files, not a wrapper folder
execFileSync('zip', ['-qr9', feZip, '.'], { cwd: DIST });
execFileSync('zip', ['-q9', mathZip, ...MATH_FILES], { cwd: MATH });

// --- report ----------------------------------------------------------------
const distBytes = files.reduce((n, f) => n + fs.statSync(path.join(DIST, f)).size, 0);
const mathBytes = MATH_FILES.reduce((n, f) => n + fs.statSync(path.join(MATH, f)).size, 0);

console.log('\nfrontend  (upload the CONTENTS, keeping the directory structure)');
for (const f of files.filter((f) => !f.startsWith('assets/audio/')).sort()) {
  console.log(`  ${f.padEnd(34)} ${kb(fs.statSync(path.join(DIST, f)).size).padStart(9)}`);
}
console.log(`  assets/audio/*.ogg                 ${
  kb(files.filter((f) => f.startsWith('assets/audio/'))
    .reduce((n, f) => n + fs.statSync(path.join(DIST, f)).size, 0)).padStart(9)}`
  + `  (${files.filter((f) => f.startsWith('assets/audio/')).length} files)`);
console.log(`  ${files.length} files, ${mb(distBytes)} raw -> ${mb(fs.statSync(feZip).size)} zipped`);

console.log('\nmath');
for (const f of MATH_FILES) {
  console.log(`  ${f.padEnd(34)} ${kb(fs.statSync(path.join(MATH, f)).size).padStart(9)}`);
}
console.log(`  ${MATH_FILES.length} files, ${mb(mathBytes)} raw -> ${mb(fs.statSync(mathZip).size)} zipped`);

console.log(`\nwrote:\n  ${path.relative(ROOT, feZip)}\n  ${path.relative(ROOT, mathZip)}`);
