# Первый уровень VI: план сборки

> Вид: план. Статус: выполнен. Дата: 2026-10-08. Проверено: 2026-10-09.
> Что заменило: [план обучающей дороги](2026-10-08-vi-teaching-road.md) — в части ленты и четырёх этапов. Что живёт в коде: — (ветка `first-level`, не опубликовано).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Новый игрок после boot видит одну кнопку START, играет четыре заскриптованных этапа без слов и без окон и попадает лентой на `P01`; стрелки свайпа убраны везде, вместо них знак свайпа у поля и плашка из кубиков.

**Architecture:** Этапы — четыре обычных `LevelSpec` (`src/levels/first.ts`), склеенные оболочкой в ленту (`src/app/game.ts`): конец доски не открывает окно, а запускает перерисовку поля и следующую доску. В `src/rules` одно касание: раскладка умеет уходящую кость и игрока на полу. Знаки — в канвасе через `src/shell` (новый экран START, строка-кнопка скип в boot, знак свайпа и плашка в `hud.ts`); простой считает чистый класс в `src/app/idle.ts`.

**Tech Stack:** TypeScript, Vite, Vitest, three.js (сцена), канвас оболочки `src/shell`. Проверка: `npm test`, `npm run typecheck`, `npm run build`; дев-сервер только через preview `vi-dev` (порт 5183).

**Spec:** [docs/superpowers/specs/2026-10-08-vi-first-level-design.md](../specs/2026-10-08-vi-first-level-design.md) — исполнитель читает её целиком до первой задачи; план ссылается на её разделы.

## Global Constraints

- Работа в worktree `.claude/worktrees/first-level` (ветка `first-level` от `origin/main` `7780049`). В основную папку `GAMES\VI` ничего не писать. Коммит после каждой задачи в эту ветку; пуш в `main` — только после «ок» владельца (`git fetch`, rebase на `origin/main`, проверки, `git push origin HEAD:main`).
- `src/rules` — чистая детерминированная симуляция; визуал и оболочка читают её и не влияют на правила. Единственная правка правил — задача 1; `git diff --stat origin/main -- src/rules` после всех задач показывает только `types.ts`, `spawn.ts`, `sim.ts`, `level.ts` и тесты.
- Endless, сеанс дня, упражнение, задачи не меняются (кроме убранной стрелки свайпа, задача 3). `RULES_VERSION` прежний.
- Весь интерфейс — в канвасе через `src/shell`; цвета, шрифты, размеры только из `src/shell/theme.ts`. DOM не заводить. Новый элемент интерфейса — со строкой в `docs/art/VI_Interface_Layer.md` (задача 8).
- Всё нажимаемое — в языке игрока: новые слова `START`, `SKIP` в `src/shell/text.ts` (английское с японским программы) и в `src/ui/lang/words.ts` для ru, es, pt, tr, de, fr; ширину меряет `src/shell/text.test.ts`.
- Вид ведёт владелец: первая версия по спеке, ничего сверх неё не придумывать; где спека говорит «предложение», так и писать в коде комментарием.
- Субагентам указывать `model` явно: `opus` для задач 4, 6, 7; `sonnet` для 2, 3, 5, 8; задача 1 — `opus` (правила).
- Коммиты на английском в стиле репозитория (одна фраза: что сделано и почему), в конце — строка `Co-Authored-By` модели, которая собирала.
- Код здесь не пишется заранее: план даёт интерфейсы, тесты-намерения и порядок. Исполнитель пишет код по ним и по соседнему коду, который назван.

## Карта файлов

| Файл | Что делает в этой работе |
|---|---|
| `src/rules/types.ts` | `LevelLayout.leaving`, `LevelLayout.onFloor` |
| `src/rules/spawn.ts` | `placeLevelLayout`: уходящая кость в раскладке |
| `src/rules/sim.ts` | `createRun`: игрок на полу при `onFloor` |
| `src/rules/level.ts` | `checkLayout`: проверки новых полей |
| `src/rules/firstLayout.test.ts` | новый: тесты задачи 1 |
| `src/levels/first.ts` | новый: `FIRST_LEVEL`, `FIRST_ID`, `STAGE_SIGNS` |
| `src/levels/first.test.ts` | новый: доски доказаны |
| `src/app/idle.ts`, `src/app/idle.test.ts` | новый: простой и пустые ходы |
| `src/app/game.ts` | лента, экран START, знак свайпа, плашка первого уровня, убранные стрелки |
| `src/shell/screens/start.ts` | новый: экран START |
| `src/shell/screens/boot.ts` | строка-кнопка `SKIP` |
| `src/shell/hud.ts` | `drawCounter` из кубиков; знак свайпа; строка итога |
| `src/shell/text.ts`, `src/ui/lang/words.ts` | слова `START`, `SKIP` |
| `src/render/view.ts`, `src/render/textures.ts` | проявление и погасание сетки по рядам |
| `src/render/overlays.ts` | стрелки больше не рисуются на уровнях и в сеансах |
| `docs/…` | раздел 10 спеки |

---

### Task 1: Раскладка с уходящей костью и игроком на полу (правила)

