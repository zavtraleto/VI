import { describe, expect, it } from 'vitest';
import { DELTA, DIRS, canAcceptCommand, createRun, cubeAt, defaultConfig, step, type Dir, type RunState } from '../rules';
import { PUZZLE_LEVELS, type PuzzleLevel } from './levels';

function settle(s: RunState): void {
  const busy = () => s.player.action !== undefined || s.cubes.some((c) => c.state === 'moving') || !canAcceptCommand(s);
  for (let i = 0; i < 2000 && !s.over && busy(); i++) step(s, null);
}

function command(s: RunState, dir: Dir): void {
  expect(step(s, dir)).toBe(true);
  settle(s);
}

/**
 * Steps from die to die to the cell (x, z). The group under the player can be walked over
 * until it is left; after that its dice are gone.
 */
function walkTo(s: RunState, x: number, z: number): void {
  const held = s.puzzle!.held;
  const inGroup = (cx: number, cz: number) => held !== 0 && cubeAt(s, cx, cz)?.reactionId === held;
  const start = { x: s.player.x, z: s.player.z, left: !inGroup(s.player.x, s.player.z), path: [] as Dir[] };
  const seen = new Set([`${start.x},${start.z},${start.left}`]);
  const queue = [start];
  while (queue.length > 0) {
    const cell = queue.shift()!;
    if (cell.x === x && cell.z === z && cell.left) {
      for (const dir of cell.path) command(s, dir);
      return;
    }
    for (const dir of DIRS) {
      const nx = cell.x + DELTA[dir].dx;
      const nz = cell.z + DELTA[dir].dz;
      if (!cubeAt(s, nx, nz)) continue;
      const group = inGroup(nx, nz);
      if (cell.left && group) continue;
      const left = cell.left || !group;
      const key = `${nx},${nz},${left}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ x: nx, z: nz, left, path: [...cell.path, dir] });
    }
  }
  throw new Error(`no way over the dice to ${x},${z}`);
}

function play(level: PuzzleLevel): RunState {
  const s = createRun({ seed: 1, config: defaultConfig(), puzzle: level });
  for (const roll of level.solution) {
    const [x, z, dir] = roll.split(',');
    walkTo(s, Number(x), Number(z));
    expect(s.puzzle!.dead).toBeNull();
    const before = s.puzzle!.moves;
    command(s, dir as Dir);
    expect(s.puzzle!.moves).toBe(before + 1);
  }
  return s;
}

describe('puzzle levels', () => {
  it('have unique codes', () => {
    expect(new Set(PUZZLE_LEVELS.map((l) => l.id)).size).toBe(PUZZLE_LEVELS.length);
  });

  it.each(PUZZLE_LEVELS.map((level, i) => [i + 1, level] as const))('level %i is cleared by its solution in par', (_n, level) => {
    expect(level.solution).toHaveLength(level.par);
    expect(level.dice.some((d) => d.x === level.start.x && d.z === level.start.z)).toBe(true);
    const s = play(level);
    expect(s.over).toBe(true);
    expect(s.endReason).toBe('cleared');
    expect(s.puzzle!.moves).toBe(level.par);
  });
});
