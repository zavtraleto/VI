import { CORE_WEIGHTS, coreSim, lengthOf, type Core } from './signature';
import { PLOT_KINDS, plotLength, type Coming, type Plot, type PlotDie, type PlotEvent, type PlotKind, type Side } from './plot';
import type { Technique } from '../rules/types';

/**
 * A board from its solution (docs/superpowers/specs/2026-11-05-vi-solution-first-design.md; the owner, 5 November 2026:
 * «сначала собирается интересное решение, а потом доска считается с конца до начальной раскладки»). The author writes
 * the solution as its events in order, a line to an event, with the faces and the field as bounds; it is read into a
 * plot (`plot.ts`), laid backwards (`layBack.ts`) and judged forwards on the real rules (`plotJudge.ts`) as any plot.
 * What is new here is the language, and the thought held against the row before a board is laid: the core of a board
 * is its route and its faces nine parts in ten (`CORE_WEIGHTS`), and both are said by the solution, not by the layout.
 *
 * The language, a line each, `#` to the end of a line a comment:
 *
 *   name wall-loop              the word of the batch
 *   frame 5x3 | size 4          the field; holes 1,0 2,3 cut cells out; floor off shuts the floor
 *   combo 3: a b w! o<rrrr/turn/around=w      an event: its kind and face, then its dice
 *   link 3: l<r1-2/on=a          a die: name; `!` fixed; `<` it comes, by a sequence of r (roll) and p (push), or r2-4 / p1-2;
 *   ones: g<p h                  after `/`: straight, turn, away=1, starts=south+east, on=x, around=x, against=x
 *   down | up                    the way goes to the floor or up from it here (into the route, which is then said whole)
 *   route K v P ^ L              the route of the shortest way exactly, over the one read off the events
 *   figure ab.|..o  pinned       the figure of the end, rows from the north, `|` between them
 *   start o  par 4-5  d 4.5-5.5  forks 3  ways 2  rank 5  hidden 1-9  fixedcost 2  novel off  needs floor  avoid link
 *   kind trick  idea …  lemma …  brief …
 *
 * The die of an event whose last move makes it is the last die of its line that comes.
 */

const SIDES: readonly Side[] = ['top', 'south', 'east', 'north', 'west', 'under'];
const TECHNIQUES: readonly Technique[] = ['link', 'glass', 'floor', 'ones'];

