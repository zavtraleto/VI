# Обучающая дорога VI: план сборки

> Вид: план. Статус: выполнен. Дата: 2026-10-08. Проверено: 2026-10-09.
> Что заменило: —. Что живёт в коде: — (ветка `first-level`, не опубликовано).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Обучение — один непрерывный набор из двадцати кусков в четырёх блоках: доски стыкуются в клетке игрока в одном виде, линии поля рисует бегущая точка, комбо уходит медленно, часть костей фиксирована; после набора уровни списка идут тем же переходом.

**Architecture:** Куски — обычные `LevelSpec` в `src/levels/road.ts`. Один `BoardView` на всё: доска (размер, вырезы, сдвиг в мире) и цель камеры задаются ему снаружи; сетка — геометрия отрезков с прогрессом. Переход ведёт чистый модуль фаз `src/app/passage.ts`, оболочка `game.ts` его читает. В `src/rules` одно касание — фиксированная кость.

**Tech Stack:** TypeScript, Vite, Vitest, three.js, канвас оболочки `src/shell`, lil-gui в лаборатории.

**Spec:** [docs/superpowers/specs/2026-10-08-vi-teaching-road-design.md](../specs/2026-10-08-vi-teaching-road-design.md) — читать целиком до первой задачи. Она заменяет разделы 4, 6, 7.1, 8 [спеки первого уровня](../specs/2026-10-08-vi-first-level-design.md); остальное там в силе.

## Global Constraints

- Работа в worktree `.claude/worktrees/first-level`, ветка `first-level`. В основную папку `GAMES\VI` ничего не писать. Коммит после каждой задачи; пуш в `main` только после «ок» владельца.
- `src/rules` — чистая симуляция; единственная правка правил здесь — задача 1 (фиксированная кость). `RULES_VERSION` прежний. Endless, сеанс дня, упражнение, задачи ведут себя как сейчас.
- Интерфейс — в канвасе через `src/shell`; цвета, шрифты, размеры из `src/shell/theme.ts`; DOM не заводить; нового цвета в теме нет.
- Вид ведёт владелец: всё, что о виде, — первая версия с параметрами в лаборатории; сверх спеки ничего не придумывать; где решает исполнитель, в коде комментарий «предложение».
- Все числа перехода и вида фиксированной кости — параметры группы `road` в `src/render/params.ts`, имена и значения по спеке: `comboStepMs` 140, `comboHoldMs` 350, `sinkMs` 1300, `eraseMs` 700, `cameraMs` 900, `drawMs` 1100, `headGlow` 1, `afterglowMs` 250, `riseMs` 600, `riseStepMs` 90, `fixedTone` 0.35, `fixedEdge` 0.5.
- Сдвиг доски в мире — дело вида и оболочки; правила, решатель и спеки кусков о нём не знают.
- Перед снимками в preview страницу перезагружать после смены размера окна. Сервер preview идёт из основной папки: своя сборка открывается одноразовой страницей `_fl.html` в корне worktree (копия `index.html` со скриптом `./src/main.ts`), адрес `http://localhost:5183/.claude/worktrees/first-level/_fl.html`; в коммит она не входит.
- Субагентам `model` явно: `opus` для задач 1–5 и 7, `sonnet` для 6 и 8.
- Коммиты на английском в стиле репозитория, в конце строка `Co-Authored-By` модели. Файлы добавлять по именам, без `git add -A`.
- Код заранее не пишется: план даёт интерфейсы, тесты-намерения и порядок; исполнитель пишет по ним и по названному соседнему коду.

## Карта файлов

