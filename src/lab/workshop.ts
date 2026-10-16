import { boardNameOf, isBoardName } from '../app/boardProbe';
import type { Game } from '../app/game';
import { normalSpec, parseBoard, printBoard, readBoardHead, type BoardHead } from '../levels/boardFile';
import { BATCH_WORD } from '../levels/labText';
import { resolveName } from '../levels/library';
import type { LevelSpec } from '../rules/types';
import { PROGRAM_FONT, paletteAt, shellDefaults } from '../shell/theme';
import { addPlay, listHeads, onBoardChanged, readBoard, renameBoard, writeBoard, writeHead } from './boardsClient';
import { boardHash } from './boardsServer';
import { BoardStage } from './boardStage';
import { copyText } from './clipboard';
import { SIZE_MAX, SIZE_MIN, displaySpecOf, editBoardOf, emptyBoard, resize, textOf, type EditBoard } from './editBoard';
import { PlayWatch, type Inside, type ToldPlay } from './playWatch';
import { WayShow, wayToShow } from './showWay';
import { BoardFacts } from './workshopFacts';
import { WorkshopCampaign } from './workshopCampaign';
import { WorkshopListView, buttonOf, fieldStyle, light } from './workshopListView';
import { VERDICTS, freeName, listRows, nextInBatch, rowOf, verdictPatch, type BoardRow, type Verdict } from './workshopLists';
import { WorkshopRow } from './workshopRow';

/** The width of the column of the lists on the left: the board of the game stands to the right of it. */
const LIST_WIDTH = 320;
/** A change is written to its file this long after it is made, and after the last of several made together. */
const SAVE_MS = 300;

const today = (): string => new Date().toISOString().slice(0, 10);
/** Whether a key is typed into a field of the page: such a key is the field's, and goes nowhere else. */
const typed = (event: Event): boolean => event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);

/** The head of a board that has just been begun: a board to clear on the face 2, the floor open. */
function newHead(id: string): LevelSpec {
  return { id, seed: 0, size: 4, goal: { kind: 'clear' }, moves: 0, values: [2], norm: 0, arrival: 'none', sinkMoves: 2, liftMoves: 1, faces: [2] };
}

/**
 * The workshop of the levels, `?lab=workshop` (docs/superpowers/specs/2026-10-15-vi-level-workshop-design.md,
 * sections 3 and 4): the lists of the boards on the left, and in the middle the game itself with
 * the stage of the boards laid over it (`BoardStage`). A click on a row puts its board on the
 * stage; `E` plays the board as it stands on the real rules, and `E` again stands it back. When
 * a play is written down, a bar under the board takes what the owner says of it: good, to be
 * done again, or to be dropped, and a line of words.
 *
 * Two things are counted of a board, and only when they are asked for: `V` plays the fewest moves
 * from its start on the board of the game, and `C` says in plain lines under the board what the
 * solver and the bots make of it. With nothing pressed, the page shows no number.
 *
 * The file is the truth, as on the lab of the levels before it. Every change is written to it a
 * moment later; a change of the file made by anyone else is read at once, unless a change made
 * here is still waiting to be written. A file that is no board is shown with what is wrong with
 * it and is not written over.
 */
export function startWorkshop(game: Game): void {
  // The page in hand, for whoever looks at it from the console: `window.viWorkshop`.
  (window as unknown as { viWorkshop: Workshop }).viWorkshop = new Workshop(game);
}

class Workshop {
  private readonly inside: Inside;
  private readonly palette = paletteAt(shellDefaults(), 0);
  private readonly lists: WorkshopListView;
  /** The row of the campaign: «в кампании», «поставить в ряд», and the chapters the boards are placed by. */
  private readonly row: WorkshopRow;
  private readonly campaign: WorkshopCampaign;
  private readonly editor: BoardStage;
  private readonly watcher: PlayWatch;
  /** Every file of `boards/` as a row of the lists. */
  private rows: BoardRow[] = [];

