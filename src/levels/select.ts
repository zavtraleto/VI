import { PERSONA_NAMES, neededBy, personaPlay, personaRates, randomRate, trapRate, witnessWay, type PersonaName } from '../rules/levelBot';
import { scoreOf, type Score } from '../rules/levelScore';
import { moveOf, moveText, movesAt, playMove, solveLevel, tryWay, type SolverMove } from '../rules/levelSolver';
import { defaultConfig } from '../rules/config';
import { createRun } from '../rules/sim';
import type { LevelSpec, Technique } from '../rules/types';
import { FROM_SOLUTION, SKETCH, boardText, builtWay, candidate } from './generate';
import { decoyOf, farOf, firstsOf, islandsOf, oneFaceClears, rideTurn, rides, silenceOf, startsUnder, tailOf, trapOf, underOf } from './measures';
import { boundsOf, type Recipe } from './recipes';
import { walkBoards, type Walk } from './walk';

/**
 * Picks the boards of the ladder. A candidate of a place is solved, its way is looked at, and it
 * is played by the yardsticks; it fits when everything it comes to is within the bounds of the
 * place. Of the boards that fit, the three nearest to the middles of the bounds are kept: the
 * first for the ladder, two in reserve. The bounds are never widened here: a place that gets no
 * board says which bound turned its candidates away.
 */

/** A board that fits its place, with what it came to. */
export interface Fit {
  seed: number;
  spec: LevelSpec;
  par: number;
  exact: boolean;
  /** Fewest moves by any way, where the way kept is the fewest only among those the place allows. */
  short: number;
  depth: number;
  uses: Technique[];
  needs: Technique[];
  traps: number;
  random: number;
  /** Moves of the way after the clearing move before its last. */
  tail: number;
  /** Clearing moves of the way: its combos and links. */
  clears: number;
  /** The route of the way kept, in its signs, and the kind of route it is. */
  route: string;
  kind: Score['kind'];
  /** First moves that keep the board in hand; null where the place did not ask and they were not counted. */
  firsts: number | null;
  /** Share of the runs of every persona that clear the board; null where the place did not ask. */
  personas: Record<PersonaName, number> | null;
  /** The shares of the runs the personas the place names floors for clear, each from its fixed runs; null where the place named none. */
  shares: Partial<Record<PersonaName, number>> | null;
  /** The walk over the boards the player can come to; null where the place did not ask and it was not made. */
  walk: Walk | null;
  /** How far it is from the middles of the bounds, each in halves of its width. */
  distance: number;
  /**
   * The bounds it does not meet, where a board was asked for that comes nearest a place nothing
   * fits: empty for a board that fits. A board with any is a stand-in, and is said to be one.
   */
  misses: string[];
}

export interface Verdict {
  seed: number;
  fit: Fit | null;
  /** Why the candidate was turned away: the first bound it did not meet. */
  why: string;
}

export interface JudgeOptions {
  /** Boards the solver may see on a candidate. */
  maxStates?: number;
  /** Keep a board whose fewest moves lean on what the place avoids, when a way without it is no more than two moves longer. */
  loose?: boolean;
  /**
   * Keep a board that is outside the bounds of the place in what is measured, its moves, depth,
   * traps or random share, and say which: for a place that nothing fits, the nearest board is
   * looked for this way. What a place is there to teach is still asked of it.
   */
  near?: boolean;
}

const within = (value: number, [from, to]: readonly [number, number]): boolean => value >= from - 1e-9 && value <= to + 1e-9;
const range = ([from, to]: readonly [number, number]): string => (from === to ? String(from) : `${from}-${to}`);

/** Boards the solver sees on a candidate of a place before it gives up. */
const JUDGE_MAX_STATES = 1_500_000;
/** A big board is played by the greedy player before it is solved: that is the cheaper thing to ask. */
const BIG_BOARD = 7;
/** Runs of every persona on a candidate whose place asks what they come to. */
const PERSONA_RUNS = 12;
/** Runs of a persona a place names a floor for: seeds 1 to this, so the same board is judged alike every time. */
export const PERSONA_FLOOR_RUNS = 30;
/** Boards the walk may see on a candidate whose place asks for it; a board whose walk is longer is turned away. */
export const WALK_LIMIT = 2000;
/** Boards the walk sees for the table of a place in `ladder.mjs place=`, for the boards that were not asked it; the report itself walks none unless told. */
export const REPORT_WALK_LIMIT = 150;
/** Boards a search for a way round a part of the route may see, and one for a way with a single face: a board it cannot settle is turned away. */
const PROOF_MAX_STATES = 300_000;

