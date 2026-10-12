import { defaultConfig } from '../rules';
import { scoreOf } from '../rules/levelScore';
import { moveOf, movesAt, playMove, solveFrom, tellMove, tryWay } from '../rules/levelSolver';
import type { LevelSpec, RunState, Technique } from '../rules/types';
import type { Recipe, Scene } from './recipes';

/**
 * An order for a board: what the owner sets on the panel of the lab when a board is to be laid
 * for him. It is the numbers of the board and, besides them, only what he has said: a thing
 * left unsaid is not asked of the board at all. An order is made into the recipe of a place
 * (`recipeOf`), and the board is laid and judged by what lays and judges the boards of the list;
 * the two things a recipe has no word for, the events of the way and how deep a trap is, are
 * measured here (`orderMisses`).
 *
 * A preset is an order with a name: a kind of level the owner asks for by what it is to feel
 * like. It sets the sliders, and any of them is then moved by hand. The numbers of the presets
 * are a first guess and are kept as data: they are corrected by what he answers after a play.
 */
export interface Order {
  size: number;
  /** Cells cut out of the square, each as its x and z. */
  holes?: readonly (readonly [number, number])[];
  dice: number;
  /** Dice the board may hold over `dice`. */
  more?: number;
  /** The faces that work; with a 1 among them the 1s work. */
  faces: readonly number[];
  floorShut?: boolean;
  /** Fewest moves the board is cleared in, from so many to so many. */
  par: readonly [number, number];
  /** What the way cannot do without, and what it must do without. */
  needs?: readonly Technique[];
  avoid?: readonly Technique[];
  /** Moves of the way before its first event. */
  quiet?: readonly [number, number];
  /** Events of the way: its combos, its links, the 1s going. */
  events?: readonly [number, number];
  /** Moves of the way after the event before its last. */
  tail?: readonly [number, number];
  /** How the way ends: the event of its last move, and the moves a link had to spare. */
  endsOn?: { event: 'combo' | 'link' | 'ones'; spare?: number };
  /** First moves after which the board is still cleared within a move of the fewest. */
  firsts?: readonly [number, number];
  /** `any`: a move of the first two that sets something off leaves a board that cannot be cleared. `none`: no such move does. */
  trap?: 'none' | 'any';
  /** Moves that can still be made after a wrong move of the first two before the board is seen to be lost. */
  trapDepth?: readonly [number, number];
  /** The face that works lies under a die at the start (`hidden`), or under none (`shown`). */
  hidden?: 'shown' | 'hidden';
  /** Steps from the die the player starts on to the die of the first move, at the least. */
  far?: number;
  /** Dice the last event takes. */
  last?: readonly [number, number];
  /** The name of the preset the order was begun from. */
  preset?: string;
}

/**
 * The routes boards of a preset are built from backwards, where a preset has one: laid at
 * random, a board that ends on a link made at the last moment is one in dozens, and built from
 * its route it is most of them.
 */
const PRESET_SCENES: Readonly<Record<string, ((face: number) => Scene[]) | undefined>> = {
  lastMove: (face) => [
    { event: 'combo', face, by: 'roll', moves: [1, 2] },
    { event: 'link', face, by: 'roll', moves: [2, 2] },
  ],
  flow: (face) => [
    { event: 'combo', face, by: 'roll', moves: [1, 2] },
    { event: 'link', face, by: 'roll', moves: [1, 2] },
    { event: 'link', face, by: 'roll', moves: [1, 2] },
  ],
};

/** The place an order is: no place of the list has this number. */
const ORDER_SLOT = 900;

/** The recipe of the place an order asks for. Only what the order says is in it: the players made of the rules are not asked, so that a board is judged in a moment. */
export function recipeOf(order: Order): Recipe {
  const faces = order.faces.filter((face) => face !== 1);
  const ones = order.faces.includes(1);
  // The route a preset is built from is laid on the first face of the order that makes groups.
  const scenes = order.preset && faces.length > 0 ? PRESET_SCENES[order.preset]?.(faces[0]) : undefined;
  return {
    slot: ORDER_SLOT,
    id: 'O',
    chapter: 0,
    compact: false,
    size: order.size,
    ...(order.holes && order.holes.length > 0 ? { holes: order.holes } : {}),
    dice: order.dice,
    ...(order.more ? { more: order.more } : {}),
    faces,
    ...(ones ? { ones: 1 } : {}),
    par: order.par,
    ...(order.floorShut ? { floor: false } : {}),
    ...(order.needs && order.needs.length > 0 ? { needs: order.needs } : {}),
    ...(order.avoid && order.avoid.length > 0 ? { avoid: order.avoid } : {}),
    ...(order.quiet ? { quiet: order.quiet } : {}),
    ...(order.tail ? { tail: order.tail } : {}),
    ...(order.endsOn ? { ends: order.endsOn } : {}),
    ...(order.firsts ? { firsts: order.firsts } : {}),
    ...(order.trap === 'any' ? { trap: 'any' as const } : {}),
    ...(order.hidden ? { under: order.hidden === 'hidden' } : {}),
    ...(order.far !== undefined ? { far: order.far } : {}),
    ...(order.last ? { last: order.last } : {}),
    ...(scenes ? { scenes } : {}),
  };
}

