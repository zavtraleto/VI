# VI — уровни: правила уровня и проба

Дата: 4 октября 2026 · Статус: решения приняты владельцем, спека ждёт его просмотра. Исполнитель: Opus. Область: `src/rules`, новый `src/levels`, `src/app`, `src/shell`, `src/render`, `scripts`.

Исполнителю хватает этой страницы и названных в ней файлов. Откуда решения: [VI_Levels_Brief.md](../../VI_Levels_Brief.md), [VI_TurnBased_Research.md](../../VI_TurnBased_Research.md). Код сверен с `origin/main` (`dadd2fa`).

## 1. Что решено

| Вопрос | Решение |
|---|---|
| 1. Что двигает мир | Только ход. Ход — перекат или толчок. Пока игрок думает или ходит, мир стоит |
| 2. Между ходами | Высоты остаются. Кости растут и тонут плавно, но только пока длится ход |
| 3а. Приход | Добор до нормы костей уровня. Сверх нормы ничего не приходит, поле заполниться не может |
| 3б. Повтор | Сид закреплён: старт один и тот же, приход считается из сида и ходов игрока |
| 4. Цели | Три: отправить N костей; заказ по значениям; цепочка в N звеньев |
| 5. Проигрыш | Один: ходы кончились, цель не выполнена. Уровень кончается в момент выполнения цели |
| 6. Отмена | Нет. «Заново» — в любой момент и бесплатно |
| 7. Пол, причалы, «ждать» | Пол, толчок, подъём и причалы как сейчас. Команды «ждать» нет: когда хода нет, мир доигрывает сам |
| 23. Проба | Восемь уровней, поля 5×5 и 7×7, адрес `?levels` в любой сборке, отчёт попыток текстом |
| 24. Показ | Цель с прогрессом, остаток ходов, итог; число ходов до ухода группы — строкой под полем |

Числа ниже — стартовые; их подберут боты и плейтест.

## 2. Правила уровня

Уровень — новый режим партии `'level'` рядом с `'puzzle'`. Endless, сеанс дня, обучение и пазлы не меняются: ни один их тест не правится, `RULES_VERSION` остаётся `0.9`.

### Такт

- **Ход** — принятая команда, которая дала `roll` или `push`. Заблокированная команда и `hop`, `walk`, `mount`, `climb`, `descend` ходом не считаются.
- **Такт** — `actionTicks` (10) мировых тиков. Его начинает ход; мир идёт, пока кость летит.
- **Мировой тик** — тик, в начале которого есть кость `moving` или идёт свободный такт (`levelRun.beat > 0`). Только в мировой тик кости тонут и растут, идут знаки прихода, растёт `state.tick`.
- **Свободный такт.** Если уровень не кончен, фигура не в действии, летящих костей нет, `beat === 0` и на поле нет ни одной кости `idle` — `beat = actionTicks`. Ходов он не тратит.
- **Конец такта** — тик, в начале которого кость летела, а после `finishMovements` летящих нет; для свободного такта — тик, в котором `beat` дошёл до нуля.

Порядок внутри тика уровня (`stepLevel`):

1. `accepts = cmd !== null && canAcceptCommand(state)`; `world` = есть `moving` или `beat > 0` — оба до всего остального.
2. `finishMovements` — всегда: шаг фигуры идёт и при стоящем мире.
3. Если `world`: `finishRemovals`, `finishRisings`, `advancePending`, `beat--` (если был), `countStats`, `state.tick++`; если это конец такта — `endBeat`.
4. Если `accepts` и уровень не кончен: `applyMove`; если получился `roll` или `push` — `levelRun.moves++`.
5. Проверка свободного такта.

`endBeat` по порядку: счёт цели по событиям этого тика → конец уровня → добор.

### Числа

