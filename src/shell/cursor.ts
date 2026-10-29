import type { ParamValues } from '../signal/scene';
import type { Icon } from './icons';
import { sayColors } from './theme';

/**
 * The pointer of the mouse, drawn on the grid of the picture: an arrow of the font's dots, each
 * dot as large as a dot of the picture, in the milky colour of the letters with the dark ring
 * prose has over a picture. Over what a press runs it takes the colour of a key word. It is the
 * browser's own cursor, with a picture of ours, so it moves with the mouse and not with the frames.
 */

/** The arrow: its point at the top left, its tail the font's diagonal. */
export const CURSOR_ARROW: Icon = ['#.....', '##....', '###...', '####..', '#####.', '###...', '#.##..', '..##..'];
/**
 * The largest cursor, in CSS pixels, that Chrome draws everywhere: a larger one it swaps for its
 * own when the cursor comes near an edge of the window, where the buttons of a level stand. The
 * dots of the arrow are made smaller until it fits.
 */
const CURSOR_MOST = 32;
/** The ring around the arrow, in dots, on every side. */
const RING = 1;

/** CSS pixels a dot of the cursor, for a picture of `zoom` CSS pixels a dot: as large as a dot of it, while the arrow fits. */
export function cursorDot(zoom: number, icon: Icon = CURSOR_ARROW): number {
  const side = Math.max(icon.length, icon[0].length) + RING * 2;
  return Math.max(1, Math.min(Math.round(zoom), Math.floor(CURSOR_MOST / side)));
}

/** The arrow and the dark ring around it, as rows: `#` the arrow, `o` the ring. */
export function cursorRows(icon: Icon = CURSOR_ARROW): string[] {
  const lit = (r: number, c: number): boolean => r >= 0 && c >= 0 && r < icon.length && c < icon[0].length && icon[r][c] === '#';
  const rows: string[] = [];
  for (let r = -RING; r < icon.length + RING; r++) {
    let row = '';
    for (let c = -RING; c < icon[0].length + RING; c++) {
      let near = false;
      for (let dr = -RING; dr <= RING && !near; dr++) for (let dc = -RING; dc <= RING && !near; dc++) near = lit(r + dr, c + dc);
      row += lit(r, c) ? '#' : near ? 'o' : '.';
    }
    rows.push(row);
  }
  return rows;
}

/** The CSS of a cursor of the arrow in `fill`, `dot` CSS pixels a dot, for a screen of `ratio` device pixels a CSS pixel. */
function cursorCss(fill: string, edge: string, dot: number, ratio: number): string {
  const rows = cursorRows();
  // Whole device pixels a dot, so every dot stays square on the screen.
  const device = Math.max(1, Math.round(dot * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = rows[0].length * device;
  canvas.height = rows.length * device;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'auto';
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (row[c] === '.') continue;
      ctx.fillStyle = row[c] === '#' ? fill : edge;
      ctx.fillRect(c * device, r * device, device, device);
    }
  });
  const url = `url("${canvas.toDataURL('image/png')}")`;
  const scale = device / dot;
  // The point of the arrow, in CSS pixels: inside the ring.
  const hot = RING * dot;
  const set = `image-set(${url} ${scale}x) ${hot} ${hot}, auto`;
  return scale !== 1 && CSS.supports('cursor', set) ? set : `${url} ${hot} ${hot}, auto`;
}

let made = '';
let rest = '';
let press = '';
const over = new Set<string>();

function apply(): void {
  document.documentElement.style.cursor = over.size > 0 ? press : rest;
}

/**
 * Makes the cursor for a picture of `zoom` CSS pixels a dot, in the colours of `values`; again
 * only when one of them has changed. Whoever draws the interface calls it with each picture.
 */
export function fitCursor(zoom: number, values: ParamValues): void {
  const colours = sayColors(values);
  const dot = cursorDot(zoom);
  const ratio = window.devicePixelRatio || 1;
  const key = `${dot}|${ratio}|${colours.ink}|${colours.key}|${colours.edge}`;
  if (key === made) return;
  made = key;
  rest = cursorCss(colours.ink, colours.edge, dot, ratio);
  press = cursorCss(colours.key, colours.edge, dot, ratio);
  apply();
}

/** Says whether the mouse of `who` is over something a press runs: the cursor takes the colour of a key word while one of them says so. */
export function pointCursor(who: string, pointing: boolean): void {
  const had = over.size > 0;
  if (pointing) over.add(who);
  else over.delete(who);
  if (made !== '' && had !== over.size > 0) apply();
}
