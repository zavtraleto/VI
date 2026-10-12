# Лаборатория уровней: формат доски, CLI, страница `?lab=levels`, виды решателя, история

> Вид: план. Статус: выполнен (ветка `claude/exciting-volhard-45442b`, не опубликовано). Дата: 2026-10-12.
> Что заменило: —. Что живёт в коде: src/levels/boardFile.ts, src/levels/labText.ts, scripts/level.mjs, src/lab/levelsLab.ts; как устроено и что вышло иначе — [VI_Levels_Lab.md](../../VI_Levels_Lab.md).
> Постановка по слову владельца 12 октября («нужна лаборатория уровней…», [ROADMAP](../../ROADMAP.md), раздел «Лаборатория уровней») и по исследованию [VI_Level_Tool_Research.md](../../VI_Level_Tool_Research.md). Правила генерации (трудность, эмоциональный заряд) — отдельная постановка после этой: здесь только обвязка.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Одно место, где доску уровня рисуют, сразу играют на настоящих правилах, меряют решателем и ботами, сравнивают версии и генерируют от «места», — и то же самое доступно агенту командой `node scripts/level.mjs` над тем же текстовым файлом.

**Architecture:** Источник правды — текстовый файл доски в папке `boards/` (разборщик и печать — одна пара функций в `src/levels/boardFile.ts`). К нему две двери: CLI `scripts/level.mjs` (в стиле `bots.mjs`, тонкий; вся логика в `src/levels/lab*.ts`, покрыта vitest) и дев-страница `?lab=levels` в `src/lab/` (2D-редактор на канвасе, настоящая `Game` для игры по клавише E, решатель в воркерах по трём ярусам). Страница читает и пишет файлы через маленький плагин дев-сервера Vite; история версий лежит в `boards/.history/` вне git. `src/rules` не меняется.

**Tech Stack:** TypeScript, Vite 8 (плагин с middleware и `server.ws`), vitest, Web Worker (как `src/app/comboHint.worker.ts`), lil-gui для панели лаборатории (как `src/lab/boardLab.ts`), three.js только через существующий `Game`/`BoardView`.

**Spec:** [docs/VI_Level_Tool_Research.md](../../VI_Level_Tool_Research.md), разделы «Рекомендуемая форма инструмента» и «Порядок постройки». Слово владельца — [docs/ROADMAP.md](../../ROADMAP.md), «Лаборатория уровней».

## Global Constraints

- Правила уровня заморожены 7 октября 2026: `src/rules/*` не правится ни в одной задаче. Инструмент читает симуляцию через её экспорты.
- Лаборатория — инструмент разработки: всё, что в `src/lab/` и в ветке `?lab=` в `src/main.ts`, существует только при `import.meta.env.DEV`; в сборку GitHub Pages ничего не попадает. Интерфейс игрока (`src/shell`) не трогается, строки в `docs/art/VI_Interface_Layer.md` не нужны.
- Вид страницы — рабочий и временный: цвета и шрифт 2D-редактора берутся из `src/shell/theme.ts` (`shellDefaults()`), ничего декоративного не придумывается; владелец правит вид сам после сборки.
- Ключ пробы: страница и CLI не показывают бриф и форму «места» (`Recipe.brief`, `lesson`) для досок `P23`–`P30`, пока в `docs/VI_Levels_Probe_Key.md` они не отмечены сыгранными; команда `fit` печатает только имена мест и чего не хватает, без `brief`.
- Доски в `boards/` в опубликованный список (`src/levels/levels.ts`, `src/levels/road.ts`) не переносятся автоматически: только командой `source` и руками, по слову владельца.
- Стиль кода и комментариев — как в соседних файлах (английские комментарии-абзацы, `key=value` у скриптов, неизвестный ключ — ошибка).
- Работа в worktree с `model: opus`; основную папку `GAMES\VI` не трогать. Коммит после каждой задачи; пуш в `main` — только после «ок» владельца.
- Проверки после каждой задачи: `npm test`, `npm run typecheck`, `npm run build`, `node scripts/docs-check.mjs`. Дев-сервер — только через preview (`vi-dev`, порт 5183).

## Review Focus

1. Файл доски с двумя стартами (`*` и `f`, или два `*`) — разборщик обязан отказать с внятной строкой, а не взять первый. Тест в задаче 1.
2. Уходящая кость `~k` с `k` больше `sink` или равным 0 — отказ разборщика; `checkLayout` это тоже ловит, но сообщение должно называть клетку. Тест в задаче 1.
3. Имя файла из адреса (`?board=`, `PUT /__boards/<name>`) с `..`, `/` или `\` — плагин и загрузчик отказывают; иначе страница пишет куда угодно на диске. Тесты в задачах 6 и 7.
4. Правка доски во время фонового счёта: результат старого счёта не должен лечь на новую доску. Клиент воркера сверяет `id` запроса. Тест в задаче 9.
5. Доска вне списка в `Game`: окно итога не предлагает «следующий», рестарт перезапускает ту же доску, аналитика не падает на `LEVELS[-1]`. Проверка в задаче 6 (ручная, через preview) и тест на `levelSpec()`.

---

## Ступень 0. Формат доски и CLI

### Task 1: Формат файла доски — разборщик и печать

**Files:**
- Create: `src/levels/boardFile.ts`
- Create: `src/levels/boardFile.test.ts`
- Create: `boards/README.md` (три строки: что это за папка, ссылка на страницу-истину)
- Create: `docs/VI_Levels_Lab.md` (страница-истина лаборатории; в этой задаче — только раздел «Формат доски»)
- Modify: `docs/README.md` (строка для `VI_Levels_Lab.md` в разделе «Уровни»)

**Interfaces:**
- Consumes: `LevelSpec`, `LevelLayout`, `PuzzleDie` из `src/rules/types.ts`; `ALL_ORIENTATIONS` из `src/rules/orientation.ts`; `levelConfig`, `defaultConfig` из `src/rules`; `moveOf`, `moveText` из `src/rules/levelSolver.ts`; `LEVELS`, `SPARES` из `src/levels/levels.ts`; `ROAD` из `src/levels/road.ts`.
- Produces:
  - `parseBoard(text: string, name?: string): LevelSpec` — бросает `Error` с текстом `board <name>: …`.
  - `printBoard(spec: LevelSpec, extra?: { note?: string; status?: BoardStatus }): string`.
  - `readBoardHead(text: string): { note?: string; status?: BoardStatus }` — поля файла, которых нет в `LevelSpec`.
  - `normalSpec(spec: LevelSpec): LevelSpec` — кости по `z`, потом `x`; `leaving` переиндексирован; `values` отсортирован; поля `undefined` убраны. Для сравнения в тестах и для хеша истории.
  - `type BoardStatus = 'idea' | 'work' | 'good' | 'fire' | 'miss'`, `BOARD_STATUSES`.

Грамматика файла (записать в комментарии модуля и на страницу-истину слово в слово):

```
# строки с # — комментарии, пропускаются
id: H01
note: третья кость подъезжает толчком      (свободный текст, не входит в LevelSpec)
status: idea                              (idea | work | good | fire | miss)
faces: 3 5                                (рабочие грани через пробел; обязательно)
sink: 2                                   (sinkMoves; по умолчанию 2)
lift: 1                                   (liftMoves; по умолчанию 1)
floor: open                               (open | shut; по умолчанию open → floor не пишется / false)
climb: on                                 (необязательно)
undos: 3                                  (необязательно)
seed: 0                                   (необязательно; 0 по умолчанию)
chapter: 0                                (необязательно)
lesson: roadHintClimb                     (необязательно; так же story, until, guard: on, guide: on)
par: 6                                    (необязательно)
exact: yes                                (yes | no; только вместе с par)
way: 0,1,N 1,1,E 2,1,S                    (ходы через пробел в нотации moveText)
---
 -   .   .  54*
 .  21   .   .
 .   .  64  21~2
 .   .  24+  -
