# VI — ряд уровней из `row.json`: план постройки

> Вид: план. Статус: не выполнен. Дата: 2026-10-15.
> Что заменит: —. Что живёт в коде: см. спеку, шапка.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ряд кампании читается из `boards/row.json` и файлов досок; вставка доски — строка в `row.json` и `node scripts/row.mjs`.

**Architecture:** чистая `buildRow` (`src/levels/row.ts`) собирает из `row.json` и текстов файлов список мест; `scripts/row.mjs` и дев-сервер пишут результат в `src/levels/row.gen.ts`, который читают игра, тесты и скрипты. В игре одно место в ряду вместо «куска дороги» и «уровня списка»; помощь игроку — из `help` места.

**Tech Stack:** TypeScript, Vite 6 (`import.meta.glob`, `?raw`, `runnerImport`), vitest.

**Spec:** [docs/superpowers/specs/2026-10-15-vi-row-json-design.md](../specs/2026-10-15-vi-row-json-design.md) — читать целиком перед задачей 1.

## Global Constraints

- Работа — в worktree от `origin/main` (не в основной папке `GAMES\VI`); пуш — только после «ок» владельца: `git fetch`, rebase на `origin/main`, проверки, `git push origin HEAD:main`.
- После каждой задачи: `npm test`, `npm run typecheck`, `npm run build` зелёные; коммит — заголовок до 70 знаков по-русски, тело до пяти строк, последней строкой `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `src/rules` не меняется.
- Игрок видит ровно то же, что в `50ace21`, кроме двух мест спеки 5.5 (отчёт «поделиться», фон `backdrop`).
- Помощь на старте — таблица спеки 3.3 дословно: плашки `all` на местах 1–2, `near` на 3–10; ожидание на восьми местах пролога; подсказки на `R07`, `R11`, `C1-05`, `R13`, `R10`; знак `N` на `R01`; `hold` на 1–6, `cells` на 7–8.
- `src/levels/boardFiles.ts` (все файлы `boards/` через glob) не импортируется кодом игры: только тестами и лабораторией (`src/lab/*`, грузится динамически под `import.meta.env.DEV`).
- Тест не называет длину настоящего ряда, номер места в нём или порядок его кодов.
- Комментарии в коде — по-английски, в манере файла; документы — по-русски.

## Review Focus

1. Сохранение седьмой редакции с `road: 'R00'` и пройденными главами открывается на том же месте, что сейчас (первое непройденное место за прологом) — тест в задаче 4.
2. Игрок на прологе с `road: 'R05'` после загрузки стоит на `R05`, а не на месте 1 — тест в задаче 4.
3. Переход с последнего места пролога на первое место главы 1 (`R08` → `R11`) ведёт без окна, как сейчас, — проверка в preview, задача 8.
4. Плашки на месте 11 (`C1-05`) нет, на месте 10 (`P02`) есть — тест `plaquesOf` в задаче 4 на выдуманном ряде и проверка в preview.
5. Ошибка в `row.json` (опечатка в коде доски, ключе `help`) не роняет игру молча: `node scripts/row.mjs` отказывает строкой с номером места, старый `row.gen.ts` остаётся — тест в задаче 1.

---

## Карта файлов

| Файл | Что в нём |
|---|---|
| `src/levels/row.ts` (новый) | типы `RowFile`, `Help`, `Place`, `Row`; списки допустимых значений; `buildRow`; `rowChapters` для библиотеки; `rowText` — текст `row.gen.ts` |
| `boards/row.json` (новый) | ряд, спека 3.3 |
| `src/levels/row.gen.ts` (новый, собранный) | `export const ROW: Row` |
| `scripts/row.mjs` (новый) | сборка, `check`, `report` |
| `src/levels/boardFiles.ts` (новый) | `BOARD_TEXTS`, `fileBoard(code)` — только тесты и лаборатория |
| `src/levels/row.test.ts` (новый) | `buildRow` на выдуманных рядах, свежесть, свойства мест |
| `vite.boards.ts` | пересборка `row.gen.ts` на запись |
| `src/levels/campaign.ts` | `CAMPAIGN` из `ROW`; `campaignFocus` по `at` |
| `src/app/passage.ts` | `startPlace`, `placeAfterIndex` |
| `src/app/signWay.ts` | `IDLE_RULES`, `roadWait(help, hurry)` |
| `src/app/hint.ts` | `DEAD_ENDS_FOR_SIGN` здесь; `probeHint` → `HintKey` из `row.ts` |
| `src/platform/settings.ts` | `at`, `rowEdition`, `toRowEdition` |
| `src/app/game.ts` | `place` вместо `piece`/`levelIndex` |
| `src/levels/library.ts`, `scripts/library.mjs`, `src/lab/libraryLab.ts` | ряд из `ROW` |
| `src/levels/grammar.ts`, `src/levels/table.ts`, `src/levels/campaignRecipes.ts` | типы из `row.ts` |
| `src/levels/labText.ts`, `src/lab/leavingScenes.ts` | доски из `ROW` и файлов |
| `src/levels/measures.ts` | `nearOf`, `lostOf` из `road.test.ts` |
| удаляются | `src/levels/road.ts`, `src/levels/levels.ts`, `src/levels/chapters.ts`, `src/levels/road.test.ts`, `src/levels/levels.test.ts` (после переноса нужного) |

---

### Task 1: `buildRow` и типы ряда

**Files:**
- Create: `src/levels/row.ts`
- Test: `src/levels/row.test.ts`

**Interfaces:**
- Consumes: `parseBoard(text, name)` и `readBoardHead(text)` из `src/levels/boardFile.ts` (`parseBoard` бросает `board <имя>: …` и уже прогоняет `levelConfig`).
- Produces:
  ```ts
  export const ROLES = ['meet', 'learn', 'apply', 'event', 'twist', 'peak', 'rest'] as const;
  export type Role = (typeof ROLES)[number];
  export const TECHNIQUES = ['link', 'walk', 'glass', 'lift', 'push', 'ones', 'twoFaces', 'seven', 'time'] as const;
  export type Technique = (typeof TECHNIQUES)[number];
  export const HINT_KEYS = ['roadHintChain', 'roadHintWalk', 'roadHintPush', 'roadHintClimb', 'hintSeven', 'hintLinkMove'] as const;
  export type HintKey = (typeof HINT_KEYS)[number];
  export const PLAQUES = ['all', 'near'] as const;
  export const WAITS = ['first', 'lesson', 'free'] as const;
  export const CAMERAS = ['cells', 'hold'] as const;
  export const SIGNS = ['N', 'E', 'S', 'W'] as const;
  export interface Help { hint?: HintKey; sign?: (typeof SIGNS)[number]; plaques?: (typeof PLAQUES)[number]; wait?: (typeof WAITS)[number]; camera?: (typeof CAMERAS)[number] }
  export interface RowPlaceFile { board: string; role: Role; teaches?: Technique; archetype: string; event?: string; note?: string; help?: Help }
  export interface RowChapterFile { title: string; faces?: number[]; floor?: 'open'; places: RowPlaceFile[] }
  export interface RowFile { chapters: RowChapterFile[] }
  export interface Place { number: number; chapter: number; code: string; spec: LevelSpec; role: Role; teaches?: Technique; archetype: string; event?: string; help: Help }
  export interface RowChapter { id: number; title: string; faces: readonly number[] | null; first: number; last: number }
  export interface Row { chapters: RowChapter[]; places: Place[] }
  export function buildRow(file: RowFile, boards: ReadonlyMap<string, string>): Row;
  export function rowText(row: Row): string;
  export function readRowFile(text: string): RowFile;
  ```
  `RowChapter.first`/`last` — индексы в `places` (от 0, включительно). Место `number` — от 1.

- [ ] **Step 1: Write the failing test** — `src/levels/row.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildRow, readRowFile, rowText, type RowFile } from './row';

/** The board of B01_s290 under other codes: two 2s a cell apart, cleared by the way round in three moves. */
const lay = (code: string, more: string[] = []): string =>
  [`id: ${code}`, 'status: R', 'faces: 2', ...more, 'par: 3', 'exact: yes', 'way: 0,1,N 0,0,E 1,0,S', '---', ' .   .   .', '24*  .  21', ' .   .   .'].join('\n');
const A = lay('A');
const B = lay('B', ['floor: shut']);
const boards = new Map([['A', A], ['B', B]]);
const file = (more: Partial<RowFile['chapters'][number]> = {}): RowFile => ({
  chapters: [
    { title: 'first', places: [{ board: 'A', role: 'meet', archetype: 'one', help: { plaques: 'all', wait: 'first', sign: 'N', camera: 'hold' } }] },
    { title: 'second', faces: [2, 3], floor: 'open', places: [{ board: 'B', role: 'apply', archetype: 'two' }], ...more },
  ],
});

