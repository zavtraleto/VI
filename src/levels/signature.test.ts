import { describe, expect, it } from 'vitest';
import type { LevelSpec } from '../rules/types';
import { boardOf } from './boardSets';
import { SIMILAR_PAIRS, UNLIKE_PAIRS } from './calibration';
import { needsOf as grammarNeeds } from './grammar';
import { needsOf } from './needs';
import { SAME_LAYOUT, SIMILAR_NEAR, SIMILAR_ROW, coreKey, coreOf, coreSim, layoutSim, shapeClassOf, signatureOf, similarity } from './signature';

/**
 * The signature of a board and how alike two boards are (docs/superpowers/specs/2026-10-28-vi-progression-tools-design.md,
 * section 5): the thought of a board, its layout, and the owner's words of 28 October on what repeats.
 */

/** A board as it is with no way kept: what a draft of the workshop is. */
const unsolved = (spec: LevelSpec): LevelSpec => ({ ...spec, solution: undefined, par: undefined, exact: undefined });

/**
 * The pairs of the calibration set the measure does not agree with, as the test found them: each a pair
 * and its similarity. Held by equality, so the list does not go stale (spec section 5: three misses or more
 * and the core and the weights change).
 */
const KNOWN_SIMILARITY_MISSES: readonly string[] = [
  // Places 74 and 76: two thoughts by their ways (see the test of the core), alike in layout, 4 of 5 dice
  // and not the start, 0.67, squared 0.44. A layout this near is as near as unlike pairs come by chance
  // (`ones-over-leaving-1` and `act-k21`, 0.63), so the layout cannot be let to say it alone.
  'act-k25~roll-in-transfer-1 0.44',
  // Places 68 and 67: four dice against two, a 3 and a link against a loop of a 2; nothing of the core
  // is shared but the kind, and two dice over four can be no more than 0.6 of a layout.
  'probe-25~dd-25-pocket 0.36',
];

describe('the core of a board', () => {
  it('is not one thought on places 74 and 76 of row 0.2.87, against the example of rule 16 in the spec', () => {
    // The spec's example reads both as K L, grasp glass, faces 2. Read off the ways they keep, `act-k25` puts
    // two combos together on top, of 2s and of 3s ("greed loses"), and `roll-in-transfer-1` goes on over a
    // leaving die to a link of 2s ("roll in as transfer"): only the roll onto a leaving die and the 2s are
    // shared. What the owner saw alike in them is the layout: four of the five dice stand in the same cells.
    const k25 = coreOf(boardOf('act-k25'));
    const transfer = coreOf(boardOf('roll-in-transfer-1'));
    const said = `act-k25 ${JSON.stringify(k25)}, roll-in-transfer-1 ${JSON.stringify(transfer)}`;
    expect(k25, said).toEqual({ kind: 'top', route: 'K K', needs: ['glass', 'seven', 'twoFaces'], faces: [2, 3] });
    expect(transfer, said).toEqual({ kind: 'bridge', route: 'K ~ L', needs: ['glass', 'link', 'walk'], faces: [2] });
    expect(coreKey(k25)).not.toBe(coreKey(transfer));
    expect(coreKey(k25)).toMatch(/^[0-9a-f]{6}$/);
    expect(layoutSim(boardOf('act-k25'), boardOf('roll-in-transfer-1'))).toBeCloseTo(4 / 6, 9);
  });

  it('is one key for one core', () => {
    expect(coreKey(coreOf(boardOf('two-combos-3')))).toBe(coreKey(coreOf(boardOf('two-combos-5'))));
  });

  it('takes the way of the solver where a board keeps none, and an empty one where there is no way', () => {
    const kept = coreOf(boardOf('hidden-face-1'));
    const found = coreOf(unsolved(boardOf('hidden-face-1')));
    expect(found.route.length).toBeGreaterThan(0);
    expect(found.faces).toEqual(kept.faces);
    // The die the player starts on, alone: nothing can be put together, and the solver finds no way.
    const { layout } = boardOf('hidden-face-1');
    const alone = layout!.dice.filter((die) => die.x === layout!.start.x && die.z === layout!.start.z);
    const stuck = coreOf({ ...unsolved(boardOf('hidden-face-1')), norm: 1, layout: { ...layout!, dice: alone } });
    expect(stuck).toEqual({ kind: 'top', route: '', needs: [], faces: [3] });
  });

  it('reads a way of one move, kept or found', () => {
    // act-k22: one roll into the gap, and all five go.
    expect(coreOf(boardOf('act-k22'))).toEqual({ kind: 'top', route: 'K', needs: [], faces: [3] });
    expect(coreOf(unsolved(boardOf('act-k22')))).toEqual(coreOf(boardOf('act-k22')));
  });

  it('is alike with itself and unlike with a core of nothing in common', () => {
    const k25 = coreOf(boardOf('act-k25'));
    expect(coreSim(k25, k25)).toBeCloseTo(1, 9);
    expect(coreSim(k25, { kind: 'other', route: 'P P P P', needs: ['push'], faces: [5] })).toBeLessThan(0.3);
  });
});

