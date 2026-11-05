import { describe, expect, it } from 'vitest';
import { fileBoard } from '../levels/boardFiles';
import { HUMANS, humanFacts, humanPlay, wayNeedsStep, type Human } from './humanBot';
import { PERSONAS, rollsToFace } from './levelBot';

/**
 * The players who solve as people do (docs/superpowers/specs/2026-11-04-vi-level-craft-design.md, section 3):
 * tries and giving up, the lure of what goes at once, the cost of a rule held in the head, the figure seen.
 */

describe('a person at a board', () => {
  const easy = fileBoard('R01');

  it('plays the same for the same seed', () => {
    expect(humanPlay(easy, HUMANS.newcomer, 3)).toEqual(humanPlay(easy, HUMANS.newcomer, 3));
  });

  it('clears an easy board, the owner on the first try', () => {
    const play = humanPlay(easy, HUMANS.owner, 1);
    expect(play.passedOn).toBe(1);
    expect(play.moves).toBeGreaterThanOrEqual(easy.par ?? 0);
  });

  it('gives up after its tries on a board it cannot clear, and says so', () => {
    const blind: Human = { persona: { depth: 1, budget: 1, slip: 1, counts: false }, lure: 0, load: 0, bored: 1, tries: 2, learn: true };
    const play = humanPlay(fileBoard('ones-threes-2'), blind, 1);
    expect(play).toEqual({ passedOn: null, moves: null, tries: 2 });
  });

  it('says of its runs what share clears at once, fails, gives up', () => {
    const facts = humanFacts(easy, HUMANS.owner, 4);
    expect(facts.first + facts.failedOnce).toBeCloseTo(1);
    expect(facts.gaveUp).toBe(0);
    expect(facts.tries).toBe(1);
  });

  it('holds the owner as the calibration found him: two moves ahead, a side misread now and then, eight tries', () => {
    expect(HUMANS.owner.persona).toEqual({ depth: 2, budget: 200, slip: 0.08, counts: false, misread: 0.15 });
    expect(HUMANS.owner.tries).toBe(8);
  });
});

describe('the figure a person sees', () => {
  it('counts the rolls a die needs to show a face of the level on top', () => {
    const ori = { top: 1, bottom: 6, north: 2, south: 5, east: 3, west: 4 };
    expect(rollsToFace(ori, [1])).toBe(0);
    expect(rollsToFace(ori, [3])).toBe(1);
    expect(rollsToFace(ori, [6])).toBe(2);
  });

  it('is no part of the personas of the scale, so their numbers stay as they were', () => {
    for (const persona of Object.values(PERSONAS)) expect('figure' in persona).toBe(false);
  });
});

describe('a person who does not know the step onto another die (the players of Playgama on H06, 5 November 2026)', () => {
  it('tells the boards whose way needs the step: H06 does, the first boards of the row do not', () => {
    expect(wayNeedsStep(fileBoard('H06'))).toBe(true);
    for (const code of ['R01', 'side-up-1', 'three-under-1', 'R03', 'B01_s290']) expect(wayNeedsStep(fileBoard(code)), code).toBe(false);
  });

  it('never clears H06 by rolling the die under it, and clears it once it knows the step', () => {
    const blind: Human = { ...HUMANS.newcomer, step: 0 };
    expect(humanFacts(fileBoard('H06'), blind, 5, { stepKnown: false }).gaveUp).toBe(1);
    expect(humanFacts(fileBoard('H06'), blind, 5).gaveUp).toBe(0);
    // The owner knows the step however he comes to a board.
    expect(humanFacts(fileBoard('H06'), HUMANS.owner, 5, { stepKnown: false }).gaveUp).toBe(0);
  });

  it('finds the step now and then: the newcomer gives H06 up more often met not knowing it, and clears a board that needs none either way', () => {
    const H06 = fileBoard('H06');
    expect(humanFacts(H06, HUMANS.newcomer, 10, { stepKnown: false }).gaveUp).toBeGreaterThan(humanFacts(H06, HUMANS.newcomer, 10).gaveUp);
    const R03 = fileBoard('R03');
    // Not knowing the step it even clears R03 at once more often: the moves off other dice are not there to lead it astray.
    expect(humanFacts(R03, HUMANS.newcomer, 10, { stepKnown: false }).gaveUp).toBe(0);
    expect(humanFacts(R03, HUMANS.newcomer, 10).gaveUp).toBe(0);
  });
});
