import GUI, { type Controller } from 'lil-gui';
import { boardNameOf, isBoardName } from '../app/boardProbe';
import type { Game } from '../app/game';
import { BOARD_STATUSES, normalSpec, parseBoard, printBoard, readBoardHead, type BoardHead, type BoardStatus } from '../levels/boardFile';
import { specFromState } from '../levels/snapshot';
import { REPORT_PLAYERS, scoreText } from '../rules/levelReport';
import { moveOf, tryWay } from '../rules/levelSolver';
import type { LevelSpec, RunState } from '../rules/types';
import { PROGRAM_FONT, paletteAt, shellDefaults } from '../shell/theme';
import { BoardEditor } from './boardEditor';
import { addPlay, listBoards, onBoardChanged, readBoard, writeBoard } from './boardsClient';
import { boardHash } from './boardsServer';
import { copyText } from './clipboard';
import { SIZE_MAX, SIZE_MIN, editBoardOf, emptyBoard, resize, textOf, type EditBoard } from './editBoard';
import { instantOf, type Ask, type Instant, type Later, type Seconds } from './labFacts';
import { playRecordOf } from './playLog';
import { CANCELLED, SolveClient, type WorkerLike } from './solveClient';

/** A change is written to its file this long after it is made, and after the last of several made together. */
const SAVE_MS = 300;
const COPY_LABEL = 'копировать текст доски';

