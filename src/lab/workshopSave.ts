import { parseBoard, printBoard, readBoardHead, type BoardHead, type BoardStatus } from '../levels/boardFile';
import type { Place } from '../levels/library';
import type { LevelSpec } from '../rules/types';
import { PROGRAM_FONT, type Palette } from '../shell/theme';
import { writeBoard } from './boardsClient';
import type { BoardStage } from './boardStage';
import { textOf, type EditBoard } from './editBoard';
import type { Seconds } from './labFacts';
import { wayToKeep, type CampaignBoard } from './workshopCampaign';
import type { BoardFacts } from './workshopFacts';
import { buttonOf } from './workshopListView';
import { plural } from './workshopLists';

/** What the state line over the field is said of: the board in hand, where it stands, and its edits. */
export interface StateOf {
  name: string;
  status: BoardStatus | undefined;
  /** Its place in the row, as the player meets it; null where it has none. */
  place: Place | null;
  /** The batch it was laid in, `bridge 2026-10-16`. */
  batch: string | undefined;
  /** The edits made since it was saved or opened. */
  unsaved: number;
  /** Its file was changed from outside while the edits stood. */
  outside: boolean;
  /** Its file cannot be read as a board: the page writes nothing of it. */
  locked: boolean;
}

const STATUS_WORDS: Readonly<Record<Exclude<BoardStatus, 'R' | 'N'>, string>> = { D: 'черновик', RC: 'хорошая', X: 'убрана' };

/**
 * The state line over the field, three short lines: which board, and where it stands; whether it is
 * saved; and what saving will do. A board of the row is said as the player meets it, by the number
 * of its place and the title of its chapter.
 */
export function stateLine(of: StateOf): string {
  if (of.name === '') return '';
  const { status, place } = of;
  const where =
    status === 'R'
      ? place
        ? `в кампании, уровень ${place.number}, глава «${place.title}»`
        : 'в кампании, без места в row.json'
      : status === 'N'
        ? `новая${of.batch ? `, пачка ${of.batch.split(' ')[0]}` : ''}`
        : status
          ? STATUS_WORDS[status]
          : 'без статуса';
  const saved = of.unsaved === 0 ? 'сохранено' : `не сохранено: ${of.unsaved} ${plural(of.unsaved, ['правка', 'правки', 'правок'])}${of.outside ? '; файл изменён снаружи — сохранить перезапишет его' : ''}`;
  const does = of.locked ? 'файл не читается как доска — страница его не пишет' : status === 'R' && place ? `сохранить — изменит уровень ${place.number} в игре` : 'сохранить — запишет файл доски';
  return `${of.name} — ${where}\n${saved}\n${does}`;
}

/** What saving a board of the row comes to: wait for the solver, refuse with a line, or write the head given. */
export type RowSave = { kind: 'wait' } | { kind: 'refuse'; line: string } | { kind: 'write'; head: LevelSpec };

const TO_COPY = '«копия» унесёт правку рядом, не трогая уровень';

/**
 * A board of the row is saved only with its fewest moves proved, on the board as the player meets
 * it (`seconds`, counted of `WorkshopRow.asPlayed`), and the way is written with the board in one
 * write: the way proved, or the way the head keeps where it holds (`wayToKeep`). `refused` is what
 * the rules say of the board, where they do not take it.
 */
export function rowSave(board: { extra: BoardHead; head: LevelSpec; locked: boolean }, seconds: Seconds | string | null, refused: string | null): RowSave {
  if (board.locked) return { kind: 'refuse', line: 'файл не читается как доска — страница его не пишет' };
  if (refused !== null) return { kind: 'refuse', line: `правила не принимают доску: ${refused} — не сохранено; ${TO_COPY}` };
  if (seconds === null) return { kind: 'wait' };
  if (typeof seconds === 'string') return { kind: 'refuse', line: `решатель не ответил (${seconds}) — не сохранено; ${TO_COPY}` };
  const { par, exact, way } = seconds.check;
  if (par === null && exact) return { kind: 'refuse', line: `у доски нет решения — в кампанию не сохраняется; ${TO_COPY}` };
  if (par === null || !exact || !way || way.length === 0) return { kind: 'refuse', line: `решатель не доказал минимум — не сохранено; ${TO_COPY}` };
  const proved = wayToKeep({ ...board, extra: { ...board.extra, status: 'R' } }, seconds);
  return { kind: 'write', head: proved ? { ...board.head, ...proved } : board.head };
}

