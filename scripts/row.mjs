// The row of the campaign from the command line (docs/superpowers/specs/2026-10-15-vi-row-json-design.md):
// boards/row.json and the files of the boards laid into src/levels/row.gen.ts, which the game reads.
// The pure part is src/levels/row.ts; the dev server lays the row again when its files are written.
//
//   node scripts/row.mjs                   lays the row and writes src/levels/row.gen.ts; code 1 and the line of the
//                                          refusal where the row cannot be laid, and the file is left as it was
//   node scripts/row.mjs check             the same with nothing written: code 1 where row.gen.ts is stale
//   node scripts/row.mjs report [place=5]  the passport of the places: what the solver and the bots make of each
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
  refuse('report: comes with the report of the places');
} else {
  writeFileSync(genFile, text);
  console.log(said);
}
