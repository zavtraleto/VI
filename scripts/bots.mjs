// What the players of the levels say of a board: its way and the route of the way, what the
// board makes its player do and the ways round it, what lies about the way, and how it plays.
// The report is src/rules/levelReport.ts; the players are in src/rules/levelBot.ts, the score in
// src/rules/levelScore.ts, the graph in src/rules/levelGraph.ts, the proofs in src/rules/levelProof.ts.
//
//   node scripts/bots.mjs                    the table of the levels of the ladder
//   node scripts/bots.mjs only=B05,B13       some of the levels
//   node scripts/bots.mjs spares             the boards in reserve as well
//   node scripts/bots.mjs level=B13          one level in full: its board, its score move by move, every player
//   node scripts/bots.mjs climb=off          the levels with an open floor played with a strict one: no die is
//                                            climbed from the floor, the only way up is a die that is leaving.
//                                            Such a level is solved anew, since the way it keeps may not hold
//   node scripts/bots.mjs edits level=B13    the boards one change away from the level, and what each change does
//   node scripts/bots.mjs runs=40            runs of every player that plans: ten unless said
//   node scripts/bots.mjs states=400000      boards the solver may see on a level solved anew
//
// The columns of the table: `needs` are the parts of the route with no way round within a move,
// `round` those with one and how many moves longer it is; for every player the shares of its runs
// that pass / end by the count of the dice / end on the floor / run out of moves; `match` the
// share of the planner's passes that go the route of the way sign for sign, `same kind` the share
// whose route is of its kind; `walk`, `again`, `first` the moves
// of the walker to a cleared board, the times it began again, the share cleared at the first go.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const load = async (path) => (await runnerImport(path, { root, configFile: false, logLevel: 'error' })).module;

const args = process.argv.slice(2);
const named = Object.fromEntries(args.filter((arg) => arg.includes('=')).map((arg) => arg.split('=')));
const flag = (name) => args.includes(name);
const known = ['only', 'level', 'climb', 'runs', 'states'];
for (const key of Object.keys(named)) {
  if (!known.includes(key)) throw new Error(`cannot read "${key}=": write it as only=B05,B13, level=B13, climb=off, runs=40 or states=400000`);
}
for (const arg of args) {
  if (!arg.includes('=') && !['spares', 'edits'].includes(arg)) throw new Error(`cannot read "${arg}": the words are spares and edits`);
}

const { LEVELS, SPARES } = await load('/src/levels/levels.ts');
const { report, reportRow, REPORT_HEAD, REPORT_PLAYERS, layOut, scoreText } = await load('/src/rules/levelReport.ts');
const { boardText } = await load('/src/levels/generate.ts');
const { moveText } = await load('/src/rules/levelSolver.ts');

const runs = Number(named.runs ?? 10);
const maxStates = named.states ? Number(named.states) : undefined;
const strictFloor = named.climb === 'off';

/** A level as the script plays it: with a strict floor, one with an open floor forgets its way and is solved anew. */
const played = (spec) => {
  if (!strictFloor || spec.floor === false) return spec;
  const { solution, par, exact, ...rest } = spec;
  return { ...rest, climb: false };
};

const percent = (share) => `${Math.round(share * 100)}%`;

