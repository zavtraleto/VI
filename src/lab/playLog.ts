import { levelDeadEnd, type LevelDeadEnd } from '../rules/level';
import type { RunState } from '../rules/types';
import type { Verdict } from './workshopLists';

/**
 * A play of a board in the lab, as it is written down beside the board: which version of the
 * board it was, how it ended, in how many moves against the fewest, with how many moves taken
 * back, and how long it took. The plays of the owner are what the numbers of the bots are held
 * against: a persona is a stand-in until someone has played.
 */
export interface PlayRecord {
  id: string;
  /** The hash of the version of the board that was played. */
  hash: string;
  /** When the play ended, as ISO time. */
  at: string;
  /** `passed`: the board was cleared. `failed`: it was left at a dead end. `left`: it was left or started over while it could still be played. */
  result: 'passed' | 'failed' | 'left';
  moves: number;
  /** The fewest moves the board was known to be cleared in when it was played; null where they were not known. */
  par: number | null;
  undos: number;
  /** The dead end a play that failed was left at. */
  deadEnd: LevelDeadEnd | null;
  seconds: number;
  /** What the owner said of the play, each by a key and each left out where he said nothing. */
  rate?: Rate;
  /** Whether the board was what its order asked for: asked only of a board laid for an order. */
  asOrdered?: boolean;
  /** There was something new in it: the board did what he had not thought the rules would. */
  fresh?: boolean;
  /** He wanted another at once, which is not the same as liking this one. */
  more?: boolean;
  /** What he wrote of the board after the play, on the page of the library or of the workshop. */
  words?: string;
  /** What he said the board is after the play, on the page of the workshop: good, to be done again, or to be dropped. */
  verdict?: Verdict;
  /** The order the board was laid for, as its line; and what was known of the board when it was played. */
  order?: string;
  measures?: Record<string, number>;
}

/** What a board is to the one who played it: fire, all right, or a miss. */
export type Rate = 'fire' | 'ok' | 'miss';

/** An answer given after its play was written down: the play is named by when it ended, and the answer is laid over it when the plays are read. */
export interface PlayPatch {
  at: string;
  patch: Pick<PlayRecord, 'rate' | 'asOrdered' | 'fresh' | 'more' | 'words' | 'verdict'>;
}

/**
 * The plays of a board as they are read from its file: a line is a play, or an answer to one
 * given later, and the answers are laid over their plays in the order they were given. An
 * answer to a play that is not there is dropped.
 */
export function mergePlays(lines: readonly (PlayRecord | PlayPatch)[]): PlayRecord[] {
  const plays: PlayRecord[] = [];
  for (const line of lines) {
    // A line that is no play and no answer, torn or written by hand, is passed over.
    if (line === null || typeof line !== 'object') continue;
    if ('patch' in line) {
      const at = plays.findIndex((play) => play.at === line.at);
      if (at >= 0) plays[at] = { ...plays[at], ...line.patch };
    } else plays.push({ ...line });
  }
  return plays;
}

/** Where a measure lies among the plays of one rate: how many, the least, the middle and the most. */
export interface Spread {
  plays: number;
  least: number;
  middle: number;
  most: number;
}

/**
 * What the answers come to. By measure: where the boards called fire lie and where those called
 * a miss, side by side. By preset: of the plays of its boards that were asked whether the board
 * was what was ordered, how many said yes. It is a comparison and no model: with dozens of
 * answers nothing more would be honest.
 */
export interface Ratings {
  rated: number;
  byMeasure: Record<string, Partial<Record<Rate, Spread>>>;
  byPreset: Record<string, { plays: number; asked: number; yes: number; fire: number; more: number; fresh: number }>;
}

const spreadOf = (values: number[]): Spread => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length % 2 === 1 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  return { plays: sorted.length, least: sorted[0], middle: mid, most: sorted[sorted.length - 1] };
};

