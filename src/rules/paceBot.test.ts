import { describe, expect, it } from 'vitest';
import { paceEdges, paceGrid, paceStyles, playPace, survival, survivalTable, type PaceRun } from './paceBot';

const total = (runs: { score: number }[]) => runs.reduce((sum, run) => sum + run.score, 0);
const SEEDS = [1, 2, 3];
/** Time for a test that plays whole runs: with the whole suite beside it, on a slow machine, the usual five seconds are short. */
const ROOM = 30_000;

describe('a run of the pace', { timeout: ROOM }, () => {
  it('is the run of the player of that name unless told otherwise', () => {
    const plain = playPace({ skill: 'average', seed: 3, limitMinutes: 2 });
    expect(plain).toMatchObject({ skill: 'average', head: 'average', hands: 'average', style: 'plain', nobody: false });
    expect(playPace({ skill: 'average', head: 'average', hands: 'average', style: 'plain', rush: false, seed: 3, limitMinutes: 2 })).toEqual(plain);
  });

  it('takes a head and hands apart', () => {
    const run = playPace({ skill: 'pro', hands: 'newbie', seed: 2, limitMinutes: 2 });
    expect(run).toMatchObject({ head: 'pro', hands: 'newbie' });
    expect(run).not.toEqual(playPace({ skill: 'pro', seed: 2, limitMinutes: 2 }));
  });

  it('scores more with hands that take no time, for the same head', () => {
    const slow = SEEDS.map((seed) => playPace({ skill: 'average', seed, limitMinutes: 3 }));
    const fast = SEEDS.map((seed) => playPace({ skill: 'average', hands: 'instant', seed, limitMinutes: 3 }));
    expect(total(fast)).toBeGreaterThan(total(slow));
  });

  it('makes more links of a chain as a builder than as a survivor', () => {
    const links = (style: 'builder' | 'survivor') => SEEDS.reduce((sum, seed) => sum + playPace({ skill: 'pro', style, seed, limitMinutes: 3 }).chains, 0);
    expect(links('builder')).toBeGreaterThan(links('survivor'));
  });

  it('plays another run in a rush', () => {
    const calm = playPace({ skill: 'newbie', seed: 4, limitMinutes: 3 });
    expect(playPace({ skill: 'newbie', rush: true, seed: 4, limitMinutes: 3 })).not.toEqual(calm);
  });

  it('is lost with nobody at it: the board fills', () => {
    const run = playPace({ skill: 'newbie', nobody: true, timed: true, seed: 1, limitMinutes: 5 });
    expect(run).toMatchObject({ nobody: true, endReason: 'full', steps: 0, clears: 0 });
  });
});

describe('tables of the pace', () => {
  const quick = { seeds: [1], limitMinutes: 1 };
  const lines = (table: string) => table.split('\n');

  it('count who is still playing minute by minute, and who was lost in each', () => {
    const run = (seconds: number, over: boolean) => ({ seconds, endReason: over ? 'full' : null }) as PaceRun;
    const runs = [run(30, true), run(90, true), run(100, true), run(180, false)];
    expect(survival(runs, 3)).toEqual([
      { minute: 1, alive: 0.75, died: 0.25 },
      { minute: 2, alive: 0.25, died: 2 / 3 },
      { minute: 3, alive: 0.25, died: 0 },
    ]);
    expect(survival([], 2)).toEqual([
      { minute: 1, alive: 0, died: 0 },
      { minute: 2, alive: 0, died: 0 },
    ]);
  });

  it('lay heads against hands: a row to a head, a column to a pair of hands', () => {
    const table = lines(paceGrid({ ...quick, heads: ['newbie', 'pro'], hands: ['newbie', 'instant'] }));
    expect(table).toHaveLength(3);
    expect(table[0]).toMatch(/head.*newbie.*instant/);
    expect(table[1]).toMatch(/^newbie/);
    expect(table[2]).toMatch(/^pro/);
  });

  it('lay the styles side by side for a player, and say what the builder scores to the survivor', () => {
    const table = lines(paceStyles({ ...quick, skills: ['average'] }));
    expect(table).toHaveLength(4);
    expect(table[0]).toMatch(/player.*style.*time.*score.*links.*builder to survivor/);
    expect(table.slice(1).map((line) => line.split(/\s+/)[1])).toEqual(['plain', 'survivor', 'builder']);
  });

  it('show the share of the runs alive at every minute for every player', () => {
    const table = lines(survivalTable({ ...quick, skills: ['newbie', 'pro'], minutes: 2 }));
    expect(table).toHaveLength(3);
    expect(table[0]).toMatch(/player.*1 min.*2 min/);
  });

  it('show the edges: a board with nobody at it, and the most the rules let a player do', () => {
    const table = lines(paceEdges(quick));
    expect(table[0]).toMatch(/player.*time.*score/);
    expect(table.slice(1).map((line) => line.split(/\s+/)[0])).toEqual(['nobody', 'ceiling']);
  });
});
