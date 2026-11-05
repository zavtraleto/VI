import { moveText, solveLevel } from '../rules/levelSolver';
import type { LevelSpec } from '../rules/types';
import { candidate, levelId } from './generate';
import { indexOrder, layBack } from './layBack';
import type { Plot, PlotKind, Want } from './plot';
import { PLOT_KINDS } from './plot';
import { boardKey, kindOrder, kinOf, missesOf, pickFinalists, shapeOf, sidesOf, type Passport, type RowBoard } from './plotFinal';
import { judgeLaid } from './plotJudge';
import { CATALOG_VERSION, plotFaces, type Job } from './catalogJobs';

/**
 * The catalog of boards (docs/superpowers/specs/2026-11-05-vi-board-catalog-design.md): a work laid without an agent,
 * its finalists measured by the passport, every board a line of `boards/catalog/<source>.jsonl`; and the query that
 * reads them back. How like the row a board is is read at the query against the row as it stands, never kept.
 */

/** Layouts a work lays and judges at most; strict, up to `OVERDRAW` times as many are tried to come to so many that hold. */
export const JOB_LIMIT = 20_000;
const OVERDRAW = 20;
/** Boards through the lesson a work stops at: the finalists are picked of these. */
export const JOB_PASSED = 40;
/** Finalists a work measures: one to a shape first. */
export const JOB_FINALISTS = 6;
/** Seeds a recipe is laid with, and the boards of it measured at most. */
export const RECIPE_SEEDS = 200;
const RECIPE_STATES = 20_000;

/** FNV-1a of 64 bits over the UTF-8 of a text, as sixteen hex digits (as `measureCache.ts` keys a board). */
function fnv64(text: string): string {
  const MASK = (1n << 64n) - 1n;
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= BigInt(byte);
    hash = (hash * 0x100000001b3n) & MASK;
  }
  return hash.toString(16).padStart(16, '0');
}

/** The key of a board in the catalog: the hash of `boardKey`, so that a board laid by two works is one board. */
export function catalogKey(spec: LevelSpec): string {
  return fnv64(boardKey(spec));
}

/** What a work came to before the passports: how many layouts were laid, went through the way and through the lesson. */
export interface Tally {
  laid: number;
  path: number;
  lesson: number;
  /** Why most of those that failed did, the four most common. */
  reasons: Record<string, number>;
}

export interface Finalist {
  spec: LevelSpec;
  longestDetour: number;
}

/**
 * The funnel of a work: its layouts laid back and judged up to the lesson (as the workers of `lay` do), the boards
 * through it kept up to `JOB_PASSED`, and the finalists picked one to a shape. `known` holds the keys of the boards the
 * catalog has already: those are not given again. `stop` is asked now and then with the tally so far: where it says so, the funnel ends.
 */