/** Boards a search for the rest of a way may see from a board a move off the way: enough to say there is no way. */
const DEAD_MAX_STATES = 30_000;
/** Moves a trap is followed for, and boards kept at every move of it: a trap deeper than this is as deep as this. */
const TRAP_CAP = 6;
const TRAP_WIDTH = 40;

/** Moves that can still be made from a board, at the most, before every way from it has come to its end; `TRAP_CAP` at the most. */
function survival(state: RunState): number {
  let front = [state];
  for (let made = 0; made < TRAP_CAP; made++) {
    const next: RunState[] = [];
    for (const board of front) {
      for (const move of movesAt(board)) {
        const after = playMove(board, move);
        if (!after.over && next.length < TRAP_WIDTH) next.push(after);
      }
    }
    if (next.length === 0) return made;
    front = next;
  }
  return TRAP_CAP;
}

/**
 * How deep the trap of a board is. A trap is a move that tempts and is wrong: among the moves
 * there are at the start and after the first move of the way, one that sets something off, a
 * combo or a link, and leaves a board that cannot be cleared. Its depth is the most moves that
 * can still be made after it before the board is seen to be lost; 0 is a board lost at once.
 * Null where no such move is there. Only the moves that set something off are asked: a quiet
 * move that loses the board is a slip, and to prove every quiet move sound would take the
 * search of each.
 */
export function trapDepthOf(spec: LevelSpec, way: readonly string[]): number | null {
  let deepest: number | null = null;
  for (const made of [0, 1]) {
    if (made > way.length) break;
    const state = tryWay(spec, way.slice(0, made).map(moveOf), defaultConfig()).state;
    if (state.over) break;
    for (const move of movesAt(state)) {
      const { state: after, outcome } = tellMove(state, move);
      if (!outcome.cleared || after.endReason === 'passed') continue;
      let depth: number;
      if (after.over) depth = 0;
      else {
        const solved = solveFrom(after, { maxStates: DEAD_MAX_STATES });
        if (solved.solution || !solved.exhausted) continue;
        depth = survival(after);
      }
      deepest = Math.max(deepest ?? 0, depth);
    }
  }
  return deepest;
}

const outside = (value: number, [from, to]: readonly [number, number]): boolean => value < from || value > to;
const span = ([from, to]: readonly [number, number]): string => (from === to ? String(from) : `${from}-${to}`);

/** What a board does not meet of an order in the things no recipe asks: the events of its way, and its trap. Empty where it meets them, or the order says nothing of them. */
export function orderMisses(order: Order, spec: LevelSpec, way: readonly string[]): string[] {
  const misses: string[] = [];
  if (order.events) {
    const events = scoreOf(spec, way.map(moveOf)).beats.filter((beat) => beat.event !== 'none').length;
    if (outside(events, order.events)) misses.push(`events ${events}, not ${span(order.events)}`);
  }
  if (order.trap !== undefined || order.trapDepth) {
    const depth = trapDepthOf(spec, way);
    if (order.trap === 'none' && depth !== null) misses.push('a trap in the first two moves, where none was asked for');
    if (order.trap === 'any' && !order.trapDepth && depth === null) misses.push('no trap, where one was asked for');
    if (order.trapDepth && order.trap !== 'none') {
      if (depth === null) misses.push(`no trap, where one ${span(order.trapDepth)} moves deep was asked for`);
      else if (outside(depth, order.trapDepth)) misses.push(`trap ${depth} moves deep, not ${span(order.trapDepth)}`);
    }
  }
  return misses;
}

/** A kind of level by what it is to feel like: its name on the panel, and what it sets. */
export interface Preset {
  name: string;
  order: Partial<Order>;
}

