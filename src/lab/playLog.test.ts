import { describe, expect, it } from 'vitest';
import { fileBoard } from '../levels/boardFiles';
import { createRun, defaultConfig } from '../rules';
import { moveOf, tryWay } from '../rules/levelSolver';
import { mergePlays, playRecordOf, ratingsOf, ratingsText, versionSummary, type PlayRecord } from './playLog';

const R03 = fileBoard('R03');
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
    const { start } = R03.layout!;
    const own = R03.layout!.dice.find((die) => die.x === start.x && die.z === start.z)!;
    const alone = { ...R03, norm: 1, layout: { start, dice: [own] } };
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

describe('the answers after a play', () => {
  const play = (at: string, moves: number, extra: Partial<PlayRecord> = {}): PlayRecord => ({ id: 'H01', hash: 'h', at, result: 'passed', moves, par: 4, undos: 0, deadEnd: null, seconds: 10, ...extra });
  it('lays an answer given later over its play, the last answer over the first', () => {
    const plays = mergePlays([play('a', 4), play('b', 6), { at: 'a', patch: { rate: 'ok' } }, { at: 'a', patch: { rate: 'fire', more: true } }, { at: 'nowhere', patch: { rate: 'miss' } }]);
    expect(plays).toHaveLength(2);
    expect(plays[0]).toMatchObject({ at: 'a', rate: 'fire', more: true });
    expect(plays[1].rate).toBeUndefined();
  });
  it('sets the boards called fire beside those called a miss, measure by measure', () => {
    const ratings = ratingsOf([
      play('a', 4, { rate: 'fire', measures: { dice: 5 } }),
      play('b', 6, { rate: 'fire', measures: { dice: 4 } }),
      play('c', 9, { rate: 'miss', measures: { dice: 7 } }),
      play('d', 5),
    ]);
    expect(ratings.rated).toBe(3);
    expect(ratings.byMeasure.over).toEqual({ fire: { plays: 2, least: 0, middle: 1, most: 2 }, miss: { plays: 1, least: 5, middle: 5, most: 5 } });
    expect(ratings.byMeasure.dice.fire).toEqual({ plays: 2, least: 4, middle: 4.5, most: 5 });
    expect(ratingsText(ratings)).toContain('оценённых партий: 3');
  });
  it('counts, preset by preset, how often a board was what was ordered', () => {
    const ratings = ratingsOf([
      play('a', 4, { order: 'preset=tricky size=4', asOrdered: true, rate: 'fire', more: true }),
      play('b', 4, { order: 'preset=tricky size=4', asOrdered: false }),
      play('c', 4, { order: 'preset=tricky size=4', fresh: true }),
      play('d', 4, { order: 'size=4 dice=5' }),
    ]);
    expect(ratings.byPreset).toEqual({ tricky: { plays: 3, asked: 2, yes: 1, fire: 1, more: 1, fresh: 1 } });
    expect(ratingsText(ratingsOf([]))).toContain('оценок пока нет');
  });
});

describe('after the review of the second build', () => {
  it('passes over a line of the plays that is no play and no answer', () => {
    const play: PlayRecord = { id: 'H01', hash: 'h', at: 'a', result: 'passed', moves: 4, par: 4, undos: 0, deadEnd: null, seconds: 1 };
    const lines = [null, 7, play, 'torn', { at: 'a', patch: { rate: 'fire' } }] as unknown as Parameters<typeof mergePlays>[0];
    expect(mergePlays(lines)).toEqual([{ ...play, rate: 'fire' }]);
  });
  it('counts a preset by the name an order keeps of it', () => {
    const play: PlayRecord = { id: 'H01', hash: 'h', at: 'a', result: 'passed', moves: 4, par: 4, undos: 0, deadEnd: null, seconds: 1, order: 'as=tricky size=4', asOrdered: true };
    expect(ratingsOf([play]).byPreset.tricky).toMatchObject({ plays: 1, asked: 1, yes: 1 });
  });
});
