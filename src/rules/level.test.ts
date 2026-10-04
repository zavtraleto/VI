import { describe, expect, it } from 'vitest';
import { DELTA, DIRS, cubeAt, cubeHeight } from './board';
import { SKILLS, botCommand, createBot } from './bot';
import { defaultConfig } from './config';
import { LEVEL_GHOST_HEIGHT, LEVEL_SINK_MOVES, LEVEL_UNDOS, chainWindows, goalLines, goalOf, goalReached, levelConfig, levelStuck, shortGroups, worldRuns } from './level';
import { previewMove } from './preview';
import { createRun, step } from './sim';
import { hasReadyGroup, population } from './spawn';
import { act, levelRun, place, put, putOri, run } from './testkit';
import type { Cube, Dir, GameEvent, LevelGoal, LevelLayout, LevelSpec, RunState } from './types';

const BEAT = defaultConfig().actionTicks;
const BASE: LevelSpec = { id: 'test', seed: 1, size: 5, goal: { kind: 'send', count: 999 }, moves: 0, values: [2, 3], norm: 8, arrival: 'refill' };

/** A level as it is played: a board of its own, dice at the start, more of them coming unless it says otherwise. */
function level(spec: Partial<LevelSpec> = {}): RunState {
  const full: LevelSpec = { ...BASE, ...spec };
  return createRun({ seed: full.seed, config: defaultConfig(), level: full });
}

/**
 * Two 2s wait to be made a group: the die at (2,0) rolled west shows its 2 beside the 2 at (0,0).
 * The die at (1,1) is the one that goes on moving: it shows a 6 and its south face is a 2, so
 * rolled east and west it never shows a 2, and rolled north it does. The player is up on the
 * die at (2,0).
 */
function pair(spec: Partial<LevelSpec> = {}): RunState {
  const s = levelRun(spec);
  put(s, 0, 0, 2);
  putOri(s, 2, 0, { top: 6, east: 2 });
  putOri(s, 1, 1, { top: 6, south: 2 });
  place(s, 2, 0, 'top');
  return s;
}

/** Makes the group of two 2s and steps over to the die that goes on moving. */
function group(s: RunState): void {
  act(s, 'W');
  act(s, 'S');
}

/** One move that clears nothing: the die under the player is rolled into a cell that stands empty. */
function idleMove(s: RunState): void {
  for (const dir of DIRS) {
    const seen = previewMove(s, dir);
    const empty = cubeAt(s, s.player.x + DELTA[dir].dx, s.player.z + DELTA[dir].dz) === undefined;
    if (seen.kind === 'roll' && !seen.clears && empty) {
      act(s, dir);
      return;
    }
  }
  throw new Error('no roll that clears nothing');
}

/** Dice that are not on their way out. */
function standing(s: RunState): Cube[] {
  return s.cubes.filter((c) => c.state !== 'sinking');
}

/** Dice that have come and are not whole yet. */
function coming(s: RunState): Cube[] {
  return s.cubes.filter((c) => c.state === 'rising');
}

function types(events: readonly GameEvent[]): string[] {
  return events.map((e) => e.type);
}

describe('config of a level', () => {
  it('takes the board, the number of dice and the window of a group from the level', () => {
    const base = defaultConfig();
    const config = levelConfig(base, { ...BASE, goal: { kind: 'send', count: 6 } });
    expect(config).toMatchObject({ size: 5, startX: 2, startZ: 2, startCubes: 8, targetCubes: 8, helpRate: 0.65 });
    expect(config.sinkingTicks).toBe(LEVEL_SINK_MOVES * BEAT + 1);
    expect(config.sinkStartTicks).toBe(config.sinkingTicks);
    expect(config.sinkFloorTicks).toBe(config.sinkingTicks);
    expect(Math.round(config.sinkingTicks * config.chainLift)).toBe(2 * BEAT);
    expect(config.chainLiftMin).toBe(config.chainLift);
    expect(config.warnOccupied).toBe(25);
    expect(config.wipeBonus).toBe(0);
    expect(config.feedRate).toBe(base.feedRate);
    expect(config.rulesVersion).toBe(base.rulesVersion);
  });

  it('lets a die come with no warning, half up, and whole a beat later', () => {
    const config = levelConfig(defaultConfig(), BASE);
    expect(config.warnTicks).toBe(0);
    expect(config.risingTicks).toBe(2 * BEAT);
    expect((config.risingTicks - BEAT) / config.risingTicks).toBe(LEVEL_GHOST_HEIGHT);
    // What can be rolled over as it rises is rolled over at that height.
    expect(LEVEL_GHOST_HEIGHT).toBeLessThanOrEqual(config.lowHeight);
  });

  it('makes a die that sinks glass at once', () => {
    const config = levelConfig(defaultConfig(), BASE);
    expect(config.sinkLowHeight).toBe(1);
    expect(config.stepDownHeight).toBe(1);
  });

  it('follows the numbers a level gives of its own', () => {
    const config = levelConfig(defaultConfig(), { ...BASE, size: 7, values: [2], norm: 14, helpRate: 0.2, feedRate: 1, sinkMoves: 4, liftMoves: 1 });
    expect(config.sinkingTicks).toBe(4 * BEAT + 1);
    expect(Math.round(config.sinkingTicks * config.chainLift)).toBe(BEAT);
    expect(config.helpRate).toBe(0.2);
    expect(config.feedRate).toBe(1);
    expect(config.startX).toBe(3);
  });

  it('keeps the steps of the floor and switches off everything that belongs to the pace', () => {
    const base = defaultConfig();
    const config = levelConfig(base, BASE);
    expect(config.experiments).toMatchObject({
      floorClimb: true, dockSteps: true, soloOne: false, gentleStart: false, floorLift: false, chainCalm: false,
      timeFloor: false, waves: false, surge: false, opening: false, lastSliver: false, gift: false,
    });
    // The config it was given is not touched: its experiments are an object of its own.
    expect(config.experiments).not.toBe(base.experiments);
    expect(base.experiments.waves).toBe(true);
    expect(base.size).toBe(7);
    expect(base.sinkLowHeight).toBeLessThan(1);
  });
});

