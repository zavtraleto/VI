import { DELTA, DIRS, cellIndex, inBounds } from '../rules/board';
import { ALL_ORIENTATIONS, roll } from '../rules/orientation';
import { randomInt } from '../rules/rng';
import { hasReadyGroup } from '../rules/spawn';
import type { Dir, LevelLayout, LevelSpec, Orientation, PuzzleDie } from '../rules/types';
import type { Recipe } from './recipes';

/**
 * Boards for the places of the ladder. A candidate is laid from a seed by the rules of its
 * place; it is then solved and played by the players made of the rules, and kept if what it
 * comes to is within the bounds of the place (see `select.ts`). The seed lives here and nowhere
 * else: a level that is kept is its dice, not the number they were laid from.
 *
 * There are two ways to lay a board. At random: the dice are put down as the place says and
 * nothing more is known of the board until it is solved. From its solution: the groups are put
 * down assembled, and dice are then rolled away from them, a roll at a time, as many rolls as
 * the place takes moves; rolled back in the opposite order, they are a way to clear the board.
 * A board laid at random is seldom a short one, so few of them fit a place of few moves; a board
 * laid from its solution is short by the way it is made. Either is judged the same way, forward,
 * on the real rules.
 */

/** Seeds above this lay a board from its solution; the ones up to it lay it at random. */
export const FROM_SOLUTION = 10_000;

/** The name a level of the ladder goes by. */
export function levelId(slot: number): string {
  return `L${String(slot).padStart(2, '0')}`;
}

/** Faces a die may show to the north with `top` up: any but the top and the one under it. */
function norths(top: number): number[] {
  return [1, 2, 3, 4, 5, 6].filter((face) => face !== top && face !== 7 - top);
}

/** A generator of its own for every place and seed. */
function generatorOf(recipe: Recipe, seed: number): { rng: number } {
  return { rng: (Math.imul(seed, 0x9e3779b1) ^ Math.imul(recipe.slot, 0x85ebca6b)) | 0 };
}

/**
 * Lays a board by the rules of a place: the dice that stand assembled first, side by side; then
 * the rest, on free cells, next to the dice already there where the place asks for one cluster.
 * Half of the rest show a face the level is about and half show another one, so that there are
 * dice a roll away from a group and not only dice in one. Null when the board cannot be laid, or
 * holds a group ready to go, or has no die to start on.
 */
export function layOut(recipe: Recipe, seed: number): LevelLayout | null {
  const rng = generatorOf(recipe, seed);
  const { size } = recipe;
  const cells = size * size;
  const count = recipe.dice + (recipe.more ? randomInt(rng, recipe.more + 1) : 0);
  const tops = new Array<number>(cells).fill(0);
  const dice: PuzzleDie[] = [];
  const beside = (cell: number): number[] => {
    const x = cell % size;
    const z = Math.floor(cell / size);
    return DIRS.filter((dir) => inBounds(size, x + DELTA[dir].dx, z + DELTA[dir].dz)).map((dir) => cellIndex(size, x + DELTA[dir].dx, z + DELTA[dir].dz));
  };
  const free = (): number[] => tops.map((top, cell) => (top === 0 ? cell : -1)).filter((cell) => cell >= 0);
  /** Free cells that touch one of `cluster` by a side. */
  const touching = (cluster: readonly number[]): number[] => free().filter((cell) => beside(cell).some((other) => cluster.includes(other)));
  const taken = (): number[] => dice.map((die) => cellIndex(size, die.x, die.z));
  const put = (cell: number, top: number): void => {
    const north = norths(top)[randomInt(rng, 4)];
    tops[cell] = top;
    dice.push({ x: cell % size, z: Math.floor(cell / size), top, north });
  };
  const pick = (from: readonly number[]): number | null => (from.length > 0 ? from[randomInt(rng, from.length)] : null);

  for (const { value, count: many } of recipe.standing ?? []) {
    const shape: number[] = [];
    for (let i = 0; i < many; i++) {
      // The first die of a shape joins what stands already, on a board of one cluster; the others join the shape.
      const open = i > 0 ? touching(shape) : recipe.compact && dice.length > 0 ? touching(taken()) : free();
      const cell = pick(open);
      if (cell === null) return null;
      shape.push(cell);
      put(cell, value);
    }
  }
  const others = [2, 3, 4, 5, 6].filter((face) => !recipe.faces.includes(face));
  const rest = count - dice.length;
  for (let i = 0; i < rest; i++) {
    const cell = pick(recipe.compact && dice.length > 0 ? touching(taken()) : free());
    if (cell === null) return null;
    if (i < (recipe.ones ?? 0)) {
      put(cell, 1);
      continue;
    }
    const own = others.length === 0 || randomInt(rng, 2) === 0;
    const from = own ? recipe.faces : others;
    put(cell, from[randomInt(rng, from.length)]);
  }
  if (dice.length !== count || hasReadyGroup(tops, size)) return null;
  // The player starts on a die that can be rolled: one with an empty cell beside it.
  const movable = dice.filter((die) => beside(cellIndex(size, die.x, die.z)).some((cell) => tops[cell] === 0));
  if (movable.length === 0) return null;
  const start = movable[randomInt(rng, movable.length)];
  return { dice, start: { x: start.x, z: start.z } };
}