export function funnelOf(job: Job, opts: { known?: ReadonlySet<string>; limit?: number; passed?: number; finalists?: number; stop?: (tally: Tally) => boolean } = {}): { tally: Tally; finalists: Finalist[] } {
  const tally: Tally = { laid: 0, path: 0, lesson: 0, reasons: {} };
  const known = opts.known ?? new Set<string>();
  const want = opts.finalists ?? JOB_FINALISTS;
  if (job.recipe) return recipeFunnel(job, tally, known, want, opts.stop);
  const plot = job.plot;
  if (!plot) return { tally, finalists: [] };
  const limit = opts.limit ?? JOB_LIMIT;
  const space = layBack(plot, { seed: 1, strict: job.strict });
  const sampled = space.sampled || space.total > limit;
  const indices = sampled ? indexOrder(space.total, 1, job.strict ? Math.min(space.total, limit * OVERDRAW) : limit) : null;
  const count = indices ? indices.length : space.total;
  // The faces a board laid from a plot is written with, as `lay` writes them.
  const faces = plotFaces(plot);
  const seen = new Set<string>();
  const passed: { spec: LevelSpec; shape: string; order: number; longestDetour: number }[] = [];
  let held = 0;
  for (let at = 0; at < count; at++) {
    if (at % 16 === 0 && opts.stop?.(tally)) break;
    const which = indices ? indices[at] : at;
    const laid = space.at(which);
    tally.laid++;
    if (!laid) continue;
    if (job.strict && sampled && ++held > limit) break;
    const judged = judgeLaid(plot, laid, { states: 20_000, seen, upto: 'lesson' });
    if (judged.stage >= 2) tally.path++;
    if (judged.reason) {
      const key = `${judged.stage} ${judged.reason}`;
      tally.reasons[key] = (tally.reasons[key] ?? 0) + 1;
      continue;
    }
    tally.lesson++;
    const spec = { ...laid.spec, faces };
    if (known.has(catalogKey(spec))) continue;
    const keeps = (judged.lessons ?? []).find((lesson) => lesson.kind === 'keeps');
    passed.push({ spec, shape: shapeOf(spec, sidesOf(spec, plot.dice.map((die) => die.face))), order: ((which * 2654435761) >>> 0) ^ 1, longestDetour: keeps?.longestDetour ?? 0 });
    if (passed.length >= (opts.passed ?? JOB_PASSED)) break;
  }
  tally.reasons = topReasons(tally.reasons);
  return { tally, finalists: pickFinalists(passed, want).map(({ spec, longestDetour }) => ({ spec, longestDetour })) };
}

function topReasons(reasons: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 4));
}

/** A recipe laid forwards by its seeds: a board that is solved within the par of the recipe goes through. */
function recipeFunnel(job: Job, tally: Tally, known: ReadonlySet<string>, want: number, stop?: (tally: Tally) => boolean): { tally: Tally; finalists: Finalist[] } {
  const recipe = job.recipe!;
  const finalists: Finalist[] = [];
  const seen = new Set<string>();
  for (let seed = 1; seed <= RECIPE_SEEDS && finalists.length < want; seed++) {
    if (stop?.(tally)) break;
    const spec = candidate(recipe, seed);
    tally.laid++;
    if (!spec) continue;
    const key = catalogKey(spec);
    if (seen.has(key) || known.has(key)) continue;
    seen.add(key);
    const solved = solveLevel(spec, { maxMoves: recipe.par[1], maxStates: RECIPE_STATES }).solution;
    if (!solved || solved.par < recipe.par[0] || solved.par > recipe.par[1]) {
      tally.reasons[solved ? 'par' : 'unsolved'] = (tally.reasons[solved ? 'par' : 'unsolved'] ?? 0) + 1;
      continue;
    }
    tally.path++;
    tally.lesson++;
    finalists.push({ spec: { ...spec, id: levelId(recipe), par: solved.par, exact: true, solution: solved.moves.map(moveText) }, longestDetour: 0 });
  }
  tally.reasons = topReasons(tally.reasons);
  return { tally, finalists };
}

/** The field of a board as the query asks after it. */
export interface Field {
  faces: number[];
  size: number;
  /** The frame: the columns and rows that hold a cell that is not cut out. */
  w: number;
  h: number;
  /** Cells cut out inside the frame. */
  holes: number;
  fixed: number;
  floor: 'open' | 'shut';
  dice: number;
}

export function fieldOf(spec: LevelSpec): Field {
  const cut = new Set((spec.holes ?? []).map((cell) => `${cell.x},${cell.z}`));
  const cells: [number, number][] = [];
  for (let z = 0; z < spec.size; z++) for (let x = 0; x < spec.size; x++) if (!cut.has(`${x},${z}`)) cells.push([x, z]);
  const xs = cells.map(([x]) => x);
  const zs = cells.map(([, z]) => z);
  const w = Math.max(...xs) - Math.min(...xs) + 1;
  const h = Math.max(...zs) - Math.min(...zs) + 1;
  const dice = spec.layout?.dice ?? [];
  return {
    faces: [...(spec.faces ?? [])].sort((a, b) => a - b),
    size: spec.size,
    w,
    h,
    holes: w * h - cells.length,
    fixed: dice.filter((die) => die.fixed).length,
    floor: spec.floor === false ? 'shut' : 'open',
    dice: dice.length,
  };
}

