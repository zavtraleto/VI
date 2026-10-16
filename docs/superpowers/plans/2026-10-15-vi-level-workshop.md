# Мастерская уровней — план сборки

> Вид: план. Статус: не выполнен. Дата: 2026-10-16. Ждёт «ок» владельца.
> Спека: [2026-10-15-vi-level-workshop-design.md](../specs/2026-10-15-vi-level-workshop-design.md). Исполнитель читает спеку, этот план и файлы, названные в задачах; весь проект заново не изучается.

> **Для исполнителя:** обязательный приём — superpowers:subagent-driven-development или superpowers:executing-plans, задача за задачей; шаги отмечаются `- [ ]`. Модель реализации — Opus.

**Цель:** одна страница `?lab=workshop` вместо `?lab=levels` и `?lab=library` (списки, поле, расстановка с катанием кости, игра, отметка «хорошая / доделать / убрать», «показать решение», «проверить», копия для чата), статус `N` и пачки, понятные имена досок, входная страница `?lab`.

**Устройство:** чистые модули с тестами (`boardFile.ts`, `boardsServer.ts`, `workshopLists.ts`, `checkLines.ts`, `editBoard.ts`, `library.ts`) и одна страница `src/lab/workshop.ts`, собранная из того, что уже есть: `BoardStage` над `Game`, `SolveClient` и воркер, `PlayWatch`, клиент файлов. Старые страницы живут до задачи 9 и удаляются в ней же, когда новая их заменила.

**Стек:** TypeScript, Vite (дев-сервер и плагин `vite.boards.ts`), vitest, Node-скрипты через `runnerImport`.

## Общие рамки

- Правила уровня (`src/rules`) не меняются; из `src/app/game.ts` — только два шва задачи 5.
- Работа — в worktree `level-workshop` (ветка `worktree-level-workshop`). Основную папку `GAMES\VI` не трогать: ни файлов, ни копий. `src/main.ts`, `src/app/game.ts` правят и другие чаты — правки в них малые, ровно названные.
- Коммит задачи — локальный, в своей ветке. Пуш в `main` — только после «ок» владельца: `git fetch`, `git rebase origin/main`, проверки, `git push origin HEAD:main`.
- Сообщение коммита: заголовок до 70 знаков, тело не длиннее пяти строк; в конце строка `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Длинное сообщение — через `git commit -F <файл в scratchpad>`.
- Вид страницы — слой владельца: цвета и шрифт только из `src/shell/theme.ts` (`paletteAt(shellDefaults(), 0)`, `PROGRAM_FONT`), расположение простейшее рабочее, ничего своего.
- Ключ пробы `docs/VI_Levels_Probe_Key.md` владельцу не показывать и не пересказывать; имена досок задачи 11 его не выдают.
- Проверка каждой задачи: `npx vitest run --maxWorkers=3`, `npm run typecheck`, `npm run build`. Дев-сервер — только preview `vi-dev`; он крутит код основной папки, поэтому страницу worktree смотрят по приёму ниже.
- **Смотреть worktree в preview.** В корне worktree временная страница `wt.html` — копия `index.html`, в которой путь скрипта заменён на `./src/main.ts`. Адрес: `http://localhost:<порт preview>/.claude/worktrees/level-workshop/wt.html?lab=workshop`. Плагин `vite.boards.ts` основной папки читает `boards/` основной папки — значит, в preview страница worktree видит **чужие** доски. Поэтому шаги в preview, которые пишут файлы, делаются на досках с именем `wt-…`, созданных в этой же проверке, и в конце эти файлы удаляются (по одному, `rm boards/wt-*.txt` в основной папке **не** запускать — сказать владельцу, что их положено и где). Если адреса `/__boards/<имя>/rename` в основной папке ещё нет (он появляется задачей 2 только в worktree), шаги с переименованием проверяются тестами и командой, не в preview. `wt.html` удалить перед коммитом, не коммитить.

## Что проверить сверх тестов задач

1. **Файл меняется снаружи, пока владелец правит** (агент кладёт пачку при открытой странице): список обновляется, правка в руках не теряется, доска в руках не перечитывается поверх ждущей записи. Тест — задача 9, шаг 6 (в preview: записать файл командой, пока на странице идёт правка).
2. **Переименование в занятое имя, в имя с точкой или косой чертой, доски ряда**: отказ, файл и история на месте. Тесты — задача 2.
3. **Отметка доски ряда (`R`)**: статус остаётся `R`, слово пишется с датой, `node scripts/library.mjs check` чистый. Тесты — задача 2 (`patchHead` отказывает) и задача 6 (`verdictPatch` даёт слово, не статус).
4. **Катание через занятую клетку, вырез, край, пол с игроком; фиксированная кость**: кость встаёт на последней свободной клетке; фиксированная не катится; отмена — один шаг. Тесты — задача 8.
5. **«Показать решение» у доски без решения, у доски, которую правила не принимают, и посреди партии**: строка «решения нет» или ошибка правил, ничего не падает; любая клавиша останавливает; `E` возвращает расстановку. Тест — задача 10, шаги в preview.

---

### Задача 0: подготовка worktree

- [ ] **Шаг 1.** В worktree нет `node_modules`. Выполнить `npm ci` в корне worktree (`C:\Users\makid\Documents\GAMES\VI\.claude\worktrees\level-workshop`).
- [ ] **Шаг 2.** Исходная проверка: `npx vitest run --maxWorkers=3`, `npm run typecheck`, `npm run build`, `node scripts/library.mjs check`, `node scripts/docs-check.mjs`. Записать в журнал плана (раздел «Что вышло иначе» в конце), что уже красное до работы, если что-то красное.
- [ ] **Шаг 3.** Коммит спеки и плана (они уже лежат в worktree): `git add docs/superpowers/specs/2026-10-15-vi-level-workshop-design.md docs/superpowers/plans/2026-10-15-vi-level-workshop.md docs/README.md`, сообщение «Спека и план мастерской уровней».

---

### Задача 1: статус `N`, ключи `batch` и `was`

**Файлы:**
- Изменить: `src/levels/boardFile.ts` (типы на строках 54–55, `BoardHead` 73–82, `KEYS` 84, `readBoardHead` 261–289, `LIBRARY_KEYS` 292, `printBoard` 338–373)
- Тест: `src/levels/boardFile.test.ts`

**Интерфейсы:**
- Даёт: `type BoardStatus = 'N' | 'D' | 'RC' | 'R' | 'X'`; `BOARD_STATUSES = ['N', 'D', 'RC', 'R', 'X']`; `BoardHead.batch?: string` (вид `bridge 2026-10-16`); `BoardHead.was?: string[]`.

- [ ] **Шаг 1. Тест.** В `src/levels/boardFile.test.ts` добавить:

```ts
describe('the head of the workshop', () => {
  const text = [
    'id: bridge-3',
    'status: N',
    'batch: bridge 2026-10-16',
    'origin: заказ',
    'was: P13_s30460 P13x',
    'faces: 2',
    '---',
    '21* 21',
    ' .   .',
  ].join('\n');
  it('reads a new board, its batch and the names it had', () => {
    expect(readBoardHead(text)).toEqual({ status: 'N', batch: 'bridge 2026-10-16', origin: 'заказ', was: ['P13_s30460', 'P13x'] });
  });
  it('writes them back in the order of the keys, and the hash of the board does not see them', () => {
    const spec = parseBoard(text, 'bridge-3', true);
    const written = printBoard(spec, readBoardHead(text));
    expect(written.split('\n').slice(0, 5)).toEqual(['id: bridge-3', 'status: N', 'batch: bridge 2026-10-16', 'origin: заказ', 'was: P13_s30460 P13x']);
    expect(printBoard(normalSpec(parseBoard(written, 'x', true)))).toBe(printBoard(normalSpec(spec)));
  });
  it('says N among the statuses a file may have', () => {
    expect(() => parseBoard(text.replace('status: N', 'status: Q'), 'q', true)).toThrow('"status: Q" is none of N D RC R X');
  });
  it('keeps them when the head of the library is said anew', () => {
    expect(readBoardHead(withHead(text, { ...readBoardHead(text), status: 'RC' }))).toEqual({ status: 'RC', batch: 'bridge 2026-10-16', origin: 'заказ', was: ['P13_s30460', 'P13x'] });
  });
});
```

(`withHead`, `normalSpec`, `printBoard`, `parseBoard`, `readBoardHead` добавить в импорт теста, если их там нет.)

- [ ] **Шаг 2.** `npx vitest run src/levels/boardFile.test.ts` — красный: `batch` и `was` не читаются, `N` неизвестен.
- [ ] **Шаг 3. Код.**
  - Строки 51–55: комментарий дополнить «`N` new: laid by an order or a generator and not yet marked by the owner (docs/superpowers/specs/2026-10-15-vi-level-workshop-design.md, section 5)»; `export type BoardStatus = 'N' | 'D' | 'RC' | 'R' | 'X';` и `export const BOARD_STATUSES: readonly BoardStatus[] = ['N', 'D', 'RC', 'R', 'X'];`.
  - `BoardHead`: после `status` — `/** The batch a board was laid in: the word of the order and the day, \`bridge 2026-10-16\`. */ batch?: string;`; после `origin` — `/** The names the board had before, the oldest first. */ was?: string[];`.
  - `KEYS`: `['id', 'note', 'status', 'batch', 'origin', 'was', 'mark', 'words', 'tags', …как было]`.
  - `readBoardHead`: регулярное выражение `/^(note|status|batch|origin|was|mark|words|tags):\s*(.*)$/`; ветки `else if (key === 'batch') head.batch = value;` и `else if (key === 'was') head.was = value.split(/\s+/);`.
  - `LIBRARY_KEYS = /^(status|batch|origin|was|mark|words|tags):/`.
  - `printBoard`, объект `said`: `batch: extra.batch,` после `status`, `was: extra.was && extra.was.length > 0 ? extra.was.join(' ') : undefined,` после `origin`.
- [ ] **Шаг 4.** `npx vitest run src/levels/boardFile.test.ts src/levels/library.test.ts src/lab` — зелёный. Если тест где-то сверяет строку ошибки `is none of D RC R X`, поправить её на `N D RC R X`.
- [ ] **Шаг 5.** `npm run typecheck`. Места, где `BoardStatus` перебирается словарём (`Record<BoardStatus, …>`), получают ключ `N` (искать `Record<BoardStatus` по `src` и `scripts`).
- [ ] **Шаг 6. Коммит:** «Файл доски: статус N, ключи batch и was».

---

### Задача 2: отметка статусом и переименование на сервере досок

