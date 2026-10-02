import type { Layer } from '../display/layer';
import type { Rect, Size } from '../display/sizing';
import type { ParamValues } from '../signal/scene';
import type { Kit } from './kit';
import type { Dir4, Insets } from './layout';
import type { Palette } from './theme';
import type { Voice } from './voice';

/** A zone of a screen that can be pressed. */
export interface ShellItem {
  id: string;
  /** The zone in CSS pixels of the window. */
  rect: Rect;
  action: () => void;
  /** The first press only brings the focus here; the zone acts when it is pressed while in focus. */
  confirm?: boolean;
  /** The zone acts but never takes the focus: a bar that runs whatever is in focus. */
  passive?: boolean;
}

/** Which zones the player is at: what a screen needs to draw them. */
export interface ShellFocus {
  /** The zone the keyboard or the mouse is on. */
  focus: string | null;
  /** The zone that is held down, or has just been let go and is answering. */
  pressed: string | null;
}

/** What a screen is given to lay itself out. */
export interface ShellContext {
  readonly values: ParamValues;
  /** The window in CSS pixels. */
  window(): Size;
  /** The picture of the interface in its own pixels. */
  picture(): Size;
  /** What the edges of the screen keep to themselves, in pixels of the picture. */
  safe(): Insets;
  reducedMotion(): boolean;
  /** Prose in the language of the player: a screen says it while it draws. */
  readonly voice: Voice;
}

export interface ShellScreen {
  /** The zone in focus when the screen opens. */
  readonly home?: string;
  /** The zones at the present size of the window, in the order the keyboard walks them. */
  items(): ShellItem[];
  /** Returns true when the picture has to be drawn again. */
  update(timeMs: number): boolean;
  draw(kit: Kit, focus: ShellFocus): void;
  /**
   * Draws again the small part of the picture that moves by itself — a clock, a level — over
   * the picture as it stands, without drawing the rest. Returns true when it has drawn.
   * Called on the frames `update` has asked nothing of.
   */
  tick?(kit: Kit, timeMs: number): boolean;
  /** Where a key takes the focus from a zone, on a screen that knows better than the places of its zones. */
  move?(focus: string | null, dir: Dir4): string | null;
  /** Esc and the system's "back". */
  back?(): void;
  /** Any press or key, on a screen that only waits to be passed. */
  skip?(): void;
  /**
   * Draws what the screen has in three dimensions into the layer under the text, over the dark
   * of the tube. Returns false when it has nothing of the kind.
   */
  scene?(layer: Layer, palette: Palette, focus: ShellFocus, timeMs: number): boolean;
  /** The screen is gone: what it kept on the graphics card is freed. */
  dispose?(): void;
}
