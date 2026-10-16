import { describe, expect, it } from 'vitest';
import { parseBoard, printBoard } from '../levels/boardFile';
import { asInRow, placeOf, type LibraryRowChapter } from '../levels/library';
import { buildRow, readRowFile } from '../levels/row';
import { moveOf, solveLevel, tryWay } from '../rules/levelSolver';
import type { LevelSpec } from '../rules/types';
import { secondsOf, type Seconds } from './labFacts';
import { wantsProof, wayToKeep } from './workshopCampaign';

const head = { id: 'R01', seed: 0, size: 3, goal: { kind: 'clear' }, moves: 0, values: [2], norm: 0, arrival: 'none' } as LevelSpec;
const seconds = (over: Partial<Seconds['check']> = {}): Seconds => ({
  check: { par: 3, exact: true, states: 10, way: ['0,1,N', '0,0,E', '1,0,S'], score: null, kept: null, ...over },
  firsts: 1,
  moves: [],
  trap: null,
});
const board = (status: 'R' | 'D' | 'RC', more: Partial<LevelSpec> = {}, locked = false) => ({ extra: { status }, head: { ...head, ...more }, locked });

describe('the way a board of the row keeps by itself', () => {
  it('is the way the solver proved, for a board of the row that keeps none', () => {
    expect(wayToKeep(board('R'), seconds())).toEqual({ par: 3, exact: true, solution: ['0,1,N', '0,0,E', '1,0,S'] });
  });
  it('is taken by the same board once it is of the row or unlocked: the answer counted before is not lost', () => {
    const proved = seconds();
    expect(wayToKeep(board('D'), proved)).toBeNull();
    expect(wayToKeep(board('R', {}, true), proved)).toBeNull();
    expect(wayToKeep(board('R'), proved)).not.toBeNull();
  });
  it('is none while the solver counts, where it failed, gave up, found no way or did not prove the fewest', () => {
    expect(wayToKeep(board('R'), null)).toBeNull();
    expect(wayToKeep(board('R'), 'the worker fell')).toBeNull();
    expect(wayToKeep(board('R'), seconds({ par: null, way: null }))).toBeNull();
    expect(wayToKeep(board('R'), seconds({ exact: false }))).toBeNull();
    expect(wayToKeep(board('R'), seconds({ par: 0, way: [] }))).toBeNull();
  });
  it('is none once the board keeps its way: written, it is not written again', () => {
    expect(wayToKeep(board('R', { par: 3, exact: true, solution: ['0,1,N', '0,0,E', '1,0,S'] }), seconds())).toBeNull();
    expect(wayToKeep(board('R', { par: 3, exact: false, solution: ['0,1,N', '0,0,E', '1,0,S'] }), seconds())).not.toBeNull();
  });
  it('is the way proved where the way the board keeps does not hold, and none where it does', () => {
    const keeps = { par: 3, exact: true, solution: ['0,1,E', '0,0,N', '1,0,S'] };
    expect(wayToKeep(board('R', keeps), seconds({ kept: 'same' }))).toBeNull();
    expect(wayToKeep(board('R', keeps), seconds({ kept: 'broken' }))).toEqual({ par: 3, exact: true, solution: ['0,1,N', '0,0,E', '1,0,S'] });
    expect(wayToKeep(board('R', { ...keeps, par: 4, solution: [...keeps.solution, '1,1,W'] }), seconds({ kept: 'shorter' }))?.par).toBe(3);
  });
});

describe('the way of a board of the row, proved on the faces of its chapter', () => {
  // Three dice of 2 on the diagonal: seven moves on the face 2 alone, six where 3 works as well.
  const grid = ['---', '21   .   .', ' .  21*  .', ' .   .  21'];
  const onTwo = ['1,1,N', '0,0,S', '0,1,E', '1,0,E', '2,0,S', '1,1,S,p', '1,2,N'];
  const file = parseBoard(['id: T', 'status: R', 'faces: 2', 'par: 7', 'exact: yes', `way: ${onTwo.join(' ')}`, ...grid].join('\n'), 'T');
  const chapters: LibraryRowChapter[] = [{ id: 0, title: 'road', faces: [2, 3], stops: ['T'] }];
  const rowFile = readRowFile(JSON.stringify({ chapters: [{ title: 'road', faces: [2, 3], floor: 'open', places: [{ board: 'T', role: 'meet', archetype: 'diagonal' }] }] }));
  const played = asInRow(file, placeOf('T', chapters), chapters);
  const inHand = (head: LevelSpec) => ({ extra: { status: 'R' as const }, head, locked: false });

  it('is asked of the board as its chapter plays it, though the file keeps a way proved on its own faces', () => {
    expect(played.faces).toEqual([2, 3]);
    expect(wayToKeep(inHand(file), secondsOf(file))).toBeNull();
    expect(wantsProof(file, file)).toBe(false);
    expect(wantsProof(file, played)).toBe(true);
  });

  it('is the way proved there, written over the one the file keeps, and the row takes it as its test does', () => {
    const seconds = secondsOf(played);
    expect(seconds.check.kept).toBe('shorter');
    const way = wayToKeep(inHand(file), seconds)!;
    expect(way.par).toBe(6);
    const kept = { ...file, ...way };
    const { spec } = buildRow(rowFile, new Map([['T', printBoard(kept, { status: 'R' })]])).places[0];
    expect(spec.faces).toEqual([2, 3]);
    const { state } = tryWay(spec, spec.solution!.map(moveOf));
    expect(state.endReason).toBe('passed');
    expect(state.levelRun!.moves).toBe(spec.par);
    const solved = solveLevel(spec);
    expect(solved.exhausted).toBe(true);
    expect(solved.solution!.par).toBe(spec.par);
    // Written, the way is not written again while the answer of the head before it stands.
    expect(wayToKeep(inHand(kept), seconds)).toBeNull();
  });
});
