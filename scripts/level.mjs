// The lab of the levels from the command line: a board is a file of text in boards/, and every
// command reads one, says something of it, and ends with a code that can be checked. The format
// of the file is src/levels/boardFile.ts; what is said is made in src/levels/labText.ts; the page
// that shows the same is ?lab=levels. The whole of it is told in docs/VI_Levels_Lab.md.
//
//   node scripts/level.mjs show file=boards/H01.txt     the board as it is read, or what is wrong with its file
//   node scripts/level.mjs check file=H01               solved anew: the fewest moves, the score of the way, and
//                                                       whether that is what the file keeps
//   node scripts/level.mjs export file=P06 out=boards/P06.txt   a board written as a file
//   node scripts/level.mjs regress                      every board there is solved anew, and what it keeps held
//                                                       against it: the list, its reserve, the road, the files of boards/
//                                                       (workers=6: the processes the boards are shared among)
//   node scripts/level.mjs moves file=P06 after=3,0,W   every move there is, after the moves named if any are: whether
//                                                       it keeps the fewest moves, makes the way longer, or is a dead end
//   node scripts/level.mjs near file=P06                every board one change of a die away, only solved: what the
//                                                       change does to the fewest moves
//
// file= is a path, or the name of a file in boards/ without its .txt, or the code of a board the
// game has: a level of the list (P06) or a piece of the road (R03).
//   json          the answer as JSON with keys that stay, in place of the text
//   states=N      boards the solver may see before it gives up
// A word or a key that is not known is a mistake and is said. What is asked for goes to stdout;
// progress and warnings go to stderr. The code the script ends with: 0 where the check passed,
// 1 where it did not (check: no way, or not the way the file keeps), 2 where the file or the
// command could not be read.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const script = fileURLToPath(import.meta.url);
const root = resolve(dirname(script), '..');
const load = async (path) => (await runnerImport(path, { root, configFile: false, logLevel: 'error' })).module;

const COMMANDS = {
  show: { keys: ['file'], flags: ['json'] },
  check: { keys: ['file', 'states'], flags: ['json'] },
  export: { keys: ['file', 'out'], flags: [] },
  regress: { keys: ['states', 'workers', 'share'], flags: ['json'] },
  moves: { keys: ['file', 'after', 'states'], flags: ['json'] },
  near: { keys: ['file', 'states'], flags: ['json'] },
};

/** Ends the script on what could not be read: said on stderr, code 2. */
function refuse(what) {
  console.error(what);
  process.exit(2);
}

const [command, ...args] = process.argv.slice(2);
if (!Object.hasOwn(COMMANDS, command ?? '')) refuse(`${command ? `no command "${command}"` : 'no command'}: the commands are ${Object.keys(COMMANDS).join(', ')}`);
const { keys, flags } = COMMANDS[command];
const named = Object.fromEntries(args.filter((arg) => arg.includes('=')).map((arg) => [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)]));
const flag = (name) => args.includes(name);
for (const key of Object.keys(named)) {
  if (!keys.includes(key)) refuse(`${command}: cannot read "${key}=": its keys are ${keys.map((name) => `${name}=`).join(', ') || 'none'}`);
}
for (const arg of args) {
  if (!arg.includes('=') && !flags.includes(arg)) refuse(`${command}: cannot read "${arg}": its words are ${flags.join(', ') || 'none'}`);
}
const number = (key) => {
  if (named[key] === undefined) return undefined;
  if (!/^\d+$/.test(named[key])) refuse(`${command}: "${key}=${named[key]}" is not a number`);
  return Number(named[key]);
};

const { parseBoard, printBoard, readBoardHead } = await load('/src/levels/boardFile.ts');
const lab = await load('/src/levels/labText.ts');

/** The board a key names: a file by its path, a file of boards/ by its name, or a board of the game by its code. */
function loadBoard(key = 'file') {
  const said = named[key];
  if (!said) refuse(`${command}: name a board, as in ${key}=boards/H01.txt, ${key}=H01 or ${key}=P06`);
  const path = [resolve(process.cwd(), said), resolve(root, 'boards', `${said}.txt`)].find((candidate) => existsSync(candidate) && /\.txt$/i.test(candidate));
  try {
    if (path) {
      const text = readFileSync(path, 'utf8');
      return { spec: parseBoard(text, said), head: readBoardHead(text), from: 'file', path };
    }
    if (/[\\/.]/.test(said)) throw new Error(`no file ${said}`);
    return { ...lab.boardFrom(said), head: {} };
  } catch (error) {
    return refuse(error.message);
  }
}

