import { describe, expect, it } from 'vitest';
import { PROBE_LEVELS } from '../levels/levels';
import { SKILLS, botCommand, createBot } from './bot';
import { defaultConfig } from './config';
import { goalBot, levelTable, limitFor, percentile, pickSeed, playLevel, trySeed, type SeedTrial } from './levelBot';
import { createRun, step } from './sim';
import type { LevelSpec } from './types';

const byId = (id: string): LevelSpec => PROBE_LEVELS.find((level) => level.id === id)!;
const SEND: LevelSpec = { id: 'send', seed: 3, size: 5, values: [2, 3], norm: 8, arrival: 'refill', goal: { kind: 'send', count: 6 }, moves: 0 };

describe('a player of the rules on a level', () => {
  it('plays one and the same run for one level and one seed of its own', () => {
    expect(playLevel(SEND, 'novice', 3)).toEqual(playLevel(SEND, 'novice', 3));
  });

  it('meets a plain goal and says in how many moves', () => {
    const play = playLevel(SEND, 'average', 1);
    expect(play).toMatchObject({ skill: 'average', botSeed: 1, reached: true });
    expect(play.moves).toBeGreaterThan(0);
    expect(play.steps).toBeGreaterThanOrEqual(play.moves);
  });

  it('plays with no limit of moves, whatever the level gives', () => {
    expect(playLevel({ ...SEND, moves: 1 }, 'average', 1)).toEqual(playLevel(SEND, 'average', 1));
  });

  it('gives up after the moves the trial allows', () => {
    const play = playLevel({ ...SEND, goal: { kind: 'send', count: 9999 } }, 'pro', 1, 12);
    expect(play.reached).toBe(false);
    expect(play.moves).toBe(12);
  });

  it('says how many dice it left standing on a board to be cleared', () => {
    const play = playLevel(byId('c1'), 'newbie', 1, 3);
    expect(play.left).toBeGreaterThan(0);
    expect(play.left).toBeLessThanOrEqual(6);
  });
});

describe('a player who knows what the level asks for', () => {
  it('plays as any other player where any clear will do', () => {
    const plain = createBot(SKILLS.average, 5);
    expect(goalBot(SEND, 'average', 5)).toEqual(plain);
    expect(goalBot(byId('c1'), 'average', 5)).toEqual(plain);
  });

  it('takes the faces an order still asks for, and turns them up when there is nothing to clear', () => {
    const spec: LevelSpec = { ...SEND, goal: { kind: 'order', items: [{ value: 3, count: 3 }] } };
    const bot = goalBot(spec, 'average', 1);
    const state = createRun({ seed: spec.seed, config: defaultConfig(), level: spec });
    const plan = (value: number) => ({ moves: [], kinds: [], points: 6, chain: 1, value });
    expect(bot.prefer!(plan(3), state)).toBe(1);
    expect(Number(bot.prefer!(plan(2), state))).toBeLessThan(1);
    expect(bot.wants!(3, state)).toBe(true);
    expect(bot.wants!(2, state)).toBe(false);
    // Once the order is served the face is as good as any other.
    state.levelRun!.sent = [0, 0, 3, 0, 0, 0];
    expect(bot.wants!(3, state)).toBe(false);
  });

  it('goes on with the group that is open when a chain is asked for', () => {
    const spec: LevelSpec = { ...SEND, goal: { kind: 'chain', links: 4 } };
    const bot = goalBot(spec, 'average', 1);
    const state = createRun({ seed: spec.seed, config: defaultConfig(), level: spec });
    const plan = (chain: number) => ({ moves: [], kinds: [], points: 6, chain, value: 2 });
    // With no group open any group opens one.
    expect(bot.prefer!(plan(1), state)).toBe(1);
    state.reactions.push({ id: 1, value: 2, chain: 1, total: 2 });
    expect(bot.prefer!(plan(2), state)).toBe(1);
    expect(Number(bot.prefer!(plan(1), state))).toBeLessThan(1);
  });

  it('serves an order in fewer moves than a player who does not know of it', () => {
    const spec: LevelSpec = { ...SEND, values: [2, 3, 4], goal: { kind: 'order', items: [{ value: 3, count: 6 }] } };
    const moves = (aware: boolean): number => {
      let total = 0;
      for (let botSeed = 1; botSeed <= 4; botSeed++) {
        const state = createRun({ seed: spec.seed, config: defaultConfig(), level: { ...spec, moves: 0 } });
        const bot = aware ? goalBot(spec, 'average', botSeed) : createBot(SKILLS.average, botSeed);
        for (let calls = 0; calls < 60_000 && !state.over && state.levelRun!.moves < 100; calls++) step(state, botCommand(bot, state));
        total += state.levelRun!.moves;
      }
      return total;
    };
    expect(moves(true)).toBeLessThan(moves(false));
  });
});