| Файл | Что делает здесь |
|---|---|
| `src/rules/types.ts`, `spawn.ts`, `movement.ts`, `board.ts`, `level.ts`, `levelSolver.ts` | фиксированная кость |
| `src/rules/fixedDie.test.ts` | новый |
| `src/render/gridLines.ts` (+ тест) | новый: отрезки сетки, волна от клетки |
| `src/render/lineGrid.ts` | новый: меш отрезков с прогрессом |
| `src/render/view.ts`, `framing.ts` | `setBoard`, `setFrame`, сетка-геометрия, подъём костей по одной, уход по одной |
| `src/render/cubes.ts` | погашенная фиксированная кость, поочерёдные подъём и уход |
| `src/render/params.ts`, `src/lab/boardPanel.ts` | группа `road` |
| `src/app/passage.ts` (+ тест) | новый: фазы перехода; заменяет `ribbon.ts` |
| `src/app/game.ts` | один вид, переход, набор, START, хранение, подсказки |
| `src/levels/road.ts` (+ тест) | новый: `ROAD`; `first.ts` удаляется |
| `src/app/signWay.ts`, `src/shell/hud.ts`, `hudLayout.ts` | знак у фигуры, строка-подсказка |
| `src/ui/i18n.ts`, `src/ui/lang/*.ts` | три строки-подсказки |
| `docs/…` | задача 8 |

---

### Task 1: Фиксированная кость (правила)

**Files:** Modify `src/rules/types.ts` (`PuzzleDie`, `Cube`), `spawn.ts` (`placeLevelLayout`), `movement.ts` (`resolveMove`), `board.ts` (`floorStep`, `landing`, если толчок решается там), `level.ts` (`checkLayout`), `levelSolver.ts` (`nameOf`, `runOf`). Test: `src/rules/fixedDie.test.ts`.

**Interfaces — Produces:**

```ts
export interface PuzzleDie { x: number; z: number; top: number; north: number; /** The die cannot be rolled or pushed: it joins a combo and leaves with it, and can be walked over. */ fixed?: boolean }
// Cube получает то же необязательное поле `fixed`.
```

Поведение (спека, раздел 4): `resolveMove` со своей фиксированной кости на пустую клетку — `blocked`; шаг на соседнюю кость (`hop`) — как обычно; с пола фиксированную не толкают и на неё не поднимаются (`blocked`); накат на её клетку невозможен, как на любую стоящую; в комбо входит и уходит как любая. `checkLayout` бросает, если `start` (без `onFloor`) — фиксированная кость. Решатель: флаг переживает `nameOf`→`runOf` (фиксированные кости не двигаются: достаточно брать флаг из раскладки по клетке).

- [ ] **Step 1:** прочитать `resolveMove` (`movement.ts` 39–95), `floorStep`/`landing`/`isDock` (`board.ts` 125–183), `copyRun`/`nameOf`/`runOf` (`levelSolver.ts` 70–200), `src/rules/firstLayout.test.ts` как образец игры настоящими правилами.
- [ ] **Step 2:** падающие тесты на доске 3×3 (`faces: [2]`, `floor: true`), кости: своя (1,1) top 6 north 5 (юг 2); фиксированная (1,0)? — нет: цель фиксированная (0,0) top 2; ещё одна фиксированная (2,2) top 4. Тесты: (1) с (1,1) перекат N на (1,0) → комбо с фиксированной (0,0), обе уходят, `passed` нет, пока стоит (2,2)… — поэтому тест-доска A: только своя и (0,0): `passed` после N; (2) доска B: игрок стоит на фиксированной кости — `checkLayout` бросает; (3) доска C: своя (1,1), фиксированная (2,1): `hop` E на неё, с неё свайп E/N/S на пустое — `blocked`, ход не потрачен (`levelRun.moves` 0), шаг W обратно — `hop`; (4) доска D (`onFloor`, игрок на полу рядом с фиксированной, за ней свободно): свайп в неё — `blocked` (не толчок, не подъём); та же доска с обычной костью — толчок; (5) `solveLevel` доски A: `moves.length === 1`; доски, где решение требовало бы катить фиксированную, — `null`; (6) раскладка без `fixed` ведёт себя как раньше: `npx vitest run src/rules src/levels` зелёный.
- [ ] **Step 3:** запустить — падает. **Step 4:** реализовать. **Step 5:** `npm test`, `typecheck`, `build`. **Step 6:** commit.

