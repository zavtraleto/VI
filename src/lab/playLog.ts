import { levelDeadEnd, type LevelDeadEnd } from '../rules/level';
import type { RunState } from '../rules/types';

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