describe('start of a level', () => {
  const boards: Partial<LevelSpec>[] = [
    { size: 5, values: [2, 3], norm: 8 },
    { size: 5, values: [2, 3, 4], norm: 8 },
    { size: 5, values: [2, 3, 4], norm: 16 },
    { size: 7, values: [2, 3, 4, 5], norm: 14 },
    { size: 7, values: [1, 2, 3, 4, 5, 6], norm: 14 },
  ];

  /** A group that lacks one die is a roll away: with the die under the player, or with the one beside it. */
  function opens(s: RunState): boolean {
    if (DIRS.some((dir) => previewMove(s, dir).clears)) return true;
    return DIRS.some((dir) => {
      if (previewMove(s, dir).kind !== 'hop') return false;
      const next = structuredClone(s);
      act(next, dir);
      return DIRS.some((d) => previewMove(next, d).clears);
    });
  }

  it('stands its number of dice with the player on the one in the middle, and nothing ready to clear', () => {
    for (const board of boards) {
      for (let seed = 1; seed <= 16; seed++) {
        const s = level({ ...board, seed });
        const size = board.size!;
        expect(s.mode).toBe('level');
        expect(s.cubes).toHaveLength(board.norm!);
        expect(s.cubes.every((c) => c.state === 'idle')).toBe(true);
        const middle = Math.floor(size / 2);
        expect(s.player).toEqual({ x: middle, z: middle, level: 'top' });
        expect(cubeAt(s, middle, middle)).toBeDefined();
        const tops = new Array<number>(size * size).fill(0);
        for (const c of s.cubes) tops[c.z * size + c.x] = c.ori.top;
        expect(hasReadyGroup(tops, size)).toBe(false);
      }
    }
  });

  it('shows only the faces of the level', () => {
    for (const board of boards) {
      for (let seed = 1; seed <= 16; seed++) {
        const s = level({ ...board, seed });
        for (const c of s.cubes) expect(board.values).toContain(c.ori.top);
      }
    }
  });

  it('always opens on a group that lacks one die, a roll away', () => {
    for (const board of boards) {
      for (let seed = 1; seed <= 16; seed++) expect(opens(level({ ...board, seed }))).toBe(true);
    }
  });

  it('is the same for one seed and another for another', () => {
    const cubes = (seed: number) => JSON.stringify(level({ seed }).cubes);
    expect(cubes(5)).toBe(cubes(5));
    expect(cubes(5)).not.toBe(cubes(6));
  });

  it('keeps the state of a level and leaves other runs without it', () => {
    const s = level({ goal: { kind: 'send', count: 6 }, moves: 12 });
    expect(s.levelRun).toMatchObject({ moves: 0, sent: [0, 0, 0, 0, 0, 0], bestChain: 0, beat: 0 });
    expect(s.levelRun!.spec.moves).toBe(12);
    expect(s.tutorial).toBeNull();
    expect(s.puzzle).toBeNull();
    expect(s.spawnEnabled).toBe(false);
    expect(createRun({ seed: 1, config: defaultConfig() }).levelRun).toBeNull();
  });

  it('gives up with the name of the level when no board can be laid', () => {
    // A single face leaves nothing for the die of the opening to show before its roll.
    expect(() => level({ id: 'p99', values: [2] })).toThrow(/p99/);
  });
});

describe('the world of a level', () => {
  it('stands still while nobody moves: empty ticks change nothing, the tick included', () => {
    const s = levelRun();
    put(s, 0, 0, 5);
    put(s, 4, 4, 2, 'sinking');
    put(s, 4, 0, 3, 'rising');
    const before = JSON.stringify(s);
    run(s, 200);
    expect(JSON.stringify(s)).toBe(before);
    expect(s.tick).toBe(0);
    expect(worldRuns(s)).toBe(false);
  });

  it('stands still for a step that moves no die, and such a step is not a move', () => {
    // (A step onto a die that is still coming is the one that does not leave the world still: see the beat of its own.)
    /** The die going down in the corner is the clock: it sinks only when the world moves. */
    const board = (): RunState => {
      const s = levelRun();
      put(s, 4, 4, 2, 'sinking');
      return s;
    };
    const still = (s: RunState, kind: string, dir: Dir) => {
      step(s, dir);
      expect(s.events).toContainEqual({ type: 'move', kind, dir });
      run(s, 3 * BEAT);
      expect(s.tick).toBe(0);
      expect(s.levelRun!.moves).toBe(0);
      expect(cubeAt(s, 4, 4)!.t).toBe(0);
    };

    const hop = board();
    put(hop, 1, 1, 5);
    put(hop, 2, 1, 6);
    place(hop, 1, 1, 'top');
    still(hop, 'hop', 'E');

    const walk = board();
    put(walk, 0, 0, 5);
    still(walk, 'walk', 'N');

    // A die at the wall cannot be pushed: from the floor it is stepped onto.
    const climb = board();
    put(climb, 0, 2, 5);
    place(climb, 1, 2, 'ground');
    still(climb, 'climb', 'W');

    const mount = board();
    put(mount, 0, 0, 5);
    put(mount, 2, 1, 3, 'sinking').t = 30;
    still(mount, 'mount', 'N');

    // A die that sinks is stepped off at any height.
    const descend = board();
    put(descend, 0, 0, 5);
    put(descend, 1, 1, 3, 'sinking');
    place(descend, 1, 1, 'top');
    still(descend, 'descend', 'E');
    expect(descend.player.level).toBe('ground');
  });

  it('moves by one beat with a roll and with a push, and each of them is a move', () => {
    const roll = levelRun();
    put(roll, 4, 4, 2, 'sinking');
    put(roll, 1, 1, 5);
    place(roll, 1, 1, 'top');
    step(roll, 'E');
    expect(roll.events).toContainEqual({ type: 'move', kind: 'roll', dir: 'E' });
    expect(roll.levelRun!.moves).toBe(1);
    expect(worldRuns(roll)).toBe(true);
    run(roll, 5 * BEAT);
    expect(roll.tick).toBe(BEAT);
    expect(cubeAt(roll, 4, 4)!.t).toBe(BEAT);
    expect(worldRuns(roll)).toBe(false);

    const push = levelRun();
    put(push, 4, 4, 2, 'sinking');
    put(push, 2, 1, 5);
    step(push, 'N');
    expect(push.events).toContainEqual({ type: 'move', kind: 'push', dir: 'N' });
    expect(push.levelRun!.moves).toBe(1);
    run(push, 5 * BEAT);
    expect(push.tick).toBe(BEAT);
    expect(cubeAt(push, 4, 4)!.t).toBe(BEAT);
    expect(cubeAt(push, 2, 0)?.state).toBe('idle');
  });

  it('counts a beat for every move made one after another', () => {
    const s = levelRun();
    put(s, 4, 4, 2, 'sinking');
    put(s, 1, 1, 5);
    place(s, 1, 1, 'top');
    // A held direction: the command is there on every tick.
    let made = 0;
    for (let i = 0; i < 3 * BEAT + 1; i++) {
      if (step(s, made % 2 === 0 ? 'E' : 'W')) made++;
    }
    run(s, 5 * BEAT);
    expect(made).toBe(4);
    expect(s.levelRun!.moves).toBe(4);
    expect(s.tick).toBe(4 * BEAT);
  });

  it('does nothing for a step the board refuses', () => {
    const s = levelRun();
    put(s, 4, 4, 2, 'sinking');
    put(s, 0, 0, 5);
    place(s, 0, 0, 'top');
    expect(step(s, 'N')).toBe(true);
    expect(types(s.events)).toEqual(['blocked']);
    run(s, 3 * BEAT);
    expect(s.tick).toBe(0);
    expect(s.levelRun!.moves).toBe(0);
    expect(cubeAt(s, 4, 4)!.t).toBe(0);
    expect(s.player).toEqual({ x: 0, z: 0, level: 'top' });
  });
});

