// The lab of the levels from the command line: a board is a file of text in boards/, and every
// command reads one, says something of it, and ends with a code that can be checked. The format
// of the file is src/levels/boardFile.ts; what is said is made in src/levels/labText.ts; the page
// that shows the same is ?lab=levels. The whole of it is told in docs/VI_Levels_Lab.md.
//
//   node scripts/level.mjs show file=boards/H01.txt     the board as it is read, or what is wrong with its file
//   node scripts/level.mjs check file=H01               solved anew: the fewest moves, the score of the way, and
//                                                       whether that is what the file keeps
//   node scripts/level.mjs export file=P06 out=boards/P06.txt   a board written as a file
//
// file= is a path, or the name of a file in boards/ without its .txt, or the code of a board the
// game has: a level of the list (P06) or a piece of the road (R03).
//   json          the answer as JSON with keys that stay, in place of the text
//   states=N      boards the solver may see before it gives up
// A word or a key that is not known is a mistake and is said. What is asked for goes to stdout;
// progress and warnings go to stderr. The code the script ends with: 0 where the check passed,
// 1 where it did not (check: no way, or not the way the file keeps), 2 where the file or the
// command could not be read.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const load = async (path) => (await runnerImport(path, { root, configFile: false, logLevel: 'error' })).module;

const COMMANDS = {
  show: { keys: ['file'], flags: ['json'] },
  check: { keys: ['file', 'states'], flags: ['json'] },
  export: { keys: ['file', 'out'], flags: [] },
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
}
