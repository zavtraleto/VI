import { describe, expect, it } from 'vitest';
import { dotsWidth } from '../shell/pixelText';
import { sayColors } from '../shell/theme';
import { captionWords, drawCaption, plainCaption, wordsShown, type CaptionOptions } from './caption';

type Call = { op: 'write' | 'rect'; text?: string; x: number; y: number; w?: number; color?: string };

/** A context that writes down what is drawn: the bands and lines it is given, and every line of letters. */
function fakeContext() {
  const calls: Call[] = [];
  const ctx = {
    fillStyle: '',
    fillRect(x: number, y: number, w: number) {
      calls.push({ op: 'rect', x, y, w, color: this.fillStyle });
    },
  };
  const write: CaptionOptions['write'] = (text, x, y, _dot, color) => calls.push({ op: 'write', text, x, y, color });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, write };
}

const colors = sayColors();

describe('caption words', () => {
  it('marks the words in braces as the link and drops the braces', () => {
    expect(captionWords('try {endless mode}.')).toEqual([
      { word: 'try', link: false },
      { word: 'endless', link: true },
      { word: 'mode.', link: true, linkSigns: 4 },
    ]);
  });

  it('marks the words in square brackets as key words, a face by its number, and drops the marks', () => {
    expect(captionWords('A [1:one] by [leaving dice].')).toEqual([
      { word: 'A', link: false },
      { word: 'one', link: false, key: '1' },
      { word: 'by', link: false },
      { word: 'leaving', link: false, key: 'k' },
      { word: 'dice.', link: false, key: 'k', keyTo: 4 },
    ]);
    expect(captionWords('Sen hâlâ [1:bir]sin.')[2]).toEqual({ word: 'birsin.', link: false, key: '1', keyTo: 3 });
    expect(captionWords('qu\'[1:un].')[0]).toEqual({ word: 'qu\'un.', link: false, key: '1', keyFrom: 3, keyTo: 5 });
  });

  it('reads without its marks', () => {
    expect(plainCaption('A [1:one] by [leaving dice], {Skip}')).toBe('A one by leaving dice, Skip');
  });

  it('says one more word every step, the first at once', () => {
    expect(wordsShown('a b c', 0, 180)).toBe('a');
    expect(wordsShown('a b c', 200, 180)).toBe('a b');
    expect(wordsShown('a b c', 360, 180)).toBe('a b c');
    expect(wordsShown('a b c', 0, 0)).toBe('a b c');
  });
});

describe('drawing a caption', () => {
  it('is burnt in when nothing more is asked: no plate, the words milky', () => {
    const { ctx, calls, write } = fakeContext();
    drawCaption(ctx, 'one two', 0, 0, 400, 300, { dot: 1, write });
    expect(calls.some((c) => c.op === 'rect')).toBe(false);
    expect(calls.map((c) => c.text)).toEqual(['one', 'two']);
    expect(calls.every((c) => c.color === colors.ink)).toBe(true);
  });

  it('breaks the line at a bar, which is not written', () => {
    const { ctx, calls, write } = fakeContext();
    drawCaption(ctx, 'one | two', 0, 0, 400, 300, { dot: 1, write });
    expect(calls.map((c) => c.text)).toEqual(['one', 'two']);
    expect(calls[1].y).toBeGreaterThan(calls[0].y);
  });

  it('writes a key word in its colour: the one in the red of its pip, any other in the key colour', () => {
    const { ctx, calls, write } = fakeContext();
    drawCaption(ctx, '[1:one] and [link].', 0, 0, 1000, 300, { dot: 1, write });
    const color = (text: string) => calls.find((c) => c.text === text)!.color;
    expect(color('one')).toBe(colors.faces[0]);
    expect(color('and')).toBe(colors.ink);
    expect(color('link')).toBe(colors.key);
    // The stop after the key word is not of it.
    expect(color('.')).toBe(colors.ink);
    expect(calls.find((c) => c.text === '.')!.x).toBe(calls.find((c) => c.text === 'link')!.x + dotsWidth('link', 1));
  });

  it('lays a plate across the whole width before the words', () => {
    const { ctx, calls, write } = fakeContext();
    drawCaption(ctx, 'one two', 0, 0, 400, 300, { plate: true, dot: 1, write });
    expect(calls[0]).toMatchObject({ op: 'rect', x: 0, w: 400 });
  });

  it('puts each word where it will stand: the first word does not move as more come', () => {
    const one = fakeContext();
    drawCaption(one.ctx, 'one two three', 0, 0, 400, 300, { plate: true, words: 1, dot: 1, write: one.write });
    const all = fakeContext();
    drawCaption(all.ctx, 'one two three', 0, 0, 400, 300, { plate: true, dot: 1, write: all.write });
    const firstOf = (calls: Call[]) => calls.find((c) => c.op === 'write' && c.text === 'one')!;
    expect(one.calls.filter((c) => c.op === 'write').map((c) => c.text)).toEqual(['one']);
    expect(firstOf(one.calls).x).toBe(firstOf(all.calls).x);
  });

  it('gives the box of the link, one per line, and underlines it', () => {
    const { ctx, calls, write } = fakeContext();
    const drawn = drawCaption(ctx, 'try {endless mode}', 0, 0, 1000, 600, { plate: true, dot: 1, write });
    expect(drawn.link).toHaveLength(1);
    const [box] = drawn.link;
    const endless = calls.find((c) => c.op === 'write' && c.text === 'endless')!;
    expect(box.x).toBeCloseTo(endless.x);
    expect(box.w).toBeCloseTo(dotsWidth('endless mode', 1));
    // The plate, then the underline: a thin filled rectangle under the words of the link.
    expect(calls.filter((c) => c.op === 'rect').length).toBe(2);
  });

  it('does not underline the stop after the link', () => {
    const { ctx, write } = fakeContext();
    const [box] = drawCaption(ctx, 'try {endless mode}.', 0, 0, 1000, 600, { plate: true, dot: 1, write }).link;
    expect(box.w).toBeCloseTo(dotsWidth('endless mode', 1));
  });

  it('gives no link while its words have not come', () => {
    const { ctx, write } = fakeContext();
    expect(drawCaption(ctx, 'try {endless mode}', 0, 0, 1000, 600, { plate: true, words: 1, dot: 1, write }).link).toEqual([]);
  });
});
