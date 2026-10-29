import type { Kit } from './kit';
import { CELL_H, markNodes, type MarkArrangement } from './layout';
import { LOGO_TEXT } from './text';

/**
 * The letters of the logo: the program's letters drawn in a finer hand (the owner, 29 October
 * 2026: «пиксель шрифтом… похож на тот шрифт, который используется в игре, может сделать его
 * чуть тоньше, чуть загадочнее»). The same ten rows from the fourth row of a line, the same cut
 * corners, but every stroke one dot, and the letters set far apart.
 */
const LOGO_GLYPHS: Readonly<Record<string, readonly string[]>> = {
  V: ['#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '.#...#.', '.#...#.', '.#...#.', '..#.#..', '...#...'],
  I: ['#', '#', '#', '#', '#', '#', '#', '#', '#', '#'],
  Z: ['#######', '......#', '......#', '.....#.', '....#..', '...#...', '..#....', '.#.....', '#......', '#######'],
  A: ['.#####.', '#.....#', '#.....#', '#.....#', '#.....#', '#######', '#.....#', '#.....#', '#.....#', '#.....#'],
};
/** The row of a line the letters start on: where the capitals of the font start. */
const LOGO_TOP = 3;

/** Width of the letters of the logo, in dots, with `track` dots between two letters. */
function lettersWidth(track: number): number {
  let width = 0;
  for (const sign of LOGO_TEXT) width += (LOGO_GLYPHS[sign]?.[0].length ?? 0) + track;
  return width - track;
}

/** The mark as it is set now, for letters `scale` times their own size. */
function markOf(kit: Kit, scale: number) {
  const shape = markNodes(kit.number('logoNodes'), String(kit.values.logoArrange) as MarkArrangement);
  // As tall as the capitals of the font: eleven dots out of the sixteen of a row.
  const height = 11 * scale;
  const radius = Math.max(1, Math.floor(height * 0.1));
  // An even span: the nodes of three rows then stand a whole number of dots apart.
  const span = Math.floor((height - 2 * radius) / 2) * 2;
  return { shape, radius, span, width: Math.round(shape.width * span) + 2 * radius, gap: 4 * scale };
}

function trackOf(kit: Kit): number {
  return Math.max(0, Math.round(kit.number('logoTrack')));
}

/** Width of the logo at a scale, in pixels of the picture. */
export function logoWidth(kit: Kit, scale: number): number {
  const mark = markOf(kit, scale);
  return mark.width + mark.gap + lettersWidth(trackOf(kit)) * scale;
}

/**
 * The logo: the mark of nodes, as tall as the letters, and the letters after it. `x` is its
 * left edge, `y` the top of the row of text it stands in.
 */
export function drawLogo(kit: Kit, x: number, y: number, scale: number, color: string): void {
  const mark = markOf(kit, scale);
  const top = y + 3 * scale;
  for (const point of mark.shape.points) {
    const cx = x + mark.radius + point.x * mark.span;
    const cy = top + mark.radius + point.y * mark.span;
    if (mark.radius <= 1) kit.rect(Math.round(cx) - 1, Math.round(cy) - 1, 2, 2, color);
    else kit.disc(cx, cy, mark.radius, color);
  }
  const track = trackOf(kit);
  let left = Math.round(x + mark.width + mark.gap);
  const first = Math.round(y) + LOGO_TOP * scale;
  for (const sign of LOGO_TEXT) {
    const rows = LOGO_GLYPHS[sign];
    if (!rows) continue;
    rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) if (row[c] === '#') kit.rect(left + c * scale, first + r * scale, scale, scale, color);
    });
    left += (rows[0].length + track) * scale;
  }
}

/** Height of a row the logo takes at a scale. */
export function logoHeight(scale: number): number {
  return CELL_H * scale;
}
