// Makes the Cyrillic of the shell's font. DotGothic16 is a Japanese font: its Latin letters take
// half a place, 8 dots by 16, and its Cyrillic a whole one, 16 by 16, so a Russian word stood
// twice as wide as an English one and looked like another font. The letters here are drawn on the
// dots of its Latin capitals - seven across, thirteen up, the same strokes - and take half a place.
//
// Small letters are the capitals: the program writes in capitals, and a name that comes from
// outside with small letters in it is written the same way.
//
// Run `npm run fonts` after changing a letter; the result is kept in the repository.
import { writeFileSync } from 'node:fs';
import fontverter from 'fontverter';
import opentype from 'opentype.js';

const FONT_OUT = 'src/shell/fonts/dotgothic16-cyr.woff2';

// The measures of DotGothic16, read from its Latin file: a thousand units to the em, a letter
// 500 wide, a stroke 74 thick, and the dots of a capital 61.67 apart across and 61.75 up, the
// first of them at 65 and 9.
const UNITS = 1000;
const ADVANCE = 500;
const ASCENT = 1160;
const DESCENT = -288;
const HALF_STROKE = 37;
const dotX = (col) => 65 + col * (370 / 6);
const dotY = (row) => 9 + row * 61.75;

/** `count` rows of the same dots. */
const x = (dots, count = 1) => Array(count).fill(dots);
const mirror = (rows) => rows.map((row) => [...row].reverse().join(''));

// Letters DotGothic16 has under another name, dot for dot.
const A = ['...#...', '...#...', '...#...', '..#.#..', '..#.#..', '..#.#..', '.#...#.', '.#...#.', '.#...#.', '.#####.', '#.....#', '#.....#', '#.....#'];
const B = ['#####..', '#....#.', ...x('#.....#', 3), '#....#.', '#####..', '#....#.', ...x('#.....#', 3), '#....#.', '#####..'];
const C = ['..###..', '.#...#.', '#.....#', '#.....#', ...x('#......', 4), '#.....#', '#.....#', '#.....#', '.#...#.', '..###..'];
const E = ['#######', ...x('#......', 5), '######.', ...x('#......', 5), '#######'];
const H = [...x('#.....#', 6), '#######', ...x('#.....#', 6)];
const K = ['#.....#', '#....#.', '#...#..', '#..#...', '#.#....', '##.....', '##.....', '#.#....', '#..#...', '#...#..', '#...#..', '#....#.', '#.....#'];
const M = ['#.....#', '#.....#', ...x('##...##', 3), ...x('#.#.#.#', 4), ...x('#..#..#', 3), '#.....#'];
const N = ['#.....#', '#.....#', '##....#', '##....#', '#.#...#', '#.#...#', '#..#..#', '#..#..#', '#...#.#', '#...#.#', '#....##', '#....##', '#.....#'];
const O = ['..###..', '.#...#.', ...x('#.....#', 9), '.#...#.', '..###..'];
const P = ['#####..', '#....#.', ...x('#.....#', 4), '#....#.', '#####..', ...x('#......', 5)];
const R = ['#####..', '#....#.', ...x('#.....#', 3), '#....#.', '#####..', ...x('#....#.', 3), ...x('#.....#', 3)];
const T = ['#######', ...x('...#...', 12)];
const X = ['#.....#', '#.....#', '.#...#.', '.#...#.', '..#.#..', '..#.#..', '...#...', '..#.#..', '..#.#..', '.#...#.', '.#...#.', '#.....#', '#.....#'];
const THREE = ['..###..', '.#...#.', '#.....#', '#.....#', '......#', '.....#.', '..###..', '.....#.', '......#', '#.....#', '#.....#', '.#...#.', '..###..'];

// Thirteen rows are a capital, from its top to the line it stands on. Fourteen have a row above
// the capital, for a mark; fifteen have two below the line, for a tail.
const LETTERS = {
  А: A,
  Б: ['#######', ...x('#......', 5), '#####..', '#....#.', ...x('#.....#', 3), '#....#.', '#####..'],
  В: B,
  Г: ['#######', ...x('#......', 12)],
  Д: ['..####.', ...x('..#..#.', 6), ...x('.#...#.', 5), '#######', ...x('#.....#', 2)],
  Е: E,
  Ё: ['.#...#.', '.......', '#######', ...x('#......', 4), '######.', ...x('#......', 5), '#######'],
  Ж: [...x('#..#..#', 3), ...x('.#.#.#.', 2), ...x('..###..', 3), ...x('.#.#.#.', 2), ...x('#..#..#', 3)],
  З: THREE,
  И: mirror(N),
  Й: ['.#...#.', '..###..', '.......', '#.....#', '#....##', '#....##', '#...#.#', '#...#.#', '#..#..#', '#..#..#', '#.#...#', '#.#...#', '##....#', '#.....#'],
  К: K,
  Л: ['..#####', ...x('..#...#', 8), ...x('.#....#', 3), '#.....#'],
  М: M,
  Н: H,
  О: O,
  П: ['#######', ...x('#.....#', 12)],
  Р: P,
  С: C,
  Т: T,
  У: [...x('#.....#', 3), ...x('.#...#.', 3), ...x('..#.#..', 2), ...x('...#...', 2), '..#....', '.#.....', '#......'],
  Ф: ['...#...', '.#####.', ...x('#..#..#', 8), '.#####.', ...x('...#...', 2)],
  Х: X,
  Ц: [...x('#.....#', 12), '#######', ...x('......#', 2)],
  Ч: [...x('#.....#', 7), '.######', ...x('......#', 5)],
  Ш: [...x('#..#..#', 12), '#######'],
  Щ: [...x('#..#..#', 12), '#######', ...x('......#', 2)],
  Ъ: ['###....', ...x('..#....', 5), '..####.', ...x('..#...#', 5), '..####.'],
  Ы: [...x('#.....#', 6), '####..#', ...x('#...#.#', 5), '####..#'],
  Ь: [...x('#......', 6), '#####..', '#....#.', ...x('#.....#', 3), '#....#.', '#####..'],
  Э: ['..###..', '.#...#.', '#.....#', ...x('......#', 3), '..#####', ...x('......#', 3), '#.....#', '.#...#.', '..###..'],
  Ю: ['#..###.', ...x('#.#...#', 5), '###...#', ...x('#.#...#', 5), '#..###.'],
  Я: mirror(R),
};