/**
 * The way a board laid from its solution was built to be cleared by, as far as the rules let it
 * go: its moves are played from the start, each one only if the player can get to it, until the
 * board is cleared. Null when the way breaks off before that, or the board was laid at random.
 */
function builtFor(recipe: Recipe, seed: number, board: LevelSpec): SolverMove[] | null {
  if (seed <= FROM_SOLUTION || seed > SKETCH) return null;
  const built = builtWay(recipe, seed - FROM_SOLUTION);
  if (!built) return null;
  let state = createRun({ seed: board.seed, config: defaultConfig(), level: board });
  const made: SolverMove[] = [];
  for (const text of built) {
    const move = moveOf(text);
    if (!movesAt(state).some((m) => m.x === move.x && m.z === move.z && m.dir === move.dir && m.push === move.push)) return null;
    state = playMove(state, move);
    made.push(move);
    if (state.endReason === 'passed') return made;
    if (state.over) return null;
  }
  return null;
}

/**
 * Judges the candidate a seed gives for a place. The checks go from the cheap to the dear, and
 * the first one that fails is the reason given.
 */
export function judge(recipe: Recipe, seed: number, opts: JudgeOptions = {}): Verdict {
  const { maxStates = JUDGE_MAX_STATES, loose = false, near = false } = opts;
  const no = (why: string): Verdict => ({ seed, fit: null, why });
  const misses: string[] = [];
  /** A bound that is not met turns the board away, or, where the nearest board is looked for, is noted. */
  const outside = (why: string): Verdict | null => {
    if (!near) return no(why);
    misses.push(why);
    return null;
  };
  const board = candidate(recipe, seed);
  if (!board) return no('no board laid');
  // What is read off the board as it lies is asked first: it costs nothing.
  if (recipe.safe && !(board.faces?.length === 1 && board.norm === board.faces[0] && board.floor === false)) return no('not a board of one combo');
  if (recipe.under === true && underOf(board) === 0) return no('no die with a working face at the bottom');
  if (recipe.under === false && underOf(board) > 0) return no('a die with a working face at the bottom');
  const laid = board.layout!.dice;
  if (recipe.room && !within(board.size * board.size - (board.holes?.length ?? 0) - laid.length, recipe.room)) return no(`free cells not ${range(recipe.room)}`);
  if (recipe.blind && laid.some((die) => board.faces?.includes(die.top))) return no('a die starts showing a face that works');
  if (recipe.underShare !== undefined && underOf(board) < recipe.underShare * laid.length - 1e-9) return no('too few dice with a working face at the bottom');
  if (recipe.islands !== undefined && islandsOf(board) < recipe.islands) return no(`fewer clusters than ${recipe.islands}`);
  const avoid = recipe.avoid ?? [];
  const big = board.norm >= BIG_BOARD;

  let traps: number | null = null;
  const trapped = (): string | null => {
    traps ??= trapRate(board);
    return recipe.traps && !within(traps, recipe.traps) ? `traps not ${range(recipe.traps)}` : null;
  };
  if (big && recipe.traps && !near) {
    const why = trapped();
    if (why) return no(why);
  }

  // The fewest moves by any way, counted no further than the place allows.
  const any = solveLevel(board, { maxStates, maxMoves: near ? undefined : recipe.par[1] });
  let way: SolverMove[];
  let exact = true;
  let short: number;
  if (any.solution) {
    short = any.solution.par;
    if (short < recipe.par[0] && !near) return no(`fewer moves than ${recipe.par[0]}`);
    // The way kept does without what the place avoids, and begins as the place asks.
    const first = recipe.ownOnly || recipe.ride ? 'own' : recipe.walk ? 'other' : undefined;
    const plain = any.solution.uses.every((technique) => !avoid.includes(technique)) && first === undefined;
    if (plain) way = any.solution.moves;
    else {
      const taught = solveLevel(board, { maxStates, ban: avoid, first, maxMoves: loose ? short + 2 : short });
      if (!taught.solution) return no(first && avoid.length === 0 ? `the first move is not ${first === 'own' ? 'the own die' : 'another die'}` : 'the fewest moves lean on what the place avoids');
      way = taught.solution.moves;
      exact = taught.solution.par === short;
    }
  } else if (any.exhausted) {
    return no(`more moves than ${recipe.par[1]}, or none`);
  } else if (recipe.witness) {
    // A board laid from its solution brings its way with it; any other is cleared by a strong player, or not taken.
    const told = builtFor(recipe, seed, board) ?? witnessWay(board);
    if (!told) return no('the solver gave up and no strong player cleared it');
    way = told;
    exact = false;
    short = told.length;
    if (!within(short, recipe.par) && !near) return no(`moves of the witness not ${range(recipe.par)}`);
  } else {
    return no('the solver gave up');
  }

  const par = way.length;
  if (!within(par, recipe.par)) {
    const turned = outside(near ? `moves ${par}, not ${range(recipe.par)}` : `moves not ${range(recipe.par)}`);
    if (turned) return turned;
  }
  const report = tryWay(board, way);
  if (report.state.endReason !== 'passed') return no('the way does not clear the board');
  if (recipe.depth && !within(report.depth, recipe.depth)) {
    const turned = outside(near ? `depth ${report.depth}, not ${range(recipe.depth)}` : `depth not ${range(recipe.depth)}`);
    if (turned) return turned;
  }
  // The groups made are of the faces the level is about, and the dice that stand assembled go as what they are.
  const faces = [...recipe.faces, ...(recipe.ones ? [1] : [])];
  if (report.values.some((value) => !faces.includes(value))) return no('a group of another face');
  if ((recipe.standing ?? []).some(({ value }) => !report.values.includes(value))) return no('the standing dice do not go as their face');
  if (recipe.walk) {
    if (report.ownFirst) return no('the first move is the own die');
    // No way as short begins with the die the player stands on: the step to another one is the lesson.
    if (solveLevel(board, { maxStates, ban: avoid, first: 'own', maxMoves: par }).solution) return no('the own die does as well');
  }
  if (recipe.commit && report.commits === 0) return no('no choice of a die to step to');
  for (const technique of [...(recipe.needs ?? []), ...(recipe.shows ?? [])]) {
    if (!report.uses.includes(technique)) return no(`the way does without ${technique}`);
  }
  const needs = neededBy(board, par, recipe.needs ?? [], maxStates);
  for (const technique of recipe.needs ?? []) {
    if (!needs.includes(technique)) return no(`cleared without ${technique}`);
  }
  // What the way of the board is, beside its length: the lesson of a place is in it.
  if (recipe.ownOnly && !report.inPlace.every(Boolean)) return no('the way steps to another die');
  if (recipe.combos !== undefined && (report.cleared.filter(Boolean).length !== recipe.combos || report.uses.includes('link'))) return no(`combos not ${recipe.combos}`);
  if (recipe.ride && !rides(board, way)) return no('no ride on the side');
  if (recipe.front && rideTurn(board, way) !== 'N') return no('the face that rides does not look at the player');
  if (recipe.seven && !startsUnder(board, way)) return no('the first die does not start with a working face at the bottom');
  if (recipe.far !== undefined && farOf(board, way) < recipe.far) return no(`the die of the first move is nearer than ${recipe.far} steps`);
  if (recipe.movers !== undefined && new Set(report.dice).size < recipe.movers) return no(`fewer dice moved than ${recipe.movers}`);
  const tail = tailOf(report.cleared);
  if (recipe.tail && !within(tail, recipe.tail)) {
    const turned = outside(near ? `tail ${tail}, not ${range(recipe.tail)}` : `tail not ${range(recipe.tail)}`);
    if (turned) return turned;
  }
  // The route of the way and its score: what the form of a place is known by.
  const score = scoreOf(board, way);
  const off = offRoute(recipe, score, report.cleared);
  if (off) return no(off);
  if (recipe.decoy && !decoyOf(board, way)) return no('no combo nearly made that goes as another face');
  const firsts = recipe.firsts ? firstsOf(board, par) : null;
  if (recipe.firsts && !within(firsts!, recipe.firsts)) {
    const turned = outside(near ? `first moves ${firsts}, not ${range(recipe.firsts)}` : `first moves not ${range(recipe.firsts)}`);
    if (turned) return turned;
  }
  const why = trapped();
  if (why) {
    const turned = outside(near ? `traps ${traps}, not ${range(recipe.traps!)}` : why);
    if (turned) return turned;
  }
  const random = randomRate(board, 100, par);
  if (recipe.random && !within(random, recipe.random)) {
    const turned = outside(near ? `random ${random}, not ${range(recipe.random)}` : `random not ${range(recipe.random)}`);
    if (turned) return turned;
  }
  // What takes a search of its own for every board: the parts of the route with no way round, the trap, the count of the faces.
  for (const part of recipe.parts ?? []) {
    const round = solveLevel(board, { ban: [part], maxMoves: par + 1, maxStates: Math.min(maxStates, PROOF_MAX_STATES) });
    if (round.solution) return no(`a way round ${part} within a move`);
    if (!round.exhausted) return no(`the way round ${part} is not settled`);
  }
  if (recipe.trap) {
    const trap = trapOf(board);
    if (trap === null) return no('no combo at hand that loses the board');
    if (recipe.trap === 'floor' && trap !== 'floor') return no('no combo at hand that leaves the player nowhere to step');
  }
  if (recipe.bothFaces && recipe.faces.some((face) => oneFaceClears(board, face, par + 2, Math.min(maxStates, PROOF_MAX_STATES)))) return no('one face clears the board alone');
  // The boards the player can come to are walked and solved from: dear, but dearer if the board were not turned away before.
  let walk: Walk | null = null;
  if (recipe.lossless || recipe.worst !== undefined) {
    const limit = recipe.walkLimit ?? WALK_LIMIT;
    // Once the answer is in, the rest of the walk is not made, unless the nearest board is looked for.
    walk = walkBoards(board, limit, near ? {} : { lost: recipe.lossless, worst: recipe.worst });
    if (recipe.lossless && walk.lost > 0) {
      const turned = outside(near ? `${walk.lost} boards the player can come to cannot be cleared` : 'a board the player can come to cannot be cleared');
      if (turned) return turned;
    }
    if (recipe.worst !== undefined && walk.worst > recipe.worst) {
      const turned = outside(near ? `${walk.worst} moves from a board the player can come to, not ${recipe.worst}` : `more than ${recipe.worst} moves from a board the player can come to`);
      if (turned) return turned;
    }
    if (walk.capped) {
      const turned = outside(`the walk over the boards is cut at ${limit}`);
      if (turned) return turned;
    }
  }
  // The players made of the rules are asked last: they are the dearest thing to ask.
  let shares: Partial<Record<PersonaName, number>> | null = null;
  if (recipe.personas) {
    shares = {};
    for (const name of PERSONA_NAMES) {
      const floor = recipe.personas[name];
      if (floor === undefined) continue;
      let cleared = 0;
      for (let run = 1; run <= PERSONA_FLOOR_RUNS; run++) if (personaPlay(board, name, run).endReason === 'passed') cleared++;
      const share = cleared / PERSONA_FLOOR_RUNS;
      shares[name] = share;
      if (share < floor - 1e-9) {
        const turned = outside(`${name} ${share.toFixed(2)} is under ${floor.toFixed(2)}`);
        if (turned) return turned;
      }
    }
  }
  let personas: Record<PersonaName, number> | null = null;
  if (recipe.hasty || recipe.casual || recipe.gap) {
    personas = personaRates(board, PERSONA_RUNS);
    const asked: [string, number, readonly [number, number] | undefined][] = [
      ['hasty', personas.hasty, recipe.hasty],
      ['casual', personas.casual, recipe.casual],
      ['gap', personas.planner - personas.hasty, recipe.gap],
    ];
    for (const [what, value, bound] of asked) {
      if (!bound || within(value, bound)) continue;
      const turned = outside(near ? `${what} ${value.toFixed(2)}, not ${range(bound)}` : `${what} not ${range(bound)}`);
      if (turned) return turned;
    }
  }

  const measured: Record<string, number> = { par, depth: report.depth, traps: traps!, random };
  let distance = 0;
  for (const { what, from, to } of boundsOf(recipe)) {
    // A bound with no width is met or not; one that is not met counts by how far outside it the board is.
    const half = to > from ? (to - from) / 2 : what === 'par' || what === 'depth' ? 1 : 0.1;
    if (to > from || measured[what] < from || measured[what] > to) distance += Math.abs(measured[what] - (from + to) / 2) / half;
  }
  const spec: LevelSpec = {
    ...board,
    par,
    exact,
    solution: way.map(moveText),
    ...(recipe.lesson ? { lesson: recipe.lesson } : {}),
  };
  return { seed, fit: { seed, spec, par, exact, short, depth: report.depth, uses: report.uses, needs, traps: traps!, random, tail, clears: report.cleared.filter(Boolean).length, route: score.route, kind: score.kind, firsts, personas, shares, walk, distance, misses }, why: '' };
}