/** Reads a solution into a plot; throws with the line it could not read. */
export function readSolution(text: string, name = 'solution'): Plot {
  let plot: { -readonly [K in keyof Plot]: Plot[K] } = { name, size: 4, dice: [], events: [] };
  const dice: PlotDie[] = [];
  const events: PlotEvent[] = [];
  const want: NonNullable<Plot['want']> & Record<string, unknown> = {};
  const marks: string[] = [];
  let routeSaid: string | undefined;
  const span = (word: string, line: string): [number, number] => {
    const m = /^(\d+(?:\.5)?)(?:-(\d+(?:\.5)?))?$/.exec(word);
    if (!m) throw new Error(`solution: "${word}" is no number or span, in: ${line}`);
    return [Number(m[1]), Number(m[2] ?? m[1])];
  };
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const [word, ...rest] = line.split(/\s+/);
    const tail = line.slice(word.length).trim();
    const event = /^(combo|link|ones)(?:\s+(\d))?\s*:\s*(.+)$/.exec(line);
    if (event) {
      const kind = event[1] as PlotEvent['kind'];
      const face = kind === 'ones' ? 1 : Number(event[2] ?? NaN);
      if (!Number.isInteger(face)) throw new Error(`solution: the ${kind} names no face, in: ${line}`);
      const at = events.length;
      let by: string | undefined;
      for (const token of event[3].split(/\s+/)) {
        const die = dieOf(token, face, at, line);
        if (die.comes) by = die.name;
        dice.push(die);
      }
      if (!by) throw new Error(`solution: no die comes to make the ${kind}, in: ${line}`);
      events.push({ kind, by });
      marks.push(signOf(kind, dice.find((die) => die.name === by)!));
      continue;
    }
    switch (word) {
      case 'name':
        plot.name = tail;
        break;
      case 'size':
        plot.size = span(tail, line)[0];
        break;
      case 'frame': {
        const m = /^(\d)x(\d)$/.exec(tail);
        if (!m) throw new Error(`solution: "${tail}" is no frame, as in 5x3`);
        plot.frame = { w: Number(m[1]), h: Number(m[2]) };
        break;
      }
      case 'holes':
        plot.holes = rest.map((cell) => {
          const [x, z] = cell.split(',').map(Number);
          return { x, z };
        });
        break;
      case 'floor':
        if (tail !== 'off') throw new Error(`solution: floor is said only as "floor off", in: ${line}`);
        plot.floor = false;
        break;
      case 'down':
        marks.push('v');
        break;
      case 'up':
        marks.push('^');
        break;
      case 'route':
        routeSaid = tail;
        break;
      case 'figure':
        plot.figure = rest[0].split('|');
        if (rest[1] === 'pinned') plot.pinned = true;
        break;
      case 'pinned':
        plot.pinned = true;
        break;
      case 'start':
        plot.start = tail;
        break;
      case 'par':
      case 'd':
      case 'hidden':
        want[word] = span(tail, line);
        break;
      case 'forks':
      case 'ways':
      case 'rank':
        want[word] = span(tail, line)[0];
        break;
      case 'fixedcost':
        want.fixedCost = span(tail, line)[0];
        break;
      case 'novel':
        if (tail !== 'off') throw new Error(`solution: novelty is said only as "novel off", in: ${line}`);
        want.novel = false;
        break;
      case 'instead':
        want.instead = rest;
        break;
      case 'needs':
      case 'avoid': {
        const uses = rest.join(',').split(',').filter(Boolean) as Technique[];
        const wrong = uses.filter((use) => !TECHNIQUES.includes(use));
        if (wrong.length > 0) throw new Error(`solution: ${wrong.join(', ')}: no move a way leans on (${TECHNIQUES.join(', ')})`);
        plot[word] = uses;
        break;
      }
      case 'kind':
        if (!(tail in PLOT_KINDS)) throw new Error(`solution: kind "${tail}" is none of ${Object.keys(PLOT_KINDS).join(', ')}`);
        plot.kind = tail as PlotKind;
        break;
      case 'idea':
      case 'lemma':
      case 'brief':
        plot[word] = tail;
        break;
      case 'tools':
        plot.tools = tail.split(',').map((tool) => tool.trim());
        break;
      default:
        throw new Error(`solution: cannot read "${word}", in: ${line}`);
    }
  }
  if (events.length === 0) throw new Error('solution: no event');
  plot = { ...plot, dice, events };
  if (Object.keys(want).length > 0) plot.want = want;
  // The route: said whole, or read off the events where the way goes down or up between them, and left to the
  // judge where it does not (the events alone do not say whether a way walks over the leaving dice).
  const route = routeSaid ?? (marks.some((mark) => mark === 'v' || mark === '^') ? marks.join(' ') : undefined);
  if (route !== undefined) plot.route = route;
  return plot;
}

function dieOf(token: string, face: number, event: number, line: string): PlotDie {
  const m = /^([a-z0-9]{1,3})(!)?(?:<([rp]+|[rp]\d(?:-\d)?))?((?:\/[a-z]+(?:=[a-z0-9+]+)?)*)$/.exec(token);
  if (!m) throw new Error(`solution: "${token}" is no die, as in a, w! or o<rr/turn, in: ${line}`);
  const [, name, fixed, how, mods] = m;
  const die: PlotDie = { name, face, event, ...(fixed ? { fixed: true } : {}) };
  if (!how) {
    if (mods) throw new Error(`solution: ${name} does not come, and is said how, in: ${line}`);
    return die;
  }
  let comes: { -readonly [K in keyof Coming]: Coming[K] };
  const counted = /^([rp])(\d)(?:-(\d))?$/.exec(how);
  if (counted) comes = { by: counted[1] === 'p' ? 'push' : 'roll', rolls: [Number(counted[2]), Number(counted[3] ?? counted[2])] };
  else comes = { seq: how };
  let on: string | undefined;
  for (const mod of mods.split('/').filter(Boolean)) {
    const [key, value] = mod.split('=');
    if (key === 'straight' || key === 'turn') comes.line = key;
    else if (key === 'away') comes.away = Number(value);
    else if (key === 'starts') {
      const sides = value.split('+') as Side[];
      if (sides.some((side) => !SIDES.includes(side))) throw new Error(`solution: starts=${value}: the sides are ${SIDES.join(', ')}`);
      comes.starts = sides;
    } else if (key === 'around') comes.around = value;
    else if (key === 'against') comes.against = value;
    else if (key === 'on') on = value;
    else throw new Error(`solution: cannot read "/${mod}" of ${name}, in: ${line}`);
  }
  return { ...die, comes, ...(on !== undefined ? { on } : {}) };
}

