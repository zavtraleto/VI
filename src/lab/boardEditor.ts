import type { Dir } from '../rules/types';
import { PROGRAM_FONT, mixHex, paletteAt, shellDefaults, type Palette } from '../shell/theme';
import { cellAt, clearCell, cycleLeaving, emptyBoard, putDie, rollDie, setStart, toggleFixed, toggleHole, type EditBoard } from './editBoard';

const ARROWS: Readonly<Record<string, Dir>> = { ArrowUp: 'N', ArrowRight: 'E', ArrowDown: 'S', ArrowLeft: 'W' };
const TOWARDS: Readonly<Record<Dir, { dx: number; dz: number }>> = { N: { dx: 0, dz: -1 }, E: { dx: 1, dz: 0 }, S: { dx: 0, dz: 1 }, W: { dx: -1, dz: 0 } };

/**
 * What the solver says of a board, drawn over it. An arrow is a move there is from the start:
 * from the cell of its die to the side it goes, dashed where it is a push, and coloured by what
 * it does to the fewest moves. A sensitive cell is a die a change of which changes the fewest
 * moves, or leaves the board with no way. A spare cell is a die the board is cleared as well
 * without.
 */
export interface Overlay {
  arrows: { x: number; z: number; dir: Dir; push: boolean; keeps: 'par' | 'longer' | 'dead' | 'unknown' }[];
  sensitive: { x: number; z: number; change: 'shorter' | 'longer' | 'unsolved' }[];
  spare: { x: number; z: number }[];
  /** Cells that differ from the board this one is held against: framed, where two versions are shown side by side. */
  changed?: { x: number; z: number }[];
}

/**
 * The board of the lab of the levels as it is drawn and changed: a canvas seen from above, north
 * up, a cell a square. A die is the face on top, large, and the face to the north, small in its
 * corner, in the colour of the channel of its top; a fixed die has a second frame, a die that is
 * leaving is half seen with its moves in the other corner, the start is a ring. The numbers
 * along the edges are the `x` and the `z` of a cell, as a move is written with them.
 *
 * A click on an empty cell puts a die there and a click on a die turns it to its next face; the
 * arrows roll the die that is picked where it stands; the right button clears a cell; `H` cuts
 * the cell out or puts it back, a click with Shift fixes the die, `P` puts the start there, `L`
 * makes the die leave a move later. Every one of these is one step to take back (`Ctrl+Z`) and
 * to make again (`Ctrl+Y`). The colours and the font are those of the interface
 * (`src/shell/theme.ts`), as they are at night: the look of the page is a working one.
 */
export class BoardEditor {
  readonly canvas = document.createElement('canvas');
  /** The cell picked: the one the keys change. */
  selected: { x: number; z: number } | null = null;
  /** The moves a die that is leaving has at the most: the `sink` of the board. */
  sink = 2;
  /** The board is shown and not changed: it is a moment of a way, or a version of the board. */
  locked = false;
  private board: EditBoard = emptyBoard(4);
  private before: EditBoard[] = [];
  private after: EditBoard[] = [];
  private readonly palette: Palette = paletteAt(shellDefaults(), 0);
  private overlay: Overlay | null = null;

  constructor(
    parent: HTMLElement,
    private readonly onChange: (board: EditBoard) => void,
  ) {
    const { canvas } = this;
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;outline:none;cursor:crosshair';
    canvas.tabIndex = 0;
    parent.append(canvas);
    new ResizeObserver(() => this.draw()).observe(canvas);
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    canvas.addEventListener('mousedown', (event) => {
      const cell = this.cellOf(event);
      if (!cell) return;
      event.preventDefault();
      canvas.focus();
      this.selected = cell;
      if (this.locked) this.draw();
      else if (event.button === 2) this.change(clearCell(this.board, cell.x, cell.z));
      else if (event.button === 0) this.change(event.shiftKey ? toggleFixed(this.board, cell.x, cell.z) : putDie(this.board, cell.x, cell.z));
    });
  }

  get current(): EditBoard {
    return this.board;
  }

  /** What is drawn over the board of what the solver says; null for nothing. */
  setOverlay(overlay: Overlay | null): void {
    this.overlay = overlay;
    this.draw();
  }