**Файлы:**
- Изменить: `src/lab/boardsServer.ts` (`HeadPatch`, `headPatchOf`, `patchHead`, `BoardsAsk`, `askOf`, шапка-комментарий с перечнем адресов)
- Изменить: `vite.boards.ts` (ветки `head` и новая `rename`)
- Изменить: `src/lab/boardsClient.ts` (новая `renameBoard`)
- Тест: `src/lab/boardsServer.test.ts`

**Интерфейсы:**
- Даёт: `HeadPatch { status?: 'N' | 'D' | 'RC' | 'X'; mark?: BoardMark; words?: BoardWords[] }`; `patchHead(text, patch)` бросает `Error('a board of the row keeps R: …')`, если файл `R`, а патч несёт статус; `renamedText(text: string, to: string): string` — файл с `id: <to>` и прежним `id` в конце `was`; `BoardsAsk` получает `{ kind: 'rename'; name: string }` для `POST /__boards/<имя>/rename`; `renameOf(body: string): string | null` — имя из тела `{ "to": "…" }` или null; клиент `renameBoard(name: string, to: string): Promise<void>`.

- [ ] **Шаг 1. Тест.** В `src/lab/boardsServer.test.ts`:

```ts
describe('a status laid into the head', () => {
  const file = (status: string) => `id: a-1\nstatus: ${status}\nfaces: 2\n---\n21* 21\n .   .\n`;
  it('takes the status of a verdict, and refuses R and a status no verdict gives', () => {
    expect(headPatchOf('{"status":"RC"}')).toEqual({ status: 'RC' });
    expect(headPatchOf('{"status":"R"}')).toBeNull();
    expect(headPatchOf('{"status":"Q"}')).toBeNull();
  });
  it('writes it over the one there was, and the board stays the board', () => {
    const after = patchHead(file('N'), { status: 'X', words: [{ date: '2026-10-16', text: 'скучно' }] });
    expect(readBoardHead(after)).toMatchObject({ status: 'X', words: [{ date: '2026-10-16', text: 'скучно' }] });
    expect(boardHash(after, 'a-1')).toBe(boardHash(file('N'), 'a-1'));
  });
  it('leaves a board of the row in the row: its status is not changed from the page', () => {
    expect(() => patchHead(file('R'), { status: 'D' })).toThrow('a board of the row keeps R');
    expect(readBoardHead(patchHead(file('R'), { words: [{ date: '2026-10-16', text: 'доделать: длинно' }] })).status).toBe('R');
  });
});

describe('a board renamed', () => {
  it('is asked with POST, by a name of a board to a name of a board', () => {
    expect(askOf('POST', '/a-1/rename')).toEqual({ kind: 'rename', name: 'a-1' });
    expect(askOf('GET', '/a-1/rename')).toMatchObject({ kind: 'refused', status: 405 });
    expect(renameOf('{"to":"bridge-2"}')).toBe('bridge-2');
    expect(renameOf('{"to":"../x"}')).toBeNull();
    expect(renameOf('{"to":"a.b"}')).toBeNull();
    expect(renameOf('nothing')).toBeNull();
  });
  it('takes the new name as its id and keeps the old one among the names it had', () => {
    const text = 'id: P13_s1\nwas: P13old\nfaces: 2\n---\n21* 21\n .   .\n';
    const renamed = renamedText(text, 'bridge-4');
    expect(renamed.split('\n')[0]).toBe('id: bridge-4');
    expect(readBoardHead(renamed).was).toEqual(['P13old', 'P13_s1']);
    expect(boardHash(renamed, 'bridge-4')).not.toBeNull();
  });
});
```

(Импорт теста дополнить `renameOf`, `renamedText`, `readBoardHead`.)

- [ ] **Шаг 2.** `npx vitest run src/lab/boardsServer.test.ts` — красный.
- [ ] **Шаг 3. Код `boardsServer.ts`.**
  - В шапку-перечень адресов: `POST /__boards/<name>/rename      { to }: the file, its history and its plays under the new name; refused where the name is taken or the board is of the row` и строку `PUT …/head` дополнить словом `status`.
  - `HeadPatch`: поле `status?: Exclude<BoardStatus, 'R'>;` с комментарием «what a verdict after a play makes of the board: R is given only by the row».
  - `headPatchOf`: читать `status`; принять только `'N' | 'D' | 'RC' | 'X'`, иначе `null`; вернуть его в объекте.
  - `patchHead`: в начале `if (patch.status && head.status === 'R') throw new Error(\`a board of the row keeps R: \${...}\`)` (в тексте — `id` файла или «this board»); в собранную голову — `...(patch.status ? { status: patch.status } : {})`.
  - `BoardsAsk`: `| { kind: 'rename'; name: string }`; в `askOf` перед последним `return refused(404…)`: `if (parts[1] === 'rename' && parts.length === 2) return method === 'POST' ? { kind: 'rename', name } : refused(405, 'a board is renamed with POST');`.
  - Новые функции:

```ts
/** The name a body of `POST …/rename` asks for, or null where it asks for no name of a board. */
export function renameOf(body: string): string | null {
  try {
    const { to } = JSON.parse(body) as { to?: unknown };
    return typeof to === 'string' ? safeName(to) : null;
  } catch {
    return null;
  }
}

/**
 * A file under a new name: its id is the new name, and the name it had goes to the end of the
 * names it had before (`was`). Nothing else of the file changes.
 */
export function renamedText(text: string, to: string): string {
  const head = readBoardHead(text);
  const { migrated: _migrated, ...rest } = head;
  const id = /^id:\s*(.*)$/m.exec(text)?.[1]?.trim() ?? '';
  const was = [...(head.was ?? []), ...(id && id !== to ? [id] : [])];
  return withHead(text.replace(/^id:.*$/m, `id: ${to}`), { ...rest, ...(was.length > 0 ? { was } : {}) });
}
```

  (`BoardStatus` добавить в импорт из `../levels/boardFile`.)
- [ ] **Шаг 4. Код `vite.boards.ts`.** Перед строкой `if (ask.kind === 'read')` вставить:

```ts
          if (ask.kind === 'rename') {
            // A board is given a new name: the file, and its history and plays with it. A name that is taken, or a board of the row, is refused.
            const to = renameOf(await body());
            if (!to) return send(400, JSON.stringify({ error: 'a rename is { to: <name of a board> }' }));
            if (!existsSync(file)) return send(404, JSON.stringify({ error: `no board ${ask.name}` }));
            const target = join(dir, `${to}.txt`);
            if (existsSync(target)) return send(409, JSON.stringify({ error: `there is a board ${to} already` }));
            const row = readRowFile(readFileSync(join(dir, 'row.json'), 'utf8'));
            if (row.chapters.some((chapter) => chapter.places.some((place) => place.board === ask.name))) return send(409, JSON.stringify({ error: `${ask.name} is a board of the row: its code is what the players' progress keeps` }));
            writeFileSync(target, renamedText(readFileSync(file, 'utf8'), to));
            unlinkSync(file);
            if (existsSync(history(ask.name)) && !existsSync(history(to))) renameSync(history(ask.name), history(to));
            return send(200, JSON.stringify({ name: to }));
          }
```

  В импорт `node:fs` добавить `renameSync`, `unlinkSync`; из `./src/lab/boardsServer` — `renameOf`, `renamedText`. Проверить по `src/levels/row.ts`, как называются поля `readRowFile` (`chapters[].places[].board`); если иначе — взять их имена оттуда. В ветке `head` ответ на брошенную `patchHead` ошибку — уже `400` с текстом: оставить.
- [ ] **Шаг 5. Код `boardsClient.ts`:**

```ts
/** Gives a board a new name: its file, history and plays go over to it. Refused where the name is taken or the board is of the row. */
export async function renameBoard(name: string, to: string): Promise<void> {
  await asked(at(name, '/rename'), { method: 'POST', body: JSON.stringify({ to }) });
}
```

  Комментарий `writeHead` — «Lays a status, a mark and words into the head of a board's file».
- [ ] **Шаг 6.** `npx vitest run src/lab src/levels/boardFile.test.ts`, `npm run typecheck` — зелёные.
- [ ] **Шаг 7. Коммит:** «Сервер досок: статус в голове и переименование доски».

---

### Задача 3: переименование командой; поиск доски по прежнему имени; без `import`

**Файлы:**
- Изменить: `src/levels/library.ts` (новые `renameFaults`, `resolveName`)
- Изменить: `src/levels/boardFiles.ts` (`fileBoard` ищет и по `was`)
- Изменить: `scripts/library.mjs` (команды `rename`, `history`; удалить `import` и всё, что служит только ему: функцию `lay`, чтение коммитов, `node_modules/.cache/vi-library`; `list` и `export` с `N`, `batch`, `was`)
- Удалить: `scripts/library-words.json`
- Изменить: `scripts/level.mjs` (`loadBoard` ищет файл по `was`)
- Тест: `src/levels/library.test.ts`

**Интерфейсы:**
- Даёт: `renameFaults(map: Readonly<Record<string, string>>, names: readonly string[], rowCodes: readonly string[]): string[]` — пустой массив, если карту можно выполнить; `resolveName(name: string, files: readonly { name: string; text: string }[]): string | null` — имя файла, чьё имя или `was` равно `name`.

- [ ] **Шаг 1. Тест** (`src/levels/library.test.ts`):

```ts
describe('the renames of the library', () => {
  const names = ['P13_s1', 'P13_s2', 'R01', 'bridge-1'];
  it('takes a map that gives every board a free name of a board', () => {
    expect(renameFaults({ P13_s1: 'bridge-2', P13_s2: 'bridge-3' }, names, ['R01'])).toEqual([]);
  });
  it('says every fault of a map: no such board, a board of the row, a name taken or given twice, no name of a board', () => {
    expect(renameFaults({ nope: 'a-1', R01: 'road-1', P13_s1: 'bridge-1', P13_s2: 'x.y' }, names, ['R01'])).toEqual([
      'nope: no such board',
      'R01: a board of the row keeps its code',
      'P13_s1: bridge-1 is taken',
      'P13_s2: "x.y" is no name of a board',
    ]);
    expect(renameFaults({ P13_s1: 'b-1', P13_s2: 'b-1' }, names, [])).toEqual(['P13_s2: b-1 is given twice']);
  });
  it('finds a board by the name it has or by a name it had', () => {
    const files = [{ name: 'bridge-2', text: 'id: bridge-2\nwas: P13_s1\nfaces: 2\n---\n21*\n' }];
    expect(resolveName('bridge-2', files)).toBe('bridge-2');
    expect(resolveName('P13_s1', files)).toBe('bridge-2');
    expect(resolveName('P13_s9', files)).toBeNull();
  });
});
```

- [ ] **Шаг 2.** `npx vitest run src/levels/library.test.ts` — красный.
- [ ] **Шаг 3. Код `src/levels/library.ts`:**

```ts
/**
 * What is wrong with a map of renames (`library.mjs rename map=`), a line to a board: a board that
 * is not there, a board of the row (its code is what the progress of the players keeps), a name
 * taken by a board that is not renamed itself, a name given twice, a name that is no name of a
 * board. Empty where the map can be done.
 */
