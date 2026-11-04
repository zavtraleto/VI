import { describe, expect, it } from 'vitest';
import { fileBoard } from '../levels/boardFiles';
import { HUMANS, humanFacts, humanPlay, type Human } from './humanBot';
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