---

### Task 2: Один вид — доска и кадр задаются снаружи

**Files:** Modify `src/render/view.ts`, `src/render/framing.ts`, `src/render/textures.ts` (если нужно), `src/app/game.ts` (`useView`, `begin`), `src/lab/boardLab.ts` (если конструктор меняется). Test: `src/render/framing.test.ts` (дополнить), новый `src/render/board.test.ts` для чистой части.

**Interfaces — Produces:**

```ts
// src/render/view.ts
export interface BoardShape { size: number; holes: readonly { x: number; z: number }[]; /** Where the board's cell (0,0) lies in the world, in cells. */ origin: { x: number; z: number } }
export interface Frame { /** Middle of the picture in the world, cells. */ x: number; z: number; /** Screen pixels a cell takes. */ cell: number }
class BoardView {
  setBoard(shape: BoardShape): void;          // без пересборки вида: сетка, границы, цель камеры
  frameOf(shape: BoardShape): Frame;          // кадр, в который доска входит целиком (как fitBoard сейчас)
  setFrame(frame: Frame, ms: number): void;   // камера едет к кадру за ms (0 — сразу); пружина как follow()
  readonly shape: BoardShape;
}
// src/render/framing.ts — чистое
export function shiftFor(player: { x: number; z: number }, origin: { x: number; z: number }, nextStart: { x: number; z: number }): { x: number; z: number };
// origin следующей доски = (origin + player) − nextStart
```

Всё, что рисует по координатам правил (кости, фигура, метки, знаки, `project`), получает сдвиг `origin` одной группой мира; правила координат не меняют. `game.ts`: один `BoardView` на всю игру вместо кэша по форме; `begin` зовёт `setBoard` и `setFrame(frameOf(shape), 0)`. Режим «следом за игроком» на телефоне работает как сейчас поверх заданного кадра. Старое проявление рядами (`setReveal`, `revealBands`) пока остаётся рабочим — его снимает задача 4.

- [ ] **Step 1:** прочитать `BoardView` конструктор (259–328), `setCamera` (359–396), `resize` (425–458), `frameFollowed` (867–919), `project` (934), `framing.ts` целиком; `game.ts` `useView` (786), `begin` (848).
- [ ] **Step 2:** тесты: `shiftFor({x:1,z:0},{x:0,z:0},{x:2,z:3})` → `{x:-1,z:-3}`; цепочка двух сдвигов; `frameOf` для доски 3 и 6 при окне 360×640 даёт разный `cell`, а для одной и той же — одинаковый при любом `origin`.
- [ ] **Step 3:** падает → реализовать → зелёный.
- [ ] **Step 4:** глазами в preview: Endless, `?levels` P01 и P21 (доска с вырезами), `?tutorial`, `?lab=board` — выглядят как до правки; смена уровня из списка не оставляет следов прошлой доски.
- [ ] **Step 5:** `npm test`, `typecheck`, `build`. **Step 6:** commit.

---

### Task 3: Сетка-геометрия и бегущая точка

**Files:** Create `src/render/gridLines.ts`, `src/render/gridLines.test.ts`, `src/render/lineGrid.ts`. Modify `src/render/view.ts` (сетка уровня — геометрия вместо `gridTexture`-плоскости), `src/render/params.ts` (группа `road`), `src/lab/boardPanel.ts` (`FOLDERS`, `LABELS`).

**Interfaces — Produces:**