/** The sign of an event in a route (`Score.route`): pushed home it is `P`, `Q`, `U`, rolled `K`, `L`, `O`. */
function signOf(kind: PlotEvent['kind'], by: PlotDie): string {
  const pushed = by.comes?.by === 'push' || (by.comes?.seq ?? '').endsWith('p');
  return kind === 'combo' ? (pushed ? 'P' : 'K') : kind === 'link' ? (pushed ? 'Q' : 'L') : pushed ? 'U' : 'O';
}

/** The route of a plot as the way will go: the one it says, or its events in order. */
export function routeOf(plot: Plot): string {
  if (plot.route !== undefined) return plot.route;
  return plot.events.map((event) => signOf(event.kind, plot.dice.find((die) => die.name === event.by)!)).join(' ');
}

/**
 * The core a board of the plot will have, as far as the plot says it (`Core` of `signature.ts`): its route, its faces,
 * the moves the route and the dice ask for, and of a plot of one event its dice and the length of its way. The kind of
 * the way weighs nothing, and the moves the layout adds (the seven, a loop) weigh a tenth at most.
 */
export function plotCore(plot: Plot): Core {
  const route = routeOf(plot);
  const signs = route.split(' ');
  const needs = new Set<string>();
  if (signs.some((sign) => sign === 'L' || sign === 'Q')) needs.add('link');
  if (signs.includes('~')) needs.add('walk');
  if (signs.some((sign) => sign === 'v' || sign === '!' || sign === '^') || (plot.needs ?? []).includes('floor')) needs.add('lift');
  if (signs.some((sign) => sign === 'P' || sign === 'Q' || sign === 'U')) needs.add('push');
  if (signs.some((sign) => sign === 'O' || sign === 'U')) needs.add('ones');
  if (plot.dice.some((die) => die.on !== undefined)) needs.add('glass');
  const comboFaces = new Set(plot.events.flatMap((event, at) => (event.kind === 'combo' ? [plot.dice.find((die) => die.event === at)!.face] : [])));
  if (comboFaces.size > 1) needs.add('twoFaces');
  if (plot.dice.some((die) => die.comes?.around !== undefined)) needs.add('loop');
  const faces = [...new Set(plot.dice.filter((die) => plot.events[die.event].kind !== 'ones').map((die) => die.face))].filter((face) => face !== 1).sort((a, b) => a - b);
  const core: Core = { kind: 'top', route, needs: [...needs].sort(), faces };
  const events = signs.filter((sign) => /^[KPLQOU]$/.test(sign)).length;
  if (events === 1) {
    const [lo, hi] = plot.want?.par ?? plotLength(plot);
    core.alone = { dice: plot.dice.length, length: lengthOf(Math.round((lo + hi) / 2)) };
  }
  return core;
}

/** A place of the row as the thought is held against it. */
export interface RowCore {
  code: string;
  number: number;
  core: Core;
}

/**
 * The places of the row a board of the plot will be like, most like first, by the core the plot says (`plotCore`):
 * the likeness of a board to a place is the more of its core's and its layout's (`similarityOf`), so this is what the
 * thought alone brings. The moves the layout adds (the seven, a loop, a roll onto a leaving die) and the length of a
 * way of one event within its `par` move it by a tenth or so; `thoughtBound` is what it cannot fall under.
 */
