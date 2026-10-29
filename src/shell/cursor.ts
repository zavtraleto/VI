import type { Icon } from './icons';
import type { Palette } from './theme';

/**
 * The pointer of the mouse: an old program's cursor (the owner, 29 October 2026, after his
 * reference: «напоминать скорее старый программный курсор - простой формы, со светящимся
 * контуром», «референс был УГОЛОК», «уголок подходит к теме кубов и полю сетке»). A corner, as of
 * a cell of the board, with a diagonal from it, in the program's two colours: the dark of the tube
 * inside and its glowing tone around. Over what a press runs it turns inside out, as the chosen
 * command of a window does - the tone inside, the dark around - and the red mark of the seventh
 * lights in its corner, as beside that command: the cursor is the hand of the player in the
 * program. It is the browser's own cursor, with a picture of ours, so it moves with the mouse and
 * not with the frames.
 */

/** The corner and its diagonal, the point at the top left; the glowing edge goes around it. */
export const CURSOR_CORNER: Icon = [
  '############..',
  '############..',
  '#####.........',
  '#####.........',
  '######........',
  '##..###.......',
  '##...###......',
  '##....###.....',
  '##.....###....',
  '##......###...',
  '##.......###..',
  '##........###.',
  '...........###',
  '............#.',
];
/**
 * The largest cursor, in CSS pixels, that Chrome draws everywhere: a larger one it swaps for its
 * own when the cursor comes near an edge of the window, where the buttons of a level stand. The
 * dots of the cursor are made smaller until it fits.
 */
const CURSOR_MOST = 32;
/** The glowing edge around the corner, in dots, on every side. */
const RING = 1;
/** The red mark in the corner over what a press runs: its first row and column inside the corner, and its side, in dots. */
export const CURSOR_MARK = { at: 1, side: 3 };

/** CSS pixels a dot of the cursor, for a picture of `zoom` CSS pixels a dot: as large as a dot of it, while the cursor fits. */
export function cursorDot(zoom: number, icon: Icon = CURSOR_CORNER): number {
  const side = Math.max(icon.length, icon[0].length) + RING * 2;
  return Math.max(1, Math.min(Math.round(zoom), Math.floor(CURSOR_MOST / side)));
}

/** The cursor as rows: `#` its inside, `o` the edge around it, `.` nothing; with `marked`, `x` the red mark in the corner. */
export function cursorRows(icon: Icon = CURSOR_CORNER, marked = false): string[] {
  const mark = (r: number, c: number): boolean =>
    marked && r >= CURSOR_MARK.at && c >= CURSOR_MARK.at && r < CURSOR_MARK.at + CURSOR_MARK.side && c < CURSOR_MARK.at + CURSOR_MARK.side;
  const lit = (r: number, c: number): boolean => r >= 0 && c >= 0 && r < icon.length && c < icon[0].length && icon[r][c] === '#';
  const rows: string[] = [];
  for (let r = -RING; r < icon.length + RING; r++) {
    let row = '';
    for (let c = -RING; c < icon[0].length + RING; c++) {
      let near = false;
      for (let dr = -RING; dr <= RING && !near; dr++) for (let dc = -RING; dc <= RING && !near; dc++) near = lit(r + dr, c + dc);
      row += lit(r, c) ? (mark(r, c) ? 'x' : '#') : near ? 'o' : '.';
    }
    rows.push(row);
  }
  return rows;
}

/** The CSS of a cursor with `inside` and `edge` colours and, if given, a `mark`; `dot` CSS pixels a dot, for a screen of `ratio` device pixels a CSS pixel. */
function cursorCss(inside: string, edge: string, dot: number, ratio: number, mark?: string): string {
  const rows = cursorRows(CURSOR_CORNER, mark !== undefined);
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
      ctx.fillStyle = row[c] === '#' ? inside : row[c] === 'x' ? (mark ?? inside) : edge;
      ctx.fillRect(c * device, r * device, device, device);
    }
  });
  const url = `url("${canvas.toDataURL('image/png')}")`;
  const scale = device / dot;
  // The point of the corner, in CSS pixels: inside the edge.
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
 * Makes the cursor for a picture of `zoom` CSS pixels a dot, in the colours of `palette`; again
 * only when one of them has changed. Whoever draws the interface calls it with each picture.
 */
export function fitCursor(zoom: number, palette: Palette): void {
  const dot = cursorDot(zoom);
  const ratio = window.devicePixelRatio || 1;
  const key = `${dot}|${ratio}|${palette.bg}|${palette.ink}|${palette.signal}`;
  if (key === made) return;
  made = key;
  rest = cursorCss(palette.bg, palette.ink, dot, ratio);
  press = cursorCss(palette.ink, palette.bg, dot, ratio, palette.signal);
  apply();
}

/** Says whether the mouse of `who` is over something a press runs: the cursor turns inside out with its red mark while one of them says so. */
export function pointCursor(who: string, pointing: boolean): void {
  const had = over.size > 0;
  if (pointing) over.add(who);
  else over.delete(who);
  if (made !== '' && had !== over.size > 0) apply();
}
