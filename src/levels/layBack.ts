import { DELTA, DIRS } from '../rules/board';
import { ALL_ORIENTATIONS, orientationKey, roll } from '../rules/orientation';
import type { Dir, LevelSpec, Orientation, PuzzleDie } from '../rules/types';
import { seqsOf, startOf, type Plot, type PlotDie, type Side } from './plot';

/**
 * Lays boards from a plot backwards (docs/superpowers/specs/2026-10-14-vi-level-generator-design.md,
 * section 4.1; the plan docs/superpowers/plans/2026-10-28-vi-level-generator.md, step 2). Every
 * die is put on the cell of its event with its face up, and the moves that bring it are made
 * backwards from there: a roll away turns it, a push away does not. The cells of the events are a
 * placement of the figure, or, with no figure, the events laid one by one. A laid board is one of
 * a space counted in mixed radix: the placement, then for every die its way back and the face to
 * its north at the event, then the die the player starts on. Nothing here asks the rules: whether
 * the dice can come in that order is what the judge (`plotJudge.ts`) finds out going forward.
 */

/** A board laid from a plot. */
export interface Laid {
  spec: LevelSpec;
  /** The moves the plot is played in as laid: the moves of every die's way, added up. */
  length: number;
  placement: number;
  /** The moves of every die, in the order of the plot's dice. */
  moves: readonly number[];
}

/** Every board a plot lays, counted. */
export interface Space {
  total: number;
  /** The placements were too many to go through, and these are a sample by the seed. */
  sampled: boolean;
  placements: number;
  /** The cells of the events of a placement, a cell (`z * size + x`) to every die of the plot. */
  cellsOf(placement: number): readonly number[];
  /** The indices of a placement: from, and up to but not with. */
  range(placement: number): readonly [number, number];
  /** The board of an index; null where two dice would start on one cell. */
  at(index: number): Laid | null;
}

/** Placements gone through whole; with more, so many are taken by the seed. */
export const PLACEMENT_CAP = 50_000;

/** Placements drawn where there are more than `PLACEMENT_CAP` of them: the space is sampled in any case. */
export const DRAWN_PLACEMENTS = 5_000;

const OPPOSITE: Record<Dir, Dir> = { N: 'S', S: 'N', E: 'W', W: 'E' };

/** The ways back of a die from one cell: where each starts, how many moves it is, how the die lies there for each of the four faces to the north. */
interface Ways {
  count: number;
  from: number[];
  length: number[];
  /** `way * 4 + north`. */
  lies: Orientation[];
}

const sideOf = (o: Orientation, face: number): Side =>
  o.top === face ? 'top' : o.south === face ? 'south' : o.east === face ? 'east' : o.north === face ? 'north' : o.west === face ? 'west' : 'under';