describe('buildRow', () => {
  it('numbers the places through the row and keeps what the file says of each', () => {
    const row = buildRow(file(), boards);
    expect(row.places.map((place) => [place.number, place.chapter, place.code])).toEqual([[1, 0, 'A'], [2, 1, 'B']]);
    expect(row.places[0].help).toEqual({ plaques: 'all', wait: 'first', sign: 'N', camera: 'hold' });
    expect(row.places[1].help).toEqual({});
    expect(row.chapters).toEqual([
      { id: 0, title: 'first', faces: null, first: 0, last: 0 },
      { id: 1, title: 'second', faces: [2, 3], first: 1, last: 1 },
    ]);
  });

  it('plays a board of a chapter with faces on them, and with its floor open where the chapter says so', () => {
    const row = buildRow(file(), boards);
    expect(row.places[0].spec.faces).toEqual([2]);
    expect(row.places[1].spec).toMatchObject({ faces: [2, 3], values: [2, 3] });
    expect(row.places[1].spec.floor).toBeUndefined();
    expect(buildRow(file({ floor: undefined }), boards).places[1].spec.floor).toBe(false);
  });

  it('refuses a row it cannot play, in one line that names the place', () => {
    const bad = (change: (row: RowFile) => void): string => {
      const row = file();
      change(row);
      try {
        buildRow(row, boards);
      } catch (error) {
        return (error as Error).message;
      }
      return 'built';
    };
    expect(bad((row) => (row.chapters[0].places[0].board = 'Z'))).toBe('row: Z is in the row, and there is no file boards/Z.txt');
    expect(bad((row) => row.chapters[1].places.push({ board: 'A', role: 'rest', archetype: 'again' }))).toBe('row: A is in the row twice (places 1 and 3)');
    expect(buildRowRefusal(new Map([['A', A.replace('status: R', 'status: D')], ['B', B]]))).toBe('row: A: the file says status D; a board of the row is R');
    expect(bad((row) => (row.chapters[0].places[0].help = { plaques: 'some' as never }))).toBe('row: place 1 (A): "plaques: some" is none of all, near');
    expect(bad((row) => (row.chapters[0].places[0].role = 'lead' as never))).toBe('row: place 1 (A): "role: lead" is none of meet, learn, apply, event, twist, peak, rest');
    expect(bad((row) => ((row.chapters[0].places[0].help as Record<string, unknown>).hlep = 1))).toBe('row: place 1 (A): unknown key "hlep"');
    expect(bad((row) => ((row.chapters[0].places[0] as unknown as Record<string, unknown>).boad = 'A'))).toBe('row: place 1 (A): unknown key "boad"');
  });

  it('reads row.json and prints the module the game reads, the same every time', () => {
    const row = buildRow(readRowFile(JSON.stringify(file())), boards);
    const text = rowText(row);
    expect(text.startsWith('// Generated by node scripts/row.mjs from boards/row.json and boards/*.txt. Do not edit.\n')).toBe(true);
    expect(text).toContain("import type { Row } from './row';");
    expect(text).toContain('export const ROW: Row = {');
    expect(rowText(buildRow(readRowFile(JSON.stringify(file())), boards))).toBe(text);
    expect(() => readRowFile('{ "chapters": 1 }')).toThrow('row: "chapters" is a list of chapters');
  });
});

