import { fastGrammar, markOf } from '../levels/grammar';
import { asInRow, rowChapters, type LibraryRowChapter } from '../levels/library';
import { CAMERAS, EMOTIONS, HELP_KEYS, HINT_KEYS, PLAQUES, ROLES, ROW_EVENT, SIGNS, TECHNIQUES, WAITS, buildRow, readRowFile, type Emotion, type Help, type RowFile, type RowPlaceFile } from '../levels/row';
import { ROW } from '../levels/row.gen';
import { helpNear, type PlaceFields, type RowOp } from '../levels/rowEdit';
import type { LevelSpec } from '../rules/types';
import type { Palette } from '../shell/theme';
import { editRow, readRow } from './boardsClient';
import { boardLine, buttonOf, fieldStyle, type RowList, type WorkshopListView } from './workshopListView';
import { EMOTION_TITLES, ROLE_TITLES, chaptersOf, listRows, rowOf, type BoardRow } from './workshopLists';

/** What the row asks of the page it is on. */
export interface RowPage {
  say(line: string): void;
  /**
   * The board in hand is to be left: where it has edits, the owner is asked to save them, drop them
   * or stay (`WorkshopSave.settle`); `why` is said with the question. False where the page is to stay:
   * he stayed, or the save was refused, and the line says why.
   */
  settle(why?: string): Promise<boolean>;
  /** The stage of the board in hand: it takes no change while it is locked. */
  stage(): { locked: boolean };
  /** Reads every file and the row again (`WorkshopRow.lay`), and shows them. */
  readLists(): Promise<void>;
  /** Reads a file changed on the disk again, and the board in hand with it where it is that one; the board in hand is shown again either way. */
  reread(name: string): Promise<void>;
  /** Shows the board in hand again, as it is now: what was counted of it while its stage was locked is taken. */
  show(): void;
  open(name: string): Promise<void>;
}

/** A file of `boards/` as the server gives it. */
type BoardFile = { name: string; text: string; hash: string | null; time?: string };

/** The lists of the help of a place, each said as «нет» where it is none (section 11.1). */
const HELP_LISTS: Readonly<Record<keyof Help, readonly string[]>> = { hint: HINT_KEYS, sign: SIGNS, plaques: PLAQUES, wait: WAITS, camera: CAMERAS };

/** The line an answer of the server was refused in: what the row said, without the address and the status. */
export function refusal(error: Error): string {
  const said = /^\S+ \S+: \d+ (.*)$/s.exec(error.message)?.[1];
  if (said === undefined) return error.message;
  try {
    return (JSON.parse(said) as { error?: string }).error ?? said;
  } catch {
    return said;
  }
}

function select(palette: Palette, options: readonly [string, string][], change?: () => void): HTMLSelectElement {
  const made = document.createElement('select');
  made.style.cssText = fieldStyle(palette);
  for (const [value, label] of options) made.append(new Option(label, value));
  if (change) made.addEventListener('change', change);
  return made;
}

function textLine(text: string, css = ''): HTMLElement {
  const line = document.createElement('div');
  line.textContent = text;
  line.style.cssText = css;
  return line;
}

const labelled = (text: string, field: HTMLElement): HTMLLabelElement => {
  const made = document.createElement('label');
  made.style.cssText = 'display:inline-flex;gap:4px;align-items:center';
  made.append(text, field);
  return made;
};

/**
 * The row of the campaign on the workshop (docs/superpowers/specs/2026-10-15-vi-level-workshop-design.md,
 * section 11.1): «в кампании» shows the chapters of row.json and their places, numbered through the
 * row; the place of the board in hand has «выше», «ниже», «правка места» and «убрать из ряда»; a
 * board not in the row is put in it by «в кампанию» and the form of a place. Each is one operation the
 * server does whole or not at all (`editRow`); after it, and whenever the row is read, the fast
 * grammar of the row is said under the list. The row is read from row.json as it is on the disk,
 * and the chapters the lists place the boards by are those of the row as it was last laid.
 */
export class WorkshopRow implements RowList {
  readonly foot = document.createElement('div');
  /** The button «в кампанию», beside «сохранить»: shown for a board that is not in the row; it saves the board first, and opens the form of a place. */
  readonly insertButton: HTMLButtonElement;
  /** The form of a place, under the actions; empty where it is shut. */
  readonly form = document.createElement('div');
  /** The chapters of the row as it was last laid: the lists place the boards by them. */
  chapters: LibraryRowChapter[] = rowChapters(ROW);
  private file: RowFile | null = null;
  /** The board in hand. */
  private name = '';
  /** «убрать из ряда» was pressed, and where the board goes is asked. */
  private removing = false;
  /** An operation is with the server: no other is begun. */
  private busy = false;