describe('needsOf', () => {
  it('is the same from the grammar, where it moved from', () => {
    expect(grammarNeeds).toBe(needsOf);
  });
});

describe('the layout of a board', () => {
  it('is alike with itself', () => {
    for (const code of ['R03', 'finale-1']) expect(layoutSim(boardOf(code), boardOf(code))).toBe(1);
  });

  it('is as alike one way as the other', () => {
    const pairs: [string, string][] = [
      ['two-combos-3', 'two-combos-5'],
      ['act-k25', 'roll-in-transfer-1'],
      ['tight-room-4', 'tight-room-1'],
      ['R03', 'finale-1'],
      ['dd-25-pocket', 'probe-25'],
    ];
    for (const [a, b] of pairs) expect(layoutSim(boardOf(a), boardOf(b))).toBeCloseTo(layoutSim(boardOf(b), boardOf(a)), 9);
  });

  it('counts a fixed die among the dice, in the number and in the pattern', () => {
    const spec = boardOf('fixed-wall-1');
    const signature = signatureOf(spec);
    expect(signature.dice).toBe(spec.layout!.dice.length);
    expect(spec.layout!.dice.some((die) => die.fixed)).toBe(true);
    expect(signature.pattern.split(' ').length).toBe(spec.layout!.dice.length + (spec.layout!.onFloor ? 1 : 0));
    expect(signature.forks).toBeNull();
    expect(signatureOf(spec, 3).forks).toBe(3);
  });

  it('gives a board with no way kept a signature', () => {
    const signature = signatureOf(unsolved(boardOf('hidden-face-1')));
    expect(signature.hidden).toBeGreaterThanOrEqual(0);
  });

  it('tells the class of a shape', () => {
    expect(shapeClassOf(boardOf('R03'))).toBe('rect');
    expect(shapeClassOf(boardOf('R01'))).toBe('corridor');
    expect(shapeClassOf(boardOf('dd-25-pocket'))).toBe('pocket');
  });
});

describe('the calibration of section 5', () => {
  it('agrees with the owner on all but the known pairs, fewer than three', () => {
    const misses: string[] = [];
    for (const { a, b } of SIMILAR_PAIRS) {
      const best = Math.max(...b.map((code) => similarity(boardOf(a), boardOf(code))));
      if (best < SIMILAR_ROW) misses.push(`${a}~${b.join('|')} ${best.toFixed(2)}`);
    }
    for (const [a, b] of UNLIKE_PAIRS) {
      const sim = similarity(boardOf(a), boardOf(b));
      if (sim > SIMILAR_NEAR) misses.push(`${a}≠${b} ${sim.toFixed(2)}`);
    }
    expect(misses).toEqual(KNOWN_SIMILARITY_MISSES);
    expect(misses.length).toBeLessThan(3);
  });

  it('holds the thresholds of rules 16 and 17', () => {
    expect([SAME_LAYOUT, SIMILAR_ROW, SIMILAR_NEAR]).toEqual([0.9, 0.7, 0.5]);
  });
});