**Files:**
- Modify: `src/rules/types.ts` (интерфейс `LevelLayout`, строка ~383)
- Modify: `src/rules/spawn.ts` (`placeLevelLayout`, строка ~207)
- Modify: `src/rules/sim.ts` (`createRun`, поле `player`, строка ~48)
- Modify: `src/rules/level.ts` (`checkLayout`, строки ~80–99)
- Test: `src/rules/firstLayout.test.ts` (новый)

**Interfaces:**
- Produces:

```ts
// src/rules/types.ts
export interface LevelLayout {
  dice: readonly PuzzleDie[];
  start: { x: number; z: number };
  /** Dice of `dice`, by index, that are already leaving when the board is laid: each goes in this many moves. */
  leaving?: readonly { die: number; moves: number }[];
  /** The player starts on the floor at `start`, which holds no die. Left out, they start on the die at `start`. */
  onFloor?: boolean;
}
```

- Поведение: кость из `leaving` после `addCube` получает `state = 'sinking'`, `t = config.sinkingTicks − moves · config.actionTicks`, `reactionId` новой реакции `{ id: state.nextReactionId++, value: ori.top, chain: 1, total: 1 }`, добавленной в `state.reactions`. При `onFloor` `createRun` ставит `player.level = 'ground'` (сейчас `opts.empty ? 'ground' : 'top'`). `checkLayout`: при `onFloor` на `start` кости нет и `start` — клетка поля (не в `holes`, в границах); без `onFloor` — как сейчас («no die to start on»); каждый `die` из `leaving` — индекс в `dice`, `moves` от 1 до `spec.sinkMoves ?? LEVEL_SINK_MOVES`.

- [ ] **Step 1: Прочитать соседний код.** `placeLevelLayout` и `addCube` в `spawn.ts`; `startSinking` в `reactions.ts` (как кость становится уходящей); `finishSinkings` в `sim.ts` (строки ~124–135: `t++`, удаление при `t >= sinkingTicks`); `resolveMove` в `movement.ts` (строки 39–97: `mount`, `hop`, `descend`); `levelConfig` в `level.ts` (`sinkingTicks = sinkMoves · actionTicks + 1`).

- [ ] **Step 2: Написать падающие тесты** в `src/rules/firstLayout.test.ts`. Доска теста — этап 2 спеки (раздел 6.3), собранная прямо в тесте как `LevelSpec`:

```ts
const STAGE2: LevelSpec = {
  id: 'T-stair', seed: 1, size: 5, values: [3], norm: 4, arrival: 'none', goal: { kind: 'clear' }, moves: 0, faces: [3], floor: true,
  sinkMoves: 2, liftMoves: 1,
  holes: /* все клетки 5×5, кроме (2,0) (3,0) (3,1) (0,2) (1,2) (2,2) (3,2) (0,3) */,
  layout: {
    dice: [{ x: 0, z: 2, top: 6, north: 2 }, { x: 1, z: 2, top: 1, north: 4 }, { x: 3, z: 0, top: 3, north: 1 }, { x: 2, z: 0, top: 3, north: 2 }],
    start: { x: 0, z: 3 }, onFloor: true, leaving: [{ die: 0, moves: 1 }],
  },
};
```

Тесты (`createRun({ seed: 1, config: defaultConfig(), level: STAGE2 })`, ходы через `step(state, dir)` из `sim.ts` и прокрутку тиков так, как это делает `tryWay`/`playMove` в `levelSolver.ts` — посмотреть и повторить):

1. после создания: игрок на полу (`player.level === 'ground'`) в (0,3); кость (0,2) `sinking`, высота `cubeHeight` в пределах 0.45–0.55; `state.reactions.length === 1`; `goalLines(state)[0]` даёт `have: 1, need: 4`;
2. `resolveMove(state, 'N').kind === 'mount'`; после шага игрок на (0,2) наверху; `t` кости не изменился;
3. затем `resolveMove(state, 'E').kind === 'hop'`; после шага игрок на (1,2); `t` не изменился; `resolveMove(state, 'S')` с лесенки до этого — `descend` (проверить отдельно от свежего состояния);
4. с (1,2) перекат `E`: после завершения хода кости (0,2) нет (`cubeAt` null), `state.reactions.length === 0`, грань наверху у своей кости 5;
5. со свежего состояния после `mount` и `hop`: перекат `W` с (1,2) на лесенку даёт `kind === 'roll'`, лесенка исчезает, своя кость стоит на (0,2) с южной гранью 3;
6. `checkLayout` бросает: `onFloor` и кость на `start`; `leaving` с индексом вне `dice`; `moves: 0`; `moves: 3` при `sinkMoves: 2`;
7. путь этапа `E E N` после `mount`, `hop`: `state.endReason === 'passed'` после третьего хода, `levelRun.moves === 3`.

- [ ] **Step 3: Запустить** `npx vitest run src/rules/firstLayout.test.ts` — падает на типах/поведении.

- [ ] **Step 4: Реализовать** поля и поведение по Interfaces. В `placeLevelLayout` — после цикла `addCube`, по `spec.layout.leaving`. Удаление уходящей кости должно пройти через тот же `removeCube` и `pruneReactions`, что и у комбо: ничего нового не писать, только выставить состояние.