  constructor(
    private readonly palette: Palette,
    private readonly lists: WorkshopListView,
    private readonly page: RowPage,
  ) {
    this.foot.style.cssText = `max-height:30%;overflow:auto;padding:6px 10px;border-top:1px solid ${palette.faint}`;
    this.form.style.cssText = 'display:none;flex-wrap:wrap;gap:6px;align-items:center';
    this.insertButton = buttonOf(palette, 'в кампанию', () => void this.toCampaign());
    lists.attachRow(this);
    // The dev server laid the row again (row.gen.ts): the files and the row are read anew, and the page is not loaded again.
    window.addEventListener(ROW_EVENT, () => void page.readLists());
  }

  /** A board as it is played: a board of the row on the faces of its chapter, as the player meets it. */
  asPlayed(spec: LevelSpec, name: string, rows: readonly BoardRow[]): LevelSpec {
    return asInRow(spec, rows.find((row) => row.name === name)?.place ?? null, this.chapters);
  }

  /** Whether a board has a place in row.json. */
  holds(name: string): boolean {
    return this.placeOf(name) !== null;
  }

  /**
   * Reads row.json and lays it on the files given: the grammar of the row is said under the list,
   * and the files are given back as the rows of the lists, placed by the chapters of the row. A row
   * that is not laid says its line, and the boards keep the chapters of the row laid before it.
   */
  async lay(files: readonly BoardFile[]): Promise<BoardRow[]> {
    let lines: string[];
    try {
      this.file = readRowFile(await readRow());
      const row = buildRow(this.file, new Map(files.map((file) => [file.name, file.text])));
      this.chapters = rowChapters(row);
      const broken = fastGrammar(row.places);
      lines = broken.length === 0 ? ['грамматика держится'] : broken.map((one) => `правило ${one.rule}: ${one.text}${markOf(one)}`);
    } catch (error) {
      lines = [refusal(error as Error)];
    }
    this.foot.replaceChildren(...lines.map((line) => textLine(line)));
    this.showFor(this.name);
    return files.map((file) => rowOf(file, this.chapters));
  }

  /** The row read and laid again on the rows the page has: a board of the row was changed on the disk. */
  relay(rows: readonly BoardRow[]): Promise<BoardRow[]> {
    return this.lay(rows.map((row) => ({ name: row.name, text: row.text, hash: row.hash, ...(row.touched ? { time: row.touched } : {}) })));
  }

  /** «в кампанию»: the board in hand is saved first, its edits asked of, and the form of a place is opened for it. */
  private async toCampaign(): Promise<void> {
    const name = this.name;
    if (this.busy || !(await this.page.settle())) return;
    // Another board was opened while the owner was asked: the form is not of it.
    if (this.name.toLowerCase() === name.toLowerCase()) this.openForm(null);
  }

  /** The board in hand: «в кампанию» is shown for it where it is not in the row; another board shuts the form. */
  showFor(name: string): void {
    if (name !== this.name) {
      this.removing = false;
      this.shut();
    }
    this.name = name;
    this.insertButton.style.display = name !== '' && this.file && !this.holds(name) ? '' : 'none';
  }

  /** «в кампании»: a heading to each chapter, its places under it, the actions under the place of the board in hand; boards of R with no place last. */
  lines(rows: readonly BoardRow[], search: string, selected: string): HTMLElement[] {
    const { palette, file } = this;
    if (!file) return [];
    const heading = (text: string): HTMLElement => textLine(text, `padding:8px 10px 2px;color:${palette.dim}`);
    const found = new Set(listRows(rows, 'all', search).map((row) => row.name));
    const shown = (row: BoardRow | null): boolean => search.trim() === '' || (row !== null && found.has(row.name));
    const out: HTMLElement[] = [];
    for (const chapter of chaptersOf(rows, file)) {
      out.push(heading(chapter.faces ? `${chapter.title} — грани ${chapter.faces.join(', ')}` : chapter.title));
      for (const { number, row, place } of chapter.places) {
        if (!shown(row)) continue;
        const words = row ? (row.head.words?.at(-1)?.text ?? '') : `нет файла boards/${place.board}.txt`;
        out.push(boardLine(palette, { name: place.board, spec: row?.spec ?? null, words, number, role: ROLE_TITLES[place.role] ?? place.role, selected: place.board === selected, pick: () => row && void this.page.open(row.name) }));
        if (place.board === selected) out.push(this.actions(place.board));
      }
    }
    const loose = listRows(rows, 'row', search).filter((row) => !this.holds(row.name));
    if (loose.length > 0) out.push(heading('R без места в row.json'));
    for (const row of loose) out.push(boardLine(palette, { name: row.name, spec: row.spec, words: row.head.words?.at(-1)?.text ?? '', selected: row.name === selected, pick: () => void this.page.open(row.name) }));
    return out;
  }