/** The level a board of a place makes: a board to clear, with nothing coming and no limit of moves. */
export function levelOf(recipe: Recipe, seed: number, layout: LevelLayout): LevelSpec {
  const values = [...(recipe.ones ? [1] : []), ...recipe.faces].sort((a, b) => a - b);
  return { id: levelId(recipe.slot), seed, size: recipe.size, values, norm: layout.dice.length, arrival: 'none', goal: { kind: 'clear' }, moves: 0, layout };
}

/** A die of a board being laid: where it stands, how it lies, whether it is left where it was put, and whether it has been rolled yet. */
interface Laid {
  cell: number;
  ori: Orientation;
  fixed: boolean;
  rolled: boolean;
}

const OPPOSITE: Record<Dir, Dir> = { N: 'S', S: 'N', E: 'W', W: 'E' };

/** Every way to give the faces of a level their dice: a face gets none, or as many as it asks for and more, and `total` in all. */
function shares(faces: readonly number[], total: number, must: readonly number[]): Map<number, number>[] {
  const ways: Map<number, number>[] = [];
  const give = (index: number, left: number, given: Map<number, number>): void => {
    if (index === faces.length) {
      if (left === 0) ways.push(new Map(given));
      return;
    }
    const face = faces[index];
    if (!must.includes(face)) give(index + 1, left, given);
    for (let size = face; size <= left; size++) {
      given.set(face, size);
      give(index + 1, left - size, given);
      given.delete(face);
    }
  };
  give(0, total, new Map());
  return ways;
}

/**
 * Lays a board from its solution. The groups of the level are put down whole, each of one face
 * and of as many dice as the face asks for or more, the 1s beside them; then dice are rolled
 * away, a roll at a time, as many rolls as the place takes moves, the same die going on as often
 * as another is taken. The dice a place names as standing, and the 1s, stay where they were put.
 * Null when the board cannot be laid, holds a group ready to go or a 1 it should not, is not the
 * one cluster the place asks for, or has no die to start on.
 */
export function layFromSolution(recipe: Recipe, seed: number): LevelLayout | null {
  return fromSolution(recipe, seed)?.layout ?? null;
}

/**
 * The way a board laid from its solution was made by, turned round: the rolls that took the
 * dice away, each made back, the last one first. It is what the board was built to be cleared
 * by, and is written as a level writes its moves; whether it does clear the board is for the
 * rules to say, since a group that goes on the way may open a shorter one or close this one.
 */
