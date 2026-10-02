import type { Size } from '../display/sizing';
import { CELL_H, type Box } from '../shell/layout';

/** The parts of the window a transmission opens in, in pixels of the interface's picture. */
export interface WindowLayout {
  /** The whole window, outline included. */
  frame: Box;
  /** The filled bar at the top with the name of the file. */
  title: Box;
  /** Where the picture is. */
  content: Box;
  /** The row of readings at the bottom. */
  status: Box;
}

/** A row of text with a dot of air above and below it. */
export const BAR = CELL_H + 2;
const BORDER = 1;
/** The window never touches the edge of the screen. */
const MARGIN = 4;
/** The smallest window shows its picture four wide to three high. */
const SMALL_ASPECT = 4 / 3;
/** How much of the screen the smallest window takes, across a tall screen and down a wide one. */
const SMALL_ACROSS = 0.96;
const SMALL_DOWN = 0.68;

/** Where on the screen a window stands, each way from 0 to 1; a half is the middle. */
export interface WindowPlace {
  x: number;
  y: number;
}

/**
 * Where the window stands. It grows with the contact, 0..1, until it fills the screen — the
 * stronger the link, the worse the program holds what arrives inside a frame. A window that
 * does not fill the screen stands wherever `place` puts it in the room that is left.
 */
export function windowLayout(picture: Size, contact: number, place: WindowPlace = { x: 0.5, y: 0.5 }): WindowLayout {
  const t = Math.min(1, Math.max(0, contact));
  const chrome = BAR * 2 + BORDER * 2;
  const maxW = Math.max(1, picture.width - MARGIN * 2);
  const maxH = Math.max(chrome + 1, picture.height - MARGIN * 2);
  const smallH = Math.min((maxH - chrome) * SMALL_DOWN, (maxW * SMALL_ACROSS - BORDER * 2) / SMALL_ASPECT);
  const smallW = smallH * SMALL_ASPECT + BORDER * 2;
  const w = Math.round(smallW + (maxW - smallW) * t);
  const h = Math.round(smallH + chrome + (maxH - smallH - chrome) * t);
  const at = (free: number, share: number): number => MARGIN + Math.round(Math.max(0, free) * Math.min(1, Math.max(0, share)));
  const x = at(maxW - w, place.x);
  const y = at(maxH - h, place.y);
  return {
    frame: { x, y, w, h },
    title: { x: x + BORDER, y: y + BORDER, w: w - BORDER * 2, h: BAR },
    content: { x: x + BORDER, y: y + BORDER + BAR, w: w - BORDER * 2, h: h - chrome },
    status: { x: x + BORDER, y: y + h - BORDER - BAR, w: w - BORDER * 2, h: BAR },
  };
}