describe('the window of a group', () => {
  it('is six moves, counted down with every move made', () => {
    const s = pair();
    group(s);
    expect(s.levelRun!.moves).toBe(1);
    expect(chainWindows(s)).toEqual([{ value: 2, moves: 6 }]);
    for (let left = 5; left >= 1; left--) {
      idleMove(s);
      expect(chainWindows(s)).toEqual([{ value: 2, moves: left }]);
    }
    expect(cubeAt(s, 0, 0)?.state).toBe('sinking');
    idleMove(s);
    expect(chainWindows(s)).toEqual([]);
    expect(cubeAt(s, 0, 0)).toBeUndefined();
    expect(cubeAt(s, 1, 0)).toBeUndefined();
    expect(s.reactions).toHaveLength(0);
  });

  it('takes a die that lands on the sixth move after the group was made', () => {
    const s = pair();
    group(s);
    for (const dir of ['E', 'W', 'E', 'W', 'E'] as const) act(s, dir);
    expect(chainWindows(s)).toEqual([{ value: 2, moves: 1 }]);
    // The sixth move: north from (2,1), and the 2 comes up beside the group.
    act(s, 'N');
    expect(s.levelRun!.moves).toBe(7);
    expect(s.events).toContainEqual(expect.objectContaining({ type: 'chain', value: 2, chain: 2, count: 1 }));
    expect(s.maxChain).toBe(2);
  });

  it('is gone by the time the seventh move lands', () => {
    const s = pair();
    group(s);
    const seen: GameEvent[] = [];
    for (const dir of ['E', 'W', 'E', 'W', 'E', 'W', 'N'] as const) {
      act(s, dir);
      seen.push(...s.events);
    }
    expect(s.levelRun!.moves).toBe(8);
    // The die stands where the group was, showing its 2 to nobody.
    expect(cubeAt(s, 1, 0)).toMatchObject({ state: 'idle', ori: { top: 2 } });
    expect(types(seen)).not.toContain('chain');
    expect(s.maxChain).toBe(1);
  });

  it('gives the dice of a group two moves more for a new link', () => {
    const s = pair();
    // A die that stands throughout: with none the world would play its beats by itself.
    put(s, 4, 3, 5);
    group(s);
    for (const dir of ['E', 'W', 'E', 'W', 'E', 'N'] as const) act(s, dir);
    // The link is new: it has its own six moves, and the two dice it joined have two.
    expect(chainWindows(s)).toEqual([{ value: 2, moves: 6 }]);
    const first = cubeAt(s, 0, 0)!;
    expect(first.state).toBe('sinking');
    act(s, 'S');
    // The player has come down from the link; the next moves are made with the die at the wall.
    place(s, 4, 3, 'top');
    idleMove(s);
    expect(s.cubes).toContain(first);
    idleMove(s);
    expect(s.cubes).not.toContain(first);
    expect(chainWindows(s)).toEqual([{ value: 2, moves: 4 }]);
  });
});