/** What of the route and the score of a way is not what the place asks for: the first thing found, or null. */
function offRoute(recipe: Recipe, score: Score, cleared: readonly boolean[]): string | null {
  if (recipe.kinds && !recipe.kinds.includes(score.kind)) return `a route that is ${score.kind}`;
  if (recipe.route && !new RegExp(recipe.route).test(score.route)) return 'the route does not read as the place asks';
  if (recipe.quiet && !within(score.quiet, recipe.quiet)) return `quiet moves not ${range(recipe.quiet)}`;
  if (recipe.counted && !within(score.counted, recipe.counted)) return `moves under the count not ${range(recipe.counted)}`;
  if (recipe.last && !within(score.last, recipe.last)) return `the last event not of ${range(recipe.last)} dice`;
  if (recipe.links && !within(score.chain, recipe.links)) return `links not ${range(recipe.links)}`;
  if (recipe.silence !== undefined && silenceOf(cleared) > recipe.silence) return `a silence longer than ${recipe.silence}`;
  const { ends } = recipe;
  if (ends) {
    const last = score.beats[score.beats.length - 1];
    if (last.event !== ends.event) return `the way does not end with ${ends.event}`;
    if (ends.how && (last.how === 'push' ? 'push' : 'roll') !== ends.how) return `the way does not end with a ${ends.how}`;
    if (ends.spare !== undefined && last.spare !== ends.spare) return `the last link does not come with ${ends.spare} to spare`;
  }
  return null;
}

