import { DELTA, DIRS, cellIndex, inBounds } from '../rules/board';
import { ALL_ORIENTATIONS, roll } from '../rules/orientation';
import { randomInt } from '../rules/rng';
import { hasReadyGroup } from '../rules/spawn';
import type { Dir, LevelLayout, Orientation, PuzzleDie } from '../rules/types';
import { cutOut } from './generate';
import type { Recipe, Scene } from './recipes';

/**
 * Lays a board from its route: from the end of the way backwards. The route of a place is a row
 * of scenes, one to an event: a combo, a die that joins it, the 1s swept by a 1 brought to it.
 * Every scene is first put down as it stands at the moment of its event, the dice of a combo
 * side by side and the die of a link or of the 1s beside the combo it goes with. Then, the last
 * scene first, the dice are taken away from there by the moves that brought them, made
 * backwards: a die that is rolled home is rolled away, and shows another face; a die that is
 * pushed home is slid away along a line and shows the same one, with a free cell left behind it
 * for the player to push from.
 *
 * This is what laying a board from its solution (`generate.ts`) cannot do: a push, the 1s, a
 * combo that stands apart and is come to over the floor. Like that way of laying, it proves
 * nothing: a combo that goes on the way may open a shorter one or shut this one, and a way made
 * backwards knows nothing of the two moves a combo takes to go. The board is solved forward, on
 * the real rules, and its way and the score of the way are what it is judged by (`select.ts`).
 */

/** Tries a seed gets at laying a board from its route: most fall apart on a die with no room to go. */
const ROUTE_TRIES = 60;

/** A die of a board being laid: where it stands, how it lies, the scene it belongs to, and whether it shows a 1 because the route says so. */
interface Laid {
  cell: number;
  ori: Orientation;
  scene: number;
  one: boolean;
  /** The side it was last rolled away to: the next roll does not take that one back. */
  went?: Dir;
}

const OPPOSITE: Record<Dir, Dir> = { N: 'S', S: 'N', E: 'W', W: 'E' };

/** Faces a die may show to the north with `top` up: any but the top and the one under it. */
function norths(top: number): number[] {
  return [1, 2, 3, 4, 5, 6].filter((face) => face !== top && face !== 7 - top);
}

export function layFromRoute(recipe: Recipe, seed: number): LevelLayout | null {
  const { scenes } = recipe;
  if (!scenes || scenes.length === 0) return null;
  const rng = { rng: (Math.imul(seed, 0x9e3779b1) ^ Math.imul(recipe.slot, 0x85ebca6b) ^ 0x5bd1e995) | 0 };
  for (let attempt = 0; attempt < ROUTE_TRIES; attempt++) {
    const layout = tryFromRoute(recipe, scenes, rng);
    if (layout) return layout;
  }
  return null;
}