```

Сетка: число строк = `size`, в каждой строке ровно `size` знаков через пробелы. Знак: `-` — вырезанная клетка; `.` — пустая; `f` — пустая, игрок стоит на полу (`onFloor`); кость — две цифры `TN` (`top`, `north`) и пометки в любом порядке: `*` старт игрока, `+` фиксированная, `~k` — уходящая, ей осталось `k` ходов (1…`sink`). Ровно один старт (`*` или `f`) на доске. Ориентация обязана быть из `ALL_ORIENTATIONS`. Точка здесь — пустая клетка, в отличие от `cutFrom` в `recipes.ts`, где точка — вырез: `cutFrom` не трогать и в формате не использовать.

`LevelSpec` из файла: `goal: { kind: 'clear' }`, `moves: 0`, `arrival: 'none'`, `values = faces`, `norm = dice.length`, `holes` из `-`, `layout.dice` в порядке строк, `layout.start`, `layout.leaving`, `layout.onFloor`, `floor: false` при `shut` (при `open` поле не пишется), `solution` из `way`. После сборки — `levelConfig(defaultConfig(), spec)`: если бросает, ошибка пробрасывается с префиксом `board <name>: `.

- [ ] **Step 1: Тесты разбора и печати** — `src/levels/boardFile.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { LEVELS, SPARES } from './levels';
import { ROAD } from './road';
import { normalSpec, parseBoard, printBoard, readBoardHead } from './boardFile';

const SAMPLE = `id: H01
note: третья кость подъезжает толчком
status: idea
faces: 3
floor: open
par: 2
exact: yes
way: 1,2,E 2,2,N
---
 -   .   .
 .  23   .
 .  65*  -
`;

describe('parseBoard', () => {
  it('reads a board with holes, a start and a way', () => {
    const spec = parseBoard(SAMPLE, 'H01');
    expect(spec.id).toBe('H01');
    expect(spec.size).toBe(3);
    expect(spec.holes).toEqual([{ x: 0, z: 0 }, { x: 2, z: 2 }]);
    expect(spec.layout!.start).toEqual({ x: 1, z: 2 });
    expect(spec.layout!.dice).toEqual([{ x: 1, z: 1, top: 2, north: 3 }, { x: 1, z: 2, top: 6, north: 5 }]);
    expect(spec.faces).toEqual([3]);
    expect(spec.par).toBe(2);
    expect(spec.exact).toBe(true);
    expect(spec.solution).toEqual(['1,2,E', '2,2,N']);
    expect(spec.floor).toBeUndefined();
    expect(readBoardHead(SAMPLE)).toEqual({ note: 'третья кость подъезжает толчком', status: 'idea' });
  });
  it('reads fixed, leaving and a floor start', () => {
    const spec = parseBoard(`id: L\nfaces: 3\nfloor: shut\n---\n 31+ 31+ 12~1\n  .   .  f\n  .   .   .\n`, 'L');
    expect(spec.layout!.onFloor).toBe(true);
    expect(spec.layout!.start).toEqual({ x: 2, z: 1 });
    expect(spec.layout!.dice[0].fixed).toBe(true);
    expect(spec.layout!.leaving).toEqual([{ die: 2, moves: 1 }]);
    expect(spec.floor).toBe(false);
  });
  it.each([
    ['two starts', ' 23* 65*\n  .   .', /one start/],
    ['start and floor start', ' 23*  f\n  .   .', /one start/],
    ['no start', ' 23  65\n  .   .', /one start/],
    ['leaving longer than sink', ' 23* 65~3\n  .   .', /~3/],
    ['leaving zero', ' 23* 65~0\n  .   .', /~0/],
    ['an orientation that is no die', ' 22*  .\n  .   .', /22/],
    ['a short row', ' 23*\n  .   .', /row 1/],
  ])('refuses %s', (_, grid, message) => {
    expect(() => parseBoard(`id: X\nfaces: 2\n---\n${grid}\n`, 'X')).toThrow(message);
  });
  it('refuses an unknown line and exact without par', () => {
    expect(() => parseBoard(`id: X\nfoo: 1\nfaces: 2\n---\n 23* .\n .   .\n`, 'X')).toThrow(/foo/);
    expect(() => parseBoard(`id: X\nexact: yes\nfaces: 2\n---\n 23* .\n .   .\n`, 'X')).toThrow(/exact/);
  });
});