/**
 * The presets, by their keys. Four are the owner's own of 12 October 2026: one guess, flow, on
 * the last move, deceptive; four he took after the research: a wall, a gift, mastery, a finale.
 * Their numbers are a first guess. A wall and a gift are places in a run of boards more than
 * boards: alone they are a long strict board and a short forgiving one, and in a set
 * (`sets.ts`) they are set by what was played before them.
 */
export const PRESETS: Readonly<Record<string, Preset>> = {
  insight: { name: 'одна догадка', order: { size: 4, dice: 4, faces: [2], par: [3, 5], firsts: [1, 1], trap: 'none', avoid: ['ones'] } },
  flow: { name: 'поток', order: { size: 4, dice: 5, more: 1, faces: [2], par: [5, 8], events: [3, 9], firsts: [2, 9], avoid: ['ones'] } },
  lastMove: { name: 'на последнем ходу', order: { size: 4, dice: 5, faces: [2], par: [3, 6], needs: ['link'], endsOn: { event: 'link', spare: 0 }, avoid: ['ones'] } },
  tricky: { name: 'обманчивая', order: { size: 4, dice: 5, faces: [2], par: [3, 7], trap: 'any', trapDepth: [0, 6], avoid: ['ones'] } },
  // Four more, after the research of the emotions of a level (docs/VI_Level_Emotion_Research.md): what the first four do not cover.
  wall: { name: 'стена', order: { size: 4, dice: 5, faces: [2], par: [7, 10], firsts: [1, 1], avoid: ['ones'] } },
  gift: { name: 'подарок', order: { size: 4, dice: 4, faces: [2], par: [2, 3], firsts: [2, 9], trap: 'none', avoid: ['ones'] } },
  mastery: { name: 'мастерство', order: { size: 4, dice: 5, faces: [2], par: [3, 5], firsts: [1, 9], avoid: ['ones'] } },
  finale: { name: 'развязка', order: { size: 4, dice: 5, more: 1, faces: [2], par: [3, 6], last: [3, 9], avoid: ['ones'] } },
};

/** The order a board is asked by where nothing is said: a small board of one face. */
export const BASE_ORDER: Order = { size: 4, dice: 5, faces: [2], par: [3, 6] };

/** The order a preset is: its own numbers, and nothing of the order that was in hand but the cells cut out by hand. */
export function applyPreset(order: Order, key: string): Order {
  const preset = Object.hasOwn(PRESETS, key) ? PRESETS[key] : undefined;
  if (!preset) throw new Error(`no preset "${key}": the presets are ${Object.keys(PRESETS).join(', ')}`);
  return { ...BASE_ORDER, ...(order.holes ? { holes: order.holes } : {}), ...preset.order, preset: key };
}

const TECHNIQUES: readonly Technique[] = ['link', 'glass', 'floor', 'ones'];

/** An order in a line, as a note of a file keeps it and a command takes it: `size=4 dice=5 faces=2 par=3-6 needs=link trap=any`. */
export function orderText(order: Order): string {
  const said: (string | false | undefined)[] = [
    order.preset && `as=${order.preset}`,
    `size=${order.size}`,
    order.holes && order.holes.length > 0 && `holes=${order.holes.map(([x, z]) => `${x}.${z}`).join(',')}`,
    `dice=${order.dice}`,
    order.more ? `more=${order.more}` : false,
    `faces=${order.faces.join(',')}`,
    order.floorShut && 'floor=shut',
    `par=${span(order.par)}`,
    order.needs && order.needs.length > 0 && `needs=${order.needs.join(',')}`,
    order.avoid && order.avoid.length > 0 && `avoid=${order.avoid.join(',')}`,
    order.quiet && `quiet=${span(order.quiet)}`,
    order.events && `events=${span(order.events)}`,
    order.tail && `tail=${span(order.tail)}`,
    order.endsOn && `ends=${order.endsOn.event}${order.endsOn.spare === undefined ? '' : `.${order.endsOn.spare}`}`,
    order.firsts && `firsts=${span(order.firsts)}`,
    order.trap && `trap=${order.trap}`,
    order.trapDepth && `trapdepth=${span(order.trapDepth)}`,
    order.hidden && `hidden=${order.hidden === 'hidden' ? 'yes' : 'no'}`,
    order.far !== undefined && `far=${order.far}`,
    order.last && `last=${span(order.last)}`,
  ];
  return said.filter(Boolean).join(' ');
}

