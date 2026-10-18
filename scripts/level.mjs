// The lab of the levels from the command line: a board is a file of text in boards/, and every
// command reads one, says something of it, and ends with a code that can be checked. The format
// of the file is src/levels/boardFile.ts; what is said is made in src/levels/labText.ts; the page
// that shows the same is ?lab=workshop. The whole of it is told in docs/VI_Levels_Lab.md.
//
//   node scripts/level.mjs show file=boards/H01.txt     the board as it is read, or what is wrong with its file
//   node scripts/level.mjs check file=H01               solved anew: the fewest moves, the score of the way, and
//                                                       whether that is what the file keeps
//   node scripts/level.mjs export file=P06 out=boards/P06.txt   a board written as a file
//   node scripts/level.mjs turn file=R11                the file of boards/ turned half round in place: the board and
//                                                       its way, the rest of the head as it was (then check it)
//   node scripts/level.mjs regress                      every board there is solved anew, and what it keeps held
//                                                       against it: the list, its reserve, the road, the files of boards/
//                                                       (not the drafts the library laid from the history, nor those taken off)
//                                                       (workers=6: the processes the boards are shared among)
//   node scripts/level.mjs moves file=P06 after=3,0,W   every move there is, after the moves named if any are: whether
//                                                       it keeps the fewest moves, makes the way longer, or is a dead end
//   node scripts/level.mjs near file=P06                every board one change of a die away, only solved: what the
//                                                       change does to the fewest moves
//   node scripts/level.mjs fit file=H01 place=P06,R05   which places the board is a board of, and what it misses of the
//                                                       others; every place of the list and of the road unless some are named
//   node scripts/level.mjs diff a=H01 b=boards/H02.txt  the cells two boards differ in
//   node scripts/level.mjs svg file=H01 out=boards/out/H01.svg   the board as a picture (cell=48: the side of a cell)
//   node scripts/level.mjs source file=H01              the board as a line for src/levels/levels.ts or road.ts: it is
//                                                       put there by hand, and by the word of the owner only
//   node scripts/level.mjs order preset=tricky par=4-6 out=boards/out/   boards laid for an order: a preset and the bounds
//                                                       said after it (size= dice= faces= par= needs= avoid= quiet= events= tail=
//                                                       ends= firsts= trap= trapdepth= hidden= far= last=); seconds=10, keep=5
//                                                       (batch=bridge: boards/bridge-<n>.txt, new (N), in one batch; keep=10)
//   node scripts/level.mjs complete file=H01 pinned=1.1,3.2 preset=flow   the dice named stay, the rest are laid for the order
//   node scripts/level.mjs repair file=H01 par=4-4 needs=link   the nearest board that meets the order, by the fewest changes
//   node scripts/level.mjs improve file=H01 preset=tricky   as repair, by many small changes: for a board three changes do not mend
//                                                       (all three: seconds=10, out=<file> to write the board; pinned= dice left alone)
//   node scripts/level.mjs set name=set7 orders=insight,insight,wall,gift   a set: a board to every preset, each ordered
//                                                       after those before it, written as set7-1, set7-2 … (seconds=6 a board)
//   node scripts/level.mjs ratings                      what the owner answered after his plays: the boards called fire
//                                                       beside those called a miss, measure by measure and preset by preset
//   node scripts/level.mjs gen place=R05 out=boards/out/   boards laid for a place and judged by it, the ones that fit
//                                                       written as files: seeds=200 from=1, mode=random|solution|route|both
//                                                       (the place's own way unless said), keep=20 the most that are written
//                                                       (batch=bridge: boards/bridge-<n>.txt, new (N), in one batch)
//
// file= is a path, or the name of a file in boards/ without its .txt, or a name the board had before
// (`was:`), or the code of a board the game has: a level of the list (P06) or a piece of the road (R03).
// A file of boards/ stands before a board of the game of the same name: file=game:P06 asks for the
// board of the game.
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
  turn: { keys: ['file'], flags: [] },
  regress: { keys: ['states', 'workers', 'share'], flags: ['json'] },
  moves: { keys: ['file', 'after', 'states'], flags: ['json'] },
  near: { keys: ['file', 'states'], flags: ['json'] },
  fit: { keys: ['file', 'place', 'states'], flags: ['json'] },
  diff: { keys: ['a', 'b'], flags: ['json'] },
  svg: { keys: ['file', 'out', 'cell'], flags: [] },
  source: { keys: ['file', 'states'], flags: [] },
  gen: { keys: ['place', 'seeds', 'from', 'mode', 'keep', 'out', 'batch', 'states', 'workers', 'share'], flags: ['json'] },
  // The keys of `order` are the words of an order, read by `orderOf`: any key is taken here and held against them there.
  order: { keys: null, flags: ['json'] },
  ratings: { keys: [], flags: ['json'] },
  set: { keys: ['name', 'orders', 'seconds', 'out'], flags: ['json'] },
  complete: { keys: null, flags: ['json'] },
  repair: { keys: null, flags: ['json'] },
  improve: { keys: null, flags: ['json'] },
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
  if (keys !== null && !keys.includes(key)) refuse(`${command}: cannot read "${key}=": its keys are ${keys.map((name) => `${name}=`).join(', ') || 'none'}`);
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
const { resolveName } = await load('/src/levels/library.ts');