```ts
// src/render/gridLines.ts — чистое
export interface GridSegment { ax: number; az: number; bx: number; bz: number; edge: boolean; /** Cells from the origin cell of the wave to the nearer end. */ reach: number }
export function gridSegments(size: number, holes: readonly { x: number; z: number }[]): GridSegment[]; // по одному на сторону клетки, без повторов; edge — сторона, за которой нет клетки
export function waveFrom(segments: GridSegment[], cell: { x: number; z: number }): GridSegment[];     // reach по шагам через клетки доски от cell; отрезок направлен от ближнего конца к дальнему
/** How much of a segment is drawn at share 0..1 of the whole wave: 0 not yet, 1 whole. */
export function drawnShare(reach: number, far: number, share: number): number;

// src/render/lineGrid.ts
export class LineGrid { constructor(look: BoardLook); set(segments: GridSegment[]): void; /** share 0..1; drawing true — рисуется волной от клетки, false — стирается к ней. */ show(share: number, drawing: boolean, timeMs: number): void; readonly object: THREE.Object3D; dispose(): void }
```

Вид: тонкая линия сетки и тяжёлая линия края — того же цвета и толщины, что рисует `gridTexture` сейчас (сравнить снимками); на конце рисуемой части — яркая точка (`headGlow`), за ней послесвечение (`afterglowMs`). `show(1, …)` — доска целиком, как сейчас. `BoardView` получает `drawGrid(share, drawing)`; по умолчанию 1. Endless и упражнение (квадрат без вырезов) рисуются тем же объектом целиком и выглядят как до правки. `gridTexture` остаётся только там, где ещё нужен (`frameTexture` не трогать).

- [ ] **Step 1:** прочитать `drawGrid`/`cutGrid` (`textures.ts` 204–310), место сетки в `view.ts` (285–300, 722–723), шейдерные материалы-образцы (`cubes.ts`, `signs.ts:149`), `params.ts` 4–6 и 13–195, `boardPanel.ts` 11–30.
- [ ] **Step 2:** тесты `gridLines.test.ts`: доска 1×1 — 4 отрезка, все `edge`; полоса 1×3 — 10 отрезков, 8 `edge`; доска 3×3 без вырезов — 24, из них 12 `edge`; `waveFrom` от угла: `reach` растёт до дальнего угла, ни один отрезок не остался без `reach`; на доске из двух частей, связанных одной клеткой, волна доходит до обеих; `drawnShare(0, 4, 0.1) > 0`, `drawnShare(4, 4, 0.1) === 0`, при `share 1` всё равно 1.
- [ ] **Step 3:** падает → реализовать чистое → зелёный. **Step 4:** `LineGrid`, включение в вид, параметры `road` (все имена из Global Constraints) и панель.
- [ ] **Step 5:** глазами: `?lab=board` — сетка как была; в лаборатории ручка «прогресс» рисует и стирает сетку волной; Endless, P01, P21 — сетка как до правки. Снимки до/после в отчёт.
- [ ] **Step 6:** `npm test`, `typecheck`, `build`. **Step 7:** commit.

---

### Task 4: Переход между досками

**Files:** Create `src/app/passage.ts`, `src/app/passage.test.ts`. Modify `src/app/game.ts` (вместо `startRibbon`/`runRibbon`; `finaleOver` для пройденного уровня), `src/render/view.ts` и `src/render/cubes.ts` (поочерёдный свет и уход костей комбо, поочерёдный подъём, ступенька последней, погашенная фиксированная кость), `src/audio` (только вызовы имеющихся звуков). Delete: `src/app/ribbon.ts`, `ribbon.test.ts`, `setReveal`/`revealBands`/`lay` рядами, `partial`-текстура.

**Interfaces — Produces:**

```ts
// src/app/passage.ts — чистое
export interface PassageTimes { comboStepMs: number; comboHoldMs: number; sinkMs: number; eraseMs: number; cameraMs: number; drawMs: number; riseMs: number; riseStepMs: number }
export type PassagePhase = 'combo' | 'sink' | 'erase' | 'draw' | 'rise' | 'done';
export interface PassageView { phase: PassagePhase; /** 0..1 inside the phase. */ at: number; /** Dice of the last combo lit so far. */ lit: number; /** The board is the next one from here on. */ swapped: boolean; /** Camera share 0..1 toward the next frame. */ camera: number; /** Lines of the shown board, 0..1. */ lines: number; /** Dice of the next board risen so far, the stair last. */ risen: number }
export function passageAt(elapsedMs: number, times: PassageTimes, counts: { combo: number; dice: number; stair: boolean }, reduced: boolean): PassageView;
/** Which board comes after this one: the next piece of the road, the first level of the list after its last, the next level, or null after the last. */
export function boardAfter(current: { road?: number; level?: number }, road: number, levels: number, onward: number): { road?: number; level?: number } | null;
```

