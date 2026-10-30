import type { Rect } from '../display/sizing';
import { pointCursor } from './cursor';
import type { Dir4 } from './layout';
import type { ShellItem } from './screen';

export type FocusDir = Dir4;

/** A press drawn this far sideways, in CSS pixels, is a swipe; it has to go this many times further sideways than up or down. */
const SWIPE_MIN = 28;
const SWIPE_LEAN = 1.5;

/** The side a press was drawn to, where it was drawn far enough and level enough to be a swipe. */
export function swipeOf(dx: number, dy: number): 'left' | 'right' | null {
  if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * SWIPE_LEAN) return null;
  return dx < 0 ? 'left' : 'right';
}

/**
 * The way a press drawn up or down scrolls, where it was drawn far enough and upright enough: a
 * finger drawn up brings what is below into sight.
 */
export function dragOf(dx: number, dy: number): 'up' | 'down' | null {
  if (Math.abs(dy) < SWIPE_MIN || Math.abs(dy) < Math.abs(dx) * SWIPE_LEAN) return null;
  return dy < 0 ? 'down' : 'up';
}

/**
 * A finger drawn up or down this far, in CSS pixels, and more up or down than sideways, takes a
 * list that goes with it (`drag`); the speed it is let go at is read over this many milliseconds.
 */
const DRAG_MIN = 8;
const FLING_MS = 100;

/** CSS pixels of a line and of a page of the wheel of a mouse that counts in lines or pages. */
const WHEEL_LINE = 16;

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
const FOREIGN = `${import.meta.env.DEV ? '.overlay, .debug-panel, .lil-gui, ' : ''}button, input, select, textarea, a`;

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
  /** Where a swipe that began at a point of the window takes the focus; null or undefined where the screen makes nothing of it. */
  swipe(dir: 'left' | 'right', x: number, y: number): string | null | undefined;
  /** Where a press drawn up or down, or the wheel, so many CSS pixels, takes the focus; null or undefined where nothing scrolls. */
  scroll?(dir: 'up' | 'down', pixels: number, focus: string | null, wheel?: boolean): string | null | undefined;
  /** A finger held and drawn so many CSS pixels up or down since the last time, up counted up: true where a list goes with it. */
  drag?(pixels: number): boolean;
  /** The finger let the list go at so many CSS pixels a millisecond, up counted up. */
  fling?(speed: number): void;
  /** A finger put down: the list stops where it goes on by itself; true where it was moving. */
  hold?(): boolean;
  /** A key asked for a step, and there is nowhere to go that way. */
  stuck(): void;
  back(): void;
  /** Passes a screen that only waits; false where the screen is not of that kind. */
  skip(): boolean;
}

/**
 * Pointer and keyboard of the shell. The listeners are on the window: the page lies over the
 * canvas and takes the events first. A mouse moves the focus as it goes; a zone acts when it
 * is let go inside the zone it was pressed in. A zone that asks for it acts only when it was
 * in focus before the press: the first press steps onto it, the second runs it. A press drawn
 * sideways is offered to the screen as a swipe first, and runs nothing where the screen takes it;
 * a press drawn up or down, and the wheel of a mouse, are offered to it as a scroll. A finger drawn
 * up or down over a list that goes with it moves the list as it goes and lets it go on when it
 * is lifted, and runs nothing.
 */
export class ShellInput {
  focus: string | null = null;
  /** The zone the pointer went down in and has not left the screen since. */
  down: string | null = null;
  /** Where the press that is held began. */
  private from: { x: number; y: number } | null = null;
  /** The focus before the press: a finger that takes a list leaves it as it was. */
  private before: string | null = null;
  /** A finger is moving a list: where it was last, and where it was over the last moments. */
  private dragging: { y: number; trail: { y: number; t: number }[] } | null = null;

  constructor(private readonly host: InputHost) {
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', () => this.release());
    window.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('wheel', (e) => this.onWheel(e), { passive: true });
  }

  /** A new screen: nothing is held, the focus is where the screen wants it. */
  reset(focus: string | null): void {
    this.focus = focus;
    this.down = null;
    this.from = null;
    this.dragging = null;
    this.setCursor(false);
  }

  private taken(e: Event): boolean {
    if (!this.host.active()) return true;
    return e.target instanceof Element && e.target.closest(FOREIGN) !== null;
  }

  private onMove(e: PointerEvent): void {
    if (e.pointerType !== 'mouse') {
      this.onDrag(e);
      return;
    }
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
    this.from = { x: e.clientX, y: e.clientY };
    this.before = this.focus;
    this.dragging = null;
    // A finger put on a list going by itself stops it, and presses nothing.
    if (e.pointerType !== 'mouse' && this.host.hold?.()) return;
    const item = zoneAt(this.host.items(), e.clientX, e.clientY);
    if (!item) return;
    // A mouse has already brought the focus here on its way; a finger arrives with the press.
    const stepping = item.confirm === true && item.id !== this.focus;
    if (!item.passive) this.focus = item.id;
    // A press that only steps onto a zone runs nothing when it is let go.
    this.down = stepping ? null : item.id;
    this.host.changed();
  }

