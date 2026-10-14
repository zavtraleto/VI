# Библиотека досок: файлы как истина, наполнение из истории, страница `?lab=library`

> Вид: план. Статус: не выполнен. Дата: 2026-10-14.
> Что заменило: —. Что живёт в коде: после выполнения — src/levels/boardFile.ts, scripts/library.mjs, scripts/library-words.json, src/levels/library.ts, src/levels/library.test.ts, src/lab/libraryLab.ts, src/lab/lab.ts, vite.boards.ts, boards/.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Все доски, когда-либо сделанные, лежат файлами в `boards/` с подписями, статусом и словами владельца; страница `?lab=library` показывает их таблицей, даёт сыграть, оценить, написать и выгрузить текст для чата; тест держит файлы и ряд кампании в согласии.

**Architecture:** Формат файла доски расширяется четырьмя полями головы (`origin`, `mark`, `words`, `tags`) и новым словарём `status`. Скрипт `scripts/library.mjs` наполняет папку из git-истории (разбор `LevelSpec` из старых `road.ts`/`levels.ts` через `vite-node`, как делают остальные скрипты) и переносит слова владельца из `scripts/library-words.json`. Чистые функции над файлами и `CHAPTERS` — в `src/levels/library.ts`; страница — `src/lab/libraryLab.ts`, переиспользует постановку доски и запись партии из `src/lab/levelsLab.ts`; запись оценки в файл — через плагин дев-сервера `vite.boards.ts` (уже пишет файлы и версии).

**Tech Stack:** TypeScript, Vite, vitest; `vite-node` в скриптах (`scripts/level.mjs` — образец загрузки `src`); плагин `vite.boards.ts`.

**Spec:** [2026-10-14-vi-board-library-design.md](../specs/2026-10-14-vi-board-library-design.md) — целиком; формат файла и страница лаборатории — [VI_Levels_Lab.md](../../VI_Levels_Lab.md), разделы 1, 4, 6; ряд — [спека кампании, вторая редакция](../specs/2026-10-14-vi-campaign-2-design.md), раздел 7 (`CHAPTERS`, `STOPS` в `src/levels/chapters.ts` — после шага 1 второй редакции; до его публикации ветка `claude/campaign2-step1-03c162`: читать оттуда, в `main` ещё акты).

## Global Constraints

- Свой worktree от `origin/main`; в основную папку не писать; публикация после «ок» владельца. Работа идёт параллельно сессии кампании (ветка `campaign2-step1`): **не трогать** `src/levels/levels.ts`, `src/levels/road.ts`, `src/levels/chapters.ts`, `src/levels/campaign.ts`; библиотека только читает их. Если `chapters.ts` в `main` ещё нет — читать `ROLES`/`CAMPAIGN` из `campaign.ts` и предусмотреть `CHAPTERS` через необязательный импорт (функция `placeOf(id)` принимает ряд параметром).
- `src/rules` не трогать. Новых элементов интерфейса игрока нет: страница — лаборатория, только дев-сборка.
- Файлы `boards/` — текст в формате `boardFile.ts`; `parseBoard`/`printBoard` остаются обратимыми (тест есть).
- Коммит на задачу; проверки `npm test`, `npm run typecheck`, `node scripts/docs-check.mjs`, `node scripts/library.mjs check`.

## Review Focus

1. **Один код — разные доски в редакциях дороги** (`R07` второй редакции ≠ `R07` пятой): импорт не должен перезаписать одну другой. → Задача 2, тест на суффиксы `R07e2`.
2. **Файл, которого нет в коде, со статусом `R`** и доска ряда без файла — красный тест `check`. → Задача 3.
3. **Запись оценки с страницы** не должна плодить версии в `.history` на каждое нажатие (версия пишется, когда меняется доска, а не голова) — `mark`/`words` правят только голову. → Задача 4, тест плагина.
4. **Старые файлы со статусами `idea|work|good|fire|miss`** читаются и переводятся; `parseBoard` старого файла не падает. → Задача 1.
5. **Выгрузка** — текст по спеке, раздел 3, с датой, в буфер и в `boards/.history/export-<дата>.md`; пустой сеанс — текст с одной строкой «ничего не оценено». → Задача 4.

