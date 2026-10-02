import { describe, expect, it } from 'vitest';
import { shellDefaults } from '../shell/theme';
import { BOARD_GROUPS, BOARD_PARAMS, boardChanged, boardDefaults, boardPalette, parseBoardValue } from './params';

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

  it('writes down only what differs from the defaults', () => {
    const values = boardDefaults();
    expect(boardChanged(values)).toEqual({});
    values.pillarHeight = 2;
    // A colour picker gives the same colour back in the other case.
    values.pipDark = String(BOARD_PARAMS.pipDark.value).toUpperCase();
    expect(boardChanged(values)).toEqual({ pillarHeight: 2 });
  });

  it('reads a value from text as the kind of its parameter', () => {
    expect(parseBoardValue('gridBright', '0.8')).toBe(0.8);
    expect(parseBoardValue('gridBright', 'bright')).toBeUndefined();
    expect(parseBoardValue('mannequin', '#445566')).toBe('#445566');
    expect(parseBoardValue('nothing', '1')).toBeUndefined();
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
