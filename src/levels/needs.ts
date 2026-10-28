import { scoreOf } from '../rules/levelScore';
import { moveOf, type SolverMove } from '../rules/levelSolver';
import type { LevelSpec } from '../rules/types';
import { loopOf, startsUnder, turnsOf } from './measures';
import type { Technique } from './row';

/**
 * The moves a board asks for, read off the score of the way it keeps (`scoreOf`): a link (`L`, `Q`),
 * a walk over a leaving die (`~`), a way down or up (`v`, `!`, `^`), a roll onto a leaving die
 * (`glass`), a push (`P`, `Q`, `U`), the 1s (`O`, `U`); two faces where combos of two faces go;
 * the seven where the way starts on a die with a working face under and turns it up; the loop where
 * one die goes aside, across and back (`loopOf`). The order is no part of it: a trap is found by a
 * search, and the slow part of the grammar is given it (`SlowFacts.order`). A way can be given for a
 * board that keeps none, as the signature of a board gives the solver's.
 */
export function needsOf(spec: LevelSpec, way: readonly SolverMove[] = (spec.solution ?? []).map(moveOf)): ReadonlySet<Technique> {
  const needs = new Set<Technique>();
  const { beats, route } = scoreOf(spec, way);
  const signs = route.split(' ');
  if (signs.some((sign) => sign === 'L' || sign === 'Q')) needs.add('link');
  if (signs.includes('~')) needs.add('walk');
  if (signs.some((sign) => sign === 'v' || sign === '!' || sign === '^')) needs.add('lift');
  if (beats.some((beat) => beat.how === 'glass')) needs.add('glass');
  if (signs.some((sign) => sign === 'P' || sign === 'Q' || sign === 'U')) needs.add('push');
  if (signs.some((sign) => sign === 'O' || sign === 'U')) needs.add('ones');
  if (new Set(beats.filter((beat) => beat.event === 'combo').map((beat) => beat.face)).size > 1) needs.add('twoFaces');
  if (startsUnder(spec, way) && turnsOf(spec, way) >= 1) needs.add('seven');
  if (loopOf(spec, way)) needs.add('loop');
  return needs;
}