function buildRowRefusal(files: ReadonlyMap<string, string>): string {
  try {
    buildRow(file(), files);
  } catch (error) {
    return (error as Error).message;
  }
  return 'built';
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/levels/row.test.ts`
Expected: FAIL — `Failed to resolve import "./row"`.

- [ ] **Step 3: Write `src/levels/row.ts`**

```ts
import type { LevelSpec } from '../rules/types';
import { parseBoard, readBoardHead } from './boardFile';

/**
 * The row of the campaign as files have it (docs/superpowers/specs/2026-10-15-vi-row-json-design.md):
 * `boards/row.json` says the chapters, the places in their order, what each place is and how the
 * game helps the player on it; a board is its file `boards/<code>.txt` and nothing else. `buildRow`
 * lays the row from them; `scripts/row.mjs` and the dev server write what it lays into `row.gen.ts`,
 * which the game reads. Nothing here reads a disk.
 */

// (the const lists and types of the Interfaces block above, verbatim)

const PLACE_KEYS = ['board', 'role', 'teaches', 'archetype', 'event', 'note', 'help'] as const;
const HELP_KEYS = ['hint', 'sign', 'plaques', 'wait', 'camera'] as const;
const CHAPTER_KEYS = ['title', 'faces', 'floor', 'places'] as const;

/** Reads the text of row.json: JSON, with a list of chapters. What each holds is asked by `buildRow`. */
export function readRowFile(text: string): RowFile {
  const file = JSON.parse(text) as Partial<RowFile>;
  if (!Array.isArray(file.chapters)) throw new Error('row: "chapters" is a list of chapters');
  return file as RowFile;
}

export function buildRow(file: RowFile, boards: ReadonlyMap<string, string>): Row {
  const chapters: RowChapter[] = [];
  const places: Place[] = [];
  const seen = new Map<string, number>();
  file.chapters.forEach((chapter, id) => {
    unknownKeys(chapter, CHAPTER_KEYS, `row: chapter ${id + 1} (${chapter.title})`);
    const first = places.length;
    for (const said of chapter.places) {
      const number = places.length + 1;
      const where = `row: place ${number} (${said.board})`;
      unknownKeys(said, PLACE_KEYS, where);
      unknownKeys(said.help ?? {}, HELP_KEYS, where);
      oneOf(where, 'role', said.role, ROLES);
      if (said.teaches !== undefined) oneOf(where, 'teaches', said.teaches, TECHNIQUES);
      const help = said.help ?? {};
      if (help.hint !== undefined) oneOf(where, 'hint', help.hint, HINT_KEYS);
      if (help.sign !== undefined) oneOf(where, 'sign', help.sign, SIGNS);
      if (help.plaques !== undefined) oneOf(where, 'plaques', help.plaques, PLAQUES);
      if (help.wait !== undefined) oneOf(where, 'wait', help.wait, WAITS);
      if (help.camera !== undefined) oneOf(where, 'camera', help.camera, CAMERAS);
      const before = seen.get(said.board);
      if (before !== undefined) throw new Error(`row: ${said.board} is in the row twice (places ${before} and ${number})`);
      seen.set(said.board, number);
      const text = boards.get(said.board);
      if (text === undefined) throw new Error(`row: ${said.board} is in the row, and there is no file boards/${said.board}.txt`);
      const status = readBoardHead(text).status;
      if (status !== 'R') throw new Error(`row: ${said.board}: the file says status ${status ?? '—'}; a board of the row is R`);
      let spec = parseBoard(text, said.board);
      if (chapter.faces) spec = { ...spec, faces: [...chapter.faces], values: [...chapter.faces] };
      if (chapter.floor === 'open') {
        const { floor: _floor, ...open } = spec;
        spec = open;
      }
      places.push({
        number,
        chapter: id,
        code: said.board,
        spec,
        role: said.role,
        ...(said.teaches !== undefined ? { teaches: said.teaches } : {}),
        archetype: said.archetype,
        ...(said.event !== undefined ? { event: said.event } : {}),
        help: { ...help },
      });
    }
    chapters.push({ id, title: chapter.title, faces: chapter.faces ? [...chapter.faces] : null, first, last: places.length - 1 });
  });
  return { chapters, places };
}

/** The text of `row.gen.ts` for a row: one literal, keys as they were laid, two spaces. */
export function rowText(row: Row): string {
  return [
    '// Generated by node scripts/row.mjs from boards/row.json and boards/*.txt. Do not edit.',
    "import type { Row } from './row';",
    '',
    `export const ROW: Row = ${JSON.stringify(row, null, 2)};`,
    '',
  ].join('\n');
}

function oneOf(where: string, key: string, value: unknown, of: readonly string[]): void {
  if (!of.includes(value as string)) throw new Error(`${where}: "${key}: ${String(value)}" is none of ${of.join(', ')}`);
}

function unknownKeys(object: object, known: readonly string[], where: string): void {
  for (const key of Object.keys(object)) if (!known.includes(key)) throw new Error(`${where}: unknown key "${key}"`);
}
```

Файл без строки `floor` — открытый пол (поля `floor` нет), `floor: shut` — `floor: false` (`normalSpec`: «`spec.floor !== false` — открыт»). Поэтому тест ждёт `false` у `B`, когда глава пол не открывает.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/levels/row.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/levels/row.ts src/levels/row.test.ts
git commit -m "Ряд: buildRow собирает места из row.json и файлов досок"
```

---

### Task 2: `row.json`, собранный ряд, команда и проверка свежести

**Files:**
- Create: `boards/row.json` (спека 3.3 дословно), `scripts/row.mjs`, `src/levels/row.gen.ts` (пишет скрипт), `src/levels/boardFiles.ts`
- Modify: `src/levels/row.test.ts`, файлы `boards/*.txt` ряда, если переходный тест найдёт расхождение
- Test: `src/levels/row.test.ts`, `src/levels/rowBridge.test.ts` (переходный, удаляется в задаче 6)

**Interfaces:**
- Consumes: `buildRow`, `readRowFile`, `rowText` (задача 1); `CAMPAIGN`, `HINTS` (`campaign.ts`), `ROAD_IDLE`, `ROAD_SIGNS`, `ROAD_BLOCKS`, `ROAD` (`road.ts`) — только в переходном тесте.
- Produces: `ROW: Row` из `src/levels/row.gen.ts`; `BOARD_TEXTS: ReadonlyMap<string, string>` и `fileBoard(code: string): LevelSpec` из `src/levels/boardFiles.ts`; команда `node scripts/row.mjs [check | report [place=N]]` (`report` — задача 7).

- [ ] **Step 1: `src/levels/boardFiles.ts`**

```ts
import type { LevelSpec } from '../rules/types';
import { parseBoard } from './boardFile';

/**
 * Every file of `boards/` by its code, read when the module is built: for the tests and the labs
 * only. The game reads the boards of its row from `row.gen.ts`, and must not import this, or every
 * draft of the library goes into the build.
 */
const TEXTS = import.meta.glob<string>('../../boards/*.txt', { query: '?raw', import: 'default', eager: true });

export const BOARD_TEXTS: ReadonlyMap<string, string> = new Map(
  Object.entries(TEXTS).map(([path, text]) => [path.slice(path.lastIndexOf('/') + 1, -'.txt'.length), text]),
);

/** The board of a file by its code, as the file has it. */
export function fileBoard(code: string): LevelSpec {
  const text = BOARD_TEXTS.get(code);
  if (text === undefined) throw new Error(`no file boards/${code}.txt`);
  return parseBoard(text, code);
}
```

- [ ] **Step 2: `boards/row.json`** — скопировать JSON из спеки, раздел 3.3, без изменений.

- [ ] **Step 3: `scripts/row.mjs`**

Загрузчик — как в `scripts/library.mjs` (функция `load` через `runnerImport` из `vite`, `configFile: false`; скопировать её строки 1–27 и разбор аргументов 28–39 с `COMMANDS = { build: [], check: [], report: ['place'] }`, где команда без имени — `build`).

```js
const { buildRow, readRowFile, rowText } = await load('/src/levels/row.ts');
const boardsDir = resolve(root, 'boards');
const genFile = resolve(root, 'src/levels/row.gen.ts');

/** The texts of the files of boards/ by code, as buildRow takes them. */
function boardTexts() {
  return new Map(readdirSync(boardsDir).filter((file) => file.endsWith('.txt')).map((file) => [basename(file, '.txt'), readFileSync(resolve(boardsDir, file), 'utf8')]));
}

/** The row laid from the files, or the line of its refusal. */
function laid() {
  try {
    return { row: buildRow(readRowFile(readFileSync(resolve(boardsDir, 'row.json'), 'utf8')), boardTexts()) };
  } catch (error) {
    return { refused: error.message };
  }
}

const { row, refused } = laid();
if (refused) {
  console.error(refused);
  process.exit(1);
}
const text = rowText(row);
if (command === 'check') {
  const kept = existsSync(genFile) ? readFileSync(genFile, 'utf8') : '';
  if (kept !== text) {
    console.error('row.gen.ts is stale: run node scripts/row.mjs');
    process.exit(1);
  }
  console.log(`row: ${row.places.length} places, ${row.chapters.length} chapters, row.gen.ts is fresh`);
} else if (command === 'report') {
  (await import('./rowReport.mjs')).report(row, named.place, load);
} else {
  writeFileSync(genFile, text);
  console.log(`row: ${row.places.length} places, ${row.chapters.length} chapters`);
}
```

Строку `report` вписать в задаче 7; до неё ветка `report` отказывает: `console.error('report: comes with the report of the places'); process.exit(2);`.

Добавить в `package.json` в `scripts`: `"row": "node scripts/row.mjs"`.

- [ ] **Step 4: собрать**

Run: `node scripts/row.mjs`
Expected: `row: 25 places, 4 chapters`; появился `src/levels/row.gen.ts`.

Если отказ `the file says status …` или `there is no file` — значит файл доски ряда в `boards/` не тот; сверить с `node scripts/library.mjs check` (должно быть `0 faults`).

- [ ] **Step 5: тест свежести и свойств** — дописать в `src/levels/row.test.ts`:

```ts
import rowJson from '../../boards/row.json?raw';
import { solveLevel, tryWay, moveOf } from '../rules/levelSolver';
import { defaultConfig } from '../rules/config';
import { createRun } from '../rules/sim';
import { hasReadyGroup } from '../rules/spawn';
import { I18N } from '../ui/i18n';
import { BOARD_TEXTS } from './boardFiles';
import { ROW } from './row.gen';

describe('the row of the game', () => {
  it('is what row.json and the files of the boards lay: run node scripts/row.mjs where it is not', () => {
    expect(rowText(buildRow(readRowFile(rowJson), BOARD_TEXTS))).toBe(rowText(ROW));
  });

  it('clears every place by the way its file keeps, in as many moves as it says, and the solver finds none shorter', { timeout: 120_000 }, () => {
    for (const { code, spec } of ROW.places) {
      expect(spec.solution, code).toBeDefined();
      const { state } = tryWay(spec, spec.solution!.map(moveOf));
      expect(state.endReason, code).toBe('passed');
      expect(state.levelRun!.moves, code).toBe(spec.par);
      const solved = solveLevel(spec);
      expect(solved.exhausted, code).toBe(true);
      expect(solved.solution!.par, code).toBe(spec.par);
    }
  });

  it('starts no place with a combo ready to go', () => {
    for (const { code, spec } of ROW.places) {
      const state = createRun({ seed: spec.seed, config: defaultConfig(), level: spec });
      const tops = new Array<number>(spec.size * spec.size).fill(0);
      for (const cube of state.cubes) if (cube.state === 'idle' && (spec.faces ?? []).includes(cube.ori.top)) tops[cube.z * spec.size + cube.x] = cube.ori.top;
      expect(hasReadyGroup(tops, spec.size), code).toBe(false);
    }
  });

  it('names hints that have words', () => {
    for (const { code, help } of ROW.places) if (help.hint) expect(I18N.ru[help.hint], code).toBeTruthy();
  });
});
```

Имя словаря (`I18N.ru`) сверить с `src/ui/i18n.ts` (как его читает `src/shell/text.test.ts`); если словарь экспортирован иначе — взять тот экспорт.

- [ ] **Step 6: переходный тест** — `src/levels/rowBridge.test.ts` (удаляется в задаче 6):

```ts
import { describe, expect, it } from 'vitest';
import { CAMPAIGN, HINTS } from './campaign';
import { normalSpec } from './boardFile';
import { ROAD, ROAD_BLOCKS, ROAD_IDLE, ROAD_LESSONS, ROAD_SIGNS } from './road';
import { ROW } from './row.gen';

/** While the old row and the new one stand side by side: they are one row, board by board and help by help. */
describe('the row of row.json against the row of the code', () => {
  it('has the same boards in the same places, played the same', () => {
    expect(ROW.places.map((place) => place.code)).toEqual(CAMPAIGN.map((stop) => stop.spec.id));
    ROW.places.forEach((place, i) => {
      const old = CAMPAIGN[i].spec;
      const played = (spec: typeof old) => ({ ...normalSpec(spec), id: spec.id, seed: undefined, chapter: undefined, undos: undefined, faces: spec.faces, values: [...spec.values].sort() });
      expect(played(place.spec), place.code).toEqual(played(old));
      expect([place.role, place.teaches, place.archetype, place.event], place.code).toEqual([CAMPAIGN[i].role, CAMPAIGN[i].teaches, CAMPAIGN[i].archetype, CAMPAIGN[i].event]);
    });
  });

  it('helps the player where the code helped', () => {
    const block = ROAD_BLOCKS.find((one) => one.oneScale)!;
    ROW.places.forEach((place, i) => {
      const piece = i < ROAD.length ? i : null;
      const wait = piece === null ? undefined : piece === 0 ? 'first' : ROAD_LESSONS.includes(place.code) ? 'lesson' : 'free';
      const camera = piece === null ? undefined : piece >= block.from && piece <= block.to ? 'hold' : 'cells';
      const plaques = piece !== null && piece < 2 ? 'all' : place.number <= 10 ? 'near' : undefined;
      const want = { hint: HINTS[place.code]?.key, sign: ROAD_SIGNS[place.code], plaques, wait, camera };
      expect(place.help, place.code).toEqual(Object.fromEntries(Object.entries(want).filter(([, value]) => value !== undefined)));
      if (piece !== null) expect(ROAD_IDLE[place.code], place.code).toBeDefined();
    });
  });
});
```

Run: `npx vitest run src/levels/row.test.ts src/levels/rowBridge.test.ts`
Expected: PASS. Если первый тест моста падает на поле, которое играется (`floor`, `par`, `solution`, `sinkMoves`, `liftMoves`, `exact`, `climb`, кости), — играется код: поправить файл `boards/<код>.txt` под доску кода (через `printBoard` или руками), `node scripts/row.mjs`, снова тест. Каждое такое расхождение записать для раздела «Что вышло иначе» (задача 8).

- [ ] **Step 7: Commit**

```bash
git add boards/row.json scripts/row.mjs src/levels/row.gen.ts src/levels/boardFiles.ts src/levels/row.test.ts src/levels/rowBridge.test.ts package.json boards/*.txt
git commit -m "Ряд в boards/row.json, собранный row.gen.ts и проверка свежести"
```

---

### Task 3: дев-сервер пересобирает ряд

**Files:**
- Modify: `vite.boards.ts`
- Create: `src/levels/rowFiles.ts` нельзя (в `src` нет типов Node) — код с диском живёт в `vite.boards.ts`, как сейчас.

**Interfaces:**
- Consumes: `buildRow`, `readRowFile`, `rowText` — `vite.boards.ts` импортирует `./src/levels/row` так же, как уже импортирует `./src/lab/boardsServer`.
- Produces: на `add`/`change`/`unlink` файла `boards/row.json` или `boards/<код>.txt` (код в ряду, или `row.json` его называет) — переписан `src/levels/row.gen.ts`, если текст другой; отказ — `server.config.logger.error('row: …')` и `server.ws.send({ type: 'error', err: { message, stack: '' } })`, файл не трогается.

- [ ] **Step 1:** в `configureServer` после `server.watcher.add(dir)`:

```ts
      const genFile = resolve(server.config.root, 'src/levels/row.gen.ts');
      // The row the game reads is laid again when row.json or a board of it is written, by the lab or by anyone.
      const relay = (path: string): void => {
        const full = resolve(path);
        const name = basename(full);
        if (dirname(full) !== dir || !(name === 'row.json' || name.endsWith('.txt'))) return;
        try {
          const texts = new Map(readdirSync(dir).filter((file) => file.endsWith('.txt')).map((file) => [basename(file, '.txt'), readFileSync(join(dir, file), 'utf8')]));
          const file = readRowFile(readFileSync(join(dir, 'row.json'), 'utf8'));
          if (name !== 'row.json' && !file.chapters.some((chapter) => chapter.places.some((place) => `${place.board}.txt` === name))) return;
          const text = rowText(buildRow(file, texts));
          if (!existsSync(genFile) || readFileSync(genFile, 'utf8') !== text) writeFileSync(genFile, text);
        } catch (error) {
          const message = (error as Error).message;
          server.config.logger.error(message);
          server.ws.send({ type: 'error', err: { message, stack: '' } });
        }
      };
      server.watcher.on('add', relay);
      server.watcher.on('change', relay);
      server.watcher.on('unlink', relay);
```

Импорт `dirname` добавить к `node:path`; импорт `{ buildRow, readRowFile, rowText } from './src/levels/row'`.

- [ ] **Step 2: проверить руками** (preview `vi-dev` поднят из worktree по памяти `vi-preview-of-a-worktree`, или `npx vite --port 5190` в фоне): поменять в `boards/row.json` `"archetype": "roll"` → `"roll "` и обратно — `row.gen.ts` меняется и возвращается; вписать `"board": "R0x"` — в логе сервера `row: R0x is in the row, and there is no file boards/R0x.txt`, `row.gen.ts` прежний; вернуть.

- [ ] **Step 3:** `npm run typecheck` — `vite.boards.ts` вне `tsc`, но `src/levels/row.ts` в нём; `npm run build` — сборка не зовёт плагин (`apply: 'serve'`).

- [ ] **Step 4: Commit**

```bash
git add vite.boards.ts
git commit -m "Дев-сервер пересобирает row.gen.ts при записи ряда и его досок"
```

---

### Task 4: модули ряда без «дороги» и «списка»: кампания, переходы, ожидание, сохранение

**Files:**
- Modify: `src/levels/campaign.ts`, `src/app/passage.ts`, `src/app/signWay.ts`, `src/app/hint.ts`, `src/platform/settings.ts`
- Create: `src/levels/rowFixture.ts` (выдуманный ряд для тестов)
- Test: `src/levels/campaign.test.ts`, `src/app/passage.test.ts`, `src/app/signWay.test.ts`, `src/app/hint.test.ts`, `src/platform/settings.test.ts`, `src/levels/row.test.ts`

Эта задача и задача 5 (игра) коммитятся вместе: `game.ts` зовёт то, что здесь меняется. Шаги ниже — по модулю; тесты прогоняются по модулю, `typecheck` — после задачи 5.

**Interfaces:**
- Consumes: `ROW`, `Place`, `Help`, `HintKey`, `buildRow` (задачи 1–2).
- Produces:
  ```ts
  // src/levels/campaign.ts
  export type Stop = Place;                         // CAMPAIGN[i] — место
  export const CAMPAIGN: readonly Place[];          // = ROW.places
  export interface CampaignKept { passed; stats; at?: string }
  export function campaignCells(kept: CampaignKept, row?: readonly Place[]): CampaignCell[];
  export function campaignFocus(kept: CampaignKept, row?: readonly Place[]): number;   // индекс места, на котором игрок стоит (startPlace)
  export function campaignDone(kept: Pick<CampaignKept, 'passed'>, row?: readonly Place[]): number;
  export function placeOfCode(code: string, row?: readonly Place[]): number;            // -1, если кода нет
  export function plaquesOf(help: Help): 'all' | 'near' | null;
  // src/app/passage.ts
  export function startPlace(at: string | undefined, passed: Readonly<Record<string, boolean | undefined>>, row: readonly Place[]): number;
  export function placeAfterIndex(place: number, count: number): number | null;        // place + 1 или null после последнего
  export function atAfter(at: string | undefined, passedPlace: number, row: readonly Place[], passed: Readonly<Record<string, boolean | undefined>>): string | undefined;
  // src/app/signWay.ts
  export const IDLE_RULES: Readonly<Record<'first' | 'lesson' | 'free', IdleRule>>;
  export function roadWait(help: Help, hurry?: boolean): RoadWait | null;
  // src/app/hint.ts
  export const DEAD_ENDS_FOR_SIGN = 2;
  // src/platform/settings.ts
  export const ROW_EDITION = 1;
  export function toRowEdition<T extends RowKept>(kept: T, row?: readonly Place[]): T;
  // LevelProgress: { passed; stats; told; at?: string; rowEdition?: number }  — без road и roadEdition
  ```
  Параметр `row` по умолчанию — `ROW.places`; тесты передают выдуманный.

- [ ] **Step 1: `src/levels/rowFixture.ts`**

```ts
import { buildRow, type Row } from './row';

/** A row of five places in two chapters, made up for the tests of what reads a row: none of them names the row of the game. Every board is that of B01_s290. */
const board = (code: string): string =>
  [`id: ${code}`, 'status: R', 'faces: 2', 'par: 3', 'exact: yes', 'way: 0,1,N 0,0,E 1,0,S', '---', ' .   .   .', '24*  .  21', ' .   .   .'].join('
');

export const FIXTURE: Row = buildRow(
  {
    chapters: [
      { title: 'first', places: [
        { board: 'F1', role: 'meet', archetype: 'a', help: { sign: 'N', plaques: 'all', wait: 'first', camera: 'hold' } },
        { board: 'F2', role: 'learn', archetype: 'b', help: { plaques: 'near', wait: 'lesson', camera: 'hold' } },
        { board: 'F3', role: 'apply', archetype: 'c', help: { hint: 'roadHintChain', plaques: 'near', wait: 'free', camera: 'cells' } },
      ] },
      { title: 'second', faces: [2, 3], floor: 'open', places: [
        { board: 'G1', role: 'meet', archetype: 'd', help: { hint: 'roadHintWalk' } },
        { board: 'G2', role: 'rest', archetype: 'e' },
      ] },
    ],
  },
  new Map(['F1', 'F2', 'F3', 'G1', 'G2'].map((code) => [code, board(code)])),
);
```

(Доска — `B01_s290` под другими кодами, как в задаче 1: она проходится за три хода по правилам.)

- [ ] **Step 2: `campaign.ts`** — переписать целиком:

```ts
import { goalOf } from '../rules/level';
import type { GoalLine } from '../rules/types';
import { starsHeld } from './progress';
import type { Help, Place } from './row';
import { ROW } from './row.gen';

/**
 * The campaign: every board the player is led through, in one row with one number each
 * (docs/superpowers/specs/2026-10-15-vi-row-json-design.md). The row is `boards/row.json` laid into
 * `row.gen.ts`; what the player has passed is kept by the codes of the boards, and where they stand
 * by the code of the place (`at`).
 */
export type Stop = Place;
export const CAMPAIGN: readonly Place[] = ROW.places;

export interface CampaignKept {
  passed: Readonly<Record<string, boolean | undefined>>;
  stats: Readonly<Record<string, { bestMoves?: number | null } | undefined>>;
  at?: string;
}

export interface CampaignCell { number: number; passed: boolean; stars: 0 | 1 | 2 | 3; goal: GoalLine[]; faces?: readonly number[] }

export function campaignCells(kept: CampaignKept, row: readonly Place[] = CAMPAIGN): CampaignCell[] {
  return row.map(({ spec, number }) => {
    const passed = kept.passed[spec.id] === true;
    const stars = passed ? starsHeld(kept.stats[spec.id]?.bestMoves ?? null, spec.par) || 1 : 0;
    return { number, passed, stars, goal: goalOf(spec), faces: spec.faces };
  });
}

/** The index of the place with this code; -1 for a code that is not in the row. */
export function placeOfCode(code: string, row: readonly Place[] = CAMPAIGN): number {
  return row.findIndex((place) => place.code === code);
}

/** The place the list opens on: the one the player stands on (`startPlace` of passage.ts). */
export function campaignFocus(kept: CampaignKept, row: readonly Place[] = CAMPAIGN): number {
  const at = kept.at === undefined ? -1 : placeOfCode(kept.at, row);
  if (at >= 0) return at;
  const open = row.findIndex((place) => kept.passed[place.code] !== true);
  return open < 0 ? 0 : open;
}

export function campaignDone(kept: Pick<CampaignKept, 'passed'>, row: readonly Place[] = CAMPAIGN): number {
  return row.filter(({ spec }) => kept.passed[spec.id] === true).length;
}

/** The plaques a place shows over its dice: over every die from the start, over a heap a combo is near, or none. */
export function plaquesOf(help: Help): 'all' | 'near' | null {
  return help.plaques ?? null;
}
```

`HINTS`, `Board`, `stopOf`, `numberOf`, `HintKey`, `Hint` и реэкспорт `chapters.ts` уходят. Тип подсказки в `hint.ts` — `{ key: HintKey }` с `HintKey` из `row.ts`.

- [ ] **Step 3: `passage.ts`** — заменить `startBoard`, `boardAfter`, `export type { Board }` и импорты `Board`, `roadPlace`:

```ts
import type { Place } from '../levels/row';
import { campaignFocus } from '../levels/campaign';

/** The place the program opens on: the one whose code is kept (`at`); for a code the row has not, the first place not passed, or the first. */
export function startPlace(at: string | undefined, passed: Readonly<Record<string, boolean | undefined>>, row: readonly Place[]): number {
  return campaignFocus({ passed, stats: {}, at }, row);
}

/** The place after this one in the row; null after the last. Always the next, whatever the player has passed. */
export function placeAfterIndex(place: number, count: number): number | null {
  return place + 1 < count ? place + 1 : null;
}

/**
 * What is kept of where the player stands once the place `passedPlace` is passed: the code of the
 * place after it, when the player stood on it (or stood nowhere yet and it is the place the game
 * opens on); the last place keeps its own code. A place played out of turn moves nothing.
 */
export function atAfter(at: string | undefined, passedPlace: number, row: readonly Place[], passed: Readonly<Record<string, boolean | undefined>>): string | undefined {
  if (startPlace(at, passed, row) !== passedPlace) return at;
  return row[Math.min(passedPlace + 1, row.length - 1)].code;
}
```

Важно: `atAfter` зовут до того, как место записано пройденным (`passed[code] = true`), иначе `startPlace` без `at` уже не укажет на него. В `game.ts` (задача 5) порядок такой же.

- [ ] **Step 4: `signWay.ts`** — заменить импорт `ROAD_IDLE, ROAD_SIGNS` и `roadWait`:

```ts
import type { Help } from '../levels/row';

/** What a place does while the player waits, by the word its help says (the thresholds are a first guess; the owner has not named them). */
export const IDLE_RULES: Readonly<Record<'first' | 'lesson' | 'free', IdleRule>> = {
  first: { blinkMs: null, signMs: 6000, wasted: 3 },
  lesson: { blinkMs: 4000, signMs: 8000, wasted: 3 },
  free: { blinkMs: 4000, signMs: 8000, wasted: null },
};

/** The wait of a place, new for every start of it; null for a place whose help says none. `hurry`: the sign at once. */
export function roadWait(help: Help, hurry = false): RoadWait | null {
  return help.wait ? new RoadWait(help.sign, IDLE_RULES[help.wait], hurry) : null;
}
```

Значения `IDLE_RULES` сверить с `FIRST_WAIT`, `LESSON_WAIT`, `FREE_WAIT` в `src/levels/road.ts` до удаления (строки около 385–393).

- [ ] **Step 5: `hint.ts`** — `import type { HintKey } from '../levels/row'`; `export interface Hint { key: HintKey }` здесь; `export const DEAD_ENDS_FOR_SIGN = 2;` с комментарием из `road.ts` («A piece that has come to a dead end this many times shows the sign of the way at once…»); импорт из `road.ts` убрать.

- [ ] **Step 6: `settings.ts`**

В `LevelProgress` заменить `road?` и `roadEdition?` на:

```ts
  /** The code of the place of the row the player stands on: the one after the last they passed in turn. Absent for one who has passed none. */
  at?: string;
  /** The edition of what is kept here (`ROW_EDITION`): absent in a save of the road, which `toRowEdition` brings over. */
  rowEdition?: number;
```

`toRoadEdition(...)` в загрузке заменить на `toRowEdition(...)` и добавить в `settings.ts` (или в новый `src/platform/rowEdition.ts`, если `settings.ts` не должен знать ряд — тогда `settings.ts` импортирует оттуда):

```ts
import { CAMPAIGN, placeOfCode } from '../levels/campaign';
import type { Place } from '../levels/row';

export const ROW_EDITION = 1;
/** The edition of the road whose codes the row of row.json took over as they were. */
const LAST_ROAD_EDITION = 7;
/** The code a save of the road kept for one past its last piece. */
const PAST_ROAD = 'R00';

export interface RowKept { passed: Record<string, boolean>; stats: Record<string, unknown>; at?: string; rowEdition?: number; road?: string; roadEdition?: number }

/**
 * Brings what is kept of a player to the row of row.json. A save of the seventh edition of the road keeps all it
 * passed: the piece it stood on is the place of that code; past the road, the first place not passed after the
 * prologue (the first chapter's first when all are), which is where the game opened. Before the seventh: nothing
 * is brought over, as the road did. A save of the row is given back as it is.
 */
export function toRowEdition<T extends RowKept>(kept: T, row: readonly Place[] = CAMPAIGN): T {
  if (kept.rowEdition === ROW_EDITION) return kept;
  const { road, roadEdition, ...rest } = kept;
  if (roadEdition !== LAST_ROAD_EDITION) return { ...rest, passed: {}, stats: {}, at: undefined, rowEdition: ROW_EDITION } as T;
  const prologueEnd = row.findIndex((place) => place.chapter > 0);
  const after = prologueEnd < 0 ? row.length : prologueEnd;
  let at: string | undefined;
  if (road !== undefined && road !== PAST_ROAD && placeOfCode(road, row) >= 0) at = road;
  else if (road === PAST_ROAD) {
    const open = row.findIndex((place, i) => i >= after && kept.passed[place.code] !== true);
    at = row[open >= 0 ? open : Math.min(after, row.length - 1)].code;
  }
  return { ...rest, at, rowEdition: ROW_EDITION } as T;
}
```

Значения по умолчанию в `defaultSettings` (`levels: { passed: {}, stats: {}, told: [], roadEdition: … }`) — `rowEdition: ROW_EDITION`, без `road`.

- [ ] **Step 7: тесты модулей** (на `FIXTURE`, не на `ROW`):

`src/app/passage.test.ts` — убрать тесты `startBoard`/`boardAfter`, вписать:

```ts
import { FIXTURE } from '../levels/rowFixture';
import { atAfter, placeAfterIndex, startPlace } from './passage';

const row = FIXTURE.places;
describe('the place the program opens on', () => {
  it('is the first for one who is new', () => expect(startPlace(undefined, {}, row)).toBe(0));
  it('is the place whose code is kept', () => expect(startPlace('G1', {}, row)).toBe(3));
  it('is the first not passed for a code the row has not, and the first when all are', () => {
    expect(startPlace('R99', { F1: true, F2: true }, row)).toBe(2);
    expect(startPlace('R99', Object.fromEntries(row.map((place) => [place.code, true])), row)).toBe(0);
  });
});
describe('the place after a place', () => {
  it('is the next of the row, through the chapters, and none after the last', () => {
    expect(placeAfterIndex(2, row.length)).toBe(3);
    expect(placeAfterIndex(4, row.length)).toBeNull();
  });
  it('moves where the player stands only when the place passed is that one', () => {
    expect(atAfter(undefined, 0, row, {})).toBe('F2');
    expect(atAfter('F3', 2, row, {})).toBe('G1');
    expect(atAfter('F3', 4, row, {})).toBe('F3');
    expect(atAfter('G2', 4, row, {})).toBe('G2');
  });
});
```

`src/platform/settings.test.ts` — тесты `roadEdition`/`road` заменить:

```ts
import { FIXTURE } from '../levels/rowFixture';
import { ROW_EDITION, toRowEdition } from './settings';

describe('what a save of the road becomes in the row', () => {
  const row = FIXTURE.places;
  it('keeps the place of a piece the player stood on, and all that was passed', () => {
    const kept = toRowEdition({ passed: { F1: true }, stats: { F1: { bestMoves: 1 } }, road: 'F2', roadEdition: 7 }, row);
    expect(kept).toEqual({ passed: { F1: true }, stats: { F1: { bestMoves: 1 } }, at: 'F2', rowEdition: ROW_EDITION });
  });
  it('puts one past the road on the first place not passed after the prologue', () => {
    expect(toRowEdition({ passed: { F1: true, F2: true, F3: true, G1: true }, stats: {}, road: 'R00', roadEdition: 7 }, row).at).toBe('G2');
    expect(toRowEdition({ passed: Object.fromEntries(row.map((place) => [place.code, true])), stats: {}, road: 'R00', roadEdition: 7 }, row).at).toBe('G1');
  });
  it('drops what an edition before the seventh kept, and gives a save of the row back as it is', () => {
    expect(toRowEdition({ passed: { F1: true }, stats: {}, road: 'F2', roadEdition: 6 }, row)).toEqual({ passed: {}, stats: {}, at: undefined, rowEdition: ROW_EDITION });
    const fresh = { passed: { F1: true }, stats: {}, at: 'F2', rowEdition: ROW_EDITION };
    expect(toRowEdition(fresh, row)).toBe(fresh);
  });
});
```

`src/app/signWay.test.ts` — где тест берёт `ROAD_IDLE`, `ROAD_SIGNS`, `roadWait('R03')`: брать `roadWait(FIXTURE.places[i].help)`; утверждение «у уровней списка ожидания нет» — `roadWait({})` равно `null`; `IDLE_RULES` — точные значения шага 4. Доски для `signAt`/`follow` — `fileBoard('R03')`, `fileBoard('R05')`, `fileBoard('R07')` из `boardFiles.ts` (их пути и знаки не меняются: это те же доски).

`src/app/hint.test.ts` — `ROAD_HINTS` → `FIXTURE.places[2].help.hint === 'roadHintChain'`; `DEAD_ENDS_FOR_SIGN` из `./hint`; доска `R03` — `fileBoard('R03')`.

`src/levels/campaign.test.ts` — переписать на `FIXTURE`: `campaignCells` даёт `number` 1…5 и звёзды; `campaignFocus` — `at` и первое непройденное; `campaignDone`; `plaquesOf`. Утверждения о настоящем ряде (длина, `CAMPAIGN[18]`, `CHAPTERS`) удалить — их место в `row.test.ts` (свойства) и `grammar.test.ts`.

Run: `npx vitest run src/levels/campaign.test.ts src/app/passage.test.ts src/app/signWay.test.ts src/app/hint.test.ts src/platform/settings.test.ts src/levels/row.test.ts`
Expected: PASS (тесты, импортирующие `game.ts`, ещё красные — до задачи 5).

---

### Task 5: игра стоит на месте ряда

**Files:**
- Modify: `src/app/game.ts`
- Test: `src/shell/levelPanels.test.ts`, `src/app/roadCounters.test.ts`, прочие красные после задачи 4

**Interfaces:**
- Consumes: всё из задачи 4.
- Produces: `Game.place: number | null` (частное поле), `startPlace(index, intro = false, said = true)` (частный метод); адрес `?place=<код>`.

Ниже «было → стало» по `game.ts` (номера строк — `50ace21`; перед правкой найти поиском).

- [ ] **Step 1: импорты** (строки 24–26, 78, 80, 83): убрать `ROAD, blockOf, placeAfter` (`../levels/road`), `LEVELS` (`../levels/levels`), `HINTS, numberOf` из `campaign`; добавить `CAMPAIGN, campaignCells, campaignDone, campaignFocus, plaquesOf` из `../levels/campaign`; из `./passage` — `atAfter, placeAfterIndex, startPlace as openingPlace` вместо `boardAfter, startBoard, type Board`.

- [ ] **Step 2: адрес** (`ROAD_PROBE`, строки 141–149):

```ts
/**
 * `?place=R05` (and `?road=R05`, as the road had it) opens on the place of that code of the row, `?first` on its
 * first, with no command to start it: to play a board again and to look at it. Null where the address asks for
 * neither, or names no place.
 */
const PLACE_PROBE = ((query) => {
  const code = query.get('place') ?? query.get('road');
  const index = code !== null ? CAMPAIGN.findIndex((place) => place.code === code) : query.has('first') ? 0 : -1;
  return index < 0 ? null : index;
})(new URLSearchParams(window.location.search));
```

`FIRST_ID` (строка 157) удалить; `PIECES_COUNTED`, `COUNTERS_UNTIL` (196–198) удалить; `LEVEL_OF_COMMIT` (221) удалить.

- [ ] **Step 3: поля** — `levelIndex` и `piece` заменить одним:

```ts
  /** The place of the row on the board, or last on it, by its index; null on a board of the lab. */
  private place: number | null = 0;
```

- [ ] **Step 4: методы — по таблице**

| Где | Было | Стало |
|---|---|---|
| открытие (около 606) | `ROAD_PROBE !== null` → `startPiece(ROAD_PROBE)` | `PLACE_PROBE !== null` → `this.startPlace(PLACE_PROBE)` |
| `boardNumber` | `numberOf(piece ? {road} : {level})` | `this.labSpec !== null \|\| this.place === null ? null : CAMPAIGN[this.place].number` |
| `levelSpec` | `piece ? ROAD[piece] : labSpec ?? LEVELS[levelIndex]` | `this.labSpec ?? CAMPAIGN[this.place ?? 0].spec` |
| `playBoard`, `showBoard` | `this.piece = null` | `this.place = null` |
| `startRun('level')` | три ветки | `if (this.labSpec !== null) this.runLevel(this.labSpec, false); else this.startPlace(this.place ?? 0);` |
| `begin` (около 962) | `roadWait(state.levelRun.spec.id, hurries)` | `state.levelRun && this.labSpec === null && this.place !== null ? roadWait(CAMPAIGN[this.place].help, this.deadEnds.hurries) : null` |
| `startLevel` + `startPiece` | два метода | один `startPlace` (ниже) |
| `tellHint(id)` | `probe = piece !== null ? HINT_PROBE : null; own = HINTS[id]` | `probe = this.place !== null ? HINT_PROBE : null; const hint = this.place !== null ? CAMPAIGN[this.place].help.hint : undefined; own = hint ? { key: hint } : undefined` |
| `showStart` | `startBoard(levels.road, passed[FIRST_ID], nextLevel())` | `this.startPlace(openingPlace(levels.at, levels.passed, CAMPAIGN), false, false)` |
| `boardFrame` | `blockOf(piece)`, `ROAD.slice` | см. шаг 5 |
| `startPassage` | `boardAfter(...)` | `const next = this.labSpec !== null \|\| this.place === null ? null : placeAfterIndex(this.place, CAMPAIGN.length);` |
| `starScore` | `ROAD` + `LEVELS` | `starScore(CAMPAIGN.map((place) => place.spec), (id) => stats[id]?.bestMoves)` |
| `putNext` | `next.road`/`next.level` | `this.startPlace(next)` (`passage.next` — число) |
| `levelRules` | `lessonsAt(LEVELS, levelIndex)` | `lessonsAt(CAMPAIGN.map((place) => place.spec), this.place ?? 0)` |
| `nextLevel` | первый непройденный `LEVELS` | удалить; зовущие — `campaignFocus` |
| `showLevels` | `onward`, `campaignFocus(levels, FIRST_ID, onward)`, `onPick` по `board` | `const current = this.kind === 'level' && this.labSpec === null && this.place !== null ? this.place : campaignFocus(levels);` `onPick: (index) => this.startPlace(index, true)` |
| `countLevel`, пройдено | `if (this.piece !== null) { forget; levels.road = placeAfter(...) }` | **до** `passed[spec.id] = true`: `if (this.place !== null) levels.at = atAfter(levels.at, this.place, CAMPAIGN, levels.passed);` и `if (this.place !== null && CAMPAIGN[this.place].help.wait) this.deadEnds.forget();` |
| `countLevel`, тупик | `stuck && this.piece !== null` | `stuck && this.place !== null && CAMPAIGN[this.place].help.wait !== undefined` |
| итог `hasNext` | `piece === null && labSpec === null && levelIndex + 1 < LEVELS.length` | `this.labSpec === null && this.place !== null && this.place + 1 < CAMPAIGN.length` |
| итог `onNext` | `startLevel(levelIndex + 1, true)` | `this.startPlace(this.place! + 1, true)` |
| `shareLevels` | `LEVELS.map(...)` | `CAMPAIGN.map((place) => ({ ...place.spec, limit: place.spec.moves }))` |
| `commits` (около 2269) | `labSpec === null && levelIndex + 1 >= LEVEL_OF_COMMIT` | `this.labSpec === null` |
| плашки (около 2332) | `first`, `late` по номерам | шаг 6 |
| `levelScene.frame(..., this.levelIndex, ...)` | индекс списка | `this.place ?? 0` |

`startPlace`:

```ts
  /**
   * A place of the row begins on its board: the window of its rule first where its board has one and it is come to
   * from the list or the place before; started over, it is not said again. Without `said` its start is not reported.
   */
  private startPlace(index: number, intro = false, said = true): void {
    const { spec } = CAMPAIGN[index];
    this.place = index;
    this.labSpec = null;
    this.labFrozen = false;
    this.runLevel(spec, said);
    if (intro && spec.lesson) this.showLevelIntro(spec.lesson);
  }
```

(Сейчас `startPiece` окна урока не показывает, `startLevel` показывает; ни у одной доски ряда `lesson` нет, так что видимой разницы нет.)

- [ ] **Step 5: `boardFrame`**

```ts
  /**
   * The frame the board that is on is seen in: null for its own, whole, as a board of a chapter has it; for a place
   * whose help says `cells`, a frame fitted by its cells, and for `hold` fitted so at one scale with every `hold` place
   * next to it in the row (the first block of the prologue).
   */
  private boardFrame(): Frame | null {
    if (!this.state.levelRun || this.place === null || this.labSpec !== null) return null;
    const camera = CAMPAIGN[this.place].help.camera;
    if (!camera) return null;
    if (camera === 'cells') return this.view.frameOfPiece(this.view.shape, []);
    let from = this.place;
    let to = this.place;
    while (from > 0 && CAMPAIGN[from - 1].help.camera === 'hold') from--;
    while (to + 1 < CAMPAIGN.length && CAMPAIGN[to + 1].help.camera === 'hold') to++;
    return this.view.frameOfPiece(this.view.shape, CAMPAIGN.slice(from, to + 1).map((place) => place.spec));
  }
```

- [ ] **Step 6: плашки**

```ts
    const levelRun = state.levelRun ?? null;
    // A place says its plaques: over every die and heap of a working face from the start, over a heap a combo is
    // near, or none (the owner, 15 October 2026: the first ten places, until the plaques are talked over again). A
    // board of the lab has the near ones. They blink on a place that waits with the player.
    const help = levelRun && this.labSpec === null && this.place !== null ? CAMPAIGN[this.place].help : null;
    const plaques = levelRun === null ? null : help === null ? 'near' : plaquesOf(help);
    const short = !levelRun || state.over || this.passage || plaques === null ? [] : plaques === 'all' ? roadCounters(state) : this.hintedGroups(state);
```

и `blink: help?.wait !== undefined && this.waiting.blink`.

- [ ] **Step 7: прогнать и починить остальные тесты**

Run: `npx vitest run`
Expected: красные — тесты, которые брали `ROAD[n]`, `LEVELS`, `CHAPTERS`, `numberOf`, `startBoard`. Для каждого:
- доска как пример (`ROAD[2]` и т. п.) → `fileBoard('<код>')` из `src/levels/boardFiles.ts` (код — тот, что был под индексом: `ROAD[0]`=`R01`, `[1]`=`R02`, `[2]`=`R03`, `[3]`=`R04`, `[4]`=`B01_s290`, `[5]`=`R05`, `[6]`=`R07`, `[7]`=`R08`; `LEVELS[0]`=`R11` на гранях `[2, 3]` — `CAMPAIGN.find((place) => place.code === 'R11')!.spec`, если тесту нужны грани главы);
- `src/shell/levelPanels.test.ts` — список на `campaignCells(kept, FIXTURE.places)`: пять клеток, номера `01`–`05`; число `25` и `ROAD.length` уходят;
- `src/app/roadCounters.test.ts` — доски по кодам через `fileBoard`; ожидания плашек те же.

Run: `npm test && npm run typecheck && npm run build`
Expected: всё зелёное.

- [ ] **Step 8: проверить в игре** (preview `vi-dev` из worktree): `?place=R04` → пройти (`N`, `W`) → `B01_s290` (`LV 05`, плашки есть) → (`N`, `E`, `S`) → `R05` (`LV 06`); `?place=P02` — плашки есть; `?place=C1-05` — плашек нет, окно семи (если не сказано); `?place=R08` → пройти → `R11` без окна итога. Сохранение `localStorage` до и после — вернуть (память `vi-preview-of-a-worktree`).

- [ ] **Step 9: Commit**

```bash
git add -A src/
git commit -m "Игра стоит на месте ряда: одно место, прогресс по коду, помощь из help"
```

---

### Task 6: старое уходит

**Files:**
- Delete: `src/levels/road.ts`, `src/levels/levels.ts`, `src/levels/chapters.ts`, `src/levels/rowBridge.test.ts`, `src/levels/road.test.ts`, `src/levels/levels.test.ts`
- Modify: `src/levels/grammar.ts`, `src/levels/table.ts`, `src/levels/campaignRecipes.ts`, `src/levels/roadRecipes.ts`, `src/levels/library.ts`, `src/lab/libraryLab.ts`, `src/levels/labText.ts`, `src/lab/leavingScenes.ts`, `src/levels/measures.ts`, `scripts/library.mjs`, `scripts/ladder.mjs`, `scripts/bots.mjs`, `scripts/stars.mjs`, `scripts/teach.mjs`, `scripts/level.mjs`, тесты, что их импортируют

**Interfaces:**
- Consumes: `ROW`, `Role`, `Technique` из `row.ts`.
- Produces: `rowChapters(row: Row): LibraryRowChapter[]` в `src/levels/library.ts` — `{ id, title, faces, stops: codes }` для прежнего API библиотеки; `boardFrom(code)` в `labText.ts` — место ряда (`from: 'row'`).

- [ ] **Step 1: перед удалением — все доски кода есть файлами.** Run: `node scripts/library.mjs check` → `0 faults` (проверка уже держит `others` = `ROAD_SPARES`, `PARKED`, `SPARES`). Если не `0` — остановиться и разобрать.

- [ ] **Step 2: замеры из `road.test.ts` в `measures.ts`.** Перенести функции `nearOf(spec)` и `lostOf(spec)` из `src/levels/road.test.ts` (строки около 150–210) в `src/levels/measures.ts` как экспорт, без `expect` внутри (вместо `expect(... ).toBe(true)` — `if (!complete) throw new Error(...)`). Тест на них — в `src/levels/measures.test.ts`: `lostOf(fileBoard('R03'))` равно `{ boards: 8592, lost: 0, said: 0, worst: 12 }`; `nearOf(fileBoard('R03'))` равно `[14, 0, 0, 4]`.

- [ ] **Step 3: типы.** `grammar.ts`, `table.ts`, `campaignRecipes.ts`: `Role`, `Technique` — из `./row`; `Stop` — из `./campaign` (это `Place`). `grammar.ts` строка 5 (`CHAPTERS`) → главы из `ROW.chapters` (номер главы — `place.chapter`, как было `stop.chapter`). Где `grammar.ts` читал `stop.spec.id` — `place.code`.

- [ ] **Step 4: библиотека.** `library.ts`: интерфейс `RowChapter` переименовать в `LibraryRowChapter` (чтобы не спорить с `row.ts`) и добавить:

```ts
/** The chapters of a laid row as the library reads them: their codes in order. */
export function rowChapters(row: Row): LibraryRowChapter[] {
  return row.chapters.map((chapter) => ({ id: chapter.id, title: chapter.title, faces: chapter.faces, stops: row.places.slice(chapter.first, chapter.last + 1).map((place) => place.code) }));
}
```

`CodeBoards.others` и проверка `others` в `checkLibrary` уходят (досок кода, кроме ряда, нет); `row` — `ROW.places.map((place) => place.spec)`. `scripts/library.mjs`: `CHAPTERS` → `library.rowChapters(ROW)` (`ROW` — `load('/src/levels/row.gen.ts')`); `codeBoards()` → `{ row: ROW.places.map((place) => place.spec) }`; в `SOURCES` первая строка `at: 'HEAD'` → `at: '50ace21'` (последний коммит с досками в коде), подпись та же; строка 170 (`LEVELS.find`) → `ROW.places.find((place) => place.code === code)?.spec`. `src/lab/libraryLab.ts`: `CHAPTERS` → `rowChapters(ROW)`. `library.test.ts`: `CAMPAIGN`, `others` → по новому API.

- [ ] **Step 5: лаборатория.** `labText.ts` `boardFrom`:

```ts
/** A board of the row by its code, as the game plays it (on the faces of its chapter): `file=game:R11`. A board out of the row is its file. */
export function boardFrom(code: string): { spec: LevelSpec; from: 'row' } {
  const place = ROW.places.find((one) => one.code === code);
  if (!place) throw new Error(`no board "${code}" in the row: a board out of it is read by its file, file=${code}`);
  return { spec: place.spec, from: 'row' };
}
```

`labText.test.ts` — ожидания `from: 'list' | 'road'` → `'row'`; `boardFrom('R06')`, `boardFrom('K23')` теперь бросают (их нет в ряду). `leavingScenes.ts` строка 61: `ROAD_SPARES.find(... 'R10')` → `fileBoard('R10')` из `../levels/boardFiles`.

- [ ] **Step 6: рецепты.** `roadRecipes.ts`, `campaignRecipes.ts`: убрать поля `sketch` у мест, чья `sketch` — копия доски ряда (`B01_s290`, `R05`, `R06`, `R08`, `R15` в `ROAD_PLACES`; в `CAMPAIGN_PLACES` — каждая `sketch`, равная файлу доски с тем же `id`). Заголовочные комментарии про `sketch` поправить: «доска места — её файл в `boards/`».

- [ ] **Step 7: скрипты.** `bots.mjs` 41, 97; `stars.mjs` 39; `teach.mjs`; `ladder.mjs` 87–91 (`stops = CAMPAIGN`, пролог — места главы 0: `CAMPAIGN.filter((place) => place.chapter === 0)`), 224–232 (`LEVELS` → `ROW.places.map((place) => place.spec)`, флаги `parked` и `SPARES` — из файлов `boards/` со статусом `RC`/`D`, если флаг дан; иначе убрать флаг с выводом `refuse('parked: the parked boards are files of boards/ now: node scripts/library.mjs list status=RC')`); `level.mjs` 349–365 (`regress`: доски — `ROW.places` с `from: 'row'` и все файлы `boards/`, как уже читает).

- [ ] **Step 8: удалить файлы и тесты по местам.** `git rm src/levels/road.ts src/levels/levels.ts src/levels/chapters.ts src/levels/road.test.ts src/levels/levels.test.ts src/levels/rowBridge.test.ts`. Проверить, что из `levels.test.ts` не уходит ничего, кроме досок и мест: тесты правил доски (если есть утверждения про `levelConfig` на выдуманных спеках) — перенести в `row.test.ts`.

Run: `grep -rn "levels/road\|levels/levels\|levels/chapters\|ROAD_\|\bLEVELS\b\|PARKED\|ROAD_SPARES\|CHAPTERS\b\|STOPS\b" src scripts --include=*.ts --include=*.mjs`
Expected: пусто (кроме строк истории в `scripts/library.mjs` `SOURCES`, где это имена экспортов старых коммитов).

Run: `npm test && npm run typecheck && npm run build && node scripts/library.mjs check && node scripts/row.mjs check`
Expected: всё зелёное, `0 faults`, `row.gen.ts is fresh`.

- [ ] **Step 9: размер.** `npm run build` — строка `dist/assets/index-*.js` до (в `50ace21`: 625,13 кБ, gzip 221,12 кБ) и после; после должна быть меньше (литералы досок ушли, черновики не вошли). Записать оба числа для задачи 8.

- [ ] **Step 10: Commit**

```bash
git add -A src/ scripts/
git commit -m "Доски ряда только в файлах: road.ts, levels.ts, chapters.ts удалены"
```

---

### Task 7: отчёт по местам

**Files:**
- Create: `scripts/rowReport.mjs`
- Modify: `scripts/row.mjs` (ветка `report`)

**Interfaces:**
- Consumes: `ROW` (через переданный `row`), `load` (как в `row.mjs`); `nearOf`, `lostOf` из `/src/levels/measures.ts`; `firstsOf` из `/src/levels/measures.ts`; `routeOf`/`turns`/`away` — те же функции, что зовёт `node scripts/ladder.mjs campaign` (найти в `ladder.mjs` строки 87–140 и взять оттуда); доли ботов — `judge` из `/src/levels/select.ts` с `{ near: true }`, как в `road.test.ts` строки около 571–581 (место судится как «доска, положенная для места»: `judge({ ...placeRecipe, sketch: [spec.layout] }, SKETCH + 1, { near: true })`; для места без рецепта — только числа решателя).
- Produces: `export async function report(row, place, load)` — печатает таблицу.

- [ ] **Step 1:** `scripts/rowReport.mjs` — таблица колонок спеки 7.3: `№ глава код грани кости par маршрут turns away первые торопливый случайный ближние(всего/тупики/молча/худший) целиком(доски/потеряно/худший)`; `целиком` — только для доски не больше 9 клеток; `place=N` — то же для одного места и путь словами (`moveText`). Числа берутся теми же функциями, что `road.test.ts` и `ladder.mjs`, без новых замеров.

- [ ] **Step 2:** Run: `node scripts/row.mjs report place=5`
Expected: строка `B01_s290` с `par 3`, первые ходы `2`, торопливый `20`/30, случайный `23`/30, ближние `9 0 0 5`, целиком `8592 0 12` — числа, что держал `road.test.ts` (коммит `ffcfaee`).

- [ ] **Step 3: Commit**

```bash
git add scripts/rowReport.mjs scripts/row.mjs
git commit -m "Отчёт по местам ряда: node scripts/row.mjs report"
```

---

### Task 8: документы и итоговая проверка

**Files:**
- Modify: `docs/VI_Levels_Lab.md`, `docs/art/VI_Interface_Layer.md`, `README.md`, `boards/README.md`, `docs/README.md`, `docs/superpowers/specs/2026-10-15-vi-row-json-design.md` (шапка и «Что вышло иначе»), этот план (шапка)

- [ ] **Step 1: `VI_Levels_Lab.md`** — новый раздел «16. Ряд: `row.json`»: формат (спека 3.2 кратко), команды `node scripts/row.mjs`, `check`, `report [place=N]`, дев-сервер пересобирает сам, как вставить доску (спека раздел 9 дословно). Раздел 15: «Перенос доски в ряд — строка в `boards/row.json`», вместо `CHAPTERS`. Шапка: «Что живёт в коде» + `src/levels/row.ts`, `scripts/row.mjs`, `boards/row.json`.
- [ ] **Step 2: `VI_Interface_Layer.md`** — строки «Список уровней», «Окно подсказки доски», «Переход между досками», «Счётчик неполной группы»: место помощи — `help` места в `boards/row.json` (`plaques`, `hint`, `camera`, `wait`), код — `src/levels/campaign.ts`, `src/app/game.ts` (`boardFrame`, `startPlace`); `COUNTERS_UNTIL`, `ROAD_BLOCKS`, `roadPlace` убрать из ссылок.
- [ ] **Step 3: `README.md`** — таблица структуры: `src/levels/row.ts`, `row.gen.ts`, `boards/row.json`; убрать `road.ts`, `levels.ts`, `chapters.ts`. `boards/README.md` — «доски ряда — `status: R` и строка в `row.json`».
- [ ] **Step 4:** спека — шапка «Статус: построено. … построено <дата>, версия <x>» и раздел «Что вышло иначе» (расхождения файлов с кодом из задачи 2, всё, что сделано не по плану); план — «Статус: выполнен»; индекс `docs/README.md` — строки спеки и плана; план с «выполнен» уходит из дерева по правилу индекса (перечень в конце индекса с коммитом).
- [ ] **Step 5:** версия — `package.json` `version` +0.0.1 (как делают прочие поставки; проверить, где ещё пишется версия: `grep -rn "0.2.62" --include=*.ts --include=*.json`).
- [ ] **Step 6: проверка** — `npm test`, `npm run typecheck`, `npm run build`, `node scripts/docs-check.mjs`, `node scripts/row.mjs check`, `node scripts/library.mjs check`. В preview — сценарий спеки раздел 8 «Проверка в конце»: новый игрок (чистый `localStorage`) проходит места 1 → 9 переходами, знак на месте 1, окно цепочки на 7, плашки на 1–10 и нет на 11; сохранение седьмой редакции (`levels: { road: 'R05', roadEdition: 7, passed: { R01: true, R02: true, R03: true, R04: true, B01_s290: true } }`) открывается на `R05`; `{ road: 'R00', roadEdition: 7, passed: { …пролог…, R11: true, P02: true } }` — на `C1-05`; `?place=B01_s290`. Снимок экрана места 5 — владельцу.
- [ ] **Step 7: Commit** — `git commit -m "Документы: ряд из row.json, версия <x>"`; затем спросить владельца «пуш?».