- [ ] **Step 5: Прогнать** `npx vitest run src/rules` и `npm run typecheck` — зелёные. Проверить, что `src/rules/levels.test.ts`-подобные тесты (`src/levels/levels.test.ts`) не задеты.

- [ ] **Step 6: Commit** — `git add src/rules/types.ts src/rules/spawn.ts src/rules/sim.ts src/rules/level.ts src/rules/firstLayout.test.ts`.

---

### Task 2: Четыре доски первого уровня, доказанные

**Files:**
- Create: `src/levels/first.ts`
- Test: `src/levels/first.test.ts`
- Modify: `README.md` (таблица структуры: строка для `src/levels/first.ts`)

**Interfaces:**
- Consumes: `LevelLayout.leaving`, `onFloor` (задача 1); `solveLevel`, `solveFrom`, `tryWay`, `moveOf` из `src/rules/levelSolver.ts`; `hasReadyGroup` из `src/rules/spawn.ts`.
- Produces:

```ts
// src/levels/first.ts
export const FIRST_ID = 'F1';                       // код первого уровня в хранилище
export const FIRST_LEVEL: readonly LevelSpec[];     // F1a, F1b, F1c, F1d — этапы по разделу 6 спеки
/** The sign the stage opens with, if any: the direction the swipe sign shows from the first frame. */
export const STAGE_SIGNS: Readonly<Record<string, Dir | undefined>> = { F1a: 'E' };
/** Idle thresholds of a stage, ms: when the plaque over the target blinks, when the sign comes, how many wasted moves bring it at once. */
export const STAGE_IDLE: Readonly<Record<string, { blinkMs: number | null; signMs: number; wasted: number | null }>>;
```

Спеки этапов — ровно по разделам 6.2–6.5: `size`, `holes` (все клетки квадрата, кроме названных), `faces`, `floor`, `layout` с `top`/`north` из таблиц, `norm` = число костей, `par`, `exact: true`, `solution` (`['0,2,E','1,2,E','2,2,E','3,2,E']`, `['1,2,E','2,2,E','3,2,N']`, `['1,1,N']`, `['1,1,W']`), `undos: 3`, `sinkMoves: 2`, `liftMoves` как у `LEVELS[0]`, `moves: 0`, `arrival: 'none'`, `goal: { kind: 'clear' }`, `chapter: 0`. Без `lesson`, `arrow`, `guide`, `story`. `STAGE_IDLE`: `F1a: { blinkMs: null, signMs: 6000, wasted: null }`, `F1b`–`F1d`: `{ blinkMs: 4000, signMs: 8000, wasted: 3 }` (раздел 7.3; на этапе 2 мигает плашка над парой троек).

Помощник для `holes`: функция `cutAllBut(size, cells: readonly [number, number][])` внутри `first.ts`, чтобы спека читалась списком клеток, а не тридцатью отверстиями.

- [ ] **Step 1: Прочитать** `src/levels/levels.test.ts` (как проигрывается `solution`, как проверяется «нет готового комбо», `exact`), `src/rules/levelSolver.ts` (`solveLevel`, `solveFrom`, `tryWay`: ходит ли `tryWay` сам шагами до нужной кости; если нет — путь этапа 2 проверяет тест с явными `step`).

- [ ] **Step 2: Написать падающие тесты** `src/levels/first.test.ts`:

1. `FIRST_LEVEL` — четыре спеки с id `F1a..F1d`, `norm === layout.dice.length`, `checkLayout` не бросает (через `createRun`);
2. ни на одной доске нет готового комбо (`hasReadyGroup` или свой обход `shortGroups`/комбо, как в `levels.test.ts`);
3. `solution` каждого этапа проходит доску ровно за `par` ходов (`tryWay`; для `F1b` — после `mount` и `hop`), `solveLevel(spec).way.length === par`;
4. грани наверху по пути: `F1a` — `[2, 6, 5, 1, 2]`, `F1b` — `[1, 5, 6, 3]`, `F1c` — `[6, 2]`, `F1d` — `[1, 3]` (читать `cubeAt(player).ori.top` после каждого хода);
5. **из любого достижимого положения доска решается, худшее — не больше 5 ходов**: обход состояний как в разделе 6.6 спеки — множество состояний по ключу (клетки и ориентации костей, кость под игроком, уровень игрока), переходы: `step` в каждую сторону (шаг — бесплатно, ход — +1); для каждого состояния `solveFrom(state)` даёт путь; `max(way.length) <= 5`, и ни одного `null`. На этих досках состояний мало (`F1c` ~3, `F1d` ~30, `F1b` ~7, `F1a` 4), обход быстрый;
6. на всех четырёх `levelDeadEnd` не достигается ни из какого состояния обхода (следствие пункта 5: путь есть).

- [ ] **Step 3: Запустить** `npx vitest run src/levels/first.test.ts` — падает (модуля нет).

- [ ] **Step 4: Написать `first.ts`** по Interfaces и спеке. Числа `top`/`north` переписать из таблиц разделов 6.2–6.5, не выводить заново.