/** The board a save of the row was pressed on: its name, and the board and head drawn then. */
export interface Proof {
  name: string;
  board: EditBoard;
  head: LevelSpec;
}

/**
 * A save of a board of the row while its proof is counted: the stage is locked, and the very board
 * the save was pressed on is written (`rowSave`). Another board in hand (opened, read again, or the
 * board or head changed by anything) drops the save; names are compared in any letters.
 */
export function provedSave(at: Proof, now: Proof & { extra: BoardHead; locked: boolean }, seconds: Seconds | string | null, refused: string | null): RowSave {
  if (now.name.toLowerCase() !== at.name.toLowerCase() || now.board !== at.board || now.head !== at.head) return { kind: 'refuse', line: 'сохранение прервано: доска в руках сменилась — не сохранено' };
  return rowSave(now, seconds, refused);
}

/** The board of a text without what the library says of it (the status, the words, the mark): null where the text is no board. */
function boardPart(text: string, name: string): string | null {
  try {
    return printBoard(parseBoard(text, name, true));
  } catch {
    return null;
  }
}

/** Whether a file changed from outside changed only in its head: the status, the words, the mark, as a verdict or the row writes them. */
export function headOnly(was: string, now: string, name: string): boolean {
  const board = boardPart(was, name);
  return board !== null && board === boardPart(now, name);
}

/** What saving asks of the page it is on. */
export interface SavePage {
  board(): CampaignBoard;
  /** The place of the board in hand in the row, as the player meets it; null where it has none. */
  place(): Place | null;
  stage(): BoardStage;
  facts(): BoardFacts;
  /** What the rules say of the board in hand where they do not take it; null where they do. */
  refused(): string | null;
  /** The board and head were written: `was` is the head the write was begun with, to be taken over only where it is still the one in hand. */
  wrote(head: LevelSpec, board: EditBoard, was: LevelSpec): void;
  /** The head of the file read again, as a verdict or the row wrote it, laid under the edits in hand. */
  takeHead(extra: BoardHead): void;
  /** Reads the file of the board in hand again and puts it on the stage, as it is opened. */
  reload(): Promise<void>;
}

type Choice = 'save' | 'drop' | 'stay';

/**
 * Saving the board in hand (docs/VI_Levels_Lab.md, section 4): edits stay on the page until
 * «сохранить» or `Ctrl+S` writes them, and «отменить» reads the file again. A board of the row is
 * written only with its fewest moves proved, the way in the same write (`rowSave`). The state line
 * over the field says the board, whether it is saved and what saving will do (`stateLine`). Leaving
 * a board with edits asks in a small dialog of the page (`settle`), and closing the tab asks with
 * the browser's own prompt. A file changed from outside is read again where there are no edits; a
 * change of its head alone is laid under them; any other change is said on the line, and saving
 * writes over it.
 */
export class WorkshopSave {
  readonly line = document.createElement('div');
  readonly saveButton: HTMLButtonElement;
  readonly cancelButton: HTMLButtonElement;
  /** The text the file is known to hold. */
  file = '';
  /** The board and head as the file holds them: the edits are what the board in hand differs from them by. */
  private base: { board: EditBoard; head: LevelSpec } | null = null;
  /** Changes of the head (the faces, the rules of the board) since the board was saved: they are no steps of the stage. */
  private headEdits = 0;
  private outside = false;
  /** How many times a file was put on the stage: a write that comes back after another is no write of the board in hand. */
  private loads = 0;
  /** What the last save said, or the stage: why it was refused, «сначала убери кость». */
  private note = '';
  /** A save of a board of the row waits for its proof, the stage locked: the board it was pressed on, and whether it is being written. */
  private proving: { promise: Promise<boolean>; resolve: (saved: boolean) => void; at: Proof; writing: boolean } | null = null;
  private readonly dialog = document.createElement('div');
  private readonly asked = document.createElement('div');
  private answer: ((choice: Choice) => void) | null = null;

