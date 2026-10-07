import { ENDINGS, PERSONA_NAMES, WALKERS, WALKER_NAMES, personaFacts, randomRate, walkFacts, type PersonaFacts, type PersonaName, type WalkFacts, type WalkerName } from './levelBot';
import { factsOf, graphOf, type GraphFacts } from './levelGraph';
import { bypassesOf, neededBy, type Bypass } from './levelProof';
import { scoreOf, type Score } from './levelScore';
import { SOLVER_MAX_STATES, moveOf, moveText, solveLevel, tryWay, type SolverMove } from './levelSolver';
import type { LevelSpec, Technique } from './types';

/**
 * Everything the players of a level say of a board, in one place: what a board is asked when
 * it is made or picked. The solver for its way, the score for what the way is like, the ban of
 * a part of the route for what the board makes its player do and for the ways round it, the
 * graph for what lies about the way, the walker and the personas for how it plays.
 */
export interface LevelReport {
  /** Fewest moves known, whether proved the fewest, and the way; null when no way is known. */
  par: number | null;
  exact: boolean;
  way: SolverMove[] | null;
  score: Score | null;
  uses: Technique[];
  /** Techniques no way within three moves of the fewest does without. */
  needs: Technique[];
  /** For every part of the route the way leans on, the way round it within a move, if there is one. */
  bypasses: Bypass[];
  /** The boards within two moves over the fewest; null where they are too many to see. */
  graph: GraphFacts | null;
  walk: Record<WalkerName, WalkFacts> | null;
  /** Share of the runs of the greedy player that end at a dead end, and of the random one that clear the board. */
  traps: number;
  random: number;
  personas: Record<PersonaName | 'greedy', PersonaFacts>;
}

/** Moves over the fewest the graph of a report goes out to: a way a move longer is still three stars, and a walker needs a little room past it. */
const GRAPH_OVER = 2;
/** Boards the graph of a report may hold, and boards a search for a way round may see: a big board is left unsaid rather than waited for. */
const GRAPH_MAX_STATES = 60_000;
const PROOF_MAX_STATES = 150_000;
/** Runs of the walker in a report. */
const WALKS = 300;

export const REPORT_PLAYERS: readonly (PersonaName | 'greedy')[] = ['greedy', ...PERSONA_NAMES];

/**
 * Reports on a board. A level that keeps its way is taken at its word and the way is played
 * again; any other is solved. `runs` is the runs of every player that plans.
 */
export function report(spec: LevelSpec, opts: { maxStates?: number; runs?: number; graphStates?: number; proofStates?: number } = {}): LevelReport {
  const { maxStates = SOLVER_MAX_STATES, runs = 20, graphStates = GRAPH_MAX_STATES, proofStates = PROOF_MAX_STATES } = opts;
  let way: SolverMove[] | null = null;
  let exact = false;
  if (spec.solution) {
    way = spec.solution.map(moveOf);
    exact = spec.exact ?? false;
  } else {
    const solved = solveLevel(spec, { maxStates });
    way = solved.solution?.moves ?? null;
    exact = solved.solution !== null;
  }
  const told = way ? tryWay(spec, way) : null;
  if (!way || !told || told.state.endReason !== 'passed') {
    const personas = Object.fromEntries(REPORT_PLAYERS.map((name) => [name, personaFacts(spec, name, runs)])) as LevelReport['personas'];
    return { par: null, exact: false, way: null, score: null, uses: [], needs: [], bypasses: [], graph: null, walk: null, traps: trapsOf(personas.greedy), random: randomRate(spec, 100, 0), personas };
  }
  const par = way.length;
  // The players are held to the way of the report, whether the level kept one or not.
  const kept: LevelSpec = { ...spec, par, solution: way.map(moveText) };
  const graph = graphOf(spec, { depth: par + GRAPH_OVER, maxStates: graphStates });
  const facts = factsOf(graph);
  const walk = facts ? (Object.fromEntries(WALKER_NAMES.map((name) => [name, walkFacts(graph, WALKERS[name], { runs: WALKS })])) as Record<WalkerName, WalkFacts | null>) : null;
  const personas = Object.fromEntries(REPORT_PLAYERS.map((name) => [name, personaFacts(kept, name, runs)])) as LevelReport['personas'];
  return {
    par,
    exact,
    way,
    score: scoreOf(spec, way),
    uses: told.uses,
    needs: neededBy(spec, par, told.uses, proofStates),
    bypasses: bypassesOf(spec, way, { maxStates: proofStates }),
    graph: facts,
    walk: walk && WALKER_NAMES.every((name) => walk[name] !== null) ? (walk as Record<WalkerName, WalkFacts>) : null,
    traps: trapsOf(personas.greedy),
    random: randomRate(spec, 100, par),
    personas,
  };
}

