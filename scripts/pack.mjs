// Packs the production build for a platform into one archive: `index.html` at its root, and
// the names of the files inside written with forward slashes, whatever system it is made on.
// Run `npm run pack -- playgama` (or with VI_PLATFORM): the build is made here, for that platform,
// and the archive is written to release/vi-<version>-<platform>.zip; its size is printed in bytes.
// A build without a platform is not packed.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { zipSync } from 'fflate';

const DIST = 'dist';
const OUT_DIR = 'release';
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

const platform = process.argv[2] || process.env.VI_PLATFORM;
if (!platform || platform === 'none') throw new Error('An archive is made for a platform only: npm run pack -- playgama');
if (!existsSync(join('platforms', platform, 'adapter.ts'))) throw new Error(`No platform "${platform}": platforms/${platform}/adapter.ts is missing`);
// `npm run pack -- <name>` puts the name at the end of the script: the build is run here, so it is made for that platform.
execSync('npm run build', { stdio: 'inherit', env: { ...process.env, VI_PLATFORM: platform } });

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
const out = join(OUT_DIR, `vi-${version}-${platform}.zip`);
writeFileSync(out, archive);
console.log(`${out}: ${archive.length} bytes, ${Object.keys(entries).length} files`);
