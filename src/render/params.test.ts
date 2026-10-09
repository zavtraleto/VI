import { describe, expect, it } from 'vitest';
import { shellDefaults } from '../shell/theme';
import { BOARD_GROUPS, BOARD_PARAMS, boardChanged, boardDefaults, boardPalette, parseBoardValue, readView } from './params';

describe('board params', () => {
  it('names every parameter once across the folders', () => {
    const names = Object.values(BOARD_GROUPS).flatMap((group) => Object.keys(group));
    expect(new Set(names).size).toBe(names.length);
    expect(Object.keys(BOARD_PARAMS).sort()).toEqual([...names].sort());
  });

  it('starts every number inside its range', () => {
    for (const [name, spec] of Object.entries(BOARD_PARAMS)) {
      if (spec.kind !== 'number') continue;
      expect(spec.value, name).toBeGreaterThanOrEqual(spec.min);
      expect(spec.value, name).toBeLessThanOrEqual(spec.max);
    }
  });

  it('tells a face that does not work by a cross half the face wide, and does not dim it', () => {
    const values = boardDefaults();
    expect(values.crossSize).toBe(0.5);
    expect(values.crossAlpha).toBe(0.8);
    for (const name of ['crossSize', 'crossWidth', 'crossAlpha', 'crossRim']) expect(Object.keys(BOARD_GROUPS.die)).toContain(name);
    // Neither the rings of the pips nor the dimming is a number of the look any more.
    expect(Object.keys(BOARD_PARAMS).filter((name) => /pipRing|faceOff/i.test(name))).toEqual([]);
  });

  it('writes down only what differs from the defaults', () => {
    const values = boardDefaults();
    expect(boardChanged(values)).toEqual({});
    values.dockTop = 0.3;
    // A colour picker gives the same colour back in the other case.
    values.pipDark = String(BOARD_PARAMS.pipDark.value).toUpperCase();
    expect(boardChanged(values)).toEqual({ dockTop: 0.3 });
  });

  it('reads a value from text as the kind of its parameter', () => {
    expect(parseBoardValue('gridBright', '0.8')).toBe(0.8);
    expect(parseBoardValue('gridBright', 'bright')).toBeUndefined();
    expect(parseBoardValue('mannequin', '#445566')).toBe('#445566');
    expect(parseBoardValue('nothing', '1')).toBeUndefined();
  });

  it('takes the view from an address, and nothing else of the look', () => {
    expect(readView('')).toEqual({});
    expect(readView('?lab=board&perf&msaa=2')).toEqual({});
    expect(readView('?view=follow&focus=0.5&lens=1&followMs=400&edge=0.2&minCell=70&sharp=0.5')).toEqual({
      view: 'follow',
      focus: 0.5,
      lens: 1,
      followMs: 400,
      edge: 0.2,
      minCell: 70,
      sharp: 0.5,
    });
    // The rest of the look is not set from the address of the game.
    expect(readView('?view=full&gridBright=1')).toEqual({ view: 'full' });
  });

  it('takes the passage between boards from an address too', () => {
    expect(readView('?drawMs=1600&eraseMs=900&headGlow=1.5&afterglowMs=0')).toEqual({ drawMs: 1600, eraseMs: 900, headGlow: 1.5, afterglowMs: 0 });
    // What makes no sense is left as it is defined.
    expect(readView('?drawMs=5&headGlow=bright&sinkMs=99999')).toEqual({});
  });

  it('names every number of the passage between boards as the plan has it', () => {
    const defaults = boardDefaults();
    const road = Object.fromEntries(Object.keys(BOARD_GROUPS.road).map((name) => [name, defaults[name]]));
    expect(road).toEqual({
      comboStepMs: 140,
      comboHoldMs: 350,
      sinkMs: 1300,
      eraseMs: 700,
      cameraMs: 900,
      drawMs: 1100,
      headGlow: 1.6,
      headSize: 2,
      headHalo: 0.45,
      headCore: 0.9,
      afterglowMs: 250,
      riseMs: 600,
      riseStepMs: 90,
      fixedFade: 0.45,
      fixedLight: 0.3,
      fixedEdge: 0.5,
      signStar: 4,
      signTrail: 0.6,
      signRunMs: 800,
      signRestMs: 350,
      signGlow: 1,
      signLength: 1.2,
    });
  });

  it('keeps the view as it is defined where the address makes no sense', () => {
    expect(readView('?view=sideways&focus=abc&lens=-1&followMs=&edge=99&sharp=9')).toEqual({});
    const defaults = boardDefaults();
    expect(defaults.view).toBe('auto');
    expect({ ...defaults, ...readView('?focus=7') }).toEqual(defaults);
  });

  it('has no colours of the channels of its own: they are the program\'s', () => {
    const shell = shellDefaults();
    shell.ch3 = '#123456';
    shell.signal = '#ff0000';
    const palette = boardPalette({ board: boardDefaults(), shell });
    expect(palette.channels[2]).toBe('#123456');
    expect(palette.signal).toBe('#ff0000');
    expect(Object.keys(BOARD_PARAMS).some((name) => /^ch\d$/.test(name) || name === 'signal')).toBe(false);
  });
});