describe('printBoard', () => {
  it.each([...LEVELS, ...SPARES, ...ROAD].map((spec) => [spec.id, spec] as const))('round-trips %s', (_, spec) => {
    const text = printBoard(spec);
    expect(normalSpec(parseBoard(text, spec.id))).toEqual(normalSpec(spec));
  });
  it('keeps note and status', () => {
    const spec = parseBoard(SAMPLE, 'H01');
    expect(readBoardHead(printBoard(spec, readBoardHead(SAMPLE)))).toEqual({ note: 'третья кость подъезжает толчком', status: 'idea' });
  });
});
```

`SPARES` — плоский `readonly LevelSpec[]` (`src/levels/levels.ts:74`).

- [ ] **Step 2: Запустить, убедиться, что падает** — `npx vitest run src/levels/boardFile.test.ts`: FAIL, модуля нет.

- [ ] **Step 3: Написать `src/levels/boardFile.ts`.** Скелет (дописать до прохождения тестов, не меняя сигнатуры):

```ts
import { defaultConfig, levelConfig } from '../rules';
import { moveOf, moveText } from '../rules/levelSolver';
import { ALL_ORIENTATIONS } from '../rules/orientation';
import type { LevelLayout, LevelSpec, PuzzleDie } from '../rules/types';

export type BoardStatus = 'idea' | 'work' | 'good' | 'fire' | 'miss';
export const BOARD_STATUSES: readonly BoardStatus[] = ['idea', 'work', 'good', 'fire', 'miss'];
export interface BoardHead { note?: string; status?: BoardStatus }

const KEYS = ['id', 'note', 'status', 'faces', 'sink', 'lift', 'floor', 'climb', 'undos', 'seed', 'chapter', 'lesson', 'story', 'until', 'guard', 'guide', 'par', 'exact', 'way'] as const;
const DIE = /^([1-6])([1-6])([*+]|~\d+)*$/;

/** Splits a file into its head lines and the rows of its grid; `---` stands between them. */
function partsOf(text: string, name: string): { head: Map<string, string>; rows: string[][] } { /* ... */ }