export function thoughtFloor(plot: Plot, row: readonly RowCore[], count = 3): { code: string; number: number; sim: number }[] {
  const core = plotCore(plot);
  const skip = new Set(plot.want?.instead ?? []);
  return row
    .filter((place) => !skip.has(place.code))
    .map((place) => ({ code: place.code, number: place.number, sim: coreSim(core, place.core) }))
    .sort((a, b) => b.sim - a.sim || a.number - b.number)
    .slice(0, count);
}

/**
 * How like the row every board of the plot is at the least, or null where the plot does not say its route: the events
 * alone do not say whether a way of two events walks over the leaving dice or goes down between them. Read with the
 * moves weighing nothing (they only add to it), for every length a way of one event may have within its `par`, the
 * likest place for each and the least of those. At `TOO_LIKE` or more no board of the plot can pass the gate of novelty.
 */
export function thoughtBound(plot: Plot, row: readonly RowCore[]): { code: string; sim: number } | null {
  const core = plotCore(plot);
  const events = plot.events.length;
  if (plot.route === undefined && events > 1) return null;
  const skip = new Set(plot.want?.instead ?? []);
  const places = row.filter((place) => !skip.has(place.code));
  const [lo, hi] = plot.want?.par ?? plotLength(plot);
  const lengths = core.alone ? [...new Set(Array.from({ length: hi - lo + 1 }, (_, i) => lengthOf(lo + i)))] : [undefined];
  let least: { code: string; sim: number } | null = null;
  for (const length of lengths) {
    const bare: Core = { ...core, needs: [], ...(core.alone && length ? { alone: { ...core.alone, length } } : {}) };
    let most: { code: string; sim: number } | null = null;
    // A move of the place's that the board lacks, or the other way round, takes the part of the moves to nothing.
    for (const place of places) {
      const sim = coreSim(bare, { ...place.core, needs: [NO_MOVE] });
      if (!most || sim > most.sim) most = { code: place.code, sim };
    }
    if (most && (!least || most.sim < least.sim)) least = most;
  }
  return least;
}

/** A move no board makes: held against it, the part of the moves in the likeness of two cores is nought. */
const NO_MOVE = 'no move';

/**
 * Other faces for the plot whose thought the row has not had: every way of giving its events other faces (the events
 * that share a face keep sharing one), kept where the floor is under `below`, fewest dice first. `faces` are those of
 * the events in their order, the 1s left out. A combo of `n`s takes `n` dice, so a face changed asks for dice added or
 * taken away, and the floor is read with the dice as they are: this says which faces, and the author lays the dice.
 */
export function freeFaces(plot: Plot, row: readonly RowCore[], below: number): { faces: number[]; floor: number; near: string }[] {
  const faceOf = (at: number) => plot.dice.find((die) => die.event === at)!.face;
  const working = plot.events.flatMap((event, at) => (event.kind === 'ones' ? [] : [faceOf(at)]));
  const groups = [...new Set(working)];
  const out: { faces: number[]; floor: number; near: string }[] = [];
  const choose = (chosen: number[]): void => {
    if (chosen.length === groups.length) {
      const swap = new Map(groups.map((face, at) => [face, chosen[at]]));
      const faced: Plot = { ...plot, dice: plot.dice.map((die) => (plot.events[die.event].kind === 'ones' ? die : { ...die, face: swap.get(die.face)! })) };
      const [first] = thoughtFloor(faced, row, 1);
      if (!first || first.sim < below) out.push({ faces: working.map((face) => swap.get(face)!), floor: first?.sim ?? 0, near: first?.code ?? '' });
      return;
    }
    for (let face = 2; face <= 6; face++) if (!chosen.includes(face)) choose([...chosen, face]);
  };
  choose([]);
  const dice = (faces: number[]) => [...new Set(faces)].reduce((sum, face) => sum + face, 0);
  return out.sort((a, b) => dice(a.faces) - dice(b.faces) || a.floor - b.floor);
}

/** The weights the floor stands on, for the report: what the route and the faces weigh of a core. */
export const THOUGHT_WEIGHT = CORE_WEIGHTS.route + CORE_WEIGHTS.faces;