/** The passport as the catalog keeps it: without its way (the board keeps it) and without what is read against the row. */
export type KeptPassport = Omit<Passport, 'way' | 'nearest' | 'sameCore' | 'sameLayout' | 'misses'>;

/** A board of the catalog: a line of `boards/catalog/<source>.jsonl`. */
export interface Entry {
  v: number;
  key: string;
  job: string;
  source: Job['source'];
  base: string;
  vary: string;
  kind?: PlotKind;
  idea?: string;
  lemma?: string;
  want?: Want;
  spec: LevelSpec;
  field: Field;
  p: KeptPassport;
}

/** The line of a board measured in a work. */
export function entryOf(job: Job, finalist: Finalist, passport: Passport): Entry {
  const { way, nearest: _n, sameCore: _c, sameLayout: _l, misses: _m, ...kept } = passport;
  const spec: LevelSpec = { ...finalist.spec, par: passport.par, exact: true, solution: way };
  const plot = job.plot;
  return {
    v: CATALOG_VERSION,
    key: catalogKey(finalist.spec),
    job: job.id,
    source: job.source,
    base: job.base,
    vary: job.vary,
    ...(plot?.kind ? { kind: plot.kind } : {}),
    ...(plot?.idea ? { idea: plot.idea } : {}),
    ...(plot?.lemma ? { lemma: plot.lemma } : {}),
    ...(plot?.want ? { want: plot.want } : {}),
    spec,
    field: fieldOf(spec),
    p: kept,
  };
}

/** A line of the catalog as it is written: the shares and the like rounded to three places, which is all they say. */
export function lineText(line: unknown): string {
  return JSON.stringify(line, (_, value) => (typeof value === 'number' && !Number.isInteger(value) ? Math.round(value * 1000) / 1000 : value));
}

/** A line of the journal of works. */
export interface JobLine {
  v: number;
  job: string;
  tally: Tally;
  finalists: number;
  written: number;
  seconds: number;
  /** The seconds of the funnel, and of every passport. */
  funnelSeconds?: number;
  passportSeconds?: number[];
  /** Why the work laid nothing: the plot does not hold, or it fell. */
  fault?: string;
}

/** Reads the lines of a JSONL text that hold a JSON object of this version; others are passed over. */
export function readLines<T extends { v: number }>(text: string): T[] {
  const out: T[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const one = JSON.parse(line) as T;
      if (one && one.v === CATALOG_VERSION) out.push(one);
    } catch {
      // A line cut by a run that was stopped: passed over.
    }
  }
  return out;
}

// ---------------------------------------------------------------- the query

type Band = readonly [number, number];

export interface Query {
  kind?: PlotKind;
  faces?: number[];
  facesHas?: number[];
  d?: Band;
  par?: Band;
  dice?: Band;
  forks?: number;
  ways?: number;
  frame?: { w: number; h: number };
  size?: number;
  fixed?: number;
  floor?: 'open' | 'shut';
  /** How like the row a board may be, below. */
  near?: number;
  troubles?: number;
  holds?: boolean;
  source?: string;
  base?: string;
  top?: number;
}