Порядок и смысл фаз — спека, раздел 6. `swapped` становится true на границе `erase`→`draw`: `game.ts` в этот кадр ставит следующую доску (`begin`), считает её `origin` через `shiftFor` по клетке игрока, зовёт `setBoard`, `setFrame(frame, cameraMs)`; в блоке 1 `frame.cell` — общий для всех кусков блока (наименьший из `frameOf` его досок). Фигура всё время видна: стоит на полу клетки стыка, затем её поднимает её кость; где у доски `onFloor` и `leaving` (ступенька) — остаётся на полу, ступенька поднимается последней до своей высоты. Нажатие переход не ускоряет. Пока идёт переход, ввод выключен, пауза и отмена не работают (как у прежней ленты). `reduced`: фазы `erase`, `draw`, `rise` по 0 мс, камера сразу. Строка итога — как сейчас (`outcome`), с начала `erase` до первого хода. Проигрыш и последний уровень списка — окно, как сейчас. Фиксированная кость на вид: `fixedTone`, `fixedEdge`; в фазе `combo` загорается цветом канала.

Звук: свет каждой кости комбо — имеющийся звук комбо с повышением тона на шаг (как у цепочки, если такой ряд есть; иначе один звук комбо на первую кость), уход — имеющийся; подъём костей — `risen`. Новых звуков нет.

- [ ] **Step 1:** прочитать `runRibbon`/`startRibbon` (`game.ts` 1166–1218), `finaleOver` (2130–2153) и константы 195–204, `cubes.ts` `sync` (559–602) и `look`, `view.ts` `draw` (603–760: `rise`, `leave`), `audio/score.ts` события `match`/`sunk`/`risen`.
- [ ] **Step 2:** тесты `passage.test.ts` с `times` из Global Constraints, `counts {combo: 3, dice: 4, stair: false}`: `passageAt(0)` → `combo`, `lit 1`; в 280 мс `lit 3`; фаза `sink` начинается в 3·140+350 = 770 мс; `erase` в 770+1300+2·140 = 2350; `swapped` false до 3050 и true с 3050; `lines` в `erase` падает 1→0, в `draw` растёт 0→1 за 1100; `camera` 0→1 за 900 от 3050; `rise` с 4150, `risen` 4 к 4150+600+3·90; `done` после; со `stair: true` последняя единица `risen` приходит позже остальных; `reduced` — после `sink` сразу `done` c `swapped`. `boardAfter({road: 19}, 20, 30, 0)` → `{level: 0}`; `{road: 3}` → `{road: 4}`; `{level: 29}` → `null`.
- [ ] **Step 3:** падает → `passage.ts` → зелёный. **Step 4:** вид и кости. **Step 5:** `game.ts`, удаление ленты.
- [ ] **Step 6:** глазами в preview (`?levels` P01 → P02 → P03 по `solution` из `levels.ts`): комбо загорается по одной, уходит медленно; линии стираются к клетке игрока; камера едет без рывка; новые линии рисуются волной от игрока; кости поднимаются, своя — под фигурой; строка итога стоит. Снимки четырёх фаз, телефон и экран.
- [ ] **Step 7:** `npm test`, `typecheck`, `build`. **Step 8:** commit.

---

### Task 5: Блок 1 — дорога из семи кусков, START, хранение, знак у фигуры