/** The board a key names: a file by its path, a file of boards/ by its name or by a name it had, or a board of the game by its code. */
function loadBoard(key = 'file') {
  const said = named[key];
  if (!said) refuse(`${command}: name a board, as in ${key}=boards/H01.txt, ${key}=H01 or ${key}=P06`);
  const path = [resolve(process.cwd(), said), resolve(root, 'boards', `${said}.txt`)].find((candidate) => existsSync(candidate) && /\.txt$/i.test(candidate));
  try {
    // A file of boards/ stands before a board of the game of the same name; `game:P06` asks for the board of the game.
    if (said.startsWith('game:')) return { ...lab.boardFrom(said.slice(5)), head: {} };
    if (path) {
      const text = readFileSync(path, 'utf8');
      return { spec: parseBoard(text, said), head: readBoardHead(text), from: 'file', path };
    }
    if (/[\\/.]/.test(said)) throw new Error(`no file ${said}`);
    // A board renamed is found by a name it had, before a board of the game is looked for.
    const boards = resolve(root, 'boards');
    const files = existsSync(boards) ? readdirSync(boards).filter((file) => file.endsWith('.txt')).map((file) => ({ name: file.slice(0, -'.txt'.length), text: readFileSync(resolve(boards, file), 'utf8') })) : [];
    const now = resolveName(said, files);
    if (now !== null) {
      const text = files.find((file) => file.name === now).text;
      return { spec: parseBoard(text, now), head: readBoardHead(text), from: 'file', path: resolve(boards, `${now}.txt`) };
    }
    return { ...lab.boardFrom(said), head: {} };
  } catch (error) {
    return refuse(error.message);
  }
}

const print = (text, json) => console.log(flag('json') ? JSON.stringify(json, null, 2) : text);

/** The word of batch= checked, or nothing where no batch is asked for. */
function batchWord() {
  if (named.batch === undefined) return undefined;
  if (!lab.BATCH_WORD.test(named.batch)) refuse(`${command}: "batch=${named.batch}" is no word of a batch: small English letters, words joined by -`);
  return named.batch;
}

/** The names a board of a batch laid into a folder may not take: its boards, and in boards/ the names of the histories as well. */
function batchTaken(dir) {
  const boards = resolve(root, 'boards');
  const histories = resolve(boards, '.history');
  const inBoards = dir.toLowerCase() === boards.toLowerCase() && existsSync(histories);
  return lab.batchTaken(existsSync(dir) ? readdirSync(dir) : [], inBoards ? readdirSync(histories) : []);
}

/**
 * The boards of a batch laid into a folder, one by one: each takes the first number of its word
 * that no board there, no history of boards/ and no board laid before it in this run has. Nothing
 * is read where no batch is asked for.
 */
