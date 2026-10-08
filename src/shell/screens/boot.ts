import { bootFrame, type BootFrame, type BootOptions } from '../bootScript';
import type { Kit } from '../kit';
import { CELL_H, CELL_W, MIN_ZONE, textWidth, type Box } from '../layout';
import { drawLogo, logoHeight, logoWidth } from '../logo';
import type { ShellContext, ShellItem, ShellScreen } from '../screen';
import { word } from '../../ui/i18n';
import { BOOT_CHECK, BOOT_HEAD, BOOT_SHORT, BOOT_TAIL, COMMANDS } from '../text';
import { bootTiming } from '../theme';

/** The widest a line of the check gets, in places. */
const MAX_PLACES = 36;
/** Distance between the lines of the check. */
const LINE_STEP = CELL_H + 4;
const MARGIN = 8;
const SKIP_ID = 'skip';
/** Room the command that passes the boot keeps before its words, for the mark of the seventh. */
const SKIP_MARK = 10;

/**
 * The start of the program: the check of its modules, written from the top left corner as a
 * machine writes it, then the logo alone. Later starts show the logo and one line. Any press
 * passes it; the first start, which is long, says so with a small command in the bottom right
 * corner.
 */
export class BootScreen implements ShellScreen {
  private start: number | null = null;
  private frame: BootFrame;
  private drawn = '';
  private finished = false;
  /** What of the boot has been said already. */
  private heard = { labels: 0, values: 0, logo: false };
  private readonly options: BootOptions;

  constructor(
    private readonly context: ShellContext,
    first: boolean,
    private readonly onDone: () => void,
  ) {
    this.options = { first, reduced: context.reducedMotion(), rows: BOOT_CHECK.length };
    this.frame = bootFrame(0, bootTiming(context.values), this.options);
  }

  items(): ShellItem[] {
    if (!this.options.first) return [];
    const window = this.context.window();
    const picture = this.context.picture();
    const sx = window.width / Math.max(1, picture.width);
    const sy = window.height / Math.max(1, picture.height);
    const box = this.skipBox();
    // Any press passes the boot before a zone is asked: the zone is where the command is, for the pointer of a mouse.
    return [{ id: SKIP_ID, rect: { x: box.x * sx, y: box.y * sy, width: box.w * sx, height: box.h * sy }, action: () => this.skip() }];
  }

  update(timeMs: number): boolean {
    if (this.finished) return false;
    this.start ??= timeMs;
    this.frame = bootFrame(timeMs - this.start, bootTiming(this.context.values), this.options);
    if (this.frame.done) {
      this.finish();
      return false;
    }
    this.hear(this.frame);
    const { labels, values, tail, logo, line } = this.frame;
    const key = `${labels}/${values}/${tail}/${logo > 0}/${line}`;
    if (key === this.drawn) return false;
    this.drawn = key;
    return true;
  }

  skip(): void {
    this.finish();
  }

  draw(kit: Kit): void {
    const frame = this.frame;
    kit.fill(kit.palette.bg);
    if (frame.logo > 0) this.drawLogo(kit, frame);
    else if (frame.labels > 0) this.drawCheck(kit, frame);
    if (this.options.first) this.drawSkip(kit);
  }

  /** The name alone, in the language of the player: with the program's own word before it the command is no longer small on a phone. */
  private skipLabel(): string {
    return word(COMMANDS.skip.name);
  }

  /** Where the command that passes the boot stands, in pixels of the picture: as tall as a finger needs, its words at its bottom right. */
  private skipBox(): Box {
    const picture = this.context.picture();
    const safe = this.context.safe();
    const zoom = this.context.window().height / Math.max(1, picture.height);
    const w = SKIP_MARK + textWidth(this.skipLabel()) + MARGIN;
    const h = Math.max(CELL_H + MARGIN, Math.ceil(MIN_ZONE / Math.max(0.1, zoom)));
    return { x: Math.floor(picture.width - safe.right - w), y: Math.floor(picture.height - safe.bottom - h), w, h };
  }

  /** The command that passes the boot: a line no brighter than the head of the check, with the mark of the seventh before it. */
  private drawSkip(kit: Kit): void {
    const box = this.skipBox();
    const y = box.y + box.h - MARGIN - CELL_H;
    kit.rect(box.x, y + Math.round(CELL_H / 2) - 2, 5, 5, kit.palette.signal);
    kit.text(this.skipLabel(), box.x + SKIP_MARK, y, kit.palette.dim);
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    // A boot that is passed before its logo still says the name of the program.
    if (!this.heard.logo) {
      this.heard.logo = true;
      this.context.sound({ kind: 'logo' });
    }
    this.onDone();
  }

  /** What has come on screen since the last frame is said: a line of the check, its answer, the logo. */
  private hear(frame: BootFrame): void {
    const { heard } = this;
    if (frame.labels > heard.labels) this.context.sound({ kind: 'check' });
    if (frame.values > heard.values) this.context.sound({ kind: 'answer', found: frame.values < this.options.rows });
    if (frame.logo > 0 && !heard.logo) this.context.sound({ kind: 'logo' });
    this.heard = { labels: frame.labels, values: frame.values, logo: frame.logo > 0 };
  }

  private drawCheck(kit: Kit, frame: BootFrame): void {
    const { ink, dim, faint } = kit.palette;
    const safe = this.context.safe();
    const left = Math.ceil(safe.left / CELL_W) * CELL_W + MARGIN;
    const top = Math.ceil(safe.top / 4) * 4 + MARGIN;
    // A narrow picture gets shorter rows of dots, never a line that is cut off.
    const width = Math.min(kit.width - safe.right - MARGIN - left, MAX_PLACES * CELL_W);
    const valueX = left + width - Math.max(...BOOT_CHECK.map(([, value]) => kit.measure(value)));

    kit.text(BOOT_HEAD, left, top, dim);
    const first = top + 2 * LINE_STEP;
    BOOT_CHECK.slice(0, frame.labels).forEach(([label, value], i) => {
      const y = first + i * LINE_STEP;
      const labelEnd = kit.text(label, left, y, ink);
      kit.leader(labelEnd + CELL_W, valueX - CELL_W, y, faint);
      if (i < frame.values) kit.text(value, valueX, y, ink);
    });
    if (frame.tail) kit.text(BOOT_TAIL, left, first + (BOOT_CHECK.length + 1) * LINE_STEP, ink, { bold: true });
  }

  /** The logo in the middle of the screen, with the one line of a later start under it. */
  private drawLogo(kit: Kit, frame: BootFrame): void {
    const { ink, dim } = kit.palette;
    const scale = Math.max(1, Math.round(kit.number('bootLogoScale')));
    const x = Math.round((kit.width - logoWidth(kit, scale)) / 2);
    const y = Math.round((kit.height - logoHeight(scale)) / 2);
    drawLogo(kit, x, y, scale, ink);
    if (frame.line) kit.text(BOOT_SHORT, kit.width / 2, y + logoHeight(scale) + CELL_H, dim, { align: 'center' });
  }
}