| Что | Значение | Где задано |
|---|---|---|
| Группа уходит | 6 ходов | `LevelSpec.sinkMoves`, по умолчанию `LEVEL_SINK_MOVES` |
| Новое звено возвращает | 2 хода | `LevelSpec.liftMoves`, по умолчанию `LEVEL_LIFT_MOVES` |
| Знак прихода | 2 тика следующего такта | `LEVEL_WARN_TICKS` |
| Подъём кости | `actionTicks − LEVEL_WARN_TICKS` = 8 тиков | из них же |
| Добор | 1 кость за такт | `LEVEL_REFILL` |
| Доля полезных | 0,65 | `LevelSpec.helpRate`, по умолчанию `LEVEL_HELP_RATE` |
| Пороги высот, `feedRate` | как в `DEFAULT_TUNING` | `defaultConfig()` |

`sinkingTicks = sinkMoves × actionTicks + 1`. Единица нужна: кость группы получает первый тик утопания в тик своей посадки. С ней выполняется точно:

- группа, собранная ходом *m*, принимает звено, севшее на ходах *m+1 … m+6*, а к посадке хода *m+7* её уже нет;
- кость, объявленная в конце хода *m*, стоит (`idle`) в конце хода *m+1*; между ходами на поле есть только стоящие кости, уходящие кости и знаки.

`chainLift = chainLiftMin = liftMoves × actionTicks / sinkingTicks`.

### Добор

В конце каждого такта, пока `population(state) < spec.norm` и есть свободная клетка без знака, объявляется не больше `LEVEL_REFILL` костей. Каждая выбирается по порядку:

1. **Лифт.** Игрок на полу, `hasWayUp(state)` ложно, его клетка свободна и без знака — кость объявляется под ним.
2. **Подсадная:** `chainFeeder(state, free)`.
3. **Обычная:** `helpful = deal(state.helpDeck, HELP_DECK, config.helpRate)`, затем `chooseCell` и `chooseOrientation`.

Верхняя грань пришедшей кости — только из `spec.values`: в `chooseOrientation` веса значений равны 1 для значений уровня и 0 для остальных, а `wanted` (грани соседей) отфильтрован по `spec.values`. Подсадная кость приносит значение цепочки, каким бы оно ни было.

Залпов, волн, подарков, тишины, мягкого старта и таймера лифта на уровне нет.

### Старт

`placeLevelLayout(state)` — та же логика, что `tryStartLayout`: `spec.norm` костей, игрок на кости в центре (`startX = startZ = floor(size / 2)`), готовых групп нет. Отличия: верхние грани только из `spec.values`; открытие (группа без одной кости в одном перекате) делается всегда, его значение берётся из `OPENING_VALUES`, отфильтрованных по `spec.values`; если пересечение пусто, открытия нет. Запасной раскладки нет: сто неудачных попыток — `throw` с номером уровня.

### Цель, лимит, конец

- Кость считается отправленной в тик, когда она вошла в группу: события `match`, `chain` (поля `value`, `count`) и `happyOne` (`count`, значение 1). Кость, по которой прокатились, второй раз не считается.
- `send` — сумма отправленных ≥ `count`. `order` — по каждому значению заказа отправлено не меньше нужного. `chain` — наибольшее `chain` из событий ≥ `links` (первая группа — звено 1).
- В конце такта: цель выполнена → `over`, `endReason = 'passed'`, событие `levelPassed`. Иначе, если `spec.moves > 0` и `levelRun.moves >= spec.moves` → `over`, `endReason = 'failed'`, событие `levelFailed`. Цель, выполненная последним ходом, — победа.
- `spec.moves === 0` — уровень без лимита: так его играют боты.

### Что на уровне выключено

`runTutorial`, `runPhase`, `runWave`, `countChainQuiet`, `runSpawn` (вместо него `advancePending` и добор), `runPuzzle`, `checkFill`, `checkClock`; рост `state.level` в `removeCube`; очки за чистое поле. `state.level` — это уровень темпа Endless, а не номер уровня игры: в режиме уровня он остаётся 1. `state.score` считается как обычно, но нигде не показан.

## 3. Типы

