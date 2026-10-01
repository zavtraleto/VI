import type { Dir } from '../rules';
import { dieFace, h } from './dom';
import { t, type TextKey } from './i18n';

/** How the step to make is shown: a sliding dot for swipes, arrow keys, or nothing. */
export type InputGlyph = 'swipe' | 'keys' | 'none';

/** One line per step of the script, and one for the finale. */
const LINES: readonly TextKey[] = ['tutLine0', 'tutLine1', 'tutLine2', 'tutLine3', 'tutLine4', 'tutLine5'];

const KEYS: readonly { dir: Dir; glyph: string }[] = [
  { dir: 'N', glyph: '↑' },
  { dir: 'W', glyph: '←' },
  { dir: 'S', glyph: '↓' },
  { dir: 'E', glyph: '→' },
];

/** Rows of the rule: two 2s, three 3s, up to six 6s. */
const RULE_VALUES = [2, 3, 4, 5, 6];
const CASCADE_MS = 160;

function restart(el: HTMLElement, name: string): void {
  el.classList.remove(name);
  void el.offsetWidth;
  el.classList.add(name);
}

/**
 * What the tutorial puts over the board: a line of text for the current step, the input
 * that makes it, and the rule of the game as a triangle of faces that lights up row by row.
 */
export class TutorialGuide {
  private readonly el = h('div', { class: 'guide' });
  private readonly line = h('p', { class: 'guide-line' });
  private readonly swipe = h('div', { class: 'guide-swipe' }, [
    h('span', { class: 'guide-swipe-track' }),
    h('span', { class: 'guide-swipe-dot' }),
  ]);
  private readonly keys = h('div', { class: 'guide-keys' });
  private readonly keyEls = {} as Record<Dir, HTMLElement>;
  private readonly triangle = h('div', { class: 'rule-tri' });
  private readonly rows = new Map<number, HTMLElement>();
  private timers: number[] = [];

  constructor(root: HTMLElement) {
    for (const { dir, glyph } of KEYS) {
      this.keyEls[dir] = h('span', { class: `key key-${dir}`, text: glyph });
      this.keys.append(this.keyEls[dir]);
    }
    for (const value of RULE_VALUES) {
      const row = h('div', { class: 'rule-row' });
      // A face sizes its padding from its container, so each one gets a cell of its own.
      for (let i = 0; i < value; i++) row.append(h('span', { class: 'rule-cell' }, [dieFace(value)]));
      this.rows.set(value, row);
      this.triangle.append(row);
    }
    this.el.append(this.line, this.swipe, this.keys);
    root.append(this.triangle, this.el);
    this.hide();
  }

  /**
   * Shows the line for a step of the script (the step after the last one is the finale) and
   * the input for `dir`. `screen` is where `dir` points on screen, y growing downwards.
   */
  show(step: number, dir: Dir | null, glyph: InputGlyph, screen: { x: number; y: number } | null): void {
    const text = t(LINES[Math.min(step, LINES.length - 1)]);
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
    this.triangle.hidden = false;
  }

  /** Lights the row of the rule for a face value. */
  light(value: number): void {
    const row = this.rows.get(value);
    if (row && !row.classList.contains('lit')) row.classList.add('lit');
  }

  /** Lights the rows the player has not cleared, one after another. */
  finale(): void {
    const rest = RULE_VALUES.filter((value) => !this.rows.get(value)!.classList.contains('lit'));
    rest.forEach((value, i) => {
      this.timers.push(window.setTimeout(() => this.light(value), (i + 1) * CASCADE_MS));
    });
  }

  /** Answers a step off the script. */
  nudge(): void {
    restart(this.el, 'nudge');
  }

  hide(): void {
    for (const timer of this.timers) window.clearTimeout(timer);
    this.timers = [];
    for (const row of this.rows.values()) row.classList.remove('lit');
    this.line.textContent = '';
    this.el.classList.remove('nudge');
    this.el.hidden = true;
    this.triangle.hidden = true;
  }
}