- [ ] **Step 5: Прогнать** тест и `npm run typecheck` — зелёные. Если пункт 5 даёт худшее > 5 или `null` — доска переписана не по спеке; сверить координаты с картинками спеки, не менять доску.

- [ ] **Step 6: README** — строка в таблице структуры: `src/levels/first.ts` — первый уровень, четыре этапа без слов.

- [ ] **Step 7: Commit** — `git add src/levels/first.ts src/levels/first.test.ts README.md`.

---

### Task 3: Стрелки свайпа и первого хода убраны везде

**Files:**
- Modify: `src/app/game.ts` — `steer` (строка ~248), `steerGuide` (~1295–1313), `levelGuide` (~1964–1996), `STEER_LINGER_MS` (~161), `STEP_ARROW_LEAD` (~159), вызовы в кадре (~2145–2169), `sealView(…, steer, …)` (~2054), `hudView(…, steer: Dir | null, …)` (~1998)
- Modify: `src/rules/types.ts` — удалить `LevelSpec.arrow` (~432–433)
- Modify: `src/levels/levels.ts`, `src/levels/generate.ts`, `src/levels/recipes.ts`, `scripts/*.mjs` — везде, где читается или пишется `arrow` (`rg -n "arrow" src scripts`)
- Modify: `src/render/overlays.ts` — `GuideArrow.stand` и всё, что нужно только стрелке у ног фигуры (стрелки упражнения остаются: `BoardGuide.arrows` с `y`, `lead`, `dim`)
- Modify: `src/shell/hud.ts` — если `HudSeal` получал направление свайпа только ради стрелки, убрать параметр; если печать показывает направление иначе (метка на печати), оставить
- Test: существующие тесты, которые упоминают `arrow`/`steer` (`rg -n "arrow|steer" src --glob '*.test.ts'`)

**Interfaces:**
- Produces: в `hudView` и `sealView` нет параметра `steer`; `levelGuide` удалён; в кадре `guide.board` на уровне — `null`, в сеансе — `null`; в упражнении — как было (`tutorialView`).

- [ ] **Step 1: Найти все места:** `rg -n "steer|levelGuide|\.arrow\b|arrow:|GuideArrow|STEP_ARROW" src scripts docs/art/VI_Interface_Layer.md`.

- [ ] **Step 2: Убрать** стрелку свайпа (`steer*`) и стрелку первого хода (`levelGuide`, `LevelSpec.arrow`). Жест не трогать: `GestureTracker` и `onRelease` в `src/input/gesture.ts` остаются, шаг по-прежнему по отпусканию. Стрелки упражнения (`?tutorial`) остаются; если `GuideArrow.stand` нужен только убранной стрелке — удалить поле и ветку в `overlays.ts`.

- [ ] **Step 3: Прогнать** `npm test`, `npm run typecheck`, `npm run build` — зелёные; поправить тесты, которые проверяли стрелки (удалить проверку, не ослаблять другие).

- [ ] **Step 4: Проверить глазами** через preview `vi-dev`: Endless — свайп двигает, стрелки нет; `?levels` → `P01` — стрелки первого хода нет; `?tutorial` — стрелки упражнения на месте.

- [ ] **Step 5: Commit.**

---

### Task 4: Знак свайпа и простой

**Files:**
- Create: `src/app/idle.ts`, `src/app/idle.test.ts`
- Modify: `src/shell/hud.ts` — `HudView.sign`, `drawSign`
- Modify: `src/app/game.ts` — счётчик простоя, направление знака, передача в `hudView`
- Modify: `src/shell/theme.ts` — только если знаку нужен размер: одно число `signDot` (пиксели картинки), без новых цветов (цвет — `figure` палитры, если есть; иначе цвет фигуры из `src/render/player.ts` переносится в палитру как `figure`)

**Interfaces:**
- Consumes: `STAGE_SIGNS`, `STAGE_IDLE` (задача 2); `solveFrom(state)` из `levelSolver.ts`; путь шагов до кости (функция, которую `levelGuide` использовал для бледных стрелок, — сохранить её как `stepsTo` при задаче 3, если она была удалена — восстановить из `git show origin/main:src/app/game.ts`).
- Produces:

```ts
// src/app/idle.ts — чистый, без window/DOM
export interface IdleRule { blinkMs: number | null; signMs: number; wasted: number | null }
export interface IdleView { blink: boolean; sign: boolean }
export class Idle {
  constructor(rule: IdleRule);
  /** The player did something: a move or a step. `wasted` is moves made minus progress by the solver since the start. */
  acted(timeMs: number, wasted: number): void;
  /** A panel is open or input is off: time does not count. */
  pause(timeMs: number): void; resume(timeMs: number): void;
  at(timeMs: number): IdleView;
}

// src/shell/hud.ts
export interface HudSign { dir: Dir; mode: 'dot' | 'key'; at: Point /* CSS px of the window: where the trail starts, outside the board */ }
export interface HudView { /* … */ sign?: HudSign | null }
```