function tryFromRoute(recipe: Recipe, scenes: readonly Scene[], rng: { rng: number }): LevelLayout | null {
  const { size } = recipe;
  const cells = size * size;
  const taken = new Map<number, Laid>();
  // A cell the place cuts out of its board is no cell: nothing is laid there, and nothing rolls or slides over it.
  const cut = cutOut(recipe);
  const at = (cell: number, dir: Dir, far = 1): number | null => {
    const x = (cell % size) + DELTA[dir].dx * far;
    const z = Math.floor(cell / size) + DELTA[dir].dz * far;
    if (!inBounds(size, x, z)) return null;
    const there = cellIndex(size, x, z);
    return cut.has(there) ? null : there;
  };
  const beside = (cell: number): number[] => DIRS.map((dir) => at(cell, dir)).filter((other): other is number => other !== null);
  const free = (): number[] => Array.from({ length: cells }, (_, cell) => cell).filter((cell) => !taken.has(cell) && !cut.has(cell));
  const touching = (cluster: readonly number[]): number[] => free().filter((cell) => beside(cell).some((other) => cluster.includes(other)));
  const pick = <T>(from: readonly T[]): T | null => (from.length > 0 ? from[randomInt(rng, from.length)] : null);
  const put = (cell: number, top: number, scene: number, one = false): Laid => {
    const north = norths(top)[randomInt(rng, 4)];
    const die: Laid = { cell, ori: ALL_ORIENTATIONS.find((o) => o.top === top && o.north === north)!, scene, one };
    taken.set(cell, die);
    return die;
  };

  // The scenes as they stand at their events. `chain` is the combo a link or the 1s are brought to, with the links it has.
  const movers: Laid[] = [];
  const others: Laid[][] = [];
  let chain: number[] = [];
  for (const [index, scene] of scenes.entries()) {
    if (scene.event === 'combo') {
      const face = scene.face ?? recipe.faces[0];
      const shape: Laid[] = [];
      for (let i = 0; i < (scene.dice ?? face); i++) {
        const own = shape.map((die) => die.cell);
        // A scene that stands apart touches none of the dice laid before it; any other is laid against them.
        const lone = (cell: number) => beside(cell).every((other) => !taken.has(other) || own.includes(other));
        const open = i > 0 ? touching(own) : taken.size > 0 && !scene.apart ? touching([...taken.keys()]) : free();
        const cell = pick(scene.apart ? open.filter(lone) : open);
        if (cell === null) return null;
        shape.push(put(cell, face, index));
      }
      const mover = pick(shape)!;
      movers.push(mover);
      others.push(shape.filter((die) => die !== mover));
      chain = shape.map((die) => die.cell);
      continue;
    }
    if (chain.length === 0) return null;
    const cell = pick(touching(chain));
    if (cell === null) return null;
    if (scene.event === 'link') {
      movers.push(put(cell, scene.face ?? recipe.faces[0], index));
      others.push([]);
      chain.push(cell);
      continue;
    }
    // The 1 that is brought, and the 1s that stand and wait for it.
    movers.push(put(cell, 1, index, true));
    const ones: Laid[] = [];
    for (let i = 0; i < (scene.dice ?? 1); i++) {
      const spot = pick(free());
      if (spot === null) return null;
      ones.push(put(spot, 1, index, true));
    }
    others.push(ones);
  }

  /** Rolls a die away from where it stands, a roll at a time, into free cells. */
  const rollAway = (die: Laid, rolls: number, straight: boolean): boolean => {
    for (let made = 0; made < rolls; made++) {
      const ways = DIRS.filter((dir) => {
        const to = at(die.cell, dir);
        return to !== null && !taken.has(to) && !(die.went && OPPOSITE[die.went] === dir);
      });
      if (ways.length === 0) return false;
      const dir = straight && die.went && ways.includes(die.went) ? die.went : pick(ways)!;
      taken.delete(die.cell);
      die.cell = at(die.cell, dir)!;
      die.ori = roll(die.ori, dir);
      die.went = dir;
      die.one = false;
      taken.set(die.cell, die);
    }
    return true;
  };
  /** Slides a die away along a line, as many cells as it is pushed, to where a free cell is left behind it for the player. */
  const slideAway = (die: Laid, pushes: number): boolean => {
    // `dir` is the side the die is pushed to on the way: it is slid away to the other one.
    const ways = DIRS.filter((dir) => {
      for (let far = 1; far <= pushes + 1; far++) {
        const cell = at(die.cell, OPPOSITE[dir], far);
        if (cell === null || taken.has(cell)) return false;
      }
      return true;
    });
    const dir = pick(ways);
    if (dir === null) return false;
    taken.delete(die.cell);
    die.cell = at(die.cell, OPPOSITE[dir], pushes)!;
    taken.set(die.cell, die);
    return true;
  };
  const between = ([from, to]: readonly [number, number]): number => from + randomInt(rng, to - from + 1);

  // The moves that brought the dice, made backwards: the last scene first.
  for (let index = scenes.length - 1; index >= 0; index--) {
    const scene = scenes[index];
    const moves = between(scene.moves ?? [1, 1]);
    const straight = scene.straight === true;
    if (scene.by === 'push' ? !slideAway(movers[index], moves) : !rollAway(movers[index], moves, straight)) return null;
    const rest = others[index].slice();
    for (let loose = 0; loose < (scene.loose ?? 0) && rest.length > 0; loose++) {
      const [die] = rest.splice(randomInt(rng, rest.length), 1);
      if (!rollAway(die, between(scene.looseMoves ?? [1, 2]), false)) return null;
    }
  }

  const laid = [...taken.values()].sort((a, b) => a.cell - b.cell);
  // A 1 is on the board only where the route put it.
  if (laid.some((die) => die.ori.top === 1 && !die.one)) return null;
  const tops = new Array<number>(cells).fill(0);
  for (const die of laid) tops[die.cell] = die.ori.top;
  if (hasReadyGroup(tops, size)) return null;
  const clusterOf = (from: number): number[] => {
    const cluster = [from];
    for (let i = 0; i < cluster.length; i++) {
      for (const cell of beside(cluster[i])) if (taken.has(cell) && !cluster.includes(cell)) cluster.push(cell);
    }
    return cluster;
  };
  if (recipe.compact && clusterOf(laid[0].cell).length !== laid.length) return null;
  // The player starts by the first scene: on a die of the cluster the die of its event stands in.
  const home = clusterOf(movers[0].cell);
  // A scene that was laid apart is still apart once the dice have been taken away: no step leads to it from the start.
  if (scenes.some((scene, index) => scene.apart && scene.event === 'combo' && [movers[index], ...others[index]].some((die) => home.includes(die.cell)))) return null;
  const start = randomInt(rng, 2) === 0 ? movers[0].cell : pick(home)!;
  const dice: PuzzleDie[] = laid.map((die) => ({ x: die.cell % size, z: Math.floor(die.cell / size), top: die.ori.top, north: die.ori.north }));
  return { dice, start: { x: start % size, z: Math.floor(start / size) } };
}
