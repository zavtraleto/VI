/** Extents of the scene along the camera's right and up axes. */
export interface FrameBounds {
  /** Left and right ends of the cells. */
  minR: number;
  maxR: number;
  /** Bottom of the slab, and the top of a die with the figure on it. */
  minU: number;
  maxU: number;
  /** Highest point of the floor: the far corner of the slab. */
  floorU: number;
}

export interface Frame {
  /** Half the height of the orthographic view, in world units. */
  halfHeight: number;
  centreR: number;
  centreU: number;
}

/**
 * Fits the board into a view that is `aspect` times as wide as it is tall.
 *
 * `clear` is the share of the height, from the top, that something else occupies - the
 * tutorial's text. The floor never reaches into it: where the screen has height to spare
 * the board moves down, and where it has none the board is drawn smaller.
 */
export function fitBoard(b: FrameBounds, aspect: number, clear: number, sideMargin: number, margin: number): Frame {
  const centreR = (b.minR + b.maxR) / 2;
  const forWidth = ((b.maxR - b.minR) / 2 + sideMargin) / aspect;
  const forHeight = (b.maxU - b.minU) / 2 + margin;
  const middle = (b.minU + b.maxU) / 2;
  if (clear <= 0) return { halfHeight: Math.max(forWidth, forHeight), centreR, centreU: middle };

  const share = Math.min(clear, 0.7);
  // Tall enough for the floor to start below the clear part and the slab to end above the bottom.
  const forClear = (b.floorU - b.minU + margin) / (2 * (1 - share));
  const halfHeight = Math.max(forWidth, forHeight, forClear);
  // The lowest the view may look for the floor to stay clear, and the highest for the slab to stay in.
  const lowest = b.floorU - halfHeight * (1 - 2 * share);
  const highest = b.minU - margin + halfHeight;
  return { halfHeight, centreR, centreU: Math.min(Math.max(middle, lowest), highest) };
}

/** Size of a cell on screen, in pixels, for a view of this height. */
export function cellPixels(frame: Frame, height: number): number {
  return height / (2 * frame.halfHeight);
}

/** The whole board in view, or the player followed, the middle enlarged and the edges pressed together by a lens. */
export type ViewMode = 'full' | 'follow';
/** What is asked of the view: one of the two, or whichever the size of a cell calls for. */
export type ViewChoice = 'auto' | ViewMode;

export interface ViewAsked {
  /** Named in the address or in the lab: it is taken as it is, over everything else. */
  forced: ViewChoice;
  /** The player keeps the whole board in view. */
  whole: boolean;
  reducedMotion: boolean;
}

/**
 * Which view a board gets. `cell` is the size of a cell with the whole board in view, in CSS
 * pixels: the player is followed where it would be smaller than `minCell`. With motion kept
 * low nothing moves by itself, and the board stays whole.
 */
export function viewMode(cell: number, minCell: number, asked: ViewAsked): ViewMode {
  if (asked.forced !== 'auto') return asked.forced;
  if (asked.whole || asked.reducedMotion) return 'full';
  return cell < minCell ? 'follow' : 'full';
}

const clamp = (value: number, low: number, high: number): number => Math.min(Math.max(value, low), high);

/**
 * The share of the board that fits across the screen at the scale the followed player is seen
 * at. `cell` is the size of a cell with the whole board in view, in CSS pixels: the board is
 * enlarged as far as makes a cell under the player `wanted` pixels, and no farther, so a small
 * board on a small screen gets a weak lens and a large one a strong lens. It never shows less
 * than `least` of the board; with no size wanted, `least` is the share.
 */
export function followFocus(cell: number, wanted: number, least: number): number {
  const share = clamp(least, 0.05, 1);
  return wanted > 0 ? clamp(cell / wanted, share, 1) : share;
}

/** The followed view along one side of the screen: from left to right, or from the bottom up. */
export interface FollowAxis {
  /** Where the point followed stands on the screen, as a share of it from its start. */
  centre: number;
  /** The point of the board that is shown there: the point followed, kept on the board. */
  at: number;
  /** From that point to the two ends of what is drawn, in world units. */
  before: number;
  after: number;
  /** Strength of the lens towards each of them; 0 where the picture is as it is drawn. */
  lensBefore: number;
  lensAfter: number;
}

/** Below this a side of the screen shows nothing. */
const NO_ROOM = 1e-9;

/**
 * The followed view along one side of the screen. The board lies from `low` to `high`; `at`
 * is the point followed; `shown` is how much of the world the screen shows from end to end
 * at the scale the player is seen at.
 *
 * The point followed crosses the screen as it crosses the board, so the screen is a window
 * that moves over the board with the player and never leaves it for the dark: with the player
 * at an end of the board, that end is at the end of the screen. `edge` is the share of the
 * screen the player is kept away from its ends by: at the very end of the board they are that
 * far from the end of the screen, with the dark beside them.
 *
 * A board that fits at that scale stays where it is.
 *
 * `pull` is the lens, 0 to 1: how much of what the window has no room for is drawn anyway
 * and pressed together towards the end of the screen. 0 is no lens: the window shows a part
 * of the board, flat. 1 brings the whole board in, its ends at the ends of the screen.
 */