Поведение `Idle`: `blink` — с `blinkMs` простоя, пока не пришёл `sign`; `sign` — с `signMs` простоя или сразу, когда `wasted >= rule.wasted`; оба сбрасываются `acted`. Знак первого кадра этапа 1 — не `Idle`, а `STAGE_SIGNS[id]` до первого хода (`levelRun.moves === 0 && stats.steps === 0`).

Рисование `drawSign` в `hud.ts`: `mode: 'dot'` — точка диаметром `signDot` цвета фигуры проезжает отрезок длиной в клетку доски на экране в сторону `dir` за 700 мс, гаснет к концу и повторяется; `mode: 'key'` — знак стрелочной клавиши шрифта программы (`←↑→↓`, как `MenuScreen.pagers`), стоит на месте и мигает раз в секунду. `at` считает `game.ts`: клетка за краем поля со стороны `dir` от клетки игрока по его ряду или столбцу (для `dir` E — `(maxX + 1, playerZ)`), через ту же проекцию `over(x, 0, z)`, что у `counters`; если точка вне окна (телефон, вид «следом»), прижать к краю окна с отступом `safe()`.

Направление по простою: первое действие пути `solveFrom(state)`: если его кость — та, на которой стоит игрок, или игрок на полу под подъёмом, — направление хода; иначе первый шаг `stepsTo` от игрока к кости пути. Если `solveFrom` вернул `null` — знака нет.

`mode`: `settings.controlMode === 'gesture'` → `dot`; иначе `key`; на телефоне (`pointer: coarse`) — `dot`.

- [ ] **Step 1: Тесты `idle.test.ts`:** `blink` в 4000 мс при `blinkMs: 4000`, не раньше; `sign` в 8000; `acted` сбрасывает оба; `wasted: 3` даёт `sign` сразу при `acted(t, 3)`; `pause`/`resume` не считают время панели; при `blinkMs: null` `blink` всегда false.

- [ ] **Step 2: Запустить** — падает. **Step 3: Реализовать** `Idle`. **Step 4:** зелёный.

- [ ] **Step 5: `hud.ts`:** `HudSign`, `drawSign` в кадре после `counters`; тест в `src/shell/hud*.test.ts` по образцу соседних (если рисование не тестируется, тест на то, что `HudView.sign` принимается и кадр не падает).

- [ ] **Step 6: `game.ts`:** поле `idle: Idle | null` (создаётся в `startLevel` для этапа по `STAGE_IDLE`, `null` для уровней списка); `acted` вызывается там, где считаются ход и шаг (`stats.steps`, `levelRun.moves`; найти место, где `lastMove` ставится); `wasted = levelRun.moves − (solveLevel(spec).way.length − solveFrom(state).way.length)` считать только на этапах (доски малы). В `hudView` — `sign` по правилу выше; плашка цели мигает — задача 5 читает `idle.at(time).blink`.

- [ ] **Step 7: Проверить** через preview: `?first` (появится в задаче 6; до неё — временно `?levels` не подходит: проверить в задаче 7 целиком). Здесь — `npm test`, `typecheck`, `build`.

- [ ] **Step 8: Commit.**

---

### Task 5: Плашка из кубиков и плашка над одной костью первого уровня

**Files:**
- Modify: `src/shell/hud.ts` — `drawCounter` (~1125), `plate`, `plateFace`
- Modify: `src/app/game.ts` — сбор `counters` (~2016–2023)
- Test: тест HUD рядом с существующими (`src/shell/hudLayout.test.ts` или новый `src/shell/counter.test.ts`): ширина плашки растёт с `need`, при `have === need` — залитая

**Interfaces:**
- Consumes: `Idle.at(time).blink` (задача 4); `FIRST_LEVEL` id (задача 2).
- Produces: `HudCounter` получает `blink?: boolean`; `drawCounter` рисует `need` кубиков `plateFace(value, …)` в ряд с шагом 12 + 2 px картинки, первые `have` полным тоном, остальные — `faint`; при `blink` вся плашка чередует полный тон и `faint` раз в 500 мс (по `timeMs`, который `frame` уже получает).

В `game.ts`: на этапах первого уровня (`spec.id` начинается с `FIRST_ID`) `counters` считаются не `shortGroups`, а своим отбором: каждая стоящая кость рабочей грани, на которой не стоит игрок, и каждая кучка таких костей — `have` = число костей кучки, `need` = грань; на уровнях списка — как сейчас (`CHAPTERS_COUNTED`, `shortMade`). `blink` — только на этапах, `idle.at(time).blink`.

- [ ] **Step 1: Тест** на отбор плашек первого уровня (чистая функция `firstCounters(state): ShortGroup[]` в `src/app/firstCounters.ts`, тест рядом): на `F1a` одна плашка над (5,2) `1/2`; на `F1b` одна над кучкой (2,0)+(3,0) `2/3`; на `F1d` одна над (0,0)+(1,0) `2/3`; кость под игроком не считается.

- [ ] **Step 2:** падает → реализовать → зелёный.

- [ ] **Step 3: `drawCounter`** из кубиков; старый текст `have/need` убрать совсем (уровни списка тоже получают кубики — это и просил владелец).