  /** Puts a board in the editor as the one in hand: it is no change, and nothing before it can be taken back to. */
  show(board: EditBoard, keepSteps = false): void {
    this.board = board;
    if (!keepSteps) {
      this.before = [];
      this.after = [];
    }
    if (this.selected && !cellAt(board, this.selected.x, this.selected.z)) this.selected = null;
    this.draw();
  }

  /** A change of the board: one step to take back. A change that changes nothing is none. */
  change(next: EditBoard): void {
    if (this.locked || next === this.board) {
      this.draw();
      return;
    }
    this.before.push(this.board);
    this.after = [];
    this.board = next;
    this.draw();
    this.onChange(next);
  }

  undo(): void {
    const last = this.before.pop();
    if (!last || this.locked) return;
    this.after.push(this.board);
    this.board = last;
    this.draw();
    this.onChange(last);
  }

  redo(): void {
    const next = this.after.pop();
    if (!next || this.locked) return;
    this.before.push(this.board);
    this.board = next;
    this.draw();
    this.onChange(next);
  }

  /** A key of the editor; true where it was one of them. */
  key(event: KeyboardEvent): boolean {
    const control = event.ctrlKey || event.metaKey;
    if (control && event.code === 'KeyZ') {
      if (event.shiftKey) this.redo();
      else this.undo();
      return true;
    }
    if (control && event.code === 'KeyY') {
      this.redo();
      return true;
    }
    if (control || event.altKey) return false;
    const at = this.selected;
    if (!at) return false;
    const { board } = this;
    if (ARROWS[event.code]) this.change(rollDie(board, at.x, at.z, ARROWS[event.code]));
    else if (event.code === 'KeyH') this.change(toggleHole(board, at.x, at.z));
    else if (event.code === 'KeyP') this.change(setStart(board, at.x, at.z));
    else if (event.code === 'KeyL') this.change(cycleLeaving(board, at.x, at.z, this.sink));
    else if (event.code === 'Delete' || event.code === 'Backspace') this.change(clearCell(board, at.x, at.z));
    else return false;
    return true;
  }

  /** Where the board lies on the canvas, in the pixels of the page: its corner and the side of a cell. */
  private frame(): { left: number; top: number; cell: number } {
    const { clientWidth: width, clientHeight: height } = this.canvas;
    const margin = 28;
    const cell = Math.max(8, Math.floor(Math.min(width - margin * 2, height - margin * 2) / this.board.size));
    return { left: Math.round((width - cell * this.board.size) / 2), top: Math.round((height - cell * this.board.size) / 2), cell };
  }

  private cellOf(event: MouseEvent): { x: number; z: number } | null {
    const box = this.canvas.getBoundingClientRect();
    const { left, top, cell } = this.frame();
    const x = Math.floor((event.clientX - box.left - left) / cell);
    const z = Math.floor((event.clientY - box.top - top) / cell);
    return cellAt(this.board, x, z) ? { x, z } : null;
  }