  /** The file in hand, by its name; empty where there is none. */
  private name = '';
  /** What the file says besides its cells: the head of the level, and the note, the status and the words. */
  private head: LevelSpec = newHead('H01');
  private extra: BoardHead = {};
  /** The board as a level, where the rules take it for one; what they say, where they do not. */
  private spec: LevelSpec | null = null;
  private error: string | null = null;
  /** The text the file is known to hold. */
  private saved = '';
  private saveTimer = 0;
  /** The ways of the boards that were in hand with one, each under its board as text with no way in it. */
  private readonly ways = new Map<string, Pick<LevelSpec, 'par' | 'exact' | 'solution'>>();
  /** The board the scene of the game shows, as text: a board is put on anew only when it is another. */
  private presented = '';
  private playing = false;
  /** The play last written down, while the owner is asked of it; and the verdict he has chosen and not yet written. */
  private lastPlay: { name: string; at: string; wasNew: boolean } | null = null;
  private verdict: Verdict | null = null;

  /** What is counted of the board in hand, by «проверить» and «показать решение». */
  private readonly facts: BoardFacts;
  /** A way is shown: the board of the game is played by it, and the stage is taken away. */
  private showing = false;
  private readonly show: WayShow;

  private readonly topBar = document.createElement('div');
  private readonly stageBox = document.createElement('div');
  private readonly nameInput = document.createElement('input');
  private readonly sizeLabel = document.createElement('span');
  private readonly faceButtons: HTMLButtonElement[] = [];
  private readonly shutBox = document.createElement('input');
  private readonly sinkInput = document.createElement('input');
  private readonly liftInput = document.createElement('input');
  /** What is wrong with the board in hand, or that its start is only lent. */
  private readonly boardLine = document.createElement('div');
  private readonly playButton: HTMLButtonElement;
  private readonly checkButton: HTMLButtonElement;
  /** The place of the lines of «проверить», under the actions. */
  private readonly checkBox = document.createElement('pre');
  private readonly verdictBar = document.createElement('div');
  private readonly verdictTitle = document.createElement('span');
  private readonly verdictButtons = new Map<Verdict, HTMLButtonElement>();
  private readonly wordsInput = document.createElement('input');
  private readonly told = document.createElement('div');