**Files:** Create `src/levels/road.ts`, `src/levels/road.test.ts`. Delete `src/levels/first.ts`, `first.test.ts`; перенести `STAGE_SIGNS`/`STAGE_IDLE` в `road.ts` как `ROAD_SIGNS`/`ROAD_IDLE`. Modify `src/app/game.ts` (`startStage`→`startPiece`, `firstStage`→`piece`, `showStart`, `countLevel`, адреса `?first`, `?road=`), `src/app/signWay.ts` (`signCell` у фигуры), `src/app/firstCounters.ts` (по `ROAD`), `src/ui/settings.ts` (`levels.road`), тесты рядом.

**Interfaces — Produces:**

```ts
// src/levels/road.ts
export const ROAD: readonly LevelSpec[];                 // R01…R07 в этой задаче, R08…R20 в задаче 7
export const ROAD_BLOCKS: readonly { from: number; to: number; /** One scale for the whole block. */ oneScale: boolean }[]; // блок 1: {0, 6, true}
export const ROAD_SIGNS: Readonly<Record<string, Dir | undefined>>; // { R01: 'N' }
export const ROAD_IDLE: Readonly<Record<string, IdleRule>>;
// settings.levels.road?: string  — код куска, на котором игрок остановился; нет поля и passed['F1'] есть → блок 1 пройден (road = 'R08', когда он появится; до задачи 7 — набор пройден)
```

Куски блока 1 (спека, раздел 3; координаты у каждого свои; север — `z` меньше; камера видит южную и восточную грани: перекат N поднимает южную, W — восточную):

- `R01` — полоса 1×6 по `z`, `size 6`, клетки (0,0)…(0,5). Своя кость (0,5): top 2, north 4 (юг 3, низ 5) — четыре переката N возвращают двойку наверх: 2→3→5→4→2. Цель (0,0): top 2, `fixed`. `faces [2]`, `floor false`, `par 4`, `solution ['0,5,N','0,4,N','0,3,N','0,2,N']`, `ROAD_SIGNS.R01 = 'N'`. Исполнитель проверяет грани настоящим `roll` и правит `north`, если последовательность иная.
- `R02` — тройка со ступенькой и проездом: игрок на полу, ступенька (уходящая, `moves: 1`), своя кость, прямой проезд на север 3–4 клетки и поворот на запад или восток к двум фиксированным тройкам; `faces [3]`, `floor true`, `par` 4–5; дерево (грань зависит только от клетки).
- `R03` — двойка, один перекат на запад поднимает восточную грань; `R04` — тройка, два переката с поворотом; `R05` — двойка, цель за поворотом, 3 хода; `R06` — четвёрка: три фиксированные четвёрки стоят уголком, своя в двух перекатах; `R07` — смесь: фиксированные двойка и пара троек, `faces [2,3]`, два комбо по очереди, 4–5 ходов, ко второму путь по клеткам.
- Требования ко всем семи (тест): решается; `solution` проходит за `par`; на доске нет готового комбо; все цели `fixed`; из любого достижимого положения решается и худшее ≤ 5 ходов (обход состояний как в прежнем `first.test.ts`); тупик недостижим; первый ход `solution` у `R01` — `N`.

`game.ts`: START ставит кусок `settings.levels.road` (нет прогресса — `R01`), набор пройден — `nextLevel()`; пройден кусок — `settings.levels.road` = следующий, звёзды и ходы пишутся под кодом куска, как у уровня; строка итога у кусков есть; у куска в показаниях нет номера уровня. `?first` → `R01`, `?road=R05` → этот кусок, оба без START. Один масштаб блока 1 берётся из `ROAD_BLOCKS` (задача 4 читает его). Знак свайпа: `signCell` — клетка фигуры, начало следа у края её кости со стороны хода (`signPlace` получает точку у фигуры), на всех кусках набора по простою (`ROAD_IDLE`: `R01` — знак со старта и через 6 с; остальные — мигание плашки с 4 с, знак с 8 с, три пустых хода — сразу).

