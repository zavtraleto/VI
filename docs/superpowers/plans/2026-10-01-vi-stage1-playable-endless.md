# VI, этап 1: логика и играбельный Endless — план реализации

> **For agentic workers:** план исполняется инлайн в той же сессии, где написан (решение владельца проекта: автономная работа, отчёт по вехам). Поэтому шаги содержат интерфейсы и тест-кейсы, а не готовый код. Шаги отмечаются чекбоксами.

**Goal:** играбельный Endless на примитивах с обучением, тачем и клавиатурой, переключателями экспериментов и панелью плейтеста; запуск локально.

**Architecture:** чистый детерминированный модуль правил (шаг 20 мс, seeded PRNG, состояние — простой JSON), поверх него раннер с фиксированным шагом, Three.js-рендер с интерполяцией, DOM-UI. Платформенные вещи спрятаны за модулем `platform`.

**Tech Stack:** Vite, TypeScript (strict), Three.js, Vitest.

**Spec:** [docs/RITE_Design_MVP.md](../../RITE_Design_MVP.md) + [отличия](../specs/2026-10-01-vi-mvp-design.md).

## Global Constraints

- Поле 7×7; North = −z, South = +z, East = +x, West = −x.
- Тик 20 мс. Rising 800 мс (40 тиков), Rolling/Sliding/шаг 200 мс (10), Sinking 2400 мс (120).
- Спавн: 3000 мс на уровне 1, −150 мс за уровень, минимум 900 мс; уровень каждые 20 удалённых кубов.
- Старт: 14 кубов, игрок сверху куба в (3,4). Предупреждение от 42 занятых клеток, окно спасения 3000 мс при 49.
- Каноническая ориентация `(top,bottom,north,south,east,west) = (1,6,2,5,3,4)`; только 24 пространственных поворота.
- Камера: ортографическая изометрия, North ↗, East ↘, South ↙, West ↖. Визуал следует за дискретным состоянием.
- `src/rules` не импортирует Three.js, DOM, звук, `platform`.
- Bridge SDK, бэкенд и реклама не подключаются.
- Экспериментальные флаги выключены по умолчанию (кроме `guidedStart`) и не меняют базовую симуляцию в выключенном состоянии.

## Структура файлов

```
index.html
src/main.ts
src/rules/types.ts        типы состояния, конфигурации, событий
src/rules/config.ts       defaultConfig(), msToTicks, ruleKey()
src/rules/orientation.ts  roll(), ALL_ORIENTATIONS
src/rules/rng.ts          nextRandom(state) — mulberry32 в поле состояния
src/rules/board.ts        индексы, соседи, cubeAt, свободные клетки
src/rules/movement.ts     resolveMove(), applyMove(), canAcceptCommand()
src/rules/reactions.ts    resolveReactions(): присоединения, новые группы, Happy One
src/rules/spawn.ts        стартовая расстановка, fallback, обучение, спавн
src/rules/sim.ts          createRun(), step()
src/rules/preview.ts      previewMove() с признаком будущей очистки
src/app/runner.ts         аккумулятор времени, журнал команд, replay
src/app/game.ts           жизненный цикл партии, пауза, связь модулей
src/input/controller.ts   pending/held/повтор (чистая логика)
src/input/gesture.ts      квадранты, dead zone, гистерезис; Pointer Events
src/input/keyboard.ts     стрелки/WASD, Esc
src/input/dpad.ts         четыре кнопки
src/render/scene.ts       сцена, камера, resize
src/render/pips.ts        текстуры граней на canvas
src/render/cubes.ts       меши кубов, анимация rolling/sliding/высоты
src/render/player.ts      фигура игрока
src/render/overlays.ts    призрачные превью и подсветка на поле
src/ui/*.ts, styles.css   HUD, печать, пауза, результат, подсказки, панель плейтеста, i18n
src/platform/storage.ts   get/set с тихим отказом
```

Тесты лежат рядом с модулями: `*.test.ts`.

## Ключевые интерфейсы