  constructor(
    palette: Palette,
    private readonly page: SavePage,
  ) {
    this.line.style.cssText = 'flex:1;min-width:240px;white-space:pre-line';
    this.saveButton = buttonOf(palette, 'сохранить (Ctrl+S)', () => void this.save());
    this.cancelButton = buttonOf(palette, 'отменить', () => void this.cancel());
    this.dialog.style.cssText = 'position:fixed;inset:0;z-index:990;display:none;align-items:center;justify-content:center';
    const box = document.createElement('div');
    box.style.cssText = `display:flex;flex-direction:column;gap:10px;padding:14px 16px;max-width:420px;background:${palette.bg};color:${palette.ink};border:1px solid ${palette.ink};font:13px/1.4 ${PROGRAM_FONT}`;
    this.asked.style.whiteSpace = 'pre-line';
    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;gap:6px';
    const choice = (label: string, chosen: Choice): HTMLButtonElement => buttonOf(palette, label, () => this.answer?.(chosen));
    buttons.append(choice('сохранить', 'save'), choice('отменить правки', 'drop'), choice('остаться', 'stay'));
    box.append(this.asked, buttons);
    this.dialog.append(box);
    document.body.append(this.dialog);
    window.addEventListener('beforeunload', (event) => {
      if (!this.dirty) return;
      event.preventDefault();
      event.returnValue = '';
    });
  }

  /** The board in hand differs from its file: by its cells, or by its head. A file that cannot be read (`locked`) has no edits. */
  get dirty(): boolean {
    const { base } = this;
    const { name, locked, board, head, extra } = this.page.board();
    return base !== null && name !== '' && !locked && textOf(board, head, extra) !== textOf(base.board, base.head, extra);
  }

  /** A board of the row waits for its fewest moves to be proved, to be saved: the solver is asked of it. */
  get waiting(): boolean {
    return this.proving !== null;
  }

  /** The edits since the board was saved or opened. */
  get unsaved(): number {
    return this.dirty ? Math.max(1, this.page.stage().unsaved + this.headEdits) : 0;
  }

  /** The file was read and put on the stage as the board in hand: no edit stands, and a save waiting for its proof is dropped. */
  opened(text: string): void {
    const { board, head } = this.page.board();
    this.loads++;
    this.file = text;
    this.base = { board, head };
    this.headEdits = 0;
    this.outside = false;
    this.note = '';
    this.page.stage().markSaved();
    this.endProof(false, 'сохранение прервано: доска открыта заново — не сохранено');
    this.show();
  }

  /** The board in hand was edited; `head` where its head was, which is no step of the stage. */
  edited(head = false): void {
    if (head) this.headEdits++;
    this.note = '';
    // Taken back to the board saved while its file was changed from outside: the file is read as it is now.
    if (this.outside && !this.dirty) {
      this.outside = false;
      void this.page.reload();
    }
  }

  /** Something the stage or a save says, shown on the line until the next edit. */
  tell(line: string): void {
    this.note = line;
    this.show();
  }

  show(): void {
    const { name, extra, locked } = this.page.board();
    const state = stateLine({ name, status: extra.status, place: this.page.place(), batch: extra.batch, unsaved: this.unsaved, outside: this.outside, locked });
    const note = this.proving ? 'решаю…' : this.note;
    this.line.textContent = note ? `${state}\n${note}` : state;
  }

  /**
   * The file of the board in hand changed on the disk; true where it is to be read again as it is,
   * there being no edits in hand. With edits, a change of its head alone is taken under them, and
   * any other is said: saving writes over it.
   */
  changed(text: string): boolean {
    if (text === this.file) return false;
    if (!this.dirty) return true;
    if (headOnly(this.file, text, this.page.board().name)) this.page.takeHead(readBoardHead(text));
    else this.outside = true;
    this.file = text;
    this.show();
    return false;
  }

  /**
   * «сохранить»: writes the board in hand where it has edits; true where it is written, or there was
   * nothing to write. A board of the row waits for the solver first, and is refused where its fewest
   * moves are not proved: the line says why. While the proof is counted the stage is locked, and
   * the very board the save was pressed on is written (`provedSave`). It is proved with no edits
   * too: a way proved anew on the faces of its chapter, which its file does not keep, is written.
   * A stage locked for a moment (a row operation, a name, a swap) is not saved: it is busy.
   */
  save(): Promise<boolean> {
    if (this.proving) return this.proving.promise;
    const board = this.page.board();
    const stage = this.page.stage();
    if (board.name === '' || board.locked) return Promise.resolve(true);
    if (stage.locked) {
      this.tell('доска занята — подожди');
      return Promise.resolve(false);
    }
    if (board.extra.status !== 'R') return this.dirty ? this.write(board.head) : Promise.resolve(true);
    let resolve: (saved: boolean) => void = () => {};
    const promise = new Promise<boolean>((done) => (resolve = done));
    this.proving = { promise, resolve, at: { name: board.name, board: board.board, head: board.head }, writing: false };
    stage.locked = true;
    this.page.facts().ask();
    this.told();
    return promise;
  }

