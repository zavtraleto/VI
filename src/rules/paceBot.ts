import { RUSH, SKILL_NAMES, STYLE_NAMES, botCommand, createBot, skillOf, styled, type HandsName, type SkillName, type StyleName } from './bot';
import { defaultConfig } from './config';
import { createRun, step } from './sim';
import { chainQuiet } from './spawn';
import type { ExperimentConfig, RunState, Tuning } from './types';

/**
 * What a pace does to a player, without a person playing it: the player of `bot.ts` plays a
 * run from its first tick to its end with the commands of the game, at one of five strengths,
 * from one who has just been shown the rules to one who plays for a living. It is a model,
 * not a person: it is there to compare one pace with another and to see where a kind of
 * player starts to lose the board.
 *
 * Run it with `node scripts/pace.mjs`.
 */
export interface PaceRun {
  skill: SkillName;
  /** The head and the hands of the player, its style, and whether anybody played at all. */
  head: SkillName;
  hands: HandsName;
  style: StyleName;
  nobody: boolean;
  timed: boolean;
  seed: number;
  seconds: number;
  level: number;
  /** Why the run ended; null when it outlasted the time given to the trial. */
  endReason: RunState['endReason'];
  score: number;
  removed: number;
  /** Cubes removed in a minute of the run. */
  perMinute: number;
  /** Clears made, how many of them added a link to a chain, and the longest chain. */
  clears: number;
  chains: number;
  maxChain: number;
  /** Seconds to the first clear, or null when there was none. */
  firstClear: number | null;
  /** Steps made and steps the board refused. */
  steps: number;
  blocked: number;
  /** Times the cube went from under the player, and the share of the run spent on the floor. */
  falls: number;
  floorShare: number;
  /** When the board first came to the danger mark: from there the player is losing ground. */
  dangerAt: { seconds: number; level: number } | null;
  /** Seconds with the board at the danger mark, and the most cubes it held. */
  dangerSeconds: number;
  peakCubes: number;
  /** Share of the run in the silence chains held, and the longest such silence in seconds. */
  quietShare: number;
  longestQuiet: number;
  /** Times the board came back from the danger mark to well under it: the player got out. */
  escapes: number;
  /** The longest the player went without a clear, in seconds. */
  drought: number;
  /** Times a clear left no die standing. */
  wipes: number;
  /**
   * Where the run was spent, by how full the board was: `calm` with fewer cubes than the board
   * is kept at, nothing pressing; `tense` with the board close to the danger mark; the rest is
   * the stretch in between, where there is something to do and room to do it.
   */
  calmShare: number;
  tenseShare: number;
  /** Things to remember in a minute of the run: a chain of three links or more, a Happy One, a clean board, a way out of danger. */
  highlights: number;
  /**
   * How much the board swings with the waves, in cubes: how many more it holds at the crest of
   * a wave than at its emptiest in the rest and the slow start that follow, on average. What
   * the waves do to the board, and not only to the flow.
   */
  swing: number;
}

/** Cubes short of the danger mark from which the board counts as tense. */
const TENSE_MARGIN = 7;
/** Ticks after a wave breaks by which the cubes of its crest stand on the board. */
const CREST_LANDS_TICKS = 250;
/** Cubes under the danger mark at which a board that was in danger counts as out of it. */
const ESCAPE_MARGIN = 5;

export interface PaceOptions {
  skill: SkillName;
  /** The head and the hands of the player, when they are not those of `skill`. */
  head?: SkillName;
  hands?: HandsName;
  /** What the player is after. */
  style?: StyleName;
  /** The player slips and overlooks more as the board fills: the rush of its hands. */
  rush?: boolean;
  /** Nobody plays: what the pace does to a board left alone. */
  nobody?: boolean;
  timed?: boolean;
  seed?: number;
  /** The trial gives up on a run that lasts this long. */
  limitMinutes?: number;
  experiments?: Partial<ExperimentConfig>;
  tuning?: Partial<Tuning>;
}

