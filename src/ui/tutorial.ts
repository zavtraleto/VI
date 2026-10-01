import { TUTORIAL_LINES, type Dir, type TutorialLine } from '../rules';
import { dieFace, h } from './dom';
import { t, type TextKey } from './i18n';

/** How the step to make is shown: a sliding dot for swipes, arrow keys, or nothing. */
export type InputGlyph = 'swipe' | 'keys' | 'none';

export interface GuideView {
  /** Face value the lesson is about: 2 to 6, then 1. */
  value: number;
  line: TutorialLine;
  dir: Dir | null;
  glyph: InputGlyph;
  /** Where `dir` points on screen, y growing downwards. */
  screen: { x: number; y: number } | null;
}

/** A point of the stage, in CSS pixels. */
export interface StagePoint {
  x: number;
  y: number;
}

const KEYS: readonly { dir: Dir; glyph: string }[] = [
  { dir: 'N', glyph: '↑' },
  { dir: 'W', glyph: '←' },
  { dir: 'S', glyph: '↓' },
  { dir: 'E', glyph: '→' },
];

function restart(el: HTMLElement, name: string): void {
  el.classList.remove(name);
  void el.offsetWidth;
  el.classList.add(name);
}

function place(el: HTMLElement, at: StagePoint): void {
  el.style.transform = `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px) translate(-50%, -100%)`;
}

/**
 * What the tutorial puts over the board: at the very top, the name of the lesson and what
 * to do; at the bottom, the input that does it; and a count of the group being built.
 */
export class TutorialGuide {
  private readonly el = h('div', { class: 'guide' });
  private readonly title = h('span', { class: 'guide-title' });
  private readonly line = h('p', { class: 'guide-line' });
  private readonly text = h('div', { class: 'guide-text' }, [this.title, this.line]);
  private readonly skip: HTMLButtonElement;
  private readonly swipe = h('div', { class: 'guide-swipe' }, [
    h('span', { class: 'guide-swipe-track' }),
    h('span', { class: 'guide-swipe-dot' }),
  ]);
  private readonly keys = h('div', { class: 'guide-keys' });
  private readonly keyEls = {} as Record<Dir, HTMLElement>;
  private readonly counter = h('div', { class: 'guide-count' });
  private readonly sum = h('div', { class: 'guide-count guide-sum' }, [
    h('span', { class: 'guide-face' }, [dieFace(1)]),
    '+',
    h('span', { class: 'guide-face' }, [dieFace(6)]),
    '= 7',
  ]);
  private shown = '';
  private counted = '';

  constructor(root: HTMLElement, onSkip: () => void) {
    for (const { dir, glyph } of KEYS) {
      this.keyEls[dir] = h('span', { class: `key key-${dir}`, text: glyph });
      this.keys.append(this.keyEls[dir]);
    }
    this.skip = h('button', { class: 'guide-skip', text: `${t('tutSkip')} ›`, attrs: { type: 'button' }, onClick: onSkip });
    // A tap on the button is not the start of a swipe.
    this.skip.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.append(this.swipe, this.keys);
    root.append(this.counter, this.sum, this.text, this.el, this.skip);
    this.hide();
  }

  /** Shows the lesson, its current line and the input for the move the tutorial waits for. */
  show(view: GuideView): void {
    const { value, line, dir, glyph, screen } = view;
    const signature = JSON.stringify(view);
    if (signature === this.shown) return;
    this.shown = signature;

    this.title.textContent = t(`tutSign${value}` as TextKey);
    const text = t(`tut_${line}` as TextKey);
    if (this.line.textContent !== text) {
      this.line.textContent = text;
      restart(this.line, 'fresh');
    }
    this.swipe.hidden = glyph !== 'swipe' || screen === null;
    if (screen) {
      this.swipe.style.setProperty('--sx', screen.x.toFixed(3));
      this.swipe.style.setProperty('--sy', screen.y.toFixed(3));
      this.swipe.style.setProperty('--angle', `${((Math.atan2(screen.y, screen.x) * 180) / Math.PI).toFixed(1)}deg`);
    }
    this.keys.hidden = glyph !== 'keys' || dir === null;
    for (const key of KEYS) this.keyEls[key.dir].classList.toggle('lit', key.dir === dir);
    this.el.hidden = false;
    this.text.hidden = false;
    this.skip.hidden = false;
  }

  /**
   * Gives the text block the height of its longest line, so it does not grow and shrink
   * from step to step, and returns where the block ends, in pixels from the top of the stage.
   * The board is laid out below that.
   */
  reserve(): number {
    this.text.hidden = false;
    const shown = this.line.textContent;
    this.line.style.minHeight = '';
    let tallest = 0;
    for (const line of TUTORIAL_LINES) {
      this.line.textContent = t(`tut_${line}` as TextKey);
      tallest = Math.max(tallest, this.line.offsetHeight);
    }
    this.line.textContent = shown;
    this.line.style.minHeight = `${tallest}px`;
    return this.text.offsetTop + this.text.offsetHeight;
  }

  /** How many dice of the group are in place, shown above it. */
  count(counter: { value: number; have: number; need: number } | null, at: StagePoint | null): void {
    this.counter.hidden = counter === null || at === null;
    if (!counter || !at) {
      this.counted = '';
      return;
    }
    const signature = `${counter.value}:${counter.have}/${counter.need}`;
    if (signature !== this.counted) {
      this.counted = signature;
      this.counter.replaceChildren(h('span', { class: 'guide-face' }, [dieFace(counter.value)]), `${counter.have}/${counter.need}`);
      this.counter.classList.toggle('full', counter.have >= counter.need);
      restart(this.counter, 'bump');
    }
    place(this.counter, at);
  }

  /** "1 + 6 = 7" above the die whose hidden face matters. */
  seven(at: StagePoint | null): void {
    this.sum.hidden = at === null;
    if (at) place(this.sum, at);
  }

  /** Answers a step off the script. */
  nudge(): void {
    restart(this.el, 'nudge');
  }

  hide(): void {
    this.shown = '';
    this.counted = '';
    this.line.textContent = '';
    this.el.classList.remove('nudge');
    this.el.hidden = true;
    this.text.hidden = true;
    this.skip.hidden = true;
    this.counter.hidden = true;
    this.sum.hidden = true;
  }
}
