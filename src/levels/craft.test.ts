import { describe, expect, it } from 'vitest';
import { moveOf } from '../rules/levelSolver';
import { fileBoard } from './boardFiles';
import { craftOf, motifOf, troublesOf, type TroubleFacts } from './craft';

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