describe('the seed and the limit of a level', () => {
  const trial = (seed: number, median: number, reach = 1, passable = true): SeedTrial => ({ seed, laid: true, passable, median, reach });

  it('takes the value that a share of the runs do not go over', () => {
    const moves = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(moves, 50)).toBe(5);
    expect(percentile(moves, 75)).toBe(8);
    expect(percentile(moves, 90)).toBe(9);
    expect(percentile([3, Infinity], 90)).toBe(Infinity);
  });

  it('picks the board in the middle of those that can be passed, the lower of two middle ones', () => {
    const trials = [trial(1, 9), trial(2, 4), trial(3, 30, 1, false), trial(4, 7), trial(5, 12)];
    expect(pickSeed(SEND, trials)?.seed).toBe(4);
    expect(pickSeed(SEND, [...trials, trial(6, 2)])?.seed).toBe(4);
    // Boards that take the same moves are told apart by their number.
    expect(pickSeed(SEND, [trial(3, 5), trial(1, 5), trial(2, 5)])?.seed).toBe(2);
  });

  it('tells boards to be cleared apart by how often they are cleared', () => {
    const clear: LevelSpec = byId('c1');
    const trials = [trial(1, Infinity, 0.2), trial(2, Infinity, 0.9), trial(3, Infinity, 0.5), trial(4, Infinity, 0.6, false)];
    expect(pickSeed(clear, trials)?.seed).toBe(3);
  });

  it('picks nothing when no board can be passed', () => {
    expect(pickSeed(SEND, [trial(1, 9, 1, false)])).toBeNull();
    expect(pickSeed(SEND, [])).toBeNull();
  });

  it('gives a level a third more moves than the middle run takes', () => {
    expect(limitFor(3)).toBe(4);
    expect(limitFor(4)).toBe(6);
    expect(limitFor(14)).toBe(19);
    expect(limitFor(28)).toBe(38);
  });

  it('tries a seed: whether a board is laid, whether it is passed, how it goes', () => {
    const tried = trySeed(SEND, 3, 6);
    expect(tried).toMatchObject({ seed: 3, laid: true, passable: true, reach: 1 });
    expect(tried.median).toBeGreaterThan(0);
    expect(Number.isFinite(tried.median)).toBe(true);
    // A level whose faces leave no opening to be made has no board.
    expect(trySeed({ ...SEND, values: [2] }, 3, 2)).toEqual({ seed: 3, laid: false, passable: false, median: Infinity, reach: 0 });
  });

  it('has the limit the first level with one was given', () => {
    // The rule, held to: a third over the middle run of the average player. One short level is
    // played here; the others take seconds, and `node scripts/levels.mjs seeds=24` shows them all.
    for (const level of [byId('k1')]) {
      const plays = Array.from({ length: 40 }, (_, i) => playLevel(level, 'average', i + 1));
      const moves = plays.map((play) => (play.reached ? play.moves : Infinity)).sort((a, b) => a - b);
      expect(level.moves, level.id).toBe(limitFor(percentile(moves, 50)));
    }
  });
});

describe('table of the levels', () => {
  it('has a row for every level and player', () => {
    const table = levelTable({ levels: PROBE_LEVELS.slice(0, 2), skills: ['novice', 'pro'], runs: 3 });
    const rows = table.split('\n');
    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatch(/^level\s+board\s+faces\s+dice\s+come\s+goal\s+seed\s+limit\s+player\s+reached\s+p5\s+p50\s+p75\s+p90\s+in limit\s+left p50$/);
    expect(rows[1]).toMatch(/^c1\s+5x5\s+23\s+6\s+no\s+clear the board\s+\d+\s+none\s+novice\s+\d+%/);
    expect(rows[4]).toMatch(/^k1\s+5x5\s+23\s+8\s+yes\s+order 4 of 2\s+\d+\s+\d+\s+pro\s+\d+%/);
  });

  it('shows the seeds of a level, picks one and says what limit it asks for', () => {
    const table = levelTable({ levels: [byId('k1'), byId('c1')], seeds: 3, runs: 4 });
    const rows = table.split('\n');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatch(/^level\s+goal\s+s1\s+s2\s+s3\s+pick\s+limit$/);
    expect(rows[1]).toMatch(/^k1\s+order 4 of 2\s+\S+\s+\S+\s+\S+\s+seed [123] \(\S+\)\s+\d+ \(reach \d+%\)$/);
    expect(rows[2]).toMatch(/^c1\s+clear the board\s+\d+%!?\s+\d+%!?\s+\d+%!?\s+seed [123] \(\d+%\)\s+none$/);
  });
});