- [ ] **Step 4:** `npm test`, `typecheck`, `build`; глазами в preview на `?levels` → `P01`: плашка над кучкой последнего хода — кубики. **Step 5: Commit.**

---

### Task 6: Boot со скипом, экран START, `?first`

**Files:**
- Modify: `src/shell/screens/boot.ts` — `items()`, `draw` (строка-кнопка `SKIP` в правом нижнем углу на длинном boot: `options.first`)
- Create: `src/shell/screens/start.ts` — `StartScreen implements ShellScreen`
- Modify: `src/shell/shell.ts` — `showStart(onStart: () => void): void`
- Modify: `src/shell/text.ts` — `COMMANDS.start`, `COMMANDS.skip` (английское слово с японским программы, как у `resume`)
- Modify: `src/ui/lang/words.ts` — `START`, `SKIP` в шести языках (ru `СТАРТ`, `ПРОПУСТИТЬ`; es `INICIAR`, `SALTAR`; pt `INICIAR`, `PULAR`; tr `BAŞLA`, `GEÇ`; de `START`, `ÜBERSPRINGEN`; fr `DÉMARRER`, `PASSER`) — если `src/shell/text.test.ts` скажет, что слово не влезает, укоротить (de `WEITER`), записать в коммит
- Modify: `src/app/game.ts` — boot-колбэк (~482–503): вместо `showMenu()` → `showStart()`; `?first`; подготовка доски под START
- Test: `src/shell/text.test.ts` (ширина слов), `src/shell/panels.test.ts` или новый `src/shell/start.test.ts` (экран даёт одну зону `start`, её прямоугольник не меньше 88×… CSS px и шириной в половину сцены)

**Interfaces:**
- Consumes: `FIRST_LEVEL`, `FIRST_ID` (задача 2); `nextLevel()`, `keptRun()`, `begin()` в `game.ts`.
- Produces:

```ts
// src/shell/screens/start.ts
export class StartScreen implements ShellScreen {
  readonly home = 'start';
  constructor(context: ShellContext, onStart: () => void);
  items(): ShellItem[];           // одна зона 'start'; action = onStart
  update(timeMs: number): boolean;
  draw(kit: Kit, focus: ShellFocus): void; // затемнение как у PanelScreen над партией; кнопка — как залитая строка-команда меню в фокусе (те же ink/bg палитры, красная метка седьмого), только крупнее: надпись COMMANDS.start размером saySize или больше, по центру сцены. Нового цвета в теме нет (слово владельца: «держи визуал в рамках»)
}
// src/shell/shell.ts
showStart(onStart: () => void): void; // this.show(new StartScreen(this.context, onStart), false) — поле под ним видно и отступает, как под панелью паузы
```

`game.ts`:

```ts
private showStart(): void {
  // Доска того, что игрок будет играть, стоит под экраном START без фигуры и без хода времени.
  const first = !this.settings.levels.passed[FIRST_ID];
  if (first) this.startStage(0); else this.startLevel(this.nextLevel());
  this.paused = true;                      // партия не тикает
  this.view.showFigure(false);             // новое в BoardView: фигура не рисуется
  this.shell.showStart(() => {
    this.view.showFigure(true);            // первая версия: фигура появляется на кадре; подъём фигуры — если player.ts его уже умеет (riseIn), иначе без него
    this.paused = false; this.shell.hide(); this.audio.setPaused(false); this.lastFrame = 0;
  });
}
```

`startStage(index)` — задача 7; в этой задаче временно `startLevel(0)` для `first`, и `startStage` приходит в задаче 7. Boot-колбэк: `kept` → `continueRun(kept)` как сейчас; `?first` → `startStage(0)` без START (как `?tutorial`); иначе `showStart()`. `?levels`, `?tutorial`, `?tasks` — как сейчас.

- [ ] **Step 1: Прочитать** `PanelScreen` (`src/shell/screens/panel.ts`): как рисуется затемнение над доской при `alone: false`; `MenuScreen` — как рисуется залитая кнопка/плашка и как ставится зона `ShellItem` с `rect`; `BootScreen.items()` (сейчас `[]`).

- [ ] **Step 2: Тесты:** `start.test.ts` — одна зона, размеры; `text.test.ts` — слова влезают; тест boot — на длинном boot есть зона `skip`, на коротком нет.

- [ ] **Step 3:** падает → реализовать экраны, слова, `showFigure` в `BoardView` (флаг, по которому `player` не рисуется) → зелёный.

- [ ] **Step 4: `game.ts`** boot-колбэк и `showStart`, `?first`.

- [ ] **Step 5: Проверить** в preview с чистым хранилищем (`localStorage.removeItem('vi.settings.v3')` в консоли, перезагрузка): длинный boot, в углу `SKIP`, нажатие пропускает; затем затемнённое поле и `START`; нажатие — фигура на кубе, свайп катит. Второй запуск: короткий boot без `SKIP`, `START`. Снимок телефонной ширины (360) и 1080: кнопка не меньше двух пальцев. Клавиатура: Enter запускает.

- [ ] **Step 6:** `npm test`, `typecheck`, `build`. **Step 7: Commit.**

