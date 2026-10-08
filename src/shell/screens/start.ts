import type { Kit } from '../kit';
import { CELL_H, MIN_ZONE, textWidth, type Box } from '../layout';
import type { ShellContext, ShellFocus, ShellItem, ShellScreen } from '../screen';
import { word } from '../../ui/i18n';
import { COMMANDS } from '../text';

const START_ID = 'start';
/** The word of the button is written at so many times the size of a line. */
const SCALE = 2;
/** Room kept on each side of the word, for the mark of the seventh on the left. */
const PAD = 24;
const MARGIN = 8;

const ceilTo = (value: number, step: number): number => Math.ceil(value / step) * step;

/**
 * What the program opens on once it has started: the board that waits, stepped back as it is
 * under the pause, and over it one command, START, in the language of the player. It is the
 * filled command of a panel with the red mark of the seventh on it, at twice the size: two
 * fingers tall and half the scene wide, wider where its word asks for it. Nothing else is on
 * the screen.
 */
export class StartScreen implements ShellScreen {
  readonly home = START_ID;

  constructor(
    private readonly context: ShellContext,
    private readonly onStart: () => void,
  ) {}

  items(): ShellItem[] {
    const window = this.context.window();
    const picture = this.context.picture();
    const sx = window.width / Math.max(1, picture.width);
    const sy = window.height / Math.max(1, picture.height);
    const box = this.box();
    return [{ id: START_ID, rect: { x: box.x * sx, y: box.y * sy, width: box.w * sx, height: box.h * sy }, action: this.onStart }];
  }

  update(): boolean {
    return false;
  }

  draw(kit: Kit, focus: ShellFocus): void {
    const { bg, ink, signal } = kit.palette;
    const box = this.box();
    kit.veil();
    const name = word(COMMANDS.start.name);
    const full = `${COMMANDS.start.native} ${name}`;
    // A narrow button has room for the name alone.
    const label = kit.measure(full, SCALE) > box.w - 2 * PAD ? name : full;
    const y = box.y + Math.round((box.h - CELL_H * SCALE) / 2);
    if (focus.pressed === START_ID) {
      kit.box(box, bg);
      kit.frame(box, ink);
      kit.text(label, box.x + box.w / 2, y, ink, { align: 'center', scale: SCALE });
    } else {
      kit.box(box, ink);
      kit.text(label, box.x + box.w / 2, y, bg, { align: 'center', scale: SCALE, bold: true });
    }
    kit.rect(box.x + 8, box.y + Math.round(box.h / 2) - 4, 8, 8, signal);
  }

  /** Where the button stands, in pixels of the picture: in the middle of what the edges of the screen leave. */
  private box(): Box {
    const picture = this.context.picture();
    const safe = this.context.safe();
    const zoom = this.context.window().height / Math.max(1, picture.height);
    const room = picture.width - safe.left - safe.right;
    const wordWidth = textWidth(word(COMMANDS.start.name), SCALE);
    const w = Math.min(room - 2 * MARGIN, Math.max(Math.round(picture.width / 2), wordWidth + 2 * PAD));
    const h = Math.max(CELL_H * SCALE + 16, ceilTo((2 * MIN_ZONE) / Math.max(0.1, zoom), 4));
    return {
      x: Math.round(safe.left + (room - w) / 2),
      y: Math.round(safe.top + (picture.height - safe.top - safe.bottom - h) / 2),
      w,
      h,
    };
  }
}