export interface Filled {
  recipe: Recipe;
  /** The boards that fit, the nearest to the middles of the bounds first. */
  fits: Fit[];
  /** Seeds tried, and for every reason how many candidates it turned away. */
  tried: number;
  reasons: Record<string, number>;
}

/** Puts the verdicts of a place together: the boards that fit in their order, and the reasons counted. */
export function gather(recipe: Recipe, verdicts: readonly Verdict[]): Filled {
  const reasons: Record<string, number> = {};
  const fits: Fit[] = [];
  for (const { fit, why } of verdicts) {
    if (fit) fits.push(fit);
    else reasons[why] = (reasons[why] ?? 0) + 1;
  }
  fits.sort((a, b) => a.misses.length - b.misses.length || Number(b.exact) - Number(a.exact) || a.distance - b.distance || a.seed - b.seed);
  return { recipe, fits, tried: verdicts.length, reasons };
}

/** Judges the seeds of a place from `from` to `to`. */
export function fill(recipe: Recipe, from: number, to: number, opts: JudgeOptions = {}, say?: (verdict: Verdict) => void): Verdict[] {
  const verdicts: Verdict[] = [];
  for (let seed = from; seed <= to; seed++) {
    const verdict = judge(recipe, seed, opts);
    verdicts.push(verdict);
    say?.(verdict);
  }
  return verdicts;
}