const bandOf = (text: string, what: string): Band => {
  const m = /^(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?$/.exec(text);
  if (!m) throw new Error(`"${what}=${text}" is no band, as in ${what}=5-7 or ${what}=6`);
  return [Number(m[1]), Number(m[2] ?? m[1])];
};
const facesOf = (text: string, what: string): number[] => {
  if (!/^[1-6](,[1-6])*$/.test(text)) throw new Error(`"${what}=${text}" is no faces, as in ${what}=2,4`);
  return [...new Set(text.split(',').map(Number))].sort((a, b) => a - b);
};

/** The words of the command line read into a query: `kind=polish`, `faces=2,4`, `faces~=2`, `D=6-7`, `near<0.75`, `holds`… */
export function parseQuery(args: readonly string[]): Query {
  const q: Query = {};
  for (const arg of args) {
    let m: RegExpExecArray | null;
    if (arg === 'holds') q.holds = true;
    else if ((m = /^near<(\d*\.?\d+)$/.exec(arg))) q.near = Number(m[1]);
    else if ((m = /^faces~=(.+)$/.exec(arg))) q.facesHas = facesOf(m[1], 'faces~');
    else if ((m = /^([A-Za-z]+)=(.+)$/.exec(arg))) {
      const [, key, value] = m;
      switch (key.toLowerCase()) {
        case 'kind':
          if (!(value in PLOT_KINDS)) throw new Error(`"kind=${value}" is none of ${Object.keys(PLOT_KINDS).join(', ')}`);
          q.kind = value as PlotKind;
          break;
        case 'faces':
          q.faces = facesOf(value, 'faces');
          break;
        case 'd':
          q.d = bandOf(value, 'D');
          break;
        case 'par':
          q.par = bandOf(value, 'par');
          break;
        case 'dice':
          q.dice = bandOf(value, 'dice');
          break;
        case 'forks':
          q.forks = bandOf(value, 'forks')[0];
          break;
        case 'ways':
          q.ways = bandOf(value, 'ways')[0];
          break;
        case 'frame': {
          const f = /^(\d)x(\d)$/.exec(value);
          if (!f) throw new Error(`"frame=${value}" is no frame, as in frame=5x4`);
          q.frame = { w: Number(f[1]), h: Number(f[2]) };
          break;
        }
        case 'size':
          q.size = bandOf(value, 'size')[0];
          break;
        case 'fixed':
          q.fixed = bandOf(value, 'fixed')[0];
          break;
        case 'floor':
          if (value !== 'open' && value !== 'shut') throw new Error(`"floor=${value}" is open or shut`);
          q.floor = value;
          break;
        case 'troubles':
          q.troubles = bandOf(value, 'troubles')[0];
          break;
        case 'source':
          q.source = value;
          break;
        case 'base':
          q.base = value;
          break;
        case 'top':
          q.top = bandOf(value, 'top')[0];
          break;
        default:
          throw new Error(`cannot read "${arg}": the keys are kind faces faces~ D par dice forks ways frame size fixed floor near< troubles holds source base top`);
      }
    } else throw new Error(`cannot read "${arg}"`);
  }
  return q;
}

const inBand = (value: number, band: Band | undefined) => !band || (value >= band[0] - 1e-9 && value <= band[1] + 1e-9);

/** A board found, with what is read of it against the row as it stands. */
export interface Found {
  entry: Entry;
  nearest: { code: string; number: number; sim: number } | null;
  sameCore: string | null;
  sameLayout: string | null;
  misses: string[];
}

/** The passport of an entry made whole again against the row: what `missesOf` and `kindOrder` read. */
function wholePassport(entry: Entry, kin: Pick<Found, 'nearest' | 'sameCore' | 'sameLayout'>): Passport {
  return { ...entry.p, way: [...(entry.spec.solution ?? [])], ...kin, misses: [] };
}

/** Whether an entry holds a query on what it keeps: everything but how like the row it is. */
export function fieldMatch(entry: Entry, q: Query): boolean {
  const { field: f, p } = entry;
  if (q.kind && entry.kind && entry.kind !== q.kind) return false;
  if (q.faces && f.faces.join(',') !== q.faces.join(',')) return false;
  if (q.facesHas && !q.facesHas.every((face) => f.faces.includes(face))) return false;
  if (!inBand(p.d, q.d) || !inBand(p.par, q.par) || !inBand(f.dice, q.dice)) return false;
  if (q.forks !== undefined && p.depth.forks < q.forks) return false;
  if (q.ways !== undefined && p.depth.waysLong < q.ways) return false;
  if (q.frame && (f.w !== q.frame.w || f.h !== q.frame.h)) return false;
  if (q.size !== undefined && f.size !== q.size) return false;
  if (q.fixed !== undefined && f.fixed < q.fixed) return false;
  if (q.floor && f.floor !== q.floor) return false;
  if (q.troubles !== undefined && (p.troubles?.length ?? 0) > q.troubles) return false;
  if (q.source && entry.source !== q.source) return false;
  if (q.base && entry.base !== q.base) return false;
  return true;
}

/**
 * The boards of the catalog a query asks for, best first: the fields first (cheap), then how like the row each is, read
 * now against the row given; then by fewer gates of its plot missed, fewer troubles, the passport of the kind asked
 * (`kindOrder`), D nearer the middle of the band asked.
 */
export function findBoards(entries: readonly Entry[], q: Query, row: readonly RowBoard[]): Found[] {
  const seen = new Set<string>();
  const found: Found[] = [];
  for (const entry of entries) {
    if (seen.has(entry.key) || !fieldMatch(entry, q)) continue;
    seen.add(entry.key);
    const kin = kinOf(entry.want ? ({ want: entry.want } as Plot) : null, entry.spec, row);
    if (q.near !== undefined && kin.nearest && kin.nearest.sim >= q.near) continue;
    const misses = missesOf(entry.want, wholePassport(entry, kin));
    if (q.holds && misses.length > 0) continue;
    found.push({ entry, nearest: kin.nearest, sameCore: kin.sameCore, sameLayout: kin.sameLayout, misses });
  }
  const middle = q.d ? (q.d[0] + q.d[1]) / 2 : null;
  const order = (one: Found) => kindOrder(wholePassport(one.entry, one), q.kind);
  found.sort(
    (a, b) =>
      a.misses.length - b.misses.length ||
      (a.entry.p.troubles?.length ?? 0) - (b.entry.p.troubles?.length ?? 0) ||
      order(a) - order(b) ||
      (middle === null ? 0 : Math.abs(a.entry.p.d - middle) - Math.abs(b.entry.p.d - middle)) ||
      (a.nearest?.sim ?? 0) - (b.nearest?.sim ?? 0) ||
      (a.entry.key < b.entry.key ? -1 : a.entry.key > b.entry.key ? 1 : 0),
  );
  return found.slice(0, q.top ?? 20);
}

/** The short key a board is taken by: the first ten signs of its key. */
export function shortKey(entry: Pick<Entry, 'key'>): string {
  return entry.key.slice(0, 10);
}

/** A board found, as a line of text. */
export function foundLine(one: Found): string {
  const { entry: e, nearest } = one;
  const f = e.field;
  const p = e.p;
  return [
    shortKey(e),
    `D ${p.d}`,
    `par ${p.par}`,
    `dice ${f.dice}`,
    `faces ${f.faces.join('') || '-'}`,
    `${f.w}x${f.h}${f.holes ? `-${f.holes}` : ''}`,
    f.fixed ? `fixed ${f.fixed}` : '',
    f.floor === 'shut' ? 'floor shut' : '',
    `forks ${p.depth.forks}`,
    `ways ${p.depth.ways}/${p.depth.waysLong}`,
    p.craft ? `narrow ${p.craft.narrow} last ${Math.round(p.craft.lastShare * 100)}%` : '',
    p.people ? `newcomer ${Math.round(p.people.newcomer.first * 100)}% owner ${Math.round(p.people.owner.first * 100)}%` : '',
    `route ${p.route}`,
    nearest ? `near ${nearest.code}(${nearest.number}) ${nearest.sim.toFixed(2)}` : 'near -',
    p.troubles?.length ? `беды: ${p.troubles.join(', ')}` : '',
    one.misses.length ? `misses: ${one.misses.join('; ')}` : '',
    `${e.kind ? `${e.kind} ` : ''}${e.source}:${e.base}:${e.vary}`,
  ]
    .filter(Boolean)
    .join('  ');
}

/** How many of a thing, by a key, as a short line: `a 3, b 2`. */
export function countBy<T>(items: readonly T[], keyOf: (item: T) => string): string {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(keyOf(item), (counts.get(keyOf(item)) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([key, n]) => `${key} ${n}`)
    .join(', ');
}
