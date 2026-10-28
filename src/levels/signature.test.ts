import { describe, expect, it } from 'vitest';
import type { LevelSpec } from '../rules/types';
import { boardOf } from './boardSets';
import { OWNER_REPEATS, SIMILAR_PAIRS, UNLIKE_PAIRS } from './calibration';
import { fileBoard } from './boardFiles';
import { needsOf as grammarNeeds } from './grammar';
import { needsOf } from './needs';
import { ALONE_APART, SAME_LAYOUT, SIMILAR_NEAR, SIMILAR_ROW, coreKey, coreOf, coreSim, flaggedBy, layoutSim, shapeClassOf, signatureOf, similarity } from './signature';

/**
 * The signature of a board and how alike two boards are (docs/superpowers/specs/2026-10-28-vi-progression-tools-design.md,
 * section 5): the thought of a board, its layout, and the owner's words of 28 October on what repeats.
 */

/** The row as the owner played it on 28 October 2026 (0.2.87, the hundred places after 0f57abf): the numbers of his words. */
const ROW_0287: readonly string[] = [
  'R01', 'side-up-1', 'R03', 'B01_s290', 'H06', 'H08', 'H07', 'three-under-1', 'which-first-2', 'bridge-first-1',
  'R11', 'two-pairs-2', 'P07', 'C1-07', 'R07', 'act-k17', 'R05', 'P02', 'which-first-3', 'R08',
  'first-sixes-1', 'roll-in-1', 'C1-05', 'two-pairs-1', 'C1-06', 'first-fours-1', 'P24', 'domino-3', 'floor-first-1', 'carry-1',
  'lift-first-1', 'R14', 'roll-or-push-1', 'push-then-link-1', 'rescue-5', 'three-at-once-1', 'P12', 'ones-roll-1', 'ones-apply-1', 'chain-1',
  'ones-push-1', 'dd-10-three-ones', 'collapse-3', 'broom-3', 'link-from-below-1', 'corridor-push-1', 'rescue-3', 'dd-04-three-on-six', 'hidden-face-3', 'two-combos-3',
  'two-combos-5', 'seven-1', 'dd-06-find-the-two', 'bridge-5', 'hidden-face-1', 'dd-09-push-link', 'collapse-5', 'pair-and-fours-1', 'ready-fours-1', 'R09',
  'fixed-wall-1', 'dd-62-fours-around', 'fixed-combo-1', 'C2-05', 'collapse-4', 'two-lifts-1', 'dd-25-pocket', 'probe-25', 'act-k23', 'dd-11-wood-pushes',
  'rescue-1', 'chaser-1', 'P08', 'act-k25', 'dd-12-ice-corridor', 'roll-in-transfer-1', 'P09', 'far-faces-1', 'R16', 'dd-15-no-way-down',
  'trap-5', 'dd-21-wood-fives', 'dd-14-turn-to-fours', 'dd-72-fours-and-one', 'P06', 'ones-over-leaving-1', 'act-k21', 'tight-room-5', 'three-moves-1', 'dd-20-chain-on-the-run',
  'tight-room-1', 'rescue-4', 'ones-broom-below-1', 'collapse-after-prep-1', 'dd-13-stone-row', 'dd-19-three-threes-apart', 'three-moves-2', 'tight-room-4', 'last-rest-1', 'finale-1',
];
/** Row 0.2.87 as places of a row, the boards read from their files: the row the owner's words of 28 October are of. */
const PLAYED = ROW_0287.map((code, i) => ({ number: i + 1, code, spec: fileBoard(code) }));

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
  // is shared but a part of the route, and two dice over four can be no more than 0.6 of a layout.
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
    expect(coreOf(boardOf('act-k22'))).toEqual({ kind: 'top', route: 'K', needs: [], faces: [3], alone: { dice: 5, length: 'short' } });
    expect(coreOf(unsolved(boardOf('act-k22')))).toEqual(coreOf(boardOf('act-k22')));
  });

  it('keeps two boards of one event apart by the length of the way and the number of dice', () => {
    const short = { kind: 'top' as const, route: 'K', needs: [], faces: [3], alone: { dice: 3, length: 'short' as const } };
    expect(coreSim(short, short)).toBeCloseTo(1, 9);
    expect(coreSim(short, { ...short, alone: { dice: 5, length: 'long' } })).toBeCloseTo(ALONE_APART.length * ALONE_APART.dice, 9);
    expect(coreKey(short)).not.toBe(coreKey({ ...short, alone: { dice: 3, length: 'middle' } }));
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
    expect([SAME_LAYOUT, SIMILAR_ROW, SIMILAR_NEAR]).toEqual([0.9, 0.75, 0.65]);
  });
});

/**
 * Rule 17 against the owner's own list of repeats (fix round 1 of task 3): of places 48-100 of row 0.2.87,
 * the 23 he called repeats are to be flagged, the other 30 as few as can be. The measure finds nearly every
 * repeat, and flags most of the others too: what the owner calls a repeat is a board alike to one before it
 * and also simple, and the second is the scale of difficulty's to say, not the similarity's.
 */
// The owner's word of 28 October at the rebuild (`Core.alone`): a board of one event is another thought on another
// number of dice or another length of way; last-rest-1 (99, three moves) is so kept from the boards of one 5-combo before it.
const REPEATS_MISSED: readonly string[] = ['49 hidden-face-3', '99 last-rest-1'];
const FLAGGED_NOT_CALLED: readonly string[] = [
  '54 bridge-5', '55 hidden-face-1', '62 dd-62-fours-around', '63 fixed-combo-1', '66 two-lifts-1', '67 dd-25-pocket',
  '69 act-k23', '70 dd-11-wood-pushes', '77 P09', '78 far-faces-1', '81 trap-5',
  '83 dd-14-turn-to-fours', '85 P06', '86 ones-over-leaving-1', '87 act-k21', '88 tight-room-5', '91 tight-room-1',
  '93 ones-broom-below-1', '94 collapse-after-prep-1', '95 dd-13-stone-row', '96 dd-19-three-threes-apart', '100 finale-1',
];

describe('rule 17 on row 0.2.87', () => {
  const flags = flaggedBy(PLAYED);

  it('judges every place from the 31st on against every place before it', () => {
    expect([...flags.keys()]).toEqual(PLAYED.filter((place) => place.number >= 31).map((place) => place.number));
    const two = flags.get(51)!;
    expect([two.at, two.sim, two.flagged]).toEqual([50, 1, true]); // two-combos-5 after two-combos-3: one core
    expect(two.nearAt).toBe(50);
  });

  it('flags 21 of the 23 places 48-100 the owner called repeats, and 22 of the other 30', () => {
    const late = PLAYED.filter((place) => place.number >= 48);
    const said = (place: (typeof late)[number]) => `${place.number} ${place.code}`;
    const missed = late.filter((place) => OWNER_REPEATS.includes(place.code) && !flags.get(place.number)!.flagged).map(said);
    const others = late.filter((place) => !OWNER_REPEATS.includes(place.code) && flags.get(place.number)!.flagged).map(said);
    expect(missed).toEqual(REPEATS_MISSED);
    expect(others).toEqual(FLAGGED_NOT_CALLED);
  });
});
