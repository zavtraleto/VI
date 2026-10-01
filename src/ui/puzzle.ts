import type { DeadEnd } from '../rules';
import { h } from './dom';
import { t } from './i18n';

// Static markup built from constants only.
const UNDO_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';
const RESTART_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>';

function iconButton(icon: string, label: string, onClick: () => void): HTMLButtonElement {
  const el = h('button', { class: 'icon-btn', attrs: { type: 'button', 'aria-label': label, title: label }, onClick });
  el.innerHTML = icon;
  return el;
}

/**
 * What a puzzle puts over the board: in the top right corner, out of the way of swipes, the
 * two buttons every puzzle needs, to take a move back and to start over; at the bottom, a
 * line about the group just made.
 */
export class PuzzleTools {
  private readonly note = h('p', { class: 'puzzle-note' });
  private readonly undo: HTMLButtonElement;
  private readonly restart: HTMLButtonElement;
  private readonly buttons: HTMLElement;
  private shown = '';

  constructor(parent: HTMLElement, actions: { onUndo: () => void; onRestart: () => void }) {
    this.undo = iconButton(UNDO_ICON, t('undo'), actions.onUndo);
    this.restart = iconButton(RESTART_ICON, t('restart'), actions.onRestart);
    this.buttons = h('div', { class: 'puzzle-tools' }, [this.undo, this.restart]);
    // A tap on a button is not the start of a swipe.
    this.buttons.addEventListener('pointerdown', (e) => e.stopPropagation());
    parent.append(this.buttons, this.note);
    this.hide();
  }

  update(view: { dead: DeadEnd | null; held: boolean; canUndo: boolean }): void {
    const signature = `${view.dead}:${view.held}:${view.canUndo}`;
    if (signature === this.shown) return;
    this.shown = signature;
    this.buttons.hidden = false;
    const text = view.dead === 'noExit' ? t('deadNoExit') : view.dead === 'single' ? t('deadSingle') : view.held ? t('puzzleHeld') : '';
    this.note.textContent = text;
    this.note.hidden = text === '';
    this.note.classList.toggle('alarm', view.dead !== null);
    this.undo.disabled = !view.canUndo;
    // A dead end is left by taking the move back: that button becomes the one to press.
    this.undo.classList.toggle('urgent', view.dead !== null);
  }

  hide(): void {
    this.buttons.hidden = true;
    this.note.hidden = true;
    this.shown = '';
  }
}