export function followAxis(low: number, high: number, at: number, shown: number, edge: number, pull: number): FollowAxis {
  const length = Math.max(0, high - low);
  const span = Math.max(shown, NO_ROOM);
  const drawn = clamp(pull, 0, 1);
  const point = clamp(at, low, high);
  const share = length > 0 ? (point - low) / length : 0.5;
  // How far the point goes over the screen while it goes over the board. A board that fits
  // goes over its own length of the screen: the board stays where it is.
  const travel = Math.min(length / span, 1 - 2 * clamp(edge, 0, 0.5));
  const centre = 0.5 + (share - 0.5) * travel;
  const side = (room: number, toEnd: number): [reach: number, lens: number] => {
    // What this side of the screen shows at the scale of the player.
    const plain = room * span;
    const reach = plain + drawn * Math.max(0, toEnd - plain);
    return [reach, plain > NO_ROOM ? reach / plain - 1 : 0];
  };
  const [before, lensBefore] = side(centre, point - low);
  const [after, lensAfter] = side(1 - centre, high - point);
  return { centre, at: point, before, after, lensBefore, lensAfter };
}

/** The followed view: what the camera draws, where the player is in it, and the lens over it. */
export interface FollowFrame {
  /** The point of the board the view is about: the point followed, kept on the board. */
  at: { r: number; u: number };
  /** From that point to each edge of what the camera draws, in world units. */
  left: number;
  right: number;
  down: number;
  up: number;
  /** Half the height the screen shows at the scale of the player, in world units. */
  halfHeight: number;
  /** Where that point stands on the screen, as shares of it from its left and its bottom. */
  centre: { x: number; y: number };
  /** Strength of the lens towards each side; all 0 with no lens. */
  lens: { left: number; right: number; bottom: number; top: number };
  /**
   * How many times the lens enlarges the middle of what is drawn, side to side and bottom to
   * top: drawn that much denser, the middle is as sharp as with no lens. 1 with no lens. It
   * does not change with the point followed.
   */
  dense: { x: number; y: number };
}

/**
 * The frame of the followed view, `aspect` times as wide as it is tall. The player is seen
 * at a scale at which `focus` of the board fits, counted along the side of the screen that
 * the whole board is fitted to. Each side of the screen is worked out by `followAxis`.
 */
export function followFrame(
  b: FrameBounds,
  aspect: number,
  focus: number,
  edge: number,
  pull: number,
  target: { r: number; u: number },
  sideMargin: number,
  margin: number,
): FollowFrame {
  const halfHeight = fitBoard(b, aspect, 0, sideMargin, margin).halfHeight * clamp(focus, 0.05, 1);
  const halfWidth = halfHeight * aspect;
  const [lowR, highR] = [b.minR - sideMargin, b.maxR + sideMargin];
  const [lowU, highU] = [b.minU - margin, b.maxU + margin];
  const across = followAxis(lowR, highR, target.r, halfWidth * 2, edge, pull);
  const along = followAxis(lowU, highU, target.u, halfHeight * 2, edge, pull);
  const drawn = clamp(pull, 0, 1);
  const dense = (length: number, shown: number): number => 1 + drawn * Math.max(0, length / shown - 1);
  return {
    at: { r: across.at, u: along.at },
    left: across.before,
    right: across.after,
    down: along.before,
    up: along.after,
    halfHeight,
    centre: { x: across.centre, y: along.centre },
    lens: { left: across.lensBefore, right: across.lensAfter, bottom: along.lensBefore, top: along.lensAfter },
    dense: { x: dense(highR - lowR, halfWidth * 2), y: dense(highU - lowU, halfHeight * 2) },
  };
}

/** How many times its own time constant the camera is given to come up with its target. */
const FOLLOW_RATE = 4;

/**
 * One step of a value that goes after a target as a spring that never swings: it comes up
 * with the target and stops there. `speed` is in units a millisecond. After `followMs` it has
 * covered nine tenths of the way to a target that stands still.
 */
export function follow(at: number, speed: number, target: number, dtMs: number, followMs: number): { at: number; speed: number } {
  if (!(followMs > 0)) return { at: target, speed: 0 };
  if (!(dtMs > 0)) return { at, speed };
  const rate = FOLLOW_RATE / followMs;
  const off = at - target;
  const pull = speed + rate * off;
  const decay = Math.exp(-rate * dtMs);
  return { at: target + (off + pull * dtMs) * decay, speed: (speed - rate * pull * dtMs) * decay };
}