/** Reads an order from its line. A word that is not of an order is a mistake and is said; `preset=` alone is the order of the preset. */
export function orderOf(text: string): Order {
  const wrong = (what: string): never => {
    throw new Error(`order: ${what}`);
  };
  const said = new Map<string, string>();
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const at = word.indexOf('=');
    if (at < 1) wrong(`cannot read "${word}": an order is words as size=4 dice=5 faces=2 par=3-6`);
    said.set(word.slice(0, at), word.slice(at + 1));
  }
  const whole = (value: string, key: string): number => (/^\d+$/.test(value) ? Number(value) : wrong(`"${key}=${value}" is not a number`));
  const range = (value: string, key: string): [number, number] => {
    const [from, to = from] = value.split('-');
    const pair: [number, number] = [whole(from, key), whole(to, key)];
    return pair[0] <= pair[1] ? pair : wrong(`"${key}=${value}" goes down`);
  };
  const techniques = (value: string, key: string): Technique[] =>
    value.split(',').map((name) => (TECHNIQUES.includes(name as Technique) ? (name as Technique) : wrong(`"${key}=${value}": a technique is one of ${TECHNIQUES.join(', ')}`)));
  // `preset=` begins from the preset and the words after it change it: that is how an order is asked for. `as=` only names
  // the preset an order was begun from: that is how an order is kept, whole, so that a bound taken off stays off.
  const preset = said.get('preset');
  const named = said.get('as');
  if (named !== undefined && !Object.hasOwn(PRESETS, named)) wrong(`no preset "${named}": the presets are ${Object.keys(PRESETS).join(', ')}`);
  let order: Order = preset !== undefined ? applyPreset(BASE_ORDER, preset) : { ...BASE_ORDER, ...(named !== undefined ? { preset: named } : {}) };
  for (const [key, value] of said) {
    if (key === 'preset' || key === 'as') continue;
    else if (key === 'size') order = { ...order, size: whole(value, key) };
    else if (key === 'holes') order = { ...order, holes: value.split(',').map((cell) => cell.split('.').map((part) => whole(part, key)) as [number, number]) };
    else if (key === 'dice') order = { ...order, dice: whole(value, key) };
    else if (key === 'more') order = { ...order, more: whole(value, key) };
    else if (key === 'faces') order = { ...order, faces: value.split(',').map((face) => (/^[1-6]$/.test(face) ? Number(face) : wrong(`"faces=${value}" is not faces of a die`))) };
    else if (key === 'floor') order = { ...order, floorShut: value === 'shut' ? true : value === 'open' ? false : wrong(`"floor=${value}" is neither open nor shut`) };
    else if (key === 'par') order = { ...order, par: range(value, key) };
    else if (key === 'needs') order = { ...order, needs: techniques(value, key) };
    else if (key === 'avoid') order = { ...order, avoid: techniques(value, key) };
    else if (key === 'quiet') order = { ...order, quiet: range(value, key) };
    else if (key === 'events') order = { ...order, events: range(value, key) };
    else if (key === 'tail') order = { ...order, tail: range(value, key) };
    else if (key === 'ends') {
      const [event, spare] = value.split('.');
      if (event !== 'combo' && event !== 'link' && event !== 'ones') wrong(`"ends=${value}": a way ends on combo, link or ones`);
      order = { ...order, endsOn: { event: event as 'combo' | 'link' | 'ones', ...(spare === undefined ? {} : { spare: whole(spare, key) }) } };
    } else if (key === 'firsts') order = { ...order, firsts: range(value, key) };
    else if (key === 'trap') order = { ...order, trap: value === 'any' || value === 'none' ? value : wrong(`"trap=${value}" is neither any nor none`) };
    else if (key === 'trapdepth') order = { ...order, trapDepth: range(value, key) };
    else if (key === 'hidden') order = { ...order, hidden: value === 'yes' ? 'hidden' : value === 'no' ? 'shown' : wrong(`"hidden=${value}" is neither yes nor no`) };
    else if (key === 'far') order = { ...order, far: whole(value, key) };
    else if (key === 'last') order = { ...order, last: range(value, key) };
    else wrong(`cannot read "${key}=": the words of an order are preset, as, size, holes, dice, more, faces, floor, par, needs, avoid, quiet, events, tail, ends, firsts, trap, trapdepth, hidden, far, last`);
  }
  if (order.floorShut === false) {
    const { floorShut: _open, ...rest } = order;
    order = rest;
  }
  return order;
}