  /** A finger held and moving: once it has gone far enough up or down, a list that takes it goes with it. */
  private onDrag(e: PointerEvent): void {
    const from = this.from;
    if (!from || this.taken(e)) return;
    const now = e.timeStamp;
    if (!this.dragging) {
      const dy = e.clientY - from.y;
      if (Math.abs(dy) < DRAG_MIN || Math.abs(dy) <= Math.abs(e.clientX - from.x)) return;
      if (!this.host.drag?.(-dy)) return;
      // The list has the finger: what it went down on is not pressed, and the focus is where it was.
      this.dragging = { y: e.clientY, trail: [{ y: from.y, t: now - 1 }, { y: e.clientY, t: now }] };
      this.down = null;
      this.focus = this.before;
      this.host.changed();
      return;
    }
    const by = this.dragging.y - e.clientY;
    this.dragging.y = e.clientY;
    this.dragging.trail.push({ y: e.clientY, t: now });
    while (this.dragging.trail.length > 2 && now - this.dragging.trail[0].t > FLING_MS) this.dragging.trail.shift();
    if (by !== 0 && this.host.drag?.(by)) this.host.changed();
  }

  /** The speed, in CSS pixels a millisecond, up counted up, a finger moving a list is lifted at. */
  private flingSpeed(e: PointerEvent): number {
    const trail = this.dragging?.trail ?? [];
    const last = { y: e.clientY, t: e.timeStamp };
    const first = trail.find((point) => last.t - point.t <= FLING_MS) ?? trail[trail.length - 1];
    if (!first || last.t - first.t <= 0) return 0;
    return (first.y - last.y) / (last.t - first.t);
  }

  private onUp(e: PointerEvent): void {
    const held = this.down;
    const from = this.from;
    this.from = null;
    if (this.dragging) {
      // The finger lets the list go: it goes on at the speed it was let go at, and nothing is pressed.
      const speed = this.flingSpeed(e);
      this.dragging = null;
      this.down = null;
      this.host.fling?.(speed);
      this.host.changed();
      return;
    }
    const dir = from && !this.taken(e) ? swipeOf(e.clientX - from.x, e.clientY - from.y) : null;
    const swiped = dir && from ? this.host.swipe(dir, from.x, from.y) : null;
    if (swiped != null) {
      // The screen has taken the swipe: whatever was under the finger is not run.
      this.down = null;
      this.focus = swiped;
      this.host.changed();
      return;
    }
    const lift = from && !this.taken(e) ? dragOf(e.clientX - from.x, e.clientY - from.y) : null;
    const scrolled = lift && from ? this.host.scroll?.(lift, Math.abs(e.clientY - from.y), this.focus) : null;
    if (scrolled != null) {
      // The screen has scrolled: whatever was under the finger is not run.
      this.down = null;
      this.focus = scrolled;
      this.host.changed();
      return;
    }
    if (held === null) return;
    this.down = null;
    this.host.changed();
    if (this.taken(e)) return;
    const item = zoneAt(this.host.items(), e.clientX, e.clientY);
    if (item && item.id === held) this.host.activate(item);
  }

  private onWheel(e: WheelEvent): void {
    // A pinch on a touchpad comes as the wheel with Ctrl held: it is no scroll.
    if (this.taken(e) || e.ctrlKey) return;
    const pixels = e.deltaY * (e.deltaMode === 1 ? WHEEL_LINE : e.deltaMode === 2 ? window.innerHeight : 1);
    if (pixels === 0) return;
    const told = this.host.scroll?.(pixels > 0 ? 'down' : 'up', Math.abs(pixels), this.focus, true);
    if (told == null) return;
    this.focus = told;
    this.host.changed();
  }

  private release(): void {
    this.from = null;
    if (this.dragging) {
      this.dragging = null;
      this.host.fling?.(0);
    }
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
      } else if (!e.repeat) {
        this.host.stuck();
      }
    } else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
      e.preventDefault();
      if (e.repeat) return;
      const item = this.host.items().find((candidate) => candidate.id === this.focus);
      if (item) this.host.activate(item);
    } else if (e.code === 'Escape') {
      // Taken: whoever else listens for this key leaves it alone.
      e.preventDefault();
      this.host.back();
    }
  }

  private setCursor(pointer: boolean): void {
    pointCursor('shell', pointer);
  }
}