  /** A fact of the board in hand was counted: a save waiting for the proof is written or refused, and the stage unlocked. */
  told(): void {
    const { proving } = this;
    if (!proving || proving.writing) return;
    const board = this.page.board();
    const decision = provedSave(proving.at, board, this.page.facts().seconds, this.page.refused());
    if (decision.kind === 'wait') return this.show();
    if (decision.kind === 'refuse') return this.endProof(false, decision.line);
    // No edits, and the way the file keeps holds: there is nothing to write.
    if (decision.head === board.head && !this.dirty) return this.endProof(true);
    proving.writing = true;
    void this.write(decision.head).then((saved) => this.endProof(saved));
  }

  /** «отменить»: the board is put back as its file has it, read again; nothing is asked. */
  async cancel(): Promise<void> {
    await this.page.reload();
  }

  /**
   * The board in hand is to be left (another board, a new one, a copy, the row, a name): with edits,
   * the dialog asks whether to save them, drop them or stay. True where the page may go on; `why` is
   * said in the dialog, under the question.
   */
  async settle(why = ''): Promise<boolean> {
    // A save waiting for its proof is the answer: written, the page goes on; refused, it stays.
    if (this.proving) return this.proving.promise;
    if (!this.dirty) return true;
    if (this.answer) return false;
    const { name } = this.page.board();
    const count = this.unsaved;
    this.asked.textContent = `${name}: не сохранено — ${count} ${plural(count, ['правка', 'правки', 'правок'])}${why ? `\n${why}` : ''}`;
    this.dialog.style.display = 'flex';
    const choice = await new Promise<Choice>((done) => (this.answer = done));
    this.answer = null;
    this.dialog.style.display = 'none';
    if (choice === 'stay') return false;
    if (choice === 'save') return this.save();
    await this.cancel();
    return true;
  }

  /** The keys of saving: `Ctrl+S`, and every key while the dialog asks (`Escape` stays). True where the key was one of them. */
  key(event: KeyboardEvent): boolean {
    if (this.answer) {
      event.stopImmediatePropagation();
      if (event.type === 'keydown' && event.code === 'Escape') this.answer('stay');
      return true;
    }
    if (!(event.ctrlKey || event.metaKey) || event.code !== 'KeyS') return false;
    // The browser's own save is never asked.
    event.stopImmediatePropagation();
    event.preventDefault();
    if (event.type === 'keydown' && !event.repeat) void this.save();
    return true;
  }

  /**
   * A save waiting for its proof is over: written, refused, or dropped since the board was opened
   * anew. The lock is taken off only where the board it was put on is in hand still: a board opened
   * meanwhile was given its own lock by the page.
   */
  private endProof(saved: boolean, line = ''): void {
    const { proving } = this;
    if (!proving) return;
    this.proving = null;
    const { name, board } = this.page.board();
    if (name.toLowerCase() === proving.at.name.toLowerCase() && board === proving.at.board) this.page.stage().locked = false;
    if (line) this.note = line;
    this.show();
    proving.resolve(saved);
  }

  /** Writes the board in hand with the head given, in one write. */
  private async write(head: LevelSpec): Promise<boolean> {
    const { name, board, extra, head: was } = this.page.board();
    const { loads } = this;
    const text = textOf(board, head, extra);
    const before = this.file;
    // The text is known before it is written: the server tells of the change of the file, and this one is no change from outside.
    this.file = text;
    try {
      await writeBoard(name, text);
    } catch (error) {
      if (this.file === text) this.file = before;
      this.tell(`не сохранено: ${(error as Error).message}`);
      return false;
    }
    // A board was opened meanwhile, this one read again or another: it is as its file has it.
    if (this.loads !== loads || this.page.board().name.toLowerCase() !== name.toLowerCase()) return true;
    this.base = { board, head };
    this.headEdits = 0;
    this.outside = false;
    this.note = '';
    const stage = this.page.stage();
    if (stage.current === board) stage.markSaved();
    this.page.wrote(head, board, was);
    return true;
  }
}
