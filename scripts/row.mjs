// The row of the campaign from the command line (docs/superpowers/specs/2026-10-15-vi-row-json-design.md):
// boards/row.json and the files of the boards laid into src/levels/row.gen.ts, which the game reads.
// The pure part is src/levels/row.ts; the dev server lays the row again when its files are written.
//
//   node scripts/row.mjs                   lays the row and writes src/levels/row.gen.ts; code 1 and the line of the
//                                          refusal where the row cannot be laid, and the file is left as it was
//   node scripts/row.mjs check             the same with nothing written: code 1 where row.gen.ts is stale
//   node scripts/row.mjs report [place=5]  the passport of the places: what the solver and the bots make of each, with the
//                                          columns of `ladder.mjs campaign`; the slow measures are read from boards/.measures/
//                                          (scripts/measureCache.mjs), and measured and kept there where they are not
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const boardsDir = resolve(root, 'boards');
const genFile = resolve(root, 'src/levels/row.gen.ts');
const load = async (path) => (await runnerImport(path, { root, configFile: false, logLevel: 'error' })).module;

const COMMANDS = { build: [], check: [], report: ['place'] };
function refuse(what) {
  console.error(what);
  process.exit(2);
}
const [given, ...args] = process.argv.slice(2);
const command = given ?? 'build';
if (!Object.hasOwn(COMMANDS, command)) refuse(`no command "${command}": the commands are ${Object.keys(COMMANDS).join(', ')}`);
const named = {};
for (const arg of args) {
  const at = arg.indexOf('=');
  if (at < 0 || !COMMANDS[command].includes(arg.slice(0, at))) refuse(`${command}: cannot read "${arg}": its keys are ${COMMANDS[command].map((key) => `${key}=`).join(', ') || 'none'}`);
  named[arg.slice(0, at)] = arg.slice(at + 1);
}

const { buildRow, readRowFile, rowText } = await load('/src/levels/row.ts');

/** The texts of the files of boards/ by code, as buildRow takes them. */
function boardTexts() {
  return new Map(
    readdirSync(boardsDir)
      .filter((file) => file.endsWith('.txt'))
      .map((file) => [basename(file, '.txt'), readFileSync(resolve(boardsDir, file), 'utf8')]),
  );
}

let row;
try {
  row = buildRow(readRowFile(readFileSync(resolve(boardsDir, 'row.json'), 'utf8')), boardTexts());
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const text = rowText(row);
const said = `row: ${row.places.length} places, ${row.chapters.length} chapters`;

if (command === 'check') {
  const kept = existsSync(genFile) ? readFileSync(genFile, 'utf8') : '';
  if (kept !== text) {
    console.error('row.gen.ts is stale: run node scripts/row.mjs');
    process.exit(1);
  }
  console.log(`${said}, row.gen.ts is fresh`);
} else if (command === 'report') {
  // The passport of the places: the table of the road (the solver, the score of the way, the walk, two personas) and
  // the boards within two moves of the start, for every place or for the one named. Laid from the files, as `check` is.
  // The slow measures of a place are read from the cache of boards/.measures/ under the key of its board, as
  // `ladder.mjs campaign` reads them; where there is none, they are measured here and kept.
  const { placeRow, placeTable, slowMeasuresOf } = await load('/src/levels/table.ts');
  const { cacheKey } = await load('/src/levels/measureCache.ts');
  const { readMeasures, writeMeasures } = await import('./measureCache.mjs');
  const number = named.place === undefined ? null : Number(named.place);
  if (number !== null && !row.places.some((place) => place.number === number)) refuse(`report: there is no place ${named.place}: the places are 1 to ${row.places.length}`);
  const places = row.places.filter((place) => number === null || place.number === number);
  const rows = [];
  for (const place of places) {
    const key = cacheKey(place.spec, place.teaches);
    let measures = readMeasures(root, key);
    if (measures === null) {
      measures = slowMeasuresOf(place.spec, place.teaches);
      writeMeasures(root, key, measures);
    }
    rows.push(placeRow(place, measures));
    if (number === null) console.error(`${place.number} of ${row.places.length}: ${place.code}`);
  }
  console.log(placeTable(rows));
  for (const place of places.filter(() => number !== null)) console.log(`\n${place.code}: way ${(place.spec.solution ?? []).join(' ')}; help ${JSON.stringify(place.help)}`);
} else {
  writeFileSync(genFile, text);
  console.log(said);
}
