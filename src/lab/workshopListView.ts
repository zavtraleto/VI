import { boardSvg } from '../levels/boardSvg';
import { PROGRAM_FONT, type Palette } from '../shell/theme';
import { LISTS, batchTitle, batchesOf, listRows, type BoardRow, type ListKey } from './workshopLists';

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
  list: ListKey = 'new';
  search = '';
  private readonly tabs = document.createElement('div');
  private readonly rowsBox = document.createElement('div');
  private readonly tabButtons = new Map<ListKey, HTMLButtonElement>();
  private rows: readonly BoardRow[] = [];
  private selected = '';

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
    const fresh = document.createElement('div');
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

  /** Shows the rows anew, with the board in hand marked among them. */
  show(rows: readonly BoardRow[], selected: string): void {
    const moved = selected !== this.selected;
    this.rows = rows;
    this.selected = selected;
    this.redraw();
    // A board just opened is brought into sight in the list; the list is not scrolled for anything else.
    if (moved) this.rowsBox.querySelector<HTMLElement>('[data-selected]')?.scrollIntoView({ block: 'nearest' });
  }

  private redraw(): void {
    const { palette } = this;
    for (const [key, button] of this.tabButtons) light(palette, button, key === this.list);
    const shown = listRows(this.rows, this.list, this.search);
    const lines: HTMLElement[] = [];
    if (this.list === 'new') {
      for (const batch of batchesOf(shown)) {
        const title = document.createElement('div');
        title.textContent = batchTitle(batch);
        title.style.cssText = `padding:8px 10px 2px;color:${palette.dim}`;
        lines.push(title, ...batch.rows.map((row) => this.line(row)));
      }
    } else lines.push(...shown.map((row) => this.line(row)));
    this.rowsBox.replaceChildren(...lines);
  }

  /** A row of a list: the picture of the board, its name and the last words said of it. */
  private line(row: BoardRow): HTMLElement {
    const { palette } = this;
    const line = document.createElement('div');
    line.style.cssText = `display:flex;gap:8px;align-items:center;padding:4px 10px;cursor:pointer;border-bottom:1px solid ${palette.faint};${row.name === this.selected ? `background:${palette.faint};` : ''}`;
    if (row.name === this.selected) line.dataset.selected = '';
    line.addEventListener('click', () => this.pick(row.name));
    // The picture stands in a box of its own size from the start, so that a list is as tall before its pictures are drawn as after.
    const picture = document.createElement('div');
    picture.style.cssText = 'flex:0 0 56px;height:56px;display:flex;align-items:center;justify-content:center';
    const image = document.createElement('img');
    if (row.spec) image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(boardSvg(row.spec, { cell: 9 }))}`;
    image.style.cssText = 'display:block;max-width:56px;max-height:56px';
    picture.append(image);
    const text = document.createElement('div');
    text.style.cssText = 'min-width:0';
    const name = document.createElement('div');
    name.textContent = row.name;
    const words = document.createElement('div');
    words.textContent = row.head.words?.at(-1)?.text ?? '';
    words.style.cssText = `color:${palette.dim};overflow:hidden;text-overflow:ellipsis;white-space:nowrap`;
    text.append(name, words);
    line.append(picture, text);
    return line;
  }
}
