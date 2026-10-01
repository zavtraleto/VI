import { RITUAL_THRESHOLDS, nextThreshold } from '../app/ritual';
import type { BoardView } from '../render/view';
import type { RunState } from '../rules';
import { h } from './dom';
import { t } from './i18n';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Six marks around a point: one is lit from the start, one more with every ritual stage. */
function stageSign(): { el: SVGSVGElement; marks: SVGLineElement[] } {
  const el = document.createElementNS(SVG_NS, 'svg');
  el.setAttribute('viewBox', '-12 -12 24 24');
  el.setAttribute('class', 'stage-sign');
  const marks: SVGLineElement[] = [];
  for (let i = 0; i <= RITUAL_THRESHOLDS.length; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / (RITUAL_THRESHOLDS.length + 1);
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(Math.cos(a) * 4.5));
    line.setAttribute('y1', String(Math.sin(a) * 4.5));
    line.setAttribute('x2', String(Math.cos(a) * 10.5));
    line.setAttribute('y2', String(Math.sin(a) * 10.5));
    marks.push(line);
    el.append(line);
  }
  const dot = document.createElementNS(SVG_NS, 'circle');
  dot.setAttribute('r', '1.8');
  el.append(dot);
  return { el, marks };
}

export class Hud {
  private readonly score = h('span', { class: 'stat-value', text: '0' });
  private readonly best = h('span', { class: 'stat-value', text: '0' });
  private readonly next = h('span', { class: 'stage-next' });
  private readonly tag = h('span', { class: 'mode-tag' });
  private readonly danger = h('span', { class: 'danger-count' });
  private readonly sign = stageSign();
  private lastScore = -1;
  private lastBest = -1;
  private lastStage = -1;

  constructor(root: HTMLElement, onPause: () => void) {
    root.append(
      h('div', { class: 'stat' }, [
        h('span', { class: 'stat-label', text: t('score') }),
        h('div', { class: 'stat-line' }, [this.score, this.sign.el, this.next]),
      ]),
      h('div', { class: 'hud-mid' }, [this.tag, this.danger]),
      h('div', { class: 'stat right' }, [h('span', { class: 'stat-label', text: t('best') }), this.best]),
      h('button', { class: 'pause-btn', attrs: { 'aria-label': t('paused'), type: 'button' }, onClick: onPause }, [
        h('span'),
        h('span'),
      ]),
    );
  }

  update(state: RunState, best: number, stage: number): void {
    if (state.score !== this.lastScore) {
      this.lastScore = state.score;
      this.score.textContent = String(state.score);
      const next = nextThreshold(state.score);
      this.next.textContent = next === null ? '' : String(next);
    }
    if (stage !== this.lastStage) {
      this.lastStage = stage;
      this.sign.marks.forEach((mark, i) => mark.classList.toggle('lit', i <= stage));
      this.sign.el.classList.toggle('complete', stage >= RITUAL_THRESHOLDS.length);
      if (stage > 0) {
        this.sign.el.classList.remove('turn');
        void this.sign.el.getBoundingClientRect();
        this.sign.el.classList.add('turn');
      }
    }
    const shownBest = Math.max(best, state.mode === 'endless' ? state.score : 0);
    if (shownBest !== this.lastBest) {
      this.lastBest = shownBest;
      this.best.textContent = String(shownBest);
    }
    const left = Hud.secondsLeft(state);
    this.tag.textContent = left !== null ? t('boardFull') : state.mode === 'practice' ? t('practice') : '';
    this.tag.classList.toggle('alarm', left !== null);
    this.danger.textContent = left === null ? '' : String(left);
  }

  /** Seconds left on the full-board countdown, or null when it is not running. */
  static secondsLeft(state: RunState): number | null {
    if (state.fullTicks <= 0 || state.over) return null;
    const { config } = state;
    return Math.ceil(((config.rescueTicks - state.fullTicks) * config.tickMs) / 1000);
  }
}

/** `×N` markers that follow running chain reactions on the board. */
export class ChainLabels {
  private readonly labels = new Map<number, HTMLElement>();

  constructor(private readonly root: HTMLElement) {}

  update(state: RunState, view: BoardView): void {
    const seen = new Set<number>();
    for (const reaction of state.reactions) {
      if (reaction.chain < 2) continue;
      const cubes = state.cubes.filter((c) => c.reactionId === reaction.id && c.state === 'sinking');
      if (cubes.length === 0) continue;
      seen.add(reaction.id);
      let label = this.labels.get(reaction.id);
      if (!label) {
        label = h('div', { class: 'chain-label' });
        this.labels.set(reaction.id, label);
        this.root.append(label);
      }
      const text = `×${reaction.chain}`;
      if (label.textContent !== text) {
        label.textContent = text;
        label.classList.remove('bump');
        void label.offsetWidth;
        label.classList.add('bump');
      }
      const cx = cubes.reduce((s, c) => s + c.x, 0) / cubes.length;
      const cz = cubes.reduce((s, c) => s + c.z, 0) / cubes.length;
      const p = view.project(cx, 1.2, cz);
      label.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
    }
    for (const [id, label] of this.labels) {
      if (seen.has(id)) continue;
      label.remove();
      this.labels.delete(id);
    }
  }

  clear(): void {
    for (const label of this.labels.values()) label.remove();
    this.labels.clear();
  }
}

/** One short hint at a time, queued. */
export class HintBubble {
  private readonly el = h('div', { class: 'hint-bubble' });
  private readonly queue: { text: string; ms: number }[] = [];
  private timer: number | null = null;
  private sticky = false;

  constructor(root: HTMLElement) {
    root.append(this.el);
  }

  /** Stays until `clearSticky` is called. */
  showSticky(text: string): void {
    this.sticky = true;
    this.display(text);
  }

  clearSticky(): void {
    if (!this.sticky) return;
    this.sticky = false;
    this.next();
  }

  show(text: string, ms = 4500): void {
    this.queue.push({ text, ms });
    if (!this.sticky && this.timer === null) this.next();
  }

  reset(): void {
    this.queue.length = 0;
    this.sticky = false;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    this.el.classList.remove('visible');
  }

  private display(text: string): void {
    this.el.textContent = text;
    this.el.classList.add('visible');
  }

  private next(): void {
    this.timer = null;
    const item = this.queue.shift();
    if (!item) {
      this.el.classList.remove('visible');
      return;
    }
    this.display(item.text);
    this.timer = window.setTimeout(() => this.next(), item.ms);
  }
}