export function playPace(opts: PaceOptions): PaceRun {
  const { skill, timed = false, seed = 1, limitMinutes = 30 } = opts;
  const config = defaultConfig(opts.experiments, opts.tuning);
  const state = createRun({ seed, config, timed });
  const head = opts.head ?? skill;
  const hands = opts.hands ?? skill;
  const style = opts.style ?? 'plain';
  const nobody = opts.nobody ?? false;
  const base = skillOf(head, hands);
  const bot = styled(createBot(opts.rush && hands !== 'instant' ? { ...base, rush: RUSH[hands] } : base, seed), style);
  const limit = Math.round((limitMinutes * 60000) / config.tickMs);
  const seconds = (ticks: number) => (ticks * config.tickMs) / 1000;
  let peakCubes = state.cubes.length;
  let chains = 0;
  let quietTicks = 0;
  let escapes = 0;
  let calmTicks = 0;
  let tenseTicks = 0;
  let highlights = 0;
  // The crest in hand: the wave it closed, the most cubes the board held as it broke, and the fewest since.
  let crest: { index: number; at: number; cubes: number; low: number } | null = null;
  const swings: number[] = [];
  let inDanger = false;
  let drought = 0;
  let lastClear = 0;
  let clears = 0;
  let dangerAt: PaceRun['dangerAt'] = null;
  while (!state.over && state.tick < limit) {
    step(state, nobody ? null : botCommand(bot, state));
    for (const event of state.events) {
      if (event.type === 'chain') chains++;
      if ((event.type === 'chain' && event.chain >= 3) || event.type === 'happyOne' || event.type === 'wiped') highlights++;
    }
    if (state.cubes.length < config.targetCubes) calmTicks++;
    else if (state.cubes.length >= config.warnOccupied - TENSE_MARGIN) tenseTicks++;
    if (chainQuiet(state)) quietTicks++;
    peakCubes = Math.max(peakCubes, state.cubes.length);
    if (state.cubes.length >= config.warnOccupied) {
      dangerAt ??= { seconds: seconds(state.tick), level: state.level };
      inDanger = true;
    } else if (inDanger && state.cubes.length <= config.warnOccupied - ESCAPE_MARGIN) {
      inDanger = false;
      escapes++;
      highlights++;
    }
    const { wave } = state;
    if (state.tick === wave.start + wave.build) crest = { index: wave.index, at: state.tick, cubes: state.cubes.length, low: state.cubes.length };
    if (crest) {
      // What the crest sends is on the board a few seconds after it: a warning, then the rise.
      if (state.tick - crest.at <= CREST_LANDS_TICKS) {
        crest.cubes = Math.max(crest.cubes, state.cubes.length);
        crest.low = crest.cubes;
      }
      crest.low = Math.min(crest.low, state.cubes.length);
      // The trough is over a quarter of the way into the next wave.
      if (wave.index > crest.index && state.tick >= wave.start + wave.build / 4) {
        swings.push(crest.cubes - crest.low);
        crest = null;
      }
    }
    if (state.stats.clears !== clears) {
      clears = state.stats.clears;
      lastClear = state.tick;
    }
    drought = Math.max(drought, state.tick - lastClear);
  }
  const { stats } = state;
  return {
    skill,
    head,
    hands,
    style,
    nobody,
    timed,
    seed,
    seconds: seconds(state.tick),
    level: state.level,
    endReason: state.endReason,
    score: state.score,
    removed: state.removed,
    perMinute: state.tick > 0 ? (state.removed * 60) / seconds(state.tick) : 0,
    clears: stats.clears,
    chains,
    maxChain: state.maxChain,
    firstClear: stats.clearTicks.length > 0 ? seconds(stats.clearTicks[0]) : null,
    steps: stats.steps,
    blocked: stats.blockedSteps,
    falls: stats.falls,
    floorShare: state.tick > 0 ? stats.groundTicks / state.tick : 0,
    dangerAt,
    dangerSeconds: seconds(stats.dangerTicks),
    peakCubes,
    quietShare: state.tick > 0 ? quietTicks / state.tick : 0,
    longestQuiet: seconds(stats.longestChainQuiet),
    escapes,
    drought: seconds(drought),
    wipes: stats.wipes,
    calmShare: state.tick > 0 ? calmTicks / state.tick : 0,
    tenseShare: state.tick > 0 ? tenseTicks / state.tick : 0,
    highlights: state.tick > 0 ? (highlights * 60) / seconds(state.tick) : 0,
    swing: swings.length > 0 ? swings.reduce((sum, value) => sum + value, 0) / swings.length : 0,
  };
}

