import type { Kit } from './kit';
import { CELL_H, markNodes, type MarkArrangement } from './layout';
import { LOGO_TEXT } from './text';

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

/** Width of the logo at a scale, in pixels of the picture. */
export function logoWidth(kit: Kit, scale: number): number {
  const mark = markOf(kit, scale);
  return mark.width + mark.gap + kit.measure(LOGO_TEXT, scale);
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
  kit.text(LOGO_TEXT, x + mark.width + mark.gap, y, color, { scale, bold: true });
}

/** Height of a row the logo takes at a scale. */
export function logoHeight(scale: number): number {
  return CELL_H * scale;
}