describe('a die that sinks is glass at once', () => {
  it('is rolled over on the move after its group was made, and a die of its face goes on with the chain', () => {
    const s = pair();
    group(s);
    const sunk = cubeAt(s, 1, 0)!;
    // From the die that stands, the step towards the group is a roll over it and not a step onto it.
    expect(previewMove(s, 'N')).toMatchObject({ kind: 'roll', top: 2, clears: true });
    const seen: GameEvent[] = [];
    step(s, 'N');
    seen.push(...s.events);
    for (let i = 0; i < BEAT; i++) {
      step(s, null);
      seen.push(...s.events);
    }
    expect(seen).toContainEqual({ type: 'move', kind: 'roll', dir: 'N' });
    expect(seen).toContainEqual({ type: 'removed', cubeId: sunk.id });
    expect(seen).toContainEqual(expect.objectContaining({ type: 'chain', value: 2, chain: 2, count: 1 }));
    expect(s.levelRun!.moves).toBe(2);
    expect(cubeAt(s, 1, 0)).toMatchObject({ state: 'sinking', ori: { top: 2 } });
    // The die it rolled over was counted when its group was made, and is not counted again.
    expect(s.levelRun!.sent).toEqual([0, 3, 0, 0, 0, 0]);
  });

  it('is taken off the board by a die of another face, and the group goes on without it', () => {
    const s = pair();
    // Rolled north onto the 2 in the corner, this die shows a 6.
    putOri(s, 0, 1, { top: 5, south: 6 });
    group(s);
    act(s, 'W');
    expect(s.player).toMatchObject({ x: 0, z: 1, level: 'top' });
    const corner = cubeAt(s, 0, 0)!;
    const seen: GameEvent[] = [];
    step(s, 'N');
    seen.push(...s.events);
    for (let i = 0; i < BEAT; i++) {
      step(s, null);
      seen.push(...s.events);
    }
    expect(seen).toContainEqual({ type: 'removed', cubeId: corner.id });
    expect(types(seen)).not.toContain('chain');
    expect(cubeAt(s, 0, 0)).toMatchObject({ state: 'idle', ori: { top: 6 } });
    expect(chainWindows(s)).toEqual([{ value: 2, moves: 5 }]);
  });

  it('is stepped onto from another die that sinks, and stepped off to the floor at once', () => {
    const s = pair();
    act(s, 'W');
    // On the group: the other die of it is a step away, and so is the floor.
    expect(previewMove(s, 'W').kind).toBe('hop');
    expect(previewMove(s, 'E').kind).toBe('descend');
    act(s, 'W');
    expect(s.player).toMatchObject({ x: 0, z: 0, level: 'top' });
    act(s, 'S');
    expect(s.player).toMatchObject({ x: 0, z: 1, level: 'ground' });
    expect(s.levelRun!.moves).toBe(1);
  });
});

describe('dice that come to a level', () => {
  it('stand half up as glass the tick they come, and whole a beat later', () => {
    const s = pair({ norm: 4 });
    put(s, 4, 4, 6);
    s.config.feedRate = 0;
    expect(population(s)).toBe(4);
    step(s, 'W');
    run(s, BEAT - 1);
    expect(coming(s)).toHaveLength(0);
    step(s, null);
    // Two dice are on their way out: the first one to replace them is here with the move.
    expect(types(s.events)).toEqual(expect.arrayContaining(['match', 'spawn']));
    expect(types(s.events)).not.toContain('warned');
    expect(coming(s)).toHaveLength(1);
    expect(cubeHeight(coming(s)[0], s.config)).toBe(LEVEL_GHOST_HEIGHT);
    expect(s.pending).toHaveLength(0);
    const first = coming(s)[0];
    // It waits as it is for as long as the player thinks.
    run(s, 5 * BEAT);
    expect(cubeHeight(first, s.config)).toBe(LEVEL_GHOST_HEIGHT);
    act(s, 'S');
    idleMove(s);
    expect(first.state).toBe('idle');
  });

  it('come one a beat until the board is back at its number, and no further', () => {
    const s = pair({ norm: 4 });
    put(s, 4, 4, 6);
    s.config.feedRate = 0;
    group(s);
    expect([standing(s).length, coming(s).length]).toEqual([3, 1]);
    idleMove(s);
    expect([standing(s).length, coming(s).length]).toEqual([4, 1]);
    idleMove(s);
    expect([standing(s).length, coming(s).length]).toEqual([4, 0]);
    for (let i = 0; i < 8; i++) {
      idleMove(s);
      expect([standing(s).length, coming(s).length]).toEqual([4, 0]);
      expect(s.pending).toHaveLength(0);
    }
  });

  it('show only the faces of the level', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = pair({ norm: 6, seed, values: [3, 4] });
      s.config.feedRate = 0;
      const before = new Set(s.cubes.map((c) => c.id));
      group(s);
      for (let i = 0; i < 8; i++) idleMove(s);
      const came = s.cubes.filter((c) => !before.has(c.id));
      expect(came.length).toBeGreaterThanOrEqual(3);
      // The player has stayed on one die: the ones that came show what they came with.
      for (const c of came) expect([3, 4]).toContain(c.ori.top);
    }
  });

  it('bring the value of a running chain a move away from it', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = pair({ norm: 3, seed, values: [3, 4], feedRate: 1 });
      act(s, 'W');
      expect(coming(s)).toHaveLength(1);
      const { x, z, ori } = coming(s)[0];
      // Its 2 is on top, to be pushed in, or on a face the camera shows, to be rolled up.
      expect([ori.top, ori.south, ori.east]).toContain(2);
      const beside = (cx: number, cz: number) => Math.abs(cx - x) + Math.abs(cz - z) === 1;
      expect(beside(0, 0) || beside(1, 0)).toBe(false);
    }
  });

  it('come up under a player left on the floor with no way up', () => {
    const s = levelRun({ norm: 3 });
    put(s, 0, 0, 2);
    // Pushed from the floor, the 2 makes the group: no die stands, and the player is on the floor.
    put(s, 2, 0, 2);
    place(s, 3, 0, 'ground');
    act(s, 'W');
    expect(types(s.events)).toEqual(expect.arrayContaining(['match', 'spawn', 'lifted']));
    expect(cubeAt(s, 2, 0)).toMatchObject({ state: 'rising' });
    expect(s.player).toEqual({ x: 2, z: 0, level: 'top' });
  });

  it('are rolled over while they stand half up, and move to the next free cell', () => {
    const s = levelRun();
    put(s, 1, 1, 5);
    const glass = put(s, 2, 1, 3, 'rising');
    glass.t = s.config.risingTicks - BEAT;
    place(s, 1, 1, 'top');
    step(s, 'E');
    expect(types(s.events)).toEqual(expect.arrayContaining(['displaced', 'move']));
    expect(cubeAt(s, 2, 1)?.state).toBe('moving');
    expect([glass.x, glass.z]).not.toEqual([2, 1]);
    expect(Math.abs(glass.x - 2) + Math.abs(glass.z - 1)).toBe(1);
    run(s, BEAT);
    // It went on coming up from where it had got to, and stands whole with the die that rolled.
    expect(glass.state).toBe('idle');
    expect(cubeAt(s, 2, 1)?.state).toBe('idle');
  });
});

