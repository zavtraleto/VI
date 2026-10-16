import { boardSvg } from '../levels/boardSvg';
import type { LevelSpec } from '../rules/types';
import { PROGRAM_FONT, type Palette } from '../shell/theme';
import { LISTS, batchTitle, batchesOf, listOf, listRows, type BoardRow, type ListKey } from './workshopLists';

/** A field of the workshop as the old labs drew theirs: the font of the page, the colours of the palette, a thin line about it. */
export function fieldStyle(palette: Palette, extra = ''): string {
  return `font:inherit;color:${palette.ink};background:${palette.bg};border:1px solid ${palette.faint};padding:2px 6px;${extra}`;
}

export function buttonOf(palette: Palette, label: string, click: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.textContent = label;
  button.style.cssText = fieldStyle(palette, 'cursor:pointer');
  // A button clicked keeps no focus: Space or Enter in a play is the game's, and does not click it again.
  button.addEventListener('mousedown', (event) => event.preventDefault());
  button.addEventListener('click', click);
  return button;
}

/** A button lit while it is on: the colours of the palette the other way about. */
export function light(palette: Palette, button: HTMLElement, on: boolean): void {
  button.style.background = on ? palette.ink : palette.bg;
  button.style.color = on ? palette.bg : palette.ink;
}

/** What shows «в кампании» instead of a plain list: the chapters of the row with their places, and the lines of its grammar under them. */
export interface RowList {
  lines(rows: readonly BoardRow[], search: string, selected: string): HTMLElement[];
  readonly foot: HTMLElement;
}

/**
 * The column of the lists on the left of the workshop (docs/superpowers/specs/2026-10-15-vi-level-workshop-design.md,
 * section 3.1): the names of the five lists, one shown at a time; the search over them; the rows
 * of the list shown, a picture, a name and the last words of the owner to each, with no number;
 * the batches of the new boards, a line over each; and under the lists the field and the button
 * that begin a new board. What a click and the button do is the page's: this only shows.
 */
export class WorkshopListView {
  readonly root = document.createElement('div');
  /** The list shown, and what the search says. */
  list: ListKey = listOf(window.location.search) ?? 'new';
  search = '';
  private readonly tabs = document.createElement('div');
  private readonly rowsBox = document.createElement('div');
  private readonly tabButtons = new Map<ListKey, HTMLButtonElement>();
  private readonly fresh = document.createElement('div');
  private rows: readonly BoardRow[] = [];
  private selected = '';
  private rowList: RowList | null = null;

