import type { Dir } from '../rules/types';
import { PROGRAM_FONT, paletteAt, shellDefaults, type Palette } from '../shell/theme';
import type { Overlay } from './boardEditor';
import { pickCell, reachOf, type CellPoint } from './cellPick';
import { cellAt, cycleLeaving, emptyBoard, moveDie, putFixed, removeAt, rollDie, setStart, setTop, spinDie, toggleFixed, toggleHole, type EditBoard } from './editBoard';

const ARROWS: Readonly<Record<string, Dir>> = { ArrowUp: 'N', ArrowRight: 'E', ArrowDown: 'S', ArrowLeft: 'W' };
const TOWARDS: Readonly<Record<Dir, { dx: number; dz: number }>> = { N: { dx: 0, dz: -1 }, E: { dx: 1, dz: 0 }, S: { dx: 0, dz: 1 }, W: { dx: -1, dz: 0 } };
/** A press that moves less than this before it is let go is a click, not a drag. */
const DRAG_PX = 4;

/** What is taken from the list to be put on the board, or taken up from the board. */
type Carried = { kind: 'die'; top: number } | { kind: 'fixed' } | { kind: 'player' } | { kind: 'move'; from: { x: number; z: number } };

/** Where a point of the board lies on the page: a cell and a height over the floor, to the pixels of the window. */
export type Project = (x: number, z: number, y?: number) => { x: number; y: number };

/**
 * The board of the lab as it is put together: on the board of the game itself, seen as the
 * player sees it. The scene is the game's; this is a clear layer over it that takes the mouse,
 * finds the cell under it and draws what the game does not: the cell the mouse is over, the die
 * picked, the views of the solver. Which cell is under a point is asked of the view of the game,
 * cell by cell (`project`), since the board is seen from a slant.
 *
 * In the corner at the bottom on the left is the list: six dice by the face on top, a fixed die
 * and the figure of the player. A thing of the list is dragged onto a cell. A die on the board
 * is dragged to another cell, or off the board to take it away; a click picks it; the arrows
 * roll the die picked where it stands and the wheel turns it about its top; `F` fixes it, `L`
 * makes it leave a move later, `H` cuts the cell out or puts it back, `P` puts the start there,
 * `Delete` takes it off. Every one of these is one step to take back (`Ctrl+Z`) and to make
 * again (`Ctrl+Y`).
 *
 * The board itself is `EditBoard` (`editBoard.ts`), and every change is told to whoever made
 * the stage: `onChange` for a change made here, `present` for any board that is to be seen.
 */
export class BoardStage {
  /** The layer over the scene: it takes the mouse and is drawn on. */
  readonly canvas = document.createElement('canvas');
  /** The cell picked: the one the keys change. */
  selected: { x: number; z: number } | null = null;
  /** The moves a die that is leaving has at the most: the `sink` of the board. */
  sink = 2;
  /** The board is shown and not changed: it is a moment of a way, or a file that cannot be read. */
  locked = false;
  private board: EditBoard = emptyBoard(4);
  private before: EditBoard[] = [];
  private after: EditBoard[] = [];
  private overlay: Overlay | null = null;
  private readonly palette: Palette = paletteAt(shellDefaults(), 0);
  private readonly list = document.createElement('div');
  private readonly ghost = document.createElement('div');
  /** The cell the mouse is over, and what is being dragged, if anything is. */
  private hover: { x: number; z: number } | null = null;
  private carried: Carried | null = null;
  /** A press on a die of the board that may yet become a drag. */
  private pressed: { at: { x: number; z: number }; px: number; py: number } | null = null;
  /** The face a fixed die of the list is put with: the face of the die last taken. */
  private lastTop = 2;

