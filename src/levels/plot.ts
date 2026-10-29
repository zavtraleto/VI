import { cubeAt } from '../rules/board';
import { defaultConfig } from '../rules/config';
import { chainWindows } from '../rules/level';
import { moveOf, tellMove, type SolverMove } from '../rules/levelSolver';
import { scan } from '../rules/reach';
import { createRun } from '../rules/sim';
import type { Dir, LevelSpec, RunState, Technique } from '../rules/types';
import { safeFirstOf } from './measures';

/**
 * The plot of a board: what the generator lays it from (docs/superpowers/specs/2026-10-14-vi-level-generator-design.md,
 * section 3; the plan docs/superpowers/plans/2026-10-28-vi-level-generator.md). Which dice stand, which come and how,
 * the events in their order and the dice that make them, the figure it all ends in, and what the board is to teach.
 * A board is laid from its plot backwards (`layBack.ts`) and judged forwards on the real rules (`plotJudge.ts`).
 */

/** Where the working face of a die is, as the player sees it: the camera stands south-south-east. */
export type Side = 'top' | 'south' | 'east' | 'north' | 'west' | 'under';

/** How a die comes to the cell of its event. Backwards, this is how it is taken away. */
export interface Coming {
  /** The moves in their order: `r` a roll, `p` a push. Or `by` and `rolls`: so many moves of one kind. */
  seq?: string;
  by?: 'roll' | 'push';
  /** Moves, from and to. */
  rolls?: readonly [number, number];
  /** In a straight line, with a turn at least once, or as it comes. Rolls only. */
  line?: 'straight' | 'turn' | 'any';
  /** Rolls that take the die farther from the cell of its event, exactly; left out, as many as come. */
  away?: number;
  /** Where the working face is at the start: any of those named; left out, wherever it comes. */
  starts?: readonly Side[];
}

export interface PlotDie {
  /** One sign: the die stands by it in the figure. */
  name: string;
  /** The face it goes with: on top at its event. */
  face: number;
  /** The number of the event it goes with, from 0. */
  event: number;
  /** Left out, the die stands on the cell of its event from the start, its face up. */
  comes?: Coming;
  /** The die cannot be rolled or pushed (`fixed` of a die of a layout): it stands on the cell of its event. */
  fixed?: boolean;
  /**
   * The die of an earlier event whose cell this one ends on: it comes over that die as it leaves
   * (a roll onto a leaving die). Such a die has no cell of its own in the figure.
   */
  on?: string;
}

export interface PlotEvent {
  kind: 'combo' | 'link' | 'ones';
  /** The die whose last move makes the event. */
  by: string;
  /** Of a link: the moves the leaving dice still had when it joined (0, the last it could be made on). */
  spare?: number;
}

export type Lesson =
  | { kind: 'keeps'; after: number; moves: readonly [number, number]; slack?: number }
  | { kind: 'bait'; at: number; move: 'event' | 'greedy'; fate: 'dead' | 'longer'; depth?: readonly [number, number]; over?: number }
  | { kind: 'safeFirst' };

/** The gates of the last stage: the measures of the scale (docs/superpowers/specs/2026-10-28-vi-progression-tools-design.md). */
export interface Want {
  /** D within these. */
  d?: readonly [number, number];
  /** The rank at least. */
  rank?: number;
  forks?: number;
  /** Long ways (`waysLong`) at least. */
  ways?: number;
  /** Dice whose goal face is not seen at the start, from and to. */
  hidden?: readonly [number, number];
  /** Like no board of the row (similarity below `SIMILAR_ROW`, no core of a place repeated). True when left out. */
  novel?: boolean;
  /** Boards the board is not held against for being new: those it deepens. */
  instead?: readonly string[];
  /** The fixed dice cost the player at least so many moves: with them made dice that roll, the board is cleared this much sooner. */
  fixedCost?: number;
  /** The fewest moves, from and to. */
  par?: readonly [number, number];
}

