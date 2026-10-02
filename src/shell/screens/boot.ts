import { bootFrame, type BootFrame, type BootOptions } from '../bootScript';
import type { Kit } from '../kit';
import { CELL_H, CELL_W } from '../layout';
import { drawLogo, logoHeight, logoWidth } from '../logo';
import type { ShellContext, ShellItem, ShellScreen } from '../screen';
import { BOOT_CHECK, BOOT_HEAD, BOOT_SHORT, BOOT_TAIL } from '../text';
import { bootTiming } from '../theme';

/** The widest a line of the check gets, in places. */
const MAX_PLACES = 36;
/** Distance between the lines of the check. */
const LINE_STEP = CELL_H + 4;
const MARGIN = 8;

/**
 * The start of the program: the check of its modules, written from the top left corner as a
 * machine writes it, then the logo alone. Later starts show the logo and one line. Any press
 * passes it.
 */
export class BootScreen implements ShellScreen {
  private start: number | null = null;
  private frame: BootFrame;
  private drawn = '';
  private finished = false;
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
    return [];
  }

  update(timeMs: number): boolean {
    if (this.finished) return false;
    this.start ??= timeMs;
    this.frame = bootFrame(timeMs - this.start, bootTiming(this.context.values), this.options);
    if (this.frame.done) {
      this.finish();
      return false;
    }
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
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.onDone();
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