- [ ] **Step 1:** прочитать `src/levels/first.ts`, `first.test.ts` (обход состояний), `signWay.ts`, `game.ts` места `firstStage`, `showStart`, `countLevel`, `settings.ts` 66–70.
- [ ] **Step 2:** тесты `road.test.ts` по требованиям выше + `signCell` у фигуры + выбор куска под START (чистая функция `startBoard(road: string | undefined, firstPassed: boolean, onward: number)`).
- [ ] **Step 3:** падает → `road.ts`, перенос, `game.ts` → зелёный.
- [ ] **Step 4:** глазами, чистое хранилище, 360 и 1080: START → `R01` (первый ход вверх, знак у фигуры) → … → `R07` → `P01`; масштаб в блоке 1 не меняется; выход на `R04` и новый запуск: START над `R04`. Снимки.
- [ ] **Step 5:** `npm test`, `typecheck`, `build`. **Step 6:** commit.

---

### Task 6: Строка-подсказка и подсказка на ошибку

**Files:** Modify `src/rules/types.ts` — нет (поле куска живёт вне правил): `src/levels/road.ts` получает `ROAD_HINTS: Readonly<Record<string, { key: string; until: 'combo' | 'chain' | 'walk' | 'push' }>>`; `src/shell/hud.ts`, `hudLayout.ts` (строка над полем), `src/app/game.ts`, `src/app/idle.ts`/`signWay.ts` (повторный тупик), `src/ui/i18n.ts`, `src/ui/lang/*.ts`, тесты полноты языков и ширины.

**Interfaces — Produces:** `HudView.hint: { text: string } | null` — одна строка голосом (`Voice`), над полем под показаниями, не шире окна минус поля; гаснет за 300 мс. `game.ts` показывает её с начала куска и снимает, когда событие `until` случилось на этом куске (`combo` — первое комбо; `chain` — событие цепочки; `walk` — шаг на уходящую кость; `push` — толчок). Ошибка: счётчик тупиков на куске (сбрасывается в `begin` другого куска, не сбрасывается отменой и `RESTART`); второй тупик или три пустых хода — `StageWait` отдаёт знак сразу.

Тексты (предложение исполнителя, ≤ 8 слов, голос лаборанта, правит владелец): `hintChain` ru «Пока комбо уходит, докати к нему ещё одну.»; `hintWalk` ru «По уходящей кости можно пройти.»; `hintPush` ru «С пола кость можно толкнуть.» — и переводы на en, es, pt, tr, de, fr того же смысла и длины.

- [ ] **Step 1:** прочитать `hud.ts` 645–653 (`note`, `Voice.say`), `hudLayout.ts`, как ключ проходит семь языков (`resume` как образец), `signWay.ts` `StageWait`.
- [ ] **Step 2:** тесты: полнота ключей в семи языках; ширина строки на 360 (по образцу `text.test.ts`); `StageWait` — второй тупик даёт знак сразу, первый нет; строка снимается событием `until` (чистая функция `hintOver(until, events)`).
- [ ] **Step 3:** падает → реализовать → зелёный. **Step 4:** `npm test`, `typecheck`, `build`. **Step 5:** commit. (Глазами — в задаче 7, когда появятся куски с подсказками.)

---

### Task 7: Блоки 2–4 — куски `R08`–`R20`

**Files:** Modify `src/levels/road.ts`, `road.test.ts`; при нужде `scripts/ladder.mjs`/`src/levels/route.ts` только чтением (доски можно подобрать строителем и вписать руками, как `LEVELS`).

**Interfaces — Consumes:** `layFromRoute`, `solveLevel`, `solveFrom`, `levelScore` (`uses`), `fixed`, `ROAD_HINTS`, `ROAD_BLOCKS`. **Produces:** `ROAD` из двадцати кусков; `ROAD_BLOCKS` — четыре блока (`oneScale` только у первого); `ROAD_HINTS` для `R09` (`chain`), `R13` (`walk`), `R17` (`push`).