export interface Plot {
  /** The word of its batch of files (`BATCH_WORD`). */
  name: string;
  size: number;
  holes?: readonly { x: number; z: number }[];
  /** False where the floor is shut; open when left out. */
  floor?: boolean;
  /** The faces of the board for its file; those of the dice when left out. */
  faces?: readonly number[];
  dice: readonly PlotDie[];
  /** The events in their order; the order of the quiet moves between them is not said. */
  events: readonly PlotEvent[];
  /** The figure of the end: the names of the dice on the cells of their events, row by row from the north; `.` any cell. */
  figure?: readonly string[];
  /** The figure stands as it is drawn; left out, it is laid shifted, turned and mirrored too. */
  pinned?: boolean;
  /** The die the player starts on; left out, `o` where there is one, and any die that is not fixed where there is not. */
  start?: string;
  /** What the board is to teach; `safeFirst` when left out, none with `[]`. */
  lessons?: readonly Lesson[];
  /** Moves the shortest way has to lean on, and moves it must not. */
  needs?: readonly Technique[];
  avoid?: readonly Technique[];
  /**
   * The route of the shortest way exactly (`Score.route`: `K` a combo, `L` a link, `v` down, `^` up, `~` on over a
   * leaving die…); left out, any. The events alone do not say whether the way walks over the leaving dice or goes down.
   */
  route?: string;
  want?: Want;
  /** A line for the note of the files. */
  brief?: string;
}