```ts
// src/rules/types.ts
export type LevelGoal =
  | { kind: 'send'; count: number }
  | { kind: 'order'; items: readonly { value: number; count: number }[] }
  | { kind: 'chain'; links: number };

export interface LevelSpec {
  id: string;
  seed: number;
  size: number;
  goal: LevelGoal;
  /** Limit of moves; 0 for none. */
  moves: number;
  /** Top faces the dice start and arrive with. */
  values: readonly number[];
  /** Dice the board starts with and is refilled to. */
  norm: number;
  helpRate?: number;
  sinkMoves?: number;
  liftMoves?: number;
}

export interface LevelRun {
  spec: LevelSpec;
  /** Rolls and pushes made. */
  moves: number;
  /** Dice sent, by top value: index 0 is the 1. */
  sent: number[];
  bestChain: number;
  /** World ticks left of a beat the world plays by itself. */
  beat: number;
}
```

`RunMode` получает `'level'`; `RunState` — `levelRun: LevelRun | null`; `endReason` — `'passed' | 'failed'`; `GameEvent` — `{ type: 'levelPassed' }` и `{ type: 'levelFailed' }`.

```ts
// src/rules/level.ts
export const LEVEL_SINK_MOVES = 6, LEVEL_LIFT_MOVES = 2, LEVEL_WARN_TICKS = 2, LEVEL_REFILL = 1, LEVEL_HELP_RATE = 0.65;
export function levelConfig(config: RulesConfig, spec: LevelSpec): RulesConfig;
/** One line per thing counted. `value`: the face of an order, 0 for dice of any face, -1 for links of a chain. */
export function goalLines(run: LevelRun): { value: number; have: number; need: number }[];
export function goalReached(run: LevelRun): boolean;
/** Open chains: the value and how many more moves a die that lands still joins. */
export function chainWindows(state: RunState): { value: number; moves: number }[];
/** False while a level holds the world still: the picture must not run ahead of it. */
export function worldRuns(state: RunState): boolean;
export function endBeat(state: RunState): void;

// src/rules/levelBot.ts
export interface LevelPlay { skill: SkillName; botSeed: number; reached: boolean; moves: number; steps: number }
export function playLevel(spec: LevelSpec, skill: SkillName, botSeed: number, maxMoves?: number): LevelPlay;
export function levelTable(opts?: { levels?: readonly LevelSpec[]; skills?: readonly SkillName[]; runs?: number; maxMoves?: number; seeds?: number }): string;
```

`chainWindows`: для каждой реакции с костями `sinking` — `floor((sinkingTicks − t) / actionTicks)`, где `t` — наименьшее у её костей.

## 4. Правила: правки по файлам

| Файл | Что |
|---|---|
| `src/rules/types.ts` | типы раздела 3 |
| `src/rules/level.ts` (новый) | константы и функции раздела 3. `levelConfig`: `size`, `startX/Z`, `startCubes = targetCubes = norm`, `warnTicks`, `risingTicks`, `sinkingTicks = sinkStartTicks = sinkFloorTicks`, `chainLift = chainLiftMin`, `helpRate`, `warnOccupied = size²`, `wipeBonus = 0`, `custom = false`; **новый** объект `experiments`: `floorClimb` и `dockSteps` включены, `soloOne`, `gentleStart`, `floorLift`, `chainCalm`, `timeFloor`, `waves`, `surge`, `opening`, `lastSliver`, `gift` выключены |
| `src/rules/sim.ts` | `RunOptions.level?: LevelSpec`; в `createRun` — `levelConfig`, `mode: 'level'`, `levelRun`, `spawnEnabled: false`, `placeLevelLayout`; `empty` работает и с `level`. В `step`: при `state.levelRun` — `stepLevel` по разделу 2 |
| `src/rules/spawn.ts` | экспорт `advancePending`; `placeLevelLayout`; `refillLevel(state)` — добор; веса значений уровня в `chooseOrientation`; открытие уровня в `openingOf` |
| `src/rules/reactions.ts` | `removeCube`: при `mode === 'level'` уровень темпа не растёт |
| `src/rules/index.ts` | экспорт нового |
| `src/rules/testkit.ts` | `levelRun(spec?: Partial<LevelSpec>)`: пустое поле уровня для тестов |

## 5. Боты считают ходы

