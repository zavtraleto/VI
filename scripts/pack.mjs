// Packs the production build into one archive for a platform: `index.html` at its root, and
// the names of the files inside written with forward slashes, whatever system it is made on.
// Run `npm run pack`; the archive is written to release/ and its size is printed in bytes.
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { zipSync } from 'fflate';

const DIST = 'dist';
const OUT_DIR = 'release';
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const entries = {};
for (const path of files(DIST)) entries[relative(DIST, path).split(sep).join('/')] = readFileSync(path);
if (!entries['index.html']) throw new Error(`${DIST}/index.html is missing: run the build first`);

const archive = zipSync(entries, { level: 9 });
mkdirSync(OUT_DIR, { recursive: true });
const out = join(OUT_DIR, `vi-${version}.zip`);
writeFileSync(out, archive);
console.log(`${out}: ${archive.length} bytes, ${Object.keys(entries).length} files`);