/** The word of a batch, as `BATCH_WORD` of `labText.ts` has it: not imported, to keep this module light. */
const WORD = /^[a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*$/;

const KINDS: readonly PlotEvent['kind'][] = ['combo', 'link', 'ones'];

/** The moves a die comes in: the kinds of them in order, one string to each length it may come in. */
export function seqsOf(comes: Coming): string[] {
  if (comes.seq !== undefined) return [comes.seq];
  const [from, to] = comes.rolls ?? [1, 1];
  const sign = comes.by === 'push' ? 'p' : 'r';
  const seqs: string[] = [];
  for (let moves = from; moves <= to; moves++) seqs.push(sign.repeat(moves));
  return seqs;
}

/** The fewest moves the plot is played in and the most: the moves of every die that comes, added up. */
export function plotLength(plot: Plot): [number, number] {
  let least = 0;
  let most = 0;
  for (const die of plot.dice) {
    if (!die.comes) continue;
    const lengths = seqsOf(die.comes).map((seq) => seq.length);
    least += Math.min(...lengths);
    most += Math.max(...lengths);
  }
  return [least, most];
}

/** The die a plot starts the player on: the one it names, else `o`, else none said (any that is not fixed). */
export function startOf(plot: Plot): string | undefined {
  return plot.start ?? (plot.dice.some((die) => die.name === 'o') ? 'o' : undefined);
}

/** What is wrong with a plot, a line to each mistake; empty where it can be laid. */
export function checkPlot(plot: Plot): string[] {
  const wrong: string[] = [];
  if (!WORD.test(plot.name)) wrong.push(`name "${plot.name}" is no word of a batch`);
  if (!Number.isInteger(plot.size) || plot.size < 2 || plot.size > 8) wrong.push(`size ${plot.size} is not 2 to 8`);
  const names = new Set<string>();
  for (const die of plot.dice) {
    if (!/^[a-z0-9]{1,3}$/.test(die.name)) wrong.push(`die "${die.name}": a name is a letter or a few`);
    if (names.has(die.name)) wrong.push(`die "${die.name}" is named twice`);
    names.add(die.name);
    if (!Number.isInteger(die.face) || die.face < 1 || die.face > 6) wrong.push(`die ${die.name}: face ${die.face} is no face of a die`);
    if (!Number.isInteger(die.event) || die.event < 0 || die.event >= plot.events.length) wrong.push(`die ${die.name}: no event ${die.event}`);
    if (die.fixed && die.comes) wrong.push(`die ${die.name} is fixed and comes`);
    const comes = die.comes;
    if (!comes) continue;
    if (comes.seq !== undefined && !/^[rp]+$/.test(comes.seq)) wrong.push(`die ${die.name}: seq "${comes.seq}" is not of r and p`);
    if (comes.seq !== undefined && (comes.by !== undefined || comes.rolls !== undefined)) wrong.push(`die ${die.name}: seq and by/rolls both said`);
    if (comes.rolls && (comes.rolls[0] < 1 || comes.rolls[1] < comes.rolls[0])) wrong.push(`die ${die.name}: rolls ${comes.rolls.join('-')} are no span of moves`);
    if (comes.away !== undefined && (comes.away < 0 || !Number.isInteger(comes.away))) wrong.push(`die ${die.name}: away ${comes.away}`);
  }
  for (const die of plot.dice) {
    if (die.on === undefined) continue;
    const under = plot.dice.find((one) => one.name === die.on);
    if (!die.comes) wrong.push(`die ${die.name} ends on ${die.on} and does not come`);
    if (!under) wrong.push(`die ${die.name}: no die ${die.on} to end on`);
    else if (under.event >= die.event) wrong.push(`die ${die.name} ends on ${die.on}, which leaves no earlier`);
    else if (under.on !== undefined) wrong.push(`die ${die.name} ends on ${die.on}, which ends on another`);
    else if (plot.dice.some((one) => one !== die && one.on === die.on)) wrong.push(`two dice end on ${die.on}`);
  }
  plot.events.forEach((event, index) => {
    if (!KINDS.includes(event.kind)) wrong.push(`event ${index}: no kind ${event.kind}`);
    const dice = plot.dice.filter((die) => die.event === index);
    if (dice.length === 0) wrong.push(`event ${index} has no dice`);
    const by = plot.dice.find((die) => die.name === event.by);
    // The 1s brought by the player's own die are the one case of a die that makes an event and does not go with it: it
    // stays under them and goes later, with its own event (the rules of the level, section 4).
    if (!by) wrong.push(`event ${index}: no die ${event.by}`);
    else if (by.event !== index && !(event.kind === 'ones' && by.event > index)) wrong.push(`event ${index}: ${event.by} leaves in event ${by.event}, not in its own`);
    else if (!by.comes) wrong.push(`event ${index}: ${event.by} makes it and does not come`);
    if (event.kind === 'combo') {
      const faces = new Set(dice.map((die) => die.face));
      if (faces.size > 1) wrong.push(`event ${index}: a combo of faces ${[...faces].join(', ')}`);
      const face = dice[0]?.face ?? 0;
      if (face < 2) wrong.push(`event ${index}: a combo of ${face}s`);
      else if (dice.length < face) wrong.push(`event ${index}: a combo of ${dice.length} dice of ${face}s`);
    }
    if (event.kind === 'link' && dice.length !== 1) wrong.push(`event ${index}: a link of ${dice.length} dice`);
    if (event.kind === 'ones' && dice.some((die) => die.face !== 1)) wrong.push(`event ${index}: the 1s go with a die that is no 1`);
    if (event.kind !== 'combo' && index === 0) wrong.push(`event 0 is a ${event.kind}: there is no combo to bring it to`);
    if (event.spare !== undefined && event.kind !== 'link') wrong.push(`event ${index}: spare of a ${event.kind}`);
  });
  const start = startOf(plot);
  if (start !== undefined) {
    const die = plot.dice.find((one) => one.name === start);
    if (!die) wrong.push(`start: no die ${start}`);
    else if (die.fixed) wrong.push(`start: ${start} is fixed`);
  } else if (plot.dice.every((die) => die.fixed)) wrong.push('every die is fixed: nowhere to start');
  if (plot.figure) {
    const width = plot.figure[0]?.length ?? 0;
    const seen = new Set<string>();
    plot.figure.forEach((row, z) => {
      if (row.length !== width) wrong.push(`figure: row ${z} is ${row.length} wide, not ${width}`);
      for (const sign of row) {
        if (sign === '.') continue;
        if (!names.has(sign)) wrong.push(`figure: no die ${sign}`);
        else if (seen.has(sign)) wrong.push(`figure: ${sign} stands twice`);
        seen.add(sign);
      }
    });
    for (const die of plot.dice) {
      if (die.on === undefined && !seen.has(die.name)) wrong.push(`figure: ${die.name} is not in it`);
      if (die.on !== undefined && seen.has(die.name)) wrong.push(`figure: ${die.name} ends on ${die.on} and has a cell of its own`);
    }
  }
  for (const hole of plot.holes ?? []) if (hole.x < 0 || hole.z < 0 || hole.x >= plot.size || hole.z >= plot.size) wrong.push(`hole ${hole.x},${hole.z} off the board`);
  return wrong;
}

/** One move of a way as the plot reads it. */
export interface WayBeat {
  /** The die moved, by its place among the dice of the layout. */
  die: number;
  move: SolverMove;
  event: 'none' | PlotEvent['kind'];
  /** Of a link: the moves the leaving dice still had when it joined. */
  spare: number | null;
  /** The dice, by their place in the layout, that began to leave with this move. */
  left: number[];
}

/** A way through a board read die by die: every move, and for every die where it was and what it showed when it began to leave. */
export interface WayRead {
  beats: WayBeat[];
  /** By die: the move it began to leave on (-1 for one that never did), its cell then and its top. */
  leftOn: number[];
  leftAt: { x: number; z: number }[];
  leftAs: number[];
}

/**
 * Plays a way on the real rules and tells every die apart: the one each move is made with, the
 * dice each move sets going. The dice are counted in the order of the layout. A move the rules do
 * not offer is a mistake in the way, and it says so.
 */
export function readWay(spec: LevelSpec, way: readonly SolverMove[]): WayRead {
  let state: RunState = createRun({ seed: spec.seed, config: defaultConfig(), level: { ...spec, moves: 0 } });
  const dice = spec.layout?.dice ?? [];
  // The run numbers its dice; the plot counts them as the layout lays them.
  const indexOf = new Map<number, number>();
  for (const cube of state.cubes) indexOf.set(cube.id, dice.findIndex((die) => die.x === cube.x && die.z === cube.z));
  const leftOn = dice.map(() => -1);
  const leftAt = dice.map(() => ({ x: -1, z: -1 }));
  const leftAs = dice.map(() => 0);
  const beats: WayBeat[] = [];
  way.forEach((move, index) => {
    const found = state.over ? undefined : scan(state).moves.find((m) => m.x === move.x && m.z === move.z && m.dir === move.dir && m.push === move.push);
    if (!found) throw new Error(`level ${spec.id}: move ${index + 1} cannot be made`);
    const cube = cubeAt(state, move.x, move.z)!;
    const going = new Set(state.cubes.filter((c) => c.state === 'sinking').map((c) => c.id));
    const windows = chainWindows(state);
    const told = tellMove(state, move);
    const { outcome } = told;
    const event: WayBeat['event'] = outcome.ones ? 'ones' : outcome.link ? 'link' : outcome.cleared ? 'combo' : 'none';
    const face = outcome.values[0] ?? 0;
    const open = windows.filter((window) => window.value === face).map((window) => window.moves);
    const left: number[] = [];
    for (const c of told.state.cubes) {
      if (c.state !== 'sinking' || going.has(c.id)) continue;
      const die = indexOf.get(c.id)!;
      left.push(die);
      leftOn[die] = index;
      leftAt[die] = { x: c.x, z: c.z };
      leftAs[die] = c.ori.top;
    }
    beats.push({ die: indexOf.get(cube.id)!, move, event, spare: event === 'link' && open.length > 0 ? Math.max(...open) - 1 : null, left });
    state = told.state;
  });
  return { beats, leftOn, leftAt, leftAs };
}

/** A name of a batch made of any id: lower case, words of letters and digits, a word that starts with a digit joined to the one before. */
export function plotWord(text: string): string {
  const words = text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word !== '');
  const out: string[] = [];
  for (const word of words) {
    if (/^[a-z]/.test(word)) out.push(word);
    else if (out.length > 0) out[out.length - 1] += word;
    else out.push(`b${word}`);
  }
  return out.join('-') || 'plot';
}