```ts
type Dir = 'N' | 'S' | 'E' | 'W';
interface Orientation { top: number; bottom: number; north: number; south: number; east: number; west: number }
type CubeState = 'rising' | 'idle' | 'moving' | 'sinking';
interface Cube { id: number; x: number; z: number; ori: Orientation; state: CubeState; t: number;
  move?: { fromX: number; fromZ: number; dir: Dir; kind: 'roll' | 'slide'; prevOri: Orientation }; reactionId: number }
interface Player { x: number; z: number; level: 'top' | 'ground';
  action?: { kind: MoveKind; fromX: number; fromZ: number; fromLevel: 'top' | 'ground'; dir: Dir; t: number } }
type MoveKind = 'roll' | 'hop' | 'walk' | 'push' | 'mount' | 'descend' | 'climb';
interface Reaction { id: number; value: number; chain: number; total: number }
interface RunState { config: RulesConfig; mode: 'endless' | 'practice'; tick: number; rng: number;
  cubes: Cube[]; grid: number[]; reactions: Reaction[]; player: Player; score: number; level: number;
  removed: number; maxChain: number; spawnTimer: number; fullTicks: number; spawnEnabled: boolean;
  tutorial: null | { phase: 'await' | 'cleared' | 'done'; timer: number }; groundTicks: number;
  over: boolean; stats: RunStats; events: GameEvent[]; nextCubeId: number; nextReactionId: number }

createRun(opts: { seed: number; config: RulesConfig; tutorial?: boolean }): RunState
step(state: RunState, cmd: Dir | null): void            // мутирует state, заполняет state.events
canAcceptCommand(state: RunState): boolean
cubeHeight(cube: Cube, config: RulesConfig, alpha?: number): number   // 0..1
previewMove(state: RunState, dir: Dir): { kind: MoveKind | 'blocked'; top?: number; clears: boolean }
```

Порядок внутри тика: закончить движения → удалить утонувшие → закончить появления → выполнить команду → разрешить реакции → спавн → заполнение и проигрыш.

## Задачи

### Task 1: каркас, ориентации, PRNG
- [x] `npm create`-эквивалент вручную: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, зависимости `three`, `vite`, `typescript`, `vitest`, `@types/three`.
- [x] Тесты `orientation.test.ts`: четыре rolling в одном направлении возвращают ориентацию; противоположные взаимно отменяются; сумма противоположных граней 7 для всех 24; ровно 24 уникальные ориентации; таблица North/South/East/West из раздела 4 спеки; куб обучения `(1,6,5,2,4,3)` входит в набор и после North даёт top=2.
- [x] Тест `rng.test.ts`: одинаковый seed — одинаковая последовательность; значения в [0,1).
- [x] Реализация, прогон, коммит.

### Task 2: поле и стартовые расстановки
- [x] Тесты `spawn.test.ts`: `createRun` даёт 14 кубов, игрок сверху куба в (3,4); у стартового куба есть сосед-куб и пустая соседняя клетка; нет готовых групп (для 200 seed); расстановка воспроизводима по seed; fallback валиден; обучение: A в (3,4) с `(1,6,5,2,4,3)`, B в (2,3) с top=2, (3,3) пуста, спавн выключен, режим `practice`.
- [x] Реализация `types.ts`, `config.ts`, `board.ts`, `spawn.ts` (расстановки), `sim.ts` (`createRun`), коммит.

### Task 3: движение
- [x] Тесты `movement.test.ts` на собранных вручную состояниях: rolling в пустую клетку меняет top по таблице и переносит игрока; переход на соседний idle-куб не вращает кубы; край и rising-сосед блокируют; заблокированный шаг не меняет состояние (сравнение JSON, кроме событий и статистики); с земли: ходьба; push сохраняет все шесть граней и двигает игрока; push блокируется препятствием и краем; ряд кубов не толкается; заход с земли на rising/sinking при высоте ≤0.5 и блок при большей; с sinking: переход на соседний куб при любой высоте, спуск на землю только при ≤0.5, rolling запрещён; `floorClimb` даёт подъём на непроталкиваемый куб и не действует, когда выключен.
- [x] Реализация `movement.ts`, коммит.

### Task 4: жизненный цикл кубов
- [x] Тесты `sim.test.ts`: rising становится idle через 40 тиков; движение завершается через 10; sinking удаляется через 120 и освобождает клетку; игрок на удалённом кубе оказывается на земле в той же клетке; куб, появившийся под игроком на земле, переводит его в `top`; источник движения зарезервирован от спавна; команда во время действия не принимается.
- [x] Реализация фаз тика в `sim.ts`, коммит.