/** A worker that asks boards: one to a tier, so that a quick answer does not wait behind a slow one. */
const solver = (): WorkerLike => new Worker(new URL('./solve.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;
/** A question without its number: the client numbers it. */
type Question<T extends Ask['tier']> = Omit<Extract<Ask, { tier: T }>, 'id'>;
const percent = (share: number): string => `${Math.round(share * 100)}%`;

/** What the lab reaches inside the game. These are private to it: the lab is a tool and looks inside. */
interface Inside {
  readonly state: RunState;
  /** Moves taken back since the board was put on. */
  readonly undosMade: number;
  readonly audio: { setAway(away: boolean): void };
}

/** A play of the board that is being watched: the run as it was last seen, when it began, and what it is a play of. */
interface Watched {
  state: RunState;
  undos: number;
  startedAt: number;
  name: string;
  hash: string;
  par: number | null;
  /** The play has been written down: one that clears the board is, at once. */
  told: boolean;
}

/** The head of a board that has just been begun: a board to clear on the face 2, the floor open. */
function newHead(id: string): LevelSpec {
  return { id, seed: 0, size: 4, goal: { kind: 'clear' }, moves: 0, values: [2], norm: 0, arrival: 'none', sinkMoves: 2, liftMoves: 1, faces: [2] };
}

/**
 * The page of the lab of the levels, `?lab=levels`: a board is drawn, played at once on the real
 * rules, and kept as the file of text it is (`boards/<name>.txt`). The page is the game itself
 * with the editor laid over it. `E` takes the editor away and puts the board as it stands on
 * the board of the game; `E` again brings the editor back, and the game waits under it.
 *
 * The file is the truth. Every change is written to it a moment later, and a change of the
 * file made by anyone else, an agent or an editor of code, is read at once, unless a change made
 * here is still waiting to be written. A file that is no board is shown with what is wrong with
 * it and is not written over: whoever broke it mends it.
 */
export function startLevelsLab(game: Game): void {
  new LevelsLab(game);
}

class LevelsLab {
  private readonly inside: Inside;
  private readonly palette = paletteAt(shellDefaults(), 0);
  private readonly root = document.createElement('div');
  private readonly facts = document.createElement('pre');
  private readonly badge = document.createElement('div');
  private readonly ribbon = document.createElement('div');
  private readonly editor: BoardEditor;
  private readonly gui = new GUI({ title: 'VI · уровни' });
  private fileControl!: Controller;
  private copyControl!: Controller;

  /** The file in hand, by its name; empty where there is none. */
  private name = '';
  private names: string[] = [];
  /** What the file says besides its cells: the head of the level, and the note and the status. */
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
  private playing = false;

  /** The board the numbers on the page are of, as text with nothing in it two files of one board could differ by. */
  private measured = '';
  private instant: Instant | null = null;
  /** The answers of the two slower tiers: the facts, `null` while they are counted, or what went wrong. */
  private seconds: Seconds | string | null = null;
  private later: Later | string | null = null;
  private readonly askSeconds = new SolveClient<Question<'seconds'>, Seconds>(solver);
  private readonly askLater = new SolveClient<Question<'later'>, Later>(solver);
  /** The move of the way the editor shows the board after; null where it shows the board itself, which is then the one kept in `drawn`. */
  private moment: number | null = null;
  private drawn: EditBoard | null = null;
  /** The play in hand, while the board is played. */
  private watched: Watched | null = null;
  /** The status every file says it has, for the list of the files. */
  private statuses = new Map<string, BoardStatus | undefined>();
  /** What the panel shows of the head: the panel edits this copy and the lab reads it. */
  private readonly form = { file: '', id: '', faces: '2', shut: false, sink: 2, lift: 1, size: 4, note: '', status: 'idea' as BoardStatus };

  constructor(private readonly game: Game) {
    this.inside = game as unknown as Inside;
    const { root, facts, badge, palette } = this;
    root.style.cssText = `position:fixed;inset:0;z-index:900;display:grid;grid-template-columns:340px minmax(0,1fr);grid-template-rows:minmax(0,1fr);padding-right:256px;box-sizing:border-box;background:${palette.bg};color:${palette.ink};font:13px/1.45 ${PROGRAM_FONT}`;
    facts.style.cssText = `margin:0;padding:12px 14px;overflow:auto;white-space:pre-wrap;border-right:1px solid ${palette.faint};font:inherit;color:${palette.ink}`;
    const stage = document.createElement('div');
    stage.style.cssText = 'display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden';
    const boardBox = document.createElement('div');
    boardBox.style.cssText = 'position:relative;flex:1;min-height:0';
    this.ribbon.style.cssText = `display:flex;flex-wrap:wrap;gap:4px;padding:6px 10px;min-height:30px;border-top:1px solid ${palette.faint}`;
    stage.append(boardBox, this.ribbon);
    root.append(facts, stage);
    badge.style.cssText = `position:fixed;left:50%;top:6px;transform:translateX(-50%);z-index:900;display:none;padding:2px 10px;background:${palette.bg};color:${palette.dim};border:1px solid ${palette.faint};font:12px ${PROGRAM_FONT};pointer-events:none`;
    badge.textContent = 'E — редактор · R — заново · Z — ход назад · N — снимок положения в новую доску';
    document.body.append(root, badge);
    this.editor = new BoardEditor(boardBox, () => this.edited(true));
    this.buildPanel();

    // The keys are the editor's while it is open: the game under it gets none of them.
    const keys = (event: KeyboardEvent): void => {
      const typed = event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
      if (typed) {
        event.stopImmediatePropagation();
        return;
      }
      if (event.type === 'keydown' && event.code === 'KeyE' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.stopImmediatePropagation();
        event.preventDefault();
        if (!event.repeat) this.togglePlay();
        return;
      }
      if (this.playing) {
        // `N` makes a new board of the board as it stands in the play. The other keys are the game's.
        if (event.code === 'KeyN' && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.stopImmediatePropagation();
          if (event.type === 'keydown' && !event.repeat) void this.snapshot();
        }
        return;
      }
      event.stopImmediatePropagation();
      if (event.type === 'keydown' && this.editor.key(event)) event.preventDefault();
    };
    window.addEventListener('keydown', keys, true);
    window.addEventListener('keyup', keys, true);
    window.addEventListener('beforeunload', () => void this.save());

    onBoardChanged((name) => void this.changedOutside(name));
    this.inside.audio.setAway(true);
    void this.begin();
  }

  /** Opens the board the address names, `?lab=levels&board=H01`, or the first there is. */
  private async begin(): Promise<void> {
    await this.readNames();
    const asked = boardNameOf(window.location.search);
    const first = asked && this.names.includes(asked) ? asked : this.names[0];
    if (first) await this.open(first);
    else this.show();
  }

  private async readNames(): Promise<void> {
    try {
      this.names = await listBoards();
    } catch (error) {
      this.error = (error as Error).message;
    }
    // The status of every file is read from its head, to stand beside its name in the list.
    await Promise.all(
      this.names.map(async (name) => {
        try {
          this.statuses.set(name, readBoardHead(await readBoard(name)).status);
        } catch {
          this.statuses.delete(name);
        }
      }),
    );
    this.listFiles();
  }

  /** The list of the files on the panel: every name with the status of its board. */
  private listFiles(): void {
    const labelled = Object.fromEntries(this.names.map((name) => [this.statuses.get(name) ? `${name} · ${this.statuses.get(name)}` : name, name]));
    this.fileControl = this.fileControl.options(labelled).name('файл').onChange((name: string) => void this.open(name));
  }

  private buildPanel(): void {
    const { gui, form } = this;
    const head = (): void => this.headChanged();
    this.fileControl = gui.add(form, 'file', this.names).name('файл');
    gui.add({ make: () => void this.makeNew() }, 'make').name('новая доска');
    gui.add({ play: () => this.togglePlay() }, 'play').name('играть / редактор (E)');
    const board = gui.addFolder('Доска');
    board.add(form, 'id').name('id').onFinishChange(head);
    board.add(form, 'faces').name('грани (через пробел)').onFinishChange(head);
    board.add(form, 'shut').name('пол закрыт').onChange(head);
    board.add(form, 'sink', 1, 6, 1).name('sink: ходов до ухода').onFinishChange(head);
    board.add(form, 'lift', 0, 6, 1).name('lift: ходов подъёма').onFinishChange(head);
    board.add(form, 'size', SIZE_MIN, SIZE_MAX, 1).name('сторона').onFinishChange((size: number) => this.editor.change(resize(this.editor.current, size)));
    board.add(form, 'note').name('заметка').onFinishChange(() => this.edited(false));
    board.add(form, 'status', [...BOARD_STATUSES]).name('статус').onChange(() => this.edited(false));
    this.copyControl = gui.add({ copy: () => void this.copy() }, 'copy').name(COPY_LABEL);
    gui.add({ keep: () => this.keepSolved() }, 'keep').name('записать путь решателя в файл');
  }

  /** The panel is set to what the board in hand says. */
  private syncForm(): void {
    const { form, head, extra } = this;
    form.file = this.name;
    form.id = head.id;
    form.faces = (head.faces ?? head.values).join(' ');
    form.shut = head.floor === false;
    form.sink = head.sinkMoves ?? 2;
    form.lift = head.liftMoves ?? 1;
    form.size = this.editor.current.size;
    form.note = extra.note ?? '';
    form.status = extra.status ?? 'idea';
    this.editor.sink = form.sink;
    for (const control of this.gui.controllersRecursive()) control.updateDisplay();
  }

  /** The panel has changed something of the head of the level: its id, its faces, its floor, its moves. */
  private headChanged(): void {
    const { form } = this;
    const faces = form.faces.split(/[\s,]+/).filter(Boolean).map(Number);
    const { floor: _floor, ...rest } = this.head;
    this.head = { ...rest, id: form.id.trim(), faces, values: [...faces], sinkMoves: form.sink, liftMoves: form.lift, ...(form.shut ? { floor: false } : {}) };
    this.editor.sink = form.sink;
    this.edited(true);
  }

  /**
   * The board or its head has been changed here. A change of the board itself makes what the file
   * kept of its way, the fewest moves and one way to make them, a thing of another board: it is
   * dropped, and comes back if the board does. The file is written a moment later.
   */
  private edited(board: boolean): void {
    if (this.name === '' || this.editor.locked) return;
    if (board) {
      // A board that is brought back to one whose way is known, by a step taken back or by hand, has its way again.
      const { par: _par, exact: _exact, solution: _solution, ...rest } = this.head;
      this.head = { ...rest, ...this.ways.get(textOf(this.editor.current, rest)) };
    }
    const note = this.form.note.trim();
    this.extra = { ...(note ? { note } : {}), status: this.form.status };
    if (this.statuses.get(this.name) !== this.form.status) {
      this.statuses.set(this.name, this.form.status);
      this.listFiles();
    }
    this.form.size = this.editor.current.size;
    this.read(this.text());
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => void this.save(), SAVE_MS);
    this.show();
  }

  /** The board in hand as the text of its file. */
  private text(): string {
    return textOf(this.editor.current, this.head, this.extra);
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

  /**
   * Asks the numbers of the board in hand, if it is another board than the one they are of: the
   * first tier here and now, the other two of the workers. A question that was waiting is of a
   * board that is gone: its worker is stopped, and what it would have said is never shown.
   */
  private measure(): void {
    const { spec } = this;
    const key = spec ? printBoard(normalSpec(spec)) : '';
    if (key === this.measured) return;
    this.measured = key;
    this.showBoard();
    this.askSeconds.cancel();
    this.askLater.cancel();
    this.instant = spec ? instantOf(spec) : null;
    this.seconds = null;
    this.later = null;
    if (!spec || this.instant?.error) return;
    const told = <T>(set: (facts: T | string) => void) => [
      (facts: T): void => {
        if (this.measured !== key) return;
        set(facts);
        this.show();
      },
      (error: Error): void => {
        if (error.message === CANCELLED || this.measured !== key) return;
        set(error.message);
        this.show();
      },
    ] as const;
    this.askSeconds.ask({ tier: 'seconds', spec }).then(...told<Seconds>((facts) => (this.seconds = facts)));
    this.askLater.ask({ tier: 'later', spec }).then(...told<Later>((facts) => (this.later = facts)));
  }

  /** Writes what the solver found into the head of the file: the fewest moves, whether they are proved, and the way. */
  private keepSolved(): void {
    const { seconds } = this;
    if (!seconds || typeof seconds === 'string' || seconds.check.par === null || !seconds.check.way || this.editor.locked) return;
    this.head = { ...this.head, par: seconds.check.par, exact: seconds.check.exact, solution: seconds.check.way };
    this.keepWay();
    this.edited(false);
  }

  /**
   * Shows the board as it stands after so many moves of the way the solver found: the editor is
   * shut on it, since it is a moment of a play and not the board. `null` shows the board again.
   */
  private async showMoment(moves: number | null): Promise<void> {
    const { spec, seconds } = this;
    if (moves === null || moves === 0 || !spec || !seconds || typeof seconds === 'string' || !seconds.check.way) {
      this.showBoard();
      this.show();
      return;
    }
    if (this.saveTimer !== 0) await this.save();
    if (this.moment === null) this.drawn = this.editor.current;
    const state = tryWay(spec, seconds.check.way.slice(0, moves).map(moveOf)).state;
    this.moment = moves;
    this.editor.locked = true;
    this.editor.show(editBoardOf(specFromState(state, spec)), true);
    this.show();
  }

  /** The editor shows the board itself again, and can change it. */
  private showBoard(): void {
    if (this.moment === null) return;
    this.moment = null;
    this.editor.locked = false;
    if (this.drawn) this.editor.show(this.drawn, true);
    this.drawn = null;
  }

  private async save(): Promise<void> {
    window.clearTimeout(this.saveTimer);
    this.saveTimer = 0;
    if (this.name === '' || this.editor.locked || this.moment !== null) return;
    const text = this.text();
    if (text === this.saved) return;
    this.saved = text;
    try {
      await writeBoard(this.name, text);
    } catch (error) {
      this.error = (error as Error).message;
    }
    this.show();
  }

  /** Opens a board by the name of its file: what waits to be written of the one in hand is written first. */
  private async open(name: string): Promise<void> {
    if (this.saveTimer !== 0) await this.save();
    try {
      this.load(name, await readBoard(name));
    } catch (error) {
      this.error = (error as Error).message;
      this.show();
    }
  }

  /** Takes a text as the board in hand. A text that is no board is shown with what is wrong, and the editor is shut on it. */
  private load(name: string, text: string, sameBoard = false): void {
    this.moment = null;
    this.drawn = null;
    this.name = name;
    this.saved = text;
    this.read(text);
    this.editor.locked = false;
    if (this.spec) {
      this.head = this.spec;
      this.extra = readBoardHead(text);
      this.editor.show(editBoardOf(this.spec), sameBoard);
      this.keepWay();
    } else {
      this.editor.show(emptyBoard(SIZE_MIN));
      this.editor.locked = true;
    }
    this.syncForm();
    this.show();
  }

  /** The way the board in hand keeps is remembered for the board as it stands. */
  private keepWay(): void {
    const { par, exact, solution, ...rest } = this.head;
    if (par === undefined && solution === undefined) return;
    this.ways.set(textOf(this.editor.current, rest), { ...(par !== undefined ? { par } : {}), ...(exact !== undefined ? { exact } : {}), ...(solution ? { solution } : {}) });
  }

  /** A file of `boards/` was changed on the disk. The one in hand is read again, unless a change made here waits to be written. */
  private async changedOutside(name: string): Promise<void> {
    if (!this.names.includes(name)) await this.readNames();
    if (name !== this.name || this.saveTimer !== 0) return;
    let text: string;
    try {
      text = await readBoard(name);
    } catch {
      return;
    }
    if (text === this.saved || this.saveTimer !== 0) return;
    this.load(name, text, true);
  }

  /** A board begun anew under the first name that is free: `H01`, `H02` and on. */
  private async makeNew(): Promise<void> {
    if (this.saveTimer !== 0) await this.save();
    let number = 1;
    const named = (): string => `H${String(number).padStart(2, '0')}`;
    while (this.names.includes(named())) number++;
    const name = named();
    if (!isBoardName(name)) return;
    const head = newHead(name);
    const text = textOf(emptyBoard(head.size), head, { status: 'idea' });
    await writeBoard(name, text);
    await this.readNames();
    this.load(name, text);
  }

  private async copy(): Promise<void> {
    const done = await copyText(this.text());
    this.copyControl.name(done ? 'скопировано' : 'не вышло скопировать');
    window.setTimeout(() => this.copyControl.name(COPY_LABEL), 1500);
  }

  /** `E`: the board as it stands is put on the board of the game and played; again, and the editor is back over the game. */
  private togglePlay(): void {
    if (!this.playing) {
      if (!this.spec) return;
      this.playing = true;
      this.root.style.display = 'none';
      this.gui.hide();
      this.badge.style.display = 'block';
      this.inside.audio.setAway(false);
      this.game.playBoard(this.spec);
      this.watch();
    } else {
      this.endPlay();
      this.playing = false;
      this.root.style.display = 'grid';
      this.gui.show();
      this.badge.style.display = 'none';
      this.inside.audio.setAway(true);
      this.editor.draw();
      this.editor.canvas.focus();
    }
  }

  /**
   * Watches the play of the board, frame by frame, to write it down when it is over. A play is
   * over when the board is cleared, which is written at once; when the board is started over;
   * and when the editor is come back to. A move taken back puts another run in the game's hand
   * and is no new play: the count of moves taken back tells the two apart.
   */
  private watch(): void {
    const seconds = this.seconds && typeof this.seconds !== 'string' ? this.seconds : null;
    const of = { name: this.name, hash: boardHash(this.text(), this.name) ?? '', par: seconds?.check.par ?? this.spec?.par ?? null };
    const begin = (): Watched => ({ ...of, state: this.inside.state, undos: this.inside.undosMade, startedAt: Date.now(), told: false });
    this.watched = null;
    const frame = (): void => {
      if (!this.playing) return;
      window.requestAnimationFrame(frame);
      const { state, undosMade } = this.inside;
      // The board is put on when the game has opened: until then the run in hand is no level.
      if (!state.levelRun) return;
      const play = this.watched;
      if (!play) {
        this.watched = begin();
        return;
      }
      if (state !== play.state && undosMade <= play.undos) {
        this.endPlay();
        this.watched = begin();
        return;
      }
      play.state = state;
      play.undos = undosMade;
      if (state.endReason === 'passed' && !play.told) this.tellPlay(play);
    };
    window.requestAnimationFrame(frame);
  }

  /** The play in hand is over: it is written down, unless it was already, or nothing was done in it. */
  private endPlay(): void {
    const play = this.watched;
    this.watched = null;
    if (play && !play.told && (play.state.levelRun?.moves ?? 0) > 0) this.tellPlay(play);
  }

  private tellPlay(play: Watched): void {
    play.told = true;
    void addPlay(play.name, playRecordOf(play.state, play.startedAt, Date.now(), play.undos, play)).catch((error: Error) => console.error(error));
  }

  /**
   * `N` in a play: the board as it stands is made a board of its own, under the name of the board
   * with a number after it, and opened in the editor. The dice that are going are written as
   * leaving. The world has to stand: in the middle of a move there is no board to write.
   */
  private async snapshot(): Promise<void> {
    const { state } = this.inside;
    const { spec } = this;
    if (!spec || !state.levelRun || state.player.action || state.cubes.some((cube) => cube.state === 'moving')) return;
    let number = 1;
    const named = (): string => `${this.name}-${number}`;
    while (this.names.includes(named())) number++;
    const name = named();
    if (!isBoardName(name)) return;
    const taken = { ...specFromState(state, spec), id: name };
    const text = printBoard(taken, { status: 'idea', note: `снимок ${this.name} после хода ${state.levelRun.moves}` });
    this.togglePlay();
    await writeBoard(name, text);
    await this.readNames();
    this.load(name, text);
  }

  /** What the page says of the board in hand, beside it. */
  private show(): void {
    const lines: string[] = [];
    if (this.name === '') lines.push('нет досок: «новая доска» на панели');
    else lines.push(`boards/${this.name}.txt${this.saveTimer !== 0 ? '  …пишется' : ''}`);
    if (this.error) lines.push('', this.error, ...(this.editor.locked ? ['', 'Файл не читается как доска: править его надо в самом файле. Страница его не перезапишет.'] : []));
    lines.push('', ...this.factLines());
    lines.push('', 'щелчок — кость / следующая грань', 'стрелки — прокатить на месте', 'правая кнопка, Del — очистить', 'H — вырез · Shift+щелчок — фикс.', 'P — старт · L — уходящая', 'Ctrl+Z / Ctrl+Y — отмена / повтор', 'E — играть');
    this.facts.textContent = lines.join('\n');
    this.showRibbon();
  }

  /** The way the solver found, a button to a move: a click shows the board after that move, and the first shows the board itself. */
  private showRibbon(): void {
    const { ribbon, seconds, palette } = this;
    ribbon.replaceChildren();
    const way = seconds && typeof seconds !== 'string' ? seconds.check.way : null;
    const score = seconds && typeof seconds !== 'string' ? seconds.check.score : null;
    if (!way) return;
    const button = (label: string, moves: number): void => {
      const made = document.createElement('button');
      const on = (this.moment ?? 0) === moves;
      made.textContent = label;
      made.style.cssText = `padding:2px 8px;font:inherit;cursor:pointer;background:${on ? palette.ink : palette.bg};color:${on ? palette.bg : palette.ink};border:1px solid ${palette.faint}`;
      made.addEventListener('click', () => void this.showMoment(moves));
      ribbon.append(made);
    };
    button('доска', 0);
    way.forEach((move, index) => {
      const event = score?.beats[index]?.event;
      button(`${index + 1}. ${move}${event && event !== 'none' ? ` ${event}` : ''}`, index + 1);
    });
  }

  /** What is known of the board, tier by tier: at once, in a second, later. */
  private factLines(): string[] {
    const { spec, instant, seconds, later } = this;
    if (!spec) return [];
    const lines = [`${spec.id}  ${spec.size}x${spec.size}, костей ${spec.norm}, грани ${(spec.faces ?? spec.values).join(' ')}, пол ${spec.floor === false ? 'закрыт' : 'открыт'}`];
    if (this.moment !== null) lines.push(`показана доска после хода ${this.moment}; «доска» под полем — вернуться`);
    if (instant) {
      lines.push('', '— сразу —');
      if (instant.error) lines.push(instant.error);
      else {
        lines.push(instant.deadEnd ? `тупик на старте: ${instant.deadEnd}` : 'на старте не тупик');
        if (instant.groups.length > 0) lines.push(`неполные группы: ${instant.groups.map((group) => `грань ${group.value} — ${group.have} из ${group.need}`).join('; ')}`);
      }
      if (instant.error) return lines;
    }
    lines.push('', '— секунды —');
    if (seconds === null) lines.push('считаю…');
    else if (typeof seconds === 'string') lines.push(seconds);
    else {
      const { check, firsts, moves } = seconds;
      if (check.par === null) lines.push(check.exact ? `пути нет: доска не очищается (досок ${check.states})` : `путь не найден: решатель сдался на ${check.states} досках`);
      else {
        lines.push(`ходов ${check.par}${check.exact ? '' : ' (минимум не доказан)'} · досок ${check.states}`);
        if (check.score) lines.push(`маршрут ${check.score.route}  (${check.score.kind})`);
        lines.push(`в файле: ${check.kept === null ? 'пути нет' : `par ${spec.par ?? '—'} — ${check.kept}`}`);
        lines.push(`первых ходов, после которых доска в руках: ${firsts}`);
        lines.push(`ходы со старта: ${moves.map((fact) => `${fact.move} ${fact.keeps}${fact.par === null ? '' : ` ${fact.par}`}`).join(' · ')}`);
        if (check.score) lines.push('', scoreText(check.score));
      }
    }
    lines.push('', '— фон —');
    if (later === null) lines.push('считаю…');
    else if (typeof later === 'string') lines.push(later);
    else {
      const { report, near } = later;
      lines.push(`прошли: ${REPORT_PLAYERS.map((name) => `${name} ${percent(report.personas[name].endings.passed)}`).join(' · ')}`);
      lines.push(`ловушки ${percent(report.traps)} жадных партий · случайный игрок ${percent(report.random)}`);
      if (report.graph) lines.push(`досок в двух ходах над минимумом: ${report.graph.states}; живых ${percent(report.graph.alive)}; кратчайших путей ${report.graph.ways >= 1000 ? '999+' : report.graph.ways}`);
      const count = (change: string): number => near.filter((fact) => fact.change === change).length;
      lines.push(`правки в одну кость: ${near.length} — то же ${count('same')}, короче ${count('shorter')}, длиннее ${count('longer')}, без пути ${count('unsolved')}`);
    }
    return lines;
  }

  /** The board in hand, for whoever looks at the lab from the console: `window.viLab.board()`. */
  board(): EditBoard {
    return this.editor.current;
  }
}
