import type { Game } from '../app/game';
import { BOARD_MARKS, type BoardMark, type BoardWords } from '../levels/boardFile';
import { boardSvg } from '../levels/boardSvg';
import { CHAPTERS } from '../levels/chapters';
import { exportText, markOfKey, originsOf, type ExportEntry } from '../levels/library';
import type { LevelSpec } from '../rules/types';
import { PROGRAM_FONT, paletteAt, shellDefaults } from '../shell/theme';
import { addPlay, listHeads, onBoardChanged, readBoard, writeExport, writeHead } from './boardsClient';
import { boardHash } from './boardsServer';
import { copyText } from './clipboard';
import type { Seconds } from './labFacts';
import { COLUMNS, MARK_CHOICES, NO_FILTER, STATUS_CHOICES, facesOf, filterRows, lastWords, rowOf, sortRows, type LibraryFilter, type LibraryRow, type SortKey } from './libraryRows';
import type { Rate } from './playLog';
import { PlayWatch, type Inside } from './playWatch';
import { CANCELLED, SolveClient, type WorkerLike } from './solveClient';

/** The width of the table on the left: the board of the game stands to the right of it. */
const TABLE_WIDTH = 1040;
const RATE_OF_MARK: Readonly<Record<BoardMark, Rate>> = { огонь: 'fire', норм: 'ok', мимо: 'miss' };