### Task 5: реакции и очки
- [x] Тесты `reactions.test.ts`: две двойки очищаются; две тройки нет; три тройки углом очищаются; диагональ не соединяет; четвёртая тройка присоединяется к тонущим и получает собственные 120 тиков, не перезапуская старые; после полного исчезновения одиночная тройка не цепочка; очки 9, затем +24 = 33; четыре тройки одним событием дают 12; одно событие с несколькими кубами повышает chain на 1; слияние двух реакций одного N: минимальный id, chain = max+1, без повторного учёта; Happy One: все idle-единицы тонут, по 1 очку, кроме куба под игроком сверху; толкнутая с земли единица не защищена; защищённая единица срабатывает после ухода игрока, если контакт остался; повторная проверка не начисляет очки; rising и moving не участвуют.
- [x] Реализация `reactions.ts`, подключение в `step`, коммит.

### Task 6: спавн, уровни, проигрыш, флаги темпа
- [x] Тесты: спавн раз в интервал в свободную клетку; интервал падает на 150 мс за уровень до 900; уровень растёт каждые 20 удалённых; при полном поле спавны не копятся и возобновляются через полный интервал; 49 занятых клеток запускают отсчёт 150 тиков, освобождение сбрасывает, удаление в последнем тике спасает; `gentleStart` не даёт спавнить при ≥42 в первые 9000 тиков; `floorLift` ставит следующий куб под игрока после 200 тиков на земле; `relaxedPace` меняет интервалы; при выключенных флагах состояние совпадает с базовым прогоном.
- [x] Реализация, коммит.

### Task 7: обучение, события, статистика, превью
- [x] Тесты: в обучении один North даёт очистку двух двоек; через 50 тиков после неё появляется 12 кубов и включается спавн; новые кубы не касаются тонущих; события `match`, `chain`, `happyOne`, `blocked`, `landed`, `lifted`, `spawn`, `removed`, `levelUp`, `gameOver` испускаются по одному разу; статистика: тики первых очисток, заблокированные шаги, тики на земле; `previewMove` совпадает с фактическим результатом `step` для всех четырёх направлений на 200 случайных состояниях; `clears` истинно для шага, запускающего группу, присоединение или Happy One.
- [x] Реализация `preview.ts`, доработка `sim.ts`, коммит.

### Task 8: раннер и ввод
- [x] Тесты `runner.test.ts`: один seed и один журнал дают одинаковый JSON состояния при кадрах 16.67 мс, 33.3 мс и неровных; пауза не двигает тики; большой dt обрезается.
- [x] Тесты `controller.test.ts`: быстрый свайп и отпускание — ровно один шаг; удержание — первый повтор через 320 мс, далее раз в 200 мс; отпускание останавливает повтор; новая команда замещает буфер; cancel снимает удержание и буфер.
- [x] Тесты `gesture.test.ts`: порог 18 px; квадранты ↗ N, ↘ E, ↙ S, ↖ W; dead zone 10 px; гистерезис 12° при смене направления.
- [x] Реализация, коммит.

### Task 9: рендер на примитивах
- [x] Сцена: плита-слэб, кубы с программными точками, капсула; камера из направления (1,1,1) на центр поля; кадрирование поля с запасом в портрете и ландшафте; DPR ≤ 1.5.
- [x] Анимация: rolling вокруг нижнего ребра (ось = up × dir), sliding, высота rising/sinking, красный цвет sinking, интерполяция по доле тика.
- [x] Проверка в браузере: ↑/W уводит куб вправо-вверх, →/D вправо-вниз, ↓/S влево-вниз, ←/A влево-вверх. Коммит.

### Task 10: UI, обучение, панель плейтеста
- [x] HUD (SCORE, BEST, пауза, отсчёт заполнения), метка `×N` у реакции, печать ориентации с четырьмя превью, зона жестов и D-pad, пауза, результат (SCORE, BEST, MAX CHAIN, TIME, AGAIN), одноразовые подсказки, панель плейтеста с флагами и копируемой статистикой, автопауза при уходе вкладки, i18n ru/en, рекорды по ключу режима и правил.
- [x] `boardPreview` и `matchHint` в `overlays.ts` и печати. Коммит.

### Task 11: сквозная проверка
- [x] `npm test`, `npm run build` без ошибок.
- [x] В браузере на ширине ПК и телефона: пройти обучение, сделать цепочку, упасть и подняться, проиграть, перезапустить, переключить каждый флаг. Исправить найденное, коммит.
