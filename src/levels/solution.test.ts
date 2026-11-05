import { describe, expect, it } from 'vitest';
import { fileBoard } from './boardFiles';
import { layBack } from './layBack';
import { checkPlot, framedPlot, type Plot } from './plot';
import { coreOf, coreSim } from './signature';
import { freeFaces, plotCore, readSolution, routeOf, thoughtBound, thoughtFloor, type RowCore } from './solution';

const WALL = `
# a comment
kind rule
idea Кость, которую не сдвинуть, задаёт дорогу
frame 5x3
combo 3: a w! o<r4-5/around=w
par 4-5
fixedcost 2
`;

const DEEDS = `
frame 6x5
combo 2: a o<r1-3
link 2: l<r1-2/on=a
down
combo 5: b c d e p<p1-2/against=e
needs floor
par 7-10
`;

describe('readSolution', () => {
  it('reads the events in order into a plot that holds together', () => {
    const plot = readSolution(WALL, 'wall-loop');
    expect(checkPlot(framedPlot(plot))).toEqual([]);
    expect(plot.events).toEqual([{ kind: 'combo', by: 'o' }]);
    expect(plot.dice.map((die) => [die.name, die.face, die.fixed ?? false])).toEqual([
      ['a', 3, false],
      ['w', 3, true],
      ['o', 3, false],
    ]);
    expect(plot.dice[2].comes).toEqual({ by: 'roll', rolls: [4, 5], around: 'w' });
    expect(plot.want).toEqual({ par: [4, 5], fixedCost: 2 });
    expect(plot.kind).toBe('rule');
    expect(plot.frame).toEqual({ w: 5, h: 3 });
  });

  it('makes the route of the way where it goes down, and the die that makes an event the last that comes', () => {
    const plot = readSolution(DEEDS, 'three-deeds');
    expect(checkPlot(framedPlot(plot))).toEqual([]);
    expect(plot.route).toBe('K L v P');
    expect(plot.events.map((event) => event.by)).toEqual(['o', 'l', 'p']);
    expect(plot.dice.find((die) => die.name === 'l')?.on).toBe('a');
    expect(plot.dice.find((die) => die.name === 'p')?.comes).toEqual({ by: 'push', rolls: [1, 2], against: 'e' });
    expect(plot.needs).toEqual(['floor']);
  });

  it('says the line it cannot read', () => {
    expect(() => readSolution('combo 3: a b', 'x')).toThrow(/no die comes/);
    expect(() => readSolution('combo 3: a o<rx', 'x')).toThrow(/no die/);
    expect(() => readSolution('combo 3: a o<r2/sideways', 'x')).toThrow(/sideways/);
    expect(() => readSolution('size 4', 'x')).toThrow(/no event/);
  });

  it('holds a die pushed against another to a push, and a die gone round to one that stands', () => {
    const pulled = readSolution('combo 3: a b o<r2/against=a', 'x');
    expect(checkPlot(pulled).some((fault) => /does not come by a push/.test(fault))).toBe(true);
    const round = readSolution('combo 3: a b o<r2 \ncombo 2: c g<r3/around=o', 'x');
    expect(checkPlot(round).some((fault) => /does not stand/.test(fault))).toBe(true);
  });
});

describe('around and against in the laying', () => {
  it('lays a die that goes round only where the die it goes round stands between it and its cell', () => {
    const plot = framedPlot(readSolution(WALL, 'wall-loop'));
    const free = framedPlot({ ...plot, dice: plot.dice.map((die) => (die.comes ? { ...die, comes: { by: 'roll' as const, rolls: [4, 5] as const } } : die)) });
    const shaped = layBack(plot);
    const open = layBack(free);
    expect(shaped.total).toBe(open.total);
    let laid = 0;
    for (let i = 0; i < shaped.total; i++) {
      const one = shaped.at(i);
      if (!one) continue;
      laid++;
      const dice = one.spec.layout!.dice;
      const [o, w] = [dice[2], dice[1]];
      const home = shaped.cellsOf(one.placement)[2];
      const [hx, hz] = [home % plot.size, Math.floor(home / plot.size)];
      // The fixed die stands in one line with where o starts and where it is to go, between them.
      const inLine = (o.x === hx && w.x === hx && (w.z - o.z) * (w.z - hz) < 0) || (o.z === hz && w.z === hz && (w.x - o.x) * (w.x - hx) < 0);
      expect(inLine).toBe(true);
    }
    expect(laid).toBeGreaterThan(0);
    let openLaid = 0;
    for (let i = 0; i < open.total; i++) if (open.at(i)) openLaid++;
    expect(laid).toBeLessThan(openLaid);
  });
});

describe('the thought before the board', () => {
  const row: RowCore[] = ['H06', 'H07', 'which-first-2', 'tight-fours-threes-1'].map((code, at) => ({ code, number: at + 1, core: coreOf(fileBoard(code)) }));

  it('reads the core a board of the plot will have off its events', () => {
    const plot = readSolution(DEEDS, 'three-deeds');
    expect(routeOf(plot)).toBe('K L v P');
    const core = plotCore(plot);
    expect(core.faces).toEqual([2, 5]);
    expect(core.needs).toEqual(['glass', 'lift', 'link', 'push', 'twoFaces']);
    expect(core.alone).toBeUndefined();
    expect(plotCore(readSolution(WALL, 'wall')).alone).toEqual({ dice: 3, length: 'middle' });
  });

  it('finds the place of the row a plot is like whatever its layout', () => {
    const wall = readSolution(WALL, 'wall');
    const [first] = thoughtFloor(wall, row);
    expect(first.code).toBe('H07');
    expect(first.sim).toBe(coreSim(plotCore(wall), row[1].core));
    // The way round the wall is a sign of the route of its own (`w K`), and the thought is H07's at 0.75, not at 1.
    expect(plotCore(wall).route).toBe('w K');
    expect(first.sim).toBeCloseTo(0.75, 5);
    const bound = thoughtBound(wall, row)!;
    expect(bound.sim).toBeCloseTo(0.65, 5);
    expect(bound.sim).toBeLessThanOrEqual(first.sim);
    // With no wall the same combo of three 3s is H06 or H07 at 0.9 at the least, whatever its layout.
    const loop = readSolution(WALL.replace('/around=w', ''), 'loop');
    expect(plotCore(loop).route).toBe('K');
    expect(thoughtBound(loop, row)!.sim).toBeCloseTo(0.9, 5);
  });

  it('knows no least likeness of a plot of two events whose route it does not say', () => {
    const far = readSolution('size 5\ncombo 4: a b c o<r2-4\ncombo 3: e f g<r2-4', 'far');
    expect(thoughtBound(far, row)).toBeNull();
    expect(thoughtBound({ ...far, route: 'K K' }, row)!.code).toBe('tight-fours-threes-1');
  });

  it('names faces under the bound where the faces of the row are taken', () => {
    const far: Plot = readSolution('size 5\ncombo 4: a b c o<r2-4\ncombo 3: e f g<r2-4', 'far');
    expect(thoughtFloor(far, row)[0].code).toBe('tight-fours-threes-1');
    const free = freeFaces(far, row, 0.75);
    expect(free.length).toBeGreaterThan(0);
    for (const one of free) {
      expect(one.floor).toBeLessThan(0.75);
      expect(one.faces).toHaveLength(2);
      expect(new Set(one.faces).size).toBe(2);
    }
    expect(free.some((one) => one.faces.join() === '4,3')).toBe(false);
  });
});