  draw(): void {
    const { canvas, palette, board } = this;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, width, height);
    const { left, top, cell } = this.frame();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // The numbers of the columns and of the rows: a move is written `x,z,D`.
    ctx.fillStyle = palette.dim;
    ctx.font = `12px ${PROGRAM_FONT}`;
    for (let at = 0; at < board.size; at++) {
      ctx.fillText(String(at), left + at * cell + cell / 2, top - 12);
      ctx.fillText(String(at), left - 12, top + at * cell + cell / 2);
    }
    board.cells.forEach((row, z) =>
      row.forEach((sign, x) => {
        const cx = left + x * cell;
        const cy = top + z * cell;
        if (sign.kind === 'hole') {
          ctx.fillStyle = mixHex(palette.bg, palette.dim, 0.22);
          ctx.fillRect(cx + 1, cy + 1, cell - 2, cell - 2);
          return;
        }
        ctx.lineWidth = 1;
        ctx.strokeStyle = palette.faint;
        ctx.strokeRect(cx + 0.5, cy + 0.5, cell - 1, cell - 1);
        if (sign.kind === 'empty') {
          if (sign.floorStart) this.ring(ctx, cx + cell / 2, cy + cell / 2, cell * 0.18);
          return;
        }
        const colour = palette.channels[sign.top - 1];
        const inset = Math.max(3, Math.round(cell * 0.09));
        ctx.globalAlpha = sign.leaving ? 0.5 : 1;
        ctx.lineWidth = 2;
        ctx.strokeStyle = colour;
        ctx.strokeRect(cx + inset, cy + inset, cell - inset * 2, cell - inset * 2);
        if (sign.fixed) {
          ctx.lineWidth = 1;
          ctx.strokeRect(cx + inset * 2 - 0.5, cy + inset * 2 - 0.5, cell - inset * 4 + 1, cell - inset * 4 + 1);
        }
        ctx.fillStyle = colour;
        ctx.font = `${Math.round(cell * 0.44)}px ${PROGRAM_FONT}`;
        ctx.fillText(String(sign.top), cx + cell / 2, cy + cell * 0.56);
        ctx.fillStyle = palette.dim;
        ctx.font = `${Math.max(10, Math.round(cell * 0.2))}px ${PROGRAM_FONT}`;
        ctx.fillText(String(sign.north), cx + cell / 2, cy + inset * 2 + cell * 0.1);
        ctx.globalAlpha = 1;
        if (sign.leaving) {
          ctx.fillStyle = palette.signal;
          ctx.fillText(`~${sign.leaving}`, cx + cell - inset * 2 - cell * 0.1, cy + cell - inset * 2 - cell * 0.06);
        }
        if (sign.start) this.ring(ctx, cx + cell / 2, cy + cell / 2, cell * 0.46);
      }),
    );
    if (this.overlay) this.drawOverlay(ctx, this.overlay, left, top, cell);
    if (this.selected) {
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = palette.ink;
      ctx.strokeRect(left + this.selected.x * cell + 1.5, top + this.selected.z * cell + 1.5, cell - 3, cell - 3);
      ctx.setLineDash([]);
    }
  }

  /**
   * The views of the solver over the board. The colours are the interface's: a move that keeps
   * the fewest moves is in the tone of the text, a longer one dim, a dead end in the red of the
   * signal; a die whose change leaves no way is framed in that red, one whose change makes the
   * way longer or shorter in the yellow of the second channel; a spare die is crossed out, dim.
   */
  private drawOverlay(ctx: CanvasRenderingContext2D, overlay: Overlay, left: number, top: number, cell: number): void {
    const { palette } = this;
    for (const { x, z } of overlay.spare) {
      ctx.strokeStyle = palette.dim;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(left + x * cell + cell * 0.12, top + z * cell + cell * 0.12);
      ctx.lineTo(left + x * cell + cell * 0.88, top + z * cell + cell * 0.88);
      ctx.moveTo(left + x * cell + cell * 0.88, top + z * cell + cell * 0.12);
      ctx.lineTo(left + x * cell + cell * 0.12, top + z * cell + cell * 0.88);
      ctx.stroke();
    }
    for (const { x, z, change } of overlay.sensitive) {
      ctx.strokeStyle = change === 'unsolved' ? palette.signal : palette.channels[1];
      ctx.lineWidth = change === 'unsolved' ? 4 : 2;
      ctx.strokeRect(left + x * cell + 3, top + z * cell + 3, cell - 6, cell - 6);
    }
    for (const { x, z } of overlay.changed ?? []) {
      ctx.strokeStyle = palette.ink;
      ctx.lineWidth = 3;
      ctx.strokeRect(left + x * cell + 2, top + z * cell + 2, cell - 4, cell - 4);
    }
    const colours = { par: palette.ink, longer: palette.dim, dead: palette.signal, unknown: palette.faint } as const;
    for (const { x, z, dir, push, keeps } of overlay.arrows) {
      const { dx, dz } = TOWARDS[dir];
      // The arrow lies across the side of the cell the die goes over: half in its own cell, half in the next.
      const fromX = left + (x + 0.5 + dx * 0.3) * cell;
      const fromY = top + (z + 0.5 + dz * 0.3) * cell;
      const toX = left + (x + 0.5 + dx * 0.78) * cell;
      const toY = top + (z + 0.5 + dz * 0.78) * cell;
      const head = cell * 0.13;
      ctx.strokeStyle = ctx.fillStyle = colours[keeps];
      ctx.lineWidth = keeps === 'par' ? 4 : 3;
      ctx.setLineDash(push ? [5, 4] : []);
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX - dx * head, toY - dz * head);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - dx * head * 1.6 - dz * head, toY - dz * head * 1.6 - dx * head);
      ctx.lineTo(toX - dx * head * 1.6 + dz * head, toY - dz * head * 1.6 + dx * head);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** The ring of the start. */
  private ring(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
    ctx.lineWidth = 2;
    ctx.strokeStyle = this.palette.ink;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}