  constructor(private readonly game: Game) {
    this.inside = game as unknown as Inside;
    // The page is worked on beside other windows: the game does not stand still when it is hidden.
    game.awake = true;
    this.watcher = new PlayWatch(this.inside, (record, of) => this.tellPlay(record, of.name));
    // The way is shown on the game as keys, read off its run: it is no play of the owner, and nothing of it is written down.
    // A key the game has not taken is dropped from its own input when the way is stopped, as `Inside` reads its run; a game without that input drops nothing.
    const { inside } = this;
    const { controller } = game as unknown as { controller?: { cancel(): void } };
    this.show = new WayShow({ get state() { return inside.state; }, press: (dir) => game.press(dir), cancel: () => controller?.cancel() }, (line) => this.say(line));
    const { palette } = this;
    this.lists = new WorkshopListView(palette, LIST_WIDTH, (name) => void this.open(name), (word) => void this.makeNew(word));
    const page = {
      say: (line: string) => this.say(line),
      save: () => this.save(),
      stage: () => this.editor,
      readLists: () => this.readLists(),
      reread: async (name: string) => (await this.changedOutside(name), this.showHead()),
      show: () => this.showHead(),
      open: (name: string) => this.open(name),
    };
    this.row = new WorkshopRow(palette, this.lists, page);

    // The game stands to the right of the lists: its page is moved over, and the board is laid in what is left.
    const app = document.getElementById('app');
    if (app) app.style.left = `${LIST_WIDTH}px`;
    const frame = document.createElement('div');
    frame.style.cssText = `position:fixed;left:${LIST_WIDTH}px;top:0;right:0;bottom:0;z-index:900;display:flex;flex-direction:column;pointer-events:none;color:${palette.ink};font:13px/1.4 ${PROGRAM_FONT}`;
    const bar = `display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:6px 10px;pointer-events:auto;background:${palette.bg}`;
    this.topBar.style.cssText = `${bar};border-bottom:1px solid ${palette.faint}`;
    this.stageBox.style.cssText = 'position:relative;flex:1;min-height:0;pointer-events:auto';
    const bottom = document.createElement('div');
    bottom.style.cssText = `display:flex;flex-direction:column;gap:4px;padding:6px 10px;pointer-events:auto;background:${palette.bg};border-top:1px solid ${palette.faint}`;
    frame.append(this.topBar, this.stageBox, bottom);
    document.body.append(this.lists.root, frame);

    this.editor = new BoardStage(this.stageBox, (x, z, y) => game.cellPoint(x, z, y), () => this.edited(true), (board) => this.present(board));
    this.playButton = buttonOf(palette, 'играть (E)', () => this.togglePlay());
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
    this.checkButton = buttonOf(palette, 'проверить (C)', () => this.facts.toggle());
    this.facts = new BoardFacts(this.checkBox, this.checkButton, palette, () => (this.showWay(), this.campaign.told()));
    this.campaign = new WorkshopCampaign(palette, this.facts, this.row, {
      ...page,
      board: () => ({ name: this.name, head: this.head, extra: this.extra, spec: this.spec, board: this.editor.current, locked: this.editor.locked }),
      names: () => this.rows.map((row) => row.name),
      // The way proved is laid into the head and written, and remembered for the board as it stands.
      keep: (way) => ((this.head = { ...this.head, ...way }), this.keepWay(), this.edited(false)),
    });
    this.buildTop();
    actions.append(this.playButton, buttonOf(palette, 'показать решение (V)', () => this.solution()), this.checkButton, buttonOf(palette, 'копировать для чата', () => void this.copy()), this.row.insertButton, this.campaign.copyButton, this.campaign.swapButton);
    this.buildVerdict();
    this.told.style.cssText = `color:${palette.dim};min-height:1.4em`;
    bottom.append(actions, this.row.form, this.checkBox, this.verdictBar, this.told);

    // The keys are the stage's while the board is set out: the game under it gets none of them.
    const keys = (event: KeyboardEvent): void => {
      // A key typed into a field is the field's: the fields stop it short of the game (below).
      if (typed(event)) return;
      const plain = !event.ctrlKey && !event.metaKey && !event.altKey;
      // While a way is shown, a key stops it where it stands, and goes no further: `E` goes back to the stage, `V` shows the way again once it is stopped.
      if (this.showing) {
        event.stopImmediatePropagation();
        if (event.type !== 'keydown' || event.repeat) return;
        const running = this.show.running;
        this.show.stop(true);
        if (!plain) return;
        if (event.code === 'KeyE') this.endShow();
        else if (event.code === 'KeyV' && !running) this.solution();
        else if (event.code === 'KeyC') this.facts.toggle();
        else return;
        event.preventDefault();
        return;
      }
      // The verdict after a play is taken first, in a play and out of one alike.
      if (event.type === 'keydown' && plain && this.verdictKey(event.code)) {
        event.stopImmediatePropagation();
        event.preventDefault();
        return;
      }
      if (event.type === 'keydown' && plain && event.code === 'KeyE') {
        event.stopImmediatePropagation();
        event.preventDefault();
        if (!event.repeat) this.togglePlay();
        return;
      }
      if (event.type === 'keydown' && plain && (event.code === 'KeyV' || event.code === 'KeyC')) {
        event.stopImmediatePropagation();
        event.preventDefault();
        if (event.repeat) return;
        if (event.code === 'KeyV') this.solution();
        else this.facts.toggle();
        return;
      }
      if (this.playing) return;
      event.stopImmediatePropagation();
      if (event.type === 'keydown' && this.editor.key(event)) event.preventDefault();
    };
    window.addEventListener('keydown', keys, true);
    window.addEventListener('keyup', keys, true);
    for (const box of [this.lists.root, frame]) for (const type of ['keydown', 'keyup'] as const) box.addEventListener(type, (event) => typed(event) && event.stopPropagation());
    window.addEventListener('beforeunload', () => void this.save());

    onBoardChanged((name) => void this.changedOutside(name));
    this.inside.audio.setAway(true);
    void this.begin();
  }