  constructor(
    parent: HTMLElement,
    private readonly project: Project,
    private readonly onChange: (board: EditBoard) => void,
    private readonly present: (board: EditBoard) => void,
  ) {
    const { canvas, palette } = this;
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;outline:none;cursor:default;touch-action:none';
    canvas.tabIndex = 0;
    this.ghost.style.cssText = `position:fixed;z-index:950;display:none;pointer-events:none;width:40px;height:40px;margin:-20px 0 0 -20px;box-sizing:border-box;border:2px solid ${palette.ink};color:${palette.ink};font:20px/36px ${PROGRAM_FONT};text-align:center;background:${palette.bg};opacity:0.85`;
    parent.append(canvas, this.buildList(), this.ghost);

    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    canvas.addEventListener('pointerdown', (event) => {
      canvas.focus();
      const cell = this.cellOf(event);
      if (event.button === 2) {
        if (cell) this.change(removeAt(this.board, cell.x, cell.z));
        return;
      }
      if (event.button !== 0 || !cell) return;
      this.selected = cell;
      if (!this.locked && cellAt(this.board, cell.x, cell.z)?.kind === 'die') {
        this.pressed = { at: cell, px: event.clientX, py: event.clientY };
        canvas.setPointerCapture(event.pointerId);
      }
    });
    canvas.addEventListener('pointermove', (event) => {
      this.hover = this.cellOf(event);
      const { pressed } = this;
      if (pressed && !this.carried && Math.hypot(event.clientX - pressed.px, event.clientY - pressed.py) > DRAG_PX) this.carry({ kind: 'move', from: pressed.at }, event);
      if (this.carried) this.moveGhost(event);
    });
    canvas.addEventListener('pointerup', (event) => {
      this.pressed = null;
      if (this.carried) this.drop(event);
    });
    canvas.addEventListener('pointerleave', () => {
      if (!this.carried) this.hover = null;
    });
    canvas.addEventListener(
      'wheel',
      (event) => {
        const cell = this.cellOf(event);
        if (!cell || cellAt(this.board, cell.x, cell.z)?.kind !== 'die') return;
        event.preventDefault();
        this.selected = cell;
        this.change(spinDie(this.board, cell.x, cell.z, event.deltaY > 0 ? 1 : -1));
      },
      { passive: false },
    );
    // A thing of the list is dragged with the mouse wherever it goes: the page is listened to while it is carried.
    window.addEventListener('pointermove', (event) => {
      if (!this.carried || this.carried.kind === 'move') return;
      this.hover = this.cellOf(event);
      this.moveGhost(event);
    });
    window.addEventListener('pointerup', (event) => {
      if (this.carried && this.carried.kind !== 'move') this.drop(event);
    });

    // The layer is drawn every frame: the camera of the game may be on its way, and the cells with it.
    const frame = (): void => {
      window.requestAnimationFrame(frame);
      if (canvas.clientWidth > 0) this.draw();
    };
    window.requestAnimationFrame(frame);
  }

  get current(): EditBoard {
    return this.board;
  }

  /** Puts a board on the stage as the one in hand: it is no change, and nothing before it can be taken back to unless `keepSteps` is said. */
  show(board: EditBoard, keepSteps = false): void {
    this.board = board;
    if (!keepSteps) {
      this.before = [];
      this.after = [];
    }
    if (this.selected && !cellAt(board, this.selected.x, this.selected.z)) this.selected = null;
    this.present(board);
  }

  /** A change of the board: one step to take back. A change that changes nothing is none. */
  change(next: EditBoard): void {
    if (this.locked || next === this.board) return;
    this.before.push(this.board);
    this.after = [];
    this.board = next;
    this.present(next);
    this.onChange(next);
  }

  undo(): void {
    const last = this.before.pop();
    if (!last || this.locked) return;
    this.after.push(this.board);
    this.board = last;
    this.present(last);
    this.onChange(last);
  }

  redo(): void {
    const next = this.after.pop();
    if (!next || this.locked) return;
    this.before.push(this.board);
    this.board = next;
    this.present(next);
    this.onChange(next);
  }

  /** What is drawn over the board of what the solver says; null for nothing. */
  setOverlay(overlay: Overlay | null): void {
    this.overlay = overlay;
  }