const solver = (): WorkerLike => new Worker(new URL('./solve.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;
const today = (): string => new Date().toISOString().slice(0, 10);

/**
 * The page of the library of the boards, `?lab=library` (docs/VI_Levels_Lab.md, section
 * «Библиотека»): every file of `boards/` as a row of a table, with filters and an order by any
 * column. A click puts the board on the board of the game; `E` plays it on the real rules, and
 * `E` again stands it back. After a play — or at any time for the board in hand — `1`, `2`, `3`
 * mark it, a line takes the words, `Enter` writes both into the head of its file (no version is
 * kept: the board is the same) and a line of the play into its `plays.jsonl`. «Выгрузить» gives
 * out what was marked and said since the page was opened, as text for a chat.
 *
 * The board is put on and played as on `?lab=levels` (`Game.showBoard`, `Game.playBoard`), and
 * its plays are watched by the same `PlayWatch`. A board of the row is played on the faces of
 * its chapter, as the player meets it.
 */
export function startLibraryLab(game: Game): void {
  (window as unknown as { viLibrary: LibraryLab }).viLibrary = new LibraryLab(game);
}

class LibraryLab {
  private readonly palette = paletteAt(shellDefaults(), 0);
  private readonly inside: Inside;
  private readonly watcher: PlayWatch;
  private readonly askSeconds = new SolveClient<{ tier: 'seconds'; spec: LevelSpec }, Seconds>(solver);
  private readonly root = document.createElement('div');
  private readonly head = document.createElement('div');
  private readonly filters = document.createElement('div');
  private readonly tableBox = document.createElement('div');
  private readonly side = document.createElement('div');
  private readonly info = document.createElement('pre');
  private readonly rateBox = document.createElement('div');
  private readonly wordsInput = document.createElement('input');
  private readonly told = document.createElement('div');

  private rows: LibraryRow[] = [];
  private filter: LibraryFilter = { ...NO_FILTER };
  private sort: { key: SortKey; way: 1 | -1 } = { key: 'place', way: 1 };
  private selected: string | null = null;
  private playing = false;
  /** The play last written down, by the board and when it ended: a mark given after it is laid over it in `plays.jsonl`. */
  private lastPlay: { name: string; at: string } | null = null;
  /** The mark chosen for the board in hand and not yet written. */
  private pending: BoardMark | null = null;
  /** What was marked and said since the page was opened, by board. */
  private readonly session = new Map<string, { mark?: BoardMark; words: BoardWords[] }>();
  /** The passports asked one after another for the rows shown. */
  private passportsRunning = false;

  constructor(private readonly game: Game) {
    this.inside = game as unknown as Inside;
    this.watcher = new PlayWatch(this.inside, (record, of) => {
      void addPlay(of.name, record).catch((error: Error) => console.error(error));
      this.lastPlay = { name: of.name, at: record.at };
      this.say(`партия записана: ${record.result}, ходов ${record.moves}. 1 / 2 / 3 — оценка, слова — в строке, Enter — записать`);
      this.showSide();
    });
    this.build();
    window.addEventListener('keydown', (event) => this.key(event), true);
    // A key typed into a field of the page is the field's: it goes no further than the page, to the game under it.
    for (const box of [this.root, this.side]) for (const type of ['keydown', 'keyup'] as const) box.addEventListener(type, (event) => this.typed(event) && event.stopPropagation());
    onBoardChanged((name) => void this.reread(name));
    this.inside.audio.setAway(true);
    void this.load();
  }

  private build(): void {
    const { palette, root } = this;
    // The game stands to the right of the table: its page is moved over, and the board is laid in what is left.
    const app = document.getElementById('app');
    if (app) app.style.left = `${TABLE_WIDTH}px`;
    root.style.cssText = `position:fixed;left:0;top:0;bottom:0;width:${TABLE_WIDTH}px;z-index:900;display:flex;flex-direction:column;box-sizing:border-box;background:${palette.bg};color:${palette.ink};border-right:1px solid ${palette.faint};font:13px/1.4 ${PROGRAM_FONT}`;
    this.head.style.cssText = 'display:flex;gap:8px;align-items:center;padding:8px 10px';
    this.filters.style.cssText = `display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:0 10px 8px;border-bottom:1px solid ${palette.faint}`;
    this.tableBox.style.cssText = 'flex:1;overflow:auto';
    root.append(this.head, this.filters, this.tableBox);
    this.side.style.cssText = `position:fixed;left:${TABLE_WIDTH}px;right:0;bottom:0;z-index:900;padding:8px 12px;background:${palette.bg};color:${palette.ink};border-top:1px solid ${palette.faint};font:13px/1.4 ${PROGRAM_FONT}`;
    this.info.style.cssText = 'margin:0;white-space:pre-wrap;font:inherit;max-height:30vh;overflow:auto';
    this.rateBox.style.cssText = 'display:flex;gap:6px;align-items:center;margin-top:6px';
    this.told.style.cssText = `color:${palette.dim};margin-top:4px;min-height:1.4em`;
    this.wordsInput.placeholder = 'слова о доске; Enter — записать';
    this.wordsInput.style.cssText = this.field('flex:1');
    this.wordsInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void this.writeMark();
      }
    });
    for (const mark of BOARD_MARKS) {
      const button = this.button(`${BOARD_MARKS.indexOf(mark) + 1} ${mark}`, () => this.choose(mark));
      button.dataset.mark = mark;
      this.rateBox.append(button);
    }
    this.rateBox.append(this.wordsInput, this.button('записать', () => void this.writeMark()));
    this.side.append(this.info, this.rateBox, this.told);
    document.body.append(root, this.side);

    this.head.append(
      this.button('играть / стоп (E)', () => this.togglePlay()),
      this.button('выгрузить', () => void this.giveOut()),
      this.button('паспорта показанных', () => void this.passports()),
    );
    const count = document.createElement('span');
    count.dataset.count = '';
    count.style.cssText = `color:${palette.dim};margin-left:auto`;
    this.head.append(count);

    const select = (label: string, key: keyof LibraryFilter, options: readonly [string, string][]): void => {
      const box = document.createElement('label');
      box.textContent = `${label} `;
      const element = document.createElement('select');
      element.style.cssText = this.field('');
      for (const [value, text] of options) element.append(new Option(text, value));
      element.addEventListener('change', () => {
        this.filter = { ...this.filter, [key]: element.value };
        this.showTable();
      });
      box.append(element);
      this.filters.append(box);
    };
    const input = (label: string, key: keyof LibraryFilter, width: number): void => {
      const box = document.createElement('label');
      box.textContent = `${label} `;
      const element = document.createElement('input');
      element.style.cssText = this.field(`width:${width}px`);
      element.addEventListener('input', () => {
        this.filter = { ...this.filter, [key]: element.value };
        this.showTable();
      });
      box.append(element);
      this.filters.append(box);
    };
    select('статус', 'status', STATUS_CHOICES.map((status) => [status, status || 'все']));
    select('глава', 'chapter', [['', 'все'], ...CHAPTERS.map((chapter): [string, string] => [String(chapter.id), `${chapter.id} ${chapter.title}`]), ['none', 'вне ряда']]);
    input('грани', 'faces', 50);
    input('тег', 'tag', 70);
    select('оценка', 'mark', MARK_CHOICES.map((mark) => [mark, mark === '' ? 'все' : mark === 'none' ? 'без оценки' : mark]));
    input('текст', 'text', 140);
  }

  private field(extra: string): string {
    const { palette } = this;
    return `font:inherit;color:${palette.ink};background:${palette.bg};border:1px solid ${palette.faint};padding:2px 6px;${extra}`;
  }

  private button(label: string, click: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = label;
    button.style.cssText = this.field('cursor:pointer');
    button.addEventListener('click', click);
    return button;
  }

  /** Reads every file anew, and keeps the passports already counted for the boards that have not changed. */
  private async load(): Promise<void> {
    try {
      const passports = new Map(this.rows.map((row) => [`${row.name}:${row.hash}`, row.passport]));
      this.rows = (await listHeads()).map((file) => {
        const row = rowOf(file, CHAPTERS);
        return { ...row, passport: passports.get(`${row.name}:${row.hash}`) ?? null };
      });
    } catch (error) {
      this.say((error as Error).message);
    }
    this.showTable();
    this.showSide();
  }

  /** A file changed on the disk, by this page or by anyone: its row is read again. */
  private async reread(name: string): Promise<void> {
    let text: string;
    try {
      text = await readBoard(name);
    } catch {
      return void this.load();
    }
    const at = this.rows.findIndex((row) => row.name === name);
    const row = rowOf({ name, text, hash: boardHash(text, name) }, CHAPTERS);
    if (at < 0) this.rows.push(row);
    else this.rows[at] = { ...row, passport: this.rows[at].hash === row.hash ? this.rows[at].passport : null };
    this.showTable();
    if (name === this.selected) this.showSide();
  }

  private shown(): LibraryRow[] {
    return sortRows(filterRows(this.rows, this.filter), this.sort.key, this.sort.way);
  }

  private showTable(): void {
    const { palette } = this;
    const rows = this.shown();
    const count = this.head.querySelector<HTMLElement>('[data-count]');
    if (count) count.textContent = `досок ${rows.length} из ${this.rows.length}`;
    const table = document.createElement('table');
    table.style.cssText = 'border-collapse:collapse;width:100%';
    const head = table.createTHead().insertRow();
    for (const column of [{ key: null, title: '' }, ...COLUMNS]) {
      const cell = document.createElement('th');
      const on = column.key === this.sort.key;
      cell.textContent = `${column.title}${on ? (this.sort.way === 1 ? ' ↑' : ' ↓') : ''}`;
      cell.style.cssText = `position:sticky;top:0;background:${palette.bg};text-align:left;padding:4px 6px;border-bottom:1px solid ${palette.faint};cursor:${column.key ? 'pointer' : 'default'};white-space:nowrap;font-weight:normal;color:${on ? palette.ink : palette.dim}`;
      if (column.key) {
        const key = column.key;
        cell.addEventListener('click', () => {
          this.sort = { key, way: this.sort.key === key ? (-this.sort.way as 1 | -1) : 1 };
          this.showTable();
        });
      }
      head.append(cell);
    }
    const body = table.createTBody();
    for (const row of rows) {
      const line = body.insertRow();
      const on = row.name === this.selected;
      line.style.cssText = `cursor:pointer;${on ? `background:${palette.faint};` : ''}`;
      line.addEventListener('click', () => this.select(row.name));
      const picture = document.createElement('img');
      if (row.spec) picture.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(boardSvg(row.spec, { cell: 9 }))}`;
      picture.style.cssText = 'display:block;max-width:56px;max-height:56px';
      const words = lastWords(row);
      const cells: (string | HTMLElement)[] = [
        picture,
        row.name,
        row.head.status ?? '?',
        row.place ? String(row.place.number) : '—',
        row.place ? String(row.place.chapter) : '—',
        facesOf(row).join(' '),
        String(row.spec?.norm ?? '?'),
        String(row.passport?.par ?? row.spec?.par ?? '—') + (row.passport && !row.passport.exact ? '?' : ''),
        row.passport?.route ?? '',
        row.passport?.turns === undefined ? '' : String(row.passport.turns),
        row.passport?.away === undefined ? '' : String(row.passport.away),
        row.head.mark ?? '',
        words ? `${words.date.slice(5)}: ${words.text}` : '',
        originsOf(row.head).join('; '),
      ];
      cells.forEach((content, index) => {
        const cell = line.insertCell();
        cell.style.cssText = `padding:3px 6px;border-bottom:1px solid ${palette.faint};vertical-align:top;${index >= 12 ? 'max-width:240px;' : 'white-space:nowrap;'}`;
        if (typeof content === 'string') {
          cell.textContent = index === 12 && content.length > 90 ? `${content.slice(0, 89)}…` : content;
          if (index === 12 || index === 13) cell.title = content;
        } else cell.append(content);
      });
    }
    this.tableBox.replaceChildren(table);
  }

  private selectedRow(): LibraryRow | null {
    return this.rows.find((row) => row.name === this.selected) ?? null;
  }

  /** A row is clicked: its board stands on the board of the game, and its passport is asked for. */
  private select(name: string): void {
    if (this.playing) this.togglePlay();
    this.selected = name;
    this.pending = null;
    this.wordsInput.value = '';
    if (this.lastPlay?.name !== name) this.lastPlay = null;
    const row = this.selectedRow();
    if (row?.spec && !row.error) this.game.showBoard(row.spec);
    this.showTable();
    this.showSide();
    if (row && row.spec && !row.error && !row.passport) void this.passportOf(row);
  }

  private async passportOf(row: LibraryRow): Promise<void> {
    if (!row.spec) return;
    try {
      const { check } = await this.askSeconds.ask({ tier: 'seconds', spec: row.spec });
      row.passport = { par: check.par, exact: check.exact, ...(check.score ? { route: check.score.route, turns: check.score.turns, away: check.score.away } : {}) };
      this.showTable();
      if (row.name === this.selected) this.showSide();
    } catch (error) {
      if ((error as Error).message !== CANCELLED) this.say(`${row.name}: ${(error as Error).message}`);
    }
  }

  /** The passports of every row shown that has none, one after another; clicking a row puts its own first. */
  private async passports(): Promise<void> {
    if (this.passportsRunning) return;
    this.passportsRunning = true;
    for (const row of this.shown()) {
      if (row.passport || !row.spec || row.error) continue;
      this.say(`паспорт ${row.name}…`);
      await this.passportOf(row);
    }
    this.passportsRunning = false;
    this.say('паспорта посчитаны');
  }

  /** `E`: the board in hand is played on the real rules; again, and it stands still. */
  private togglePlay(): void {
    const row = this.selectedRow();
    if (!row?.spec || row.error) return;
    if (!this.playing) {
      this.playing = true;
      this.inside.audio.setAway(false);
      this.game.playBoard(row.spec);
      this.watcher.start({ name: row.name, hash: row.hash ?? '', par: row.passport?.par ?? row.spec.par ?? null, measures: { size: row.spec.size, dice: row.spec.norm } });
      this.say('партия: Z — ход назад, R — заново, E — стоп');
    } else {
      this.watcher.stop();
      this.playing = false;
      this.inside.audio.setAway(true);
      this.game.showBoard(row.spec);
    }
    this.showSide();
  }

  /** Whether a key is typed into a field of the page: such a key is the field's, and goes nowhere else. */
  private typed(event: KeyboardEvent): boolean {
    return event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
  }

  private key(event: KeyboardEvent): void {
    if (this.typed(event)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const mark = markOfKey(event.code);
    if (mark && this.selected) {
      event.stopImmediatePropagation();
      event.preventDefault();
      this.choose(mark);
      return;
    }
    if (event.code === 'KeyE') {
      event.stopImmediatePropagation();
      event.preventDefault();
      if (!event.repeat) this.togglePlay();
      return;
    }
    if ((event.code === 'Enter' || event.code === 'NumpadEnter') && this.pending) {
      event.stopImmediatePropagation();
      event.preventDefault();
      void this.writeMark();
      return;
    }
    // Out of a play the game takes no keys: the board only stands.
    if (!this.playing) event.stopImmediatePropagation();
  }

  /** A mark is chosen for the board in hand: the line of the words takes the keys next. */
  private choose(mark: BoardMark): void {
    if (!this.selected) return;
    this.pending = mark;
    this.showSide();
    this.wordsInput.focus();
  }

  /** The mark and the words are written into the head of the file, and over the last play of the board where there was one. */
  private async writeMark(): Promise<void> {
    const name = this.selected;
    if (!name) return;
    const text = this.wordsInput.value.replace(/\s+/g, ' ').trim();
    const mark = this.pending;
    if (!mark && text === '') return;
    const words = text ? [{ date: today(), text }] : [];
    try {
      await writeHead(name, { ...(mark ? { mark } : {}), words });
      if (this.lastPlay?.name === name) await addPlay(name, { at: this.lastPlay.at, patch: { ...(mark ? { rate: RATE_OF_MARK[mark] } : {}), ...(text ? { words: text } : {}) } });
    } catch (error) {
      this.say((error as Error).message);
      return;
    }
    const kept = this.session.get(name) ?? { words: [] };
    this.session.set(name, { mark: mark ?? kept.mark, words: [...kept.words, ...words] });
    this.pending = null;
    this.wordsInput.value = '';
    this.wordsInput.blur();
    this.say(`${name}: записано${mark ? ` — ${mark}` : ''}${text ? `, слова` : ''}`);
    await this.reread(name);
  }

  /** What was marked and said since the page was opened, as text: on the clipboard, and kept in boards/.history/export-<date>.md. */
  private async giveOut(): Promise<void> {
    const entries: ExportEntry[] = [...this.session].map(([name, said]) => {
      const row = this.rows.find((one) => one.name === name);
      return {
        name,
        status: row?.head.status,
        place: row?.place ?? null,
        faces: row ? facesOf(row) : [],
        par: row?.passport?.par ?? row?.spec?.par ?? null,
        ...(row?.passport?.route ? { route: row.passport.route, turns: row.passport.turns, away: row.passport.away } : {}),
        mark: said.mark ?? row?.head.mark,
        words: said.words,
      };
    });
    const date = today();
    const text = exportText(entries, date);
    const copied = await copyText(text);
    try {
      const file = await writeExport(date, text);
      this.say(`${copied ? 'в буфере' : 'в буфер не вышло'}; записано в ${file}`);
    } catch (error) {
      this.say((error as Error).message);
    }
  }

  private say(text: string): void {
    this.told.textContent = text;
  }

  /** What is said of the board in hand under the board of the game. */
  private showSide(): void {
    const row = this.selectedRow();
    for (const button of this.rateBox.querySelectorAll<HTMLButtonElement>('button[data-mark]')) {
      const on = button.dataset.mark === this.pending;
      button.style.background = on ? this.palette.ink : this.palette.bg;
      button.style.color = on ? this.palette.bg : this.palette.ink;
    }
    if (!row) {
      this.info.textContent = 'щелчок по строке — доска на поле; E — играть';
      return;
    }
    const passport = row.passport;
    this.info.textContent = [
      `${row.name} · ${row.head.status ?? '?'} · ${row.place ? `место ${row.place.number}, глава ${row.place.chapter} «${row.place.title}»` : 'вне ряда'} · грани ${facesOf(row).join(' ')} · костей ${row.spec?.norm ?? '?'}`,
      passport ? `par ${passport.par ?? '—'}${passport.exact ? '' : ' (не доказан)'}${passport.route ? ` · ${passport.route} · turns ${passport.turns} away ${passport.away}` : ''}` : `par ${row.spec?.par ?? '—'} · паспорт считается…`,
      ...(row.error ? [`правила не принимают доску: ${row.error}`] : []),
      `откуда: ${row.head.origin ?? '—'}`,
      ...(row.head.note ? [`заметка: ${row.head.note}`] : []),
      `оценка: ${row.head.mark ?? '—'}${this.pending ? ` → ${this.pending}` : ''}`,
      ...(row.head.words ?? []).map((word) => `${word.date}: ${word.text}`),
      this.playing ? 'идёт партия — E: стоп' : 'E — играть · 1 огонь · 2 норм · 3 мимо · Enter — записать',
    ].join('\n');
  }
}