export function ratingsOf(records: readonly PlayRecord[]): Ratings {
  const byMeasure: Ratings['byMeasure'] = {};
  const byPreset: Ratings['byPreset'] = {};
  const rated = records.filter((record) => record.rate !== undefined);
  const gathered: Record<string, Partial<Record<Rate, number[]>>> = {};
  for (const record of rated) {
    const measures: Record<string, number> = { ...record.measures, moves: record.moves, undos: record.undos, seconds: record.seconds, ...(record.par !== null ? { par: record.par, over: record.moves - record.par } : {}) };
    for (const [name, value] of Object.entries(measures)) ((gathered[name] ??= {})[record.rate!] ??= []).push(value);
  }
  for (const [name, rates] of Object.entries(gathered)) {
    byMeasure[name] = Object.fromEntries(Object.entries(rates).map(([rate, values]) => [rate, spreadOf(values!)]));
  }
  for (const record of records) {
    const preset = /(?:^|\s)(?:as|preset)=(\S+)/.exec(record.order ?? '')?.[1];
    if (!preset) continue;
    const kept = (byPreset[preset] ??= { plays: 0, asked: 0, yes: 0, fire: 0, more: 0, fresh: 0 });
    kept.plays++;
    if (record.asOrdered !== undefined) kept.asked++;
    if (record.asOrdered) kept.yes++;
    if (record.rate === 'fire') kept.fire++;
    if (record.more) kept.more++;
    if (record.fresh) kept.fresh++;
  }
  return { rated: rated.length, byMeasure, byPreset };
}

/** The ratings as text: a row to a measure with fire and miss side by side, and a row to a preset. */
export function ratingsText(ratings: Ratings): string {
  if (ratings.rated === 0) return 'оценок пока нет: после партии — 1 огонь, 2 норм, 3 мимо';
  const cell = (spread?: Spread): string => (spread ? `${spread.least}…${spread.middle}…${spread.most} (${spread.plays})` : '—');
  const lines = [`оценённых партий: ${ratings.rated}`, '', `${'мера'.padEnd(10)}${'огонь'.padEnd(18)}${'норм'.padEnd(18)}мимо`];
  for (const [name, rates] of Object.entries(ratings.byMeasure).sort(([a], [b]) => a.localeCompare(b))) lines.push(`${name.padEnd(10)}${cell(rates.fire).padEnd(18)}${cell(rates.ok).padEnd(18)}${cell(rates.miss)}`);
  lines.push('', 'мера: от…медиана…до (партий)');
  const presets = Object.entries(ratings.byPreset);
  if (presets.length > 0) {
    lines.push('', `${'заготовка'.padEnd(12)}партий  то, что заказано  огонь  ещё  новое`);
    for (const [key, kept] of presets) lines.push(`${key.padEnd(12)}${String(kept.plays).padEnd(8)}${`${kept.yes} из ${kept.asked}`.padEnd(18)}${String(kept.fire).padEnd(7)}${String(kept.more).padEnd(5)}${kept.fresh}`);
  }
  return lines.join('\n');
}

/** What a play came to: `state` is the run as it was left, `startedAt` and `now` are times in milliseconds, `now` on the clock of the day. */
export function playRecordOf(state: RunState, startedAt: number, now: number, undos: number, of: { hash: string; par: number | null }): PlayRecord {
  const run = state.levelRun;
  if (!run) throw new Error('playRecordOf: not a level');
  const passed = state.endReason === 'passed';
  const deadEnd = passed ? null : levelDeadEnd(state);
  return {
    id: run.spec.id,
    hash: of.hash,
    at: new Date(now).toISOString(),
    result: passed ? 'passed' : state.over || deadEnd !== null ? 'failed' : 'left',
    moves: run.moves,
    par: of.par,
    undos,
    deadEnd,
    seconds: Math.round((now - startedAt) / 100) / 10,
  };
}

/** The plays of one version of a board in three numbers: how many, how many of them cleared it, and the middle number of moves over the fewest among those that did. */
export interface VersionSummary {
  plays: number;
  passed: number;
  /** Null where no play that cleared the board knew its fewest moves. */
  overMedian: number | null;
}

export function versionSummary(records: readonly PlayRecord[]): VersionSummary {
  const over = records
    .filter((record) => record.result === 'passed' && record.par !== null)
    .map((record) => record.moves - record.par!)
    .sort((a, b) => a - b);
  const middle = over.length === 0 ? null : over.length % 2 === 1 ? over[(over.length - 1) / 2] : (over[over.length / 2 - 1] + over[over.length / 2]) / 2;
  return { plays: records.length, passed: records.filter((record) => record.result === 'passed').length, overMedian: middle };
}