const trapsOf = (greedy: PersonaFacts): number => greedy.endings.count + greedy.endings.floor;

const percent = (share: number): string => `${Math.round(share * 100)}%`;

export const REPORT_HEAD: readonly string[] = [
  'level', 'board', 'dice', 'faces', 'moves', 'route', 'kind', 'quiet', 'pause', 'tail', 'last', 'ways', 'alive', 'lost in', 'needs', 'round', 'traps', 'random',
  ...REPORT_PLAYERS.map((name) => `${name} p/c/f/l`), 'match', 'same kind', 'walk', 'again', 'first',
];

/**
 * A report as a row of a table. `needs` are the parts of the route with no way round within a
 * move, `round` those with one. For every player the shares of its runs that pass, end by the
 * count, end on the floor, and run out of moves; `match` is the share of the planner's passes
 * that go the route of the way sign for sign, `same kind` the share whose route is of its kind.
 * The last three are the walker's: moves to clear the board,
 * times it began again, and the share cleared at the first go.
 */
export function reportRow(spec: LevelSpec, told: LevelReport): string[] {
  const { score, graph, walk, personas } = told;
  const settled = told.bypasses.filter((bypass) => bypass.way === null && bypass.settled).map((bypass) => bypass.part);
  const round = told.bypasses.filter((bypass) => bypass.way !== null).map((bypass) => `${bypass.part}+${bypass.way!.length - (told.par ?? 0)}`);
  const unsettled = told.bypasses.filter((bypass) => bypass.way === null && !bypass.settled).map((bypass) => `${bypass.part}?`);
  const { match, sameKind } = personas.planner;
  return [
    spec.id,
    `${spec.size}x${spec.size}`,
    String(spec.norm),
    (spec.faces ?? spec.values).join(''),
    told.par === null ? '-' : `${told.par}${told.exact ? '' : '?'}`,
    score?.route ?? '-',
    score?.kind ?? '-',
    score ? String(score.quiet) : '-',
    score ? String(score.pause) : '-',
    score ? String(score.tail) : '-',
    score ? String(score.last) : '-',
    graph ? (graph.ways >= 1000 ? '999+' : String(graph.ways)) : '-',
    graph ? percent(graph.alive) : '-',
    graph ? (graph.lostIn < 0 ? 'never' : String(graph.lostIn)) : '-',
    [...settled, ...unsettled].join(' ') || '-',
    round.join(' ') || '-',
    percent(told.traps),
    percent(told.random),
    ...REPORT_PLAYERS.map((name) => ENDINGS.map((ending) => Math.round(personas[name].endings[ending] * 100)).join('/')),
    match === null ? '-' : percent(match),
    sameKind === null ? '-' : percent(sameKind),
    walk ? walk.walker.moves.toFixed(1) : '-',
    walk ? walk.walker.restarts.toFixed(1) : '-',
    walk ? percent(walk.walker.first) : '-',
  ];
}

/** Rows of text laid out in columns. */
export function layOut(rows: readonly (readonly string[])[]): string {
  const widths = rows[0].map((_, column) => Math.max(...rows.map((row) => row[column].length)));
  return rows.map((row) => row.map((cell, column) => cell.padEnd(widths[column])).join('  ').trimEnd()).join('\n');
}

/** The score of a way as a table: a row to a move. */
export function scoreText(score: Score): string {
  const rows: string[][] = [['move', 'how', 'from', 'floor', 'event', 'face', 'took', 'standing', 'leaving', 'spare']];
  score.beats.forEach((beat, index) => {
    const floor = [beat.down === 'fell' ? 'fell' : beat.down === 'stepped' ? 'down' : '', beat.up ? 'up' : '', beat.bridged ? 'bridge' : ''].filter(Boolean).join(' ');
    rows.push([
      `${index + 1}. ${moveText(beat.move)}`,
      beat.how,
      beat.from,
      floor || '-',
      beat.event === 'none' ? '-' : beat.event,
      beat.face > 0 ? String(beat.face) : '-',
      beat.took > 0 ? String(beat.took) : '-',
      String(beat.standing),
      String(beat.leaving),
      beat.spare === null ? '-' : String(beat.spare),
    ]);
  });
  return layOut(rows);
}
