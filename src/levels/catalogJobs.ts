import type { LevelSpec } from '../rules/types';
import { levelId } from './generate';
import { checkPlot, framedPlot, plotOfBoard, varyPlot, type Plot } from './plot';
import type { Recipe } from './recipes';
import { readSolution } from './solution';

/**
 * The works of the catalog of boards (docs/superpowers/specs/2026-11-05-vi-board-catalog-design.md, section 2): a plot
 * and one variation of it, or a recipe laid forwards. The list is the same for the same code and files, in the same
 * order: every plot of a step first, then every plot of the next, so that the first hours of a run give breadth.
 */

/**
 * The version of the catalog: in the key of every work and on every line of a board. Raised when the measures
 * (`MEASURES_VERSION`) or the rules of a move change: the lines of an older version are not read, and are laid again.
 */
export const CATALOG_VERSION = 1;

export type JobSource = 'solution' | 'plot' | 'row' | 'recipe';

export interface Job {
  /** `<source>:<base>:<vary>@<version>`: what the journal knows a work by. */
  id: string;
  source: JobSource;
  /** The name of the solution, the plot, the board of the row or the recipe. */
  base: string;
  /** The variation: `as`, `rolls1`, `link`, `f5x4`, `face2to3`, `shut`, `die`. */
  vary: string;
  /** The step of the variation, 0 to 4. */
  step: number;
  /** The plot to lay, varied and framed; none for a recipe. */
  plot?: Plot;
  recipe?: Recipe;
  /** Where the plot does not hold together after the variation: what `checkPlot` says. Such a work is not laid. */
  fault?: string;
  /** Lay strictly (`layBack`, `strict`): the default of a solution, as `lay solution=` has it. */
  strict: boolean;
}

export interface JobInput {
  solutions: readonly { name: string; text: string }[];
  plots: Readonly<Record<string, Plot>>;
  /** The places of the row, each with its board: the plot read off each is a base. */
  row: readonly { code: string; number: number; spec: LevelSpec }[];
  recipes: readonly Recipe[];
  /** How the plot of a board of the row is read: `plotOfBoard` unless said (a script may keep what it read, some take a minute). */
  rowPlot?: (spec: LevelSpec) => Plot;
  /** Only the works of this base: what one work needs, without reading every plot. */
  only?: { source: JobSource; base: string };
}

interface Base {
  source: Exclude<JobSource, 'recipe'>;
  base: string;
  plot?: Plot;
  fault?: string;
}

/** The faces of a plot that make groups: its own where said, those of its dice but the 1s where not. */
export function plotFaces(plot: Plot): number[] {
  return plot.faces ? [...plot.faces] : [...new Set(plot.dice.map((die) => die.face).filter((face) => face !== 1))].sort((a, b) => a - b);
}

/** The variations of a plot, step by step: a label and the plot it makes (still to be framed and checked). */
export function variationsOf(plot: Plot): { vary: string; step: number; plot: Plot }[] {
  const out: { vary: string; step: number; plot: Plot }[] = [{ vary: 'as', step: 0, plot }];
  const named = (vary: string, step: number, made: Plot) => out.push({ vary, step, plot: { ...made, name: `${plot.name}-${vary}` } });
  named('rolls1', 1, varyPlot(plot, { rolls: 1 }));
  named('link', 2, varyPlot(plot, { grow: 'link' }));
  const frame = plot.frame ?? { w: plot.size, h: plot.size };
  if (frame.h - 1 >= 3) named(`f${frame.w}x${frame.h - 1}`, 2, { ...plot, frame: { w: frame.w, h: frame.h - 1 } });
  if (frame.w - 1 >= 3) named(`f${frame.w - 1}x${frame.h}`, 2, { ...plot, frame: { w: frame.w - 1, h: frame.h } });
  const faces = plotFaces(plot);
  // The 1s are not changed: a plot of the 1s with no 1s does not hold together.
  for (const from of faces.filter((face) => face !== 1)) for (let to = 2; to <= 6; to++) if (!faces.includes(to)) named(`face${from}to${to}`, 3, varyPlot(plot, { face: { [from]: to } }));
  if (plot.floor !== false) named('shut', 4, { ...plot, floor: false });
  named('die', 4, varyPlot(plot, { grow: 'die' }));
  return out;
}

/** The bases of the plots: the solutions, the plots of the list, the plot read off every board of the row, 61–100 first. */
function basesOf(input: JobInput): Base[] {
  const bases: Base[] = [];
  const wanted = (source: JobSource, base: string) => !input.only || (input.only.source === source && input.only.base === base);
  for (const { name, text } of input.solutions) {
    if (!wanted('solution', name)) continue;
    try {
      bases.push({ source: 'solution', base: name, plot: readSolution(text, name) });
    } catch (error) {
      bases.push({ source: 'solution', base: name, fault: (error as Error).message });
    }
  }
  for (const [name, plot] of Object.entries(input.plots)) if (wanted('plot', name)) bases.push({ source: 'plot', base: name, plot });
  // The second half first: 61–100 are the places being laid now.
  const row = [...input.row].sort((a, b) => Number(a.number < 61) - Number(b.number < 61) || a.number - b.number);
  const read = input.rowPlot ?? ((spec: LevelSpec) => plotOfBoard(spec));
  for (const place of row) {
    if (!wanted('row', place.code)) continue;
    try {
      bases.push({ source: 'row', base: place.code, plot: read(place.spec) });
    } catch (error) {
      bases.push({ source: 'row', base: place.code, fault: (error as Error).message });
    }
  }
  return bases;
}

const jobId = (source: JobSource, base: string, vary: string) => `${source}:${base}:${vary}@${CATALOG_VERSION}`;

/** Every work of the catalog, in the order a run takes them. */
export function catalogJobs(input: JobInput): Job[] {
  const steps: Job[][] = [[], [], [], [], []];
  const seenBases = new Set<string>();
  for (const base of basesOf(input)) {
    if (seenBases.has(`${base.source}:${base.base}`)) continue;
    seenBases.add(`${base.source}:${base.base}`);
    const strict = base.source === 'solution';
    if (!base.plot) {
      steps[0].push({ id: jobId(base.source, base.base, 'as'), source: base.source, base: base.base, vary: 'as', step: 0, fault: base.fault ?? 'no plot', strict });
      continue;
    }
    for (const { vary, step, plot } of variationsOf(base.plot)) {
      let fault: string | undefined;
      let framed: Plot | undefined;
      try {
        framed = framedPlot(plot);
        const faults = checkPlot(framed);
        if (faults.length > 0) fault = faults.join('; ');
      } catch (error) {
        fault = (error as Error).message;
      }
      steps[step].push({ id: jobId(base.source, base.base, vary), source: base.source, base: base.base, vary, step, ...(fault ? { fault } : { plot: framed }), strict });
    }
  }
  // The recipes laid forwards: once each, after the plots as they are.
  const seenRecipes = new Set<string>();
  for (const recipe of input.recipes) {
    const id = levelId(recipe);
    if (seenRecipes.has(id) || (input.only && (input.only.source !== 'recipe' || input.only.base !== id))) continue;
    seenRecipes.add(id);
    steps[0].push({ id: jobId('recipe', id, 'as'), source: 'recipe', base: id, vary: 'as', step: 0, recipe, strict: false });
  }
  return steps.flat();
}