describe('a level that no dice come to', () => {
  it('gets nothing, however many moves are made', () => {
    const s = pair({ norm: 4, arrival: 'none' });
    put(s, 4, 4, 6);
    group(s);
    expect(s.cubes).toHaveLength(4);
    for (let i = 0; i < 9; i++) {
      idleMove(s);
      expect(coming(s)).toHaveLength(0);
      expect(s.pending).toHaveLength(0);
    }
    expect(s.cubes).toHaveLength(2);
    expect(s.cubes.every((c) => c.state === 'idle')).toBe(true);
  });

  it('gives no die to a player left on the floor', () => {
    const s = levelRun({ norm: 3, arrival: 'none' });
    put(s, 0, 0, 2);
    put(s, 2, 0, 2);
    put(s, 4, 4, 6);
    place(s, 3, 0, 'ground');
    act(s, 'W');
    expect(types(s.events)).toContain('match');
    expect(types(s.events)).not.toContain('spawn');
    expect(s.cubes).toHaveLength(3);
    expect(s.player.level).toBe('ground');
  });

  it('starts with its dice and plays to the end with no more', () => {
    const s = level({ arrival: 'none', norm: 10, values: [2, 3, 4], goal: { kind: 'clear' } });
    const bot = createBot(SKILLS.pro, 1);
    let most = s.cubes.length;
    for (let i = 0; i < 3000 && !s.over; i++) {
      step(s, botCommand(bot, s));
      most = Math.max(most, s.cubes.length);
      expect(coming(s)).toHaveLength(0);
    }
    expect(most).toBe(10);
    expect(s.removed).toBeGreaterThan(0);
  });
});

describe('goal of a level', () => {
  const made = (goal: LevelGoal, spec: Partial<LevelSpec> = {}): RunState => {
    const s = pair({ goal, ...spec });
    act(s, 'W');
    return s;
  };

  it('counts dice sent on the tick their group is made', () => {
    const s = pair({ goal: { kind: 'send', count: 5 } });
    expect(goalLines(s)).toEqual([{ what: 'dice', value: 0, have: 0, need: 5 }]);
    step(s, 'W');
    run(s, BEAT - 1);
    expect(s.levelRun!.sent).toEqual([0, 0, 0, 0, 0, 0]);
    step(s, null);
    expect(types(s.events)).toContain('match');
    expect(s.levelRun!.sent).toEqual([0, 2, 0, 0, 0, 0]);
    expect(goalLines(s)).toEqual([{ what: 'dice', value: 0, have: 2, need: 5 }]);
    expect(s.over).toBe(false);
  });

  it('is passed on the tick the die lands that meets it', () => {
    const s = pair({ goal: { kind: 'send', count: 2 } });
    step(s, 'W');
    run(s, BEAT - 1);
    expect(s.over).toBe(false);
    step(s, null);
    expect(types(s.events)).toEqual(expect.arrayContaining(['landed', 'match', 'levelPassed']));
    expect(s.over).toBe(true);
    expect(s.endReason).toBe('passed');
    expect(goalReached(s)).toBe(true);
    // A level that is over takes nothing more.
    expect(step(s, 'E')).toBe(false);
    expect(worldRuns(s)).toBe(false);
  });

  it('counts the dice of a link, and not again the ones it joined', () => {
    const s = made({ kind: 'send', count: 3 });
    expect(s.over).toBe(false);
    act(s, 'S');
    for (const dir of ['E', 'N'] as const) act(s, dir);
    expect(types(s.events)).toEqual(expect.arrayContaining(['chain', 'levelPassed']));
    expect(s.levelRun!.sent).toEqual([0, 3, 0, 0, 0, 0]);
  });

  it('counts an order face by face', () => {
    const goal: LevelGoal = { kind: 'order', items: [{ value: 2, count: 2 }, { value: 3, count: 3 }] };
    const s = made(goal);
    expect(goalLines(s)).toEqual([
      { what: 'face', value: 2, have: 2, need: 2 },
      { what: 'face', value: 3, have: 0, need: 3 },
    ]);
    expect(s.over).toBe(false);
    const done = made({ kind: 'order', items: [{ value: 2, count: 2 }] });
    expect(done.endReason).toBe('passed');
  });

  it('shows no more of an order than was asked for', () => {
    const s = made({ kind: 'order', items: [{ value: 2, count: 1 }, { value: 3, count: 3 }] });
    expect(goalLines(s)[0]).toEqual({ what: 'face', value: 2, have: 1, need: 1 });
  });

  it('counts the links of a chain, the group it starts with being the first', () => {
    const s = made({ kind: 'chain', links: 2 });
    expect(goalLines(s)).toEqual([{ what: 'links', value: 0, have: 1, need: 2 }]);
    expect(s.levelRun!.bestChain).toBe(1);
    expect(s.over).toBe(false);
    act(s, 'S');
    for (const dir of ['E', 'N'] as const) act(s, dir);
    expect(s.levelRun!.bestChain).toBe(2);
    expect(s.endReason).toBe('passed');
  });

  it('counts the 1s a Happy One takes', () => {
    const s = levelRun({ goal: { kind: 'send', count: 3 } });
    put(s, 0, 0, 2);
    putOri(s, 2, 0, { top: 6, east: 2 });
    // Rolled west, this die shows its 1 beside the group; the 1 in the corner goes with it.
    putOri(s, 1, 1, { top: 3, east: 1 });
    put(s, 4, 4, 1);
    place(s, 2, 0, 'top');
    group(s);
    expect(s.over).toBe(false);
    act(s, 'W');
    expect(s.events).toContainEqual(expect.objectContaining({ type: 'happyOne', count: 1 }));
    expect(s.levelRun!.sent).toEqual([1, 2, 0, 0, 0, 0]);
    expect(s.endReason).toBe('passed');
  });

  it('is told before the first move with nothing counted', () => {
    expect(goalOf({ ...BASE, goal: { kind: 'send', count: 12 } })).toEqual([{ what: 'dice', value: 0, have: 0, need: 12 }]);
    expect(goalOf({ ...BASE, goal: { kind: 'chain', links: 5 } })).toEqual([{ what: 'links', value: 0, have: 0, need: 5 }]);
    expect(goalOf({ ...BASE, norm: 16, goal: { kind: 'clear' } })).toEqual([{ what: 'cleared', value: 0, have: 0, need: 16 }]);
    expect(goalOf({ ...BASE, goal: { kind: 'order', items: [{ value: 4, count: 4 }] } })).toEqual([{ what: 'face', value: 4, have: 0, need: 4 }]);
  });

  it('is nothing for a run that is not a level', () => {
    const run = createRun({ seed: 1, config: defaultConfig() });
    expect(goalLines(run)).toEqual([]);
    expect(goalReached(run)).toBe(false);
    expect(levelStuck(run)).toBe(false);
  });
});