  /** The actions of the place of the board in hand, or, after «убрать из ряда», where the board goes. */
  private actions(board: string): HTMLElement {
    const { palette } = this;
    const bar = document.createElement('div');
    bar.style.cssText = `display:flex;flex-wrap:wrap;gap:4px;padding:4px 10px 6px;border-bottom:1px solid ${palette.faint}`;
    const asked = (removing: boolean): void => {
      this.removing = removing;
      this.lists.redraw();
    };
    if (this.removing) {
      bar.append(
        'куда: ',
        buttonOf(palette, 'в хорошие', () => void this.run({ op: 'remove', board, status: 'RC' }, 'снята в хорошие')),
        buttonOf(palette, 'убрать', () => void this.run({ op: 'remove', board, status: 'X' }, 'снята и убрана')),
        buttonOf(palette, 'отмена', () => asked(false)),
      );
    } else {
      bar.append(
        buttonOf(palette, 'выше', () => void this.run({ op: 'move', board, way: 'up' }, 'выше')),
        buttonOf(palette, 'ниже', () => void this.run({ op: 'move', board, way: 'down' }, 'ниже')),
        buttonOf(palette, 'правка места', () => this.openForm(board)),
        buttonOf(palette, 'убрать из ряда', () => asked(true)),
      );
    }
    return bar;
  }

  private placeOf(name: string): { chapter: number; index: number; place: RowPlaceFile } | null {
    for (const [chapter, { places }] of (this.file?.chapters ?? []).entries()) {
      const index = places.findIndex((place) => place.board === name);
      if (index >= 0) return { chapter, index, place: places[index] };
    }
    return null;
  }

  /**
   * An operation sent to the server. The edits of the board in hand are saved or dropped first
   * (`settle`), since the operation may lay a status into its file; where the owner stays, or the
   * save is refused, nothing is sent. The
   * stage is locked from then until the board is read again after the answer, so that no change
   * made meanwhile, and no way the solver proves meanwhile, writes the old head back over the
   * status the server lays: a file read again with its new head is taken by the page, and the
   * stage unlocked on that head. Done, the files and the row are read again and the board in hand
   * with them; refused, its line is said, the board is read again all the same, and the form stays
   * as it is. Once the lock is back the board is shown again, so that what was counted of it while
   * it was locked is taken.
   */
  private async run(op: RowOp, done: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const stage = this.page.stage();
    // The lock is put back only on the board it was taken of: another board opened meanwhile has its own.
    const name = this.name;
    let taken = false;
    let locked = stage.locked;
    try {
      if (!(await this.page.settle())) return;
      // Dropped, the edits were read away and the stage is as the file opened it.
      locked = stage.locked;
      stage.locked = taken = true;
      let refused: string | null = null;
      try {
        await editRow(op);
      } catch (error) {
        refused = refusal(error as Error);
      }
      if (refused !== null) {
        this.page.say(`${op.board}: ${refused}`);
        await this.page.reread(op.board);
        return;
      }
      this.removing = false;
      this.shut();
      // The board is shown where it went, with the grammar under it.
      this.lists.list = 'row';
      await this.page.readLists();
      await this.page.reread(op.board);
      this.page.say(`${op.board}: ${done}`);
    } finally {
      this.busy = false;
      if (taken && this.name === name) {
        stage.locked = locked;
        this.page.show();
      }
    }
  }

  private shut(): void {
    this.form.replaceChildren();
    this.form.style.display = 'none';
  }

