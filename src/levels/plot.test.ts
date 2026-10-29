import { describe, expect, it } from 'vitest';
import { fileBoard } from './boardFiles';
import { checkPlot, plotLength, plotOfBoard, plotWord, varyPlot, type Plot } from './plot';
import { PLOTS } from './plots';

const BOARDS = ['act-k23', 'act-k25', 'hidden-face-1'];

describe('plotOfBoard', () => {
  for (const id of BOARDS) {
    it(`reads ${id} into a plot that holds together`, () => {
      const spec = fileBoard(id);
      const plot = plotOfBoard(spec);
      expect(checkPlot(plot)).toEqual([]);
      // The moves of the plot are the moves of the way: every one is made by a die before it goes.
      expect(plotLength(plot)).toEqual([spec.par, spec.par]);
      // Every die is in the plot, with the face it leaves with; the faces of the board are kept.
      expect(plot.dice.length).toBe(spec.layout!.dice.length);
      expect(plot.faces).toEqual(spec.faces);
      expect(new Set(plot.dice.map((die) => die.face))).toEqual(new Set(spec.faces));
      expect(plot.dice.find((die) => die.name === 'o')).toBeDefined();
      expect(plot.want?.instead).toEqual([id]);
    });
  }

  it('reads the events of act-k23: a combo, a link and a link on its last move, the far die in a line', () => {
    const plot = plotOfBoard(fileBoard('act-k23'));
    expect(plot.name).toBe('act-k23-deep');
    expect(plot.events.map((event) => event.kind)).toEqual(['combo', 'link', 'link']);
    expect(plot.events[0].by).toBe('o');
    expect(plot.events[2].spare).toBe(0);
    const far = plot.dice.find((die) => die.name === plot.events[2].by)!;
    expect(far.comes).toEqual({ seq: 'rr', line: 'straight', away: 0 });
    expect(plot.lessons).toEqual([{ kind: 'safeFirst' }]);
  });

  it('reads a die that rolls onto a leaving one as ending on it (act-k25)', () => {
    const plot = plotOfBoard(fileBoard('act-k25'));
    const over = plot.dice.find((die) => die.on !== undefined)!;
    expect(over.face).toBe(3);
    expect(plot.dice.find((die) => die.name === over.on)!.event).toBe(0);
    expect(plot.figure!.join('').includes(over.name)).toBe(false);
  });

  it('names a plot by a word of a batch', () => {
    expect(plotWord('hidden-face-1-deep')).toBe('hidden-face1-deep');
    expect(plotWord('P03_s30042')).toBe('p03-s30042');
    expect(plotWord('7up')).toBe('b7up');
  });
});

describe('checkPlot', () => {
  it('passes the plots of the list', () => {
    for (const [name, plot] of Object.entries(PLOTS)) expect(checkPlot(plot), name).toEqual([]);
  });

  it('finds the mistakes of a plot', () => {
    const plot: Plot = {
      name: 'Bad Name',
      size: 3,
      dice: [
        { name: 'a', face: 3, event: 0 },
        { name: 'o', face: 3, event: 0, comes: { seq: 'r' } },
        { name: 'f', face: 2, event: 1, fixed: true, comes: { seq: 'r' } },
      ],
      events: [
        { kind: 'combo', by: 'o' },
        { kind: 'link', by: 'a' },
      ],
      figure: ['ao'],
    };
    const wrong = checkPlot(plot);
    expect(wrong).toContain('name "Bad Name" is no word of a batch');
    expect(wrong).toContain('die f is fixed and comes');
    expect(wrong).toContain('event 0: a combo of 2 dice of 3s');
    expect(wrong).toContain('event 1: a leaves in event 0, not in its own');
    expect(wrong).toContain('figure: f is not in it');
  });
});

describe('varyPlot', () => {
  const plot = plotOfBoard(fileBoard('act-k23'));

  it('lets every die come in more moves', () => {
    const wider = varyPlot(plot, { rolls: 1 });
    expect(checkPlot(wider)).toEqual([]);
    expect(plotLength(wider)).toEqual([4, 7]);
    expect(wider.dice.find((die) => die.name === 'a')!.comes).toEqual({ line: 'straight', away: 0, by: 'roll', rolls: [2, 3] });
  });

  it('changes a face, and gives a combo dice that stand to its new face', () => {
    const threes = varyPlot(plot, { face: { 2: 3 } });
    expect(checkPlot(threes)).toEqual([]);
    expect(threes.faces).toEqual([3]);
    expect(threes.dice.filter((die) => die.event === 0).length).toBe(3);
    expect(threes.figure).toBeUndefined();
  });

  it('grows a link to the last combo', () => {
    const grown = varyPlot(plot, { grow: 'link' });
    expect(checkPlot(grown)).toEqual([]);
    expect(grown.events.map((event) => event.kind)).toEqual(['combo', 'link', 'link', 'link']);
    expect(grown.dice.length).toBe(plot.dice.length + 1);
    expect(plotLength(grown)).toEqual([5, 6]);
  });
});
