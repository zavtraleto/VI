// The library of the boards from the command line: every board ever made is a file of boards/,
// with where it is from, its status, the mark and the words of the owner. The pure parts are
// src/levels/library.ts; the page is ?lab=library; the whole of it is told in docs/VI_Levels_Lab.md,
// section «Библиотека», and the decision in docs/superpowers/specs/2026-10-14-vi-board-library-design.md.
//
//   node scripts/library.mjs import                  the boards of the code and of the history of git laid as files
//                                                    (a file there is gets only what it lacks), and the words of the
//                                                    owner from scripts/library-words.json put into them
//   node scripts/library.mjs list [status=RC] [chapter=1]   the files as a table
//   node scripts/library.mjs check                   the files against the code: every board of the row has its file
//                                                    with status R, every R file is in the row, every board of the code
//                                                    has a file of the same dice and way; code 1 where not
//   node scripts/library.mjs export [since=2026-10-14]   the marks and the words as a text for a chat, as the page gives it
//
// A board of the history is read from the tree of its commit, laid out under node_modules/.cache/vi-library/,
// and its modules are loaded as those of today are (vite's runner, as scripts/level.mjs does).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const boardsDir = resolve(root, 'boards');
const cache = resolve(root, 'node_modules/.cache/vi-library');
const load = async (path, base = root) => (await runnerImport(path, { root: base, configFile: false, logLevel: 'error' })).module;

const COMMANDS = { import: [], list: ['status', 'chapter'], check: [], export: ['since'] };
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

const { parseBoard, printBoard, readBoardHead } = await load('/src/levels/boardFile.ts');
const library = await load('/src/levels/library.ts');
const { sameBoard } = await load('/src/levels/variety.ts');
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

/**
 * Where the boards of the history are: the commits, the newest first, with the edition of the
 * road each is of, its rank in time (for the order of `origin`), and what each export of road.ts
 * and levels.ts is called there. An export not named is not read. The reserves are laid under the
 * name of their place and seed (`spareName`). The newest source is the last commit with boards in the code
 * (66b1d22): its boards are matched by dice, way and faces; the chapters of today are read from row.json.
 */
const PROBE = { LEVELS: 'проба 7 октября', SPARES: 'проба 7 октября, резерв' };
const LIST = { LEVELS: 'список 12 октября', PARKED: 'парковка', SPARES: PROBE.SPARES };
// On 11 October P08 of the probe went to the road and R10 of the second edition took its place in the list.
const LIST_11 = { LEVELS: 'список 11 октября', SPARES: PROBE.SPARES };
const SOURCES = [
  { at: '66b1d22', newest: true, edition: 7, rank: 11, road: { ROAD: 'пролог, дорога редакции 7', ROAD_SPARES: 'запас дороги, редакция 7' }, levels: { PARKED: 'парковка', SPARES: PROBE.SPARES } },
  { at: '6a32b23', edition: 6, rank: 10, road: { ROAD: 'дорога, редакция 6' }, levels: { ACT_1: 'акт I', ACT_2: 'акт II', TAIL: 'хвост ряда 0.2.53', PARKED: 'парковка', SPARES: PROBE.SPARES } },
  { at: '8ea871d', edition: 6, rank: 9, road: { ROAD: 'дорога, редакция 6' }, levels: LIST },
  { at: 'f9ad605', edition: 5, rank: 8, road: { ROAD: 'дорога, редакция 5' }, levels: LIST },
  { at: '0972f7b', edition: 4, rank: 7, road: {}, levels: LIST },
  { at: '541a681', edition: 4, rank: 6, road: { ROAD: 'дорога, редакция 4' }, levels: LIST_11 },
  { at: '877dc89', edition: 3, rank: 5, road: { ROAD: 'дорога, редакция 3' }, levels: LIST_11 },
  { at: 'cb574c3', edition: 2, rank: 4, road: { ROAD: 'дорога, редакция 2' }, levels: PROBE },
  { at: 'e49b5e4', edition: 1, rank: 3, road: { ROAD: 'дорога, редакция 1' }, levels: PROBE },
  { at: '3abb5aa', edition: 0, rank: 2, road: {}, levels: PROBE },
  { at: '7780049', edition: 0, rank: 1, road: {}, levels: PROBE },
  { at: '534b3ea', edition: 0, rank: 0, road: {}, levels: { LEVELS: 'курс 6 октября', SPARES: 'курс 6 октября, резерв' } },
];
const CHAPTER_RANK = 12;

