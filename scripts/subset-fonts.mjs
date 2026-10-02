// Cuts the Japanese part of the shell's font down to the signs the shell uses: the whole
// font is hundreds of kilobytes, the signs in use are a few. Run `npm run fonts` after the
// Japanese in src/shell/text.ts changes; the result is kept in the repository.
import { readFileSync, writeFileSync } from 'node:fs';
import subsetFont from 'subset-font';

const SOURCE = 'node_modules/@fontsource/dotgothic16/files/dotgothic16-japanese-400-normal.woff2';
const TEXTS = ['src/shell/text.ts'];
const FONT_OUT = 'src/shell/fonts/dotgothic16-jp.woff2';
const LIST_OUT = 'src/shell/fonts/kanji.txt';

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => String.fromCodePoint(from + i)).join('');

// The arrows, both syllabaries, their half-width forms and the punctuation come whole: they are small.
const always = range(0x2190, 0x2193) + range(0x3000, 0x303f) + range(0x3041, 0x3096) + range(0x30a0, 0x30ff) + range(0xff01, 0xff9f);

const text = TEXTS.map((file) => readFileSync(file, 'utf8')).join('');
const kanji = [...new Set([...text].filter((sign) => sign >= '㐀' && sign <= '鿿'))].sort().join('');

const font = await subsetFont(readFileSync(SOURCE), always + kanji, { targetFormat: 'woff2' });
writeFileSync(FONT_OUT, font);
writeFileSync(LIST_OUT, `${kanji}\n`);
console.log(`${FONT_OUT}: ${font.length} bytes, ${[...kanji].length} kanji`);