  /** A key of the stage; true where it was one of them. */
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
    const { board } = this;
    // The keys that mark a cell act on the cell under the mouse, and on the die picked where the mouse is off the board.
    const at = this.hover ?? this.selected;
    const picked = this.selected;
    if (ARROWS[event.code] && picked) this.change(rollDie(board, picked.x, picked.z, ARROWS[event.code]));
    else if (!at) return false;
    else if (event.code === 'KeyH') this.change(toggleHole(board, at.x, at.z));
    else if (event.code === 'KeyF') this.change(toggleFixed(board, at.x, at.z));
    else if (event.code === 'KeyP') this.change(setStart(board, at.x, at.z));
    else if (event.code === 'KeyL') this.change(cycleLeaving(board, at.x, at.z, this.sink));
    else if (event.code === 'Delete' || event.code === 'Backspace') this.change(removeAt(board, at.x, at.z));
    else return false;
    return true;
  }

  /** The list of what is put on the board: six dice by their top, a fixed die, the figure of the player. */
  private buildList(): HTMLElement {
    const { list, palette } = this;
    list.style.cssText = `position:absolute;left:10px;bottom:10px;display:flex;gap:6px;padding:6px;background:${palette.bg};border:1px solid ${palette.faint}`;
    const item = (label: string, colour: string, title: string, carried: Carried, extra = ''): void => {
      const made = document.createElement('div');
      made.textContent = label;
      made.title = title;
      made.style.cssText = `width:40px;height:40px;box-sizing:border-box;border:2px solid ${colour};color:${colour};font:20px/36px ${PROGRAM_FONT};text-align:center;cursor:grab;user-select:none;touch-action:none;${extra}`;
      made.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || this.locked) return;
        event.preventDefault();
        if (carried.kind === 'die') this.lastTop = carried.top;
        this.carry(carried, event);
      });
      list.append(made);
    };
    for (let top = 1; top <= 6; top++) item(String(top), palette.channels[top - 1], `кость с ${top} сверху`, { kind: 'die', top });
    item('F', palette.ink, 'фиксированная кость: её не катят и не толкают', { kind: 'fixed' }, `outline:1px solid ${palette.ink};outline-offset:-6px;`);
    item('○', palette.ink, 'игрок: на кость или на пол', { kind: 'player' }, 'border-radius:50%;');
    return list;
  }

  private carry(carried: Carried, event: PointerEvent): void {
    this.carried = carried;
    const { ghost, palette } = this;
    const cell = carried.kind === 'move' ? cellAt(this.board, carried.from.x, carried.from.z) : null;
    const top = carried.kind === 'die' ? carried.top : cell && cell.kind === 'die' ? cell.top : carried.kind === 'fixed' ? this.lastTop : 0;
    ghost.textContent = carried.kind === 'player' ? '○' : String(top);
    ghost.style.borderColor = ghost.style.color = top > 0 ? palette.channels[top - 1] : palette.ink;
    ghost.style.borderRadius = carried.kind === 'player' ? '50%' : '0';
    ghost.style.display = 'block';
    this.moveGhost(event);
  }

  private moveGhost(event: PointerEvent): void {
    this.ghost.style.left = `${event.clientX}px`;
    this.ghost.style.top = `${event.clientY}px`;
  }

  /** What is carried is let go: over a cell it is put there, and a die of the board let go off the board is taken away. */
  private drop(event: PointerEvent): void {
    const { carried, board } = this;
    this.carried = null;
    this.ghost.style.display = 'none';
    if (!carried) return;
    const cell = this.cellOf(event);
    if (!cell) {
      if (carried.kind === 'move') this.change(removeAt(board, carried.from.x, carried.from.z));
      return;
    }
    this.selected = cell;
    if (carried.kind === 'die') this.change(setTop(board, cell.x, cell.z, carried.top));
    else if (carried.kind === 'fixed') this.change(putFixed(board, cell.x, cell.z, this.lastTop));
    else if (carried.kind === 'player') this.change(setStart(board, cell.x, cell.z));
    else this.change(moveDie(board, carried.from, cell));
  }

  /**
   * Where the cells of the square lie on the page: every cell by the middle of its floor, and a
   * cell with a die by the middle of the die as well, since a die is pointed at by its body and
   * not by the floor under it.
   */
  private points(): { floor: CellPoint[]; all: CellPoint[] } {
    const floor: CellPoint[] = [];
    const dice: CellPoint[] = [];
    for (let z = 0; z < this.board.size; z++) {
      for (let x = 0; x < this.board.size; x++) {
        const low = this.project(x, z, 0);
        floor.push({ x, z, px: low.x, py: low.y });
        if (this.board.cells[z][x].kind !== 'die') continue;
        const body = this.project(x, z, 0.6);
        dice.push({ x, z, px: body.x, py: body.y });
      }
    }
    // The dice come first: of a die and the floor of the cell behind it, as near one as the other, the die is the one seen.
    return { floor, all: [...dice, ...floor] };
  }

  private cellOf(event: { clientX: number; clientY: number }): { x: number; z: number } | null {
    const box = this.canvas.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) return null;
    const { floor, all } = this.points();
    return pickCell(all, { px: event.clientX, py: event.clientY }, reachOf(floor));
  }

  /** The outline of a cell at a height, as the path of the layer. */
  private outline(ctx: CanvasRenderingContext2D, box: DOMRect, x: number, z: number, y: number, inset = 0): void {
    const half = 0.5 - inset;
    const corners = [[-half, -half], [half, -half], [half, half], [-half, half]].map(([dx, dz]) => this.project(x + dx, z + dz, y));
    ctx.beginPath();
    corners.forEach((corner, index) => (index === 0 ? ctx.moveTo(corner.x - box.left, corner.y - box.top) : ctx.lineTo(corner.x - box.left, corner.y - box.top)));
    ctx.closePath();
  }

  /** The height a mark on a cell is drawn at: on top of its die, or on the floor. */
  private heightAt(x: number, z: number): number {
    return cellAt(this.board, x, z)?.kind === 'die' ? 1 : 0;
  }

  draw(): void {
    const { canvas, palette, board } = this;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const box = canvas.getBoundingClientRect();
    ctx.lineJoin = 'round';

    // What the scene of the game does not say of a board being drawn: the marks of a file.
    board.cells.forEach((row, z) =>
      row.forEach((cell, x) => {
        if (cell.kind !== 'die' || (!cell.fixed && !cell.leaving)) return;
        const at = this.project(x, z, 1.25);
        ctx.fillStyle = cell.leaving ? palette.signal : palette.ink;
        ctx.font = `13px ${PROGRAM_FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(`${cell.fixed ? 'F' : ''}${cell.leaving ? `~${cell.leaving}` : ''}`, at.x - box.left, at.y - box.top);
      }),
    );

    const { overlay } = this;
    if (overlay) {
      for (const { x, z } of overlay.spare) {
        ctx.strokeStyle = palette.dim;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        this.outline(ctx, box, x, z, 1, 0.12);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      for (const { x, z, change } of overlay.sensitive) {
        ctx.strokeStyle = change === 'unsolved' ? palette.signal : palette.channels[1];
        ctx.lineWidth = change === 'unsolved' ? 4 : 2;
        this.outline(ctx, box, x, z, 1, 0.06);
        ctx.stroke();
      }
      for (const { x, z } of overlay.changed ?? []) {
        ctx.strokeStyle = palette.ink;
        ctx.lineWidth = 3;
        this.outline(ctx, box, x, z, this.heightAt(x, z));
        ctx.stroke();
      }
      const colours = { par: palette.ink, longer: palette.dim, dead: palette.signal, unknown: palette.faint } as const;
      for (const { x, z, dir, push, keeps } of overlay.arrows) {
        const { dx, dz } = TOWARDS[dir];
        // The arrow lies on top of the die, from its middle to its edge on the side it goes to.
        const from = this.project(x + dx * 0.1, z + dz * 0.1, 1.02);
        const to = this.project(x + dx * 0.62, z + dz * 0.62, 1.02);
        const fx = from.x - box.left;
        const fy = from.y - box.top;
        const tx = to.x - box.left;
        const ty = to.y - box.top;
        const length = Math.hypot(tx - fx, ty - fy) || 1;
        const ux = (tx - fx) / length;
        const uy = (ty - fy) / length;
        const head = Math.max(6, length * 0.3);
        ctx.strokeStyle = ctx.fillStyle = colours[keeps];
        ctx.lineWidth = keeps === 'par' ? 5 : 3;
        ctx.setLineDash(push ? [5, 4] : []);
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(tx - ux * head, ty - uy * head);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx - ux * head - uy * head * 0.6, ty - uy * head + ux * head * 0.6);
        ctx.lineTo(tx - ux * head + uy * head * 0.6, ty - uy * head - ux * head * 0.6);
        ctx.closePath();
        ctx.fill();
      }
    }

    if (this.selected) {
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = palette.ink;
      this.outline(ctx, box, this.selected.x, this.selected.z, this.heightAt(this.selected.x, this.selected.z));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (this.hover && !this.locked) {
      ctx.lineWidth = this.carried ? 3 : 1;
      ctx.strokeStyle = this.carried ? palette.ink : palette.dim;
      this.outline(ctx, box, this.hover.x, this.hover.z, this.carried ? 0 : this.heightAt(this.hover.x, this.hover.z));
      ctx.stroke();
    }
  }
}