export function renameFaults(map: Readonly<Record<string, string>>, names: readonly string[], rowCodes: readonly string[]): string[] {
  const faults: string[] = [];
  const given = new Set<string>();
  const leaving = new Set(Object.keys(map));
  for (const [from, to] of Object.entries(map)) {
    if (!names.includes(from)) faults.push(`${from}: no such board`);
    else if (rowCodes.includes(from)) faults.push(`${from}: a board of the row keeps its code`);
    else if (!isBoardName(to)) faults.push(`${from}: "${to}" is no name of a board`);
    else if (given.has(to)) faults.push(`${from}: ${to} is given twice`);
    else if (names.includes(to) && !leaving.has(to)) faults.push(`${from}: ${to} is taken`);
    given.add(to);
  }
  return faults;
}

/** The file a name is of: the file of that name, or the one that had the name before (`was`). */
export function resolveName(name: string, files: readonly { name: string; text: string }[]): string | null {
  if (files.some((file) => file.name === name)) return name;
  return files.find((file) => readBoardHead(file.text).was?.includes(name))?.name ?? null;
}
```

  (`isBoardName` — из `../app/boardProbe`; `readBoardHead` — из `./boardFile`, если ещё не в импорте.)
- [ ] **Шаг 4. Код `src/levels/boardFiles.ts`:** `fileBoard(code)` — если файла с таким именем нет, найти через `resolveName(code, [...BOARD_TEXTS].map(([name, text]) => ({ name, text })))` и читать найденный; ошибка, если не найден, прежняя.
- [ ] **Шаг 5.** `npx vitest run src/levels` — зелёный.
- [ ] **Шаг 6. `scripts/library.mjs`.**
  - Шапку переписать: команды `list`, `check`, `export`, `rename from= to=`, `rename map=<file.json>`, `history`; страница — `?lab=workshop`; строку о чтении коммитов истории убрать.
  - Удалить команду `import`, функцию `lay` и всё, чем пользуется только она (чтение `library-words.json`, раскладку коммитов в `node_modules/.cache/vi-library`, `execFileSync`/`spawnSync`, если больше не нужны). `git rm scripts/library-words.json`.
  - `COMMANDS = { list: ['status', 'chapter', 'batch'], check: [], export: ['since'], rename: ['from', 'to', 'map'], history: [] }`.
  - `rename`: карта — `{ [from]: to }` из `from=`/`to=` или JSON-файла `map=`; `rowCodes = ROW.places.map((place) => place.code)`; `renameFaults` — при ошибках печатать их и выйти с кодом 1, ничего не трогая; иначе для каждой пары: `writeFileSync(boards/<to>.txt, renamedText(text, to))`, `unlinkSync(boards/<from>.txt)`, перенос `boards/.history/<from>` → `boards/.history/<to>`, если первая есть, а второй нет. `renamedText` грузить через `load('/src/lab/boardsServer.ts')`. Итог: `rename: N boards`.
  - `history`: для каждого файла с `was` — каждое прежнее имя, у которого есть `boards/.history/<прежнее>`, а у нового имени истории нет, переносится; печать `history: N moved`. Это для папки, где история досок лежит под старыми именами (основная папка после `git pull`).
  - `list`: столбец `пачка` (`head.batch ?? '—'`) после `стат`; фильтр `batch=` по первому слову пачки; столбец `было` (`head.was?.join(' ') ?? ''`) в конце.
  - `export`: без изменений, кроме того, что `N` печатается как есть.
- [ ] **Шаг 7. `scripts/level.mjs`, `loadBoard`.** Если пути к файлу нет и имя без `/\\.` — найти файл через `resolveName(said, файлы boards/*.txt)` (загрузить `library.ts` через `load`) и читать его; в `from` писать `'file'`, в ответ `show` — строку `was: <said>` не нужно. Шапку-комментарий строк 39–41 дополнить: «or a name the board had before (`was:`)».
- [ ] **Шаг 8. Проверка руками** (в worktree): `node scripts/library.mjs rename from=P13_s30460 to=wt-try-1` → есть `boards/wt-try-1.txt` с `was: P13_s30460`, нет `boards/P13_s30460.txt`; `node scripts/level.mjs show file=P13_s30460` показывает доску; `npx vitest run src/levels` и `node scripts/library.mjs check` — зелёные (тесты берут `P13_s30460` через `fileBoard`, он находит её по `was`). Откат: `rm boards/wt-try-1.txt` и `git checkout -- boards/P13_s30460.txt`. `node scripts/library.mjs rename from=R01 to=x-1` — отказ, код 1, файлы не тронуты.
- [ ] **Шаг 9.** `npx vitest run --maxWorkers=3`, `npm run typecheck`, `node scripts/library.mjs check`.
- [ ] **Шаг 10. Коммит:** «Библиотека: rename и history, поиск по was, без import».

---

### Задача 4: пачки у `gen` и `order`

**Файлы:**
- Изменить: `src/levels/labText.ts` (новая `batchFile`, рядом с `genFile` на строке 331)
- Изменить: `scripts/level.mjs` (ветки `gen` на строке 198 и `order` на строке 240; шапка строк 24 и 35)
- Тест: `src/levels/labText.test.ts` (есть ли — посмотреть; нет — создать рядом)

**Интерфейсы:**
- Даёт: `batchFile(spec: LevelSpec, word: string, taken: readonly string[], date: string, note: string): { name: string; text: string }` — имя `<word>-<n>` с первым `n`, которого нет в `taken`; текст со `status: N`, `batch: <word> <date>`, `note`. `BATCH_WORD = /^[a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*$/` — слово пачки.

- [ ] **Шаг 1. Тест:**

```ts
describe('a board of a batch', () => {
  it('takes the first free number of its word, and says it is new', () => {
    const { name, text } = batchFile(fileBoard('R03'), 'bridge', ['bridge-1', 'bridge-3'], '2026-10-16', 'заказ preset=tricky');
    expect(name).toBe('bridge-2');
    expect(readBoardHead(text)).toMatchObject({ status: 'N', batch: 'bridge 2026-10-16', note: 'заказ preset=tricky' });
    expect(parseBoard(text, name).id).toBe('bridge-2');
  });
  it('knows a word of a batch', () => {
    expect(BATCH_WORD.test('combo-opens')).toBe(true);
    expect(BATCH_WORD.test('Мост')).toBe(false);
    expect(BATCH_WORD.test('a_b')).toBe(false);
  });
});
```

- [ ] **Шаг 2.** Красный.
- [ ] **Шаг 3. Код** в `labText.ts`:

```ts
/** A word a batch of boards is named by: English, in small letters, words joined by `-`. */
export const BATCH_WORD = /^[a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*$/;

/** A board laid for an order or a place as a board of a batch: `<word>-<n>` by the first free number, new (`N`), with its batch and its note. */
export function batchFile(spec: LevelSpec, word: string, taken: readonly string[], date: string, note: string): { name: string; text: string } {
  let number = 1;
  while (taken.includes(`${word}-${number}`)) number++;
  const name = `${word}-${number}`;
  return { name, text: printBoard({ ...spec, id: name }, { status: 'N', batch: `${word} ${date}`, note }) };
}
```

- [ ] **Шаг 4.** Зелёный.
- [ ] **Шаг 5. `scripts/level.mjs`.**
  - `gen`: ключ `batch=` в перечне допустимых; с ним `out=` не обязателен (по умолчанию `boards/`); слово сверяется с `BATCH_WORD`, иначе отказ `gen: "batch=…" is no word of a batch: small English letters, words joined by -`; каждая доска пишется `batchFile(fit.spec, word, taken, today, note)`, где `note` — тот, что даёт `genFile` (`место <код>, зерно <n>`), `taken` — имена `boards/*.txt` и уже записанные в этом прогоне; без `batch=` — как сейчас.
  - `order`: `own = ['seconds', 'keep', 'out', 'batch']`; с `batch=` — то же: `boards/` по умолчанию, `batchFile(offer.spec, word, taken, today, \`заказ \${orderText(order)}\`)`; `keep` по умолчанию 10 при `batch=` (5 без него, как сейчас).
  - Дата — `new Date().toISOString().slice(0, 10)`.
  - Шапка: строки `gen` и `order` дополнить «batch=bridge: boards/bridge-<n>.txt, new (N), in one batch».
- [ ] **Шаг 6. Проверка:** `node scripts/level.mjs order preset=tricky batch=wt-trap keep=3 seconds=5` → три файла `boards/wt-trap-1..3.txt` со `status: N` и `batch: wt-trap <дата>`; `node scripts/library.mjs list batch=wt-trap` показывает их; удалить три файла.
- [ ] **Шаг 7.** Проверки; **коммит:** «gen и order: пачка batch= в boards/ со статусом N».

---

### Задача 5: два шва игры — без паузы и ход по просьбе

**Файлы:**
- Изменить: `src/app/game.ts` (поле рядом с `labFrozen`; `setAway` на строке ~653; новый метод рядом с `cellPoint` на строке ~782)

**Интерфейсы:**
- Даёт: `Game.awake: boolean` (по умолчанию `false`); `Game.press(dir: Dir): void`.

- [ ] **Шаг 1. Код.** Перед правкой — `git fetch` и `git diff HEAD origin/main -- src/app/game.ts`: если файл менялся, сначала `git rebase origin/main` (на коммитах задач 1–4 — конфликтов в game.ts нет).
  - Рядом с полями лаборатории (`labSpec`, `labFrozen`):

```ts
  /** The lab keeps the board on while the page is hidden: no pause comes over it, and the sound falls silent as ever (`?lab=workshop`). */
  awake = false;
```

  - В `setAway`, ветка `away`: `this.pause();` → `if (!this.awake) this.pause();`.
  - Рядом с `cellPoint`:

```ts
  /** A move given as a key gives it, pressed and let go: the lab plays a way with it, a move at a time. */
  press(dir: Dir): void {
    this.controller.press(dir, this.now());
    this.controller.release();
  }
```

  (`Dir` — в импорте типов `game.ts` проверить, добавить из `../rules/types`, если нет.)
- [ ] **Шаг 2.** `npm run typecheck`, `npx vitest run src/app` — зелёные (тестов на шов нет: `Game` без WebGL в vitest не поднять; проверка — в preview в задаче 9).
- [ ] **Шаг 3. Коммит:** «Игра: awake и press для мастерской».

---

### Задача 6: списки мастерской

**Файлы:**
- Создать: `src/lab/workshopLists.ts`
- Создать: `src/lab/workshopLists.test.ts`
- (`src/lab/libraryRows.ts` и его тест удаляются в задаче 9, вместе со страницей библиотеки.)

**Интерфейсы:**
- Даёт:

```ts
export type ListKey = 'new' | 'redo' | 'good' | 'row' | 'all';
export const LISTS: readonly { key: ListKey; title: string }[];
export interface BoardRow { name: string; text: string; hash: string | null; spec: LevelSpec | null; error: string | null; head: BoardHead; place: Place | null }
export function rowOf(file: { name: string; text: string; hash: string | null }, chapters: readonly LibraryRowChapter[]): BoardRow;
export interface Batch { key: string; word: string; date: string; rows: BoardRow[] }
export function listRows(rows: readonly BoardRow[], key: ListKey, search: string): BoardRow[];
export function batchesOf(rows: readonly BoardRow[]): Batch[];
export function batchTitle(batch: Batch): string;
export function nextInBatch(rows: readonly BoardRow[], name: string): string | null;
export function plural(n: number, forms: readonly [string, string, string]): string;
export type Verdict = 'good' | 'redo' | 'drop';
export function verdictPatch(status: BoardStatus | undefined, verdict: Verdict | null, words: string, date: string): HeadPatch | null;
```

`Verdict` объявляется здесь; `src/lab/playLog.ts` в задаче 9 берёт его отсюда (`import type { Verdict } from './workshopLists'`).

- [ ] **Шаг 1. Тест** (`src/lab/workshopLists.test.ts`):

```ts
import { describe, expect, it } from 'vitest';
import type { LibraryRowChapter } from '../levels/library';
import { batchTitle, batchesOf, listRows, nextInBatch, plural, rowOf } from './workshopLists';

const ROW: readonly LibraryRowChapter[] = [{ id: 0, title: 'prologue', faces: null, stops: ['R01'] }];
const file = (name: string, head: string) => rowOf({ name, text: `id: ${name}\n${head}faces: 2\n---\n21* 21\n .   .\n`, hash: null }, ROW);
const rows = [
  file('bridge-2', 'status: N\nbatch: bridge 2026-10-16\n'),
  file('bridge-1', 'status: N\nbatch: bridge 2026-10-16\n'),
  file('stairs-1', 'status: N\nbatch: stairs 2026-10-17\n'),
  file('old-1', 'status: D\nwords: 2026-10-10: длинно\n'),
  file('old-2', 'status: D\nwords: 2026-10-14: почти\n'),
  file('good-1', 'status: RC\nwas: P13_s30460\n'),
  file('R01', 'status: R\n'),
  file('gone-1', 'status: X\nnote: скучная\n'),
];

describe('the lists of the workshop', () => {
  it('puts each board in the list of its status, and all of them in «все»', () => {
    expect(listRows(rows, 'new', '').map((row) => row.name)).toEqual(['stairs-1', 'bridge-1', 'bridge-2']);
    expect(listRows(rows, 'redo', '').map((row) => row.name)).toEqual(['old-2', 'old-1']);
    expect(listRows(rows, 'good', '').map((row) => row.name)).toEqual(['good-1']);
    expect(listRows(rows, 'row', '').map((row) => row.name)).toEqual(['R01']);
    expect(listRows(rows, 'all', '')).toHaveLength(8);
  });
  it('finds a board by its name, a name it had, its words and its note', () => {
    expect(listRows(rows, 'all', 'P13').map((row) => row.name)).toEqual(['good-1']);
    expect(listRows(rows, 'all', 'почти').map((row) => row.name)).toEqual(['old-2']);
    expect(listRows(rows, 'all', 'скучн').map((row) => row.name)).toEqual(['gone-1']);
    expect(listRows(rows, 'new', 'stairs').map((row) => row.name)).toEqual(['stairs-1']);
  });
  it('gathers the new boards by batch, the newest batch first, the boards by number', () => {
    const batches = batchesOf(listRows(rows, 'new', ''));
    expect(batches.map((batch) => batch.key)).toEqual(['stairs 2026-10-17', 'bridge 2026-10-16']);
    expect(batches[1].rows.map((row) => row.name)).toEqual(['bridge-1', 'bridge-2']);
    expect(batchTitle(batches[1])).toBe('bridge, 16 октября, 2 доски');
  });
  it('goes on to the next new board of the batch, and to none after the last', () => {
    expect(nextInBatch(rows, 'bridge-1')).toBe('bridge-2');
    expect(nextInBatch(rows, 'bridge-2')).toBeNull();
  });
  it('says a number with its word', () => {
    expect([1, 2, 5, 11, 21, 22].map((n) => plural(n, ['доска', 'доски', 'досок']))).toEqual(['доска', 'доски', 'досок', 'досок', 'доска', 'доски']);
  });
});

describe('a verdict written into the head', () => {
  it('gives a board its status, and the words with their day', () => {
    expect(verdictPatch('N', 'good', '', '2026-10-16')).toEqual({ status: 'RC' });
    expect(verdictPatch('D', 'drop', 'скучно', '2026-10-16')).toEqual({ status: 'X', words: [{ date: '2026-10-16', text: 'скучно' }] });
    expect(verdictPatch('RC', 'redo', '  длинно  ', '2026-10-16')).toEqual({ status: 'D', words: [{ date: '2026-10-16', text: 'длинно' }] });
  });
  it('leaves a board of the row in the row: the verdict is a word, not a status', () => {
    expect(verdictPatch('R', 'drop', 'длинно', '2026-10-16')).toEqual({ words: [{ date: '2026-10-16', text: 'убрать: длинно' }] });
    expect(verdictPatch('R', 'good', '', '2026-10-16')).toEqual({ words: [{ date: '2026-10-16', text: 'хорошая' }] });
  });
  it('writes words without a verdict, and nothing where nothing is said', () => {
    expect(verdictPatch('N', null, 'мост не виден', '2026-10-16')).toEqual({ words: [{ date: '2026-10-16', text: 'мост не виден' }] });
    expect(verdictPatch('N', null, '  ', '2026-10-16')).toBeNull();
  });
});
```

(В импорт теста добавить `verdictPatch`.)

- [ ] **Шаг 2.** Красный.
- [ ] **Шаг 3. Код** `src/lab/workshopLists.ts`. Шапка: «The lists of the workshop (`?lab=workshop`, docs/superpowers/specs/2026-10-15-vi-level-workshop-design.md, section 3.1), as far as they can be said without a page». `rowOf` перенести из `src/lab/libraryRows.ts` (строки 34–50) без поля `passport`. Остальное:

```ts
export const LISTS: readonly { key: ListKey; title: string }[] = [
  { key: 'new', title: 'новые' },
  { key: 'redo', title: 'доделать' },
  { key: 'good', title: 'хорошие' },
  { key: 'row', title: 'в кампании' },
  { key: 'all', title: 'все' },
];
const STATUS_OF: Readonly<Record<Exclude<ListKey, 'all'>, BoardStatus>> = { new: 'N', redo: 'D', good: 'RC', row: 'R' };
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/** The number of a board in its batch: `bridge-12` is 12; a name with no number is 0. */
const numberOf = (name: string): number => Number(/-(\d+)$/.exec(name)?.[1] ?? 0);
/** The day the owner last said something of a board, for the lists that put the last touched first. */
const lastSaid = (row: BoardRow): string => row.head.words?.at(-1)?.date ?? '';

export function plural(n: number, [one, few, many]: readonly [string, string, string]): string {
  const tens = n % 100;
  const units = n % 10;
  if (tens >= 11 && tens <= 14) return many;
  return units === 1 ? one : units >= 2 && units <= 4 ? few : many;
}

function found(row: BoardRow, search: string): boolean {
  const said = search.trim().toLowerCase();
  if (said === '') return true;
  return [row.name, ...(row.head.was ?? []), row.head.note ?? '', ...(row.head.words ?? []).map((word) => word.text)].some((text) => text.toLowerCase().includes(said));
}

export function listRows(rows: readonly BoardRow[], key: ListKey, search: string): BoardRow[] {
  const shown = rows.filter((row) => (key === 'all' || row.head.status === STATUS_OF[key]) && found(row, search));
  if (key === 'new') return batchesOf(shown).flatMap((batch) => batch.rows);
  if (key === 'row') return shown.sort((a, b) => (a.place?.number ?? 0) - (b.place?.number ?? 0));
  if (key === 'all') return shown.sort((a, b) => a.name.localeCompare(b.name));
  return shown.sort((a, b) => lastSaid(b).localeCompare(lastSaid(a)) || a.name.localeCompare(b.name));
}

export function batchesOf(rows: readonly BoardRow[]): Batch[] {
  const batches = new Map<string, Batch>();
  for (const row of rows) {
    const key = row.head.batch ?? '';
    const [word = '', date = ''] = key.split(' ');
    const batch = batches.get(key) ?? { key, word: word || 'без пачки', date, rows: [] };
    batch.rows.push(row);
    batches.set(key, batch);
  }
  for (const batch of batches.values()) batch.rows.sort((a, b) => numberOf(a.name) - numberOf(b.name) || a.name.localeCompare(b.name));
  return [...batches.values()].sort((a, b) => b.date.localeCompare(a.date) || a.word.localeCompare(b.word));
}

export function batchTitle(batch: Batch): string {
  const [, month, day] = batch.date.split('-').map(Number);
  const when = month ? `, ${day} ${MONTHS[month - 1]}` : '';
  return `${batch.word}${when}, ${batch.rows.length} ${plural(batch.rows.length, ['доска', 'доски', 'досок'])}`;
}

export function nextInBatch(rows: readonly BoardRow[], name: string): string | null {
  const row = rows.find((one) => one.name === name);
  if (!row?.head.batch) return null;
  const batch = batchesOf(rows.filter((one) => one.head.status === 'N' || one.name === name)).find((one) => one.key === row.head.batch);
  const at = batch?.rows.findIndex((one) => one.name === name) ?? -1;
  return batch?.rows[at + 1]?.name ?? null;
}

const STATUS_OF_VERDICT: Readonly<Record<Verdict, Exclude<BoardStatus, 'R'>>> = { good: 'RC', redo: 'D', drop: 'X' };
const WORD_OF_VERDICT: Readonly<Record<Verdict, string>> = { good: 'хорошая', redo: 'доделать', drop: 'убрать' };

/**
 * What a verdict after a play writes into the head of the file: the status it gives, and the
 * words with their day. A board of the row keeps R — the row is changed by the agent at the
 * word of the owner — so for it the verdict is written as a word. Null where nothing is said.
 */
export function verdictPatch(status: BoardStatus | undefined, verdict: Verdict | null, words: string, date: string): HeadPatch | null {
  const said = words.replace(/\s+/g, ' ').trim();
  if (status === 'R' && verdict) return { words: [{ date, text: said ? `${WORD_OF_VERDICT[verdict]}: ${said}` : WORD_OF_VERDICT[verdict] }] };
  if (!verdict && !said) return null;
  return { ...(verdict ? { status: STATUS_OF_VERDICT[verdict] } : {}), ...(said ? { words: [{ date, text: said }] } : {}) };
}
```

(`HeadPatch` — из `./boardsServer`, `BoardStatus` — из `../levels/boardFile`.)

  Комментарий к каждой экспортируемой функции — одной строкой, в манере проекта.
- [ ] **Шаг 4.** Зелёный; `npm run typecheck`.
- [ ] **Шаг 5. Коммит:** «Мастерская: списки, пачки, поиск».

---

### Задача 7: строки «проверить»

**Файлы:**
- Изменить: `src/lab/labFacts.ts` (`Seconds` получает `trap`)
- Создать: `src/lab/checkLines.ts`, `src/lab/checkLines.test.ts`

**Интерфейсы:**
- Потребляет: `Instant`, `Seconds`, `Later` из `labFacts.ts`; `trapDepthOf(spec, way)` из `src/levels/orders.ts`.
- Даёт: `Seconds.trap: number | null` (глубина ловушки, null — нет); `checkLines(instant: Instant | null, seconds: Seconds | string | null, later: Later | string | null): string[]`.

- [ ] **Шаг 1. `labFacts.ts`:** в `Seconds` — `/** How deep the trap is: moves after it before the board is seen lost (0 at once); null where there is none (\`trapDepthOf\`). */ trap: number | null;`; в `secondsOf` — `trap: check.way ? trapDepthOf(spec, check.way) : null`. Импорт `trapDepthOf` из `../levels/orders`. Поправить `labFacts.test.ts`, если он сравнивает `Seconds` целиком.
- [ ] **Шаг 2. Тест** `src/lab/checkLines.test.ts`. Факты собираются руками, без решателя:

```ts
import { describe, expect, it } from 'vitest';
import type { Instant, Later, Seconds } from './labFacts';
import { checkLines } from './checkLines';

const instant: Instant = { error: null, deadEnd: null, dice: 5, groups: [] };
const seconds = (over: Partial<Seconds['check']> = {}, more: Partial<Seconds> = {}): Seconds => ({
  check: { par: 6, exact: true, states: 1000, way: ['0,0,E'], score: null, kept: 'same', ...over },
  firsts: 2,
  moves: [
    { move: '0,0,E', keeps: 'par', par: 6, deadEnd: null },
    { move: '0,0,S', keeps: 'longer', par: 8, deadEnd: null },
    { move: '0,0,N', keeps: 'dead', par: null, deadEnd: 'count' },
    { move: '0,0,W', keeps: 'dead', par: null, deadEnd: null },
  ],
  trap: 1,
  ...more,
});
const passed = (share: number) => ({ endings: { passed: share, count: 1 - share, floor: 0, limit: 0 } });
const later = { report: { personas: { hasty: passed(0.1), casual: passed(0.3), careful: passed(0.7), planner: passed(1), greedy: passed(0) } }, near: [], spare: [] } as unknown as Later;

describe('what «проверить» says', () => {
  it('says the board in plain lines', () => {
    expect(checkLines(instant, seconds(), later)).toEqual([
      'решается за 6 ходов (доказано)',
      'записанный путь: держит минимум',
      'первые ходы: 2 из 4 ведут к решению, 1 сразу в тупик',
      'ловушка: есть, тупик виден через 1 ход',
      'боты из 10: торопливый 1, обычный 3, внимательный 7, планирующий 10',
      'лишних костей нет',
    ]);
  });
  it('says what is still being counted', () => {
    expect(checkLines(instant, null, null)).toEqual(['решаю…', 'боты: считаю…']);
  });
  it('says a board the rules refuse, and nothing else', () => {
    expect(checkLines({ ...instant, error: 'level x: the board is in two parts' }, null, null)).toEqual(['правила не принимают доску: level x: the board is in two parts']);
  });
  it('says a board with no way, and the ways a file keeps that do not hold', () => {
    expect(checkLines(instant, seconds({ par: null, exact: true, way: null, kept: null }, { moves: [], firsts: 0, trap: null }), null)[0]).toBe('решения нет');
    expect(checkLines(instant, seconds({ par: null, exact: false, way: null, kept: 'missing' }, { moves: [], trap: null }), null)[0]).toBe('решатель сдался, решения не нашёл');
    expect(checkLines(instant, seconds({ kept: 'shorter', par: 4 }), null)[1]).toBe('записанный путь длиннее: есть путь за 4 хода');
    expect(checkLines(instant, seconds({ kept: 'broken' }), null)[1]).toBe('записанный путь не проходит доску');
    expect(checkLines(instant, seconds({ kept: null }), null)[1]).toBe('пути в файле нет');
    expect(checkLines(instant, seconds({}, { trap: 0 }), null)[3]).toBe('ловушка: есть, тупик сразу');
    expect(checkLines(instant, seconds({}, { trap: null }), null)[3]).toBe('ловушки нет');
  });
  it('says a board that stands in a dead end as it is', () => {
    expect(checkLines({ ...instant, deadEnd: 'count' }, null, null)[0]).toBe('доска стоит в тупике как есть');
  });
});
```

  Перед тем как писать шаг 3, сверить значения `kept` с `checkOf` (`src/levels/labText.ts`, строки 67–100): `shorter` — найден путь короче записанного, `longer` — записано меньше, чем возможно. Если смысл иной, поправить и тест, и строки.
- [ ] **Шаг 3.** Красный.
- [ ] **Шаг 4. Код** `src/lab/checkLines.ts`:

```ts
import type { Instant, Later, Seconds } from './labFacts';
import { plural } from './workshopLists';

/**
 * What «проверить» of the workshop says of a board (docs/superpowers/specs/2026-10-15-vi-level-workshop-design.md,
 * section 3.4): the facts of the tiers of the lab put into plain lines, a line to a thing. A fact
 * still being counted is said to be; a board the rules refuse is said in one line, and no more.
 */
export function checkLines(instant: Instant | null, seconds: Seconds | string | null, later: Later | string | null): string[] {
  if (instant?.error) return [`правила не принимают доску: ${instant.error}`];
  const lines: string[] = [];
  if (instant?.deadEnd) lines.push('доска стоит в тупике как есть');
  const moves = (n: number): string => `${n} ${plural(n, ['ход', 'хода', 'ходов'])}`;
  if (seconds === null) lines.push('решаю…');
  else if (typeof seconds === 'string') lines.push(`решатель: ${seconds}`);
  else {
    const { check } = seconds;
    if (check.par === null) lines.push(check.exact ? 'решения нет' : 'решатель сдался, решения не нашёл');
    else {
      lines.push(`решается за ${moves(check.par)} (${check.exact ? 'доказано' : 'не доказано'})`);
      const kept = {
        same: 'записанный путь: держит минимум',
        shorter: `записанный путь длиннее: есть путь за ${moves(check.par)}`,
        longer: 'записано меньше ходов, чем нашёл решатель',
        missing: 'записанный путь: решатель не нашёл пути',
        broken: 'записанный путь не проходит доску',
      } as const;
      lines.push(check.kept === null ? 'пути в файле нет' : kept[check.kept]);
      const lead = seconds.moves.filter((move) => move.keeps === 'par' || move.keeps === 'longer').length;
      const dead = seconds.moves.filter((move) => move.keeps === 'dead' && move.deadEnd !== null).length;
      lines.push(`первые ходы: ${lead} из ${seconds.moves.length} ведут к решению${dead > 0 ? `, ${dead} сразу в тупик` : ''}`);
      lines.push(seconds.trap === null ? 'ловушки нет' : seconds.trap === 0 ? 'ловушка: есть, тупик сразу' : `ловушка: есть, тупик виден через ${moves(seconds.trap)}`);
    }
  }
  if (later === null) lines.push('боты: считаю…');
  else if (typeof later === 'string') lines.push(`боты: ${later}`);
  else {
    const of = (name: 'hasty' | 'casual' | 'careful' | 'planner'): number => Math.round((later.report.personas[name]?.endings.passed ?? 0) * 10);
    lines.push(`боты из 10: торопливый ${of('hasty')}, обычный ${of('casual')}, внимательный ${of('careful')}, планирующий ${of('planner')}`);
    lines.push(later.spare.length === 0 ? 'лишних костей нет' : `лишних костей: ${later.spare.length}`);
  }
  return lines;
}
```

  `10` — число партий на персону в `laterOf(spec, runs = 10)`; если там другое число, взять его оттуда константой и показать в строке.
- [ ] **Шаг 5.** Зелёный; `npm run typecheck`.
- [ ] **Шаг 6. Коммит:** «Мастерская: строки «проверить», ловушка в ярусе секунд».

---

### Задача 8: катить кость

**Файлы:**
- Изменить: `src/lab/editBoard.ts` (новая `rollAlong` после `moveDie`, строка ~203)
- Изменить: `src/lab/boardStage.ts` (жест `Shift`+перетаскивание; шапка-комментарий строк 18–35)
- Тест: `src/lab/editBoard.test.ts`

**Интерфейсы:**
- Даёт: `rollAlong(board: EditBoard, from: { x: number; z: number }, cells: readonly { x: number; z: number }[]): { board: EditBoard; at: { x: number; z: number } }`.

- [ ] **Шаг 1. Тест:**

```ts
describe('rollAlong', () => {
  const lies = (top: number) => ALL_ORIENTATIONS.find((o) => o.top === top)!;
  const start = putDie(emptyBoard(4), 0, 0); // a die with 1 on top at 0,0
  it('rolls a die cell by cell as the game rolls it, and leaves the cells behind it empty', () => {
    const { board, at } = rollAlong(start, { x: 0, z: 0 }, [{ x: 1, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 1 }]);
    const turned = roll(roll(roll(lies(1), 'E'), 'E'), 'S');
    expect(at).toEqual({ x: 2, z: 1 });
    expect(cellAt(board, 2, 1)).toMatchObject({ kind: 'die', top: turned.top, north: turned.north });
    expect(cellAt(board, 0, 0)).toEqual({ kind: 'empty' });
  });
  it('stops at the last free cell: before a die, a cut cell, the player on the floor, or a step that is no step', () => {
    const blocked = putDie(toggleHole(start, 1, 1), 2, 0);
    expect(rollAlong(blocked, { x: 0, z: 0 }, [{ x: 1, z: 0 }, { x: 2, z: 0 }]).at).toEqual({ x: 1, z: 0 });
    expect(rollAlong(blocked, { x: 0, z: 0 }, [{ x: 0, z: 1 }, { x: 1, z: 1 }]).at).toEqual({ x: 0, z: 1 });
    expect(rollAlong(start, { x: 0, z: 0 }, [{ x: 2, z: 0 }]).at).toEqual({ x: 0, z: 0 });
    const floor = setStart(start, 1, 0);
    expect(rollAlong(floor, { x: 0, z: 0 }, [{ x: 1, z: 0 }]).at).toEqual({ x: 0, z: 0 });
  });
  it('takes the player on the die along with it, and does not roll a fixed die', () => {
    const riding = setStart(start, 0, 0);
    expect(cellAt(rollAlong(riding, { x: 0, z: 0 }, [{ x: 1, z: 0 }]).board, 1, 0)).toMatchObject({ kind: 'die', start: true });
    const fixed = toggleFixed(start, 0, 0);
    expect(rollAlong(fixed, { x: 0, z: 0 }, [{ x: 1, z: 0 }]).board).toBe(fixed);
  });
});
```

  (Сверить: `putDie` кладёт кость с 1 сверху, `setStart` на пустой клетке ставит игрока на пол (`floorStart`), `toggleFixed` фиксирует кость — по коду `editBoard.ts`, строки 121–186; если иначе — поправить тест под их смысл.)
- [ ] **Шаг 2.** Красный.
- [ ] **Шаг 3. Код** в `editBoard.ts` после `moveDie`:

```ts
const STEP: Readonly<Record<string, Dir>> = { '1,0': 'E', '-1,0': 'W', '0,1': 'S', '0,-1': 'N' };

/**
 * A die rolled across the board cell by cell, as the game rolls it: each step is a roll to the
 * next cell, and its faces turn with it. It goes only to the cell beside it, only onto an empty
 * cell; before a die, a cell cut out, the player on the floor or the edge it stops, at the last
 * cell it reached. A fixed die is not rolled. The player on the die goes with it.
 */
export function rollAlong(board: EditBoard, from: { x: number; z: number }, cells: readonly { x: number; z: number }[]): { board: EditBoard; at: { x: number; z: number } } {
  const die = cellAt(board, from.x, from.z);
  if (!die || die.kind !== 'die' || die.fixed) return { board, at: from };
  let now = board;
  let at = from;
  for (const next of cells) {
    const dir = STEP[`${next.x - at.x},${next.z - at.z}`];
    const target = cellAt(now, next.x, next.z);
    if (!dir || !target || target.kind !== 'empty' || target.floorStart) break;
    now = moveDie(rollDie(now, at.x, at.z, dir), at, next);
    at = next;
  }
  return { board: at === from ? board : now, at };
}
```

- [ ] **Шаг 4.** Зелёный.
- [ ] **Шаг 5. `boardStage.ts`.**
  - Поле: `/** A die being rolled across the board with Shift held: where it began, the board before, the cells it has gone through. */ private rolling: { from: { x: number; z: number }; before: EditBoard; cells: { x: number; z: number }[] } | null = null;`.
  - `pointerdown`, где сейчас ставится `this.pressed` (строка 86): если `event.shiftKey` — вместо `pressed` поставить `this.rolling = { from: cell, before: this.board, cells: [] }` и взять захват указателя.
  - `pointermove` (строка 91): если `this.rolling` — клетка под указателем `cell = this.cellOf(event)`; если она не последняя в `cells` и не `from`, `const tried = rollAlong(this.rolling.before, this.rolling.from, [...this.rolling.cells, cell])`; если `tried.at` равна `cell` — `this.rolling.cells.push(cell)`, `this.board = tried.board`, `this.selected = cell`, `this.present(tried.board)`. Ничего больше в этой ветке.
  - `pointerup` (строка 97): если `this.rolling` — `const done = this.board; this.board = this.rolling.before; this.rolling = null; this.change(done);` (так весь жест — один шаг отмены; `change` ничего не делает, если доска та же).
  - `dropped` и `lostpointercapture`: если `this.rolling` — вернуть `this.board = this.rolling.before`, `this.present(this.board)`, `this.rolling = null`.
  - В шапке-комментарии после «a die on the board is dragged to another cell»: «; dragged with Shift held, it rolls there cell by cell as the game rolls it (`rollAlong`)».
- [ ] **Шаг 6.** `npx vitest run src/lab`, `npm run typecheck`. Жест в браузере проверяется в задаче 9.
- [ ] **Шаг 7. Коммит:** «Расстановка: Shift и перетаскивание катят кость».

---

### Задача 9: страница `?lab=workshop`, входная страница `?lab`, старые страницы уходят

**Файлы:**
- Создать: `src/lab/workshop.ts` (страница), `src/lab/labIndex.ts` (входная страница)
- Изменить: `src/main.ts` (ветки `levels` и `library` на строках 40–49; новая ветка пустого `?lab`)
- Изменить: `src/lab/boardStage.ts` (убрать закрепление `K`, `pinned`, `setPins`, `pins`, `onPin`, `overlay`, `setOverlay`, рисунок видов решателя и импорт `Overlay`)
- Изменить: `src/lab/labFacts.ts` (оставить `Instant`, `instantOf`, `Seconds`, `secondsOf`, `spareOf`, `Later`, `laterOf`, `Ask` и `Told` только с ярусами `seconds` и `later`, `answer`; убрать `Offer`, `GEN_PLACES`, `GEN_SEEDS`, `offersOfPlace`, `offersOfBoard`, `Fixed`, ярусы `gen`, `order`, `complete`, `repair`, `improve`, `set` и ставшие ненужными импорты)
- Изменить: `src/lab/playLog.ts` (`PlayRecord.verdict?: Verdict`, тип — `import type { Verdict } from './workshopLists'`; `PlayPatch.patch` — `Pick<PlayRecord, 'rate' | 'asOrdered' | 'fresh' | 'more' | 'words' | 'verdict'>`)
- Удалить: `src/lab/levelsLab.ts`, `src/lab/libraryLab.ts`, `src/lab/orderDesk.ts`, `src/lab/boardEditor.ts`, `src/lab/libraryRows.ts`, `src/lab/libraryRows.test.ts`

**Интерфейсы:**
- Потребляет: всё из задач 1–8; `BoardStage` (`show`, `change`, `current`, `key`, `locked`, `sink`, `canvas`, `selected`); `displaySpecOf`, `editBoardOf`, `emptyBoard`, `resize`, `textOf`, `SIZE_MIN`, `SIZE_MAX` из `editBoard.ts`; `SolveClient`, `CANCELLED`; `PlayWatch`, `Inside`; `listHeads`, `readBoard`, `writeBoard`, `writeHead`, `renameBoard`, `addPlay`, `onBoardChanged`; `copyText`; `boardSvg`; `rowChapters`, `ROW`.
- Даёт: `startWorkshop(game: Game): void`, `startLabIndex(): void`; на странице — `window.viWorkshop` (сама страница, для консоли).

- [ ] **Шаг 1. `src/main.ts`.** Ветки `lab === 'levels'` и `lab === 'library'` заменить одной:

```ts
} else if (lab === 'workshop' || lab === 'levels' || lab === 'library') {
  // The workshop of the levels: the lists of the boards, the game in the middle to draw a board on and play it, and a verdict after the play.
  const game = new Game(document.getElementById('app')!);
  (window as unknown as { vi: Game }).vi = game;
  void import('./lab/workshop').then(({ startWorkshop }) => startWorkshop(game));
} else if (lab === '') {
  // `?lab` with nothing after it: the list of every lab, with what each is for.
  void import('./lab/labIndex').then(({ startLabIndex }) => startLabIndex());
```

  Перед правкой — `git fetch` и сверка `src/main.ts` с `origin/main`, как в задаче 5.
- [ ] **Шаг 2. `src/lab/labIndex.ts`.** Страница-список в DOM, цвета и шрифт из темы, по строке на лабораторию: ссылка на адрес и одна строка, что в ней.

```ts
import { PROGRAM_FONT, paletteAt, shellDefaults } from '../shell/theme';

/** The labs of the dev build, by their address, with a line of what each is for. */
const LABS: readonly { lab: string; what: string }[] = [
  { lab: 'workshop', what: 'мастерская уровней: доски, игра, отметка, правка' },
  { lab: 'board', what: 'вид поля и костей; уход группы — папка «Уход»' },
  { lab: 'juice', what: 'ответы игры: каждый удар по кнопке' },
  { lab: 'sound', what: 'звук: кнопка на каждый звук и его параметры' },
  { lab: 'shell', what: 'экраны оболочки программы' },
  { lab: 'frame', what: 'передачи: сцены сигнала' },
];

/** The page of `?lab` with nothing after it: every lab there is, a line to each. */
export function startLabIndex(): void {
  const palette = paletteAt(shellDefaults(), 0);
  const page = document.createElement('div');
  page.style.cssText = `position:fixed;inset:0;z-index:900;padding:24px;background:${palette.bg};color:${palette.ink};font:15px/1.8 ${PROGRAM_FONT}`;
  for (const { lab, what } of LABS) {
    const line = document.createElement('div');
    const link = document.createElement('a');
    link.href = `?lab=${lab}`;
    link.textContent = `?lab=${lab}`;
    link.style.cssText = `color:${palette.ink};margin-right:16px`;
    const said = document.createElement('span');
    said.textContent = what;
    said.style.color = palette.dim;
    line.append(link, said);
    page.append(line);
  }
  document.body.append(page);
}
```

  Сверить строки списка с `src/main.ts` и шапками `boardLab.ts`, `juiceLab.ts`, `soundLab.ts`, `shellLab.ts`, `lab.ts`: что открывает лаборатория передач (любое значение, кроме названных, — сейчас ей подходит `frame`).
- [ ] **Шаг 3. `src/lab/workshop.ts` — каркас и списки.** Класс `Workshop`, `startWorkshop(game)` кладёт его в `window.viWorkshop`. Образцы: `src/lab/libraryLab.ts` (построение DOM, `field`, `button`, `load`, `reread`, `typed`) и `src/lab/levelsLab.ts` (связь `BoardStage` с игрой и файлом: методы `present`, `edited`, `text`, `read`, `save`, `open`, `load`, `keepWay`, `changedOutside`, `togglePlay`, `watch`, `measure`). Перенести из них только названное в этой задаче; версии, сравнение, заказ, связки, галерею, виды решателя, слепой режим, закрепление, оценки огонь/норм/мимо, снимок `N` — не переносить.
  - Разметка (рабочая, без своего вида): слева фиксированная колонка `LIST_WIDTH = 320` px — вкладки `LISTS` (щелчок переключает), поле поиска, строки (`boardSvg(spec, { cell: 9 })` картинкой, имя, последние слова), у списка «новые» — строка пачки `batchTitle` над её досками; под списками — «новая доска»: поле слова и кнопка. `#app` сдвинут на `LIST_WIDTH` влево (`app.style.left`, как в `libraryLab.ts`, строка 95). Над игрой — слой `BoardStage`: родитель — фиксированный `div` `left:LIST_WIDTH; top:0; right:0; bottom:0`. Сверху над полем полоса: имя доски (поле, `Enter` — переименовать), сторона «−» и «+», рабочие грани — шесть переключателей 1–6, свёрнутый `<details>` «правила доски» (пол закрыт, `sink`, `lift`). Снизу полоса: кнопки «играть (E)», «показать решение (V)», «проверить (C)», «копировать для чата»; под ними место строк «проверить», полоса отметки (раздел 3.5 спеки) и строка сообщений.
  - Постройка: `this.inside = game as unknown as Inside`; `game.awake = true`; `this.inside.audio.setAway(true)` вне партии (как сейчас); `onBoardChanged(name => void this.changedOutside(name))`; `window.addEventListener('beforeunload', () => void this.save())`.
  - Списки: `listHeads()` → `rowOf(file, rowChapters(ROW))`; показ — `listRows(rows, this.list, this.search)`; список «новые» — `batchesOf`.
  - Открытие доски по щелчку — `open(name)`, как `levelsLab.open` и `load` (строки 938–998), без версий, заказа и слепого режима. `?lab=workshop&board=<имя>` открывает её сразу (`boardNameOf`), иначе — первую из «новых», иначе первую из «все».
  - «Новая доска»: слово проверяется `BATCH_WORD`; имя — `<слово>-<n>`, первый свободный номер среди имён; голова — `newHead(name)` из `levelsLab.ts` (строки 48–50; перенести функцию); `textOf(emptyBoard(4), head, { status: 'D' })`, `writeBoard`, перечитать списки, открыть.
- [ ] **Шаг 4. Поле, размер, грани, правила, имя.**
  - `this.editor = new BoardStage(stageBox, (x, z, y) => game.cellPoint(x, z, y), () => this.edited(true), (board) => this.present(board))` — после задачи 9 у `BoardStage` нет параметра `onPin`.
  - «−» и «+» — `this.editor.change(resize(this.editor.current, size ± 1))` в пределах `SIZE_MIN..SIZE_MAX`.
  - Грани: переключатель меняет `head.faces` и `head.values` (не пусто: последнюю грань снять нельзя) и зовёт `edited(true)` и `present`, как `levelsLab.headChanged` (строки 645–658); там же пол, `sink`, `lift`.
  - Имя: `Enter` в поле имени — `await this.save()`, `await renameBoard(this.name, to)`; при успехе `this.name = to`, перечитать списки, открыть `to`; при отказе — текст отказа в строке сообщений, поле вернуть к прежнему имени.
- [ ] **Шаг 5. Игра и отметка.**
  - `E` — `togglePlay`, как `levelsLab.togglePlay` (строки 1043–1066), без `gui`, `badge`, `setRun`; `watch` — как `levelsLab.watch` (строки 1069–1076) без заказа.
  - `PlayWatch` после записи партии: `addPlay(name, record)`; запомнить `this.lastPlay = { name, at: record.at, wasNew: row?.head.status === 'N' }`; показать полосу отметки.
  - Полоса отметки: кнопки «1 хорошая», «2 доделать», «3 убрать», поле слов, «записать». Клавиши `1`/`2`/`3` (`Digit`/`Numpad`) работают, пока полоса показана, и вне поля ввода; выбор подсвечивается и ставит фокус в поле слов; `Enter` пишет.
  - Запись: `const patch = verdictPatch(row.head.status, verdict, words, today())`; null — ничего не делать; иначе `writeHead(name, patch)`, затем, если доска только что сыграна (`lastPlay.name === name`), `addPlay(name, { at: lastPlay.at, patch: { ...(verdict ? { verdict } : {}), ...(слова ? { words: слова } : {}) } })`. Следующая доска берётся до записи: `const next = nextInBatch(this.rows, name)`; после записи на доске, бывшей `N`, открыть `next`, если он есть.
- [ ] **Шаг 6. Клавиши.** Как в `levelsLab.ts` (строки 188–226): ловить `keydown` и `keyup` на `window` в фазе захвата; клавиша в поле ввода — полю; `1`–`3` и `Enter` полосы отметки — первыми; `E` — играть / расставлять; вне партии `V` и `C` — задача 10; вне партии остальное — `this.editor.key(event)`, игре ничего; в партии — игре.
- [ ] **Шаг 7. Копия для чата:** `copyText(\`\${name} — поставить на место: …\\n\${this.text()}\`)`; в строке сообщений «скопировано» или «не вышло скопировать».
- [ ] **Шаг 8. `boardStage.ts`, `labFacts.ts`, `playLog.ts`** — правки из перечня «Файлы» этой задачи. В `boardStage.ts` клавиша `K` и метка `K` над костью уходят; рисунок `overlay` (строки 385–436) уходит целиком.
- [ ] **Шаг 9. Удаление.** `git rm src/lab/levelsLab.ts src/lab/libraryLab.ts src/lab/orderDesk.ts src/lab/boardEditor.ts src/lab/libraryRows.ts src/lab/libraryRows.test.ts`. `npm run typecheck` — всё, что ссылалось на них, найдено и поправлено (ожидаются только `main.ts` и `labFacts.ts`). Модули `src/levels/orders.ts`, `orderSearch.ts`, `sets.ts` остаются: их зовут команды `level.mjs`.
- [ ] **Шаг 10. Проверки:** `npx vitest run --maxWorkers=3`, `npm run typecheck`, `npm run build`; в сборке нет слов `workshop`, `lab=` в основном чанке: `grep -l "viWorkshop" dist/assets/*.js` — пусто (лаборатории грузятся только при `import.meta.env.DEV`).
- [ ] **Шаг 11. Preview** (приём «Смотреть worktree» в общих рамках), 1920×1080:
  1. `?lab` — список шести лабораторий, ссылки открываются.
  2. `?lab=workshop` — пять вкладок; поиск по `P13` находит доску по `was` (если переименования ещё нет — по имени); щелчок ставит доску на поле; на экране нет ни одного числа о доске.
  3. «новая доска» со словом `wt-try` → `wt-try-1` на поле 4×4; «+» даёт 5×5; кость из списка ставится; `Shift`+перетаскивание катит её, грани меняются; `Ctrl+Z` отменяет весь жест одним шагом; файл в основной папке `boards/wt-try-1.txt` пишется (`fetch('/__boards/wt-try-1')`).
  4. Нет паузы: `Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange'))`, потом то же с `false` — окна паузы нет (`vi.paused === false` через консоль, если поле доступно, иначе по снимку).
  5. На `wt-try-1` (дать ей старт и кость, чтобы она решалась) `E`, сыграть до конца клавишами (`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }))` и `keyup`), `2`, слово, `Enter` → в `fetch('/__boards/wt-try-1')` видны `status: D` и `words: <дата>: …`. Отметку на доске ряда в preview **не** записывать (это файл основной папки): её держат тесты `verdictPatch` (задача 6) и `patchHead` (задача 2).
  6. Правка снаружи: пока на `wt-try-1` идёт правка, `fetch('/__boards/wt-try-1', { method: 'PUT', body: <тот же текст с другой заметкой> })` — правка в руках не теряется; без правки в руках страница перечитывает файл и показывает новую заметку.
  7. «копировать для чата» — в буфере имя, строка «поставить на место: …» и файл.
  8. Снимок экрана — владельцу в отчёт.
  После проверки: удалить `wt.html`; сказать владельцу, какие `boards/wt-*.txt` легли в основную папку, чтобы он или её чат их убрал.
- [ ] **Шаг 12. Коммит:** «Мастерская уровней ?lab=workshop вместо levels и library».

---

### Задача 10: «показать решение» и «проверить»

**Файлы:**
- Изменить: `src/lab/workshop.ts`

**Интерфейсы:**
- Потребляет: `checkLines`, `SolveClient<{ tier: 'seconds'; spec }, Seconds>` и `<{ tier: 'later'; spec }, Later>`, `instantOf`, `Game.press`, `moveOf` (`src/rules/levelSolver.ts`).

- [ ] **Шаг 1. Счёт по нажатию.** `measure()` — как `levelsLab.measure` (строки 711–737), но спрашивает воркеры только когда открыт «проверить» или нажато «показать решение»; правка доски отменяет оба вопроса (`cancel`) и сбрасывает факты; ответ к доске, которой уже нет, отбрасывается (ключ `printBoard(normalSpec(spec))`, как там).
- [ ] **Шаг 2. «Проверить» (`C` и кнопка).** Переключает показ; при показе — `checkLines(this.instant, this.seconds, this.later)` строками под полем; строки обновляются, когда приходят факты.
- [ ] **Шаг 3. «Показать решение» (`V` и кнопка).** Вне партии. Если правила доску не принимают — строка ошибки, ничего больше. Ждать `seconds` (строка «решаю…»). Путь: `spec.solution`, если `seconds.check.kept === 'same'`, иначе `seconds.check.way`; нет пути — строка «решения нет» или «решатель сдался». Иначе: `this.showing = true`, `this.game.playBoard(spec)` (без `PlayWatch`: это не партия владельца), `this.inside.audio.setAway(false)`, затем каждые `SHOW_MOVE_MS = 600` мс — `this.game.press(moveOf(way[i]).dir)`; после последнего хода — остановка. Любая клавиша, кроме `E`, во время показа — остановка таймера (доска остаётся, где была); `E` — остановка и возврат к расстановке, как выход из партии в `togglePlay` (без записи партии).
- [ ] **Шаг 4.** `npm run typecheck`, `npx vitest run --maxWorkers=3`, `npm run build`.
- [ ] **Шаг 5. Preview:** на `R03` (доска ряда, только чтение) — `C` показывает строки; минимум и путь совпадают с `node scripts/level.mjs check file=R03` в worktree (решается за столько же ходов; «записанный путь: держит минимум»); `V` проигрывает путь до очищенной доски; на середине `V` ещё раз и любая клавиша останавливают; `E` возвращает расстановку; на `wt-try-1` без старта `V` говорит, почему нельзя.
- [ ] **Шаг 6. Коммит:** «Мастерская: показать решение и проверить по нажатию».

---

### Задача 11: имена досок вне ряда

**Файлы:**
- Создать (не в git): `boards/.history/rename-2026-10-16.json` — карта `{ "старое": "новое" }`
- Изменить: 259 файлов `boards/*.txt` вне ряда (командой), `src/levels/boardSets.ts` (имена `PARKED_CODES` и `SPARE_NAMES` по карте)

- [ ] **Шаг 1. Перечень.** `node -e` по `boards/row.json` и `boards/*.txt`: имена вне ряда, их `origin`, `tags`, `note`, последние `words`. Таблицу — в scratchpad, не в репозиторий.
- [ ] **Шаг 2. Карта.** Имя — `<замысел>-<n>`: замысел — одно-два английских слова через дефис, малыми буквами (`BATCH_WORD`), `n` — номер внутри замысла с 1. Откуда замысел: `tags`, `note`, `origin` и слова владельца файла; для досок пробы, которые владелец сыграл (`P01`–`P22` и их резерв `P..._s…`), — то, что он сам о них сказал (слова в файле), и место-образец, если оно названо в `origin`. **Нейтральные имена** — по происхождению, без замысла: доски из `BLIND` в `src/levels/labText.ts` (`P23`–`P30`, кроме стоящей в ряду `P24`) и их резерв — `probe-23`, `probe-23-2`…; доски актов `K17`, `K21`, `K22`, `K23`, `K25`, `K28` — `act-k17`…; доска, о замысле которой ничего не сказано, — по происхождению: `course-…` (`T`), `ladder-…` (`B`), `road-e<редакция>-…` (`R…e…`), `chapter1-…` (`C1…`, `C10…`). Доски ряда (25 кодов `boards/row.json`) в карту не входят.
- [ ] **Шаг 3. Сухая проверка:** `node scripts/library.mjs rename map=boards/.history/rename-2026-10-16.json` выполняет `renameFaults` до записи: ошибки — поправить карту.
- [ ] **Шаг 4. Переименование** той же командой; затем `src/levels/boardSets.ts`: каждое имя `PARKED_CODES` и `SPARE_NAMES` заменить по карте (комментарии шапки файла дополнить: «the files took names by their idea on 16 October 2026; the old names are in their `was:`»).
- [ ] **Шаг 5.** `npx vitest run --maxWorkers=3`, `npm run typecheck`, `node scripts/library.mjs check`, `node scripts/level.mjs regress` — зелёные (у `regress` прежние расхождения — те же, что в задаче 0). `grep -rn "fileBoard('" src` — каждое имя ещё находится (по имени или по `was`).
- [ ] **Шаг 6.** Карту показать владельцу списком в отчёте (старое → новое, только имена) — до коммита: имена — то, что он будет видеть каждый день. Правки по его слову — в карту и шаги 3–5 заново (переименование уже переименованных — по новой карте с теми же проверками).
- [ ] **Шаг 7. Коммит** (после его «да» на имена): «Доски вне ряда — имена по замыслу; прежние в was».

---

### Задача 12: документы

**Файлы:**
- Изменить: `docs/VI_Levels_Lab.md` (истина), `README.md`, `docs/README.md`, `boards/README.md`, шапки `docs/superpowers/specs/2026-10-14-vi-level-generator-design.md`, `docs/superpowers/specs/2026-10-14-vi-board-library-design.md`, `docs/superpowers/specs/2026-10-12-vi-levels-lab-2-design.md`, `docs/superpowers/specs/2026-10-15-vi-level-workshop-design.md`, `docs/art/VI_Interface_Layer.md` (если в нём названы `?lab=levels` или `?lab=library`), `docs/ROADMAP.md` (если в нём названы они же).

- [ ] **Шаг 1.** `git fetch`; если `docs/VI_Levels_Lab.md` в `origin/main` менялся после начала работы — `git rebase origin/main` до правки и перечитать страницу.
- [ ] **Шаг 2. `docs/VI_Levels_Lab.md`.** Номера разделов сохраняются (на них ссылаются другие документы).
  - Шапка «Что живёт в коде»: убрать `src/lab/levelsLab.ts`, `src/lab/boardEditor.ts`, `src/lab/orderDesk.ts`, `src/lab/libraryLab.ts`, `src/lab/libraryRows.ts`, `scripts/library-words.json`; добавить `src/lab/workshop.ts`, `src/lab/workshopLists.ts`, `src/lab/checkLines.ts`, `src/lab/labIndex.ts`. «Проверено: <дата>».
  - Раздел 1: статус `N` в таблицу статусов; ключи `batch`, `was` в образец файла и в порядок ключей; прежние имена — абзацем (раздел 5.3 спеки).
  - Раздел 2: `file=` находит и по `was`; `gen` и `order` — ключ `batch=`.
  - Раздел 4 — «Мастерская `?lab=workshop`» (заменяет «Страница `?lab=levels`»): списки, расстановка (жесты прежние и катание `Shift`), размер, грани и правила доски, имя и переименование, «новая доска», `E`, отметка после партии, копия для чата, нет паузы; `?lab=levels` и `?lab=library` ведут сюда; входная страница `?lab`. Подраздел «Файлы: плагин дев-сервера» — с адресом `rename` и `status` в `PUT …/head`; адреса `history`, `version`, `?export` — остаются у сервера, страница их не зовёт.
  - Раздел 5 — «Проверить»: строки `checkLines`, ярусы прежние, по нажатию; лента партитуры убрана.
  - Раздел 6: снимок `N` убран; отметка «хорошая / доделать / убрать» вместо оценки; партии — как были.
  - Раздел 7 — одна строка: «Виды решателя и слепой режим убраны со страницы 16 октября 2026 (спека мастерской)».
  - Раздел 8: версии по-прежнему пишет сервер; на странице их нет; сравнение — командой `diff`.
  - Раздел 9: страница — убрать папку «Генерация»; команды — с `batch=`.
  - Разделы 11–14: команды `order`, `complete`, `repair`, `improve`, `set`, `ratings` — как были; абзацы о панели («Папка «Заказ»», клавиши `K`, `Y`/`N`/`U`/`M`, «Связка» на странице, выдача на поле, `OrderDesk`) — заменить строкой «на странице этого нет с 16 октября 2026; команды остались».
  - Раздел 15: «Страница `?lab=library`» → «страница — мастерская, раздел 4»; `import` убран; `rename`, `history`, `list batch=`.
  - «Что вышло иначе» — дописать то, что вышло иначе в этой работе.
- [ ] **Шаг 3. `README.md`** (корень): строку о лабораториях в таблице структуры — `?lab=workshop` (мастерская уровней), `?lab` — список лабораторий.
- [ ] **Шаг 4. `docs/README.md`:** строку спеки мастерской — «построено <дата>, v<версия>»; две одинаковые строки `VI_Levels_Lab.md` — одна; абзац команд уровней: `?lab=workshop`, `library.mjs list | check | export | rename | history`, `level.mjs … batch=`. Строка плана уходит в задаче 13.
- [ ] **Шаг 5. `boards/README.md`:** страница — `?lab=workshop`; статус `N`; имена по замыслу, прежние в `was`.
- [ ] **Шаг 6. Шапки решений.** Спека генератора: в «Что заменило» — «расширена спекой мастерской (ссылка `2026-10-15-vi-level-workshop-design.md`, раздел 6): размер заказа, имена и статус файлов, кнопка «ещё десять», отметки». Спеки библиотеки и второй сборки лаборатории: «страница заменена мастерской 16 октября 2026». Спека мастерской: статус «построено <дата>, v<версия>; что вышло иначе — план, раздел в конце».
- [ ] **Шаг 7.** `grep -rn "lab=levels\|lab=library" docs README.md boards src scripts` — в истинах и коде упоминания только как «ведёт на мастерскую» или в датированных решениях.
- [ ] **Шаг 8.** `node scripts/docs-check.mjs` — чистый; `npx vitest run --maxWorkers=3`, `npm run typecheck`, `npm run build`.
- [ ] **Шаг 9. Версия.** Поднять версию в `package.json` на одну последнюю цифру, как делают соседние коммиты (`git log -5 --format=%s -- package.json`); если версия держится ещё где-то (поиск по старому номеру), поправить и там.
- [ ] **Шаг 10. Коммит:** «Документы: мастерская уровней, версия <версия>».

---

### Задача 13: отчёт и публикация

- [ ] **Шаг 1.** Ревью всей ветки (superpowers:requesting-code-review, свежий рецензент, модель Opus) против спеки и раздела «Что проверить сверх тестов задач»; найденное — поправить или записать в «Что вышло иначе».
- [ ] **Шаг 2. План в историю.** Статус плана — «выполнен», раздел «Что вышло иначе» заполнен; коммит. Затем `git rm docs/superpowers/plans/2026-10-15-vi-level-workshop.md`, строку плана из таблицы «Уровни» индекса убрать, в таблицу «В истории git» индекса — строку по образцу соседних: путь, «план мастерской уровней, выполнен (v<версия>), с разделом «Что вышло иначе»; достать — `git show <коммит>:<путь>`», где коммит — предыдущий, в котором план ещё лежит; «Что заменило» — `VI_Levels_Lab.md`, спека мастерской. `node scripts/docs-check.mjs`; коммит «План мастерской выполнен: из дерева в историю индекса».
- [ ] **Шаг 3.** Отчёт владельцу коротко: что построено, снимок страницы, карта имён (если не показана в задаче 11), какие `boards/wt-*.txt` лежат в основной папке, что не проверено. Вопрос: «пуш?».
- [ ] **Шаг 4.** После его «пуш»: `git fetch`, `git rebase origin/main`, `npx vitest run --maxWorkers=3`, `npm run typecheck`, `npm run build`, `node scripts/library.mjs check`, `node scripts/docs-check.mjs`, `git push origin HEAD:main`. Сказать: основная папка подтягивается `git pull --ff-only` её чатом; после этого там один раз `node scripts/library.mjs history` — история партий досок переедет под новые имена.

## Что вышло иначе

(Заполняет исполнитель по ходу: отступления от плана и спеки, с причиной.)