const STEP: Record<Dir, { dx: number; dz: number }> = { N: { dx: 0, dz: -1 }, S: { dx: 0, dz: 1 }, E: { dx: 1, dz: 0 }, W: { dx: -1, dz: 0 } };

/**
 * The plot of an authored board, read off its way: which dice stand and which come, by what
 * moves, the events and the dice that make them, the figure of the cells the dice leave from.
 * Laid back (`layBack.ts`), it gives the same thought in other layouts; varied (`varyPlot`), a
 * deeper one. `line` and `away` are said as the way has them, so the board itself is among the
 * layouts of its plot. A board with dice already leaving, or a start on the floor, has no plot.
 */
export function plotOfBoard(spec: LevelSpec, way: readonly string[] | undefined = spec.solution): Plot {
  const layout = spec.layout;
  if (!layout) throw new Error(`board ${spec.id}: no layout, no plot`);
  if ((layout.leaving ?? []).length > 0 || layout.onFloor) throw new Error(`board ${spec.id}: dice leaving or a start on the floor: no plot is read off such a board`);
  if (!way || way.length === 0) throw new Error(`board ${spec.id}: no way to read a plot off`);
  const read = readWay(spec, way.map(moveOf));
  const lost = read.leftOn.findIndex((on) => on < 0);
  if (lost >= 0) throw new Error(`board ${spec.id}: the way does not clear the die at ${layout.dice[lost].x},${layout.dice[lost].z}`);
  const startDie = layout.dice.findIndex((die) => die.x === layout.start.x && die.z === layout.start.z);
  const letters = 'abcdefghijklmnpqrstuvwxyz';
  let next = 0;
  const names = layout.dice.map((_, index) => (index === startDie ? 'o' : letters[next++]));
  const eventOf = new Map<number, number>();
  const events: PlotEvent[] = [];
  read.beats.forEach((beat, index) => {
    if (beat.event === 'none') return;
    eventOf.set(index, events.length);
    events.push({ kind: beat.event, by: names[beat.die], ...(beat.event === 'link' && beat.spare !== null ? { spare: beat.spare } : {}) });
  });
  const dice: PlotDie[] = layout.dice.map((laid, index) => {
    const event = eventOf.get(read.leftOn[index]);
    if (event === undefined) throw new Error(`board ${spec.id}: die ${names[index]} begins to leave on a move that sets nothing off`);
    const own = read.beats.filter((beat, at) => beat.die === index && at <= read.leftOn[index]).map((beat) => beat.move);
    const die: PlotDie = { name: names[index], face: read.leftAs[index], event, ...(laid.fixed ? { fixed: true } : {}) };
    if (own.length === 0) return die;
    const home = read.leftAt[index];
    const far = (x: number, z: number) => Math.abs(x - home.x) + Math.abs(z - home.z);
    const rolls = own.filter((move) => !move.push);
    const away = rolls.filter((move) => far(move.x + STEP[move.dir].dx, move.z + STEP[move.dir].dz) > far(move.x, move.z)).length;
    const comes: Coming = {
      seq: own.map((move) => (move.push ? 'p' : 'r')).join(''),
      ...(rolls.length === own.length && own.length >= 2 ? { line: own.every((move) => move.dir === own[0].dir) ? ('straight' as const) : ('turn' as const) } : {}),
      ...(rolls.length > 0 ? { away } : {}),
    };
    return { ...die, comes };
  });
  // A die that leaves from the cell a die of an earlier event left from came over it: it ends on that die.
  const cells = read.leftAt;
  const own: number[] = [];
  const byLeaving = dice.map((_, index) => index).sort((a, b) => read.leftOn[a] - read.leftOn[b]);
  for (const index of byLeaving) {
    const under = own.find((other) => cells[other].x === cells[index].x && cells[other].z === cells[index].z && read.leftOn[other] < read.leftOn[index]);
    if (under !== undefined) dice[index].on = names[under];
    else own.push(index);
  }
  // The figure: the cells the dice leave from, but those that end on another.
  const xs = own.map((index) => cells[index].x);
  const zs = own.map((index) => cells[index].z);
  const figure: string[] = [];
  for (let z = Math.min(...zs); z <= Math.max(...zs); z++) {
    let row = '';
    for (let x = Math.min(...xs); x <= Math.max(...xs); x++) {
      const at = own.find((index) => cells[index].x === x && cells[index].z === z);
      row += at === undefined ? '.' : names[at];
    }
    figure.push(row);
  }
  return {
    name: plotWord(`${spec.id}-deep`),
    size: spec.size,
    ...(spec.holes && spec.holes.length > 0 ? { holes: spec.holes.map(({ x, z }) => ({ x, z })) } : {}),
    ...(spec.floor === false ? { floor: false } : {}),
    faces: [...(spec.faces ?? spec.values)],
    dice,
    events,
    figure,
    pinned: false,
    start: 'o',
    lessons: safeFirstOf(spec) ? [{ kind: 'safeFirst' }] : [],
    want: { instead: [spec.id] },
  };
}