/** The tree of `src/` at a commit, laid out once under the cache. */
function treeOf(commit) {
  const dir = resolve(cache, commit);
  if (!existsSync(resolve(dir, 'src'))) {
    mkdirSync(dir, { recursive: true });
    const tar = execFileSync('git', ['-C', root, 'archive', '--format=tar', commit, 'src'], { maxBuffer: 1 << 28 });
    // Forward slashes: tar reads a backslash before a digit (the cache of 66b1d22) as an escape.
    const out = spawnSync('tar', ['-x', '-f', '-', '-C', dir.replace(/\\/g, '/')], { input: tar });
    if (out.status !== 0) throw new Error(`cannot lay out ${commit}: ${String(out.stderr)}`);
  }
  return dir;
}

/** The boards of a source: a list of { spec, label, spare } in the order of its exports. */
async function boardsOf(source) {
  const base = source.at === 'HEAD' ? root : treeOf(source.at);
  const out = [];
  for (const [file, exports] of [['/src/levels/road.ts', source.road], ['/src/levels/levels.ts', source.levels]]) {
    if (Object.keys(exports).length === 0) continue;
    const module = await load(file, base);
    for (const [name, label] of Object.entries(exports)) {
      const list = module[name];
      if (!Array.isArray(list)) throw new Error(`${source.at}${file}: no export ${name}`);
      for (const spec of list) if (spec.layout) out.push({ spec, label, spare: name === 'SPARES' });
    }
  }
  return out;
}

/** The library laid out: the files of the code and of the history, with the words of the owner. */
async function lay() {
  const files = readFiles().map((file) => ({ ...file, before: true, labels: [], hadOrigin: file.head.origin !== undefined }));
  const byName = new Map(files.map((file) => [file.name, file]));
  /** Where a code of a commit lies: `<commit>:<code>` to the name of its file. */
  const alias = new Map();
  const counts = {};
  const taken = (name) => byName.has(name);
  const fresh = (name, edition) => {
    if (!taken(name)) return name;
    const edited = library.codeWithEdition(name, edition);
    if (!taken(edited)) return edited;
    for (let more = 2; ; more++) if (!taken(`${edited}-${more}`)) return `${edited}-${more}`;
  };
  const add = (name, spec, source) => {
    const file = { name, spec: { ...spec, id: name }, head: {}, before: false, labels: [], hadOrigin: false };
    files.push(file);
    byName.set(name, file);
    counts[source] = (counts[source] ?? 0) + 1;
    return file;
  };
  const label = (file, text, code, rank) => {
    const said = code === file.name ? text : `${text} (${code})`;
    if (!file.labels.some((one) => one.said === said)) file.labels.push({ said, rank });
  };

  for (const source of SOURCES) {
    const head = source.newest === true;
    for (const { spec, label: text, spare } of await boardsOf(source)) {
      // A board of the code is the file of the same dice, way and faces; a board of the history, the file of the same board turned or not.
      let file = head
        ? files.find((one) => one.spec && library.sameDice(one.spec, spec) && String(one.spec.faces ?? one.spec.values) === String(spec.faces ?? spec.values))
        : files.find((one) => one.spec && sameBoard(one.spec, spec));
      if (!file) {
        const wanted = spare ? library.spareName(spec.id, spec.seed) : spec.id;
        if (head && taken(wanted)) {
          console.error(`${wanted}: boards/${wanted}.txt is another board than the one of the code; left as it is`);
          continue;
        }
        file = add(fresh(wanted, source.edition), spec, source.at);
      }
      label(file, text, spec.id, source.rank);
      // The words said of the code of today (`at: HEAD` in library-words.json) are of the newest source.
      if (!spare) for (const at of source.newest ? [source.at, 'HEAD'] : [source.at]) alias.set(`${at}:${spec.id}`, file.name);
    }
  }
  // The boards of the chapters: each is a board of the code already, on the faces of its place; in the row it plays on those of its chapter.
  for (const chapter of CHAPTERS) {
    if (chapter.id === 0) continue;
    for (const code of chapter.stops) {
      const spec = ROW.places.find((one) => one.code === code).spec;
      let file = byName.get(code);
      if (!file || !file.spec || !library.sameDice(file.spec, spec)) file = files.find((one) => one.spec && library.sameDice(one.spec, spec));
      if (!file) {
        if (taken(code)) {
          console.error(`${code}: boards/${code}.txt is another board than the one of chapter ${chapter.id}; left as it is`);
          continue;
        }
        file = add(code, spec, 'HEAD');
      }
      label(file, `глава ${chapter.id} «${chapter.title}»`, code, CHAPTER_RANK);
      alias.set(`HEAD:${code}`, file.name);
    }
  }

  // The words of the owner, a line of the documents to a board: the board is the one the code named at that commit.
  const words = JSON.parse(readFileSync(resolve(root, 'scripts/library-words.json'), 'utf8'));
  const marks = new Map();
  const said = new Map();
  for (const word of words) {
    const name = alias.get(`${word.at}:${word.code}`);
    if (!name) throw new Error(`library-words.json: no board ${word.code} at ${word.at}`);
    said.set(name, [...(said.get(name) ?? []), { date: word.date, text: word.text }]);
    if (word.mark) marks.set(name, word.mark);
  }

  let written = 0;
  for (const file of files) {
    const labels = [...file.labels].sort((a, b) => a.rank - b.rank).map((one) => one.said);
    const origins = library.compactOrigins([...(file.before && !file.hadOrigin ? ['лаборатория'] : []), ...labels]);
    if (!file.spec) continue;
    const merged = library.mergeHead(file.head, { origin: origins.join('; '), words: said.get(file.name) ?? [], ...(marks.has(file.name) ? { mark: marks.get(file.name) } : {}) });
    // A status of the old words that said nothing but a draft (`idea`, `work`) gives way to the marks of the owner.
    const stood = file.head.migrated && file.head.status === 'D' ? undefined : file.head.status;
    const head = { ...merged, status: library.statusFor(file.name, stood, merged.mark, CHAPTERS) };
    // A file there was keeps its board and its other lines as they are: only the head of the library is said anew.
    const text = file.before ? library.withHead(file.text, head) : printBoard(file.spec, head);
    if (file.before && text === file.text) continue;
    writeFileSync(resolve(boardsDir, `${file.name}.txt`), text);
    written++;
  }
  return { files: files.length, written, counts, before: files.filter((file) => file.before).length };
}