export function builtWay(recipe: Recipe, seed: number): string[] | null {
  return fromSolution(recipe, seed)?.way ?? null;
}

interface Built {
  layout: LevelLayout;
  way: string[];
}

function fromSolution(recipe: Recipe, seed: number): Built | null {
  const rng = generatorOf(recipe, seed + FROM_SOLUTION);
  // Most tries fall apart: a die rolled away breaks the cluster, or shows a 1. A seed gets a number of them.
  for (let attempt = 0; attempt < SOLUTION_TRIES; attempt++) {
    const built = tryFromSolution(recipe, rng);
    if (built) return built;
  }
  return null;
}

/** Tries a seed gets at laying a board from its solution. */
const SOLUTION_TRIES = 40;

function tryFromSolution(recipe: Recipe, rng: { rng: number }): Built | null {
  const { size } = recipe;
  const cells = size * size;
  const count = recipe.dice + (recipe.more ? randomInt(rng, recipe.more + 1) : 0);
  const ones = recipe.ones ?? 0;
  const standing = recipe.standing ?? [];
  const ways = shares(recipe.faces, count - ones, standing.map((group) => group.value));
  if (ways.length === 0) return null;
  const sizes = ways[randomInt(rng, ways.length)];

  const taken = new Map<number, Laid>();
  const beside = (cell: number): number[] => {
    const x = cell % size;
    const z = Math.floor(cell / size);
    return DIRS.filter((dir) => inBounds(size, x + DELTA[dir].dx, z + DELTA[dir].dz)).map((dir) => cellIndex(size, x + DELTA[dir].dx, z + DELTA[dir].dz));
  };
  const free = (): number[] => Array.from({ length: cells }, (_, cell) => cell).filter((cell) => !taken.has(cell));
  const touching = (cluster: readonly number[]): number[] => free().filter((cell) => beside(cell).some((other) => cluster.includes(other)));
  const pick = (from: readonly number[]): number | null => (from.length > 0 ? from[randomInt(rng, from.length)] : null);
  const put = (cell: number, top: number, fixed: boolean): void => {
    const north = norths(top)[randomInt(rng, 4)];
    taken.set(cell, { cell, ori: ALL_ORIENTATIONS.find((o) => o.top === top && o.north === north)!, fixed, rolled: false });
  };
  const first = (): number | null => pick(recipe.compact && taken.size > 0 ? touching([...taken.keys()]) : free());

  // The groups, whole. Fewer dice of a group stay in place than its face asks for, or the group
  // would be ready to go from the start: the dice named as standing, and of the others as many
  // as may. The rest are the dice that are rolled away.
  for (const [value, many] of sizes) {
    const named = standing.find((group) => group.value === value)?.count ?? 0;
    // Two times in three as many stay as can: a group that lacks one die is what a short level is made of.
    const stay = randomInt(rng, 3) > 0 ? value - 1 : named + randomInt(rng, value - named);
    const shape: number[] = [];
    for (let i = 0; i < many; i++) {
      const cell = i === 0 ? first() : pick(touching(shape));
      if (cell === null) return null;
      shape.push(cell);
      put(cell, value, i < stay);
    }
  }
  for (let i = 0; i < ones; i++) {
    const cell = first();
    if (cell === null) return null;
    put(cell, 1, true);
  }

  // The rolls away: a way through the board, made backwards. Every die that does not stay is
  // rolled at least once, so the board takes at least as many rolls as it has such dice.
  const away = [...taken.values()].filter((die) => !die.fixed).length;
  const fewest = Math.max(recipe.par[0], away);
  if (fewest > recipe.par[1]) return null;
  const rolls = fewest + randomInt(rng, recipe.par[1] - fewest + 1);
  interface Roll {
    die: Laid;
    dir: Dir;
    to: number;
  }
  let last: Roll | null = null;
  const way: string[] = [];
  for (let made = 0; made < rolls; made++) {
    const waiting = [...taken.values()].filter((die) => !die.fixed && !die.rolled).length;
    const options: Roll[] = [];
    for (const die of taken.values()) {
      if (die.fixed) continue;
      // With no roll to spare, the next one goes to a die that has not been rolled yet.
      if (die.rolled && waiting >= rolls - made) continue;
      const x = die.cell % size;
      const z = Math.floor(die.cell / size);
      for (const dir of DIRS) {
        const tx = x + DELTA[dir].dx;
        const tz = z + DELTA[dir].dz;
        if (!inBounds(size, tx, tz) || taken.has(cellIndex(size, tx, tz))) continue;
        // A roll that only takes the last one back makes no way.
        if (last && last.die === die && OPPOSITE[last.dir] === dir) continue;
        options.push({ die, dir, to: cellIndex(size, tx, tz) });
      }
    }
    if (options.length === 0) return null;
    const before: Roll | null = last;
    const same: Roll[] = before ? options.filter((option) => option.die === before.die) : [];
    const from: Roll[] = same.length > 0 && randomInt(rng, 2) === 0 ? same : options;
    const next: Roll = from[randomInt(rng, from.length)];
    taken.delete(next.die.cell);
    next.die.cell = next.to;
    next.die.ori = roll(next.die.ori, next.dir);
    next.die.rolled = true;
    taken.set(next.to, next.die);
    // Made back, the roll is a move of the die from where it has just come to, the other way.
    way.unshift(`${next.to % size},${Math.floor(next.to / size)},${OPPOSITE[next.dir]}`);
    last = next;
  }

  const laid = [...taken.values()].sort((a, b) => a.cell - b.cell);
  if (laid.some((die) => die.ori.top === 1 && !die.fixed)) return null;
  const tops = new Array<number>(cells).fill(0);
  for (const die of laid) tops[die.cell] = die.ori.top;
  if (hasReadyGroup(tops, size)) return null;
  if (recipe.compact) {
    const cluster = [laid[0].cell];
    for (let i = 0; i < cluster.length; i++) {
      for (const cell of beside(cluster[i])) if (taken.has(cell) && !cluster.includes(cell)) cluster.push(cell);
    }
    if (cluster.length !== laid.length) return null;
  }
  const dice: PuzzleDie[] = laid.map((die) => ({ x: die.cell % size, z: Math.floor(die.cell / size), top: die.ori.top, north: die.ori.north }));
  const movable = laid.filter((die) => beside(die.cell).some((cell) => !taken.has(cell)));
  if (movable.length === 0) return null;
  const start = movable[randomInt(rng, movable.length)];
  return { layout: { dice, start: { x: start.cell % size, z: Math.floor(start.cell / size) } }, way };
}

/** The candidate of a place a seed gives, or null when the seed lays no board. */
export function candidate(recipe: Recipe, seed: number): LevelSpec | null {
  const layout = seed > FROM_SOLUTION ? layFromSolution(recipe, seed - FROM_SOLUTION) : layOut(recipe, seed);
  return layout ? levelOf(recipe, seed, layout) : null;
}

/** A board as a picture in text: a cell is the top face of its die and, after it, the face to the north; the start is marked. */
export function boardText(spec: LevelSpec): string {
  const { size, layout } = spec;
  if (!layout) return '';
  const rows: string[] = [];
  for (let z = 0; z < size; z++) {
    const row: string[] = [];
    for (let x = 0; x < size; x++) {
      const die = layout.dice.find((d) => d.x === x && d.z === z);
      const start = layout.start.x === x && layout.start.z === z;
      row.push(die ? `${die.top}${die.north}${start ? '*' : ' '}` : ' . ');
    }
    rows.push(row.join(' '));
  }
  return rows.join('\n');
}

/** Checks that every die of a board lies as a die can. */
export function isBoard(layout: LevelLayout): boolean {
  return layout.dice.every((die) => ALL_ORIENTATIONS.some((o) => o.top === die.top && o.north === die.north));
}
