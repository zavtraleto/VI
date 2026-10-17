import type { Palette } from '../shell/theme';
import { addPlay, writeHead } from './boardsClient';
import type { ToldPlay } from './playWatch';
import { buttonOf, fieldStyle, light } from './workshopListView';
import { VERDICTS, nextInBatch, verdictPatch, type BoardRow, type Verdict } from './workshopLists';

const today = (): string => new Date().toISOString().slice(0, 10);

/** The play asked of: the board, when it was written down, and whether the board was new then. */
export interface AskedPlay {
  name: string;
  at: string;
  wasNew: boolean;
}

/** What the verdict asks of the page it is on. */
export interface VerdictPage {
  say(line: string): void;
  rows(): readonly BoardRow[];
  /** A file changed on the disk is read again, and the board in hand takes its head where it is that one. */
  reread(name: string): Promise<void>;
  open(name: string): Promise<void>;
}

/**
 * The bar of the verdict after a play (docs/VI_Levels_Lab.md, section 4): shown when a play has
 * been written down, three buttons, a line of words and the button that writes them. The verdict
 * is written at once, into the head of the file through the server, and the board in hand keeps
 * its edits: the page reads the head back (`reread`), so that a later save writes the new status.
 */
export class WorkshopVerdict {
  readonly bar = document.createElement('div');
  /** The play last written down, while the owner is asked of it; and the verdict he has chosen and not yet written. */
  play: AskedPlay | null = null;
  private verdict: Verdict | null = null;
  private readonly title = document.createElement('span');
  private readonly buttons = new Map<Verdict, HTMLButtonElement>();
  private readonly words = document.createElement('input');

  constructor(
    private readonly palette: Palette,
    private readonly page: VerdictPage,
  ) {
    const { bar } = this;
    bar.style.cssText = 'display:none;flex-wrap:wrap;gap:6px;align-items:center';
    bar.append(this.title);
    for (const { verdict, label } of VERDICTS) {
      const button = buttonOf(palette, label, () => this.choose(verdict));
      this.buttons.set(verdict, button);
      bar.append(button);
    }
    this.words.placeholder = 'слова о доске; Enter — записать';
    this.words.style.cssText = fieldStyle(palette, 'flex:1;min-width:160px');
    this.words.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      void this.write();
    });
    bar.append(this.words, buttonOf(palette, 'записать', () => void this.write()));
  }

  /** A play was written down: its board is asked of. */
  told(record: ToldPlay, name: string): void {
    void addPlay(name, record).catch((error: Error) => this.page.say(error.message));
    const row = this.page.rows().find((one) => one.name === name);
    this.ask({ name, at: record.at, wasNew: row?.head.status === 'N' });
  }

  /** Begins to ask the verdict of a play, or stops asking: the bar is shown while it is asked. */
  ask(play: AskedPlay | null): void {
    this.play = play;
    this.verdict = null;
    this.words.value = '';
    this.bar.style.display = play ? 'flex' : 'none';
    if (play) this.title.textContent = `${play.name}:`;
    else if (document.activeElement === this.words) this.words.blur();
    this.lightUp();
  }

  /** A key while the verdict is asked; true where it was the verdict's. */
  key(code: string): boolean {
    if (!this.play) return false;
    const chosen = VERDICTS.find((one) => one.keys.includes(code));
    if (chosen) this.choose(chosen.verdict);
    else if ((code === 'Enter' || code === 'NumpadEnter') && this.verdict) void this.write();
    else return false;
    return true;
  }

  /** A verdict is chosen: it is lit, and the line of the words takes the keys next. */
  private choose(verdict: Verdict): void {
    if (!this.play) return;
    this.verdict = verdict;
    this.lightUp();
    this.words.focus();
  }

  private lightUp(): void {
    for (const [verdict, button] of this.buttons) light(this.palette, button, verdict === this.verdict);
  }

  /**
   * The verdict and the words are written into the head of the file (a board of the row keeps R:
   * it gets the verdict as a word, `verdictPatch`), and over the play in `plays.jsonl`. A new
   * board done with, the next board of its batch is opened.
   */
  private async write(): Promise<void> {
    const { play } = this;
    const rows = this.page.rows();
    const row = play && rows.find((one) => one.name === play.name);
    if (!play || !row) return;
    const { verdict } = this;
    const said = this.words.value.replace(/\s+/g, ' ').trim();
    const patch = verdictPatch(row.head.status, verdict, said, today());
    if (!patch) return;
    // The next board is taken before the verdict moves this one out of the new. Words alone leave the board where it is, and the page with it.
    const next = play.wasNew && verdict ? nextInBatch(rows, play.name) : null;
    try {
      await writeHead(play.name, patch);
      await addPlay(play.name, { at: play.at, patch: { ...(verdict ? { verdict } : {}), ...(said ? { words: said } : {}) } });
    } catch (error) {
      return this.page.say((error as Error).message);
    }
    this.ask(null);
    this.page.say(`${play.name}: записано${verdict ? ` — ${VERDICTS.find((one) => one.verdict === verdict)?.label.slice(2)}` : ''}${said ? ', слова' : ''}`);
    // The head of the file is read back at once, so that a save of the edits in hand does not write the old one over it.
    await this.page.reread(play.name);
    if (next) await this.page.open(next);
  }
}