export function parseBoard(text: string, name = '?'): LevelSpec { /* head → fields; rows → dice/holes/start; levelConfig(defaultConfig(), spec) as the check */ }
export function readBoardHead(text: string): BoardHead { /* note/status only */ }
export function printBoard(spec: LevelSpec, extra: BoardHead = {}): string { /* head lines in the order of KEYS, then ---, then rows: cells 3 wide, dice `TN` + marks, joined by a space, trimmed on the right */ }
export function normalSpec(spec: LevelSpec): LevelSpec { /* sort dice by z then x, remap leaving, sort values, drop undefined */ }
```

Ошибки — одним стилем: `board ${name}: row ${z + 1} has ${n} cells, the board is ${size} wide`, `board ${name}: one start is needed, found 2`, `board ${name}: cell ${x},${z}: "65~3" leaves in more moves than sink (2)`, `board ${name}: cell ${x},${z}: "22" is no way a die lies`, `board ${name}: cannot read the line "foo: 1"`.

- [ ] **Step 4: Прогнать тесты** — `npx vitest run src/levels/boardFile.test.ts`: PASS, включая обход всех 30 + резерва + 16 кусков.

- [ ] **Step 5: Страница-истина и индекс.** Создать `docs/VI_Levels_Lab.md` с шапкой `> Вид: истина. Статус: в силе. Дата: 2026-10-12.` / `> Что заменило: —. Что живёт в коде: src/levels/boardFile.ts.` и разделом «1. Формат доски» — грамматика выше, пример, список ошибок. Добавить строку в `docs/README.md`, раздел «Уровни (основной режим)»: `| VI_Levels_Lab.md (ссылка на файл) | истина | лаборатория уровней: формат файла доски, команды scripts/level.mjs, страница ?lab=levels, история версий |`. Создать `boards/README.md`. `node scripts/docs-check.mjs` — без расхождений.

- [ ] **Step 6: Коммит** — `git add src/levels/boardFile.ts src/levels/boardFile.test.ts boards/README.md docs/VI_Levels_Lab.md docs/README.md` и `git commit -m "Формат файла доски: разборщик и печать, обход всех досок списка и дороги"`.

### Task 2: CLI `scripts/level.mjs` — `show` и `check`

**Files:**
- Create: `scripts/level.mjs`
- Create: `src/levels/labText.ts` (чистые функции текста отчётов; CLI только печатает)
- Create: `src/levels/labText.test.ts`
- Modify: `docs/VI_Levels_Lab.md` (раздел «2. Команды»)

**Interfaces:**
- Consumes: `parseBoard`, `printBoard` (задача 1); `boardText` из `src/levels/generate.ts`; `solveLevel`, `tryWay`, `moveText` из `src/rules/levelSolver.ts`; `scoreOf` из `src/rules/levelScore.ts`; `scoreText` из `src/rules/levelReport.ts`; `LEVELS`, `SPARES`, `ROAD`.
- Produces:
  - `loadBoard(file: string): { spec: LevelSpec; head: BoardHead; from: 'file' | 'list' | 'road' }` в `labText.ts`: `file=` — путь к файлу **или** код `P06`/`R03` из списка и дороги (так агент смотрит и опубликованные доски той же командой). Чтение файла — в `scripts/level.mjs` (Node), в `labText.ts` — `boardFrom(code)` по спискам.
  - `checkOf(spec, opts: { maxStates?: number }): Check` где `Check = { par: number | null; exact: boolean; states: number; way: string[] | null; score: Score | null; kept: 'same' | 'shorter' | 'longer' | 'missing' | 'broken' | null }` — `kept` сравнивает найденное с записанным `way`/`par` (`broken` — записанный путь не проходит `tryWay`).
  - `checkText(check: Check): string`, `checkJson(check): object` с постоянными ключами.
- Соглашения CLI (записать в шапку скрипта как в `bots.mjs`): `node scripts/level.mjs <command> file=<path|code> [json] [states=N]`; неизвестная команда или ключ — ошибка с перечнем; прогресс и предупреждения — в `stderr`; код выхода `1`, если проверка не прошла (`check`: `kept` ≠ `same` при записанном `par`, или решения нет), `2` — ошибка чтения.

- [ ] **Step 1: Тесты** — `src/levels/labText.test.ts`: `boardFrom('P06')` даёт `LEVELS` с id P06, `boardFrom('R03')` — из `ROAD`, `boardFrom('Z9')` бросает; `checkOf(ROAD[2])` (`R03`, par 2) → `par 2`, `exact true`, `kept 'same'`; та же доска без `solution`/`par` → `kept null`; доска с записанным `par` на 1 больше найденного → `kept 'shorter'`; `checkText` содержит `moves 2`, партитуру (`scoreText`) и строку `kept: same`.
- [ ] **Step 2: Убедиться, что падают.**
- [ ] **Step 3: Реализация** `labText.ts` и `scripts/level.mjs` (по образцу `bots.mjs`: `runnerImport`, `named`/`flag`, `known`). `show`: печатает заголовок (`id`, `size`, `faces`, `floor`, `par`), `boardText(spec)` и, если `file=` — файл, то все ошибки `parseBoard` как есть; код выхода 2 при ошибке. `check`: `checkText`/JSON.
- [ ] **Step 4: Прогнать** `npx vitest run src/levels/labText.test.ts` → PASS; вручную: `node scripts/level.mjs show file=P06`, `node scripts/level.mjs check file=R03`, `node scripts/level.mjs check file=R03 json`.
- [ ] **Step 5: Документ** — раздел «2. Команды» в `docs/VI_Levels_Lab.md`: таблица команд (пока две строки), соглашения, коды выхода.
- [ ] **Step 6: Коммит** — `scripts/level.mjs`, `src/levels/labText.ts`, тест, документ.

### Task 3: `regress` — перерешить всё опубликованное

**Files:**
- Modify: `scripts/level.mjs` (команда `regress`, `workers=` как в `ladder.mjs` `shareOut`)
- Modify: `src/levels/labText.ts` (`regressOne(spec, maxStates): Regress`, `regressText(rows)`)
- Modify: `src/levels/labText.test.ts`
- Modify: `docs/VI_Levels_Lab.md`

**Interfaces:**
- Produces: `type Regress = { id: string; from: 'list' | 'spare' | 'road' | 'board'; stored: number | null; found: number | null; exact: boolean; states: number; verdict: 'ok' | 'shorter' | 'longer' | 'unsolved' | 'broken' | 'capped' }`.
- `regress` проходит `LEVELS`, `SPARES`, `ROAD` и все `boards/*.txt` (кроме `boards/out/`), делит работу между процессами, печатает таблицу и итог `regress: N boards, M not ok`; код выхода 1, если `M > 0`. `capped` — решатель не досмотрел (`exhausted false`) и путь не найден: не провал, но печатается.

- [ ] **Step 1: Тест** `regressOne(ROAD[2], 100_000)` → `verdict 'ok'`; `regressOne({ ...ROAD[2], par: 3 }, 100_000)` → `'shorter'`; `regressOne({ ...ROAD[2], solution: ['0,0,N'] }, 100_000)` → `'broken'`.
- [ ] **Step 2: Падает. Step 3: Реализация. Step 4: PASS;** `node scripts/level.mjs regress` на всей базе — записать время прогона в документ.
- [ ] **Step 5: Документ** — строка `regress` в таблице и фраза «закрывает дыру: `levels.test.ts` проверяет записанный путь, а не минимум».
- [ ] **Step 6: Коммит.**

### Task 4: `moves` и `near` — что делает каждый ход и каждая правка в одну кость

**Files:**
- Modify: `scripts/level.mjs`, `src/levels/labText.ts`, `src/levels/labText.test.ts`, `docs/VI_Levels_Lab.md`

**Interfaces:**
- Consumes: `movesAt`, `solveFrom`, `playMove`/`tellMove` (проверить экспорт в `src/rules/levelSolver.ts:467-545`), `levelDeadEnd` из `src/rules/level.ts`, `createRun`, `editsOf` из `src/levels/edits.ts`, `solveLevel`.
- Produces:
  - `movesOf(spec, opts: { after?: string[]; maxStates?: number }): MoveFact[]`, `MoveFact = { move: string; keeps: 'par' | 'longer' | 'dead' | 'unknown'; par: number | null; deadEnd: LevelDeadEnd | null }` — для каждого хода из положения после `after` (ходы в нотации `moveText`): решить от положения после хода (`solveFrom`, потолок по умолчанию 200 000), сравнить с минимумом от текущего положения.
  - `nearOf(spec, opts: { maxStates?: number }): NearFact[]`, `NearFact = { what: string; par: number | null; exact: boolean; change: 'same' | 'shorter' | 'longer' | 'unsolved' }` — на каждую правку `editsOf` только `solveLevel` с потолком (по умолчанию 200 000), без `report()`. Цель — секунды, не минуты: замерить на `P06` и записать время в документ.
  - `movesText`, `nearText`.

- [ ] **Step 1: Тесты** на `R03`: `movesOf` даёт ровно ходы `movesAt` от старта, среди них `1,2,E` с `keeps 'par'`; после `after: ['1,2,E']` ход `2,2,N` — `'par'`, `par 1`. `nearOf(ROAD[2])` непустой, у каждой правки `what` непустой, есть хотя бы одна `'unsolved'` или `'longer'`.
- [ ] **Step 2–4: падает → реализация → PASS;** `node scripts/level.mjs moves file=P06`, `node scripts/level.mjs moves file=P06 after=3,0,W`, `node scripts/level.mjs near file=P06` — время в документ.
- [ ] **Step 5: Документ. Step 6: Коммит.**

### Task 5: `fit`, `diff`, `svg`, `source`

**Files:**
- Modify: `scripts/level.mjs`, `src/levels/labText.ts`, `src/levels/labText.test.ts`, `docs/VI_Levels_Lab.md`
- Create: `src/levels/boardSvg.ts`, `src/levels/boardSvg.test.ts`
- Modify: `src/levels/select.ts` (`levelSource`: добавить `fixed`, `leaving`, `onFloor`, `climb`, `undos`), `src/levels/select.test.ts` при необходимости

**Interfaces:**
- `fitOf(spec, places: readonly Recipe[], opts): FitFact[]`, `FitFact = { place: string; misses: string[] }` — `judge(recipe, seed, { near: true, …})` требует зерна и раскладки от рецепта; здесь нужна проверка **готовой** доски. Сделать так: временный рецепт `{ ...recipe, sketch: [spec.layout], holes: spec.holes, size: spec.size }` и `judge(recipeWithSketch, SKETCH + 1, { near: true })` (`SKETCH` из `generate.ts`), взять `verdict.fit?.misses ?? [verdict.why]`. Места — `PLACES` из `recipes.ts` и `ROAD_PLACES` из `roadRecipes.ts`; для `P23`–`P30` печатать только имя и `misses` (не `brief`).
- `diffOf(a: LevelSpec, b: LevelSpec): { cells: { x: number; z: number; was: string; now: string }[]; same: boolean }` — `same` по `sameBoard` из `variety.ts`; клетки — по знакам печати.
- `boardSvg(spec, opts?: { cell?: number }): string` — строковый SVG без канваса: клетки, вырезы, цифра верхней грани крупно, северная мелко, старт кружком, фиксированная рамкой, уходящая полупрозрачной; шрифт и цвета — из `shellDefaults()` (`src/shell/theme.ts`). Команда `svg file= out=<path>` пишет файл и печатает путь (для `SendUserFile` агентом).
- `source file=` печатает строку `levelSource(spec)` для вставки в `levels.ts`/`road.ts`; `levelSource` расширяется, тест `select.test.ts` на старые доски не должен измениться (новые поля пишутся только когда есть).

- [ ] **Step 1: Тесты:** `fitOf(ROAD[2], ROAD_PLACES)` содержит место `R03` с `misses` пустым (или с известными допусками из `road.test.ts:523-560` `MISSES` — сверить и зафиксировать в тесте); `diffOf(P06, P06)` → `same true`, `cells []`; `diffOf(P06, P06 с костью, повёрнутой на другую грань)` → одна клетка; `boardSvg(ROAD[0])` содержит `<svg`, `fixed`-рамку и ровно 2 цифры верхних граней; `levelSource(ROAD[1])` содержит `fixed: true`, `onFloor: true`, `leaving:`.
- [ ] **Step 2–4.** **Step 5: Документ.** **Step 6: Коммит.**

## Ступень 1. Сыграть любую доску в настоящей игре

### Task 6: `Game.playBoard(spec)` и `?board=<name>`

**Files:**
- Modify: `src/app/game.ts` (строки по `origin/main` `ef12060`: `levelId` 767, `step` 799, `startRun` 888–889, `startLevel` 1203, `startPiece` 1221, `runLevel` 1231, `boardAfter` 1335, `next` 1499–1500, `1544`, `lessonsAt` 1578, `levelsPanel` 1626, `hasNext`/`onNext` 1711/1724, `commits` 2544, `2628`, `2809`)
- Create: `src/app/boardProbe.ts` (чистое: `boardNameOf(search: string): string | null` — имя из `?board=`, только `[A-Za-z0-9_-]{1,64}`, иначе `null`)
- Create: `src/app/boardProbe.test.ts`
- Modify: `docs/VI_Levels_Lab.md` (раздел «3. Сыграть доску: `?board=`»)

**Interfaces:**
- Produces: `Game.playBoard(spec: LevelSpec): void` — публичный; `private labSpec: LevelSpec | null`; `private levelSpec(): LevelSpec` = `piece !== null ? ROAD[piece] : labSpec ?? LEVELS[levelIndex]`. Все перечисленные обращения `LEVELS[this.levelIndex]` переводятся на `levelSpec()`; там, где нужен индекс (`step_index`, `number`, `hasNext`, `onNext`, `boardAfter`, `lessonsAt`, `commits`, `levelsPanel`), при `labSpec !== null` — `step_index` опускается, номер `null`, `hasNext false`, `onNext` не даётся, переход после доски не строится (`boardAfter` не вызывается: итог показывается, как для последнего уровня без «следующего»), `lessonsAt` → `[]`, `commits` по `levelIndex` не считаются (`[]`).
- `startRun('level')` при `labSpec` → `runLevel(labSpec)`: так работает рестарт.
- В `src/main.ts` (только `DEV`, в ветке без `lab`): если `boardNameOf(location.search)` не `null` — `fetch('/boards/' + name + '.txt')`, `parseBoard`, `game.playBoard(spec)`; ошибка — в консоль и `alert` не показывать (просто `console.error`). Vite отдаёт файлы корня проекта как статику в dev.

- [ ] **Step 1: Тест** `boardProbe.test.ts`: `boardNameOf('?board=H01')` → `'H01'`; `'?board=../x'` → `null`; `'?board=a/b'` → `null`; `''` → `null`.
- [ ] **Step 2: Падает. Step 3: Реализация** в `game.ts` — сначала ввести `levelSpec()` и заменить все обращения (это чистый рефакторинг, `npm test` и `typecheck` зелёные), потом `labSpec`/`playBoard`, потом `main.ts`.
- [ ] **Step 4: Проверка в preview** (`vi-dev`): положить `boards/H01.txt` (скопировать `node scripts/level.mjs show file=P06` через `printBoard` → в задаче 2 добавить команду `export file=P06 out=boards/P06.txt`, если её ещё нет — добавить здесь: печатает `printBoard` в файл), открыть `http://localhost:5183/?board=P06`: доска на поле, ходы идут, отмена `Z`, рестарт `R` даёт ту же доску, окно итога без «следующий», консоль без ошибок (`read_console_messages`). Сделать скриншот для отчёта.
- [ ] **Step 5: Документ. Step 6: Коммит.**

## Ступень 2. Страница `?lab=levels`

### Task 7: Плагин дев-сервера: чтение, запись, список и слежение за `boards/`

**Files:**
- Create: `src/lab/boardsServer.ts` (функции без Vite-типов, чтобы тестировать: `safeName(name): string | null`, `historyPath(root, id, hash, now): string`, `listBoards(root): string[]`)
- Create: `src/lab/boardsServer.test.ts`
- Modify: `vite.config.ts` (плагин `viBoards()` с `apply: 'serve'`: `configureServer(server)` → middleware на `/__boards`; `server.watcher.add('boards')`, на `change`/`add` → `server.ws.send({ type: 'custom', event: 'vi:boards', data: { name } })`)
- Modify: `.gitignore` (`boards/.history/`, `boards/out/`)
- Modify: `docs/VI_Levels_Lab.md` (раздел «4. Страница»: адреса плагина)

**Interfaces:**
- `GET /__boards` → JSON `string[]` имён без расширения, отсортированных; `GET /__boards/<name>` → текст файла (404, если нет); `PUT /__boards/<name>` с телом-текстом → пишет `boards/<name>.txt` и копию в `boards/.history/<name>/<ISO-время без двоеточий>-<hash>.txt` (hash — FNV-1a от `printBoard(normalSpec(parseBoard(text)))`, 8 hex-знаков; если текст не разбирается — пишется только основной файл, история не ведётся, ответ 200 с телом `{"error": "..."}`); `GET /__boards/<name>/history` → JSON `{ file: string; time: string; hash: string }[]`; `POST /__boards/<name>/plays` → добавляет строку JSON в `boards/.history/<name>/plays.jsonl`. Имя проверяется `safeName` (`[A-Za-z0-9_-]{1,64}`), иначе 400.
- Плагин — только `serve` (dev); в `build` не участвует.

- [ ] **Step 1: Тесты** `safeName('H01')` → `'H01'`, `safeName('../x')` → `null`, `safeName('a b')` → `null`; `historyPath('r', 'H01', 'abcd1234', new Date('2026-10-12T17:08:27Z'))` → `r/boards/.history/H01/20261012T170827Z-abcd1234.txt`.
- [ ] **Step 2–4:** падает → реализация → PASS; вручную через `curl` на запущенный `vi-dev`: `PUT`, `GET`, список, история.
- [ ] **Step 5: Документ. Step 6: Коммит.**

### Task 8: Страница: редактор доски, список файлов, автосохранение, игра по E

**Files:**
- Create: `src/lab/levelsLab.ts` (`startLevelsLab()`), `src/lab/boardEditor.ts` (класс `BoardEditor`: 2D канвас, модель `EditBoard`, жесты, отмена), `src/lab/editBoard.ts` (чистая модель: `EditBoard` ↔ `LevelSpec`, операции), `src/lab/editBoard.test.ts`, `src/lab/boardsClient.ts` (fetch к плагину + `import.meta.hot.on('vi:boards')`)
- Modify: `src/main.ts` (ветка `lab === 'levels'`: `new Game(app)` как в `juice`, `window.vi = game`, `startLevelsLab(game)`)
- Modify: `docs/VI_Levels_Lab.md`

**Interfaces:**
- `EditBoard = { size: number; cells: Cell[][] }`, `Cell = { kind: 'hole' } | { kind: 'empty'; floorStart?: boolean } | { kind: 'die'; top: number; north: number; start?: boolean; fixed?: boolean; leaving?: number }`; `editBoardOf(spec): EditBoard`, `specOf(board: EditBoard, head: Head): LevelSpec` (через `printBoard`/`parseBoard`, чтобы была одна проверка), операции: `putDie(board, x, z)` (пустая → кость `1` сверху с первой ориентацией; кость → следующая верхняя грань 1…6 с первой ориентацией этой грани), `rollDie(board, x, z, dir)` (ориентация через `roll` из `src/rules/orientation.ts`, кость остаётся на месте), `clear(board, x, z)`, `toggleHole`, `toggleFixed`, `setStart(x, z)` (на кости — `*`, на пустой — `f`), `cycleLeaving` (0 → 1 → … → sink → 0), `resize(board, size)` (3…8, по правилу `packMove` `x,z < 8`).
- Жесты (из исследования, «Экран и жесты владельца»): левый щелчок по пустой — кость, по кости — следующая верхняя грань; стрелки — прокатить выделенную кость на месте; правый щелчок — очистить; `H` — вырез; `Shift+щелчок` — фиксированная; `P` — старт; `L` — уходящая; `Ctrl+Z`/`Ctrl+Y` — отмена/повтор (один жест — один шаг); `E` — играть/вернуться; `R` в игре — рестарт (у `Game` уже есть).
- Панель (lil-gui, как `BoardPanel`): выбор файла из `GET /__boards`, кнопка «новая» (имя `H` + номер), поле `id`, `faces` (строка), `floor`, `sink`/`lift`, `note`, `status` (список), кнопка «копировать текст» (`copyText` из `src/lab/clipboard.ts`), кнопка «снимок» (задача 10). Автосохранение: любое изменение → через 300 мс `PUT`. Слежение: событие `vi:boards` с тем же именем → перечитать файл, если нет несохранённых правок.
- Игра: `game.playBoard(spec)` по `E`; редактор скрыт (`display:none` контейнера), игра видна; `E` снова — игра в меню не уходит, просто контейнер редактора поверх (игра продолжает жить, её можно вернуть). Рисование доски в редакторе: клетки сеткой, вырезы серым, верхняя грань крупной цифрой, северная — мелкой в углу, старт — кружок, фиксированная — двойная рамка, уходящая — число ходов в другом углу и полупрозрачность. Цвета и шрифт — из `shellDefaults()`.

- [ ] **Step 1: Тесты модели** (`editBoard.test.ts`): `editBoardOf(ROAD[1])` → клетка `(3,5)` `empty` с `floorStart`, `(1,0)` — кость `fixed`, `(3,4)` — `leaving 1`; `specOf(editBoardOf(spec), head)` ≡ `normalSpec(spec)` для всех `ROAD`; `putDie` дважды на пустой → верхняя грань 2; `rollDie` меняет `north`/`top` как `roll`; `setStart` на пустой ставит `f` и снимает прежний `*`.
- [ ] **Step 2–3:** падает → модель; затем `boardEditor.ts`, `boardsClient.ts`, `levelsLab.ts`, ветка в `main.ts`.
- [ ] **Step 4: Проверка в preview** `?lab=levels`: открыть `P06` (созданный в задаче 6), поставить кость, увидеть `PUT` в `read_network_requests`, нажать `E` — игра на той же доске, сыграть ход, `E` — обратно, `Ctrl+Z` — отмена последней правки; изменить файл снаружи (`node scripts/level.mjs export …` или правка в редакторе кода) — страница перечитала. Скриншот.
- [ ] **Step 5: Документ** — раздел «4. Страница»: клавиши, панель, автосохранение. **Step 6: Коммит.**

### Task 9: Три яруса цифр: мгновенный, секундный, фоновый — в воркерах с отменой

**Files:**
- Create: `src/lab/solve.worker.ts`, `src/lab/solveClient.ts`, `src/lab/solveClient.test.ts` (протокол и сверка `id` тестируются на фальшивом `Worker`), `src/lab/labFacts.ts` (чистые функции: что считается на каждом ярусе; тест `labFacts.test.ts`)
- Modify: `src/lab/levelsLab.ts` (панель цифр под/рядом с доской; лента партитуры с шагом по ходам)
- Modify: `docs/VI_Levels_Lab.md`

**Interfaces:**
- `labFacts.ts`: `instantOf(spec): Instant` = `{ error: string | null; deadEnd: LevelDeadEnd | null; dice: number; groups: ShortGroup[] }` (в главном потоке: `parseBoard`-проверка, `createRun`, `levelDeadEnd`, `shortGroups`); `secondsOf(spec, maxStates = 3_000_000): Seconds` = `{ check: Check (задача 2); firsts: number; moves: MoveFact[] (задача 4) }`; `laterOf(spec, runs = 10): Later` = `{ report: LevelReport; near: NearFact[] }`.
- Протокол: `Ask = { id: number; tier: 'seconds' | 'later'; spec: LevelSpec }`, `Told = { id: number; tier; facts: Seconds | Later } | { id; tier; error: string }`. `SolveClient`: `ask(tier, spec): Promise<facts>`; новый `ask` того же яруса → `cancel()` старого (`worker.terminate()`, новый `Worker` при следующем запросе) и ответ со старым `id` отбрасывается. Два экземпляра: один на `seconds`, один на `later`.
- Панель: `instant` сразу; `seconds` — «считаю…» и результат; `later` — «фон…» и результат; при правке — всё сбрасывается. Лента партитуры: `scoreText`-строки, клик по ходу — редактор показывает доску после этого хода (`tryWay` → состояние → `editBoardOf` по `state.cubes`: нужна `specFromState` — вынести в `src/levels/snapshot.ts` уже здесь: `specFromState(state: RunState, base: LevelSpec): LevelSpec` — кости из `state.cubes` (`idle` → обычная, `sinking` → `leaving` с остатком ходов из `t` и `config.sinkingTicks`, `fixed` — как есть), игрок из `state.player`; тест в `snapshot.test.ts`: `specFromState(createRun({... level: ROAD[1]}), ROAD[1])` ≡ `normalSpec(ROAD[1])`).

- [ ] **Step 1: Тесты** `solveClient.test.ts` (фальшивый Worker: `postMessage` → очередь; ответ с чужим `id` не резолвит промис; `cancel` → промис отклонён с `'cancelled'`); `labFacts.test.ts` на `R03` (`instantOf` без ошибки и тупика; `secondsOf` → `check.par 2`, `firsts ≥ 1`); `snapshot.test.ts`.
- [ ] **Step 2–4:** падает → реализация → PASS; preview: правка кости → цифры обновились, быстрые сразу, секундные через ~секунду, фоновые позже; быстрая серия правок не даёт устаревших чисел (сверить `id` в консоли).
- [ ] **Step 5: Документ** — раздел «5. Цифры: три яруса» с потолками состояний. **Step 6: Коммит.**

### Task 10: Снимок, флажок статуса, партии владельца

**Files:**
- Modify: `src/lab/levelsLab.ts`, `src/lab/boardsClient.ts`, `src/levels/snapshot.ts` (есть с задачи 9)
- Create: `src/lab/playLog.ts` (чистое: `playRecordOf(state, startedAt, now, undos): PlayRecord`; тест)
- Modify: `docs/VI_Levels_Lab.md`

**Interfaces:**
- «Снимок»: в режиме игры кнопка/клавиша `S` → `specFromState(game.state, spec)` → новый файл `boards/<id>-<n>.txt` и открыть его в редакторе (уходящие кости переносятся через `~k`).
- `PlayRecord = { id: string; hash: string; at: string; result: 'passed' | 'failed' | 'left'; moves: number; par: number | null; undos: number; deadEnd: LevelDeadEnd | null; seconds: number }`. Лаборатория наблюдает за `game` в своём `requestAnimationFrame`-цикле (как `juiceLab` оборачивает `frame`): начало партии при `playBoard`/рестарте, конец — `state.over` или уход в редактор; на конец — `POST /__boards/<name>/plays`. `undos` — через обёртку `undoLevel` (приватный метод, доступ как в `juiceLab` через `Inside`).
- Статус в панели пишется в голову файла (`status:`); список файлов показывает статус рядом с именем.

- [ ] **Step 1: Тест** `playRecordOf`: пройденная партия → `passed`, `moves` из `levelRun.moves`; с `endReason 'failed'` → `failed` и `deadEnd`.
- [ ] **Step 2–4:** падает → реализация → PASS; preview: сыграть доску до конца, в `boards/.history/<id>/plays.jsonl` появилась строка; снимок посреди партии дал новый файл с `~k`.
- [ ] **Step 5: Документ. Step 6: Коммит.**

## Ступень 3. Виды решателя поверх доски

### Task 11: Стрелки ходов, чувствительность к правке, лишние кости, слепой режим

**Files:**
- Modify: `src/lab/boardEditor.ts` (слой наложений: `setOverlay(overlay: Overlay | null)`), `src/lab/levelsLab.ts`, `src/lab/labFacts.ts` (в `laterOf` добавить `spare: { x: number; z: number }[]`)
- Modify: `src/lab/labFacts.test.ts`, `docs/VI_Levels_Lab.md`

**Interfaces:**
- `Overlay = { arrows: { x: number; z: number; dir: Dir; keeps: MoveFact['keeps'] }[]; sensitive: { x: number; z: number; change: NearFact['change'] }[]; spare: { x: number; z: number }[] }`. Стрелки — из `secondsOf().moves` (ход `x,z,D` → стрелка от клетки кости в сторону `D`, цвет по `keeps`). Чувствительность — из `laterOf().near`: клетка кости, у которой есть правка с `change ≠ 'same'`, подсвечивается (сильнее — `'unsolved'`). Лишние кости: `spareOf(spec, maxStates)` — убрать кость (не стартовую, не фиксированную), `solveLevel`: если `par` тот же и маршрут (`scoreOf(...).route`) тот же — кость лишняя (обрезка, как в исследовании «Схемы уровней»).
- Переключатели в панели: «стрелки», «чувствительность», «лишние», «слепой режим» (прячет все цифры и наложения до конца партии; включён по умолчанию для файлов со `status: idea`, пришедших от генерации, см. задачу 13).

- [ ] **Step 1: Тест** `spareOf(ROAD[2])` → `[]` (две кости, обе нужны); доска `R03` с третьей костью в стороне, не влияющей на путь → содержит её клетку.
- [ ] **Step 2–4:** падает → реализация → PASS; preview: стрелки видны на `P06`, после правки обновляются; слепой режим прячет всё. Скриншот.
- [ ] **Step 5: Документ. Step 6: Коммит.**

## Ступень 4. История и сравнение

### Task 12: Версии доски и сравнение A/B на странице

**Files:**
- Modify: `src/lab/levelsLab.ts`, `src/lab/boardsClient.ts` (`history(name)`, `read(name, file)`), `src/lab/boardEditor.ts` (режим «две доски рядом», подсветка изменённых клеток из `diffOf`)
- Modify: `docs/VI_Levels_Lab.md`

**Interfaces:**
- Панель «версии»: список из `GET /__boards/<name>/history` (время, hash, статус из головы файла, число партий из `plays.jsonl` по `hash`); «открыть» — загрузить версию в редактор как текущую (и сохранить = новая версия); «сравнить с текущей» — вторая доска рядом, изменённые клетки обведены, под ними таблица: `par`, `exact`, `firsts`, персоны `hasty/casual/careful/planner` (из `laterOf` обеих; считаются через тот же `SolveClient`), партии владельца по каждой версии: сколько, доля пройденных, медиана ходов над `par`.
- CLI уже умеет `diff a= b=` (задача 5) — документ сводит оба пути.

- [ ] **Step 1:** тестов на UI нет; тест на чистую сводку `versionSummary(records: PlayRecord[]): { plays: number; passed: number; overMedian: number | null }` в `src/lab/playLog.test.ts`.
- [ ] **Step 2–4:** реализация; preview: две версии `P06` (сохранить, поправить, сохранить) → сравнение показывает одну клетку и разные `par`.
- [ ] **Step 5: Документ. Step 6: Коммит.**

## Ступень 5. Генерация: обвязка (правила — следующая постановка)

### Task 13: `gen` в CLI и «от места» / «от этой доски» на странице

**Files:**
- Modify: `scripts/level.mjs` (`gen place=<R05|P06> [seeds=N] [from=N] [mode=random|solution|route|both] [keep=N] out=boards/out/`), `src/levels/labText.ts` (`genOf(recipe, seeds, opts): Fit[]` поверх `candidate`/`judge`/`gather` из `select.ts` — то же, что `ladder.mjs place=`, но результат пишется файлами `boards/out/<place>-<seed>.txt` со `status: idea` и `note: место <place>, зерно <seed>`)
- Modify: `src/lab/levelsLab.ts` (панель «генерация»: выбор места из `PLACES`/`ROAD_PLACES` по имени; «от места» → `laterOf`-воркер гоняет `genOf` на 200 зёрен, галерея миниатюр (`boardSvg` в `<img src=data:>`), клик — открыть как новый файл; «от этой доски» → `nearOf` текущей как галерея, те же миниатюры, сортировка по `par` и `exact`)
- Modify: `docs/VI_Levels_Lab.md` (раздел «7. Генерация: что есть и что решается позже»)

**Interfaces:**
- `genOf` возвращает `Fit[]` в порядке `gather`; число кандидатов и время идут в `stderr`. `mode` → диапазон зёрен как в `ladder.mjs:178-179`.
- На странице генерация идёт в воркере `later` отдельным `tier: 'gen'` (расширить `Ask`/`Told`), с отменой.
- Явно в документе: рецепт места (`Recipe`) остаётся единственным «набором правил»; понятия трудности и эмоционального заряда для генерации — отдельная постановка с владельцем; эта задача не вводит новых полей в `Recipe`.

- [ ] **Step 1: Тест** `genOf(ROAD_PLACES.find(p => p.id === 'R03'), { from: 1, to: 50 })` возвращает хотя бы один `Fit` с `spec.id` места (может быть пустым при малом диапазоне — тогда взять диапазон из `ROAD_SEEDS`: зерно `10393` для `R03` должно подойти).
- [ ] **Step 2–4:** падает → реализация → PASS; `node scripts/level.mjs gen place=R03 seeds=200 out=boards/out/` пишет файлы; на странице галерея из них открывается.
- [ ] **Step 5: Документ. Step 6: Коммит.**

## Завершение

### Task 14: ROADMAP, индекс, статус плана, отчёт владельцу

**Files:**
- Modify: `docs/ROADMAP.md` (раздел «Лаборатория уровней»: состояние «собрано в ветке …, не опубликовано», что есть, что решается отдельно: правила генерации; строка в «Инструменты» раздела «Сделано» после публикации)
- Modify: `docs/README.md` (строка этого плана: статус «выполнен в ветке …»)
- Modify: этот файл (шапка: `Статус: выполнен`, `Что живёт в коде: …`)
- Modify: `docs/VI_Levels_Lab.md` (раздел «Что вышло иначе», если что-то отклонилось от плана)

- [ ] **Step 1:** прогнать все четыре проверки; `node scripts/level.mjs regress` зелёный; preview-прогон по разделам документа.
- [ ] **Step 2:** документы, коммит.
- [ ] **Step 3:** отчёт владельцу: что собрано, адрес страницы, пять команд для первого знакомства, что ждёт его слова (вид страницы; знаки формата; перенос досок в список). Пуш — только после «ок».

---

## Самопроверка плана

- Покрытие спеки: формат (1), CLI show/check/regress/moves/near/fit/diff/svg/source (2–5), загрузчик `?board=` (6), плагин и страница (7–8), три яруса и партитура (9), снимок/статус/партии (10), виды Стёртеванта и слепой режим (11), история и A/B (12), генерация-обвязка (13), документы (1, каждая задача, 14). Атлас малых полей (ступень 6 исследования) намеренно не в плане: после правил генерации.
- Имена сквозные: `parseBoard`/`printBoard`/`normalSpec`/`BoardHead` (1) используются в 2, 6, 7, 8, 9; `Check`/`checkOf` (2) в 9; `MoveFact`/`NearFact` (4) в 9, 11; `specFromState` (9) в 10; `boardSvg` (5) в 13; `PlayRecord` (10) в 12.
- Review Focus: 1–2 → тесты задачи 1; 3 → тесты задач 6 и 7; 4 → тест задачи 9; 5 → задача 6.