const percent = (share: number): string => `${Math.round(share * 100)}%`;

export function layOutRows(rows: readonly string[][]): string {
  const widths = rows[0].map((_, column) => Math.max(...rows.map((row) => row[column].length)));
  return rows.map((row) => row.map((cell, column) => cell.padEnd(widths[column])).join('  ').trimEnd()).join('\n');
}

export const MEASURE_HEAD: readonly string[] = ['place', 'board', 'dice', 'seed', 'moves', 'exact', 'depth', 'tail', 'route', 'kind', 'firsts', 'worst', 'lossless', 'uses', 'needs', 'traps', 'random', ...PERSONA_NAMES];

/** A board that fits, as a row of the table: what the solver says and how the yardsticks play it. */
export function measureRow(place: string, fit: Fit, skills?: Record<PersonaName, number>): string[] {
  const { spec } = fit;
  return [
    place,
    `${spec.size}x${spec.size}`,
    String(spec.norm),
    String(fit.seed),
    fit.short < fit.par ? `${fit.par} (${fit.short})` : String(fit.par),
    fit.exact ? 'yes' : 'no',
    String(fit.depth),
    String(fit.tail),
    fit.route || '-',
    fit.kind,
    fit.firsts === null ? '-' : String(fit.firsts),
    fit.walk ? String(fit.walk.worst) : '-',
    fit.walk ? (fit.walk.lost > 0 ? `no (${fit.walk.lost})` : fit.walk.capped ? 'cut' : 'yes') : '-',
    fit.uses.join(' ') || '-',
    fit.needs.join(' ') || '-',
    percent(fit.traps),
    percent(fit.random),
    ...PERSONA_NAMES.map((name) => (skills ?? fit.personas ? percent((skills ?? fit.personas)![name]) : '')),
  ];
}