  /**
   * The form of a place (section 11.1): for a board put in the row, its chapter and where in it; for
   * a place edited (`edit` names its board), the same without them, with what the place says now.
   * The help a new place is given is that of the place near it (`helpNear`) until it is chosen.
   */
  private openForm(edit: string | null): void {
    const { palette, file } = this;
    if (!file) return;
    const board = edit ?? this.name;
    const placed = edit ? this.placeOf(edit) : null;
    if (board === '' || (edit && !placed)) return;
    const was: Partial<RowPlaceFile> = placed?.place ?? {};
    const none: [string, string] = ['', 'нет'];
    const chapterField = select(palette, file.chapters.map((chapter, index) => [String(index), chapter.title]), () => {
      fillAfter();
      fillHelp();
    });
    const afterField = select(palette, [], () => fillHelp());
    const roleField = select(palette, [['', 'роль…'], ...ROLES.map((role): [string, string] => [role, ROLE_TITLES[role]])]);
    const archetypeField = Object.assign(document.createElement('input'), { placeholder: 'архетип', value: was.archetype ?? '' });
    archetypeField.style.cssText = fieldStyle(palette, 'width:140px');
    const teachesField = select(palette, [none, ...TECHNIQUES.map((one): [string, string] => [one, one])]);
    const emotionField = select(palette, [none, ...EMOTIONS.map((one): [string, string] => [one, EMOTION_TITLES[one]])]);
    const eventField = Object.assign(document.createElement('input'), { placeholder: 'event', value: was.event ?? '' });
    const noteField = Object.assign(document.createElement('input'), { placeholder: 'note', value: was.note ?? '' });
    for (const field of [eventField, noteField]) field.style.cssText = fieldStyle(palette, 'width:140px');
    const helpFields = HELP_KEYS.map((key) => [key, select(palette, [none, ...HELP_LISTS[key].map((one): [string, string] => [one, one])])] as const);
    const facesLine = document.createElement('span');
    facesLine.style.color = palette.dim;
    roleField.value = was.role ?? '';
    teachesField.value = was.teaches ?? '';
    emotionField.value = was.emotion ?? '';
    const chapterAt = (): number => Number(chapterField.value);
    const after = (): string | null => afterField.value || null;
    function fillAfter(): void {
      const places = file!.chapters[chapterAt()]?.places ?? [];
      afterField.replaceChildren(new Option('первым в главе', ''), ...places.map((place) => new Option(`после ${place.board}`, place.board)));
      afterField.value = places.at(-1)?.board ?? '';
      const faces = file!.chapters[chapterAt()]?.faces;
      facesLine.textContent = faces ? `в главе играет на гранях ${faces.join(', ')}` : '';
    }
    const fillHelp = (help: Help = helpNear(file, chapterAt(), after())): void => {
      for (const [key, field] of helpFields) field.value = help[key] ?? '';
    };
    const title = document.createElement('span');
    if (placed) {
      title.textContent = `правка места ${board}:`;
      chapterField.value = String(placed.chapter);
      fillAfter();
      fillHelp(placed.place.help ?? {});
    } else {
      title.textContent = `поставить в ряд ${board}:`;
      chapterField.value = String(file.chapters.length - 1);
      fillAfter();
      fillHelp();
    }
    const put = async (): Promise<void> => {
      const role = roleField.value as RowPlaceFile['role'] | '';
      const archetype = archetypeField.value.trim();
      if (role === '') return this.page.say('роль: выбрать');
      if (archetype === '') return this.page.say('архетип: слово');
      const help: Help = {};
      for (const [key, field] of helpFields) if (field.value) Object.assign(help, { [key]: field.value });
      const said = (field: HTMLInputElement): string => field.value.trim();
      const place: PlaceFields = {
        role,
        ...(teachesField.value ? { teaches: teachesField.value as RowPlaceFile['teaches'] } : {}),
        archetype,
        ...(emotionField.value ? { emotion: emotionField.value as Emotion } : {}),
        ...(said(eventField) ? { event: said(eventField) } : {}),
        ...(said(noteField) ? { note: said(noteField) } : {}),
        ...(Object.keys(help).length > 0 ? { help } : {}),
      };
      const op: RowOp = placed ? { op: 'edit', board, place } : { op: 'insert', board, chapter: chapterAt(), after: after(), place };
      await this.run(op, placed ? 'место записано' : 'в ряду');
    };
    this.form.replaceChildren(
      title,
      ...(placed ? [] : [labelled('глава', chapterField), afterField, facesLine]),
      roleField,
      archetypeField,
      labelled('teaches', teachesField),
      labelled('эмоция', emotionField),
      eventField,
      noteField,
      ...helpFields.map(([key, field]) => labelled(key, field)),
      buttonOf(palette, placed ? 'записать место' : 'поставить', () => void put()),
      buttonOf(palette, 'отмена', () => this.shut()),
    );
    this.form.style.display = 'flex';
  }
}
