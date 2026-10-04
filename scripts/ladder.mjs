// The ladder of the first twenty levels: boards laid by the recipes of its places, solved by the
// solver and played by the players made of the rules.
// The recipes are in src/levels/recipes.ts, the judging in src/levels/select.ts, the solver in
// src/rules/levelSolver.ts, the players in src/rules/levelBot.ts, the levels in src/levels/levels.ts.
//
//   node scripts/ladder.mjs                  the table of the twenty levels and of the boards in reserve
//   node scripts/ladder.mjs slot=7           looks for the boards of a place: seeds 1 to 2000, the three that fit best
//   node scripts/ladder.mjs slot=7 seeds=300 from=1   some of the seeds only
//   node scripts/ladder.mjs slot=7 solution  lays the boards from their solutions and not at random (seeds 10001 on)
//   node scripts/ladder.mjs slot=7 both      boards laid either way, judged together
//   node scripts/ladder.mjs slot=7 loose     keeps boards whose fewest moves lean on what the place avoids
//   node scripts/ladder.mjs slot=7 near      for a place nothing fits: the boards nearest its bounds, with what each misses
//   node scripts/ladder.mjs slot=7 states=3000000     boards the solver may see on a candidate
//   node scripts/ladder.mjs limit boards=20  how far the solver gets on boards laid at random
//   workers=6                                processes the work is shared among: six unless said, or fewer on a machine
//                                            of few cores. A process solving a big board holds up to a gigabyte.
import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const script = fileURLToPath(import.meta.url);
const root = resolve(dirname(script), '..');
const load = async (path) => (await runnerImport(path, { root, configFile: false, logLevel: 'error' })).module;

const args = process.argv.slice(2);
const named = Object.fromEntries(args.filter((arg) => arg.includes('=')).map((arg) => arg.split('=')));
const flag = (name) => args.includes(name);
const known = ['slot', 'seeds', 'from', 'states', 'boards', 'only', 'workers', 'share', 'skills'];
for (const key of Object.keys(named)) {
  if (!known.includes(key)) throw new Error(`cannot read "${key}=": write it as slot=7, seeds=300, from=1, states=3000000, boards=20 or workers=6`);
}

/** Runs this script again in several processes, each taking its share of the work, and gives back what they print, line by line. */
function shareOut(extra, onLine) {
  const workers = Math.max(1, Number(named.workers ?? Math.min(6, Math.max(1, availableParallelism() - 2))));
  const passed = args.filter((arg) => !arg.startsWith('workers=') && !arg.startsWith('share='));
  return Promise.all(
    Array.from({ length: workers }, (_, index) => new Promise((done, fail) => {
      const child = spawn(process.execPath, ['--max-old-space-size=4096', script, ...passed, ...extra, `share=${index}/${workers}`], { stdio: ['ignore', 'pipe', 'inherit'] });
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

/** The share of the work a process takes: every item whose number, counted from 0, leaves `index` when divided by `of`. */
const [shareIndex, shareOf] = (named.share ?? '0/1').split('/').map(Number);
const mine = (index) => index % shareOf === shareIndex;
const worker = named.share !== undefined;

if (flag('limit')) {
  const { solverLimit } = await load('/src/levels/limit.ts');
  const say = (row) => console.log(`${row.name}  seed ${row.seed}  moves ${row.par ?? '-'}  ${row.exhausted ? 'counted through' : 'gave up'}  boards ${row.states}  ${row.ms} ms`);
  solverLimit(Number(named.boards ?? 5), Number(named.states ?? 3_000_000), named.only, say);
} else if (named.slot !== undefined) {
  const { RECIPES } = await load('/src/levels/recipes.ts');
  const { judge, gather, placeReport, levelSource, boardText } = await load('/src/levels/select.ts');
  const { neededBy } = await load('/src/rules/levelBot.ts');
  const recipe = RECIPES.find((candidate) => candidate.slot === Number(named.slot));
  if (!recipe) throw new Error(`no place ${named.slot} in the ladder`);
  // Seeds above ten thousand lay a board from its solution: see src/levels/generate.ts.
  const first = Number(named.from ?? 1);
  const count = Number(named.seeds ?? 2000);
  const span = (from) => Array.from({ length: count }, (_, index) => from + index);
  const seeds = flag('both') ? [...span(first), ...span(first + 10_000)] : span(first + (flag('solution') ? 10_000 : 0));
  const opts = { loose: flag('loose'), near: flag('near'), ...(named.states ? { maxStates: Number(named.states) } : {}) };
  if (worker) {
    seeds.forEach((seed, index) => {
      if (mine(index)) console.log(JSON.stringify(judge(recipe, seed, opts)));
    });
  } else {
    const verdicts = [];
    const began = Date.now();
    await shareOut([], (verdict) => {
      verdicts.push(verdict);
      if (verdicts.length % 100 === 0) console.error(`place ${recipe.slot}: ${verdicts.length} of ${seeds.length} seeds, ${verdicts.filter((v) => v.fit).length} fit, ${Math.round((Date.now() - began) / 1000)} s`);
    });
    verdicts.sort((a, b) => a.seed - b.seed);
    const filled = gather(recipe, verdicts);
    // What the three kept cannot be cleared without is asked of the solver for every technique their way leans on.
    for (const fit of filled.fits.slice(0, 3)) fit.needs = neededBy(fit.spec, fit.par, fit.uses);
    console.log(placeReport(filled, 3, Number(named.skills ?? 20)));
    for (const fit of filled.fits.slice(0, 3)) {
      console.log('');
      console.log(boardText(fit.spec));
      console.log(levelSource(fit.spec));
    }
  }
} else {
  const { LEVELS, SPARES } = await load('/src/levels/levels.ts');
  const { measureBoard, tableOf } = await load('/src/levels/table.ts');
  const boards = [...LEVELS.map((spec, index) => ({ place: String(index + 1), spec })), ...SPARES.map((spec) => ({ place: `${Number(spec.id.slice(1, 3))} spare`, spec }))];
  boards.sort((a, b) => parseInt(a.place, 10) - parseInt(b.place, 10));
  if (worker) {
    boards.forEach((board, index) => {
      if (mine(index)) console.log(JSON.stringify({ index, row: measureBoard(board.place, board.spec, Number(named.skills ?? 20)) }));
    });
  } else {
    const rows = [];
    await shareOut([], ({ index, row }) => {
      rows[index] = row;
      console.error(`${rows.filter(Boolean).length} of ${boards.length} boards measured`);
    });
    console.log(tableOf(rows));
  }
}