describe('a board to be cleared', () => {
  const clear = (dice: number): RunState => levelRun({ goal: { kind: 'clear' }, arrival: 'none', norm: dice });

  it('counts the dice that no longer stand, and is passed on the tick the last of them joins a group', () => {
    const s = clear(2);
    put(s, 0, 0, 2);
    putOri(s, 2, 0, { top: 6, east: 2 });
    place(s, 2, 0, 'top');
    expect(goalLines(s)).toEqual([{ what: 'cleared', value: 0, have: 0, need: 2 }]);
    step(s, 'W');
    run(s, BEAT - 1);
    expect(s.over).toBe(false);
    step(s, null);
    expect(goalLines(s)).toEqual([{ what: 'cleared', value: 0, have: 2, need: 2 }]);
    expect(types(s.events)).toEqual(expect.arrayContaining(['match', 'levelPassed']));
    expect(s.endReason).toBe('passed');
  });

  it('is not passed while a die stands', () => {
    const s = clear(3);
    put(s, 0, 0, 2);
    putOri(s, 2, 0, { top: 6, east: 2 });
    put(s, 4, 4, 5);
    place(s, 2, 0, 'top');
    act(s, 'W');
    expect(goalLines(s)).toEqual([{ what: 'cleared', value: 0, have: 2, need: 3 }]);
    expect(s.over).toBe(false);
  });

  it('is lost at a dead end: one die stands and no group is open for it', () => {
    const s = clear(3);
    put(s, 0, 0, 2);
    putOri(s, 2, 0, { top: 6, east: 2 });
    put(s, 4, 4, 5);
    place(s, 2, 0, 'top');
    expect(levelStuck(s)).toBe(false);
    act(s, 'W');
    // The group is open: the last die can still be brought to it showing a 2.
    expect(levelStuck(s)).toBe(false);
    expect(s.over).toBe(false);
    place(s, 4, 4, 'top');
    for (let i = 0; i < LEVEL_SINK_MOVES - 1; i++) {
      idleMove(s);
      expect(s.over).toBe(false);
    }
    // The move the group is gone with: the level ends on the tick its die lands.
    step(s, DIRS.find((dir) => previewMove(s, dir).kind === 'roll')!);
    run(s, BEAT - 1);
    expect(s.over).toBe(false);
    step(s, null);
    expect(s.reactions).toHaveLength(0);
    expect(types(s.events)).toEqual(expect.arrayContaining(['landed', 'removed', 'levelFailed']));
    expect(s.over).toBe(true);
    expect(s.endReason).toBe('failed');
    // Why it ended is still there to be told.
    expect(levelStuck(s)).toBe(true);
    expect(s.levelRun!.moves).toBe(1 + LEVEL_SINK_MOVES);
  });

  it('goes on while the last die can still be brought to the group that is going', () => {
    const s = clear(3);
    put(s, 0, 0, 2);
    putOri(s, 2, 0, { top: 6, east: 2 });
    // Rolled north twice, over the die that is going, this one shows the 2 it stood on.
    putOri(s, 1, 2, { top: 5, south: 3 });
    place(s, 2, 0, 'top');
    act(s, 'W');
    place(s, 1, 2, 'top');
    act(s, 'N');
    expect(s.over).toBe(false);
    expect(levelStuck(s)).toBe(false);
    act(s, 'N');
    expect(s.events).toContainEqual(expect.objectContaining({ type: 'chain', value: 2 }));
    expect(s.endReason).toBe('passed');
  });

  it('is not lost with two dice standing, whatever they show', () => {
    const s = clear(4);
    put(s, 0, 0, 2);
    putOri(s, 2, 0, { top: 6, east: 2 });
    put(s, 4, 4, 5);
    put(s, 0, 4, 6);
    place(s, 2, 0, 'top');
    act(s, 'W');
    place(s, 4, 4, 'top');
    for (let i = 0; i < LEVEL_SINK_MOVES + 3; i++) idleMove(s);
    expect(s.reactions).toHaveLength(0);
    expect(s.over).toBe(false);
  });

  it('has no dead end where the goal is another one', () => {
    const s = levelRun({ arrival: 'none', norm: 1 });
    put(s, 4, 4, 5);
    expect(levelStuck(s)).toBe(false);
    place(s, 4, 4, 'top');
    for (let i = 0; i < 3; i++) idleMove(s);
    expect(s.over).toBe(false);
  });
});