function batchLayer(word, dir) {
  if (word === undefined) return undefined;
  const taken = batchTaken(dir);
  const date = new Date().toISOString().slice(0, 10);
  return (spec, note) => {
    const board = lab.batchFile(spec, word, taken, date, note);
    taken.push(board.name);
    return board;
  };
}

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
} else if (command === 'turn') {
  const { spec, head, from, path } = loadBoard();
  if (from !== 'file') refuse('turn: a file of boards/ is turned, not a board of the game');
  const { turnedBoard } = await load('/src/levels/edits.ts');
  const turned = turnedBoard(spec);
  // The head stays line by line, comments and all; the way and the rows are written anew.
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  const end = lines.findIndex((line) => /^-{3,}$/.test(line.trim()));
  const printed = printBoard(turned, head).split('\n');
  const rows = printed.slice(printed.findIndex((line) => /^-{3,}$/.test(line.trim())) + 1);
  const kept = lines.slice(0, end).map((line) => (/^way:/.test(line.trim()) && turned.solution ? `way: ${turned.solution.join(' ')}` : line));
  writeFileSync(path, [...kept, '---', ...rows].join('\n'));
  console.log(path);
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
} else if (command === 'fit') {
  const { spec } = loadBoard();
  const { PLACES } = await load('/src/levels/recipes.ts');
  const { ROAD_PLACES } = await load('/src/levels/roadRecipes.ts');
  const { CAMPAIGN_PLACES } = await load('/src/levels/campaignRecipes.ts');
  const { levelId } = await load('/src/levels/generate.ts');
  const all = [...PLACES, ...ROAD_PLACES, ...CAMPAIGN_PLACES];
  const places = named.place ? all.filter((place) => named.place.split(',').includes(levelId(place))) : all;
  if (places.length === 0) refuse(`fit: no place ${named.place}: the places are ${all.map(levelId).join(' ')}`);
  // Only the name of a place is printed and what the board misses of it: what a place is there for is in the key of the probe.
  const facts = lab.fitOf(spec, places, { maxStates: number('states') });
  print(lab.fitText(facts), { id: spec.id, fit: facts });
} else if (command === 'diff') {
  const a = loadBoard('a').spec;
  const b = loadBoard('b').spec;
  const diff = lab.diffOf(a, b);
  print(lab.diffText(a, b, diff), { a: a.id, b: b.id, ...diff });
} else if (command === 'svg') {
  const { spec } = loadBoard();
  if (!named.out) refuse('svg: name the file to write, as in out=boards/out/H01.svg');
  const { boardSvg } = await load('/src/levels/boardSvg.ts');
  const out = resolve(process.cwd(), named.out);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, boardSvg(spec, { cell: number('cell') }));
  console.log(out);
} else if (command === 'source') {
  const { spec } = loadBoard();
  const { levelSource } = await load('/src/levels/select.ts');
  // A line of the list keeps a way: a board that has none is solved for one, and the line says whether it is proved the fewest.
  let kept = spec;
  if (spec.par === undefined || !spec.solution) {
    const check = lab.checkOf(spec, { maxStates: number('states') });
    if (check.par === null) {
      console.error(`source: no way found for ${spec.id}: a line of the list keeps one`);
      process.exit(1);
    }
    kept = { ...spec, par: check.par, exact: check.exact, solution: check.way };
  }
  console.log(levelSource(kept));
} else if (command === 'gen') {
  const { PLACES } = await load('/src/levels/recipes.ts');
  const { ROAD_PLACES } = await load('/src/levels/roadRecipes.ts');
  const { CAMPAIGN_PLACES } = await load('/src/levels/campaignRecipes.ts');
  const { levelId } = await load('/src/levels/generate.ts');
  const { judge, gather } = await load('/src/levels/select.ts');
  const all = [...PLACES, ...ROAD_PLACES, ...CAMPAIGN_PLACES];
  const recipe = all.find((place) => levelId(place) === named.place);
  if (!recipe) refuse(`gen: ${named.place ? `no place ${named.place}` : 'name a place, as in place=R05'}: the places are ${all.map(levelId).join(' ')}`);
  if (named.mode !== undefined && !['random', 'solution', 'route', 'both'].includes(named.mode)) refuse(`gen: "mode=${named.mode}" is none of random, solution, route, both`);
  const from = number('from') ?? 1;
  const seeds = lab.genSeeds(recipe, { from, to: from + (number('seeds') ?? 200) - 1 }, named.mode);
  const judging = number('states') === undefined ? {} : { maxStates: number('states') };
  if (named.share !== undefined) {
    const [index, of] = named.share.split('/').map(Number);
    seeds.forEach((seed, at) => {
      if (at % of === index) console.log(JSON.stringify(judge(recipe, seed, judging)));
    });
  } else {
    const word = batchWord();
    if (!named.out && word === undefined) refuse('gen: name the folder to write the boards to, as in out=boards/out/, or a batch, as in batch=bridge');
    const verdicts = [];
    const began = Date.now();
    await shareOut((verdict) => {
      verdicts.push(verdict);
      if (verdicts.length % 50 === 0 || verdicts.length === seeds.length) console.error(`gen ${named.place}: ${verdicts.length} of ${seeds.length} seeds, ${verdicts.filter((v) => v.fit).length} fit, ${Math.round((Date.now() - began) / 1000)} s`);
    });
    verdicts.sort((a, b) => a.seed - b.seed);
    // The boards that fit, the best first, each written as a file: an idea, with a note of its place and seed.
    const fits = gather(recipe, verdicts).fits.slice(0, number('keep') ?? 20);
    const dir = resolve(process.cwd(), named.out ?? resolve(root, 'boards'));
    mkdirSync(dir, { recursive: true });
    const laid = batchLayer(word, dir);
    const written = fits.map((fit) => {
      const file = lab.genFile(recipe, fit);
      const { name, text } = word === undefined ? file : laid(fit.spec, readBoardHead(file.text).note);
      writeFileSync(resolve(dir, `${name}.txt`), text);
      return { file: resolve(dir, `${name}.txt`), seed: fit.seed, par: fit.par, exact: fit.exact, route: fit.route };
    });
    print(
      [...written.map((board) => `${board.file}  moves ${board.par}${board.exact ? '' : '?'}  route ${board.route}`), `gen: ${seeds.length} seeds, ${verdicts.filter((v) => v.fit).length} fit, ${written.length} written`].join('\n'),
      { place: named.place, seeds: seeds.length, fit: verdicts.filter((v) => v.fit).length, boards: written },
    );
    if (written.length === 0) process.exitCode = 1;
  }
} else if (command === 'order') {
  // Every word that is not the script's own is a word of the order: preset=tricky par=4-6 dice=5 …
  const own = ['seconds', 'keep', 'out', 'batch'];
  const { orderOf, orderText } = await load('/src/levels/orders.ts');
  const { offersFor } = await load('/src/levels/orderSearch.ts');
  let order;
  try {
    order = orderOf(Object.entries(named).filter(([key]) => !own.includes(key)).map(([key, value]) => `${key}=${value}`).join(' '));
  } catch (error) {
    refuse(error.message);
  }
  const word = batchWord();
  if (!named.out && word === undefined) refuse('order: name the folder to write the boards to, as in out=boards/out/, or a batch, as in batch=bridge');
  const began = Date.now();
  const { offers, tried } = offersFor(order, { budgetMs: (number('seconds') ?? 10) * 1000, keep: number('keep') ?? (word === undefined ? 5 : 10) });
  console.error(`order: ${tried} seeds in ${((Date.now() - began) / 1000).toFixed(1)} s`);
  const dir = resolve(process.cwd(), named.out ?? resolve(root, 'boards'));
  mkdirSync(dir, { recursive: true });
  const stem = order.preset ?? 'order';
  const note = `заказ ${orderText(order)}`;
  const laid = batchLayer(word, dir);
  const written = offers.map((offer, index) => {
    const plain = `${stem}-${index + 1}`;
    const { name, text } = word === undefined ? { name: plain, text: printBoard({ ...offer.spec, id: plain }, { status: 'D', note }) } : laid(offer.spec, note);
    const file = resolve(dir, `${name}.txt`);
    writeFileSync(file, text);
    return { file, seed: offer.seed, par: offer.par, route: offer.route, misses: offer.misses };
  });
  print(
    [`order: ${orderText(order)}`, ...written.map((board) => `${board.file}  moves ${board.par}  route ${board.route}  ${board.misses.length === 0 ? 'meets the order' : `misses: ${board.misses.join('; ')}`}`), `order: ${written.filter((board) => board.misses.length === 0).length} of ${written.length} boards meet it`].join('\n'),
    { order: orderText(order), tried, boards: written },
  );
  if (!written.some((board) => board.misses.length === 0)) process.exitCode = 1;
} else if (command === 'complete' || command === 'repair' || command === 'improve') {
  // The board of file= worked on by an order: the words that are not the script's own are the order's.
  const own = ['file', 'pinned', 'seconds', 'out'];
  const { orderOf, orderText } = await load('/src/levels/orders.ts');
  const { completeFor, repairFor, improveFor } = await load('/src/levels/orderSearch.ts');
  const { spec } = loadBoard();
  let order;
  try {
    order = orderOf(Object.entries(named).filter(([key]) => !own.includes(key)).map(([key, value]) => `${key}=${value}`).join(' '));
  } catch (error) {
    refuse(error.message);
  }
  // pinned=1.1,3.2 names the dice that stay as they are, each by its x and z.
  const pinned = (named.pinned ?? '').split(',').filter(Boolean).map((cell) => {
    const [x, z] = cell.split('.').map(Number);
    if (!Number.isInteger(x) || !Number.isInteger(z)) refuse(`${command}: "pinned=${named.pinned}" is not cells as 1.1,3.2`);
    return { x, z };
  });
  const budgetMs = (number('seconds') ?? 10) * 1000;
  const found = command === 'complete' ? completeFor(order, spec, pinned, { budgetMs, keep: 1 }).offers : command === 'repair' ? repairFor(order, spec, pinned, { budgetMs, keep: 1 }).mended : improveFor(order, spec, pinned, { budgetMs, keep: 1 }).mended;
  const best = found[0];
  if (!best) {
    console.error(`${command}: no board found for ${orderText(order)}`);
    process.exit(1);
  }
  const text = printBoard(best.spec, { status: 'D', note: `заказ ${orderText(order)}` });
  if (named.out) {
    const out = resolve(process.cwd(), named.out);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, text);
  }
  print(
    [named.out ? resolve(process.cwd(), named.out) : text, ...(best.edits ? [`changed: ${best.edits.join('; ') || 'nothing'}`] : []), best.misses.length === 0 ? `${command}: the board meets the order` : `${command}: the board misses: ${best.misses.join('; ')}`].join('\n'),
    { order: orderText(order), par: best.par, misses: best.misses, edits: best.edits ?? null, text },
  );
  if (best.misses.length > 0) process.exitCode = 1;
} else if (command === 'set') {
  const { setFor } = await load('/src/levels/sets.ts');
  const { orderText } = await load('/src/levels/orders.ts');
  if (!named.orders || !named.name) refuse('set: name the set and its presets in their order, as in name=set7 orders=insight,insight,wall,gift');
  if (!/^[A-Za-z0-9_]{1,40}$/.test(named.name)) refuse(`set: "name=${named.name}" has more than letters, digits and _`);
  let laid;
  try {
    laid = setFor(named.orders.split(',').filter(Boolean), { budgetMs: (number('seconds') ?? 6) * 1000 });
  } catch (error) {
    refuse(error.message);
  }
  const dir = resolve(process.cwd(), named.out ?? resolve(root, 'boards'));
  mkdirSync(dir, { recursive: true });
  const written = laid.boards.map((board, index) => {
    const name = `${named.name}-${index + 1}`;
    writeFileSync(resolve(dir, `${name}.txt`), printBoard({ ...board.offer.spec, id: name }, { status: 'D', note: `заказ ${orderText(board.order)}` }));
    return { name, preset: board.key, par: board.offer.par, route: board.offer.route, misses: board.offer.misses };
  });
  print(
    [...written.map((board) => `${board.name}  ${board.preset}  moves ${board.par}  route ${board.route}  ${board.misses.length === 0 ? 'meets its order' : `misses: ${board.misses.join('; ')}`}`), `set: ${written.length} boards${laid.missing.length > 0 ? `, none found for ${laid.missing.join(', ')}` : ''}`].join('\n'),
    { name: named.name, boards: written, missing: laid.missing },
  );
  if (laid.missing.length > 0) process.exitCode = 1;
} else if (command === 'ratings') {
  // The plays written down beside the boards, every board's, with the answers given after them laid over.
  const { mergePlays, ratingsOf, ratingsText } = await load('/src/lab/playLog.ts');
  const dir = resolve(root, 'boards', '.history');
  const plays = [];
  for (const name of existsSync(dir) ? readdirSync(dir) : []) {
    const file = resolve(dir, name, 'plays.jsonl');
    if (!existsSync(file)) continue;
    plays.push(...mergePlays(readFileSync(file, 'utf8').split('\n').filter((line) => line.trim() !== '').flatMap((line) => {
      // A line that is torn or was written by hand is passed over, and said.
      try {
        return [JSON.parse(line)];
      } catch {
        console.error(`ratings: a line of ${file} is no JSON and is passed over`);
        return [];
      }
    })));
  }
  const ratings = ratingsOf(plays);
  print(ratingsText(ratings), { plays: plays.length, ...ratings });
} else if (command === 'regress') {
  const { CAMPAIGN } = await load('/src/levels/campaign.ts');
  const dir = resolve(root, 'boards');
  // A board the library laid from the history and nobody took up again (a draft from there, or one taken off) is history, not work in hand: it is not held here.
  const history = (name) => {
    const head = readBoardHead(readFileSync(resolve(dir, name), 'utf8'));
    return head.status === 'X' || (head.status === 'D' && head.origin !== undefined && !head.origin.includes('лаборатория'));
  };
  const files = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.txt') && !history(name)).sort() : [];
  // Every board with where it is from; a file that cannot be read is a board that is broken, and says why.
  const boards = [
    // The boards of the row as they are played (on the faces of their chapters), and then every file that is work in hand.
    ...CAMPAIGN.map((place) => ({ from: 'row', spec: place.spec })),
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
