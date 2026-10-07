import { describe, expect, it } from 'vitest';
import { HANDS, HEADS, RUSH, SKILLS, SKILL_NAMES, STYLE_NAMES, createBot, findPlans, findWayUp, lookTicks, missOf, pressure, sight, skillOf, slipOf, styled, type Plan } from './bot';
import { playPace } from './paceBot';
import { emptyRun, land, place, put, putOri } from './testkit';
import type { Dir, MoveKind } from './types';

describe('ways to a clear', () => {
  it('sees a clear one roll away', () => {
    const s = emptyRun();
    put(s, 3, 3, 2);
    // Rolled east, the die under the player shows the face that was on its west side.
    putOri(s, 1, 3, { west: 2 });
    place(s, 1, 3, 'top');
    const [plan] = findPlans(s, 3, 200);
    expect(plan.moves).toEqual(['E']);
    expect(plan.kinds).toEqual(['roll']);
    expect(plan.points).toBe(4); // two 2s
    expect(plan.chain).toBe(1);
    expect(plan.dice).toBe(2);
  });

  it('sees a clear two moves away: over to the next die, then a roll', () => {
    const s = emptyRun();
    put(s, 3, 3, 2);
    put(s, 0, 3, 6);
    putOri(s, 1, 3, { west: 2 });
    place(s, 0, 3, 'top');
    const [plan] = findPlans(s, 3, 200);
    expect(plan.moves).toEqual(['E', 'E']);
    expect(plan.kinds).toEqual(['hop', 'roll']);
  });

  it('sees no further than it is told to look', () => {
    const s = emptyRun();
    put(s, 3, 3, 2);
    put(s, 0, 3, 6);
    putOri(s, 1, 3, { west: 2 });
    place(s, 0, 3, 'top');
    expect(findPlans(s, 1, 200)).toEqual([]);
    expect(findPlans(s, 2, 200).length).toBeGreaterThan(0);
    // Nor through more positions than it can hold in its head.
    expect(findPlans(s, 2, 2)).toEqual([]);
  });

  it('walks as far as it is let, but turns over in its head only so many dice', () => {
    const s = emptyRun();
    // Three dice in a row to walk over, the last of them a roll away from a clear.
    put(s, 0, 3, 6);
    put(s, 1, 3, 5);
    putOri(s, 2, 3, { west: 2 });
    put(s, 4, 3, 2);
    place(s, 0, 3, 'top');
    const [plan] = findPlans(s, 4, 300, 8, 1);
    expect(plan.moves).toEqual(['E', 'E', 'E']);
    expect(plan.kinds).toEqual(['hop', 'hop', 'roll']);
    // With no roll allowed there is nothing to find; nor is there within two moves.
    expect(findPlans(s, 4, 300, 8, 0)).toEqual([]);
    expect(findPlans(s, 2, 300, 8, 1)).toEqual([]);
    // Every way found keeps to the number of rolls.
    for (const way of findPlans(s, 6, 600, 8, 1)) {
      expect(way.kinds.filter((kind) => kind === 'roll' || kind === 'push').length).toBeLessThanOrEqual(1);
    }
  });

  it('knows what a die brought to a running chain is worth', () => {
    const s = emptyRun();
    put(s, 2, 3, 3);
    put(s, 3, 3, 3);
    land(s, put(s, 4, 3, 3));
    expect(s.reactions).toMatchObject([{ chain: 1, total: 3 }]);
    putOri(s, 6, 3, { east: 3 });
    place(s, 6, 3, 'top');
    const [plan] = findPlans(s, 3, 200);
    expect(plan.moves).toEqual(['W']);
    expect(plan.chain).toBe(2);
    expect(plan.points).toBe(24); // 3 x four dice x the second link
    expect(plan.dice).toBe(1); // the link takes one die more
  });

  it('sees a push from the floor that clears', () => {
    const s = emptyRun();
    put(s, 3, 3, 2);
    put(s, 1, 3, 2);
    place(s, 0, 3, 'ground');
    const [plan] = findPlans(s, 3, 200);
    expect(plan.moves).toEqual(['E']);
    expect(plan.kinds).toEqual(['push']);
    expect(plan.points).toBe(4);
  });

  it('leaves the board as it was', () => {
    const s = emptyRun();
    put(s, 3, 3, 2);
    putOri(s, 1, 3, { west: 2 });
    place(s, 1, 3, 'top');
    const before = JSON.stringify(s);
    findPlans(s, 4, 500);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('the way back up', () => {
  it('leads from the floor onto the nearest die that can be stepped onto', () => {
    const s = emptyRun();
    // A die at the edge cannot be pushed: from the floor it is stepped onto.
    put(s, 6, 3, 5);
    place(s, 2, 3, 'ground');
    expect(findWayUp(s, 12)).toEqual(['E', 'E', 'E', 'E']);
  });

  it('is nothing for a player who is up already', () => {
    const s = emptyRun();
    put(s, 6, 3, 5);
    place(s, 6, 3, 'top');
    expect(findWayUp(s, 12)).toEqual([]);
  });
});

describe('what a player notices', () => {
  const way = (moves: Dir[], kinds: MoveKind[]): Plan => ({ moves, kinds, points: 4, chain: 1 });

  it('sees best a clear one roll away that turns up a face the camera shows', () => {
    for (const skill of Object.values(SKILLS)) {
      const shown = sight(skill, way(['N'], ['roll']));
      expect(shown).toBeCloseTo(1 - skill.miss);
      expect(sight(skill, way(['W'], ['roll']))).toBeCloseTo(shown);
      // The north and the west face are turned away from the camera: they have to be worked out.
      expect(sight(skill, way(['S'], ['roll']))).toBeLessThan(shown);
      expect(sight(skill, way(['E'], ['roll']))).toBeLessThan(shown);
      // Every roll after the first is a die turned over in the head.
      expect(sight(skill, way(['N', 'N'], ['roll', 'roll']))).toBeLessThan(shown);
      expect(sight(skill, way(['N', 'N', 'N'], ['roll', 'roll', 'roll']))).toBeLessThan(sight(skill, way(['N', 'N'], ['roll', 'roll'])));
    }
  });

  it('takes a step to another die or a push for what it is: the top of the die stays in sight', () => {
    for (const skill of Object.values(SKILLS)) {
      const shown = sight(skill, way(['N'], ['roll']));
      expect(sight(skill, way(['E', 'N'], ['hop', 'roll']))).toBeCloseTo(shown);
      expect(sight(skill, way(['S'], ['push']))).toBeCloseTo(shown);
    }
  });

  it('sees more, the better the player: five of them, from one who hardly sees a clear to one who plays for a living', () => {
    expect(SKILL_NAMES).toEqual(['newbie', 'novice', 'average', 'pro', 'esports']);
    const two = way(['N', 'S'], ['roll', 'roll']);
    for (let i = 1; i < SKILL_NAMES.length; i++) {
      expect(sight(SKILLS[SKILL_NAMES[i]], two)).toBeGreaterThan(sight(SKILLS[SKILL_NAMES[i - 1]], two));
    }
  });
});

describe('how long a player looks', () => {
  it('longer at a way of more moves and at a board with more on it', () => {
    for (const skill of Object.values(SKILLS)) {
      expect(lookTicks(skill, 14, 14, 3)).toBeGreaterThan(lookTicks(skill, 14, 14, 1));
      expect(lookTicks(skill, 40, 14, 1)).toBeGreaterThan(lookTicks(skill, 14, 14, 1));
      expect(lookTicks(skill, 8, 14, 1)).toBe(lookTicks(skill, 14, 14, 1));
    }
  });

  it('shorter, the better the player', () => {
    for (let i = 1; i < SKILL_NAMES.length; i++) {
      expect(lookTicks(SKILLS[SKILL_NAMES[i]], 30, 14, 2)).toBeLessThan(lookTicks(SKILLS[SKILL_NAMES[i - 1]], 30, 14, 2));
    }
  });
});

describe('a player made of rules', () => {
  const play = (skill: keyof typeof SKILLS, seed: number, minutes = 3) => playPace({ skill, seed, limitMinutes: minutes });

  it('plays one run for one seed', () => {
    expect(play('average', 3, 2)).toEqual(play('average', 3, 2));
    expect(play('average', 4, 2)).not.toEqual(play('average', 3, 2));
  });

  it('plays as it did before its head and hands were set apart', () => {
    const keep = (run: ReturnType<typeof play>) => ({ score: run.score, removed: run.removed, steps: run.steps, clears: run.clears, chains: run.chains, maxChain: run.maxChain, seconds: run.seconds });
    // The numbers are those of the rules the session is played by: they were taken anew on
    // 7 October, when a cube that comes or goes stopped holding the player.
    expect(keep(play('average', 3, 2))).toEqual({ score: 1413, removed: 32, steps: 132, clears: 25, chains: 16, maxChain: 9, seconds: 120 });
    expect(keep(play('newbie', 5, 2))).toEqual({ score: 43, removed: 8, steps: 59, clears: 5, chains: 1, maxChain: 2, seconds: 120 });
  });

  // Thirty runs of three minutes: with the whole suite beside them, on a slow machine, more than the usual five seconds.
  it('scores more and clears more, the better it is', { timeout: 30_000 }, () => {
    const total = (skill: keyof typeof SKILLS, read: (run: ReturnType<typeof play>) => number) =>
      [1, 2, 3].reduce((sum, seed) => sum + read(play(skill, seed)), 0);
    const scores = SKILL_NAMES.map((skill) => total(skill, (run) => run.score));
    const cleared = SKILL_NAMES.map((skill) => total(skill, (run) => run.removed));
    expect(scores[0]).toBeGreaterThan(0);
    for (let i = 1; i < SKILL_NAMES.length; i++) {
      expect(scores[i]).toBeGreaterThan(scores[i - 1]);
      expect(cleared[i]).toBeGreaterThan(cleared[i - 1]);
    }
  });

  it('makes chains when it is good, and few when it is new', () => {
    const chains = (skill: keyof typeof SKILLS) => [1, 2, 3].reduce((sum, seed) => sum + play(skill, seed).chains, 0);
    expect(chains('pro')).toBeGreaterThan(chains('novice'));
    expect(chains('esports')).toBeGreaterThan(chains('newbie'));
    expect(Math.max(...[1, 2, 3].map((seed) => play('pro', seed).maxChain))).toBeGreaterThanOrEqual(3);
  });

  it('says how much the board swings with the waves: fuller at a crest than in the rest after it', () => {
    const run = play('average', 2, 4);
    expect(run.swing).toBeGreaterThan(0);
  });

  it('hardly ever walks into a wall: its moves are ones the game takes', () => {
    for (const skill of SKILL_NAMES) {
      const result = play(skill, 5, 2);
      expect(result.steps).toBeGreaterThan(20);
      expect(result.blocked).toBeLessThan(result.steps * 0.05);
    }
  });
});

describe('a head and hands', () => {
  it('make the five players as they were: a head and the hands of the same name', () => {
    for (const name of SKILL_NAMES) {
      expect(SKILLS[name]).toEqual({ ...HEADS[name], ...HANDS[name] });
      expect(skillOf(name, name)).toEqual(SKILLS[name]);
      expect(SKILLS[name].rush).toBe(0);
    }
    expect(SKILLS.average).toMatchObject({ depth: 6, rolls: 2, budget: 320, think: [28, 65], thinkPerMove: 10, thinkPerCube: 1.5, pause: [4, 10], idle: [8, 25], miss: 0.2, missPerRoll: 0.4, lapse: 0.06, lapseTicks: [40, 100], slip: 0.04, greed: 0.5, tidy: true });
  });

  it('are set apart: one who sees far and moves slowly is a player too', () => {
    const slow = skillOf('pro', 'newbie');
    expect(slow.depth).toBe(SKILLS.pro.depth);
    expect(slow.miss).toBe(SKILLS.pro.miss);
    expect(slow.think).toEqual(SKILLS.newbie.think);
    expect(slow.slip).toBe(SKILLS.newbie.slip);
  });

  it('have hands that take no time and make no mistake: the most a head can do', () => {
    expect(HANDS.instant).toEqual({ think: [0, 0], thinkPerMove: 0, thinkPerCube: 0, pause: [0, 0], idle: [0, 0], lapse: 0, lapseTicks: [0, 0], slip: 0, rush: 0 });
    expect(skillOf('esports', 'instant').depth).toBe(SKILLS.esports.depth);
  });
});

describe('a player under pressure', () => {
  const board = (cubes: number) => {
    const s = emptyRun();
    return { ...s, cubes: new Array(cubes).fill(s.cubes[0] ?? {}) } as typeof s;
  };

  it('is calm on a board that holds no more than it is kept at, and pressed to the full at the danger mark', () => {
    const { targetCubes, warnOccupied } = emptyRun().config;
    expect(pressure(board(0))).toBe(0);
    expect(pressure(board(targetCubes))).toBe(0);
    expect(pressure(board(warnOccupied))).toBe(1);
    expect(pressure(board(warnOccupied + 5))).toBe(1);
    const half = pressure(board(Math.round((targetCubes + warnOccupied) / 2)));
    expect(half).toBeGreaterThan(0.3);
    expect(half).toBeLessThan(0.7);
  });

  it('slips and overlooks no more than ever with no rush in its hands', () => {
    expect(slipOf(SKILLS.newbie, 1)).toBe(SKILLS.newbie.slip);
    expect(missOf(SKILLS.newbie, 1)).toBe(SKILLS.newbie.miss);
  });

  it('slips and overlooks more, the fuller the board, with a rush: so many times more at the danger mark', () => {
    const rushed = { ...SKILLS.average, rush: 2 };
    expect(slipOf(rushed, 0)).toBe(rushed.slip);
    expect(slipOf(rushed, 0.5)).toBeCloseTo(rushed.slip * 2);
    expect(slipOf(rushed, 1)).toBeCloseTo(rushed.slip * 3);
    expect(missOf(rushed, 1)).toBeCloseTo(rushed.miss * 3);
    expect(missOf({ ...SKILLS.newbie, rush: 9 }, 1)).toBe(0.95);
    expect(slipOf({ ...SKILLS.newbie, slip: 0.5, rush: 9 }, 1)).toBe(1);
  });

  it('sees a way the worse for it', () => {
    const one: Plan = { moves: ['E'], kinds: ['roll'], points: 4, chain: 1, dice: 2 };
    const rushed = { ...SKILLS.average, rush: 2 };
    expect(sight(rushed, one, 1)).toBeLessThan(sight(rushed, one, 0));
    expect(sight(rushed, one)).toBe(sight(SKILLS.average, one));
  });

  it('has a rush for every pair of hands, less for the better', () => {
    for (let i = 1; i < SKILL_NAMES.length; i++) expect(RUSH[SKILL_NAMES[i]]).toBeLessThan(RUSH[SKILL_NAMES[i - 1]]);
  });
});

describe('what a player is after', () => {
  const plan = (over: Partial<Plan>): Plan => ({ moves: ['E'], kinds: ['roll'], points: 4, chain: 1, value: 2, dice: 2, ...over });

  /** A group of 2s on its way down, and the player on a die one roll away from joining it with a 2. */
  const withChain = () => {
    const s = emptyRun();
    put(s, 2, 3, 2);
    put(s, 3, 3, 2);
    land(s, put(s, 4, 3, 2));
    // Rolled west, the die under the player shows the face that was on its east side.
    putOri(s, 6, 3, { east: 2 });
    place(s, 6, 3, 'top');
    return s;
  };

  it('has three styles, and the plain one changes nothing', () => {
    expect(STYLE_NAMES).toEqual(['plain', 'survivor', 'builder']);
    const bot = createBot(SKILLS.average, 1);
    expect(styled(createBot(SKILLS.average, 1), 'plain')).toEqual(bot);
  });

  it('keeps the board low as a survivor: the clear that takes the most dice, whatever it scores', () => {
    const bot = styled(createBot(SKILLS.pro, 1), 'survivor');
    expect(bot.skill.greed).toBe(0);
    const s = emptyRun();
    expect(bot.prefer!(plan({ dice: 5, points: 5 }), s)).toBeGreaterThan(Number(bot.prefer!(plan({ dice: 2, points: 12 }), s)));
  });

  it('plays for chains as a builder: a link before anything else while one runs', () => {
    const bot = styled(createBot(SKILLS.novice, 1), 'builder');
    expect(bot.skill.greed).toBe(1);
    const s = withChain();
    expect(s.reactions).toMatchObject([{ chain: 1, total: 3 }]);
    expect(findPlans(s, 3, 200)[0]).toMatchObject({ moves: ['W'], chain: 2, value: 2 });
    expect(Number(bot.prefer!(plan({ chain: 2 }), s))).toBeGreaterThan(Number(bot.prefer!(plan({ chain: 1 }), s)));
    expect(Number(bot.prefer!(plan({ chain: 3 }), s))).toBeGreaterThan(Number(bot.prefer!(plan({ chain: 2 }), s)));
    expect(bot.wants!(2, s)).toBe(true);
    expect(bot.wants!(5, s)).toBe(false);
  });

  it('opens, as a builder, with the group that has the most dice of its face left to feed it', () => {
    const bot = styled(createBot(SKILLS.novice, 1), 'builder');
    const s = emptyRun();
    put(s, 0, 0, 3);
    put(s, 2, 0, 3);
    put(s, 4, 0, 3);
    put(s, 6, 0, 3);
    put(s, 0, 6, 2);
    put(s, 2, 6, 2);
    // Four 3s stand about and three make the group: one is left to feed it. Two 2s make theirs and none is left.
    expect(Number(bot.prefer!(plan({ value: 3, dice: 3 }), s))).toBeGreaterThan(Number(bot.prefer!(plan({ value: 2, dice: 2 }), s)));
    expect(bot.wants!(3, s)).toBe(false);
  });
});
