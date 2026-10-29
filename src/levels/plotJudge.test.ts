import { describe, expect, it } from 'vitest';
import { moveOf, moveText, solveLevel } from '../rules/levelSolver';
import type { LevelSpec } from '../rules/types';
import { fileBoard } from './boardFiles';
import { layBack, layKey, type Laid, type Space } from './layBack';
import { keepsOf } from './measures';
import { trapDepthOf } from './orders';
import { plotOfBoard, type Plot } from './plot';
import { judgeLaid } from './plotJudge';
import { PLOTS } from './plots';

/** A board laid from a plot, found in its space: the placements whose standing dice stand where the board's do, gone through. */
function laidAs(plot: Plot, space: Space, spec: LevelSpec): Laid {
  const want = layKey(spec);
  const dice = new Map(spec.layout!.dice.map((die) => [die.z * spec.size + die.x, die.top]));
  for (let placement = 0; placement < space.placements; placement++) {
    const cells = space.cellsOf(placement);
    if (plot.dice.some((die, i) => !die.comes && dice.get(cells[i]) !== die.face)) continue;
    const [from, to] = space.range(placement);
    for (let i = from; i < to; i++) {
      const laid = space.at(i);
      if (laid && layKey(laid.spec) === want) return laid;
    }
  }
  throw new Error(`${spec.id} is not laid from ${plot.name}`);
}

describe('judgeLaid', () => {
  it('passes a board laid from its own plot through the layout and the way', () => {
    for (const id of ['act-k23', 'act-k25', 'hidden-face-1']) {
      const spec = fileBoard(id);
      const plot = plotOfBoard(spec);
      const laid = laidAs(plot, layBack(plot), spec);
      const judged = judgeLaid(plot, laid, { upto: 'path', states: 100_000 });
      expect(judged, id).toMatchObject({ stage: 2, reason: null, par: spec.par });
    }
  });

  it('passes act-k23 by its plot through the lesson: after the combo one move keeps the board', () => {
    const spec = fileBoard('act-k23');
    const plot = PLOTS['act-k23'];
    const laid = laidAs(plot, layBack(plot), spec);
    const judged = judgeLaid(plot, laid);
    expect(judged).toMatchObject({ stage: 3, reason: null });
    expect(keepsOf(laid.spec, judged.way!.map(moveOf), 0).keeps).toBe(1);
  });

  it('passes act-k25 by its plot through the way, and finds its bait gone', () => {
    // The combo of 3s the second move asked for lost the board while only the 3s worked; since every
    // face works (0.2.66) the 2s go too, and that combo is a way of par as good as the one of the file.
    const spec = fileBoard('act-k25');
    const plot = PLOTS['act-k25'];
    const laid = laidAs(plot, layBack(plot), spec);
    const judged = judgeLaid(plot, laid);
    expect(judged).toMatchObject({ stage: 2, reason: 'bait', par: spec.par });
    expect(judged.lessons!.find((lesson) => lesson.kind === 'bait')).toMatchObject({ ok: false, bait: false });
  });

  it('passes a board with a trap on its first move through the lesson of a bait (trap-5)', () => {
    const spec = fileBoard('trap-5');
    // The plot is read off the solver's way, the one the judge asks.
    const way = solveLevel(spec).solution!.moves.map(moveText);
    const plot: Plot = { ...plotOfBoard(spec, way), lessons: [{ kind: 'bait', at: 0, move: 'event', fate: 'dead', depth: [0, 0] }] };
    const laid = laidAs(plot, layBack(plot), spec);
    const judged = judgeLaid(plot, laid);
    expect(judged).toMatchObject({ stage: 3, reason: null });
    expect(judged.lessons![0]).toMatchObject({ ok: true, bait: true, depth: 0 });
    // The bait is the trap `trapDepthOf` finds, as deep.
    expect(trapDepthOf(spec, way)).toBe(0);
  });

  it('drops a board laid twice, and a board with a group ready', () => {
    const plot = PLOTS['act-k23'];
    const space = layBack(plot);
    const seen = new Set<string>();
    let laid: Laid | null = null;
    for (let i = 0; !laid; i++) laid = space.at(i);
    const first = judgeLaid(plot, laid, { seen, upto: 'laid' });
    if (first.reason === null) expect(judgeLaid(plot, laid, { seen, upto: 'laid' }).reason).toBe('repeat');
    // Two dice side by side, both 2 up: a pair of 2s is ready before a move.
    const dice = [
      { x: 2, z: 0, top: 2, north: 1 },
      { x: 3, z: 0, top: 2, north: 1 },
      { x: 2, z: 2, top: 4, north: 1 },
      { x: 3, z: 3, top: 4, north: 1 },
    ];
    const ready: Laid = { ...laid, spec: { ...laid.spec, layout: { start: { x: 3, z: 3 }, dice } } };
    expect(judgeLaid(plot, ready).reason).toBe('ready');
  });

  it('sifts the space of act-k23 laid from its own plot', () => {
    const plot = plotOfBoard(fileBoard('act-k23'));
    const space = layBack(plot);
    const seen = new Set<string>();
    const reasons = new Map<string, number>();
    const stages = [0, 0, 0];
    let t0 = performance.now();
    const passed: Laid[] = [];
    for (let i = 0; i < space.total; i++) {
      const laid = space.at(i);
      if (!laid) {
        reasons.set('cells', (reasons.get('cells') ?? 0) + 1);
        continue;
      }
      const judged = judgeLaid(plot, laid, { seen, upto: 'laid' });
      if (judged.reason) reasons.set(judged.reason, (reasons.get(judged.reason) ?? 0) + 1);
      else passed.push(laid);
    }
    const laidTime = performance.now() - t0;
    stages[0] = passed.length;
    t0 = performance.now();
    for (const laid of passed) {
      const judged = judgeLaid(plot, laid, { upto: 'path' });
      if (judged.reason) reasons.set(judged.reason, (reasons.get(judged.reason) ?? 0) + 1);
      else stages[1]++;
    }
    const pathTime = performance.now() - t0;
    console.log(
      `act-k23-deep: ${space.total} boards; stage 0 ${stages[0]} (${Math.round(space.total / (laidTime / 1000))}/s), stage 1 ${stages[1]} (${Math.round(passed.length / (pathTime / 1000))}/s); ${[...reasons].map(([key, n]) => `${key} ${n}`).join(', ')}`,
    );
    expect(stages[1]).toBeGreaterThan(0);
  });
});