Куски (спека, раздел 3; доски 3×3 и 4×4, 3–6 костей, `par` 2–6, всё элементарно; грань меняется от куска к куску; часть целей `fixed`, чтобы свободы было мало):

| Кусок | Требование, которое проверяет тест |
|---|---|
| `R08` | два комбо по очереди; решается без цепочки; ко второму путь по костям |
| `R09` | без цепочки не решить (`uses` содержит цепочку; решатель без цепочки — `null`, если такой режим есть, иначе проверка по счёту костей: костей на одну больше, чем берёт комбо) |
| `R10`, `R11` | лёгкие: одно-два комбо, `par` ≤ 4, приёмы только пройденные |
| `R12` | смесь блока: два комбо и цепочка, `par` ≤ 6 |
| `R13` | кратчайший путь идёт по уходящей кости; без прохода длиннее не меньше чем на ход или `null` (режим решателя «без прохода» есть: `noWalk`) |
| `R14`, `R15` | лёгкие, со ступенькой в одном из них |
| `R16` | смесь: цепочка и проход |
| `R17` | `floor: true`; без толчка не решить; на пол игрок попадает сам (кость под ним уходит) |
| `R18`, `R19` | лёгкие |
| `R20` | смесь всего, пик набора: `par` ≤ 7 |

Общие проверки: каждый решается, `solution` за `par`, нет готового комбо; у кусков-уроков приём обязателен; у «лёгких» случайный игрок (`randomMove`, 200 прогонов) проходит не реже чем в 60% — если мерило ботов даёт другое имя, взять имеющееся. Тупик в блоках 2–4 допустим.

- [ ] **Step 1:** прочитать `src/levels/route.ts`, `generate.ts` (`candidate`, `levelOf`), `select.ts` (`judge`), `levelScore.ts` (`uses`), `scripts/ladder.mjs`, `docs/VI_Levels_Teaching.md` раздел 5.
- [ ] **Step 2:** тесты требований таблицы. **Step 3:** подобрать доски (строителем или руками), вписать, тесты зелёные; в отчёте — таблица: кусок, размер, кости, `par`, что проверено.
- [ ] **Step 4:** глазами: чистое хранилище, START → `R01`…`R20` → `P01` по `solution` каждого; подсказки `R09`, `R13`, `R17` стоят и гаснут; камера отъезжает и приближается между кусками разного размера; возврат на кусок после выхода. Снимки: телефон и экран — `R01`, переход с отъездом камеры, кусок с подсказкой.
- [ ] **Step 5:** `npm test`, `typecheck`, `build`. **Step 6:** commit.

---

### Task 8: Документы

**Files:** `docs/VI_Levels_Rules.md` (разделы 1, 12: фиксированная кость), `docs/art/VI_Interface_Layer.md` (строки: переход вместо перерисовки рядами; знак у фигуры; строка-подсказка; правка строк первого уровня), `docs/art/VI_World_Logic.md` (фиксированная кость, дорога; причина в мире — за владельцем), `docs/VI_Levels_Onboarding_Decisions.md` (шапка), `docs/ROADMAP.md`, `README.md` (таблица структуры), обе спеки (в спеке первого уровня — пометка вверху, какие разделы заменены; в спеке дороги — раздел «Что при сборке вышло иначе»).

- [ ] **Step 1:** строки по спеке и по отчётам задач; имена кода сверять с `src`. **Step 2:** `npm test`. **Step 3:** commit.

---

## Самопроверка плана по спеке

| Раздел спеки | Задача |
|---|---|
| 2 решения | все |
| 3 набор | 5, 7 |
| 4 фиксированная кость | 1 |
| 5 один вид | 2 |
| 6 переход | 3, 4 |
| 7 знак, строка, ошибка | 5, 6 |
| 8 вид фиксированной | 4 |
| 9 хранение | 5 |
| 10 лаборатория | 3, 4 |
| 11 проверка | каждая, 7 целиком |
