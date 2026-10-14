import { describe, expect, it } from 'vitest';
import { LEAVING_SCENES, SceneRun, leavingSceneState, type LeavingScene } from './leavingScenes';

/** Plays a scene to its end by the rules, a tick at a time, and says what the board came to. */
function played(scene: LeavingScene): { run: SceneRun; ticks: number } {
  const run = new SceneRun(scene, leavingSceneState(scene));
  let ticks = 0;
  for (; !run.done && ticks < 5000; ticks++) run.tick();
  return { run, ticks };
}

const going = (run: SceneRun) => run.state.cubes.filter((cube) => cube.state === 'sinking');

describe('the scenes of the leaving the board lab plays', () => {
  it('has a scene for a group made, for its steps to the end, for a die that joins a chain and for the last combo of a board', () => {
    expect(Object.keys(LEAVING_SCENES)).toEqual(['pair', 'steps', 'join', 'finale']);
  });

  it('lays every scene as a level seven cells a side, as the lab draws its board, and plays it to its end', () => {
    for (const scene of Object.keys(LEAVING_SCENES) as LeavingScene[]) {
      const state = leavingSceneState(scene);
      expect(state.levelRun, scene).not.toBeNull();
      expect(state.config.size, scene).toBe(7);
      const { run, ticks } = played(scene);
      expect(run.done, scene).toBe(true);
      expect(ticks, scene).toBeLessThan(5000);
    }
  });

  it('plays every scene by the rules of a board of the game: nothing comes, the floor is strict, a die that leaves is climbed in one move', () => {
    for (const scene of Object.keys(LEAVING_SCENES) as LeavingScene[]) {
      const { levelRun } = leavingSceneState(scene);
      expect(levelRun!.spec, scene).toMatchObject({ arrival: 'none', liftMoves: 1, exact: true });
    }
  });

  it('makes a pair, and leaves it on its first step with the board still played', () => {
    const { run } = played('pair');
    expect(going(run)).toHaveLength(2);
    expect(run.state.over).toBe(false);
    expect(going(run).every((cube) => cube.t <= 1)).toBe(true);
  });

  it('takes a pair down all its steps and into the floor, with the board still played', () => {
    const { run } = played('steps');
    expect(going(run)).toEqual([]);
    expect(run.state.over).toBe(false);
    expect(run.state.cubes.length).toBe(2);
  });

  it('brings a third die to a pair that is going: one chain of three', () => {
    const { run } = played('join');
    const chain = going(run);
    expect(chain).toHaveLength(3);
    expect(new Set(chain.map((cube) => cube.reactionId)).size).toBe(1);
    expect(run.state.over).toBe(false);
  });

  it('passes a board with a combo of four made at once: the finale', () => {
    const { run } = played('finale');
    expect(run.state.over).toBe(true);
    expect(run.state.endReason).toBe('passed');
    expect(going(run)).toHaveLength(4);
  });

  it('says what the rules said on every tick, for the board to answer', () => {
    const run = new SceneRun('pair', leavingSceneState('pair'));
    const kinds = new Set<string>();
    for (let ticks = 0; !run.done && ticks < 5000; ticks++) for (const event of run.tick()) kinds.add(event.type);
    expect(kinds.has('match')).toBe(true);
  });
});