`src/rules/levelBot.ts` по образцу `paceBot.ts`, `scripts/levels.mjs` по образцу `scripts/pace.mjs`.

- `playLevel`: `createRun({ seed: spec.seed, config: defaultConfig(), level: { ...spec, moves: 0 } })`, `createBot(SKILLS[skill], botSeed)`; цикл `step(state, botCommand(bot, state))` до `state.over`, до `maxMoves` (300) ходов или до 200 000 вызовов. `moves` — ходы до цели, `steps` — `stats.steps`.
- Бот цель не знает и ищет любую очистку. Для заказов и цепочек его число — оценка сверху; знание цели — следующая задача, не эта.
- `levelTable`: по уровню и боту — доля дошедших до цели, ходы p5 / p50 / p75 / p90, доля прошедших при лимите уровня. По умолчанию 40 прогонов (`botSeed` 1…40). Не дошедший прогон в перцентилях считается бесконечностью.
- С `seeds=N` таблица по каждому уровню печатает медиану бота `novice` для сидов 1…N.
- `node scripts/levels.mjs`, аргументы `runs=`, `players=`, `level=`, `seeds=`.

## 6. Проба: восемь уровней

`src/levels/levels.ts`: `export const PROBE_LEVELS: readonly LevelSpec[]`.

| id | Поле | Значения | Норма | Цель | Лимит: бот и перцентиль |
|---|---|---|---|---|---|
| `p01` | 5 | 2, 3 | 8 | отправить 6 | `newbie` p90 |
| `p02` | 5 | 2, 3 | 8 | заказ: 4 двойки | `newbie` p90 |
| `p03` | 5 | 2, 3, 4 | 8 | отправить 12 | `novice` p75 |
| `p04` | 7 | 2, 3, 4 | 14 | заказ: 4 двойки и 6 троек | `novice` p75 |
| `p05` | 5 | 2, 3 | 8 | цепочка в 2 звена | `average` p75 |
| `p06` | 7 | 2, 3, 4, 5 | 14 | отправить 20 | `novice` p75 |
| `p07` | 7 | 2, 3, 4, 5 | 14 | заказ: 6 троек и 4 четвёрки | `average` p50 |
| `p08` | 7 | 1–6 | 14 | цепочка в 3 звена | `average` p50 |

Сид и лимит подбираются скриптом, руками ничего не выдумывается:

1. **Сид.** `node scripts/levels.mjs seeds=12`; уровню берётся сид, чья медиана `novice` — средняя из двенадцати (шестая по возрастанию).
2. **Лимит.** `moves = ceil(перцентиль из таблицы)`. Если названный бот доходит до цели реже чем в 80% прогонов, берётся следующий по силе бот с тем же перцентилем; это отмечается в отчёте.
3. Итоговая таблица `levelTable` по восьми уровням прикладывается к отчёту.

## 7. Приложение и интерфейс

В приложении уровень ведёт себя как пазл везде, где пазл отключает счёт, контакт и сохранение партии: все места — поиск `state.puzzle` в `src/app/game.ts`. Реклама на уровнях не показывается.