---

### Task 7: Лента: этапы, перерисовка поля, строка итога

**Files:**
- Modify: `src/app/game.ts` — `startStage`, `ribbon`, конец уровня (~2108–2116), `showLevelResult` только для проигрыша, пауза на этапах (`RESTART`), `countLevel` для `F1`
- Modify: `src/render/view.ts` — `setReveal(rows: number | null)`, `showFigure`, переход
- Modify: `src/render/textures.ts` — `gridTexture(layout, line, edge, rows?)`, `frameTexture(layout, rows?)`: рисуются только ряды `z < rows`
- Modify: `src/shell/hud.ts` — `HudView.outcome: { stars: number; moves: number } | null`, рисуется в показаниях уровня (`HudLevel`) вместо строки `moves`, звёзды знаками списка уровней
- Test: `src/app/ribbon.test.ts` (новый, чистая часть): порядок досок ленты (`F1a`→`F1b`→`F1c`→`F1d`→`LEVELS[0]`→`LEVELS[1]`…), фазы перехода по времени; `src/render` не тестируется в vitest — проверка глазами

**Interfaces:**
- Consumes: `FIRST_LEVEL` (задача 2), `showFigure` (задача 6), `Idle` (задача 4).
- Produces:

```ts
// src/app/ribbon.ts — чистый
export type RibbonPhase = 'leave' | 'fade' | 'reveal' | 'figure' | 'done';
export const RIBBON_MS = { fade: 500, reveal: 800, figure: 300 } as const;
export function ribbonPhase(elapsedMs: number, reduced: boolean): { phase: RibbonPhase; rows: number /* 0..1 доля рядов */ };
/** What comes after a board of the ribbon: the next stage, the first level of the list after the last stage, the next level of the list, or null after the last. */
export function nextBoard(current: { stage?: number; level?: number }, stages: number, levels: number): { stage?: number; level?: number } | null;
```

`game.ts`:

- `startStage(index: number)`: как `startLevel`, но спека — `FIRST_LEVEL[index]`, `this.kind = 'level'`, `this.stage = index`, без `limitedLevel`, `undosLeft = 3`; `idle = new Idle(STAGE_IDLE[spec.id])`; `track('progression_started', { ...this.step(), level: spec.id })`.
- Конец доски: в кадре, где сейчас `showLevelResult()` при `passed`, — если `this.kind === 'level'` и `state.endReason === 'passed'`: не окно, а `this.ribbon = { start: time, next: nextBoard(...) }`; `next === null` → `showLevelResult()` как сейчас (после последнего уровня списка). Проигрыш — окно, как сейчас.
- Переход по фазам `ribbonPhase`: `leave` — финал как сейчас (`finaleOver`); `fade` — `view.setReveal(rows)` от полной доски к нулю; на границе `fade→reveal` — `startStage`/`startLevel` следующей доски с `riseIn: true` (кости и фигура поднимаются, как при старте сеанса) и `setReveal(0)`; `reveal` — `setReveal` растёт до полной; `figure` — фигура видна (`showFigure(true)`); `done` — ввод включён (`inputEnabled` учитывает `this.ribbon !== null`), `ribbon = null`. Фигура при `riseIn` поднимается с костью, на которой стоит; при `onFloor` (этап 2) — на полу в кармане: проверить, что `view.reset(true)` это умеет; если фигура на полу не поднимается — показать её на первом кадре `figure`.
- Строка итога: при переходе от уровня списка (`spec.par !== undefined`, не этап) `hud` получает `outcome: { stars: levelStars(moves, par), moves }` до первого хода новой доски; `countLevel` как сейчас пишет статистику; для этапов `outcome: null`.
- `countLevel` на этапе `F1d`: `settings.levels.passed[FIRST_ID] = true`, `levelStat(FIRST_ID).passes++`, без `bestMoves`; этапы `F1a..F1c` статистики не пишут (не считать их уровнями в `levelStat`).
- Пауза на этапе: `RESTART` → `startStage(this.stage)`; `LEVELS` → `showLevels()` как есть; `MENU` как есть.
- `keptRun`: первый уровень не сохраняется (`saveRun` пропускает `kind === 'level'` с `spec.id` первого уровня) — при следующем запуске START ведёт на этап 1.
- Уменьшенное движение: `ribbonPhase(…, reduced: true)` — `fade` и `reveal` по 0 мс, `rows` сразу 1.

`view.ts`: `setReveal(rows)` — перерисовать `grid`/`frame` текстуры с `rows` (кэшировать по целому числу рядов; доска ≤ 6 рядов — не больше семи текстур за переход); `null` — полная доска. Камера «следом» переезжает сама, как при любом старте доски (`settled = false` в `reset`).

Звук: на границе `fade→reveal` — звук прихода кости из сеанса (найти в `src/audio`, событие прихода), не новый.

- [ ] **Step 1: Прочитать** конец уровня в кадре `game.ts` (~2100–2116, `finaleOver` ~1935), `begin` (~784), `useView` (~723), `BoardView.reset`/`leaveBoard` (~514–545), `gridTexture`/`frameTexture` (`textures.ts` ~257–300), как `riseIn` поднимает фигуру (`src/render/player.ts`), `savedRun.ts` (`packRun`).

