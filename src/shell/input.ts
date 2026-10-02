import type { Rect } from '../display/sizing';
import type { Dir4 } from './layout';
import type { ShellItem } from './screen';

export type FocusDir = Dir4;

const KEY_DIR: Record<string, FocusDir> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
};

/** What on the page takes presses of its own while it lies over the shell. */
const FOREIGN = '.overlay, .debug-panel, .lil-gui, button, input, select, textarea, a';

interface Zone {
  id: string;
  rect: Rect;
}

/**
 * The zone a key moves the focus to. It is the nearest one that way among those in line
 * with the present zone; where none is in line, the nearest one that way at all, with a step
 * to the side counted twice. With nothing that way the focus stays.
 */
export function nextFocus(items: readonly Zone[], current: string | null, dir: FocusDir): string | null {
  if (items.length === 0) return null;
  const from = items.find((item) => item.id === current);
  if (!from) return items[0].id;
  const vertical = dir === 'up' || dir === 'down';
  const forward = dir === 'down' || dir === 'right';
  const centre = (rect: Rect) => ({ along: vertical ? rect.y + rect.height / 2 : rect.x + rect.width / 2, side: vertical ? rect.x + rect.width / 2 : rect.y + rect.height / 2 });
  const span = (rect: Rect) => (vertical ? [rect.x, rect.x + rect.width] : [rect.y, rect.y + rect.height]);
  const here = centre(from.rect);
  const [fromStart, fromEnd] = span(from.rect);

  let best: Zone | null = null;
  let bestScore = Infinity;
  let bestInLine = false;
  for (const item of items) {
    if (item === from) continue;
    const there = centre(item.rect);
    const along = forward ? there.along - here.along : here.along - there.along;
    if (along <= 0) continue;
    const [start, end] = span(item.rect);
    const inLine = start < fromEnd && end > fromStart;
    const score = along + (inLine ? 0 : 2 * Math.abs(there.side - here.side));
    if ((inLine && !bestInLine) || (inLine === bestInLine && score < bestScore)) {
      best = item;
      bestScore = score;
      bestInLine = inLine;
    }
  }
  return best ? best.id : from.id;
}

/** The zone under a point of the window. Where zones overlap, the one whose middle is nearest. */
export function zoneAt<T extends Zone>(items: readonly T[], x: number, y: number): T | null {
  let best: T | null = null;
  let bestDistance = Infinity;
  for (const item of items) {
    const { rect } = item;
    if (x < rect.x || x >= rect.x + rect.width || y < rect.y || y >= rect.y + rect.height) continue;
    const distance = Math.hypot(x - (rect.x + rect.width / 2), y - (rect.y + rect.height / 2));
    if (distance < bestDistance) {
      best = item;
      bestDistance = distance;
    }
  }
  return best;
}

/** What the input asks of the shell that owns it. */
export interface InputHost {
  /** The shell is on screen, nothing lies over it and it is not busy answering a press. */
  active(): boolean;
  items(): ShellItem[];
  /** The focus or the pressed zone has changed: the screen has to be drawn again. */
  changed(): void;
  activate(item: ShellItem): void;
  /** Where a key takes the focus, on a screen that says so itself; undefined leaves it to the places of the zones. */
  move(focus: string | null, dir: FocusDir): string | null | undefined;
  back(): void;
  /** Passes a screen that only waits; false where the screen is not of that kind. */
  skip(): boolean;
}

/**
 * Pointer and keyboard of the shell. The listeners are on the window: the page lies over the
 * canvas and takes the events first. A mouse moves the focus as it goes; a zone acts when it
 * is let go inside the zone it was pressed in. A zone that asks for it acts only when it was
 * in focus before the press: the first press steps onto it, the second runs it.
 */
export class ShellInput {
  focus: string | null = null;
  /** The zone the pointer went down in and has not left the screen since. */
  down: string | null = null;

  constructor(private readonly host: InputHost) {
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', () => this.release());
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  /** A new screen: nothing is held, the focus is where the screen wants it. */
  reset(focus: string | null): void {
    this.focus = focus;
    this.down = null;
    this.setCursor(false);
  }

  private taken(e: Event): boolean {
    if (!this.host.active()) return true;
    return e.target instanceof Element && e.target.closest(FOREIGN) !== null;
  }

  private onMove(e: PointerEvent): void {
    if (e.pointerType !== 'mouse') return;
    if (this.taken(e)) {
      this.setCursor(false);
      return;
    }
    const item = zoneAt(this.host.items(), e.clientX, e.clientY);
    this.setCursor(item !== null);
    if (item && !item.passive && item.id !== this.focus) {
      this.focus = item.id;
      this.host.changed();
    }
  }

  private onDown(e: PointerEvent): void {
    if (this.taken(e) || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (this.host.skip()) return;
    const item = zoneAt(this.host.items(), e.clientX, e.clientY);
    if (!item) return;
    // A mouse has already brought the focus here on its way; a finger arrives with the press.
    const stepping = item.confirm === true && item.id !== this.focus;
    if (!item.passive) this.focus = item.id;
    // A press that only steps onto a zone runs nothing when it is let go.
    this.down = stepping ? null : item.id;
    this.host.changed();
  }

  private onUp(e: PointerEvent): void {
    const held = this.down;
    if (held === null) return;
    this.down = null;
    this.host.changed();
    if (this.taken(e)) return;
    const item = zoneAt(this.host.items(), e.clientX, e.clientY);
    if (item && item.id === held) this.host.activate(item);
  }

  private release(): void {
    if (this.down === null) return;
    this.down = null;
    this.host.changed();
  }

  private onKey(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey || this.taken(e)) return;
    if (this.host.skip()) {
      e.preventDefault();
      return;
    }
    const dir = KEY_DIR[e.code];
    if (dir) {
      e.preventDefault();
      const told = this.host.move(this.focus, dir);
      const walked = this.host.items().filter((item) => !item.passive);
      const next = told === undefined ? nextFocus(walked, this.focus, dir) : told;
      if (next !== this.focus) {
        this.focus = next;
        this.host.changed();
      }
    } else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
      e.preventDefault();
      if (e.repeat) return;
      const item = this.host.items().find((candidate) => candidate.id === this.focus);
      if (item) this.host.activate(item);
    } else if (e.code === 'Escape') {
      this.host.back();
    }
  }

  private setCursor(pointer: boolean): void {
    document.documentElement.style.cursor = pointer ? 'pointer' : '';
  }
}