---

### Task 1: Поля головы файла и статусы

**Files:** `src/levels/boardFile.ts`, `src/levels/boardFile.test.ts`, `docs/VI_Levels_Lab.md` (раздел 1)

- [ ] **Step 1: Тесты** — `parseBoard` читает `status: RC`, `origin: проба 7 октября`, `mark: огонь`, две строки `words: 2026-10-12: …`, `tags: мост накат`; `printBoard` печатает их обратно в том же порядке; старый `status: fire` читается как `RC` с `mark: огонь` (`good` → `RC`/`норм`, `miss` → `X`/`мимо`, `idea`/`work` → `D`) и в `printBoard` выходит уже новым; неизвестный статус — ошибка `status: … is none of D RC R X`.
- [ ] **Step 2: Реализация** — `BoardStatus = 'D' | 'RC' | 'R' | 'X'`; `BoardHead` получает `origin?`, `mark?: 'огонь' | 'норм' | 'мимо'`, `words: { date: string; text: string }[]`, `tags: string[]`; `KEYS` дополняются; перевод старых статусов — в `parseBoard` с пометкой в возвращаемом объекте (`migrated: true`), чтобы страница и `check` могли переписать файл.
- [ ] **Step 3:** `npx vitest run src/levels/boardFile.test.ts`; раздел 1 лаборатории — новые поля и словарь статусов (слово владельца 14 октября); коммит «Файл доски: статусы D/RC/R/X, origin, mark, words, tags».

---

### Task 2: Наполнение из истории и слова владельца

**Files:** `scripts/library.mjs` (новый), `scripts/library-words.json` (новый), `src/levels/library.ts` (чистые функции: `fileOfSpec(spec, origin)`, `sameBoard` из `variety.ts`, `codeWithEdition`), `src/levels/library.test.ts`

- [ ] **Step 1: `library-words.json`** — массив `{ code, date, text }`, собранный дословно из [плейтеста 12 октября](../../VI_Levels_Playtest_2026-10-12.md) (раздел 1, по номерам → коды через таблицу раздела 2), [слов владельца](../../VI_Owner_Words.md) (дорога 11 и 12 октября, по кодам `R..` редакций 2 и 3), [исследования](../../VI_Campaign_Language_Research.md) (2.3 — места 1–21 ряда 0.2.53 → коды по таблице 2.1; 2.5 — места 1–21 ряда 0.2.58 → коды по `CHAPTERS` ветки шага 2). Там, где номер в словах относится к доске, которой уже нет под этим кодом (редакция дороги), — код с суффиксом редакции.
- [ ] **Step 2: `library.mjs import`** — источники по спеке, раздел 4 (таблица): `HEAD` — `ROAD`, `ROAD_SPARES`, `LEVELS`, `PARKED`, `SPARES` (загрузка через `vite-node`, как `level.mjs`); коммиты — `git show <коммит>:<путь>` во временный файл и загрузка его как модуля (`vite-node` умеет путь; если нет — `node --import` с транспиляцией через `esbuild`, который уже в зависимостях Vite); каждую доску — `printBoard` в `boards/<код>.txt` со `status` (`R`, если в ряду `HEAD`; иначе `RC` для досок, которые владелец отметил «огонь»/«норм»/«ок», `X` для «мимо», `D` для остальных), `origin`, `words`. Доска, уже лежащая файлом, не перезаписывается: добавляются только отсутствующие поля (`merge`). Одинаковые доски (`sameBoard`) разных редакций — один файл, `origin` перечисляет редакции; разные доски под одним кодом — суффикс `e<редакция>`.
- [ ] **Step 3: `list`, `check`, `export`** — `list [status=] [chapter=]` таблица в терминал; `check` — для каждой доски кода есть файл с теми же костями и путём, для каждого файла `R` — доска в ряду, статусы старого словаря переписаны; `export [since=дата]` — текст по спеке, раздел 3.
- [ ] **Step 4: Тесты** — `library.test.ts`: `codeWithEdition`, `merge` головы, `fileOfSpec` даёт файл, который `parseBoard` читает в ту же доску; `check` на текущем дереве — после импорта чист (это и есть приёмка задачи). Запуск `node scripts/library.mjs import` — записать в «Что вышло иначе» число досок по источникам.
- [ ] **Step 5:** коммит «Библиотека досок: импорт из истории, слова владельца, list/check/export».

