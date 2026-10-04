import { describe, expect, it } from 'vitest';
import { SKILLS, SKILL_NAMES, botCommand, createBot } from './bot';
import { defaultConfig } from './config';
import {
  GREEDY, goalBot, levelTable, limitFor, measure, neededBy, percentile, pickSeed, playLevel, randomMoves, randomPlay, randomRate, skillRates, trapRate,
  trySeed, witnessWay, type SeedTrial,
} from './levelBot';
import { moveText, replay } from './levelSolver';
import { createRun, step } from './sim';
import type { LevelSpec, PuzzleDie } from './types';

/** Two levels of the second probe, laid from a seed: a board to clear, and an order with a limit taken from the players. */
const SEEDED: readonly LevelSpec[] = [
  { id: 'c1', seed: 1, size: 5, values: [2, 3], norm: 6, arrival: 'none', goal: { kind: 'clear' }, moves: 0 },
  { id: 'k1', seed: 15, size: 5, values: [2, 3], norm: 8, arrival: 'refill', goal: { kind: 'order', items: [{ value: 2, count: 4 }] }, moves: 6 },
];
const byId = (id: string): LevelSpec => SEEDED.find((level) => level.id === id)!;
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
    const table = levelTable({ levels: SEEDED, skills: ['novice', 'pro'], runs: 3 });
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

describe('the yardsticks of a board to be cleared', () => {
  /** A board of three cells a side given die by die; the player starts on the first die named. */
  const board = (dice: readonly PuzzleDie[]): LevelSpec => ({
    id: 'test', seed: 1, size: 3, values: [2, 3], norm: dice.length, arrival: 'none', goal: { kind: 'clear' }, moves: 0,
    layout: { dice, start: { x: dice[0].x, z: dice[0].z } },
  });
  /** One roll west makes the pair. */
  const PAIR = board([{ x: 2, z: 0, top: 6, north: 3 }, { x: 0, z: 0, top: 2, north: 1 }]);
  /** The pair, and a die beside it that comes to it over the die that is going. */
  const GLASS = board([{ x: 2, z: 0, top: 6, north: 3 }, { x: 0, z: 0, top: 2, north: 1 }, { x: 1, z: 1, top: 6, north: 5 }]);

  it('have a greedy player with the eye of a pro and no failings', () => {
    expect(GREEDY).toMatchObject({ depth: SKILLS.pro.depth, rolls: SKILLS.pro.rolls, budget: SKILLS.pro.budget, miss: 0, missPerRoll: 0, lapse: 0, slip: 0, greed: 0 });
    expect(GREEDY.think).toEqual([0, 0]);
    expect(GREEDY.pause).toEqual([0, 0]);
  });

  it('count the greedy runs that end at a dead end', () => {
    expect(trapRate(PAIR, 5)).toBe(0);
    // One die cannot be cleared: the first move of every run ends it.
    expect(trapRate(board([{ x: 1, z: 1, top: 6, north: 3 }]), 5)).toBe(1);
    expect(trapRate(GLASS, 6)).toBe(trapRate(GLASS, 6));
  });

  it('have a random player that makes any move it can get to, the same ones for one seed', () => {
    const end = randomPlay(PAIR, 3, 12);
    expect(JSON.stringify(randomPlay(PAIR, 3, 12))).toBe(JSON.stringify(end));
    expect(end.levelRun!.moves).toBeLessThanOrEqual(12);
    expect(end.over || end.levelRun!.moves === 12).toBe(true);
  });

  it('give the random player thirty moves, or four times the fewest', () => {
    expect(randomMoves(1)).toBe(30);
    expect(randomMoves(7)).toBe(30);
    expect(randomMoves(12)).toBe(48);
  });

  it('count the random runs that clear the board', () => {
    const rate = randomRate(PAIR, 40, 1);
    expect(rate).toBeGreaterThan(0.5);
    expect(rate).toBeLessThanOrEqual(1);
    expect(randomRate(PAIR, 40, 1)).toBe(rate);
    expect(randomRate(board([{ x: 1, z: 1, top: 6, north: 3 }]), 10, 1)).toBe(0);
  });

  it('count the clears of every player by skill', () => {
    const rates = skillRates(PAIR, 3);
    expect(Object.keys(rates)).toEqual(SKILL_NAMES);
    expect(rates.pro).toBe(1);
    for (const skill of SKILL_NAMES) expect(rates[skill]).toBeGreaterThanOrEqual(0);
  });

  it('take the shortest way a strong player clears the board by, as a way the solver can play', () => {
    const way = witnessWay(GLASS, 3)!;
    expect(way.length).toBeGreaterThanOrEqual(2);
    const end = replay(GLASS, way);
    expect(end.endReason).toBe('passed');
    expect(end.levelRun!.moves).toBe(way.length);
    expect(witnessWay(board([{ x: 1, z: 1, top: 6, north: 3 }]), 2)).toBeNull();
  });

  it('name what a board cannot be cleared without', () => {
    // The third die of three is a link whatever is done; over the die that is going is only the short way.
    expect(neededBy(GLASS, 2, ['link', 'glass'])).toEqual(['link']);
  });

  it('measure a board: the solver for the moves, the players for the rest', () => {
    const measured = measure(GLASS, { skillRuns: 2 });
    expect(measured).toMatchObject({ par: 2, exact: true, depth: 1, uses: ['link', 'glass'], needs: ['link'] });
    expect(measured.way!.map(moveText)).toEqual(['2,0,W', '1,1,N']);
    expect(measured.traps).toBeGreaterThanOrEqual(0);
    expect(measured.random).toBeGreaterThanOrEqual(0);
    expect(Object.keys(measured.skills)).toEqual(SKILL_NAMES);
  });

  it('take a level that keeps its way at its word, and play the way again', () => {
    // A longer way than the fewest: round the die that is going.
    const kept: LevelSpec = { ...GLASS, par: 3, exact: false, solution: ['2,0,W', '1,1,E', '2,1,N'] };
    expect(measure(kept, { skillRuns: 1 })).toMatchObject({ par: 3, exact: false, uses: ['link'] });
    expect(() => measure({ ...kept, solution: ['0,0,E'] }, { skillRuns: 1 })).toThrow(/cannot be made/);
  });

  it('say that a board with no way has none', () => {
    const measured = measure(board([{ x: 1, z: 1, top: 6, north: 3 }]), { skillRuns: 1 });
    expect(measured).toMatchObject({ par: null, way: null, exact: false, traps: 1, random: 0 });
  });
});
