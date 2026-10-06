// The ladder of the first twenty levels: boards laid by the recipes of its places, solved by the
// solver and played by the players made of the rules.
// The recipes are in src/levels/recipes.ts, the judging in src/levels/select.ts, the solver in
// src/rules/levelSolver.ts, the players in src/rules/levelBot.ts, the levels in src/levels/levels.ts.
//
//   node scripts/ladder.mjs                  the table of the levels and of the boards in reserve
//   node scripts/ladder.mjs levels           the table of the levels alone
//   node scripts/ladder.mjs slot=7           looks for the boards of a place: seeds 1 to 2000, the three that fit best
//   node scripts/ladder.mjs place=T04        the same for a place of the course or of a chapter, by the name of its level
//   node scripts/ladder.mjs place=T04 keep=5 the five that fit best
//   node scripts/ladder.mjs chapter=0        fills every place of a chapter (boards laid both ways, seeds 1 to 1000 of each, and
//                                            the boards laid by hand) and puts the chapter together: for every place one board
//                                            that is unlike the one before it, with its picture and its line for levels.ts
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
const known = ['slot', 'place', 'chapter', 'seeds', 'from', 'states', 'boards', 'only', 'workers', 'share', 'skills', 'keep'];
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
} else if (named.chapter !== undefined) {
  const { PLACES } = await load('/src/levels/recipes.ts');
  const { judge, gather, measureRow, MEASURE_HEAD, layOutRows, levelSource, boardText } = await load('/src/levels/select.ts');
  const { levelId, SKETCH } = await load('/src/levels/generate.ts');
  const { arrange, ARRANGE_AMONG } = await load('/src/levels/variety.ts');
  const { personaRates } = await load('/src/rules/levelBot.ts');
  const places = PLACES.filter((recipe) => recipe.chapter === Number(named.chapter));
  if (places.length === 0) throw new Error(`no places of chapter ${named.chapter}`);
  const count = Number(named.seeds ?? 1000);
  const span = (from) => Array.from({ length: count }, (_, index) => from + index);
  const jobs = places.flatMap((recipe, at) => [...span(1), ...span(10_001), ...(recipe.sketch ?? []).map((_, index) => SKETCH + index + 1)].map((seed) => ({ at, seed })));
  const opts = named.states ? { maxStates: Number(named.states) } : {};
  if (worker) {
    jobs.forEach((job, index) => {
      if (mine(index)) console.log(JSON.stringify({ at: job.at, verdict: judge(places[job.at], job.seed, opts) }));
    });
  } else {
    const verdicts = places.map(() => []);
    let done = 0;
    const began = Date.now();
    await shareOut([], ({ at, verdict }) => {
      verdicts[at].push(verdict);
      if (++done % 500 === 0) console.error(`chapter ${named.chapter}: ${done} of ${jobs.length} boards judged, ${Math.round((Date.now() - began) / 1000)} s`);
    });
    const filled = places.map((recipe, at) => gather(recipe, verdicts[at].sort((a, b) => a.seed - b.seed)));
    // Of the boards that fit a place, the ones the weaker players clear oftenest come first: these are levels that teach.
    const ease = (fit) => (fit.personas ? fit.personas.hasty + fit.personas.casual : 0);
    const fits = filled.map(({ fits: all }) => all.filter((fit) => fit.misses.length === 0).sort((a, b) => ease(b) - ease(a) || a.par - b.par || a.distance - b.distance || a.seed - b.seed));
    const picked = arrange(fits);
    const runs = Number(named.skills ?? 30);
    const rows = [[...MEASURE_HEAD]];
    picked.forEach((fit, at) => {
      if (fit) rows.push(measureRow(levelId(places[at]), fit, runs > 0 ? personaRates(fit.spec, runs) : undefined));
    });
    console.log(layOutRows(rows));
    picked.forEach((fit, at) => {
      const recipe = places[at];
      const { reasons, tried } = filled[at];
      console.log('');
      console.log(`${levelId(recipe)}: ${fits[at].length} of ${tried} boards fit. ${recipe.brief ?? ''}`);
      if (!fit) {
        const turned = Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([why, many]) => `${many} ${why}`).join('; ');
        console.log(`no board. turned away: ${turned}`);
        return;
      }
      console.log(boardText(fit.spec));
      console.log(levelSource(fit.spec));
      const spares = fits[at].slice(0, ARRANGE_AMONG).filter((other) => other !== fit);
      if (spares.length > 0) console.log('in reserve:');
      for (const spare of spares) console.log(levelSource(spare.spec));
    });
  }
} else if (named.slot !== undefined || named.place !== undefined) {
  const { RECIPES, PLACES } = await load('/src/levels/recipes.ts');
  const { judge, gather, placeReport, levelSource, boardText } = await load('/src/levels/select.ts');
  const { levelId, SKETCH } = await load('/src/levels/generate.ts');
  const { neededBy } = await load('/src/rules/levelBot.ts');
  // A place is asked for by its number among the places of the ladder as it was, or by the name of its level.
  const recipe = named.place !== undefined ? [...PLACES, ...RECIPES].find((candidate) => levelId(candidate) === named.place) : RECIPES.find((candidate) => candidate.slot === Number(named.slot));
  if (!recipe) throw new Error(`no place ${named.place ?? named.slot} in the ladder`);
  // Seeds above ten thousand lay a board from its solution: see src/levels/generate.ts.
  const first = Number(named.from ?? 1);
  const count = Number(named.seeds ?? 2000);
  const span = (from) => Array.from({ length: count }, (_, index) => from + index);
  // The boards a place has laid by hand are judged with whatever else is asked for.
  const sketches = (recipe.sketch ?? []).map((_, index) => SKETCH + index + 1);
  const seeds = [...(flag('both') ? [...span(first), ...span(first + 10_000)] : span(first + (flag('solution') ? 10_000 : 0))), ...sketches];
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
    const keep = Number(named.keep ?? 3);
    console.log(placeReport(filled, keep, Number(named.skills ?? 20)));
    for (const fit of filled.fits.slice(0, keep)) {
      console.log('');
      console.log(boardText(fit.spec));
      console.log(levelSource(fit.spec));
    }
  }
} else {
  const { LEVELS, SPARES } = await load('/src/levels/levels.ts');
  const { measureBoard, tableOf } = await load('/src/levels/table.ts');
  // Every level under its name, in the order of the ladder, and after it the boards in reserve for its place;
  // the boards of places that have no level any more come last. `levels` leaves the reserve out.
  const spares = flag('levels') ? [] : SPARES;
  const boards = [
    ...LEVELS.flatMap((spec) => [{ place: spec.id, spec }, ...spares.filter((spare) => spare.id === spec.id).map((spare) => ({ place: `${spare.id} spare`, spec: spare }))]),
    ...spares.filter((spare) => !LEVELS.some((level) => level.id === spare.id)).map((spare) => ({ place: `${spare.id} gone`, spec: spare })),
  ];
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