  /** The bar over the board: its name, its side, its faces, and the rules of the board folded away. */
  private buildTop(): void {
    const { palette, topBar } = this;
    this.nameInput.style.cssText = fieldStyle(palette, 'width:200px');
    this.nameInput.title = 'имя доски; Enter — переименовать';
    this.nameInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') void this.rename(this.nameInput.value.trim());
      else if (event.key === 'Escape') this.nameInput.value = this.name;
    });
    this.nameInput.addEventListener('blur', () => (this.nameInput.value = this.name));
    const side = (by: number): void => {
      const size = this.editor.current.size + by;
      if (size >= SIZE_MIN && size <= SIZE_MAX) this.editor.change(resize(this.editor.current, size));
    };
    const faces = document.createElement('span');
    faces.textContent = 'грани ';
    for (let face = 1; face <= 6; face++) {
      const button = buttonOf(palette, String(face), () => this.toggleFace(face));
      this.faceButtons.push(button);
      faces.append(button);
    }
    const rules = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'правила доски';
    summary.style.cursor = 'pointer';
    const label = (text: string, input: HTMLInputElement): HTMLLabelElement => {
      const made = document.createElement('label');
      made.style.cssText = 'margin-left:10px';
      made.append(input, ` ${text}`);
      return made;
    };
    this.shutBox.type = 'checkbox';
    for (const [input, min, max] of [[this.sinkInput, 1, 6], [this.liftInput, 0, 6]] as const) {
      input.type = 'number';
      input.min = String(min);
      input.max = String(max);
      input.style.cssText = fieldStyle(palette, 'width:44px');
    }
    for (const input of [this.shutBox, this.sinkInput, this.liftInput]) input.addEventListener('change', () => this.rulesChanged());
    rules.append(summary, label('пол закрыт', this.shutBox), label('sink: ходов до ухода', this.sinkInput), label('lift: ходов подъёма', this.liftInput));
    this.boardLine.style.cssText = `flex-basis:100%;color:${palette.dim};min-height:1.4em`;
    topBar.append(this.nameInput, buttonOf(palette, '−', () => side(-1)), this.sizeLabel, buttonOf(palette, '+', () => side(1)), faces, rules, this.boardLine, this.campaign.line);
  }

  /** The bar of the verdict, shown when a play has been written down: three buttons, a line of words, and the button that writes them. */
  private buildVerdict(): void {
    const { palette, verdictBar } = this;
    verdictBar.style.cssText = 'display:none;flex-wrap:wrap;gap:6px;align-items:center';
    verdictBar.append(this.verdictTitle);
    for (const { verdict, label } of VERDICTS) {
      const button = buttonOf(palette, label, () => this.choose(verdict));
      this.verdictButtons.set(verdict, button);
      verdictBar.append(button);
    }
    this.wordsInput.placeholder = 'слова о доске; Enter — записать';
    this.wordsInput.style.cssText = fieldStyle(palette, 'flex:1;min-width:160px');
    this.wordsInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      void this.writeVerdict();
    });
    verdictBar.append(this.wordsInput, buttonOf(palette, 'записать', () => void this.writeVerdict()));
  }

  /** Opens the board the address names, `?lab=workshop&board=bridge-3` (or a name it had), or the first of the new boards, or the first there is. */
  private async begin(): Promise<void> {
    await this.readLists();
    const asked = boardNameOf(window.location.search);
    const named = asked ? resolveName(asked, this.rows) : null;
    const fresh = listRows(this.rows, 'new', '')[0]?.name;
    if (!fresh) this.lists.list = 'all';
    const first = named ?? fresh ?? listRows(this.rows, 'all', '')[0]?.name;
    if (first) await this.open(first);
    else this.showAll();
  }

  /** Reads every file and the row anew, as the rows of the lists. */
  private async readLists(): Promise<void> {
    try {
      this.rows = await this.row.lay(await listHeads());
    } catch (error) {
      this.say((error as Error).message);
    }
    if (this.name !== '') this.measure();
    this.lists.show(this.rows, this.name);
  }

  /** A file changed on the disk, by this page or by anyone: its row is read again, and just written, it is the last touched. */
  private async reread(name: string): Promise<string | null> {
    let text: string;
    try {
      text = await readBoard(name);
    } catch {
      // The file is gone, renamed or taken away: the lists are read from the start.
      await this.readLists();
      return null;
    }
    const row = rowOf({ name, text, hash: boardHash(text, name), time: new Date().toISOString() }, this.row.chapters);
    const at = this.rows.findIndex((one) => one.name === name);
    if (at < 0) this.rows.push(row);
    else this.rows[at] = row;
    // A board of the row changed: the row is laid again on it, row.json read anew with it.
    if (this.row.holds(name)) {
      this.rows = await this.row.relay(this.rows);
      if (this.name !== '') this.measure();
    }
    this.lists.show(this.rows, this.name);
    return text;
  }

  /** A file of `boards/` was changed on the disk. The one in hand is read again too, unless a change made here waits to be written. */
  private async changedOutside(name: string): Promise<void> {
    const text = await this.reread(name);
    if (text === null || name !== this.name || this.saveTimer !== 0 || text === this.saved) return;
    this.load(name, text, true);
  }

  /** Opens a board by the name of its file: what waits to be written of the one in hand is written first. */
  private async open(name: string): Promise<void> {
    this.leave();
    if (this.saveTimer !== 0) await this.save();
    try {
      this.load(name, await readBoard(name));
    } catch (error) {
      this.say((error as Error).message);
    }
  }

  /** Takes a text as the board in hand. A text that is no board is shown with what is wrong, and the stage is shut on it. The head is read first: the solver asks after a board of the row by its status. */
  private load(name: string, text: string, sameBoard = false): void {
    // The verdict asked is of the board played: another board opened, it is asked no more.
    if (!sameBoard && this.lastPlay && this.lastPlay.name !== name) this.ask(null);
    this.name = name;
    this.saved = text;
    this.extra = readBoardHead(text);
    this.read(text);
    this.editor.locked = false;
    // A board the rules refuse, one with no start as every new board is, is opened as it is written: only a file that cannot be read is shut.
    let shown = this.spec;
    if (!shown) {
      try {
        shown = parseBoard(text, name, true);
      } catch {
        shown = null;
      }
    }
    if (shown) {
      this.head = shown;
      this.editor.sink = shown.sinkMoves ?? 2;
      this.editor.show(editBoardOf(shown), sameBoard);
      this.keepWay();
    } else {
      this.editor.show(emptyBoard(SIZE_MIN));
      this.editor.locked = true;
    }
    this.showAll();
  }

  /** Holds a text against the rules: the level it is, or what is wrong with it. */
  private read(text: string): void {
    try {
      this.spec = parseBoard(text, this.name);
      this.error = null;
    } catch (error) {
      this.spec = null;
      this.error = (error as Error).message;
    }
    this.measure();
  }

  /** The board in hand as the player meets it: a board of the row on the faces of its chapter, with the floor its chapter gives it (`WorkshopRow.asPlayed`). */
  private played(): LevelSpec | null {
    return this.spec && this.row.asPlayed(this.spec, this.name, this.rows);
  }

  /**
   * The facts are of the board as it is played: the solver proves the way of a board of the row on
   * the faces of its chapter, as the row is tested. Told again whenever the row is read, since a
   * board moved to another chapter plays on other faces with its file the same.
   */
  private measure(): void {
    // Another board: the way asked for was of the board that was.
    const wanted = this.facts.wanted;
    if (this.facts.of(this.played(), this.error) && wanted) this.say('');
  }

  /** The board in hand as the text of its file. */
  private text(): string {
    return textOf(this.editor.current, this.head, this.extra);
  }

  /** The way the board in hand keeps is remembered for the board as it stands. */
  private keepWay(): void {
    const { par, exact, solution, ...rest } = this.head;
    if (par === undefined && solution === undefined) return;
    this.ways.set(textOf(this.editor.current, rest), { ...(par !== undefined ? { par } : {}), ...(exact !== undefined ? { exact } : {}), ...(solution ? { solution } : {}) });
  }

  /**
   * The board or its head has been changed here. A change of the board itself makes what the file
   * kept of its way a thing of another board: it is dropped, and comes back if the board does.
   * The file is written a moment later.
   */
  private edited(board: boolean): void {
    if (this.name === '' || this.editor.locked) return;
    if (board) {
      const { par: _par, exact: _exact, solution: _solution, ...rest } = this.head;
      this.head = { ...rest, ...this.ways.get(textOf(this.editor.current, rest)) };
    }
    this.read(this.text());
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => void this.save(), SAVE_MS);
    this.showHead();
  }

  private async save(): Promise<boolean> {
    window.clearTimeout(this.saveTimer);
    this.saveTimer = 0;
    const text = this.name === '' || this.editor.locked ? this.saved : this.text();
    if (text === this.saved) return true;
    const before = this.saved;
    this.saved = text;
    try {
      await writeBoard(this.name, text);
    } catch (error) {
      // Not written: the next change, or the next try, writes it.
      if (this.saved === text) this.saved = before;
      this.say((error as Error).message);
      return false;
    }
    return true;
  }

  /**
   * Puts a board on the board of the game to be looked at: the board as drawn where the rules
   * lay it, and with the player lent a place where it has no start yet (`displaySpecOf`). A board
   * the rules lay nothing of leaves the scene as it was; what is wrong is said over the board.
   */
  private present(board: EditBoard): void {
    if (this.playing || this.showing) return;
    const { spec } = displaySpecOf(board, this.head);
    if (!spec) return;
    const text = printBoard(normalSpec(spec));
    if (text === this.presented) return;
    this.presented = text;
    this.game.showBoard(spec);
  }

  /** A face is made a face of the board, or no more one: a board keeps one face at the least. */
  private toggleFace(face: number): void {
    if (this.name === '' || this.editor.locked) return;
    const now = this.head.faces ?? this.head.values;
    const faces = now.includes(face) ? now.filter((one) => one !== face) : [...now, face].sort((a, b) => a - b);
    if (faces.length === 0) return;
    this.head = { ...this.head, faces, values: [...faces] };
    this.edited(true);
    this.present(this.editor.current);
  }

  /** The rules of the board, folded under the bar, are changed: the floor, `sink` and `lift`. */
  private rulesChanged(): void {
    if (this.name === '' || this.editor.locked) return this.showHead();
    const bound = (input: HTMLInputElement, min: number, max: number, was: number): number => {
      const value = Math.round(Number(input.value));
      return Number.isFinite(value) && input.value !== '' ? Math.min(max, Math.max(min, value)) : was;
    };
    const { floor: _floor, ...rest } = this.head;
    const sink = bound(this.sinkInput, 1, 6, rest.sinkMoves ?? 2);
    const lift = bound(this.liftInput, 0, 6, rest.liftMoves ?? 1);
    this.head = { ...rest, sinkMoves: sink, liftMoves: lift, ...(this.shutBox.checked ? { floor: false } : {}) };
    this.editor.sink = sink;
    this.edited(true);
    this.present(this.editor.current);
  }

  /** The name in the bar is given to the board: its file, history and plays go over to it. A name refused is said, and the field has the old one again. */
  private async rename(to: string): Promise<void> {
    const from = this.name;
    if (from === '' || to === from) return;
    // A file that cannot be read is shut on the stage, and is mended in the file itself: the page does not take it over to another name.
    if (this.editor.locked) {
      this.nameInput.value = from;
      return this.say('не переименовано: файл не читается как доска — сперва поправить его в самом файле');
    }
    if (!isBoardName(to)) {
      this.nameInput.value = from;
      return this.say('имя: латинские буквы, цифры, - и _');
    }
    this.leave();
    await this.save();
    // No change is taken while the file goes over: it would be written under the old name. A rename refused leaves the stage as it was, and shows it again for what was counted meanwhile.
    const locked = this.editor.locked;
    this.editor.locked = true;
    try {
      await renameBoard(from, to);
    } catch (error) {
      this.editor.locked = locked;
      this.nameInput.value = from;
      this.showHead();
      return this.say(`не переименовано: ${(error as Error).message}`);
    }
    if (this.lastPlay?.name === from) this.lastPlay = { ...this.lastPlay, name: to };
    this.name = to;
    this.nameInput.blur();
    await this.readLists();
    await this.open(to);
    this.say(`${from} → ${to}`);
  }

  /** A board begun anew: `<word>-<n>` under the first number that is free, a square of four with the face 2, to be done. */
  private async makeNew(word: string): Promise<void> {
    const said = word.trim();
    if (!BATCH_WORD.test(said)) return this.say('слово: маленькие латинские буквы и цифры, слова через -');
    const name = freeName(said, this.rows.map((row) => row.name));
    if (!isBoardName(name)) return this.say(`не имя доски: ${name}`);
    this.leave();
    await this.save();
    const head = newHead(name);
    const text = textOf(emptyBoard(head.size), head, { status: 'D' });
    try {
      await writeBoard(name, text);
    } catch (error) {
      return this.say((error as Error).message);
    }
    await this.readLists();
    this.load(name, text);
  }

  /** `E`: the board as it stands is put on the board of the game and played; again, and the stage is back over the game. */
  private togglePlay(): void {
    if (this.showing) return this.endShow();
    if (!this.playing) {
      const spec = this.played();
      if (!spec) return this.say(this.error ? `не играется: ${this.error}` : 'нет доски');
      // A way waited for is not shown over a play.
      this.facts.wanted = false;
      this.playing = true;
      this.topBar.style.visibility = this.stageBox.style.visibility = 'hidden';
      this.inside.audio.setAway(false);
      // A new play: what was asked of the one before is asked no more.
      this.ask(null);
      this.game.playBoard(spec);
      // The plays of the board as it stands are watched, to be written down as each is over.
      this.watcher.start({ name: this.name, hash: boardHash(this.text(), this.name) ?? '', par: spec.par ?? null, measures: { size: spec.size, dice: spec.norm } });
      this.say('партия: Z — ход назад, R — заново, E — к расстановке');
    } else {
      this.watcher.stop();
      this.playing = false;
      this.backToStage();
    }
    this.playButton.textContent = this.playing ? 'расставлять (E)' : 'играть (E)';
  }

  /** The stage is back over the game, and the board drawn is put back on the board of the game, as it was before it was played or shown. */
  private backToStage(): void {
    this.topBar.style.visibility = this.stageBox.style.visibility = '';
    this.inside.audio.setAway(true);
    this.presented = '';
    this.present(this.editor.current);
    this.editor.canvas.focus();
    this.say('');
  }

  /** A play, or a way shown, is left before another board is taken up. */
  private leave(): void {
    if (this.showing) this.endShow();
    if (this.playing) this.togglePlay();
  }

  /** `V`: the fewest moves are played from the start of the board, once the solver has them; in the middle of a way shown, it is stopped. */
  private solution(): void {
    if (this.playing) return this.say('решение показывается из расстановки: E — к ней');
    if (this.show.running) return this.show.stop(true);
    if (!this.spec) return this.say(this.error ? `правила не принимают доску: ${this.error}` : 'нет доски');
    this.facts.wanted = true;
    this.facts.ask();
    const refused = this.facts.instant?.error;
    if (refused) {
      this.facts.wanted = false;
      return this.say(`правила не принимают доску: ${refused}`);
    }
    this.showWay();
  }

  /** The way asked for is shown once the solver has counted the board: put on from its start and played on the real rules as the player meets it, the stage taken away as in a play. */
  private showWay(): void {
    const spec = this.played();
    const { seconds } = this.facts;
    if (!this.facts.wanted || !spec || this.playing) return;
    if (seconds === null) return this.say('решаю…');
    this.facts.wanted = false;
    const way = wayToShow(spec, seconds);
    if (typeof way === 'string') return this.say(way);
    this.showing = true;
    this.topBar.style.visibility = this.stageBox.style.visibility = 'hidden';
    this.playButton.textContent = 'расставлять (E)';
    // The way is often begun from the answer of the solver, where a failure would go unheard: it is said, and the stage is back.
    try {
      this.inside.audio.setAway(false);
      this.game.playBoard(spec);
      this.show.start(way);
    } catch (error) {
      this.endShow();
      this.say(`решение не показать: ${(error as Error).message}`);
    }
  }

  /** `E` while a way is shown: the stage is back, as after a play, and nothing is written down. */
  private endShow(): void {
    this.show.stop();
    this.showing = false;
    this.backToStage();
    this.playButton.textContent = 'играть (E)';
  }

  private tellPlay(record: ToldPlay, name: string): void {
    void addPlay(name, record).catch((error: Error) => this.say(error.message));
    const row = this.rows.find((one) => one.name === name);
    this.ask({ name, at: record.at, wasNew: row?.head.status === 'N' });
  }

  /** Begins to ask the verdict of a play, or stops asking: the bar is shown while it is asked. */
  private ask(play: Workshop['lastPlay']): void {
    this.lastPlay = play;
    this.verdict = null;
    this.wordsInput.value = '';
    this.verdictBar.style.display = play ? 'flex' : 'none';
    if (play) this.verdictTitle.textContent = `${play.name}:`;
    else if (document.activeElement === this.wordsInput) this.wordsInput.blur();
    this.showVerdict();
  }

  /** A key while the verdict is asked; true where it was the verdict's. */
  private verdictKey(code: string): boolean {
    if (!this.lastPlay) return false;
    const chosen = VERDICTS.find((one) => one.keys.includes(code));
    if (chosen) this.choose(chosen.verdict);
    else if ((code === 'Enter' || code === 'NumpadEnter') && this.verdict) void this.writeVerdict();
    else return false;
    return true;
  }

  /** A verdict is chosen: it is lit, and the line of the words takes the keys next. */
  private choose(verdict: Verdict): void {
    if (!this.lastPlay) return;
    this.verdict = verdict;
    this.showVerdict();
    this.wordsInput.focus();
  }

  private showVerdict(): void {
    for (const [verdict, button] of this.verdictButtons) light(this.palette, button, verdict === this.verdict);
  }

  /**
   * The verdict and the words are written into the head of the file (a board of the row keeps R:
   * it gets the verdict as a word, `verdictPatch`), and over the play in `plays.jsonl`. A new
   * board done with, the next board of its batch is opened.
   */
  private async writeVerdict(): Promise<void> {
    const play = this.lastPlay;
    const row = play && this.rows.find((one) => one.name === play.name);
    if (!play || !row) return;
    const { verdict } = this;
    const said = this.wordsInput.value.replace(/\s+/g, ' ').trim();
    const patch = verdictPatch(row.head.status, verdict, said, today());
    if (!patch) return;
    // The next board is taken before the verdict moves this one out of the new. Words alone leave the board where it is, and the page with it.
    const next = play.wasNew && verdict ? nextInBatch(this.rows, play.name) : null;
    // What waits to be written of the board in hand is written first: the head is laid over the file as it is.
    if (play.name === this.name) await this.save();
    try {
      await writeHead(play.name, patch);
      await addPlay(play.name, { at: play.at, patch: { ...(verdict ? { verdict } : {}), ...(said ? { words: said } : {}) } });
    } catch (error) {
      return this.say((error as Error).message);
    }
    this.ask(null);
    this.say(`${play.name}: записано${verdict ? ` — ${VERDICTS.find((one) => one.verdict === verdict)?.label.slice(2)}` : ''}${said ? ', слова' : ''}`);
    // The head of the file is read back at once, so that the next change here does not write the old one over it.
    await this.changedOutside(play.name);
    if (next) await this.open(next);
  }

  private async copy(): Promise<void> {
    if (this.name === '') return;
    const done = await copyText(`${this.name} — поставить на место: …\n${this.text()}`);
    this.say(done ? 'скопировано' : 'не вышло скопировать');
  }

  private say(text: string): void {
    this.told.textContent = text;
  }

  private showAll(): void {
    this.row.showFor(this.name);
    this.lists.show(this.rows, this.name);
    this.showHead();
  }

  /** The bar over the board, as the board in hand has it. */
  private showHead(): void {
    const { head, editor } = this;
    if (document.activeElement !== this.nameInput) this.nameInput.value = this.name;
    this.sizeLabel.textContent = `сторона ${editor.current.size}`;
    const faces = head.faces ?? head.values;
    this.faceButtons.forEach((button, index) => light(this.palette, button, faces.includes(index + 1)));
    this.shutBox.checked = head.floor === false;
    this.sinkInput.value = String(head.sinkMoves ?? 2);
    this.liftInput.value = String(head.liftMoves ?? 1);
    this.campaign.show();
    let line = '';
    if (this.name === '') line = 'нет досок: «новая доска» под списками';
    else if (editor.locked) line = `${this.error ?? ''} — файл не читается как доска: править его надо в самом файле, страница его не перезапишет`;
    else {
      const { stand, error } = displaySpecOf(editor.current, head);
      if (stand === 'lent') line = 'старта нет: фигурка на поле стоит условно — перетащите ○ из списка на кость или на пол';
      else if (error) line = `правила не принимают доску: ${error}`;
    }
    this.boardLine.textContent = line;
  }
}