  constructor(
    private readonly palette: Palette,
    width: number,
    private readonly pick: (name: string) => void,
    make: (word: string) => void,
  ) {
    const { root } = this;
    root.style.cssText = `position:fixed;left:0;top:0;bottom:0;width:${width}px;z-index:900;display:flex;flex-direction:column;box-sizing:border-box;background:${palette.bg};color:${palette.ink};border-right:1px solid ${palette.faint};font:13px/1.4 ${PROGRAM_FONT}`;
    this.tabs.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;padding:8px 10px';
    for (const { key, title } of LISTS) {
      const button = buttonOf(palette, title, () => {
        this.list = key;
        this.redraw();
      });
      this.tabButtons.set(key, button);
      this.tabs.append(button);
    }
    const search = document.createElement('input');
    search.placeholder = 'поиск: имя, прежнее имя, слова, заметка';
    search.style.cssText = fieldStyle(palette, 'margin:0 10px 8px');
    search.addEventListener('input', () => {
      this.search = search.value;
      this.redraw();
    });
    this.rowsBox.style.cssText = `flex:1;overflow:auto;border-top:1px solid ${palette.faint}`;
    const { fresh } = this;
    fresh.style.cssText = `display:flex;gap:6px;padding:8px 10px;border-top:1px solid ${palette.faint}`;
    const word = document.createElement('input');
    word.placeholder = 'слово по-английски';
    word.style.cssText = fieldStyle(palette, 'flex:1;min-width:0');
    const begin = (): void => make(word.value);
    word.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') begin();
    });
    fresh.append(word, buttonOf(palette, 'новая доска', begin));
    root.append(this.tabs, search, this.rowsBox, fresh);
  }

  /** «в кампании» is shown by the row: its chapters in the list, its grammar under it. */
  attachRow(rowList: RowList): void {
    this.rowList = rowList;
    this.root.insertBefore(rowList.foot, this.fresh);
    this.redraw();
  }

  /** Shows the rows anew, with the board in hand marked among them. */
  show(rows: readonly BoardRow[], selected: string): void {
    const moved = selected !== this.selected;
    this.rows = rows;
    this.selected = selected;
    this.redraw();
    // A board just opened is brought into sight in the list; the list is not scrolled for anything else.
    if (moved) this.rowsBox.querySelector<HTMLElement>('[data-selected]')?.scrollIntoView({ block: 'nearest' });
  }

  /** Draws the list shown again, as it stands. */
  redraw(): void {
    const { palette } = this;
    for (const [key, button] of this.tabButtons) light(palette, button, key === this.list);
    const shown = listRows(this.rows, this.list, this.search);
    const lines: HTMLElement[] = [];
    if (this.rowList) this.rowList.foot.style.display = this.list === 'row' ? '' : 'none';
    if (this.list === 'row' && this.rowList) lines.push(...this.rowList.lines(this.rows, this.search, this.selected));
    else if (this.list === 'new') {
      for (const batch of batchesOf(shown)) {
        const title = document.createElement('div');
        title.textContent = batchTitle(batch);
        title.style.cssText = `padding:8px 10px 2px;color:${palette.dim}`;
        lines.push(title, ...batch.rows.map((row) => this.line(row)));
      }
    } else lines.push(...shown.map((row) => this.line(row)));
    this.rowsBox.replaceChildren(...lines);
  }

  private line(row: BoardRow): HTMLElement {
    return boardLine(this.palette, { name: row.name, spec: row.spec, words: row.head.words?.at(-1)?.text ?? '', selected: row.name === this.selected, pick: () => this.pick(row.name) });
  }
}

/** What a line of a list shows of a board; a place of the row has its number before the picture and its role after the name. */
export interface LineOf {
  name: string;
  spec: LevelSpec | null;
  /** The second line: the last words said of the board, or what is wrong with the place. */
  words: string;
  number?: number;
  role?: string;
  selected: boolean;
  pick: () => void;
}

/** A row of a list: the picture of the board, its name and the last words said of it. */
export function boardLine(palette: Palette, of: LineOf): HTMLElement {
  const line = document.createElement('div');
  line.style.cssText = `display:flex;gap:8px;align-items:center;padding:4px 10px;cursor:pointer;border-bottom:1px solid ${palette.faint};${of.selected ? `background:${palette.faint};` : ''}`;
  if (of.selected) line.dataset.selected = '';
  line.addEventListener('click', of.pick);
  if (of.number !== undefined) {
    const number = document.createElement('div');
    number.textContent = String(of.number);
    number.style.cssText = 'flex:0 0 22px;text-align:right';
    line.append(number);
  }
  // The picture stands in a box of its own size from the start, so that a list is as tall before its pictures are drawn as after.
  const picture = document.createElement('div');
  picture.style.cssText = 'flex:0 0 56px;height:56px;display:flex;align-items:center;justify-content:center';
  const image = document.createElement('img');
  if (of.spec) image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(boardSvg(of.spec, { cell: 9 }))}`;
  image.style.cssText = 'display:block;max-width:56px;max-height:56px';
  picture.append(image);
  const text = document.createElement('div');
  text.style.cssText = 'min-width:0';
  const name = document.createElement('div');
  name.textContent = of.role ? `${of.name}  ${of.role}` : of.name;
  name.style.whiteSpace = 'pre';
  const words = document.createElement('div');
  words.textContent = of.words;
  words.style.cssText = `color:${palette.dim};overflow:hidden;text-overflow:ellipsis;white-space:nowrap`;
  text.append(name, words);
  line.append(picture, text);
  return line;
}