/** How a plot is made deeper: see `varyPlot`. */
export interface Vary {
  /** Every die that comes may come in so many moves more. */
  rolls?: number;
  /** A link of one more die to the last combo (`link`), or one more die standing in it (`die`). */
  grow?: 'link' | 'die';
  /** Faces changed: `{ 2: 3 }` makes the 2s 3s; a combo gets dice standing to its new face. */
  face?: Record<number, number>;
  /** The figure is laid turned and mirrored too. */
  turn?: boolean;
}

/**
 * A plot made deeper. `rolls`: a die that comes by moves of one kind comes by one to so many
 * more (`seq` becomes `by` and `rolls`); one that mixes rolls and pushes keeps its moves. `face`:
 * faces changed, and a combo short of dice for its new face gets dice that stand, named `a1`,
 * `a2`…. `grow`: one more die, a link that comes in one roll or two, or a die standing in the
 * last combo. A die added has no cell in the figure, so the figure goes and the events are laid
 * without it. `turn`: the figure is not pinned.
 */
export function varyPlot(plot: Plot, vary: Vary): Plot {
  let dice: PlotDie[] = plot.dice.map((die) => ({ ...die, ...(die.comes ? { comes: { ...die.comes } } : {}) }));
  let events: PlotEvent[] = plot.events.map((event) => ({ ...event }));
  let figure = plot.figure;
  let faces = plot.faces ? [...plot.faces] : undefined;
  const taken = new Set(dice.map((die) => die.name));
  const fresh = (): string => {
    let n = 1;
    while (taken.has(`a${n}`)) n++;
    taken.add(`a${n}`);
    return `a${n}`;
  };
  if (vary.rolls) {
    for (const die of dice) {
      const comes = die.comes;
      if (!comes) continue;
      if (comes.seq !== undefined) {
        if (!/^(r+|p+)$/.test(comes.seq)) continue;
        const { seq, ...rest } = comes;
        die.comes = { ...rest, by: seq[0] === 'p' ? 'push' : 'roll', rolls: [seq.length, seq.length + vary.rolls] };
      } else {
        const [from, to] = comes.rolls ?? [1, 1];
        die.comes = { ...comes, rolls: [from, to + vary.rolls] };
      }
    }
  }
  if (vary.face) {
    const change = (face: number) => vary.face![face] ?? face;
    dice = dice.map((die) => ({ ...die, face: change(die.face) }));
    if (faces) faces = [...new Set(faces.map(change))].sort((a, b) => a - b);
    events.forEach((event, index) => {
      if (event.kind !== 'combo') return;
      const own = dice.filter((die) => die.event === index);
      const face = own[0]?.face ?? 0;
      for (let more = own.length; more < face; more++) {
        dice.push({ name: fresh(), face, event: index });
        figure = undefined;
      }
    });
  }
  if (vary.grow) {
    const last = events.map((event) => event.kind).lastIndexOf('combo');
    if (last >= 0) {
      const face = dice.find((die) => die.event === last)!.face;
      // The chain of the last combo: it and the links that follow it.
      let end = last;
      while (end + 1 < events.length && events[end + 1].kind === 'link') end++;
      if (vary.grow === 'die') dice.push({ name: fresh(), face, event: last });
      else {
        const name = fresh();
        events = [...events.slice(0, end + 1), { kind: 'link', by: name }, ...events.slice(end + 1)];
        dice = dice.map((die) => (die.event > end ? { ...die, event: die.event + 1 } : die));
        dice.push({ name, face, event: end + 1, comes: { by: 'roll', rolls: [1, 2] } });
      }
      figure = undefined;
    }
  }
  const out: Plot = { ...plot, dice, events, ...(faces ? { faces } : {}) };
  if (figure) out.figure = figure;
  else delete out.figure;
  if (vary.turn || !figure) out.pinned = false;
  return out;
}