/** A small stream of chance of its own, so that a sample is the same for a seed. */
function streamOf(seed: number): () => number {
  let a = seed | 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function layBack(plot: Plot, opts: { seed?: number; cap?: number } = {}): Space {
  const { seed = 1, cap = PLACEMENT_CAP } = opts;
  const { size } = plot;
  const cellCount = size * size;
  const cut = new Set((plot.holes ?? []).map(({ x, z }) => z * size + x));
  const isCell = (x: number, z: number) => x >= 0 && z >= 0 && x < size && z < size && !cut.has(z * size + x);
  const dice = plot.dice;
  const index = new Map(dice.map((die, at) => [die.name, at]));

  // The ways back, by die and cell, made the first time they are asked for.
  const ways = new Map<number, Ways>();
  const waysOf = (die: number, cell: number): Ways => {
    const key = die * cellCount + cell;
    let found = ways.get(key);
    if (!found) ways.set(key, (found = waysFrom(dice[die], cell)));
    return found;
  };
  const waysFrom = (die: PlotDie, cell: number): Ways => {
    const ends = ALL_ORIENTATIONS.filter((o) => o.top === die.face);
    const out: Ways = { count: 0, from: [], length: [], lies: [] };
    const home = { x: cell % size, z: Math.floor(cell / size) };
    if (!die.comes) {
      out.count = 1;
      out.from.push(cell);
      out.length.push(0);
      out.lies.push(...ends);
      return out;
    }
    const comes = die.comes;
    const seen = new Set<string>();
    for (const seq of seqsOf(comes)) {
      const n = seq.length;
      const dirs: Dir[] = new Array(n);
      // cells[j]: where the die stands before its move j; cells[n] is the cell of the event.
      const xs = new Array<number>(n + 1);
      const zs = new Array<number>(n + 1);
      xs[n] = home.x;
      zs[n] = home.z;
      const done = () => {
        if (comes.line === 'straight' && dirs.some((dir) => dir !== dirs[0])) return;
        if (comes.line === 'turn' && dirs.every((dir) => dir === dirs[0])) return;
        if (comes.away !== undefined) {
          const far = (j: number) => Math.abs(xs[j] - home.x) + Math.abs(zs[j] - home.z);
          let away = 0;
          for (let j = 0; j < n; j++) if (seq[j] === 'r' && far(j + 1) > far(j)) away++;
          if (away !== comes.away) return;
        }
        // Backwards: a roll is undone by a roll the other way; a push leaves the die as it lay.
        const lies = ends.map((end) => {
          let o = end;
          for (let j = n - 1; j >= 0; j--) if (seq[j] === 'r') o = roll(o, OPPOSITE[dirs[j]]);
          return o;
        });
        if (comes.starts && !comes.starts.includes(sideOf(lies[0], die.face))) return;
        const from = zs[0] * size + xs[0];
        // Two ways that lay the die alike, in as many moves, lay the same board.
        const key = `${from} ${n} ${orientationKey(lies[0])}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.count++;
        out.from.push(from);
        out.length.push(n);
        out.lies.push(...lies);
      };
      const back = (j: number) => {
        if (j < 0) return done();
        for (const dir of DIRS) {
          const x = xs[j + 1] - DELTA[dir].dx;
          const z = zs[j + 1] - DELTA[dir].dz;
          if (!isCell(x, z)) continue;
          // A push is made from the floor behind the die.
          if (seq[j] === 'p' && !isCell(x - DELTA[dir].dx, z - DELTA[dir].dz)) continue;
          dirs[j] = dir;
          xs[j] = x;
          zs[j] = z;
          back(j - 1);
        }
      };
      back(n - 1);
    }
    return out;
  };

  const { placements, sampled } = plot.figure ? figurePlacements(plot, isCell) : eventPlacements(plot, isCell, cap, seed);

  // The die the player starts on: the one the plot names, or any that is not fixed.
  const named = startOf(plot);
  const starts = named !== undefined ? [index.get(named)!] : dice.flatMap((die, at) => (die.fixed ? [] : [at]));
  const faces = plot.faces ? [...plot.faces] : [...new Set(dice.map((die) => die.face))].sort((a, b) => a - b);

  const cum = new Float64Array(placements.length + 1);
  placements.forEach((cells, at) => {
    let product = starts.length;
    for (let die = 0; die < dice.length && product > 0; die++) product *= waysOf(die, cells[die]).count * 4;
    cum[at + 1] = cum[at] + product;
  });
  const total = cum[placements.length];

  const at = (i: number): Laid | null => {
    if (!(i >= 0 && i < total)) return null;
    let lo = 0;
    let hi = placements.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (cum[mid] <= i) lo = mid;
      else hi = mid - 1;
    }
    const cells = placements[lo];
    let rest = i - cum[lo];
    const start = starts[rest % starts.length];
    rest = Math.floor(rest / starts.length);
    const laid: PuzzleDie[] = [];
    const moves: number[] = [];
    const taken = new Set<number>();
    let length = 0;
    for (let die = 0; die < dice.length; die++) {
      const way = waysOf(die, cells[die]);
      const radix = way.count * 4;
      const digit = rest % radix;
      rest = Math.floor(rest / radix);
      const pick = digit >> 2;
      const from = way.from[pick];
      if (taken.has(from)) return null;
      taken.add(from);
      const lie = way.lies[digit];
      laid.push({ x: from % size, z: Math.floor(from / size), top: lie.top, north: lie.north, ...(dice[die].fixed ? { fixed: true } : {}) });
      moves.push(way.length[pick]);
      length += way.length[pick];
    }
    const spec: LevelSpec = {
      id: `${plot.name}-${i}`,
      seed: 0,
      size,
      ...(plot.holes && plot.holes.length > 0 ? { holes: plot.holes.map(({ x, z }) => ({ x, z })) } : {}),
      goal: { kind: 'clear' },
      moves: 0,
      values: faces,
      norm: dice.length,
      arrival: 'none',
      sinkMoves: 2,
      liftMoves: 1,
      faces,
      layout: { start: { x: laid[start].x, z: laid[start].z }, dice: laid },
      ...(plot.floor === false ? { floor: false } : {}),
    };
    return { spec, length, placement: lo, moves };
  };

  return {
    total,
    sampled,
    placements: placements.length,
    cellsOf: (placement) => placements[placement],
    range: (placement) => [cum[placement], cum[placement + 1]],
    at,
  };
}

/**
 * The placements of a figure: every shift of it on the board, and every turn and mirror where
 * it is not pinned, each set of named cells once. A die that ends on another takes its cell.
 */
function figurePlacements(plot: Plot, isCell: (x: number, z: number) => boolean): { placements: number[][]; sampled: boolean } {
  const { size, dice } = plot;
  const marks: { die: number; x: number; z: number }[] = [];
  plot.figure!.forEach((row, z) => {
    [...row].forEach((sign, x) => {
      if (sign !== '.') marks.push({ die: dice.findIndex((die) => die.name === sign), x, z });
    });
  });
  const shapes = new Map<string, { die: number; x: number; z: number }[]>();
  for (let turn = 0; turn < (plot.pinned ? 1 : 8); turn++) {
    const moved = marks.map(({ die, x, z }) => {
      let [a, b] = turn & 4 ? [z, x] : [x, z];
      if (turn & 1) a = -a;
      if (turn & 2) b = -b;
      return { die, x: a, z: b };
    });
    const x0 = Math.min(...moved.map((mark) => mark.x));
    const z0 = Math.min(...moved.map((mark) => mark.z));
    const shape = moved.map(({ die, x, z }) => ({ die, x: x - x0, z: z - z0 })).sort((a, b) => a.die - b.die);
    shapes.set(shape.map(({ die, x, z }) => `${die}:${x},${z}`).join(' '), shape);
  }
  const placements: number[][] = [];
  const seen = new Set<string>();
  for (const shape of shapes.values()) {
    for (let dz = 0; dz < size; dz++) {
      for (let dx = 0; dx < size; dx++) {
        if (!shape.every(({ x, z }) => isCell(x + dx, z + dz))) continue;
        const cells = new Array<number>(dice.length).fill(-1);
        for (const { die, x, z } of shape) cells[die] = (z + dz) * size + x + dx;
        dice.forEach((die, at) => {
          if (die.on !== undefined) cells[at] = cells[dice.findIndex((one) => one.name === die.on)];
        });
        const key = cells.join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        placements.push(cells);
      }
    }
  }
  return { placements, sampled: false };
}

/** Thrown to stop going through placements that are more than the cap. */
const TOO_MANY = Symbol('too many');

/**
 * The placements of the events, with no figure: the events in their order. The dice of a combo
 * on cells side by side, anywhere off the cells of the events before it; a link on a cell beside
 * its chain (the last combo and its links); of the 1s, the die brought on a cell beside the chain
 * and the 1s that stand anywhere. A die that ends on another takes its cell. Dice alike — face,
 * moves, fixed, and neither making their event nor carrying the player — are not told apart.
 * More placements than `cap` are not gone through: `cap` are drawn by the seed.
 */
function eventPlacements(plot: Plot, isCell: (x: number, z: number) => boolean, cap: number, seed: number): { placements: number[][]; sampled: boolean } {
  const { size, dice, events } = plot;
  const cellCount = size * size;
  const start = startOf(plot);
  const at = new Map(dice.map((die, i) => [die.name, i]));
  const beside = (cell: number): number[] =>
    DIRS.flatMap((dir) => {
      const x = (cell % size) + DELTA[dir].dx;
      const z = Math.floor(cell / size) + DELTA[dir].dz;
      return isCell(x, z) ? [z * size + x] : [];
    });
  const kindOf = (die: number): string => {
    const one = dice[die];
    const by = events[one.event].by === one.name;
    return JSON.stringify([one.face, one.comes ?? null, one.fixed ?? false, by ? one.name : '', one.name === start ? 'start' : '']);
  };

  /** Every way to put dice alike on cells: the cells in order, the dice in every distinct order of their kinds. */
  const arrange = (group: number[], cells: number[]): number[][] => {
    const kinds = group.map(kindOf);
    const out: number[][] = [];
    const used = new Array<boolean>(group.length).fill(false);
    const pick: number[] = [];
    const go = () => {
      if (pick.length === cells.length) return void out.push(pick.slice());
      const tried = new Set<string>();
      group.forEach((die, i) => {
        if (used[i] || tried.has(kinds[i])) return;
        tried.add(kinds[i]);
        used[i] = true;
        pick.push(die);
        go();
        pick.pop();
        used[i] = false;
      });
    };
    go();
    return out;
  };

  /** Every connected set of `n` cells of the board, found once for each `n`: a piece with no cell held is one of them that is free. */
  const piecesOfSize = new Map<number, number[][]>();
  const pieces = (n: number, held: number[], free: (cell: number) => boolean): number[][] => {
    if (held.length > 0) return piecesHolding(n, held, free);
    let all = piecesOfSize.get(n);
    if (!all) piecesOfSize.set(n, (all = piecesHolding(n, [], (cell) => isCell(cell % size, Math.floor(cell / size)))));
    return all.filter((piece) => piece.every(free));
  };

  /** Connected sets of `n` cells holding the cells given, the rest of them free. */
  const piecesHolding = (n: number, held: number[], free: (cell: number) => boolean): number[][] => {
    const out: number[][] = [];
    const seen = new Set<string>();
    const connected = (set: number[]): boolean => {
      const reached = new Set([set[0]]);
      const queue = [set[0]];
      for (let i = 0; i < queue.length; i++) for (const next of beside(queue[i])) if (set.includes(next) && !reached.has(next)) reached.add(next), queue.push(next);
      return reached.size === set.length;
    };
    const grow = (set: number[]) => {
      const key = [...set].sort((a, b) => a - b).join(',');
      if (seen.has(key)) return;
      seen.add(key);
      if (set.length === n) {
        if (connected(set)) out.push(set.slice());
        return;
      }
      const edge = new Set<number>();
      for (const cell of set) for (const next of beside(cell)) if (!set.includes(next) && free(next)) edge.add(next);
      for (const next of edge) grow([...set, next]);
    };
    if (held.length > 0) grow(held);
    else for (let cell = 0; cell < cellCount; cell++) if (free(cell)) grow([cell]);
    return out;
  };

  /** Ways to choose `k` free cells, in order of the cells. */
  const choose = (k: number, free: number[]): number[][] => {
    const out: number[][] = [];
    const pick: number[] = [];
    const go = (from: number) => {
      if (pick.length === k) return void out.push(pick.slice());
      for (let i = from; i < free.length; i++) {
        pick.push(free[i]);
        go(i + 1);
        pick.pop();
      }
    };
    go(0);
    return out;
  };

  /** The ways to put the dice of event `e` down, given the cells taken and the chain: each a die to a cell. */
  const optionsAt = (e: number, cells: number[], chain: number[]): [number, number][][] => {
    const own = dice.flatMap((die, i) => (die.event === e ? [i] : []));
    const onCell = (die: number) => cells[at.get(dice[die].on!)!];
    const taken = new Set(cells.filter((cell) => cell >= 0));
    const free = (cell: number) => isCell(cell % size, Math.floor(cell / size)) && !taken.has(cell);
    const ons = own.filter((die) => dice[die].on !== undefined);
    const rest = own.filter((die) => dice[die].on === undefined);
    const fixedOns: [number, number][] = ons.map((die) => [die, onCell(die)]);
    const event = events[e];
    if (event.kind === 'combo') {
      const options: [number, number][][] = [];
      for (const piece of pieces(own.length, fixedOns.map(([, cell]) => cell), free)) {
        const open = piece.filter((cell) => !fixedOns.some(([, held]) => held === cell));
        for (const order of arrange(rest, open)) options.push([...fixedOns, ...order.map((die, i): [number, number] => [die, open[i]])]);
      }
      return options;
    }
    const by = at.get(event.by)!;
    // A die that ends on another may end on a die of its own chain.
    const touching = (cell: number) => chain.includes(cell) || beside(cell).some((next) => chain.includes(next));
    const byCells = dice[by].on !== undefined ? [onCell(by)].filter(touching) : [...new Set(chain.flatMap(beside))].filter((cell) => free(cell));
    if (event.kind === 'link') return byCells.map((cell) => [[by, cell]]);
    // The 1s: the die brought beside the chain, and those that stand anywhere free.
    const standing = rest.filter((die) => die !== by);
    const held = fixedOns.filter(([die]) => die !== by);
    const options: [number, number][][] = [];
    // Brought by the player's own die, which stays and goes with a later event: that event puts it down, not this one.
    if (dice[by].event !== e) {
      const left: number[] = [];
      for (let other = 0; other < cellCount; other++) if (free(other)) left.push(other);
      for (const chosen of choose(standing.length, left)) {
        for (const order of arrange(standing, chosen)) options.push([...held, ...order.map((die, i): [number, number] => [die, chosen[i]])]);
      }
      return options;
    }
    for (const cell of byCells) {
      const left: number[] = [];
      for (let other = 0; other < cellCount; other++) if (other !== cell && free(other)) left.push(other);
      for (const chosen of choose(standing.length, left)) {
        for (const order of arrange(standing, chosen)) options.push([[by, cell], ...held, ...order.map((die, i): [number, number] => [die, chosen[i]])]);
      }
    }
    return options;
  };

  const chainAfter = (e: number, put: [number, number][], chain: number[]): number[] => {
    const kind = events[e].kind;
    if (kind === 'combo') return put.map(([, cell]) => cell);
    if (kind === 'link') return [...chain, ...put.map(([, cell]) => cell)];
    return chain;
  };

  const placements: number[][] = [];
  const cells = new Array<number>(dice.length).fill(-1);
  const all = (e: number, chain: number[]) => {
    if (e === events.length) {
      if (placements.length >= cap) throw TOO_MANY;
      placements.push(cells.slice());
      return;
    }
    for (const put of optionsAt(e, cells, chain)) {
      for (const [die, cell] of put) cells[die] = cell;
      all(e + 1, chainAfter(e, put, chain));
      for (const [die] of put) cells[die] = -1;
    }
  };
  try {
    all(0, []);
    return { placements, sampled: false };
  } catch (error) {
    if (error !== TOO_MANY) throw error;
  }
  // Too many to go through: drawn one by one, an option at every event, each placement once.
  const random = streamOf(seed);
  const drawn: number[][] = [];
  const seen = new Set<string>();
  // A space that cannot be gone through is sampled anyway: a few thousand placements carry the sample as well as all of them.
  const want = Math.min(cap, DRAWN_PLACEMENTS);
  for (let tries = 0; drawn.length < want && tries < want * 20; tries++) {
    const laid = new Array<number>(dice.length).fill(-1);
    let chain: number[] = [];
    let ok = true;
    for (let e = 0; e < events.length && ok; e++) {
      const options = optionsAt(e, laid, chain);
      if (options.length === 0) ok = false;
      else {
        const put = options[Math.floor(random() * options.length)];
        for (const [die, cell] of put) laid[die] = cell;
        chain = chainAfter(e, put, chain);
      }
    }
    const key = laid.join(',');
    if (!ok || seen.has(key)) continue;
    seen.add(key);
    drawn.push(laid);
  }
  return { placements: drawn, sampled: true };
}

/**
 * The indices to judge of a space: all of them in order where they are no more than `limit`;
 * else `limit` of them, spread over the whole space by a stride the seed picks.
 */
export function indexOrder(total: number, seed: number, limit: number): number[] {
  if (total <= limit) return Array.from({ length: total }, (_, i) => i);
  const random = streamOf(seed);
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  let stride = 1 + Math.floor(random() * (total - 1));
  while (gcd(stride, total) !== 1) stride++;
  const offset = Math.floor(random() * total);
  const out: number[] = new Array(limit);
  // stride * i can pass 2^53 on a big space: the sum is kept below the total instead.
  let at = offset;
  for (let i = 0; i < limit; i++) {
    out[i] = at;
    at = (at + stride) % total;
  }
  return out;
}

/** What a board is, to tell two laid ones apart: the field, the faces and the dice in the order of the rows. */
export function layKey(spec: LevelSpec): string {
  const layout = spec.layout!;
  const dice = layout.dice
    .map(({ x, z, top, north, fixed }) => `${z * spec.size + x}:${top}${north}${fixed ? '+' : ''}`)
    .sort((a, b) => parseInt(a) - parseInt(b));
  const holes = (spec.holes ?? []).map(({ x, z }) => z * spec.size + x).sort((a, b) => a - b);
  return `${spec.size}|${holes.join(',')}|${spec.floor === false ? 'shut' : 'open'}|${[...spec.values].sort().join('')}|${layout.start.z * spec.size + layout.start.x}${layout.onFloor ? 'f' : ''}|${dice.join(' ')}`;
}
