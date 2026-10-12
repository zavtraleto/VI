import GUI, { type Controller } from 'lil-gui';
import { boardNameOf, isBoardName } from '../app/boardProbe';
import type { Game } from '../app/game';
import { BOARD_STATUSES, normalSpec, parseBoard, printBoard, readBoardHead, type BoardHead, type BoardStatus } from '../levels/boardFile';
import { specFromState } from '../levels/snapshot';
import { REPORT_PLAYERS } from '../rules/levelReport';
import { moveOf, tryWay } from '../rules/levelSolver';
import type { Dir, LevelSpec, RunState } from '../rules/types';
import { PROGRAM_FONT, paletteAt, shellDefaults } from '../shell/theme';
import { BoardEditor, type Overlay } from './boardEditor';
import { BoardStage } from './boardStage';
import { boardSvg } from '../levels/boardSvg';
import type { OrderOffer } from '../levels/orderSearch';
import { PRESETS, applyPreset, orderOf, orderText, type Order } from '../levels/orders';
import { diffOf } from '../levels/labText';
import { addPlay, historyOf, listBoards, onBoardChanged, playsOf, readBoard, readVersion, writeBoard } from './boardsClient';
import { boardHash, type Version } from './boardsServer';
import { copyText } from './clipboard';
import { SIZE_MAX, SIZE_MIN, displaySpecOf, editBoardOf, emptyBoard, rawSpecOf, resize, textOf, type EditBoard } from './editBoard';
import { GEN_PLACES, GEN_SEEDS, instantOf, type Ask, type Fixed, type Instant, type Later, type Offer, type Seconds } from './labFacts';
import type { SetBoard } from '../levels/sets';
import { OrderDesk } from './orderDesk';
import { mergePlays, playRecordOf, ratingsOf, ratingsText, versionSummary, type PlayPatch, type PlayRecord, type Rate } from './playLog';
import { CANCELLED, SolveClient, type WorkerLike } from './solveClient';

/** A change is written to its file this long after it is made, and after the last of several made together. */
const SAVE_MS = 300;
const COPY_LABEL = 'копировать текст доски';