/**
 * The table of a place: the board for the ladder and the two in reserve, each played by the five
 * players by skill, and under it what turned the other candidates away.
 */
export function placeReport(filled: Filled, keep = 3, skillRuns = 20, walkLimit = 0): string {
  const { recipe, fits, tried, reasons } = filled;
  const kept = fits.slice(0, keep);
  // The boards kept are walked for the table, where the place did not ask it: the boards that are asked have been.
  if (walkLimit > 0) for (const fit of kept) fit.walk ??= walkBoards(fit.spec, walkLimit);
  const rows = [[...MEASURE_HEAD], ...kept.map((fit, index) => measureRow(index === 0 ? `${recipe.slot}` : `${recipe.slot} spare`, fit, skillRuns > 0 ? personaRates(fit.spec, skillRuns) : undefined))];
  const turned = Object.entries(reasons)
    .sort((a, b) => b[1] - a[1])
    .map(([why, count]) => `${count} ${why}`)
    .join('; ');
  const whole = fits.filter((fit) => fit.misses.length === 0).length;
  const head = `place ${recipe.slot}: ${whole} of ${tried} seeds fit`;
  const outside = kept.filter((fit) => fit.misses.length > 0).map((fit) => `seed ${fit.seed} is outside the bounds: ${fit.misses.join('; ')}`);
  return [head, kept.length > 0 ? layOutRows(rows) : '', ...outside, turned ? `turned away: ${turned}` : ''].filter(Boolean).join('\n');
}

/** A level as it is written into the list of the ladder. */
export function levelSource(spec: LevelSpec): string {
  const { layout } = spec;
  const dice = layout!.dice.map((die) => `{ x: ${die.x}, z: ${die.z}, top: ${die.top}, north: ${die.north} }`).join(', ');
  const fields = [
    `id: '${spec.id}'`,
    ...(spec.chapter !== undefined ? [`chapter: ${spec.chapter}`] : []),
    `seed: ${spec.seed}`,
    `size: ${spec.size}`,
    ...(spec.holes ? [`holes: [${spec.holes.map((cell) => `{ x: ${cell.x}, z: ${cell.z} }`).join(', ')}]`] : []),
    `values: [${spec.values.join(', ')}]`,
    `norm: ${spec.norm}`,
    `arrival: 'none'`,
    `goal: { kind: 'clear' }`,
    `moves: 0`,
    ...(spec.faces ? [`faces: [${spec.faces.join(', ')}]`, `sinkMoves: ${spec.sinkMoves}`, `liftMoves: ${spec.liftMoves}`] : []),
    ...(spec.floor !== undefined ? [`floor: ${spec.floor}`] : []),
    ...(spec.guard ? [`guard: true`] : []),
    ...(spec.lesson ? [`lesson: '${spec.lesson}'`] : []),
    ...(spec.until ? [`until: '${spec.until}'`] : []),
    ...(spec.guide ? [`guide: true`] : []),
    ...(spec.story ? [`story: '${spec.story}'`] : []),
    `par: ${spec.par}`,
    `exact: ${spec.exact}`,
    `solution: [${spec.solution!.map((move) => `'${move}'`).join(', ')}]`,
    `layout: { start: { x: ${layout!.start.x}, z: ${layout!.start.z} }, dice: [${dice}] }`,
  ];
  return `  { ${fields.join(', ')} },`;
}

export { boardText };