/** The row and the other boards of the code, as `checkLibrary` takes them. */
async function codeBoards() {
  return { row: ROW.places.map((place) => place.spec) };
}

if (command === 'import') {
  const done = await lay();
  console.log(`import: ${done.files} files in boards/ (${done.before} were there), ${done.written} written`);
  for (const [at, count] of Object.entries(done.counts)) console.log(`  new from ${at}: ${count}`);
} else if (command === 'check') {
  const faults = library.checkLibrary(readFiles().map(({ name, text }) => ({ name, text })), await codeBoards(), CHAPTERS);
  for (const fault of faults) console.log(fault);
  console.log(`check: ${readFiles().length} files, ${faults.length} faults`);
  process.exit(faults.length > 0 ? 1 : 0);
} else if (command === 'list') {
  const rows = readFiles()
    .map((file) => ({ ...file, place: library.placeOf(file.name, CHAPTERS) }))
    .filter((file) => !named.status || file.head.status === named.status)
    .filter((file) => !named.chapter || String(file.place?.chapter ?? '') === named.chapter);
  const cut = (text, width) => (text.length > width ? `${text.slice(0, width - 1)}…` : text).padEnd(width);
  console.log(`${cut('доска', 12)}${cut('стат', 5)}${cut('место', 6)}${cut('глава', 6)}${cut('грани', 7)}${cut('кост', 5)}${cut('par', 4)}${cut('оценка', 7)}${cut('слова', 40)}откуда`);
  for (const file of rows) {
    const spec = file.spec;
    const last = file.head.words?.at(-1);
    console.log(
      `${cut(file.name, 12)}${cut(file.head.status ?? '?', 5)}${cut(String(file.place?.number ?? '—'), 6)}${cut(String(file.place?.chapter ?? '—'), 6)}${cut(spec ? (spec.faces ?? spec.values).join(' ') : '?', 7)}${cut(String(spec?.norm ?? '?'), 5)}${cut(String(spec?.par ?? '—'), 4)}${cut(file.head.mark ?? '—', 7)}${cut(last ? `${last.date}: ${last.text}` : '—', 40)}${file.head.origin ?? '—'}`,
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
}
