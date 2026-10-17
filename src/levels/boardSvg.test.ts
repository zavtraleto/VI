import { describe, expect, it } from 'vitest';
import { LESSON } from './boardSamples';
import { boardSvg } from './boardSvg';
import { fileBoard } from './boardFiles';

describe('boardSvg', () => {
  it('draws a board as the text of a picture: its cells, its dice, the frame of a fixed die and the start', () => {
    const svg = boardSvg(fileBoard('R01'));
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.match(/class="top"/g)).toHaveLength(2);
    // R01 has no fixed die since the third campaign (2026-10-17); R13 keeps one.
    expect(svg.match(/class="fixed"/g)).toBeNull();
    expect(svg.match(/class="cell"/g)).toHaveLength(6);
    expect(svg.match(/class="start"/g)).toHaveLength(1);
    expect(boardSvg(fileBoard('R13')).match(/class="fixed"/g)).toHaveLength(1);
  });
  it('shows a die that is leaving half seen, with its moves', () => {
    const svg = boardSvg(LESSON, { cell: 24 });
    expect(svg).toContain('opacity="0.5"');
    expect(svg).toContain('>~1<');
  });
});