describe('limit of moves', () => {
  it('fails the level on the tick its last move lands with the goal not met', () => {
    const s = pair({ moves: 3 });
    group(s);
    act(s, 'E');
    expect(s.over).toBe(false);
    step(s, 'W');
    run(s, BEAT - 1);
    expect(s.levelRun!.moves).toBe(3);
    expect(s.over).toBe(false);
    step(s, null);
    expect(types(s.events)).toEqual(expect.arrayContaining(['landed', 'levelFailed']));
    expect(s.over).toBe(true);
    expect(s.endReason).toBe('failed');
  });

  it('passes a level whose goal the last move meets', () => {
    const s = pair({ moves: 1, goal: { kind: 'send', count: 2 } });
    act(s, 'W');
    expect(s.endReason).toBe('passed');
    expect(types(s.events)).not.toContain('levelFailed');
  });

  it('is not spent by steps that move no die', () => {
    const s = pair({ moves: 2 });
    put(s, 1, 2, 5);
    group(s);
    // From one die that stands onto another and back.
    for (let i = 0; i < 6; i++) act(s, i % 2 === 0 ? 'S' : 'N');
    expect(s.levelRun!.moves).toBe(1);
    expect(s.over).toBe(false);
  });

  it('is none when the level gives 0', () => {
    const s = pair({ moves: 0 });
    put(s, 4, 4, 6);
    group(s);
    for (let i = 0; i < 40; i++) idleMove(s);
    expect(s.levelRun!.moves).toBe(41);
    expect(s.over).toBe(false);
  });
});

describe('a beat of its own', () => {
  it('is played with no die standing, until one stands, and spends no moves', () => {
    const s = levelRun({ norm: 1 });
    expect(worldRuns(s)).toBe(false);
    step(s, null);
    expect(s.levelRun!.beat).toBe(BEAT);
    expect(worldRuns(s)).toBe(true);
    const seen: GameEvent[] = [];
    for (let i = 0; i < 10 * BEAT; i++) {
      step(s, null);
      seen.push(...s.events);
    }
    // One beat to see that the board is short of a die, and one for the die to come up.
    expect(s.tick).toBe(2 * BEAT);
    expect(s.cubes).toHaveLength(1);
    expect(s.cubes[0].state).toBe('idle');
    // It came up under the player: nobody was up to bring it in.
    expect(types(seen)).toEqual(expect.arrayContaining(['spawn', 'lifted', 'risen']));
    expect(s.player.level).toBe('top');
    expect(s.levelRun!.moves).toBe(0);
    expect(s.levelRun!.beat).toBe(0);
    expect(worldRuns(s)).toBe(false);
  });

  it('carries a group away when the player has nothing left to move', () => {
    const s = levelRun({ norm: 0 });
    put(s, 0, 0, 2);
    put(s, 2, 0, 2);
    place(s, 3, 0, 'ground');
    act(s, 'W');
    expect(s.cubes).toHaveLength(2);
    run(s, 10 * BEAT);
    expect(s.cubes).toHaveLength(0);
    expect(s.levelRun!.moves).toBe(1);
    expect(s.over).toBe(false);
  });

  it('is played when the player is up on a die that is still coming: it comes up under them', () => {
    const s = levelRun();
    put(s, 0, 0, 5);
    const glass = put(s, 2, 1, 3, 'rising');
    glass.t = s.config.risingTicks - BEAT;
    // From the floor onto the die that has come: it can be neither rolled nor left.
    act(s, 'N');
    expect(s.player).toEqual({ x: 2, z: 1, level: 'top' });
    expect(DIRS.every((dir) => previewMove(s, dir).kind === 'blocked')).toBe(true);
    expect(s.levelRun!.beat).toBe(BEAT);
    run(s, 5 * BEAT);
    expect(glass.state).toBe('idle');
    expect(s.tick).toBe(BEAT);
    expect(s.levelRun!.moves).toBe(0);
    expect(worldRuns(s)).toBe(false);
    // Whole, it is rolled like any other.
    expect(previewMove(s, 'N').kind).toBe('roll');
  });

  it('waits for the step the player is making', () => {
    const s = levelRun({ norm: 0 });
    put(s, 0, 0, 2, 'sinking');
    step(s, 'N');
    expect(s.levelRun!.beat).toBe(0);
    run(s, BEAT - 1);
    expect(s.tick).toBe(0);
    step(s, null);
    expect(s.levelRun!.beat).toBe(BEAT);
  });
});

describe('a level played through', () => {
  const spec: Partial<LevelSpec> = { size: 5, values: [2, 3], norm: 8, goal: { kind: 'send', count: 999 } };

  it('never raises the level of the pace, pays for a clean board or ends on a full one', () => {
    for (const seed of [1, 2]) {
      const s = level({ ...spec, seed });
      const bot = createBot(SKILLS.pro, seed);
      const seen = new Set<string>();
      for (let i = 0; i < 3000; i++) {
        step(s, botCommand(bot, s));
        for (const e of s.events) seen.add(e.type);
        expect(population(s)).toBeLessThanOrEqual(8);
        // Between moves the board holds dice that stand, dice on their way out, and dice that have come and stand half up.
        if (!worldRuns(s)) {
          const waits = (c: Cube) => c.state === 'rising' && cubeHeight(c, s.config) === LEVEL_GHOST_HEIGHT;
          expect(s.cubes.every((c) => c.state === 'idle' || c.state === 'sinking' || waits(c))).toBe(true);
        }
      }
      expect(s.levelRun!.moves).toBeGreaterThan(15);
      expect(seen).toContain('match');
      expect(seen).not.toContain('levelUp');
      expect(seen).not.toContain('wiped');
      expect(seen).not.toContain('gameOver');
      expect(seen).not.toContain('warned');
      expect(s.level).toBe(1);
      expect(s.over).toBe(false);
    }
  });

  /** Steps with nothing pressed until the world has stopped and the player stands. */
  function rest(s: RunState): void {
    for (let i = 0; i < 400 && (worldRuns(s) || s.player.action); i++) step(s, null);
  }

  it('is one and the same for one seed and the same commands, whatever the empty ticks between them', () => {
    const s = level({ ...spec, seed: 4 });
    const bot = createBot(SKILLS.pro, 4);
    const commands: Dir[] = [];
    while (commands.length < 150) {
      rest(s);
      let cmd: Dir | null = null;
      for (let i = 0; i < 2000 && cmd === null; i++) cmd = botCommand(bot, s);
      if (cmd === null) break;
      commands.push(cmd);
      expect(step(s, cmd)).toBe(true);
    }
    rest(s);
    expect(commands).toHaveLength(150);
    expect(s.removed).toBeGreaterThan(20);

    const replay = (gap: (i: number) => number): RunState => {
      const again = level({ ...spec, seed: 4 });
      commands.forEach((cmd, i) => {
        rest(again);
        run(again, gap(i));
        step(again, cmd);
      });
      rest(again);
      return again;
    };
    const same = JSON.stringify(s);
    expect(JSON.stringify(replay(() => 0))).toBe(same);
    expect(JSON.stringify(replay((i) => (i * 7) % 23))).toBe(same);
    expect(JSON.stringify(replay(() => 90))).toBe(same);
  });

  it('is the same when the commands are given the moment they are taken', () => {
    const s = level({ ...spec, seed: 4 });
    const eager = level({ ...spec, seed: 4 });
    // Rolls there and back: the board always holds dice that stand, so the world never plays a beat of its own.
    const commands: Dir[] = [];
    for (let i = 0; i < 40; i++) {
      rest(s);
      const dir = DIRS.find((d) => previewMove(s, d).kind === 'roll') ?? DIRS.find((d) => previewMove(s, d).kind !== 'blocked')!;
      commands.push(dir);
      step(s, dir);
    }
    rest(s);
    for (const cmd of commands) while (!step(eager, cmd));
    rest(eager);
    expect(JSON.stringify(eager)).toBe(JSON.stringify(s));
  });
});

