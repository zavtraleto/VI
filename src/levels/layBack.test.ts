import { describe, expect, it } from 'vitest';
import type { LevelSpec } from '../rules/types';
import { fileBoard } from './boardFiles';
import { indexOrder, layBack, layKey, type Space } from './layBack';
import { moveOf } from '../rules/levelSolver';
import { checkPlot, plotOfBoard, readWay, varyPlot } from './plot';

/**
 * The index of a board in the space of its own plot: the placement whose cells are the cells the
 * board's dice leave from on its way (the plot counts the dice as the layout does), gone through whole.
 */
function findIn(space: Space, spec: LevelSpec): number | null {
  const want = layKey(spec);
  const cells = readWay(spec, spec.solution!.map(moveOf)).leftAt.map(({ x, z }) => z * spec.size + x).join(',');
  for (let placement = 0; placement < space.placements; placement++) {
    if (space.cellsOf(placement).join(',') !== cells) continue;
    const [from, to] = space.range(placement);
    for (let i = from; i < to; i++) if (space.at(i) && layKey(space.at(i)!.spec) === want) return i;
  }
  return null;
}

describe('layBack', () => {
  it('lays act-k23 from its own plot, the board itself among the layouts', () => {
    const spec = fileBoard('act-k23');
    const space = layBack(plotOfBoard(spec));
    expect(space.sampled).toBe(false);
    expect(space.total).toBeLessThan(200_000);
    const want = layKey(spec);
    let found = -1;
    let laid = 0;
    for (let i = 0; i < space.total; i++) {
      const one = space.at(i);
      if (!one) continue;
      laid++;
      if (layKey(one.spec) === want) found = i;
    }
    console.log(`act-k23: ${space.placements} placements, ${space.total} boards, ${laid} laid`);
    expect(found).toBeGreaterThanOrEqual(0);
    expect(space.at(found)!.length).toBe(spec.par);
  });

  it('lays act-k25 and hidden-face-1 from their own plots, the boards among the layouts', () => {
    for (const id of ['act-k25', 'hidden-face-1']) {
      const spec = fileBoard(id);
      const space = layBack(plotOfBoard(spec));
      console.log(`${id}: ${space.placements} placements, ${space.total} boards`);
      const found = findIn(space, spec);
      expect(found, id).not.toBeNull();
      expect(space.at(found!)!.length).toBe(spec.par);
    }
  });

  it('lays a board of the 1s brought by the player\'s own die, which stays and goes later, from its own plot', () => {
    const spec = fileBoard('ones-over-leaving-1');
    const plot = plotOfBoard(spec);
    expect(checkPlot(plot)).toEqual([]);
    const ones = plot.events.findIndex((event) => event.kind === 'ones');
    const by = plot.dice.find((die) => die.name === plot.events[ones].by)!;
    expect(by.event).toBeGreaterThan(ones);
    const found = findIn(layBack(plot), spec);
    expect(found).not.toBeNull();
  });

  it('lays the dice in the order of the plot, a die that stands on the cell of its event face up', () => {
    const plot = plotOfBoard(fileBoard('act-k23'));
    const space = layBack(plot);
    const laid = space.at(0) ?? space.at(1)!;
    expect(laid.spec.layout!.dice.length).toBe(plot.dice.length);
    laid.spec.layout!.dice.forEach((die, i) => {
      const cells = space.cellsOf(laid.placement);
      // A die with no moves stands on the cell of its event, its face up.
      if (!plot.dice[i].comes) {
        expect(die.z * plot.size + die.x).toBe(cells[i]);
        expect(die.top).toBe(plot.dice[i].face);
      }
    });
  });

  it('lays a plot with no figure, events one by one', () => {
    const plot = varyPlot(plotOfBoard(fileBoard('act-k23')), { grow: 'link' });
    expect(plot.figure).toBeUndefined();
    const space = layBack(plot, { cap: 2000 });
    expect(space.placements).toBeGreaterThan(0);
    expect(space.total).toBeGreaterThan(0);
  });

  it('picks indices of a space too big to go through, each once', () => {
    expect(indexOrder(5, 1, 10)).toEqual([0, 1, 2, 3, 4]);
    const picked = indexOrder(1_000_003, 7, 5000);
    expect(picked.length).toBe(5000);
    expect(new Set(picked).size).toBe(5000);
    expect(picked.every((i) => i >= 0 && i < 1_000_003)).toBe(true);
  });
});