function clock(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

const END: Record<string, string> = { full: 'board full', time: 'clock ran out', cleared: 'cleared' };

/** The shares of a run spent calm, in between and tense, as text. */
function shares(calm: number, tense: number): string {
  const percent = (share: number) => Math.round(share * 100);
  return `${percent(calm)}/${100 - percent(calm) - percent(tense)}/${percent(tense)}%`;
}

/** The middle one of a list of numbers. */
function middle(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * The table of the pace, as text: for each of the five players, how long a run lasts, what
 * level it gets to and how it went. Every player plays several seeds; a row gives
 * the middle value of each column, and the shortest and the longest run beside the time.
 */
export function paceTable(
  opts: Omit<PaceOptions, 'skill' | 'seed' | 'timed'> & { skills?: SkillName[]; seeds?: number[]; modes?: boolean[] } = {},
): string {
  const { skills = SKILL_NAMES, seeds = [1, 2, 3, 4, 5], modes = [false, true], ...rest } = opts;
  const head = ['mode', 'player', 'time', 'shortest-longest', 'end', 'cubes/min', 'score', 'best chain', 'first clear', 'drought', 'calm/flow/tense', 'highlights/min', 'at the edge', 'escapes', 'wipes', 'wave swing'];
  const rows: string[][] = [head];
  for (const timed of modes) {
    for (const skill of skills) {
      const runs = seeds.map((seed) => playPace({ ...rest, skill, timed, seed }));
      const of = (read: (run: PaceRun) => number) => middle(runs.map(read));
      const times = runs.map((run) => run.seconds);
      const ends = runs.filter((run) => run.endReason === 'full').length;
      const first = runs.map((run) => run.firstClear).filter((value): value is number => value !== null);
      const unfinished = runs.filter((run) => run.endReason === null).length;
      rows.push([
        timed ? 'timed' : 'endless',
        skill,
        clock(middle(times)),
        `${clock(Math.min(...times))}-${clock(Math.max(...times))}`,
        unfinished > 0 ? `${unfinished} of ${runs.length} not over in ${rest.limitMinutes ?? 30} min` : `${END.full} ${ends} of ${runs.length}`,
        of((run) => run.perMinute).toFixed(1),
        String(of((run) => run.score)),
        `x${of((run) => run.maxChain)}`,
        first.length > 0 ? `${middle(first).toFixed(0)} s` : 'none',
        `${of((run) => run.drought).toFixed(0)} s`,
        shares(of((run) => run.calmShare), of((run) => run.tenseShare)),
        of((run) => run.highlights).toFixed(1),
        `${of((run) => run.dangerSeconds).toFixed(0)} s`,
        String(of((run) => run.escapes)),
        String(runs.reduce((sum, run) => sum + run.wipes, 0)),
        `${of((run) => run.swing).toFixed(1)} cubes`,
      ]);
    }
  }
  return layOut(rows);
}

/** Rows of text laid out in columns. */
function layOut(rows: readonly string[][]): string {
  const widths = rows[0].map((_, column) => Math.max(...rows.map((row) => row[column].length)));
  return rows.map((row) => row.map((cell, column) => cell.padEnd(widths[column])).join('  ').trimEnd()).join('\n');
}

type TableOptions = Omit<PaceOptions, 'skill' | 'seed' | 'head' | 'hands' | 'style' | 'nobody'> & { seeds?: number[] };
const SEEDS = [1, 2, 3, 4, 5];

/**
 * Who is still playing: for every minute, the share of the runs that outlast it, and of those
 * that came into it the share lost in it. A run the trial gave up on counts as playing on.
 */
export function survival(runs: readonly PaceRun[], minutes: number): { minute: number; alive: number; died: number }[] {
  const lastsTo = (run: PaceRun) => (run.endReason === null ? Infinity : run.seconds);
  return Array.from({ length: minutes }, (_, index) => {
    const came = runs.filter((run) => lastsTo(run) >= index * 60).length;
    const stayed = runs.filter((run) => lastsTo(run) >= (index + 1) * 60).length;
    return { minute: index + 1, alive: runs.length > 0 ? stayed / runs.length : 0, died: came > 0 ? (came - stayed) / came : 0 };
  });
}

/** Heads against hands: for every pair, how long the middle run lasts and what it scores. */
export function paceGrid(opts: TableOptions & { heads?: SkillName[]; hands?: HandsName[] } = {}): string {
  const { heads = SKILL_NAMES, hands = [...SKILL_NAMES, 'instant'], seeds = SEEDS, ...rest } = opts;
  const rows: string[][] = [['head \\ hands', ...hands]];
  for (const head of heads) {
    rows.push([
      head,
      ...hands.map((pair) => {
        const runs = seeds.map((seed) => playPace({ ...rest, skill: head, hands: pair, seed }));
        return `${clock(middle(runs.map((run) => run.seconds)))} ${middle(runs.map((run) => run.score))}`;
      }),
    ]);
  }
  return layOut(rows);
}

/** The styles side by side: what each makes of a run, and what a builder scores to a survivor. */
export function paceStyles(opts: TableOptions & { skills?: SkillName[]; styles?: StyleName[] } = {}): string {
  const { skills = SKILL_NAMES, styles = STYLE_NAMES, seeds = SEEDS, ...rest } = opts;
  const rows: string[][] = [['player', 'style', 'time', 'score', 'links', 'best chain', 'most cubes', 'builder to survivor']];
  for (const skill of skills) {
    const played = new Map(styles.map((style) => [style, seeds.map((seed) => playPace({ ...rest, skill, style, seed }))]));
    const score = (style: StyleName) => middle((played.get(style) ?? []).map((run) => run.score));
    const ratio = played.has('builder') && played.has('survivor') && score('survivor') > 0 ? (score('builder') / score('survivor')).toFixed(2) : '-';
    for (const style of styles) {
      const runs = played.get(style)!;
      const of = (read: (run: PaceRun) => number) => middle(runs.map(read));
      rows.push([skill, style, clock(of((run) => run.seconds)), String(of((run) => run.score)), String(of((run) => run.chains)), `x${of((run) => run.maxChain)}`, String(of((run) => run.peakCubes)), style === 'builder' ? ratio : '']);
    }
  }
  return layOut(rows);
}

/** The share of the runs of every player that are still going at each minute. */
export function survivalTable(opts: TableOptions & { skills?: SkillName[]; minutes?: number } = {}): string {
  const { skills = SKILL_NAMES, seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], minutes = 10, ...rest } = opts;
  const limitMinutes = rest.limitMinutes ?? minutes;
  const rows: string[][] = [['player', ...Array.from({ length: minutes }, (_, index) => `${index + 1} min`)]];
  for (const skill of skills) {
    const runs = seeds.map((seed) => playPace({ ...rest, limitMinutes, skill, seed }));
    rows.push([skill, ...survival(runs, minutes).map((minute) => `${Math.round(minute.alive * 100)}%`)]);
  }
  return layOut(rows);
}

/** The edges: a board nobody plays, and a player with the best head and hands that take no time. */
export function paceEdges(opts: TableOptions = {}): string {
  const { seeds = SEEDS, ...rest } = opts;
  const rows: string[][] = [['player', 'time', 'shortest-longest', 'cubes/min', 'score', 'best chain', 'most cubes']];
  const edges: [string, Partial<PaceOptions>][] = [
    ['nobody', { nobody: true }],
    ['ceiling', { hands: 'instant' }],
  ];
  for (const [name, edge] of edges) {
    const runs = seeds.map((seed) => playPace({ ...rest, ...edge, skill: 'esports', seed }));
    const of = (read: (run: PaceRun) => number) => middle(runs.map(read));
    const times = runs.map((run) => run.seconds);
    rows.push([name, clock(middle(times)), `${clock(Math.min(...times))}-${clock(Math.max(...times))}`, of((run) => run.perMinute).toFixed(1), String(of((run) => run.score)), `x${of((run) => run.maxChain)}`, String(of((run) => run.peakCubes))]);
  }
  return layOut(rows);
}