describe('a board given die by die', () => {
  const LAYOUT: LevelLayout = {
    dice: [
      { x: 0, z: 0, top: 2, north: 1 },
      { x: 2, z: 0, top: 6, north: 3 },
      { x: 1, z: 2, top: 3, north: 6 },
    ],
    start: { x: 2, z: 0 },
  };
  const given = (spec: Partial<LevelSpec> = {}): RunState =>
    level({ size: 3, norm: 3, arrival: 'none', goal: { kind: 'clear' }, layout: LAYOUT, ...spec });

  it('stands exactly as given, with the player on the die it names', () => {
    const s = given();
    expect(s.config.size).toBe(3);
    expect([s.config.startX, s.config.startZ]).toEqual([2, 0]);
    expect(s.player).toEqual({ x: 2, z: 0, level: 'top' });
    expect(s.cubes.map((c) => [c.x, c.z, c.ori.top, c.ori.north, c.state])).toEqual([
      [0, 0, 2, 1, 'idle'],
      [2, 0, 6, 3, 'idle'],
      [1, 2, 3, 6, 'idle'],
    ]);
    expect(cubeAt(s, 2, 0)?.ori).toEqual({ top: 6, bottom: 1, north: 3, south: 4, east: 2, west: 5 });
  });

  it('is the same whatever the seed, and asks nothing of the generator', () => {
    const a = given({ seed: 1 });
    const b = given({ seed: 77 });
    expect(JSON.stringify(a.cubes)).toBe(JSON.stringify(b.cubes));
    expect(a.rng).toBe(1);
    expect(b.rng).toBe(77);
  });

  it('is played by the rules of any level', () => {
    const s = given();
    act(s, 'W');
    expect(s.events).toContainEqual(expect.objectContaining({ type: 'match', value: 2, count: 2 }));
    expect(goalLines(s)).toEqual([{ what: 'cleared', value: 0, have: 2, need: 3 }]);
    expect(s.over).toBe(false);
  });

  it('says what is wrong with a board that is not one', () => {
    const [a, b, c] = LAYOUT.dice;
    expect(() => given({ id: 'L07', norm: 4 })).toThrow(/L07.*3 dice laid, 4 named/);
    expect(() => given({ id: 'L07', layout: { ...LAYOUT, dice: [a, b, { ...c, x: 0, z: 0 }] } })).toThrow(/L07.*two dice at 0,0/);
    expect(() => given({ id: 'L07', layout: { ...LAYOUT, start: { x: 1, z: 1 } } })).toThrow(/L07.*no die to start on at 1,1/);
    expect(() => given({ id: 'L07', layout: { ...LAYOUT, dice: [a, b, { ...c, x: 3 }] } })).toThrow(/L07.*off the board/);
    // A die cannot show a face on top and its opposite to the north.
    expect(() => given({ id: 'L07', layout: { ...LAYOUT, dice: [a, b, { ...c, top: 3, north: 4 }] } })).toThrow(/L07.*no die shows 3 on top and 4 to the north/);
  });

  it('gives three moves to take back unless the level says otherwise', () => {
    expect(LEVEL_UNDOS).toBe(3);
  });
});

describe('groups that are short', () => {
  it('are two or more standing dice of one face, fewer than the face asks for', () => {
    const s = levelRun();
    put(s, 0, 0, 3);
    put(s, 1, 0, 3);
    put(s, 3, 0, 4);
    put(s, 3, 1, 4);
    put(s, 4, 1, 4);
    expect(shortGroups(s)).toEqual([
      { value: 3, have: 2, need: 3, cells: [{ x: 0, z: 0 }, { x: 1, z: 0 }] },
      { value: 4, have: 3, need: 4, cells: [{ x: 3, z: 0 }, { x: 3, z: 1 }, { x: 4, z: 1 }] },
    ]);
  });

  it('are not a die alone, dice of different faces, 1s, or dice that touch by a corner', () => {
    const s = levelRun();
    put(s, 0, 0, 3);
    put(s, 1, 1, 3);
    put(s, 3, 0, 5);
    put(s, 4, 0, 6);
    put(s, 0, 3, 1);
    put(s, 0, 4, 1);
    expect(shortGroups(s)).toEqual([]);
  });

  it('leave out dice that are going or coming', () => {
    const s = levelRun();
    put(s, 0, 0, 4);
    put(s, 1, 0, 4, 'sinking');
    put(s, 0, 1, 4, 'rising');
    expect(shortGroups(s)).toEqual([]);
    put(s, 0, 2, 5);
    put(s, 1, 2, 5);
    expect(shortGroups(s).map((group) => [group.value, group.have])).toEqual([[5, 2]]);
  });

  it('are none on a board that is not a level, or where nothing stands together', () => {
    expect(shortGroups(levelRun())).toEqual([]);
  });
});