/** The dots of a letter as `[col, row]`, the row counted up from the line the letter stands on. */
function dots(rows) {
  const top = rows.length === 14 || rows.length === 16 ? 13 : 12;
  const lit = [];
  rows.forEach((row, i) => {
    if (row.length !== 7) throw new Error(`a row of ${row.length} dots: ${row}`);
    [...row].forEach((sign, col) => sign === '#' && lit.push([col, top - i]));
  });
  return lit;
}

/**
 * The outline of a letter: every dot is a square a stroke wide, wider than the step between
 * dots, so dots side by side run into a line. The squares are joined into whole shapes, with the
 * ink on the right of the way round, as a TrueType outline has it.
 */
function outline(lit) {
  const squares = lit.map(([col, row]) => [dotX(col) - HALF_STROKE, dotY(row) - HALF_STROKE, dotX(col) + HALF_STROKE, dotY(row) + HALF_STROKE].map(Math.round));
  const xs = [...new Set(squares.flatMap(([l, , r]) => [l, r]))].sort((a, b) => a - b);
  const ys = [...new Set(squares.flatMap(([, b, , t]) => [b, t]))].sort((a, b) => a - b);
  const inked = (i, j) =>
    i >= 0 && j >= 0 && i < xs.length - 1 && j < ys.length - 1 && squares.some(([l, b, r, t]) => l <= xs[i] && xs[i + 1] <= r && b <= ys[j] && ys[j + 1] <= t);

  // Every edge between ink and no ink, as a step from a corner to a corner with the ink on its right.
  const steps = new Map();
  const add = (from, to) => steps.set(from.join(), [...(steps.get(from.join()) ?? []), to]);
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      if (!inked(i, j)) continue;
      if (!inked(i, j + 1)) add([i, j + 1], [i + 1, j + 1]);
      if (!inked(i, j - 1)) add([i + 1, j], [i, j]);
      if (!inked(i - 1, j)) add([i, j], [i, j + 1]);
      if (!inked(i + 1, j)) add([i + 1, j + 1], [i + 1, j]);
    }
  }
  const path = new opentype.Path();
  while (steps.size > 0) {
    const start = steps.keys().next().value.split(',').map(Number);
    const corners = [start];
    let at = start;
    let heading = null;
    for (;;) {
      const ways = steps.get(at.join());
      // Where two shapes touch at a corner the way turns right, and each shape keeps its own outline.
      const turn = (to) => (heading === null ? 0 : heading[0] * (to[1] - at[1]) - heading[1] * (to[0] - at[0]));
      const next = ways.length === 1 ? ways[0] : ways.reduce((best, to) => (turn(to) < turn(best) ? to : best));
      ways.splice(ways.indexOf(next), 1);
      if (ways.length === 0) steps.delete(at.join());
      heading = [next[0] - at[0], next[1] - at[1]];
      at = next;
      if (at[0] === start[0] && at[1] === start[1]) break;
      corners.push(at);
    }
    // Corners that only pass along a straight line are left out.
    const bends = corners.filter((corner, k) => {
      const before = corners[(k + corners.length - 1) % corners.length];
      const after = corners[(k + 1) % corners.length];
      return (corner[0] - before[0]) * (after[1] - corner[1]) !== (corner[1] - before[1]) * (after[0] - corner[0]);
    });
    bends.forEach(([i, j], k) => (k === 0 ? path.moveTo(xs[i], ys[j]) : path.lineTo(xs[i], ys[j])));
    path.close();
  }
  return path;
}

const glyphs = [new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: ADVANCE, path: new opentype.Path() })];
for (const [letter, rows] of Object.entries(LETTERS)) {
  const glyph = new opentype.Glyph({ name: `uni${letter.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`, unicode: letter.codePointAt(0), advanceWidth: ADVANCE, path: outline(dots(rows)) });
  glyph.addUnicode(letter.toLowerCase().codePointAt(0));
  glyphs.push(glyph);
}

const font = new opentype.Font({ familyName: 'DotGothic16', styleName: 'Regular', unitsPerEm: UNITS, ascender: ASCENT, descender: DESCENT, glyphs });
const woff2 = await fontverter.convert(Buffer.from(font.toArrayBuffer()), 'woff2');
writeFileSync(FONT_OUT, woff2);
console.log(`${FONT_OUT}: ${woff2.length} bytes, ${glyphs.length - 1} letters`);