function full(spec) {
  const told = report(spec, { runs, maxStates });
  const lines = [`${spec.id}  ${spec.size}x${spec.size}, ${spec.norm} dice, faces ${(spec.faces ?? spec.values).join('')}${spec.floor === false ? ', floor shut' : ''}${spec.climb === false ? ', no climbing' : ''}`, '', boardText(spec), ''];
  if (told.par === null) {
    lines.push('no way is known');
  } else {
    lines.push(`moves ${told.par}${told.exact ? '' : ' (not proved the fewest)'}: ${told.way.map(moveText).join(' ')}`);
    lines.push(`route ${told.score.route}  (${told.score.kind})`);
    lines.push(`quiet ${told.score.quiet}, under the count ${told.score.counted}, longest pause ${told.score.pause}, tail ${told.score.tail}, biggest event ${told.score.biggest} dice, last ${told.score.last}, links ${told.score.chain}`);
    lines.push('', scoreText(told.score), '');
    for (const bypass of told.bypasses) {
      const says = bypass.way ? `a way round, ${bypass.way.length - told.par} longer: ${bypass.way.map(moveText).join(' ')}` : bypass.settled ? 'needed: no way without it within a move' : 'not settled: the search gave up';
      lines.push(`${bypass.part.padEnd(6)} ${says}`);
    }
    if (told.bypasses.length === 0) lines.push('the way leans on no part of a route: plain rolls on top');
    lines.push('');
    lines.push(
      told.graph
        ? `boards within two moves over the fewest: ${told.graph.states}; still cleared from ${percent(told.graph.alive)}; shortest ways ${told.graph.ways >= 1000 ? '999+' : told.graph.ways}; first moves ${told.graph.firstsAlive} of ${told.graph.firsts} keep the board in hand; a dead end ${told.graph.lostIn < 0 ? 'is not there' : `in ${told.graph.lostIn} moves`}`
        : 'the boards about the way are too many to see: no graph, no walker',
    );
    if (told.walk) {
      for (const [name, walk] of Object.entries(told.walk)) lines.push(`${name.padEnd(7)} ${walk.moves.toFixed(1)} moves to clear, begins again ${walk.restarts.toFixed(1)} times, cleared at the first go ${percent(walk.first)}`);
    }
  }
  lines.push('', `traps ${percent(told.traps)} of the greedy runs; random ${percent(told.random)} cleared`, '');
  const rows = [['player', 'passed', 'by count', 'on floor', 'ran out', 'moves over', 'same route', 'same kind']];
  for (const name of REPORT_PLAYERS) {
    const { endings, over, match, sameKind } = told.personas[name];
    rows.push([name, percent(endings.passed), percent(endings.count), percent(endings.floor), percent(endings.limit), over === null ? '-' : `+${over}`, match === null ? '-' : percent(match), sameKind === null ? '-' : percent(sameKind)]);
  }
  lines.push(layOut(rows));
  return lines.join('\n');
}

const all = flag('spares') ? [...LEVELS, ...SPARES] : LEVELS;

if (flag('edits')) {
  const { probeEdits } = await load('/src/levels/edits.ts');
  const spec = all.find((level) => level.id === named.level);
  if (!spec) throw new Error('edits: name a level, as in edits level=B13');
  const base = played(spec);
  const before = report(base, { runs: 1, maxStates });
  console.log(`${spec.id}: moves ${before.par ?? '-'}, route ${before.score?.route ?? '-'} (${before.score?.kind ?? '-'}), tail ${before.score?.tail ?? '-'}, round ${before.bypasses.filter((bypass) => bypass.way).map((bypass) => bypass.part).join(' ') || '-'}\n`);
  const rows = [['change', 'moves', 'route', 'kind', 'tail', 'needs', 'round']];
  // Every edit that still clears is kept: nearest the level's own moves first.
  const edits = probeEdits(base, (told) => (told.par === null ? null : -Math.abs(told.par - (before.par ?? told.par))), { runs: 1, maxStates });
  for (const { edit, report: told } of edits) {
    const needs = told.bypasses.filter((bypass) => bypass.way === null && bypass.settled).map((bypass) => bypass.part);
    const round = told.bypasses.filter((bypass) => bypass.way !== null).map((bypass) => bypass.part);
    rows.push([edit.what, `${told.par}${told.exact ? '' : '?'}`, told.score.route, told.score.kind, String(told.score.tail), needs.join(' ') || '-', round.join(' ') || '-']);
  }
  console.log(layOut(rows));
} else if (named.level) {
  const spec = all.find((level) => level.id === named.level);
  if (!spec) throw new Error(`no level "${named.level}"`);
  console.log(full(played(spec)));
} else {
  const only = named.only ? named.only.split(',') : null;
  const rows = [[...REPORT_HEAD]];
  for (const spec of all) {
    if (only && !only.includes(spec.id)) continue;
    const level = played(spec);
    process.stderr.write(`${spec.id} `);
    rows.push(reportRow(level, report(level, { runs, maxStates })));
  }
  process.stderr.write('\n');
  console.log(layOut(rows));
}
