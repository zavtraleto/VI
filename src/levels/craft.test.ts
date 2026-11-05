import { describe, expect, it } from 'vitest';
import { moveOf } from '../rules/levelSolver';
import { fileBoard } from './boardFiles';
import { parseBoard } from './boardFile';
import { boardTroublesOf, COVERED_HOLE, coveredHolesOf, craftOf, motifOf, troublesOf, type TroubleFacts } from './craft';
import { ROW } from './row.gen';

/**
 * The passport of the kind of a board and its troubles (docs/superpowers/specs/2026-11-04-vi-level-craft-design.md,
 * sections 1, 2 and 4): what the way asks move by move, and the owner's troubles in his words.
 */

describe('what the way of a board asks', () => {
  it('runs the repeats of a route together', () => {
    expect(motifOf('K K L L L')).toBe('K L');
    expect(motifOf('K ~ L v ^ L')).toBe('K ~ L v ^ L');
    expect(motifOf('')).toBe('');
  });

  it('reads the way of a board move by move: shares within 0 and 1, the domino of R08 ending big', () => {
    const spec = fileBoard('R08');
    const facts = craftOf(spec, spec.solution!.map(moveOf));
    expect(facts.choice).toBeGreaterThanOrEqual(0);
    expect(facts.choice).toBeLessThanOrEqual(1);
    expect(facts.lastShare).toBeGreaterThan(0);
    expect(facts.lastShare).toBeLessThanOrEqual(1);
    expect(facts.counter).toBeGreaterThanOrEqual(0);
    expect(facts.motif).toBe('K L');
  });
});

describe('the troubles of a board', () => {
  const calm: TroubleFacts = {
    par: 5,
    hidden: 0,
    safeFirst: true,
    craft: { counter: 1, choice: 0.6, narrow: 1, lastShare: 0.5, motif: 'K L' },
    people: {
      newcomer: { first: 0.5, failedOnce: 0.5, gaveUp: 0.1, tries: 2, moves: 7 },
      owner: { first: 0.8, failedOnce: 0.2, gaveUp: 0, tries: 1.2, moves: 6 },
    },
  };

  it('finds none on a board with a choice, a move against the look of it, and a fair first move', () => expect(troublesOf(calm)).toEqual([]));

  it('names each in the owner word', () => {
    const plain = { ...calm, craft: { ...calm.craft, counter: 0, narrow: 1 }, people: { ...calm.people, newcomer: { ...calm.people.newcomer, first: 0.95 } } };
    expect(troublesOf(plain)).toEqual(['видно сразу']);
    expect(troublesOf({ ...plain, craft: { ...plain.craft, narrow: 2 } })).toEqual([]);
    expect(troublesOf({ ...calm, safeFirst: false })).toEqual(['облом первым ходом']);
  });

  it('does not call a hard board a trouble: a long way to clear it and a hidden face are numbers, not troubles', () => {
    const hard = { ...calm, hidden: 3, people: { ...calm.people, owner: { ...calm.people.owner, first: 0.05, moves: 14 } } };
    expect(troublesOf(hard)).toEqual([]);
  });
});

describe('a cut cell the dice hide from the camera (the owner on the 34th place, 5 November 2026)', () => {
  const board = (rows: readonly string[]) => parseBoard(['id: t', 'faces: 4', '---', ...rows, ''].join('\n'), 't');

  it('is the cut cell inside the field with a die south, east or south-east of it', () => {
    // The 34th place as it stood on 4 November: the cut (1,1) between dice west, north and east, the player's die east of it.
    const hidden = board(['41  42   .   .', '42   -  42*  .', ' .   .  45   .', ' -   -   -   -']);
    expect(coveredHolesOf(hidden)).toEqual([{ x: 1, z: 1 }]);
    expect(boardTroublesOf(hidden)).toEqual([COVERED_HOLE]);
  });

  it('is not a cut at the edge the camera faces, nor a row cut away, nor a cut with nothing in front of it', () => {
    // A notch in the front edge, open to the south: seen as a missing cell.
    expect(coveredHolesOf(board([' .   .  46  45', '54*  .   .  46', ' .   .   -   .', ' -   -   -   -']))).toEqual([]);
    // A column cut away on the west, dice east of it: the edge of the field.
    expect(coveredHolesOf(board([' -  21   .   .', ' -   .  41* 41', ' -  23   .   .', ' -   -   -   -']))).toEqual([]);
    // A cut inside with its south, east and south-east open: seen.
    expect(coveredHolesOf(board(['41  42   .   .', '42   -   .   .', ' .   .   .  45*', ' -   -   -   -']))).toEqual([]);
  });

  it('is on no place of the row', () => {
    expect(ROW.places.filter((place) => coveredHolesOf(place.spec).length > 0).map((place) => place.code)).toEqual([]);
  });
});

