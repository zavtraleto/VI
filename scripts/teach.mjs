// What the levels teach, measured on their own boards: what the way a level keeps leans on, and
// whether the rules its window says are of any use on it. The ladder of lessons these numbers are
// read against is in docs/VI_Levels_Teaching.md; the boards are picked by scripts/ladder.mjs.
//
//   node scripts/teach.mjs                 a line for every level of the game
//   node scripts/teach.mjs only=1,2,3      some of the levels only
//   node scripts/teach.mjs hold size=3 dice=5 seeds=300 faces=3
//                                          boards laid for a place of that size: on how many the fewest moves
//                                          are more without the move a link gives, and how many cannot be
//                                          cleared without it
//   states=400000                          boards the solver may see on one level
//
// The columns of a level:
//   uses       what its way leans on: link, glass, floor
//   chain      the longest chain of the way: 1 is a combo alone, 2 a combo and one die rolled up to it
//   commits    times the way steps off a leaving die with more than one standing die to choose from
//   walk       the first move is made with a die the player has to step to
//   under      dice that start with a working face at the bottom: the rule of seven is of use on them
//   turned     of those, the dice that leave showing the face they started on
//   noHold     the fewest moves with the move a link gives taken away; "none" if no way within three
//              moves of the fewest is left, "?" if the solver did not get through
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const load = async (path) => (await runnerImport(path, { root, configFile: false, logLevel: 'error' })).module;

const args = process.argv.slice(2);
const named = Object.fromEntries(args.filter((arg) => arg.includes('=')).map((arg) => arg.split('=')));
const known = ['only', 'states', 'size', 'dice', 'seeds', 'faces'];
for (const key of Object.keys(named)) {
  if (!known.includes(key)) throw new Error(`cannot read "${key}=": write it as only=1,2,3, states=400000, size=3, dice=5, seeds=300 or faces=3`);
}
const states = Number(named.states ?? 400000);

const { LEVELS } = await load('/src/levels/levels.ts');
const { candidate } = await load('/src/levels/generate.ts');
const { solveLevel, tryWay, replay, moveOf } = await load('/src/rules/levelSolver.ts');

/** The fewest moves of a board with no move given by a link, within three moves of `par`. */
function withoutHold(spec, par) {
  const { solution, exhausted } = solveLevel({ ...spec, liftMoves: 0 }, { maxStates: states, maxMoves: par + 3 });
  return solution ? solution.par : exhausted ? 'none' : '?';
}

if (args.includes('hold')) {
  const size = Number(named.size ?? 3);
  const dice = Number(named.dice ?? 5);
  const seeds = Number(named.seeds ?? 300);
  const faces = String(named.faces ?? '3').split('').map(Number);
  // A place of its own, so that its boards are not those of a place of the ladder.
  const recipe = { slot: 90 + size + dice, chapter: 1, size, dice, faces, compact: true, par: [1, 99] };
  let laid = 0;
  let solved = 0;
  let longer = 0;
  // Three stars are given within a move of the fewest: a board asks for the hold only where the way without it is two moves longer or more.
  let muchLonger = 0;
  let needing = 0;
  // Boards laid at random, then boards laid from their solutions.
  for (const base of [0, 10000]) {
    for (let seed = base + 1; seed <= base + seeds; seed++) {
      const spec = candidate(recipe, seed);
      if (!spec) continue;
      laid++;
      const { solution } = solveLevel(spec, { maxStates: states });
      if (!solution) continue;
      solved++;
      const bare = withoutHold(spec, solution.par);
      if (bare === 'none') needing++;
      else if (bare !== '?' && bare > solution.par) {
        longer++;
        if (bare >= solution.par + 2) muchLonger++;
      }
    }
  }
  console.log(
    `${size}x${size}, ${dice} dice, faces ${faces.join('')}: ${laid} laid, ${solved} solved; fewest moves more without the hold on ${longer}, by two or more on ${muchLonger}; not cleared without it on ${needing}`,
  );
} else {
  const only = named.only ? named.only.split(',').map(Number) : null;
  console.log('level | board | faces | par | uses | chain | commits | walk | under | turned | noHold | lesson');
  LEVELS.forEach((spec, index) => {
    if (only && !only.includes(index + 1)) return;
    const faces = spec.faces ?? [];
    const way = spec.solution.map(moveOf);
    const report = tryWay(spec, way);
    // Every die: the face it starts with and the face it leaves with.
    const first = new Map();
    const last = new Map();
    for (let made = 0; made <= way.length; made++) {
      for (const die of replay(spec, way.slice(0, made)).cubes) {
        if (made === 0) first.set(die.id, die.ori.top);
        last.set(die.id, die.ori.top);
      }
    }
    const under = [...first].filter(([, top]) => faces.includes(7 - top));
    const turned = under.filter(([id, top]) => last.get(id) === 7 - top).length;
    console.log(
      [
        `${index + 1} ${spec.id}`,
        `${spec.size}x${spec.size} ${spec.norm} dice`,
        faces.join(''),
        spec.par,
        report.uses.join('+') || '-',
        report.state.levelRun.bestChain,
        report.commits,
        report.ownFirst ? 'no' : 'yes',
        under.length,
        turned,
        withoutHold(spec, spec.par),
        spec.lesson ?? '',
      ].join(' | '),
    );
  });
}