- [ ] **Step 2: Тесты `ribbon.test.ts`:** `nextBoard({ stage: 3 }, 4, 30)` → `{ level: 0 }`; `nextBoard({ stage: 0 }, 4, 30)` → `{ stage: 1 }`; `nextBoard({ level: 29 }, 4, 30)` → `null`; `ribbonPhase(0)` → `fade`, `rows: 1`; `ribbonPhase(250)` → `fade`, `rows: 0.5`; `ribbonPhase(500)` → `reveal`, `rows: 0`; `ribbonPhase(1300)` → `figure`; `ribbonPhase(1600)` → `done`; `reduced: true` → `ribbonPhase(0)` уже `figure` с `rows: 1`.

- [ ] **Step 3:** падает → `ribbon.ts` → зелёный.

- [ ] **Step 4: `textures.ts` и `view.ts`:** `rows`, `setReveal`, `showFigure` (если не сделан в задаче 6).

- [ ] **Step 5: `game.ts`:** `startStage`, `ribbon` в кадре, `outcome`, `countLevel` для `F1`, пауза, `keptRun`.

- [ ] **Step 6: `hud.ts`:** `outcome` в показаниях уровня.

- [ ] **Step 7: Проверить** в preview с чистым хранилищем: boot → `SKIP` → `START` → этап 1 (знак свайпа E с первого кадра, четыре переката, комбо из двух, плашка `1/2` кубиками) → перерисовка → этап 2 (фигура в кармане, подъём на лесенку, лесенка уходит с первым перекатом, тройка поднимается поворотом) → этап 3 (без знака; через 4 с мигает плашка; через 8 с знак N) → этап 4 (знак W по простою) → перерисовка → `P01` без окна; пройти `P01` по `solution` из `levels.ts` → строка итога со звёздами над доской, перерисовка → `P02`. Пауза → `MENU` → меню. Перезагрузка: `START` ведёт на `P02` (или первый непройденный). `?first` открывает этап 1 снова. Снимки: телефон 360 и экран 1080 — этап 1 со знаком, перерисовка, строка итога.

- [ ] **Step 8:** `npm test`, `typecheck`, `build`. **Step 9: Commit.**

---

### Task 8: Документы и отчёт

**Files:**
- Modify: `docs/VI_Levels_Rules.md` (разделы 1 и 12), `docs/art/VI_Interface_Layer.md` («Что входит в слой»), `docs/art/VI_World_Logic.md` («Механики», «Оболочка»), `docs/VI_Levels_Onboarding_Decisions.md` (шапка), `docs/ROADMAP.md` («Дальше»), `docs/superpowers/specs/2026-10-08-vi-first-level-design.md` (раздел «Что при сборке вышло иначе», если вышло)

- [ ] **Step 1: Строки по разделу 10 спеки.** В слое интерфейса — семь строк (скип, START, строка итога, знак свайпа, плашка из кубиков — правка строки счётчика, перерисовка поля) и две правки «убрано 8 октября по слову владельца» у стрелок свайпа и первого хода, с указанием кода (`steerGuide`, `levelGuide` удалены). В правилах уровня: раздел 1 — раскладка может задать уходящую кость и игрока на полу (ссылка на спеку); раздел 12 — строка «8 октября | раскладка с уходящей костью и игроком на полу — первый уровень | владелец». В логике мира — строки без слов лора (место и ссылка на VI_Lore.md). В ROADMAP — сделано и что дальше (закрепление, новая механика, мост отложен). В решениях по обучению — абзац вверху с датой.

- [ ] **Step 2: Раздел «Что при сборке вышло иначе»** в спеке: каждое отступление от спеки с причиной (например, фигура на полу при `riseIn`, звук проявления, ширина слов).

- [ ] **Step 3: Полная проверка:** `npm test`, `npm run typecheck`, `npm run build`; `git diff --stat origin/main -- src/rules` — только файлы задачи 1.

- [ ] **Step 4: Отчёт владельцу** коротко: что собрано, снимки (телефон и экран), что вышло иначе, открытые вопросы спеки (раздел 13) и вопрос «коммит и пуш?». Пуш — только после «ок».

- [ ] **Step 5: Commit** документов.

---

## Самопроверка плана по спеке

| Раздел спеки | Задача |
|---|---|
| 3.1 boot и скип | 6 |
| 3.2 экран START | 6 |
| 3.3 куда ведёт START | 6, 7 (`?first`, `keptRun`) |
| 4.1 лента | 7 |
| 4.2 строка итога, окно проигрыша | 7 |
| 4.3 пауза, `?first` | 6, 7 |
| 5 правила | 1 |
| 6 четыре доски | 2 |
| 7.1 знак свайпа | 4 |
| 7.2 плашка | 5 |
| 7.3 простой | 4, 5 |
| 7.4 стрелки убраны | 3 |
| 8 перерисовка | 7 |
| 9 хранение, телеметрия, язык | 6, 7 |
| 10 документы | 8 |
| 11 проверка | 6, 7, 8 |