---

### Task 3: Тест согласия файлов и ряда

**Files:** `src/levels/library.test.ts` (дополнить), `src/levels/library.ts`

- [ ] `it('every board of the row has a file with status R, and every R file is in the row')` — читает `boards/*.txt` через `fs` в тесте (vitest, node), сверяет с `CAMPAIGN`; `it('every board of the code has a file with the same dice and way')`. Красный тест называет код. Коммит «Библиотека: тест согласия файлов и ряда».

---

### Task 4: Страница `?lab=library`

**Files:** `src/lab/libraryLab.ts` (новый), `src/lab/lab.ts` (вход), `src/lab/levelsLab.ts` (вынести постановку доски и запись партии в функции, которые зовут обе страницы — без изменения поведения `?lab=levels`), `vite.boards.ts` (новый адрес `PUT …/head` — правка головы без версии; `GET …/list` — список файлов с головами), `src/lab/boardsServer.ts` (разбор адресов), `src/lab/boardsClient.ts`, тесты `boardsServer.test.ts`, `libraryLab.test.ts` (чистые части: сортировка, фильтры, текст выгрузки)

- [ ] **Step 1: Данные** — `GET /boards/list` отдаёт `{ name, head, hash }[]`; страница считает `place` из `CHAPTERS`/`CAMPAIGN` и паспорт из яруса «секунды» (`secondsOf`, как `?lab=levels`, лениво по строке).
- [ ] **Step 2: Таблица** — столбцы по спеке, раздел 2, пункт 5; фильтры и сортировка — чистые функции с тестами; картинка `boardSvg` в строке.
- [ ] **Step 3: Игра и оценка** — щелчок по строке ставит доску (функция из `levelsLab.ts`); после партии клавиши `1`/`2`/`3` и поле слов, `Enter` пишет `mark` и `words` (`PUT …/head`) и строку в `plays.jsonl`.
- [ ] **Step 4: Выгрузка** — кнопка «выгрузить»: текст сеанса (все оценённые с открытия страницы) в буфер (`src/lab/clipboard.ts`) и в `boards/.history/export-<дата>.md` через плагин.
- [ ] **Step 5: Preview** — `?lab=library` на 1920×1080: таблица, фильтр `status=RC`, сыграть одну доску, оценить, выгрузить; файл доски получил `mark` и `words`, версии в `.history` не прибавилось.
- [ ] **Step 6:** коммит «Лаборатория: страница библиотеки досок».

---

### Task 5: Документы и «ок»

- [ ] [VI_Levels_Lab.md](../../VI_Levels_Lab.md): раздел 1 (сделано в задаче 1), новый раздел «Библиотека» (страница, команды, статусы, что считается местом); [docs/README.md](../../README.md): команды `library.mjs`, строка плана; [ROADMAP.md](../../ROADMAP.md): строка «Библиотека досок» в разделе «Лаборатория уровней»; спека — шапка «построено».
- [ ] Проверки; версия не поднимается (инструмент разработки); спросить «ок?» на пуш; после «ок» — rebase, проверки, `git push origin HEAD:main`. Если к тому времени кампания второй редакции опубликована — `check` на `main` после rebase должен быть чист, иначе поправить статусы файлов под ряд.

## Что вышло иначе

Заполняется исполнителем.
