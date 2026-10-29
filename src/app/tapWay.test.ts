import { describe, expect, it } from 'vitest';
import { InputController } from '../input/controller';
import { ALL_ORIENTATIONS, roll, type RunState } from '../rules';
import { addCube } from '../rules/spawn';
import { act, emptyRun, levelRun, place, put } from '../rules/testkit';
import { Runner } from './runner';
import { makesGroup, planTap, stepHolds } from './tapWay';

const dirs = (way: ReturnType<typeof planTap>) => way?.steps.map((s) => s.dir).join('') ?? null;

describe('a tap on the board', () => {
  it('rolls the die under the player along its row to an empty cell, a roll for every cell', () => {
    const s = emptyRun();
    put(s, 1, 3, 6);
    place(s, 1, 3, 'top');
    const way = planTap(s, 4, 3);
    expect(way?.kind).toBe('roll');
    expect(dirs(way)).toBe('EEE');
    expect(way?.steps.every((step) => step.kind === 'roll')).toBe(true);
  });

  it('never rolls on a slant: an empty cell off the row and the column is not rolled to', () => {
    const s = emptyRun();
    put(s, 1, 3, 6);
    place(s, 1, 3, 'top');
    expect(planTap(s, 3, 1)).toBeNull();
  });

  it('walks over the dice to the one tapped, moving none of them', () => {
    const s = emptyRun();
    put(s, 1, 1, 6);
    put(s, 2, 1, 5);
    put(s, 2, 2, 4);
    put(s, 3, 2, 3);
    place(s, 1, 1, 'top');
    const way = planTap(s, 3, 2);
    expect(way?.kind).toBe('walk');
    expect(way?.steps.every((step) => step.kind === 'hop')).toBe(true);
    // Every step of it is a plain one: a step along a row or a column.
    expect(dirs(way)).toMatch(/^[NESW]+$/);
    expect(way?.steps.length).toBe(3);
  });

  it('pushes the die beside a player on the floor, once', () => {
    const s = emptyRun();
    put(s, 2, 2, 6);
    place(s, 1, 2, 'ground');
    const way = planTap(s, 2, 2);
    expect(way).toEqual({ kind: 'push', steps: [{ dir: 'E', kind: 'push' }] });
  });

  it('walks along the floor to an empty cell', () => {
    const s = emptyRun();
    place(s, 0, 0, 'ground');
    const way = planTap(s, 2, 1);
    expect(way?.kind).toBe('walk');
    expect(way?.steps.length).toBe(3);
    expect(way?.steps.every((step) => step.kind === 'walk')).toBe(true);
  });

  it('keeps to the dice where it can: a way over them beats a shorter one over the floor', () => {
    const s = emptyRun();
    // A die that is going: from it the player may step down onto the floor.
    put(s, 0, 0, 6, 'sinking');
    put(s, 0, 1, 5);
    put(s, 0, 2, 4);
    put(s, 1, 2, 3);
    put(s, 2, 2, 2);
    // Over the floor it is three steps: down, along, and up onto the die, which cannot be pushed.
    put(s, 2, 1, 6);
    place(s, 0, 0, 'top');
    const way = planTap(s, 2, 1);
    expect(way?.steps.map((step) => step.kind)).toEqual(['hop', 'hop', 'hop', 'hop', 'hop']);
  });

  it('rolls over a die that is going where no step leads onto it', () => {
    const s = emptyRun();
    put(s, 1, 1, 6);
    put(s, 3, 1, 5, 'sinking');
    place(s, 1, 1, 'top');
    expect(planTap(s, 3, 1)).toEqual({ kind: 'roll', steps: [{ dir: 'E', kind: 'roll' }, { dir: 'E', kind: 'roll' }] });
  });

  it('walks onto a die that is going where steps lead to it, rolling nothing', () => {
    const s = emptyRun();
    put(s, 1, 1, 6, 'sinking');
    put(s, 2, 1, 5, 'sinking');
    place(s, 1, 1, 'top');
    expect(planTap(s, 2, 1)?.kind).toBe('walk');
  });

  it('asks for nothing on the cell the player stands on, or where no way leads', () => {
    const s = emptyRun();
    put(s, 1, 1, 6);
    put(s, 4, 4, 5);
    place(s, 1, 1, 'top');
    expect(planTap(s, 1, 1)).toBeNull();
    // A standing die cannot be stepped off, and nothing leads from it to the other.
    expect(planTap(s, 4, 4)).toBeNull();
  });

  it('on a level with the floor shut, does not walk down to it', () => {
    const s = levelRun({ floor: false });
    put(s, 1, 1, 6, 'sinking');
    place(s, 1, 1, 'top');
    expect(planTap(s, 1, 2)).toBeNull();
  });

  it('gives steps the rules then make as planned', () => {
    const s = emptyRun();
    put(s, 0, 2, 6);
    place(s, 0, 2, 'top');
    const way = planTap(s, 3, 2)!;
    for (const step of way.steps) expect(act(s, step.dir)).toBe(true);
    expect(s.player).toEqual({ x: 3, z: 2, level: 'top' });
  });
});

describe('a tap followed through the rules', () => {
  /** Plays a tap's way as the game does: a step at a time when the player is free, each checked first. */
  function follow(state: RunState, x: number, z: number): void {
    const way = planTap(state, x, z)!;
    const controller = new InputController();
    let at = 0;
    controller.follow(
      way.steps.map((s) => s.dir),
      () => {
        const holds = stepHolds(state, way.steps[at], way.kind !== 'walk' && at > 0);
        if (holds) at++;
        return holds;
      },
    );
    const runner = new Runner(state);
    for (let i = 0; i < 400 && !state.over; i++) {
      runner.advance(state.config.tickMs, () => controller.take(i * 16), (s) => {
        if (s.events.some(makesGroup)) controller.cancel();
      });
    }
  }

  it('stops a roll on the cell where it makes a group', () => {
    const s = levelRun({ arrival: 'none' });
    // Rolled east, the die comes up two, beside a two.
    const start = ALL_ORIENTATIONS.find((o) => roll(o, 'E').top === 2 && o.top !== 2)!;
    addCube(s, 0, 2, start);
    put(s, 1, 1, 2);
    put(s, 4, 4, 5);
    place(s, 0, 2, 'top');
    follow(s, 4, 2);
    expect(s.levelRun?.moves).toBe(1);
    expect(s.player.x).toBe(1);
  });

  it('rolls all the way where nothing is made on it', () => {
    const s = levelRun({ arrival: 'none' });
    put(s, 0, 2, 6);
    put(s, 4, 4, 5);
    place(s, 0, 2, 'top');
    follow(s, 4, 2);
    expect(s.levelRun?.moves).toBe(4);
    expect(s.player).toMatchObject({ x: 4, z: 2, level: 'top' });
  });
});