/** A worker that asks boards: one to a tier, so that a quick answer does not wait behind a slow one. */
const solver = (): WorkerLike => new Worker(new URL('./solve.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;
/** A question without its number: the client numbers it. */
type Question<T extends Ask['tier']> = Extract<Ask, { tier: T }> extends infer Q ? (Q extends unknown ? Omit<Q, 'id'> : never) : never;
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
  /** The order the board was laid for, and what was known of it when the play began. */
  order?: string;
  measures: Record<string, number>;
}

/** The play the owner is asked about: which it was, and what he has said of it so far. */
interface Asked {
  name: string;
  at: string;
  ordered: boolean;
  said: PlayPatch['patch'];
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
  // The lab in hand, for whoever looks at the page from the console: `window.viLab`.
  (window as unknown as { viLab: LevelsLab }).viLab = new LevelsLab(game);
}

class LevelsLab {
  private readonly inside: Inside;
  private readonly palette = paletteAt(shellDefaults(), 0);
  private readonly root = document.createElement('div');
  private readonly facts = document.createElement('pre');
  private readonly badge = document.createElement('div');
  private readonly ribbon = document.createElement('div');
  private readonly editor: BoardStage;
  /** The board the scene of the game shows, as text: a board is put on anew only when it is another. */
  private presented = '';
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
  /** Which views of the solver are drawn over the board, and whether the board is shown blind: nothing said of it until it has been played. */
  private readonly views = { arrows: true, sensitive: false, spare: false, blind: false };
  private viewControls: Controller[] = [];
  /** The versions of the board in hand that are kept, the oldest first, and the plays written down for it. */
  private versions: Version[] = [];
  private plays: PlayRecord[] = [];
  private readonly versionForm = { pick: '' };
  private versionControl!: Controller;
  /** The version the board is held against, side by side, with what is known of it; null where nothing is compared. */
  private against: { version: Version; spec: LevelSpec; seconds: Seconds | string | null; later: Later | string | null } | null = null;
  private compareBox!: HTMLElement;
  private compareEditor!: BoardEditor;
  private readonly askOtherSeconds = new SolveClient<Question<'seconds'>, Seconds>(solver);
  private readonly askOtherLater = new SolveClient<Question<'later'>, Later>(solver);
  /** The boards offered: laid for a place, or a change away from the board in hand. Shown over the board, a picture to a board. */
  private readonly gallery = document.createElement('div');
  private readonly genForm = { place: GEN_PLACES[0] ?? '' };
  private readonly askGen = new SolveClient<Question<'gen'>, Offer[]>(solver);
  /** The order on the panel, as the panel has it: every bound as text, empty where it is not asked. */
  private readonly orderForm = {
    preset: '', size: 4, dice: 5, more: 0, faces: '2', shut: false, par: '3-6',
    link: 'any', glass: 'any', floor: 'any', ones: 'any',
    quiet: '', events: '', tail: '', ends: '', spare: '', firsts: '', trap: 'any', trapDepth: '', hidden: 'any', far: '', last: '',
  };
  private orderControls: Controller[] = [];
  private readonly desk = new OrderDesk(solver, () => this.show());
  /** What the board on the board misses of the order it was laid for, and whether a board is being waited for. */
  private orderSays: string[] = [];
  private ordering = false;
  /** The worker that builds a board about pinned dice or mends one; where it begins its next building; the cells its last answer changed. */
  private readonly askFix = new SolveClient<Question<'complete'> | Question<'repair'>, Fixed>(solver);
  private completeFrom = 1;
  private foundMarks: { x: number; z: number }[] = [];
  /** The set on the panel: its presets in a line; the worker that lays it; and the set being played, board after board. */
  private readonly setForm = { keys: 'insight insight wall gift' };
  private readonly askSet = new SolveClient<Question<'set'>, { boards: SetBoard[]; missing: string[] }>(solver);
  private setRun: { names: string[]; index: number } | null = null;
  /** The play that was last written down, while its answers are taken; and whether the ratings are shown in place of the facts. */
  private asked: Asked | null = null;
  private readonly askBar = document.createElement('div');
  private showRatings: string | null = null;
  /** The play in hand, while the board is played. */
  private watched: Watched | null = null;
  /** The status every file says it has, for the list of the files. */
  private statuses = new Map<string, BoardStatus | undefined>();
  /** What the panel shows of the head: the panel edits this copy and the lab reads it. */
  private readonly form = { file: '', id: '', faces: '2', shut: false, sink: 2, lift: 1, size: 4, note: '', status: 'idea' as BoardStatus };

  constructor(private readonly game: Game) {
    this.inside = game as unknown as Inside;
    const { root, facts, badge, palette } = this;
    root.style.cssText = `position:fixed;inset:0;z-index:900;display:grid;grid-template-columns:340px minmax(0,1fr);grid-template-rows:minmax(0,1fr);padding-right:256px;box-sizing:border-box;pointer-events:none;color:${palette.ink};font:13px/1.45 ${PROGRAM_FONT}`;
    // The middle of the page is clear: the board of the game is seen through it, and the stage over it takes the mouse.
    facts.style.cssText = `margin:0;padding:12px 14px;overflow:auto;white-space:pre-wrap;pointer-events:auto;background:${palette.bg};border-right:1px solid ${palette.faint};font:inherit;color:${palette.ink}`;
    const stage = document.createElement('div');
    stage.style.cssText = 'position:relative;display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden';
    this.gallery.style.cssText = `position:absolute;inset:0;z-index:1;pointer-events:auto;display:none;flex-wrap:wrap;align-content:flex-start;gap:10px;padding:12px;overflow:auto;background:${palette.bg}`;
    const boards = document.createElement('div');
    boards.style.cssText = 'display:flex;flex:1;min-height:0';
    const boardBox = document.createElement('div');
    boardBox.style.cssText = 'position:relative;flex:1;min-width:0;pointer-events:auto';
    // The version the board is held against stands to the left of it, while one is.
    this.compareBox = document.createElement('div');
    this.compareBox.style.cssText = `position:relative;flex:0 0 38%;min-width:0;display:none;pointer-events:auto;background:${palette.bg};border-right:1px solid ${palette.faint}`;
    boards.append(this.compareBox, boardBox);
    this.ribbon.style.cssText = `display:flex;flex-wrap:wrap;gap:4px;padding:6px 10px;min-height:30px;pointer-events:auto;background:${palette.bg};border-top:1px solid ${palette.faint}`;
    stage.append(boards, this.ribbon, this.gallery);
    root.append(facts, stage);
    badge.style.cssText = `position:fixed;left:50%;top:6px;transform:translateX(-50%);z-index:900;display:none;padding:2px 10px;background:${palette.bg};color:${palette.dim};border:1px solid ${palette.faint};font:12px ${PROGRAM_FONT};pointer-events:none`;
    badge.textContent = 'E — расстановка · R — заново · Z — ход назад · N — снимок положения в новую доску';
    this.askBar.style.cssText = `position:fixed;left:50%;top:32px;transform:translateX(-50%);z-index:900;display:none;padding:4px 12px;background:${palette.bg};color:${palette.ink};border:1px solid ${palette.ink};font:13px ${PROGRAM_FONT};pointer-events:none;white-space:nowrap`;
    document.body.append(root, badge, this.askBar);
    this.editor = new BoardStage(boardBox, (x, z, y) => game.cellPoint(x, z, y), () => this.edited(true), (board) => this.present(board), () => this.keepPins());
    this.compareEditor = new BoardEditor(this.compareBox, () => undefined);
    this.compareEditor.locked = true;
    this.buildPanel();

    // The keys are the editor's while it is open: the game under it gets none of them.
    const keys = (event: KeyboardEvent): void => {
      const typed = event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
      if (typed) {
        event.stopImmediatePropagation();
        return;
      }
      // The answers about the play just ended are taken first, in the editor and in the game alike.
      if (this.asked && event.type === 'keydown' && !event.ctrlKey && !event.metaKey && !event.altKey && this.answer(event.code)) {
        event.stopImmediatePropagation();
        event.preventDefault();
        return;
      }
      if (event.type === 'keydown' && event.code === 'KeyE' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.stopImmediatePropagation();
        event.preventDefault();
        if (!event.repeat) this.togglePlay();
        return;
      }
      // In a set, `Enter` after a board is cleared goes on to the next board.
      if (this.playing && this.setRun && (event.code === 'Enter' || event.code === 'NumpadEnter') && this.inside.state.endReason === 'passed') {
        event.stopImmediatePropagation();
        event.preventDefault();
        if (event.type === 'keydown' && !event.repeat) void this.nextOfSet();
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
    board.add(form, 'size', SIZE_MIN, SIZE_MAX, 1).name('сторона').onFinishChange((size: number) => {
      this.showBoard();
      this.editor.change(resize(this.editor.current, size));
      this.syncForm();
    });
    board.add(form, 'note').name('заметка').onFinishChange(() => this.edited(false));
    board.add(form, 'status', [...BOARD_STATUSES]).name('статус').onChange(() => this.edited(false));
    this.copyControl = gui.add({ copy: () => void this.copy() }, 'copy').name(COPY_LABEL);
    gui.add({ ratings: () => void this.toggleRatings() }, 'ratings').name('оценки: огонь против мимо');
    gui.add({ keep: () => this.keepSolved() }, 'keep').name('записать путь решателя в файл');
    const versions = gui.addFolder('Версии');
    this.versionControl = versions.add(this.versionForm, 'pick', []).name('версия');
    versions.add({ open: () => void this.openVersion() }, 'open').name('открыть как текущую');
    versions.add({ compare: () => void this.compareWith() }, 'compare').name('сравнить с текущей');
    versions.add({ stop: () => this.stopCompare() }, 'stop').name('убрать сравнение');
    this.buildOrder();
    const gen = gui.addFolder('Генерация').close();
    gen.add(this.genForm, 'place', [...GEN_PLACES]).name('место');
    gen.add({ place: () => this.offer({ tier: 'gen', place: this.genForm.place }, `место ${this.genForm.place}, ${GEN_SEEDS} зёрен`) }, 'place').name(`от места (${GEN_SEEDS} зёрен)`);
    gen.add({ board: () => this.spec && this.offer({ tier: 'gen', spec: this.spec, name: this.name }, `в одну правку от ${this.name}`) }, 'board').name('от этой доски');
    gen.add({ close: () => this.closeGallery() }, 'close').name('закрыть галерею');
    const views = gui.addFolder('Виды решателя');
    const seen = (): void => this.show();
    this.viewControls = [
      views.add(this.views, 'arrows').name('стрелки ходов').onChange(seen),
      views.add(this.views, 'sensitive').name('чувствительность к правке').onChange(seen),
      views.add(this.views, 'spare').name('лишние кости').onChange(seen),
      views.add(this.views, 'blind').name('слепой режим').onChange(seen),
    ];
  }

  /**
   * The order on the panel: a preset, which sets everything, and the bounds one by one. A bound
   * is a field of text, `3-6` or `2`, and is not asked where the field is empty; a technique is
   * asked for, forbidden, or left alone.
   */
  private buildOrder(): void {
    const { gui, orderForm: form } = this;
    const folder = gui.addFolder('Заказ');
    const presets = { '—': '', ...Object.fromEntries(Object.entries(PRESETS).map(([key, preset]) => [preset.name, key])) };
    const three = { 'не важно': 'any', 'обязан быть': 'needs', 'не должен быть': 'avoid' };
    this.orderControls = [
      folder.add(form, 'preset', presets).name('заготовка').onChange((key: string) => {
        if (key) this.setOrder(applyPreset(this.orderOfForm(), key));
      }),
      folder.add(form, 'size', SIZE_MIN, SIZE_MAX, 1).name('сторона'),
      folder.add(form, 'dice', 2, 12, 1).name('костей'),
      folder.add(form, 'more', 0, 3, 1).name('…или больше на'),
      folder.add(form, 'faces').name('рабочие грани'),
      folder.add(form, 'shut').name('пол закрыт'),
      folder.add(form, 'par').name('ходов (от-до)'),
      folder.add(form, 'link', three).name('звено цепочки'),
      folder.add(form, 'glass', three).name('через уходящую'),
      folder.add(form, 'floor', three).name('пол и толчок'),
      folder.add(form, 'ones', three).name('единицы'),
      folder.add(form, 'quiet').name('тихих ходов до события'),
      folder.add(form, 'events').name('событий'),
      folder.add(form, 'tail').name('ходов после предпоследнего'),
      folder.add(form, 'ends', { 'не важно': '', комбо: 'combo', звено: 'link', единицы: 'ones' }).name('кончается на'),
      folder.add(form, 'spare').name('…с запасом ходов'),
      folder.add(form, 'last').name('костей на последнем событии'),
      folder.add(form, 'firsts').name('верных первых ходов'),
      folder.add(form, 'trap', { 'не важно': 'any-way', 'нет': 'none', 'есть': 'any' }).name('ловушка'),
      folder.add(form, 'trapDepth').name('…тупик виден через ходов'),
      folder.add(form, 'hidden', { 'не важно': 'any', 'на виду': 'shown', 'спрятана': 'hidden' }).name('нужная грань'),
      folder.add(form, 'far').name('до кости первого хода, клеток'),
    ];
    form.trap = 'any-way';
    folder.add({ lay: () => void this.layOrder() }, 'lay').name('предложить доску');
    folder.add({ more: () => void this.layOrder() }, 'more').name('ещё');
    folder.add({ complete: () => this.fix('complete') }, 'complete').name('достроить вокруг закреплённых (K)');
    folder.add({ repair: () => this.fix('repair') }, 'repair').name('починить под заказ');
    const set = gui.addFolder('Связка').close();
    set.add(this.setForm, 'keys').name('заготовки по порядку');
    set.add({ lay: () => this.laySet() }, 'lay').name('собрать связку');
    set.add({ play: () => void this.playSet() }, 'play').name('играть связку этой доски');
    for (const control of this.orderControls) control.updateDisplay();
  }

  /** The order the panel says. What cannot be read is thrown, as the line of an order says it. */
  private orderOfForm(): Order {
    const form = this.orderForm;
    const techniques = (wanted: string): string => (['link', 'glass', 'floor', 'ones'] as const).filter((name) => form[name] === wanted).join(',');
    const words = [
      `size=${form.size}`, `dice=${form.dice}`, form.more ? `more=${form.more}` : '', `faces=${form.faces.split(/[\s,]+/).filter(Boolean).join(',')}`, form.shut ? 'floor=shut' : '', `par=${form.par.trim()}`,
      techniques('needs') && `needs=${techniques('needs')}`, techniques('avoid') && `avoid=${techniques('avoid')}`,
      form.quiet.trim() && `quiet=${form.quiet.trim()}`, form.events.trim() && `events=${form.events.trim()}`, form.tail.trim() && `tail=${form.tail.trim()}`,
      form.ends && `ends=${form.ends}${form.spare.trim() ? `.${form.spare.trim()}` : ''}`, form.last.trim() && `last=${form.last.trim()}`, form.firsts.trim() && `firsts=${form.firsts.trim()}`,
      form.trap !== 'any-way' && `trap=${form.trap}`, form.trapDepth.trim() && `trapdepth=${form.trapDepth.trim()}`,
      form.hidden !== 'any' && `hidden=${form.hidden === 'hidden' ? 'yes' : 'no'}`, form.far.trim() && `far=${form.far.trim()}`,
    ];
    const order = orderOf(words.filter(Boolean).join(' '));
    // The cells cut out are the board's own: an order is laid on the shape that is drawn.
    const holes = (this.spec?.size === order.size ? (this.spec.holes ?? []) : []).map(({ x, z }) => [x, z] as const);
    return { ...order, ...(holes.length > 0 ? { holes } : {}), ...(form.preset ? { preset: form.preset } : {}) };
  }

  /** The panel is set to an order. */
  private setOrder(order: Order): void {
    const form = this.orderForm;
    const span = (bounds?: readonly [number, number]): string => (bounds ? (bounds[0] === bounds[1] ? String(bounds[0]) : `${bounds[0]}-${bounds[1]}`) : '');
    form.preset = order.preset ?? '';
    form.size = order.size;
    form.dice = order.dice;
    form.more = order.more ?? 0;
    form.faces = order.faces.join(' ');
    form.shut = order.floorShut === true;
    form.par = span(order.par);
    for (const name of ['link', 'glass', 'floor', 'ones'] as const) form[name] = order.needs?.includes(name) ? 'needs' : order.avoid?.includes(name) ? 'avoid' : 'any';
    form.quiet = span(order.quiet);
    form.events = span(order.events);
    form.tail = span(order.tail);
    form.ends = order.endsOn?.event ?? '';
    form.spare = order.endsOn?.spare === undefined ? '' : String(order.endsOn.spare);
    form.last = span(order.last);
    form.firsts = span(order.firsts);
    form.trap = order.trap ?? 'any-way';
    form.trapDepth = span(order.trapDepth);
    form.hidden = order.hidden ?? 'any';
    form.far = order.far === undefined ? '' : String(order.far);
    for (const control of this.orderControls) control.updateDisplay();
  }

  /**
   * Lays a board for the order on the panel and puts it on the board, blind: the best board the
   * workers have, at once where one waits in stock. It is kept as a file of its own, an idea with
   * a note of its order. What it misses of the order is said beside the board, blind or not: that
   * is the answer to the order, and no number about the board.
   */
  private async layOrder(): Promise<void> {
    let order: Order;
    try {
      order = this.orderOfForm();
    } catch (error) {
      this.orderSays = [(error as Error).message];
      this.show();
      return;
    }
    if (this.saveTimer !== 0) await this.save();
    this.ordering = true;
    this.show();
    const offer = await this.desk.next(order);
    this.ordering = false;
    if (!offer) {
      this.orderSays = ['заказ: ни одной доски — правила не кладут такой, или она слишком велика для поиска за секунды'];
      this.show();
      return;
    }
    await this.keepOrdered(order, offer);
  }

  /**
   * Lays a set: a board to every preset named on the panel, each ordered after those before it
   * (`setFor`). The boards are kept as files `set<n>-1`, `set<n>-2` and on, and the first is
   * opened. It takes a few seconds to a board.
   */
  private laySet(): void {
    const keys = this.setForm.keys.split(' ').join(',').split(',').filter(Boolean);
    const unknown = keys.filter((key) => !PRESETS[key]);
    if (keys.length === 0 || unknown.length > 0) {
      this.orderSays = [`связка: ${unknown.length > 0 ? `нет заготовки ${unknown.join(', ')}` : 'назовите заготовки'}; есть ${Object.keys(PRESETS).join(' ')}`];
      this.show();
      return;
    }
    this.orderSays = [`связка: собираю ${keys.length} досок, по несколько секунд на каждую…`];
    this.show();
    this.askSet.ask({ tier: 'set', keys }).then(
      async ({ boards, missing }) => {
        if (boards.length === 0) {
          this.orderSays = ['связка: ни одной доски'];
          this.show();
          return;
        }
        if (this.saveTimer !== 0) await this.save();
        let number = 1;
        while (this.names.some((name) => name.startsWith(`set${number}-`))) number++;
        const texts = boards.map((board, index) => {
          const name = `set${number}-${index + 1}`;
          return { name, text: printBoard({ ...board.offer.spec, id: name }, { status: 'idea', note: `заказ ${orderText(board.order)}` }) };
        });
        for (const { name, text } of texts) await writeBoard(name, text);
        await this.readNames();
        this.load(texts[0].name, texts[0].text);
        const lines = boards.map((board, index) => `  ${index + 1}. ${PRESETS[board.key].name}${board.offer.misses.length === 0 ? '' : ` — ближайшая: ${board.offer.misses.join('; ')}`}`);
        this.orderSays = [`связка set${number}: досок ${boards.length}`, ...lines, ...(missing.length > 0 ? [`не нашлось: ${missing.join(', ')}`] : []), '«играть связку этой доски» — сыграть подряд'];
        this.show();
      },
      (error: Error) => {
        if (error.message === CANCELLED) return;
        this.orderSays = [`связка: ${error.message}`];
        this.show();
      },
    );
  }

  /** The boards of the set the board in hand is one of, in the order of their numbers; empty where it is of no set. */
  private setNames(): string[] {
    const dash = this.name.lastIndexOf('-');
    if (dash < 1) return [];
    const stem = this.name.slice(0, dash + 1);
    const numberOf = (name: string): number => Number(name.slice(stem.length));
    return this.names.filter((name) => name.startsWith(stem) && name.length > stem.length && Number.isInteger(numberOf(name))).sort((a, b) => numberOf(a) - numberOf(b));
  }

  /** Plays the set of the board in hand from that board on: when a board is cleared, `Enter` goes on to the next, and after the last the editor is back. */
  private async playSet(): Promise<void> {
    const names = this.setNames();
    const index = names.indexOf(this.name);
    if (index < 0 || names.length < 2) {
      this.orderSays = ['связка: эта доска не из связки (имя вида set1-2)'];
      this.show();
      return;
    }
    if (this.playing) this.togglePlay();
    if (!this.spec) return;
    this.togglePlay();
    this.setRun = { names, index };
  }

  /** The next board of the set being played is put on, or, after the last, the editor is come back to. */
  private async nextOfSet(): Promise<void> {
    const run = this.setRun;
    if (!run) return;
    if (this.playing) this.togglePlay();
    run.index++;
    if (run.index >= run.names.length) {
      this.orderSays = ['связка сыграна'];
      this.show();
      return;
    }
    await this.open(run.names[run.index]);
    if (!this.spec) return;
    this.togglePlay();
    this.setRun = run;
  }

  /** The pins of the board in hand are kept by its name, in the page's own store: no file of a board says them. */
  private keepPins(): void {
    if (this.name === '') return;
    try {
      window.localStorage.setItem(`vi.lab.pins.${this.name}`, JSON.stringify(this.editor.pins));
    } catch {
      // No store: the pins live as long as the page.
    }
  }

  private readPins(): void {
    let pins: { x: number; z: number }[] = [];
    try {
      pins = JSON.parse(window.localStorage.getItem(`vi.lab.pins.${this.name}`) ?? '[]') as { x: number; z: number }[];
    } catch {
      pins = [];
    }
    this.editor.setPins(Array.isArray(pins) ? pins : []);
  }

  /**
   * Asks the generator to work on the board in hand by the order on the panel: to lay the rest
   * of its dice about those that are pinned, or to mend it with as few changes as will do. What
   * comes back is put on the board as a change like any other, one step to take back, and the
   * cells it changed are framed until the board is changed again. An answer about a board that
   * has been changed since it was asked is dropped.
   */
  private fix(kind: 'complete' | 'repair'): void {
    if (this.name === '' || this.editor.locked || this.moment !== null) return;
    let order: Order;
    try {
      order = this.orderOfForm();
    } catch (error) {
      this.orderSays = [(error as Error).message];
      this.show();
      return;
    }
    const board = this.editor.current;
    const { par: _par, exact: _exact, solution: _solution, ...head } = this.head;
    const spec = rawSpecOf(board, head);
    const pinned = this.editor.pins;
    this.orderSays = [kind === 'complete' ? `достраиваю вокруг закреплённых (${pinned.length})…` : 'чиню под заказ…'];
    this.show();
    const question = kind === 'complete' ? ({ tier: 'complete', order, spec, pinned, from: this.completeFrom } as const) : ({ tier: 'repair', order, spec, pinned } as const);
    this.askFix.ask(question).then(
      (answer) => {
        if (this.editor.current !== board) return;
        const best = answer.kind === 'complete' ? answer.offers[0] : answer.mended[0];
        if (answer.kind === 'complete') this.completeFrom = answer.next;
        if (!best) {
          this.orderSays = [`${kind === 'complete' ? 'достроить' : 'починить'}: ни одной доски за ${answer.tried} попыток`];
          this.show();
          return;
        }
        const found = editBoardOf(best.spec);
        const marks: { x: number; z: number }[] = [];
        found.cells.forEach((row, z) => row.forEach((cell, x) => JSON.stringify(cell) !== JSON.stringify(board.cells[z]?.[x]) && marks.push({ x, z })));
        this.editor.change(found);
        this.foundMarks = marks;
        const how = answer.kind === 'repair' ? [`изменено: ${answer.mended[0].edits.join('; ') || 'ничего — доска уже держит заказ'}`] : [`достроено, попыток ${answer.tried}`];
        this.orderSays = [...how, ...(best.misses.length === 0 ? ['доска держит всё, что заказано'] : ['не держит:', ...best.misses.map((miss) => `  ${miss}`)]), 'Ctrl+Z — вернуть как было'];
        this.show();
      },
      (error: Error) => {
        if (error.message === CANCELLED) return;
        this.orderSays = [error.message];
        this.show();
      },
    );
  }

  private async keepOrdered(order: Order, offer: OrderOffer): Promise<void> {
    const stem = order.preset ?? 'order';
    let number = 1;
    while (this.names.includes(`${stem}-${number}`)) number++;
    const name = `${stem}-${number}`;
    if (!isBoardName(name)) return;
    const text = printBoard({ ...offer.spec, id: name }, { status: 'idea', note: `заказ ${orderText(order)}` });
    await writeBoard(name, text);
    await this.readNames();
    this.load(name, text);
    this.orderSays = offer.misses.length === 0 ? ['заказ: доска держит всё, что заказано'] : ['заказ: точной доски пока нет, это ближайшая. Не держит:', ...offer.misses.map((miss) => `  ${miss}`)];
    this.show();
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
  /**
   * Puts a board on the board of the game to be looked at: the board as drawn where the rules
   * lay it, and with the player lent a place where it has no start yet (`displaySpecOf`). A board
   * the rules lay nothing of leaves the scene as it was; what is wrong is said beside it.
   */
  private present(board: EditBoard): void {
    if (this.playing) return;
    const { spec } = displaySpecOf(board, this.head);
    if (!spec) return;
    const text = printBoard(normalSpec(spec));
    if (text === this.presented) return;
    this.presented = text;
    this.game.showBoard(spec);
  }

  private headChanged(): void {
    this.showBoard();
    if (this.editor.locked) {
      this.syncForm();
      return;
    }
    const { form } = this;
    const faces = form.faces.split(/[\s,]+/).filter(Boolean).map(Number);
    const { floor: _floor, ...rest } = this.head;
    this.head = { ...rest, id: form.id.trim(), faces, values: [...faces], sinkMoves: form.sink, liftMoves: form.lift, ...(form.shut ? { floor: false } : {}) };
    this.editor.sink = form.sink;
    this.edited(true);
    this.present(this.editor.current);
  }

  /**
   * The board or its head has been changed here. A change of the board itself makes what the file
   * kept of its way, the fewest moves and one way to make them, a thing of another board: it is
   * dropped, and comes back if the board does. The file is written a moment later.
   */
  private edited(board: boolean): void {
    if (this.name === '' || this.editor.locked) return;
    if (board) {
      this.foundMarks = [];
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
    // While a moment of the way is shown, the board is the one kept aside.
    return textOf(this.drawn ?? this.editor.current, this.head, this.extra);
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
    const before = this.saved;
    this.saved = text;
    try {
      await writeBoard(this.name, text);
    } catch (error) {
      // Not written: the next change, or the next try, writes it.
      if (this.saved === text) this.saved = before;
      this.error = (error as Error).message;
    }
    await this.readVersions();
    this.show();
  }

  /** Reads the versions kept of the board in hand and the plays written down for it, and lists the versions on the panel, the newest first. */
  private async readVersions(): Promise<void> {
    const { name } = this;
    if (name === '') return;
    let versions: Version[] = [];
    let plays: PlayRecord[] = [];
    let statuses: (BoardStatus | undefined)[] = [];
    try {
      versions = await historyOf(name);
      plays = mergePlays(await playsOf<PlayRecord | PlayPatch>(name));
      statuses = await Promise.all(versions.map(async (version) => readBoardHead(await readVersion(name, version.file)).status));
    } catch (error) {
      console.error(error);
    }
    if (name !== this.name) return;
    // A board that has no version yet, one written by a script or by hand, gets its first: the file is written as it is.
    if (versions.length === 0 && this.spec && this.saved !== '') {
      try {
        const read = this.saved;
        // Written back only as it lies: a file changed since it was read is left to whoever changed it.
        if ((await readBoard(name)) === read && name === this.name && this.saved === read && (await writeBoard(name, read)).hash) versions = await historyOf(name);
      } catch (error) {
        console.error(error);
      }
      if (name !== this.name) return;
    }
    this.versions = versions;
    this.plays = plays;
    const labelled: Record<string, string> = {};
    versions.forEach((version, index) => {
      const played = plays.filter((play) => play.hash === version.hash).length;
      const label = `${new Date(version.time).toLocaleTimeString()} ${version.hash}${statuses[index] ? ` · ${statuses[index]}` : ''}${played > 0 ? ` · партий ${played}` : ''}`;
      labelled[label] = version.file;
    });
    const newestFirst = Object.fromEntries(Object.entries(labelled).reverse());
    if (!versions.some((version) => version.file === this.versionForm.pick)) this.versionForm.pick = versions.at(-1)?.file ?? '';
    this.versionControl = this.versionControl.options(newestFirst).name('версия');
  }

  /** The version picked on the panel, with its text. */
  private async picked(): Promise<{ version: Version; text: string } | null> {
    const version = this.versions.find((kept) => kept.file === this.versionForm.pick);
    if (!version || this.name === '') return null;
    try {
      return { version, text: await readVersion(this.name, version.file) };
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  /** Takes the version picked as the board in hand: it is written to the file, and is the newest version from then on. */
  private async openVersion(): Promise<void> {
    if (this.saveTimer !== 0) await this.save();
    const { name } = this;
    const picked = await this.picked();
    if (!picked || name !== this.name) return;
    this.stopCompare();
    this.load(name, picked.text);
    this.saved = '';
    await this.save();
  }

  /**
   * Holds the board in hand against the version picked: the version stands beside it, the cells
   * the two differ in are framed on both, and the numbers of both are set side by side. The
   * numbers of the version are asked of workers of their own, so that those of the board in hand
   * are not stopped for them.
   */
  private async compareWith(): Promise<void> {
    const { name } = this;
    const picked = await this.picked();
    if (!picked || name !== this.name) return;
    let spec: LevelSpec;
    try {
      spec = parseBoard(picked.text, this.name);
    } catch (error) {
      this.error = (error as Error).message;
      this.show();
      return;
    }
    const against: NonNullable<LevelsLab['against']> = { version: picked.version, spec, seconds: null, later: null };
    this.against = against;
    this.compareBox.style.display = 'block';
    this.compareEditor.show(editBoardOf(spec));
    const told = <T>(set: (facts: T | string) => void) => [
      (facts: T): void => {
        if (this.against !== against) return;
        set(facts);
        this.show();
      },
      (error: Error): void => {
        if (error.message === CANCELLED || this.against !== against) return;
        set(error.message);
        this.show();
      },
    ] as const;
    const { par: _par, exact: _exact, solution: _solution, ...bare } = spec;
    this.askOtherSeconds.ask({ tier: 'seconds', spec: bare }).then(...told<Seconds>((facts) => (against.seconds = facts)));
    this.askOtherLater.ask({ tier: 'later', spec: bare }).then(...told<Later>((facts) => (against.later = facts)));
    this.show();
  }

  private stopCompare(): void {
    if (!this.against) return;
    this.against = null;
    this.askOtherSeconds.cancel();
    this.askOtherLater.cancel();
    this.compareBox.style.display = 'none';
    this.show();
  }

  /** The board in hand and the version it is held against, number by number, and the plays of each. */
  private compareLines(): string[] {
    const { against, spec } = this;
    if (!against) return [];
    const mine = { seconds: this.seconds, later: this.later, plays: this.plays.filter((play) => play.hash === boardHash(this.text(), this.name)) };
    const theirs = { seconds: against.seconds, later: against.later, plays: this.plays.filter((play) => play.hash === against.version.hash) };
    type Side = typeof mine;
    const seconds = (side: Side, read: (facts: Seconds) => string): string => (side.seconds === null ? '…' : typeof side.seconds === 'string' ? '!' : read(side.seconds));
    const later = (side: Side, read: (facts: Later) => string): string => (side.later === null ? '…' : typeof side.later === 'string' ? '!' : read(side.later));
    const rows: [string, (side: Side) => string][] = [
      ['ходов', (side) => seconds(side, (facts) => String(facts.check.par ?? '—'))],
      ['доказано', (side) => seconds(side, (facts) => (facts.check.exact ? 'да' : 'нет'))],
      ['первых ходов', (side) => seconds(side, (facts) => String(facts.firsts))],
      ...(['hasty', 'casual', 'careful', 'planner'] as const).map((name): [string, (side: Side) => string] => [name, (side) => later(side, (facts) => percent(facts.report.personas[name].endings.passed))]),
      ['партий', (side) => String(versionSummary(side.plays).plays)],
      ['пройдено', (side) => (side.plays.length === 0 ? '—' : percent(versionSummary(side.plays).passed / side.plays.length))],
      ['над par, медиана', (side) => String(versionSummary(side.plays).overMedian ?? '—')],
    ];
    const diff = spec ? diffOf(against.spec, spec) : null;
    return [
      '— сравнение —',
      `${''.padEnd(18)}${'версия'.padEnd(10)}текущая`,
      ...rows.map(([label, read]) => `${label.padEnd(18)}${read(theirs).padEnd(10)}${read(mine)}`),
      `версия слева: ${new Date(against.version.time).toLocaleTimeString()} ${against.version.hash}`,
      diff ? (diff.cells.length === 0 ? 'клетки те же' : `клеток изменено: ${diff.cells.length} (${diff.cells.map((cell) => `${cell.x},${cell.z}`).join(' ')})`) : '',
      '',
    ];
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
      this.extra = readBoardHead(text);
      this.editor.show(editBoardOf(shown), sameBoard);
      if (!sameBoard) {
        this.readPins();
        this.foundMarks = [];
        this.completeFrom = 1;
      }
      this.keepWay();
      // A board laid by the generator and not yet looked at is played before anything is said of it.
      const note = this.extra.note ?? '';
      if (!sameBoard) this.views.blind = this.extra.status === 'idea' && (note.startsWith('место ') || note.startsWith('заказ '));
      // A board laid for an order brings its order back to the panel.
      if (!sameBoard) this.orderSays = [];
      if (!sameBoard && note.startsWith('заказ ')) {
        try {
          this.setOrder(orderOf(note.slice('заказ '.length)));
        } catch {
          // A note that is no order any more: the panel stays as it is.
        }
      }
      for (const control of this.viewControls) control.updateDisplay();
    } else {
      this.editor.show(emptyBoard(SIZE_MIN));
      this.editor.locked = true;
    }
    this.syncForm();
    this.show();
    if (!sameBoard) {
      this.stopCompare();
      void this.readVersions();
    }
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
      this.setRun = null;
      this.playing = false;
      this.root.style.display = 'grid';
      this.gui.show();
      this.badge.style.display = 'none';
      this.inside.audio.setAway(true);
      // The board drawn is put back on the board of the game, as it was before it was played.
      this.presented = '';
      this.present(this.editor.current);
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
    const note = this.extra.note ?? '';
    const measures: Record<string, number> = { size: this.spec?.size ?? 0, dice: this.spec?.norm ?? 0, ...(seconds ? { firsts: seconds.firsts, states: seconds.check.states } : {}) };
    const of = { name: this.name, hash: boardHash(this.text(), this.name) ?? '', par: seconds?.check.par ?? this.spec?.par ?? null, measures, ...(note.startsWith('заказ ') ? { order: note.slice('заказ '.length) } : {}) };
    // A new play: what was being asked of the one before is asked no more.
    this.ask(null);
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
    // A board that has been played is not blind any more: what is known of it is shown.
    if (this.views.blind) {
      this.views.blind = false;
      for (const control of this.viewControls) control.updateDisplay();
      if (!this.playing) this.show();
    }
    const record = { ...playRecordOf(play.state, play.startedAt, Date.now(), play.undos, play), measures: play.measures, ...(play.order ? { order: play.order } : {}) };
    void addPlay(play.name, record).catch((error: Error) => console.error(error));
    this.ask({ name: play.name, at: record.at, ordered: play.order !== undefined, said: {} });
  }

  /** Begins to ask of a play, or stops asking: the line of the keys is shown over the page while a play is asked of. */
  private ask(asked: Asked | null): void {
    this.asked = asked;
    this.askBar.style.display = asked ? 'block' : 'none';
    if (!asked) return;
    const { said } = asked;
    const mark = (on: boolean, text: string): string => (on ? `[${text}]` : text);
    this.askBar.textContent = [
      `${mark(said.rate === 'fire', '1 огонь')} ${mark(said.rate === 'ok', '2 норм')} ${mark(said.rate === 'miss', '3 мимо')}`,
      ...(asked.ordered ? [`то, что заказано: ${mark(said.asOrdered === true, 'Y да')} ${mark(said.asOrdered === false, 'N нет')}`] : []),
      mark(said.fresh === true, 'U было новое'),
      mark(said.more === true, 'M хочу ещё'),
    ].join('  ·  ');
  }

  /**
   * A key pressed while a play is asked of; true where it was an answer. An answer is written
   * down at once, as a line laid over its play, and may be given again: the last one stands.
   * The first rate sets the status of the board, where the board is still the one in hand.
   */
  private answer(code: string): boolean {
    const { asked } = this;
    if (!asked) return false;
    const rates: Record<string, Rate> = { Digit1: 'fire', Digit2: 'ok', Digit3: 'miss', Numpad1: 'fire', Numpad2: 'ok', Numpad3: 'miss' };
    let patch: PlayPatch['patch'];
    if (rates[code]) patch = { rate: rates[code] };
    else if (asked.ordered && code === 'KeyY') patch = { asOrdered: true };
    // In a play `N` makes a board of the position; once the play is over there is no position to keep, and it is the answer.
    else if (asked.ordered && code === 'KeyN' && (!this.playing || this.inside.state.over)) patch = { asOrdered: false };
    else if (code === 'KeyU') patch = { fresh: !asked.said.fresh };
    else if (code === 'KeyM') patch = { more: !asked.said.more };
    else return false;
    asked.said = { ...asked.said, ...patch };
    void addPlay(asked.name, { at: asked.at, patch }).catch((error: Error) => console.error(error));
    this.ask(asked);
    if (patch.rate && asked.name === this.name && !this.editor.locked && this.moment === null) {
      this.form.status = patch.rate === 'fire' ? 'fire' : patch.rate === 'ok' ? 'good' : 'miss';
      for (const control of this.gui.controllersRecursive()) control.updateDisplay();
      this.edited(false);
    }
    return true;
  }

  /** Shows what the answers come to, over all the boards, in place of the facts; again, and the facts are back. */
  private async toggleRatings(): Promise<void> {
    if (this.showRatings !== null) {
      this.showRatings = null;
      this.show();
      return;
    }
    const all: PlayRecord[] = [];
    for (const name of this.names) {
      try {
        all.push(...mergePlays(await playsOf<PlayRecord | PlayPatch>(name)));
      } catch {
        // A board with no plays written down.
      }
    }
    this.showRatings = ratingsText(ratingsOf(all));
    this.show();
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

  /**
   * Asks for boards and shows them as a gallery over the board: a picture to a board, with what
   * it is and the moves it is cleared in. A click on one keeps it as a file and opens it. The
   * work is a worker's, and is stopped when another gallery is asked for or this one is closed.
   */
  private offer(question: Question<'gen'>, title: string): void {
    const { gallery, palette } = this;
    const say = (text: string): void => {
      gallery.replaceChildren();
      const line = document.createElement('div');
      line.style.cssText = 'flex-basis:100%';
      line.textContent = text;
      gallery.append(line);
    };
    gallery.style.display = 'flex';
    say(`${title}: считаю…`);
    this.askGen.ask(question).then(
      (offers) => {
        say(offers.length === 0 ? `${title}: ни одной доски` : `${title}: досок ${offers.length}. Щелчок — открыть как новый файл.`);
        for (const offer of offers) {
          const card = document.createElement('button');
          card.style.cssText = `display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px;cursor:pointer;font:inherit;background:${palette.bg};color:${palette.ink};border:1px solid ${palette.faint}`;
          const picture = document.createElement('img');
          picture.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(boardSvg(offer.spec, { cell: 26 }))}`;
          const caption = document.createElement('span');
          caption.textContent = `${offer.what} · ходов ${offer.par ?? '—'}${offer.exact ? '' : '?'}`;
          card.append(picture, caption);
          card.addEventListener('click', () => void this.keepOffer(offer));
          gallery.append(card);
        }
      },
      (error: Error) => {
        if (error.message !== CANCELLED) say(`${title}: ${error.message}`);
      },
    );
  }

  private closeGallery(): void {
    this.askGen.cancel();
    this.gallery.style.display = 'none';
    this.gallery.replaceChildren();
  }

  /** Keeps a board of the gallery as a file, under its name or the name with a number after it where the name is taken, and opens it. */
  private async keepOffer(offer: Offer): Promise<void> {
    if (this.saveTimer !== 0) await this.save();
    let name = offer.name;
    for (let number = 2; this.names.includes(name); number++) name = `${offer.name}-${number}`;
    if (!isBoardName(name)) return;
    await writeBoard(name, offer.text);
    await this.readNames();
    this.closeGallery();
    this.load(name, offer.text);
  }

  /** What the page says of the board in hand, beside it. */
  private show(): void {
    const lines: string[] = [];
    if (this.name === '') lines.push('нет досок: «новая доска» на панели');
    else lines.push(`boards/${this.name}.txt${this.saveTimer !== 0 ? '  …пишется' : ''}`);
    const desk = this.desk.status;
    if (this.ordering) lines.push('', `заказ: ищу доску… перебрано зёрен ${desk.tried}`);
    else if (this.orderSays.length > 0) lines.push('', ...this.orderSays, desk.searching || desk.waiting > 0 ? `в запасе: ${desk.exact} точных, всего ${desk.waiting}${desk.searching ? ', ищу ещё…' : ''}` : '');
    if (!this.editor.locked && displaySpecOf(this.editor.current, this.head).stand === 'lent') lines.push('', 'Старта нет: фигурка на поле стоит условно.', 'Перетащите ○ из списка на кость или на пол.');
    if (this.error) lines.push('', this.error, ...(this.editor.locked ? ['', 'Файл не читается как доска: править его надо в самом файле. Страница его не перезапишет.'] : []));
    if (this.showRatings !== null) lines.push('', this.showRatings, '', '(кнопка «оценки» ещё раз — назад к доске)');
    else lines.push('', ...(this.views.blind ? ['слепой режим: о доске ничего не сказано,', 'пока она не сыграна (E).'] : [...this.compareLines(), ...this.factLines()]));
    lines.push('', 'кость из списка — на клетку', 'кость с поля — на другую клетку,', '  за край поля — убрать', 'стрелки — прокатить выбранную на месте', 'колесо — повернуть вокруг верха', 'F — фикс. · L — уходящая · H — вырез', 'P — старт · Del, правая кнопка — убрать', 'K — закрепить для генератора', 'Ctrl+Z / Ctrl+Y — отмена / повтор', 'E — играть');
    this.facts.textContent = lines.join('\n');
    this.showRibbon();
    const changed = this.against && this.spec ? diffOf(this.against.spec, this.spec).cells.map(({ x, z }) => ({ x, z })) : this.foundMarks;
    const overlay = this.overlayOf();
    this.editor.setOverlay((this.against || changed.length > 0) && !this.views.blind ? { arrows: [], sensitive: [], spare: [], ...overlay, changed } : overlay);
    if (this.against) this.compareEditor.setOverlay({ arrows: [], sensitive: [], spare: [], changed });
  }

  /** The views of the solver that are switched on, for the board itself: a moment of the way and a board shown blind have none. */
  private overlayOf(): Overlay | null {
    const { seconds, later, views } = this;
    if (views.blind || this.moment !== null || this.editor.locked) return null;
    const overlay: Overlay = { arrows: [], sensitive: [], spare: [] };
    if (views.arrows && seconds && typeof seconds !== 'string') {
      overlay.arrows = seconds.moves.map((fact) => {
        const [x, z, dir, push] = fact.move.split(',');
        return { x: Number(x), z: Number(z), dir: dir as Dir, push: push === 'p', keeps: fact.keeps };
      });
    }
    if (later && typeof later !== 'string') {
      if (views.spare) overlay.spare = later.spare;
      if (views.sensitive) {
        // A die is as sensitive as the worst a change of it does: no way left stands before a way of another length.
        const worst = new Map<string, Overlay['sensitive'][number]>();
        for (const fact of later.near) {
          const cell = /(\d+),(\d+)/.exec(fact.what);
          if (!cell || fact.change === 'same') continue;
          const key = `${cell[1]},${cell[2]}`;
          if (worst.get(key)?.change !== 'unsolved') worst.set(key, { x: Number(cell[1]), z: Number(cell[2]), change: fact.change });
        }
        overlay.sensitive = [...worst.values()];
      }
    }
    return overlay;
  }

  /** The way the solver found, a button to a move: a click shows the board after that move, and the first shows the board itself. */
  private showRibbon(): void {
    const { ribbon, seconds, palette } = this;
    ribbon.replaceChildren();
    if (this.views.blind) return;
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
        // The score of the way, a line to a move: the table of the script is too wide for the column.
        check.score?.beats.forEach((beat, index) => {
          const floor = [beat.down ? 'вниз' : '', beat.up ? 'вверх' : ''].filter(Boolean).join(' ');
          const event = beat.event === 'none' ? '' : ` → ${beat.event} грани ${beat.face}, костей ${beat.took}`;
          if (index === 0) lines.push('');
          lines.push(`${index + 1}. ${check.way![index]} ${beat.how}${floor ? ` (${floor})` : ''}${event}`);
        });
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
