import { describe, expect, it } from 'vitest';
import { ROAD } from '../levels/road';
import { createRun, defaultConfig } from '../rules';
import { moveOf, tryWay } from '../rules/levelSolver';
import { playRecordOf, versionSummary, type PlayRecord } from './playLog';

const R03 = ROAD[2];
const OF = { hash: 'abcd1234', par: 2 };
const NOON = Date.UTC(2026, 9, 12, 12, 0, 0);

describe('playRecordOf', () => {
  it('writes a play that cleared the board down as passed, with its moves', () => {
    const state = tryWay(R03, R03.solution!.map(moveOf)).state;
    expect(playRecordOf(state, NOON - 12_340, NOON, 1, OF)).toEqual({
      id: 'R03', hash: 'abcd1234', at: '2026-10-12T12:00:00.000Z', result: 'passed', moves: 2, par: 2, undos: 1, deadEnd: null, seconds: 12.3,
    });
  });
  it('writes a play left while it could still be played down as left', () => {
    const state = tryWay(R03, [moveOf('1,2,E')]).state;
    expect(playRecordOf(state, NOON, NOON, 0, OF)).toMatchObject({ result: 'left', moves: 1, deadEnd: null });
  });
  it('writes a play that came to a dead end down as failed, with the dead end', () => {
    // One die of two cannot make a pair: with the other gone the count is short.
    const alone = { ...R03, norm: 1, layout: { start: { x: 1, z: 2 }, dice: [R03.layout!.dice[0]] } };
    const state = createRun({ seed: 1, config: defaultConfig(), level: alone });
    expect(playRecordOf(state, NOON, NOON, 0, OF)).toMatchObject({ result: 'failed', deadEnd: 'count' });
  });
});

describe('versionSummary', () => {
  const play = (result: PlayRecord['result'], moves: number, par: number | null = 4): PlayRecord => ({ id: 'H01', hash: 'h', at: '', result, moves, par, undos: 0, deadEnd: null, seconds: 1 });
  it('counts the plays, those that cleared the board, and the middle of their moves over the fewest', () => {
    expect(versionSummary([play('passed', 4), play('passed', 7), play('passed', 5), play('failed', 3), play('left', 1)])).toEqual({ plays: 5, passed: 3, overMedian: 1 });
    expect(versionSummary([play('passed', 4), play('passed', 7)])).toEqual({ plays: 2, passed: 2, overMedian: 1.5 });
  });
  it('has no middle where nothing cleared the board, or the fewest moves were not known', () => {
    expect(versionSummary([])).toEqual({ plays: 0, passed: 0, overMedian: null });
    expect(versionSummary([play('failed', 3), play('passed', 6, null)])).toEqual({ plays: 2, passed: 1, overMedian: null });
  });
});