| Файл | Что |
|---|---|
| `src/app/game.ts` | `RunKind` + `'level'`; `levelIndex`; `startLevel(index)` — `createRun({ seed: spec.seed, config: defaultConfig(), level: spec })`, без настроек игрока; `restartLevel`; `showLevels`; `showLevelResult`; в `frame` итог уровня; `onRestart` шапки и клавиша R — по виду партии; пауза — `pausePanel({ task: true, … })` с возвратом в список уровней. Адрес: `new URLSearchParams(location.search).has('levels')`, читается в любой сборке; с ним после загрузки вместо меню открывается список уровней. Телеметрия: `progression_started / completed / failed` с `step_id: level_<id>`, ходами, остатком, номером попытки |
| `src/app/game.ts`, `hudView` | шапка `kind: 'level'`; `note` — строка об уходящих группах из `chainWindows`, если они есть, иначе подсказка; `tools` — только «заново» |
| `src/platform/settings.ts` | `Settings.levels: { passed: Record<string, boolean>; stats: Record<string, LevelStat> }` со значением по умолчанию и слиянием в `loadSettings`; `levelStat(settings, id)`. `LevelStat`: `tries`, `passes`, `fails`, `firstPassTry: number \| null`, `bestLeft: number \| null`, `short: number[]` (недобор цели на каждом проигрыше, последние 20), `playMs` |
| `src/app/levelStats.ts` (новый) | `levelReport(levels, stats): string` — по образцу `puzzleReport`: английский текст без спецсимволов |
| `src/shell/hud.ts` | `HudLevel { kind: 'level'; number: number; left: number \| null; goal: readonly { value: number; have: number; need: number }[] }` в `HudView.header`; `drawLevel` и `drawLevelWide` по образцу `drawTask` и `drawTaskWide`; `tools.retryOnly?: boolean` — без кнопки отмены |
| `src/shell/panels.ts` | `levelsPanel` по образцу `tasksPanel`: клетки уровней (пройденный — одна отметка), в примечании клетки — цель в том же виде, что в шапке, без счёта (`目標 12`, `CH2 04 · CH3 06`, `連鎖 3`); команды SHARE (отчёт через `shareOut`) и MENU. `levelResultPanel`: «пройден» — остаток ходов; «не пройден» — строки цели `есть/нужно`; команды NEXT (если пройден и есть следующий), AGAIN, LEVELS |
| `src/shell/text.ts`, `src/ui/i18n.ts` | подписи и строка `levelChain` (ru, en) |
| `src/render/cubes.ts:214`, `src/render/signs.ts:24`, `src/render/player.ts:67` | высота кости берётся с `alpha = 0`, когда `worldRuns(state)` ложно: иначе стоящие кости дрожат на долю тика |

Попытка считается с первого хода, как у пазлов. Проигрыш пишет `fails` и недобор, победа — `passes`, `firstPassTry`, `bestLeft`.

**Вид — временный.** Владелец ведёт стиль; исполнитель собирает показания из готовых примитивов (`kit.text`, `counter`, палитра темы) и ничего не оформляет заново. Подписи пробы, чтобы не выдумывать на месте:

| Что | Подпись |
|---|---|
| Остаток ходов | `HUD.moves`, крупное число, как ходы пазла |
| Номер уровня | `HUD.level` и число: `LV 03` |
| Строка цели | любые кости — `HUD.target 04/12`; заказ — `CH2 03/04` (`HUD.channel`); цепочка — `RESULT.chain.native 1/3` |
| Список | `PANELS.levels = { native: '段階', name: 'LEVELS' }`, команда такая же |
| Итог | пройден — `PANELS.cleared`; не пройден — `PANELS.failed = { native: '失敗', name: 'FAILED' }`; остаток — `RESULT.left = { native: '残り', name: 'MOVES LEFT' }` |
| Строка под полем | ru «Уходит {value}. Ходов: {moves}», en «{value} leaving. Moves: {moves}»; несколько групп — через « · » |

Документы, в той же правке: строки в [VI_Interface_Layer.md](../../art/VI_Interface_Layer.md) (шапка уровня, строка об уходящей группе, список, итог — «в слое; временный вид, проба»); строка в разделе «Механики» [VI_World_Logic.md](../../art/VI_World_Logic.md): «на уровне мир идёт только от хода» с пометкой «причина в мире не решена, лор после пробы»; строка `src/levels` в таблице [README.md](../../../README.md).

## 8. Тесты и проверка

`src/rules/level.test.ts`:

- мир стоит: при стоящей кости на поле N пустых тиков не меняют состояние, включая `tick`;
- `hop`, `walk`, `climb`, `descend` не двигают мир и не тратят ход; `roll` и `push` двигают мир ровно на `actionTicks` и тратят по ходу; заблокированная команда — ничего;
- окно группы: звено садится на ходу *m+6* и входит в цепочку; на ходу *m+7* группы уже нет; `chainWindows` даёт 6, 5, … 1;
- добор: после ухода группы приходит по кости за такт до нормы и не выше; объявленная кость стоит к концу следующего такта; верх пришедшей кости — из `values`;
- цели: `send`, `order`, `chain` считаются в тик сбора группы; единицы считаются по `happyOne`; победа ставит `endReason: 'passed'` в тик посадки;
- лимит: `failed` в тик посадки последнего хода; цель последним ходом — `passed`; при `moves: 0` лимита нет;
- свободный такт: без стоящих костей мир идёт сам, пока кость не встанет; ходы не тратятся;
- `levelUp`, `wiped`, `gameOver` на уровне не бывает; костей вне утопания никогда не больше нормы;
- детерминизм: один сид и одни команды дают одно состояние при любом числе пустых тиков между командами.

`src/levels/levels.test.ts`: каждый из восьми уровней создаётся, стоит `norm` костей, готовой группы нет; уровень проходим в свой лимит: хотя бы один прогон ботов `average`, `pro`, `esports` с `botSeed` 1…5 доходит до цели не позже лимита.

`src/rules/levelBot.test.ts`: `playLevel` повторяем; `average` доходит до цели `p01`.

`src/app/levelStats.test.ts`: отчёт по образцу `puzzleStats.test.ts`.

Команды: `npm test`, `npm run typecheck`, `npm run build`, `node scripts/levels.mjs`. В превью (`vi-dev`, порт 5183) по адресу `/?levels`: пройти уровень, проиграть уровень, «заново», поля 5×5 и 7×7, ширина телефона и широкий экран; обычный адрес без `?levels` открывает меню как раньше.

## 9. Порядок шагов

1. Типы и `level.ts`: `levelConfig`, счёт цели, `chainWindows`, `worldRuns`.
2. `stepLevel` в `sim.ts`, добор и старт в `spawn.ts`, правка `removeCube`; тесты раздела 8 для правил.
3. `levelBot.ts`, `scripts/levels.mjs`.
4. `src/levels/levels.ts` с временными сидами и лимитами; подбор сидов и лимитов по разделу 6; тесты уровней.
5. Приложение: старт, шапка, строка, итог, список, адрес, отчёт, телеметрия; правка высот в рендере.
6. Строки в документах. Полная проверка.

## 10. О что можно споткнуться

- `createRun` копирует конфиг поверхностно: `experiments` общий с вызывающим. `levelConfig` обязан собрать новый объект.
- `FALLBACK_CELLS` в `spawn.ts` нарисованы под 7×7; уровень их не использует.
- Объединения `RunMode`, `endReason`, `GameEvent`, `HudView.header` закрытые: `typecheck` покажет все места.
- `packRun` (`src/app/savedRun.ts`) для уровня должен вернуть `null`: уровень не сохраняется посреди партии.
- `state.tick` на уровне считает только мировые тики и временем не служит: длительность попытки берётся из `playMs`, а не из `seconds()`.
- Удержанное направление повторяет команду и на уровне тратит ходы. Не чинить: это вопрос к плейтесту.

## 11. Готово, когда

- По адресу `?levels` открывается список из восьми уровней; каждый проходится и проигрывается; итог показывает остаток ходов или недобор.
- Пока игрок стоит или ходит, на поле ничего не меняется и не дрожит.
- `node scripts/levels.mjs` печатает таблицу; сиды и лимиты в `src/levels/levels.ts` взяты из неё.
- Тесты, проверка типов и сборка проходят; существующие тесты не менялись.
- Ничего не закоммичено.

Показать владельцу: адрес пробы; таблицу ботов по восьми уровням; что получилось иначе, чем в спеке, и почему; на что смотреть в плейтесте — хватает ли шести ходов на цепочку, мешает ли приход, сколько попыток уходит на уровни 7 и 8, заметна ли разница между 5×5 и 7×7, стоят ли ходов случайные свайпы.

## 12. Вне этой задачи

Обучение уровнями и подсказки; оценка, награда, счёт внутри уровня, «уйти или остаться»; бот, знающий цель, и перебор сидов; формат уровня с заданной раскладкой; главы, карта, меню; реклама; лор; новые элементы поля. Endless, сеанс дня, обучение и пазлы не трогаются.
