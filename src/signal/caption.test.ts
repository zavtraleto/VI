import { describe, expect, it } from 'vitest';
import { captionWords, drawCaption, wordsShown } from './caption';

/** A context that measures every sign as 10 pixels and writes down what is drawn. */
function fakeContext() {
  const calls: { op: string; text?: string; x: number; y: number; w?: number }[] = [];
  const ctx = {
    font: '',
    textAlign: 'center',
    textBaseline: 'alphabetic',
    lineJoin: 'round',
    lineWidth: 1,
    strokeStyle: '',
    fillStyle: '',
    measureText: (line: string) => ({ width: line.length * 10 }),
    strokeText: (text: string, x: number, y: number) => calls.push({ op: 'stroke', text, x, y }),
    fillText: (text: string, x: number, y: number) => calls.push({ op: 'fill', text, x, y }),
    fillRect: (x: number, y: number, w: number) => calls.push({ op: 'rect', x, y, w }),
    strokeRect: (x: number, y: number, w: number) => calls.push({ op: 'strokeRect', x, y, w }),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe('caption words', () => {
  it('marks the words in braces as the link and drops the braces', () => {
    expect(captionWords('try {endless mode}.')).toEqual([
      { word: 'try', link: false },
      { word: 'endless', link: true },
      { word: 'mode.', link: true, linkSigns: 4 },
    ]);
  });

  it('says one more word every step, the first at once', () => {
    expect(wordsShown('a b c', 0, 180)).toBe('a');
    expect(wordsShown('a b c', 200, 180)).toBe('a b');
    expect(wordsShown('a b c', 360, 180)).toBe('a b c');
    expect(wordsShown('a b c', 0, 0)).toBe('a b c');
  });
});

describe('drawing a caption', () => {
  it('is burnt in as before when nothing more is asked: no plate', () => {
    const { ctx, calls } = fakeContext();
    drawCaption(ctx, 'one two', 0, 0, 400, 300);
    expect(calls.some((c) => c.op === 'rect')).toBe(false);
    expect(calls.filter((c) => c.op === 'fill').map((c) => c.text)).toEqual(['one two']);
  });

  it('lays a plate across the whole width before the words', () => {
    const { ctx, calls } = fakeContext();
    drawCaption(ctx, 'one two', 0, 0, 400, 300, { plate: true });
    expect(calls[0]).toMatchObject({ op: 'rect', x: 0, w: 400 });
  });

  it('puts each word where it will stand: the first word does not move as more come', () => {
    const one = fakeContext();
    drawCaption(one.ctx, 'one two three', 0, 0, 400, 300, { plate: true, words: 1 });
    const all = fakeContext();
    drawCaption(all.ctx, 'one two three', 0, 0, 400, 300, { plate: true });
    const firstOf = (calls: typeof one.calls) => calls.find((c) => c.op === 'fill' && c.text === 'one')!;
    expect(one.calls.filter((c) => c.op === 'fill').map((c) => c.text)).toEqual(['one']);
    expect(firstOf(one.calls).x).toBe(firstOf(all.calls).x);
  });

  it('gives the box of the link, one per line, and underlines it', () => {
    const { ctx, calls } = fakeContext();
    const drawn = drawCaption(ctx, 'try {endless mode}', 0, 0, 1000, 600, { plate: true });
    expect(drawn.link).toHaveLength(1);
    const [box] = drawn.link;
    const endless = calls.find((c) => c.op === 'fill' && c.text === 'endless')!;
    expect(box.x).toBeCloseTo(endless.x);
    expect(box.w).toBeCloseTo('endless mode'.length * 10);
    // The underline is a thin filled rectangle under the words of the link.
    expect(calls.filter((c) => c.op === 'rect').length).toBe(2);
  });

  it('does not underline the stop after the link', () => {
    const { ctx } = fakeContext();
    const [box] = drawCaption(ctx, 'try {endless mode}.', 0, 0, 1000, 600, { plate: true }).link;
    expect(box.w).toBeCloseTo('endless mode'.length * 10);
  });

  it('gives no link while its words have not come', () => {
    const { ctx } = fakeContext();
    expect(drawCaption(ctx, 'try {endless mode}', 0, 0, 1000, 600, { plate: true, words: 1 }).link).toEqual([]);
  });
});
