// The library of the boards from the command line: every board ever made is a file of boards/,
// with where it is from, its status, the mark and the words of the owner. The pure parts are
// src/levels/library.ts; the page is ?lab=workshop; the whole of it is told in docs/VI_Levels_Lab.md,
// section «Библиотека», and the decisions in docs/superpowers/specs/2026-10-14-vi-board-library-design.md
// and docs/superpowers/specs/2026-10-15-vi-level-workshop-design.md.
//
//   node scripts/library.mjs list [status=RC] [chapter=1] [batch=trap]   the files as a table (batch=: the first word
//                                                    of the batch the boards were laid in)
//   node scripts/library.mjs check                   the files against the code: every board of the row has its file
//                                                    with status R, every R file is in the row, every board of the code
//                                                    has a file of the same dice and way; code 1 where not
//   node scripts/library.mjs export [since=2026-10-14]   the marks and the words as a text for a chat, as the page gives it
//   node scripts/library.mjs rename from=P13_s30460 to=bridge-2   a board under a new name: the file, with the name it had
//                                                    said in was:, and its history in boards/.history/ go with it
//   node scripts/library.mjs rename map=renames.json   many boards at once, { "<from>": "<to>" }: all of them, or none
//                                                    where any is refused, and every fault said; code 1. A board of the
//                                                    row (row.json, or its own status R) keeps its code, and a name
//                                                    taken by a board or by a history is not given
//   node scripts/library.mjs history                 the history of a board kept under a name it had (was:) moved under
//                                                    the name it has: for a folder the renames came to by a pull
//
// The modules are loaded as the game has them, by vite's runner, as scripts/level.mjs does.
import { existsSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const boardsDir = resolve(root, 'boards');
const historyOf = (name) => resolve(boardsDir, '.history', name);
const load = async (path) => (await runnerImport(path, { root, configFile: false, logLevel: 'error' })).module;

const COMMANDS = { list: ['status', 'chapter', 'batch'], check: [], export: ['since'], rename: ['from', 'to', 'map'], history: [] };
function refuse(what) {
  console.error(what);
  process.exit(2);
}
const [command, ...args] = process.argv.slice(2);
if (!Object.hasOwn(COMMANDS, command ?? '')) refuse(`${command ? `no command "${command}"` : 'no command'}: the commands are ${Object.keys(COMMANDS).join(', ')}`);
const named = {};
for (const arg of args) {
  const at = arg.indexOf('=');
  if (at < 0 || !COMMANDS[command].includes(arg.slice(0, at))) refuse(`${command}: cannot read "${arg}": its keys are ${COMMANDS[command].map((key) => `${key}=`).join(', ') || 'none'}`);
  named[arg.slice(0, at)] = arg.slice(at + 1);
}

const { parseBoard, readBoardHead } = await load('/src/levels/boardFile.ts');
const library = await load('/src/levels/library.ts');
const { ROW } = await load('/src/levels/row.gen.ts');
// The chapters of the row (boards/row.json) as the library reads them.
const CHAPTERS = library.rowChapters(ROW);

/** The files of boards/ as they are: name, text, the board (as strictly as it reads) and the head. */
function readFiles() {
  if (!existsSync(boardsDir)) return [];
  return readdirSync(boardsDir)
    .filter((file) => file.endsWith('.txt'))
    .sort()
    .map((file) => {
      const name = basename(file, '.txt');
      const text = readFileSync(resolve(boardsDir, file), 'utf8');
      let spec = null;
      try {
        spec = parseBoard(text, name);
      } catch {
        try {
          spec = parseBoard(text, name, true);
        } catch {
          spec = null;
        }
      }
      return { name, text, spec, head: readBoardHead(text) };
    });
}

/** The row and the other boards of the code, as `checkLibrary` takes them. */
async function codeBoards() {
  return { row: ROW.places.map((place) => place.spec) };
}

/** The renames asked for, `{ [from]: to }`: from= and to=, or the JSON file that map= names. */
function renameMap() {
  if (named.map === undefined) {
    if (!named.from || !named.to) refuse('rename: name a board and its new name, as in from=P13_s30460 to=bridge-2, or a map of them, map=renames.json');
    return { [named.from]: named.to };
  }
  if (named.from !== undefined || named.to !== undefined) refuse('rename: a map, or from= and to=, not both');
  let map = null;
  try {
    map = JSON.parse(readFileSync(resolve(process.cwd(), named.map), 'utf8'));
  } catch (error) {
    refuse(`rename: cannot read the map ${named.map}: ${error.message}`);
  }
  if (map === null || typeof map !== 'object' || Array.isArray(map) || Object.values(map).some((to) => typeof to !== 'string')) refuse(`rename: the map ${named.map} is no { "<from>": "<to>" }`);
  return map;
}

if (command === 'check') {
  const faults = library.checkLibrary(readFiles().map(({ name, text }) => ({ name, text })), await codeBoards(), CHAPTERS);
  for (const fault of faults) console.log(fault);
  console.log(`check: ${readFiles().length} files, ${faults.length} faults`);
  process.exit(faults.length > 0 ? 1 : 0);
} else if (command === 'list') {
  const rows = readFiles()
    .map((file) => ({ ...file, place: library.placeOf(file.name, CHAPTERS) }))
    .filter((file) => !named.status || file.head.status === named.status)
    .filter((file) => !named.chapter || String(file.place?.chapter ?? '') === named.chapter)
    .filter((file) => !named.batch || file.head.batch?.split(/\s+/)[0] === named.batch);
  const cut = (text, width) => (text.length > width ? `${text.slice(0, width - 1)}…` : text).padEnd(width);
  console.log(`${cut('доска', 12)}${cut('стат', 5)}${cut('пачка', 20)}${cut('место', 6)}${cut('глава', 6)}${cut('грани', 7)}${cut('кост', 5)}${cut('par', 4)}${cut('оценка', 7)}${cut('слова', 40)}${'откуда'.padEnd(40)} было`);
  for (const file of rows) {
    const spec = file.spec;
    const last = file.head.words?.at(-1);
    console.log(
      `${cut(file.name, 12)}${cut(file.head.status ?? '?', 5)}${cut(file.head.batch ?? '—', 20)}${cut(String(file.place?.number ?? '—'), 6)}${cut(String(file.place?.chapter ?? '—'), 6)}${cut(spec ? (spec.faces ?? spec.values).join(' ') : '?', 7)}${cut(String(spec?.norm ?? '?'), 5)}${cut(String(spec?.par ?? '—'), 4)}${cut(file.head.mark ?? '—', 7)}${cut(last ? `${last.date}: ${last.text}` : '—', 40)}${(file.head.origin ?? '—').padEnd(40)} ${file.head.was?.join(' ') ?? ''}`.trimEnd(),
    );
  }
  console.log(`list: ${rows.length} boards`);
} else if (command === 'export') {
  const { checkOf, QUICK_MAX_STATES } = await load('/src/levels/labText.ts');
  const since = named.since;
  if (since !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(since)) refuse(`export: "since=${since}" is no date: YYYY-MM-DD`);
  const entries = [];
  for (const file of readFiles()) {
    const words = (file.head.words ?? []).filter((word) => since === undefined || word.date >= since);
    if (words.length === 0 && (since !== undefined || !file.head.mark)) continue;
    const place = library.placeOf(file.name, CHAPTERS);
    const spec = file.spec ? library.asInRow(file.spec, place, CHAPTERS) : null;
    const check = spec ? checkOf(spec, { maxStates: QUICK_MAX_STATES }) : null;
    entries.push({
      name: file.name,
      status: file.head.status,
      place,
      faces: spec ? spec.faces ?? spec.values : [],
      par: check?.par ?? spec?.par ?? null,
      ...(check?.score ? { route: check.score.route, turns: check.score.turns, away: check.score.away } : {}),
      mark: file.head.mark,
      words,
    });
  }
  console.log(library.exportText(entries, since ?? new Date().toISOString().slice(0, 10)));
} else if (command === 'rename') {
  const { renamedText } = await load('/src/lab/boardsServer.ts');
  const map = renameMap();
  const pairs = Object.entries(map);
  const files = readFiles();
  // A board of the row keeps its code by row.json, and by its own status R as the dev server holds it.
  const rowCodes = [...ROW.places.map((place) => place.code), ...files.filter((file) => file.head.status === 'R').map((file) => file.name)];
  const faults = library.renameFaults(map, files.map((file) => file.name), rowCodes);
  // A history under the new name is refused as the dev server refuses it: the history of the board would be left behind. Not where that history goes too.
  for (const [from, to] of pairs) if (existsSync(historyOf(to)) && !Object.hasOwn(map, to)) faults.push(`${from}: there is a history of ${to} already`);
  if (faults.length > 0) {
    for (const fault of faults) console.log(fault);
    console.log(`rename: ${faults.length} faults, nothing renamed`);
    process.exit(1);
  }
  // The texts are all read before anything is written: a file given to another board is written over, and goes only where no board takes its name.
  const texts = new Map(files.map((file) => [file.name, file.text]));
  for (const [from, to] of pairs) writeFileSync(resolve(boardsDir, `${to}.txt`), renamedText(texts.get(from), to));
  for (const [from] of pairs) if (!pairs.some(([, to]) => to === from)) unlinkSync(resolve(boardsDir, `${from}.txt`));
  // The histories go in two steps, so that a history moved off a name makes room for the one moved onto it.
  const moving = pairs.filter(([from]) => existsSync(historyOf(from)));
  for (const [from] of moving) renameSync(historyOf(from), historyOf(`.renaming-${from}`));
  for (const [from, to] of moving) renameSync(historyOf(`.renaming-${from}`), historyOf(to));
  console.log(`rename: ${pairs.length} boards`);
} else if (command === 'history') {
  // A name it had is taken only where it is a name of a board, and no board of today has it: the history of a board under that name is its own.
  const { isBoardName } = await load('/src/app/boardProbe.ts');
  const files = readFiles();
  const names = new Set(files.map((file) => file.name));
  let moved = 0;
  for (const file of files) {
    for (const was of file.head.was ?? []) {
      if (!isBoardName(was) || names.has(was) || !existsSync(historyOf(was)) || existsSync(historyOf(file.name))) continue;
      renameSync(historyOf(was), historyOf(file.name));
      moved++;
    }
  }
  console.log(`history: ${moved} moved`);
}
