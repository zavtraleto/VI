import type { LevelSpec } from '../rules/types';
import { PROGRAM_FONT, paletteAt, shellDefaults } from '../shell/theme';

/**
 * A board as a picture, written as the text of an SVG: no canvas is asked, so a script can make
 * one and the page can show a row of them. A cell is a square, and a cell cut out is left dark.
 * A die has the face on top large in the middle and the face to the north small above it, in the
 * colour of the channel of its top face; a fixed die has a second frame inside the first; a die
 * that is leaving is half seen, with the moves it has left in its corner; the start is a ring,
 * about the die the player stands on or alone on the floor. The colours and the font are those
 * of the interface (`src/shell/theme.ts`), as they are at night.
 */
export function boardSvg(spec: LevelSpec, opts: { cell?: number } = {}): string {
  const { cell = 48 } = opts;
  const { size, layout } = spec;
  const palette = paletteAt(shellDefaults(), 0);
  const pad = Math.round(cell / 6);
  const side = size * cell + pad * 2;
  const holes = new Set((spec.holes ?? []).map(({ x, z }) => `${x},${z}`));
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" width="${side}" height="${side}" font-family='${PROGRAM_FONT}' text-anchor="middle">`,
    `<rect width="${side}" height="${side}" fill="${palette.bg}"/>`,
  ];
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      if (holes.has(`${x},${z}`)) continue;
      parts.push(`<rect class="cell" x="${pad + x * cell + 1}" y="${pad + z * cell + 1}" width="${cell - 2}" height="${cell - 2}" fill="none" stroke="${palette.faint}"/>`);
    }
  }
  const inset = Math.round(cell / 10);
  (layout?.dice ?? []).forEach((die, index) => {
    const left = pad + die.x * cell;
    const top = pad + die.z * cell;
    const colour = palette.channels[die.top - 1];
    const leaves = (layout!.leaving ?? []).find((leaving) => leaving.die === index);
    parts.push(`<g class="die"${leaves ? ' opacity="0.5"' : ''}>`);
    parts.push(`<rect x="${left + inset}" y="${top + inset}" width="${cell - inset * 2}" height="${cell - inset * 2}" fill="${palette.bg}" stroke="${colour}" stroke-width="2"/>`);
    if (die.fixed) parts.push(`<rect class="fixed" x="${left + inset * 2}" y="${top + inset * 2}" width="${cell - inset * 4}" height="${cell - inset * 4}" fill="none" stroke="${colour}"/>`);
    parts.push(`<text class="top" x="${left + cell / 2}" y="${top + cell * 0.72}" font-size="${Math.round(cell * 0.46)}" fill="${colour}">${die.top}</text>`);
    parts.push(`<text class="north" x="${left + cell / 2}" y="${top + cell * 0.34}" font-size="${Math.round(cell * 0.22)}" fill="${palette.dim}">${die.north}</text>`);
    if (leaves) parts.push(`<text class="leaving" x="${left + cell * 0.78}" y="${top + cell * 0.84}" font-size="${Math.round(cell * 0.22)}" fill="${palette.signal}">~${leaves.moves}</text>`);
    parts.push('</g>');
  });
  if (layout) {
    const { x, z } = layout.start;
    parts.push(`<circle class="start" cx="${pad + x * cell + cell / 2}" cy="${pad + z * cell + cell / 2}" r="${layout.onFloor ? cell * 0.2 : cell * 0.47}" fill="none" stroke="${palette.ink}" stroke-width="2"/>`);
  }
  parts.push('</svg>');
  return parts.join('\n');
}