const print = (text, json) => console.log(flag('json') ? JSON.stringify(json, null, 2) : text);

if (command === 'show') {
  const { spec, head, from } = loadBoard();
  print([lab.showText(spec), ...(head.note ? ['', `note: ${head.note}`] : []), ...(head.status ? [`status: ${head.status}`] : [])].join('\n'), { from, ...head, spec });
} else if (command === 'check') {
  const { spec } = loadBoard();
  const check = lab.checkOf(spec, { maxStates: number('states') });
  print(lab.checkText(spec, check), lab.checkJson(spec, check));
  if (!lab.checkPassed(check)) process.exitCode = 1;
} else if (command === 'export') {
  const { spec, head } = loadBoard();
  if (!named.out) refuse('export: name the file to write, as in out=boards/P06.txt');
  const out = resolve(process.cwd(), named.out);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, printBoard(spec, head));
  console.log(out);
} else if (command === 'moves') {
  const { spec } = loadBoard();
  // after= is the moves made before the board is asked, with a space, a plus or a semicolon between them.
  const after = (named.after ?? '').split(/[\s+;]+/).filter(Boolean);
  let facts;
  try {
    facts = lab.movesOf(spec, { after, maxStates: number('states') });
  } catch (error) {
    refuse(`moves: ${error.message}`);
  }
  print(lab.movesText(facts), { id: spec.id, after, moves: facts });
} else if (command === 'near') {
  const { spec } = loadBoard();
  const began = Date.now();
  const facts = lab.nearOf(spec, { maxStates: number('states') });
  console.error(`near: ${facts.length} boards solved in ${((Date.now() - began) / 1000).toFixed(1)} s`);
  print(lab.nearText(facts), { id: spec.id, near: facts });
} else if (command === 'regress') {
  const { LEVELS, SPARES } = await load('/src/levels/levels.ts');
  const { ROAD } = await load('/src/levels/road.ts');
  const dir = resolve(root, 'boards');
  const files = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.txt')).sort() : [];
  // Every board with where it is from; a file that cannot be read is a board that is broken, and says why.
  const boards = [
    ...LEVELS.map((spec) => ({ from: 'list', spec })),
    ...SPARES.map((spec) => ({ from: 'spare', spec })),
    ...ROAD.map((spec) => ({ from: 'road', spec })),
    ...files.map((name) => {
      try {
        return { from: 'board', spec: parseBoard(readFileSync(resolve(dir, name), 'utf8'), name) };
      } catch (error) {
        return { from: 'board', name, error: error.message };
      }
    }),
  ];
  const one = (board) => (board.error ? { id: board.name, from: 'board', stored: null, found: null, exact: false, states: 0, verdict: 'broken' } : lab.regressOne(board.spec, number('states'), board.from));
  if (named.share !== undefined) {
    const [index, of] = named.share.split('/').map(Number);
    boards.forEach((board, at) => {
      if (at % of === index) console.log(JSON.stringify({ at, row: one(board) }));
    });
  } else {
    for (const board of boards) if (board.error) console.error(board.error);
    const rows = [];
    const began = Date.now();
    await shareOut(({ at, row }) => {
      rows[at] = row;
      const done = rows.filter(Boolean).length;
      if (done % 10 === 0 || done === boards.length) console.error(`${done} of ${boards.length} boards solved, ${Math.round((Date.now() - began) / 1000)} s`);
    });
    print(lab.regressText(rows), { boards: rows.length, failed: rows.filter(lab.regressFailed).length, rows });
    if (rows.some(lab.regressFailed)) process.exitCode = 1;
  }
}

/** Runs this script again in several processes, each taking its share of the work, and gives back what they print, line by line. */
function shareOut(onLine) {
  const workers = Math.max(1, number('workers') ?? Math.min(6, Math.max(1, availableParallelism() - 2)));
  const passed = process.argv.slice(2).filter((arg) => !arg.startsWith('workers=') && !arg.startsWith('share='));
  return Promise.all(
    Array.from({ length: workers }, (_, index) => new Promise((done, fail) => {
      const child = spawn(process.execPath, ['--max-old-space-size=4096', script, ...passed, `share=${index}/${workers}`], { stdio: ['ignore', 'pipe', 'inherit'] });
      let rest = '';
      child.stdout.on('data', (chunk) => {
        const lines = (rest + chunk).split('\n');
        rest = lines.pop();
        for (const line of lines) if (line.trim()) onLine(JSON.parse(line));
      });
      child.on('error', fail);
      child.on('close', (code) => (code === 0 ? done() : fail(new Error(`a worker ended with ${code}`))));
    })),
  );
}
