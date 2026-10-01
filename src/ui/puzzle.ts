import type { DeadEnd } from '../rules';
import { h } from './dom';
import { t } from './i18n';

/**
 * What a puzzle keeps under the board: a line about the group just made, and the two buttons
 * every puzzle needs, to take a move back and to start over.
 */
export class PuzzleBar {
  private readonly note = h('p', { class: 'puzzle-note' });
  private readonly undo: HTMLButtonElement;
  private readonly restart: HTMLButtonElement;
  private readonly el: HTMLElement;
  private shown = '';

  constructor(parent: HTMLElement, actions: { onUndo: () => void; onRestart: () => void }) {
    this.undo = h('button', { class: 'btn small', text: t('undo'), attrs: { type: 'button' }, onClick: actions.onUndo });
    this.restart = h('button', { class: 'btn small', text: t('restart'), attrs: { type: 'button' }, onClick: actions.onRestart });
    this.el = h('div', { class: 'puzzle-bar' }, [this.note, h('div', { class: 'row' }, [this.undo, this.restart])]);
    // A tap on a button is not the start of a swipe.
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.hidden = true;
    parent.append(this.el);
  }

  update(view: { dead: DeadEnd | null; held: boolean; canUndo: boolean }): void {
    this.el.hidden = false;
    const signature = `${view.dead}:${view.held}:${view.canUndo}`;
    if (signature === this.shown) return;
    this.shown = signature;
    const text = view.dead === 'noExit' ? t('deadNoExit') : view.dead === 'single' ? t('deadSingle') : view.held ? t('puzzleHeld') : '';
    this.note.textContent = text;
    this.note.classList.toggle('alarm', view.dead !== null);
    this.undo.disabled = !view.canUndo;
    // A dead end is left by taking the move back: that button becomes the one to press.
    this.undo.classList.toggle('primary', view.dead !== null);
  }

  hide(): void {
    this.el.hidden = true;
    this.shown = '';
  }
}
