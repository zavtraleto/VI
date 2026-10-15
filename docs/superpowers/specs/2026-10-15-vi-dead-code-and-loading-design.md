# VI — мёртвый код и быстрая загрузка

> Вид: решение. Статус: в силе. Дата: 2026-10-15. Решения владельца приняты 15 октября 2026 в чате Fable; спека принята владельцем 15 октября 2026, ответы — в начале раздела 9; план — docs/superpowers/plans/2026-10-15-vi-dead-code-and-loading.md; мёртвый код (разделы 3, 7 — коммиты 1–5) в работе. Загрузка (разделы 4–6, Ч0–Ч5) отложена словом владельца 15 октября 2026: «давай притормозим с разбиванием на чанки, ведь загрузка пока не является проблемой»; её замеры и план остаются здесь до его слова.
> Что заменит: пункты «Решено удалить» в docs/ROADMAP.md (обучение Endless, пазлы, ворота глав, сеанс дня). Что будет жить в коде: vite.config.ts, src/main.ts, src/app/game.ts, src/shell/, src/signal/, src/ui/, src/rules/, src/platform/settings.ts, scripts/load-bench.mjs.

Исполнитель читает эту спеку и файлы, названные в разделах 3 и 7. Весь проект заново не изучается. Строки `файл:N` — по дереву `26c8a10` (v0.2.61); к началу работы они могут сдвинуться, искать по имени.

## 1. Что решено

Слова владельца 15 октября 2026 (чат Fable):

- **Мёртвый код** — всё, до чего нельзя дойти ни из продакшн-входа игры (меню и то, что из него достижимо), ни из инструментов разработки, которыми владелец пользуется: лаборатории `?lab=levels`, `library`, `shell`, `board`, `juice`, `sound`; скрипты `scripts/*.mjs`; тесты этого живого кода.
- **Уходит точно**, по слову «удалить всё, чего нет в меню»: сеанс дня (`LIMITED`, таблица `timed`), обучение Endless (`?tutorial`), пазлы (`?tasks`), ворота глав и `?gates=off`, и всё, что держится только ради них. Судьба кода сеанса дня, которая с 8 октября стояла «не решена», решена: удалить. Старый код остаётся в истории git.
- **Загрузка**: «игра грузится очень быстро». Цель в числах — раздел 6, её утверждает владелец.

Порядок: спека → «ок» → план → «ок» → код. Удаление — отдельным коммитом на режим, каждый зелёный (`npm test`, `npm run typecheck`, `npm run build`); потом чанки; потом замеры после, в README.md.

## 2. Как искалось

- **knip** (`npx knip@5`, конфиг вне репозитория: входы — `src/main.ts`, воркеры, `src/lab/*.ts`, `scripts/*.mjs`, `platforms/**`, конфиги vite, тесты vitest). Вывод — приложение А. Пользы от него немного: режимы, которые удаляются, достижимы из `game.ts` по адресу (`?tasks`, `?tutorial`), и knip их живыми и считает.
- **Состав продакшн-сборки** — список модулей каждого чанка, снятый плагином при `vite build`, и **граф импортов** (статические, `import()`, воркеры, пути `runnerImport` скриптов): кто до какого файла доходит — сборка, лаборатория, скрипт, только тест. Итог — приложение Б.
- **Четыре прохода по режимам** (grep по `daily`, `timed`, `LIMITED`, `tutorial`, `tut_`, `exercise`, `puzzle`, `tasks`, `tier_`, `gate`, `locked` и др. с чтением веток). Их итог — раздел 3.

## 3. Что удаляется, по коммитам

Общее для всех четырёх:

- Сохранения не ломаются. Настройки — один JSON `vi.settings.v3`, `loadSettings` сливает его поверх значений по умолчанию и лишние поля терпит. Лишние поля старых сохранений (`puzzle`, `tutorialDone`, записи `runs.timed*`) снимаются при загрузке так же, как уже снимается `levels.fixedSaid` (`src/platform/settings.ts`, `delete …`), — см. вопрос 9.8. Партия сеанса дня, сохранённая уходом со страницы (`vi.run.v1`, `kind: 'timed'`), перестаёт читаться и выбрасывается тем же путём, что и любая непригодная.
- Ключ перевода удаляется во всех семи словарях сразу: `src/ui/i18n.ts` (ru, en) и `src/ui/lang/{de,es,fr,pt,tr}.ts` — `TextKey` выводится из русского.
- Правила Endless не меняются: все удаляемые ветки симуляции стоят под `mode === 'timed' | 'practice' | 'puzzle'` или `state.tutorial | state.puzzle`, которые в живой игре всегда ложны. `RULES_VERSION` остаётся `0.9`. Проверка — `npm test` (ботам Endless и детерминизму темпа) и `node scripts/pace.mjs` до и после с тем же выводом.
- Документы правятся в том же коммите (раздел 8); после — `node scripts/docs-check.mjs`.

### 3.1. Коммит 1 — сеанс дня (`LIMITED`, `timed`)

В меню его нет с 4 октября (`d1a738b`); `startRun('timed')` никто не вызывает. Достижим только вкладкой `LIMITED` журнала, сохранённой партией и самой симуляцией.

**Файлы целиком:** `src/app/daily.ts` (`Day`, `dayAt`, `dailyValue`, `readDailyValue`), `src/app/daily.test.ts`.

**Правки:**
- `src/app/archive.ts` — `DAILY`, `EARLY`, `EARLY_STEP`, `ARRIVAL_POWER`, `DAY_SWING`, кэш `daily`, `dailyArchive`, импорт `ARCHIVE_TIMED` и `Day`. Общее с `PROTOCOL` (`PLAYERS`, `JOIN_MS`, `DAY_MS`, имена, `endlessArchive`) остаётся.
- `scripts/archive.mjs` — параметр `timed`, сиды `70_000…`, экспорт `ARCHIVE_TIMED` в шаблоне, слова «обе таблицы». `src/app/archiveData.ts` переписывается скриптом (`node scripts/archive.mjs`), не руками; числа `ARCHIVE_ENDLESS` не меняются (свои сиды). Минус 1,4 КБ из 3,4.
- `src/app/game.ts` — `RunKind`/`SCORED` без `timed` (журнал — одна таблица `endless`), `day`, `lastClock` и блок тиканья часов, ветки `timed` в `bestScore`, `recordKey`, `startRun`, `players`, `log`, `showRecords`, `share`, `showResult` (заметки `dailyBest`/`dailyNote`, `dailyValue` в отправке счёта, `summary.day`, `endReason === 'time'`), проверки `mode === 'endless' || mode === 'timed'` → `=== 'endless'`. Дата записи партии (`RunRecord.date`) остаётся: вместо `dayAt(...).date` — ISO-дата из `platform.now()`.
- `src/app/savedRun.ts` — `KeptKind` только `endless`; проверка `day` при чтении снимается (старые партии Endless его несут — пусть несут), писать `day` перестаём.
- `src/app/clock.ts` — `clockLeft`; `secondsLeft` (отсчёт полного поля) живой.
- `src/app/stats.ts` — `timed` в строке темпа панели плейтеста.
- `src/rules/` — режим `timed` целиком: `RunMode`, `endReason 'time'`, `Tuning.timedSec/timedStartMs/timedEndMs`, `RulesConfig.timedStartMs/timedEndMs/timedTicks`, в `config.ts` — значения, диапазоны, `timedPhases`, `timedPhase`, `timedPaceMs`, `TIMED_PHASE_MS`, ветка `timed` в `paceIntervalTicks` (сигнатуру не трогать — её зовут `spawn.ts` и тесты); `sim.ts` — `RunOptions.timed`, `checkClock`; `reactions.ts`, `wave.ts`, `spawn.ts` — проверки режима; `paceBot.ts` и `scripts/pace.mjs` — вариант `timed`.
- `src/shell/` — `HudSession.clock` и его отрисовка в `hud.ts`; `ResultData.timeUp`, `day`, `RecordsTable.day` в `panels.ts`; `PANELS.timeUp`, `RESULT.day`, `eraDate`, `fileLine` с `{time}` (мёртвые и сейчас: `shellLimited` не стоит ни в одном файле меню), `MenuData.limitSec` в `screens/menu.ts`. Ряд вкладок журнала — вопрос 9.1.
- `src/platform/settings.ts` — `bestOn`.
- `src/audio/` — `tick()` в `engine.ts`, звук `clock` в `score.ts`; в `src/lab/soundLab.ts` — кнопка «Последние секунды сеанса дня».
- Слова: `dailyBest`, `dailyNote`, `shellLimited` (семь словарей); `LIMITED`, `TODAY`, `TIME UP` в `src/ui/lang/words.ts`; `timed`, `tune_timed*` в `src/ui/devText.ts`.
- Лаборатории: `src/lab/shellLab.ts` (образец журнала дня, `limitSec`, `timeUp`), `src/lab/juiceLab.ts` (тип `'timed'`).
- Площадка: `platforms/playgama/playgama-bridge-config.json` — таблица `timed`; `platforms/playgama/README.md:24`. Таблица в кабинете Playgama — вопрос 9.7.

**Тесты:** удалить `daily.test.ts`; блок «made-up players of the session of a day» в `archive.test.ts`; «lets a session of the day…» в `savedRun.test.ts`; «say how long the session of the day lasts…» в `src/shell/text.test.ts`; «names its day…» в `panels.test.ts`; `describe('time limited profile')` в `src/rules/pace.test.ts` — кроме «leaves Endless to be lost once its gentle start is over» (оставить, длительность — числом тиков); тесты сеанса дня в `director.test.ts`, `wave.test.ts`, `sim.test.ts` (`describe('time limited')`, кроме «reports a full board as the reason in Endless»). Поправить: детерминизм темпа в `pace.test.ts` (только Endless), «is lost with nobody at it» в `paceBot.test.ts` (переписать на Endless), фикстуры `timed` в `settings.test.ts`, `archive.test.ts`, `panels.test.ts`, `text.test.ts`, `score.test.ts`.

### 3.2. Коммит 2 — обучение Endless (`?tutorial`)

Входы: адрес `?tutorial` (`SHELVED`, `game.ts:161`, `:680`) и кнопка «Replay tutorial» панели плейтеста (только DEV). `SHELVED` общий с `?tasks`: в этом коммите у него остаётся ветка `tasks`, сам он уходит в коммите 3.

**Файлы целиком:** `src/rules/tutorial.ts`, `src/rules/tutorialHint.ts`, `src/rules/tutorial.test.ts`.

**Правки:**
- `src/rules/` — `sim.ts` (`opts.tutorial`, `tutorialConfig`, `placeTutorialLayout`, `runTutorial`, `tutorialMove`, слагаемые `isHeld(...)` в `finishRemovals`/`finishRisings`), `types.ts` (`TutorialState`, `RunState.tutorial`, события `tutorialStep`/`tutorialDone`, `RunMode 'practice'` — его создаёт только обучение), `index.ts` (экспорты обучения и `tutorialHint`).
- `src/app/game.ts` — `RunKind 'tutorial'`, `GUIDE_GAP_PX`, `LESSONS`, `READ_KEYS`, `wayBack`, `handoff` и его блок в `frame()`, `onSkip`/`onContinue`, ветка «слова упражнения ждут» в `press` и `moving()`, слушатель `READ_KEYS`, `layoutGuide` и его вызовы со слушателями `resize`/`fonts`, `updateGuide`, `skipTutorial`, `outside`, `keepLesson`, `onReplayTutorial`, ветки `practice` (заметка `practiceNote`, `level: null`), `state.tutorial` в `leaveRun`, `recordKey`, `startRun` (`start?`, `hintsSeen = []`), `hintOnce`, `onTick`, событиях `chain`/`tutorialStep`/`tutorialDone`, условии `session`. Аналитика теряет `step_id: tutorial` и `tutorial_step`.
- `src/shell/hud.ts` — `HudLesson`, `HudView.lesson`, `onSkip`, `onContinue`, `SIGN_MS`, `READ_MS`, `SWIPE_MS`, строка урока (`line…`, `signsSaid`, `lessonLines`, `nudge`, `proceed`, `signs`, `setLessonLines`, `reserve`, `lineFrame`, `drawLesson`), `HUD.practice` в шапке. `src/shell/hudLayout.ts` — `lineSize` и `LINE_SIZE_*`. `src/shell/text.ts` — `HUD.practice`, `exercise`, `channel`, `next`, `skip` (слово `SKIP` в `words.ts` остаётся: его держит команда boot).
- `src/render/overlays.ts` — стрелки и рамки упражнения (`GuideArrow`, `GuideFrame`, `BoardGuide`, `syncGuide`, их меши); `src/render/textures.ts` — `faceFrameTexture`, `chevronTexture`; `src/render/cubes.ts`, `leaving.ts` — слагаемое `isHeld`; `src/lab/boardLab.ts` — `guide: null`.
- `src/app/juice.ts` — `!state.tutorial`.
- `src/platform/settings.ts` — `tutorialDone`.
- `src/ui/screens.ts`, `src/ui/devtools.ts` — `onReplayTutorial`; `src/ui/devText.ts` — `tutorial`, `replayTutorial`, `practice`.
- Слова: `tut_*` (12 ключей), `shellExercise`, `practiceNote` (семь словарей); `EXERCISE` в `words.ts`.
- Звук `begin` («поле после обучения») — вопрос 9.4.

**Тесты:** удалить `tutorial.test.ts`; «leaves the exercise on its own level» (`pace.test.ts`), «leave the exercise to its own pace» (`wave.test.ts`), «say nothing of a level passed in the exercise» (`juice.test.ts`), `describe('the letters of the words of the exercise')` (`hint.test.ts`). Поправить строки: `savedRun.test.ts` (случай `exercise`), `text.test.ts` (`HUD.skip.name`), `settings.test.ts` (`tutorialDone`), `level.test.ts` (`s.tutorial`).

Не трогать: обучающую дорогу (`src/levels/road.ts`, `HOW TO PLAY`), `hintsSeen`, `guidedStart`, `hintOnce`, `voice.ts`, `NOTE_SIZE`, `plateFace`, `drawCounter`. Окно кадра `clear` в `src/render/view.ts` после этого всегда 0, но оно покрыто тестами — оставить.

### 3.3. Коммит 3 — пазлы (`?tasks`)

Живые уровни из кода пазлов не берут ничего, кроме типа `PuzzleDie` (кость раскладки уровня, ~15 файлов) — он остаётся; переименование — вопрос 9.5.

**Файлы целиком:** `src/rules/puzzle.ts`, `src/rules/puzzle.test.ts`, `src/puzzle/levels.ts`, `src/puzzle/levels.test.ts` (папка `src/puzzle` уходит), `src/app/puzzleStats.ts`, `src/app/puzzleStats.test.ts`.

**Правки:**
- `src/app/game.ts` — `SHELVED` целиком (с веткой `tutorial` он пуст), `RunKind 'puzzle'`, `PUZZLE_RULES`, `TASKS_TO_AD`, `tasksToAd`, `clearedSinceAd`, `clearsToAd`, `puzzleIndex`, `startPuzzle`, `restartPuzzle`, `undoPuzzle`, `nextPuzzle`, `openPuzzle`, `showPuzzleRules`, `showPuzzleLevels`, `showPuzzleResult`, ветки `state.puzzle` (`levelName`, `step` — `step_id: task`, `leaveRun`, `takeCommand`, `hintOnce`, события `move`/`deadEnd`/`match`/`chain`, шапка `kind: 'task'`, `tools`, `playMs`, конец партии, ритуал, `session`). `undoTask`/`restartTask` сводятся к `undoLevel`/`restartLevel`. Общее с уровнями (`history`, `beforeCommand`, `tryCounted`, `interstitial()`, `deadEnd()`) остаётся.
- `src/shell/panels.ts` — `rulesPanel`, `tasksPanel`, `clearedPanel` (уровни показывают итог через `levelResultPanel`). `src/shell/hud.ts` — `HudTask`, `drawTask`, `drawTaskWide`. `src/shell/text.ts` — `HUD.moves`, `task`, `target`, `PANELS.tasks`, `COMMANDS.tasks`, `COMMANDS.rules`, `RESULT.least` (`PANELS.rules`, `PANELS.cleared`, `COMMANDS.next`, `again`, `RESULT.moves` живые).
- `src/rules/` — `RunOptions.puzzle` и ветки `state.puzzle` в `sim.ts`, `movement.ts`, `reactions.ts` (`resolvePuzzle`), `board.ts`; `types.ts` — `PuzzleLayout`, `PuzzleState`, `DeadEnd`, `RunState.puzzle`, `RunMode 'puzzle'`, события `deadEnd`/`cleared`, `endReason 'cleared'` (слово цели уровня `GoalWhat 'cleared'` живое); `index.ts`; `paceBot.ts` — метка `END.cleared`. `src/render/marks.ts`, `signs.ts` — условие `!state.puzzle`.
- `src/platform/settings.ts` — `PuzzleStat`, `PuzzleProgress`, `puzzle`, `puzzleStat()`.
- `src/ui/screens.ts`, `devtools.ts` — `showPuzzleStats`; `src/ui/devText.ts` — `puzzle`, `puzzleStats`, `share`, `statsEmpty`, `statsNote`.
- `src/lab/shellLab.ts` — экраны `rules`, `tasks`, `cleared`. **`src/lab/boardLab.ts:65-67`** строит образец поля через `createRun({ puzzle })` — переписать без него (пустой забег и кости руками, как в `src/rules/testkit.ts`) и проверить лабораторию глазами: вид образца не должен измениться.
- Слова: `puzzleRule1…5`, `puzzleHeld`, `deadNoExit`, `deadSingle`, `tier_*` (7), `shellTasks` (семь словарей).
- Звуки `cleared` и `deadEnd` — вопрос 9.4.

**Тесты:** удалить три файла выше; в `panels.test.ts` — «offer the next task only where there is one», «name the kind of the task in focus», записи `rulesPanel`/`clearedPanel`/`tasksPanel` в списках; строки в `levelPanels.test.ts:328` (`RESULT.least`), `savedRun.test.ts` (случай `task`), `level.test.ts:192` (`s.puzzle`).

### 3.4. Коммит 4 — ворота глав и `?gates=off`

Глава у игры одна, `gate: false`: `locked` всегда весь ложный, `?gates=off` ничего не меняет. Ворота нигде не сохраняются.

**Правки:**
- `src/levels/progress.ts` — уходят `Chapter`, `chaptersOf`, `ruleOf`, `GATE_SHARE`, `gateOf`, `LadderProgress`, `ladderProgress`; остаются правило звёзд (`THREE_STARS_OVER`, `TWO_STARS_OVER`, `levelStars`, `starsHeld`, `STAR_POINTS`, `starScore`) и шапка без слов о воротах.
- `src/levels/recipes.ts` — `ChapterRule`, `CHAPTERS` (одна запись пробы); `LADDER_SINK_MOVES`, `LADDER_LIFT_MOVES`, `Recipe.chapter` живые. Не путать с `CHAPTERS` кампании в `src/levels/chapters.ts` — тот живой.
- `src/app/game.ts` — `LEVEL_GATES`, `ladder()`, проверки `locked` в `startLevel`, `startPassage`, `nextLevel`, `hasNext`.
- `src/shell/panels.ts:342`, `src/shell/screens/panel.ts` — поле `locked` клетки списка и бледная закрытая клетка; `src/shell/text.ts` — `LADDER` (его читает только тест); `src/ui/lang/words.ts` — `LOCKED`, `STARS`.
- `scripts/stars.mjs` — раздел 7 «A gate of stars before a chapter», `gateOf`; таблицы по главам раздела 6 считаются по всему ряду (глава одна).

**Тесты:** удалить `src/levels/gates.test.ts`; в `progress.test.ts` — `describe` «the chapters of a list of levels» и «the levels as a player has them»; в `levels.test.ts` — проверка «one chapter, open…» сводится к `level.chapter === 0`; в `recipes.test.ts` — `describe('the chapters of the levels')`; в `levelPanels.test.ts` — `locked`; в `text.test.ts` — `LADDER`.

### 3.5. Коммит 5 — мелочь, которую нашёл knip

Функции, которых не зовёт никто — ни игра, ни лаборатории, ни скрипты, ни тесты: `withHead` (`src/levels/library.ts`), `fill` (`src/levels/select.ts`), `slowFactsOf`, `grammarText` (`src/levels/table.ts`). Удалить. Остальные 70 имён из приложения А используются внутри своего файла и мёртвыми не являются: снимать с них `export` — уборка, не удаление (вопрос 9.6).

## 4. Замеры до

**Условия.** Сборка `npm run build` (v0.2.61, `26c8a10`), `npm run preview` (порт 5184, отдаёт gzip — как GitHub Pages). Chrome 155, headless, по CDP: процессор ×4 (`Emulation.setCPUThrottlingRate`), сеть DevTools «Fast 3G» (задержка 562,5 мс, приём 180 000 Б/с, отдача 84 375 Б/с), экран телефона 360×640 при плотности 2, касание. Каждый прогон — чистый профиль. «Первый визит» — пустой профиль: длинный boot (6 с). «Повторный» — тот же профиль, кэш HTTP сброшен, `bootSeen` уже стоит: короткий boot (1,2 с) и сразу `START`. Три прогона, медиана; разброс между прогонами — до 60 мс. Скрипт замера ляжет в `scripts/load-bench.mjs` (раздел 7, шаг Ч0), чтобы «после» мерилось тем же.

**Что такое «первый кадр меню» и «интерактивное меню» в этой игре.** Игра открывается не меню, а boot → `START` над доской, которую игрок будет играть; главное меню — дальше, из паузы. Поэтому мерится:
- **первые буквы** — первый кадр boot со шрифтом программы: игрок видит программу, и boot с этого кадра принимает нажатие (любое нажатие его пропускает);
- **`START`** — экран `START` над доской: с этого кадра нажатие начинает игру. У первого визита он идёт после 6 с длинного boot или сразу после нажатия, поэтому сравнивается повторный.

Время — от начала навигации, мс:

| Событие | Первый визит | Повторный |
|---|---|---|
| HTML получен | 589 | 586 |
| `vendor` (three.js, 136 КБ gzip) получен | 2738 | 2737 |
| `index` (код игры, 222 КБ gzip) получен | 3243 | 3226 |
| создан WebGL-контекст (`Game` строится) | 3330 | 3260 |
| первый кадр (тёмный холст) | 3862 | 3449 |
| шрифты запрошены | 3374 | 3279 |
| шрифты получены (5 файлов, 90 КБ) | 4773 | 4506 |
| **первые буквы** | **4753** | **4484** |
| **`START`** | после boot | **5813** |

На проводе до `START` — 452 КБ: JS 358 КБ, шрифты 90 КБ, CSS 5 КБ.

**Куда уходит время.** Fast 3G — 5,6 мс на килобайт и 0,56 с на каждый круг запроса. Сейчас кругов после HTML два: JS и CSS (параллельно), и только когда JS выполнился и CSS шрифтов применился — шрифты. Шрифты оболочки ждут JS целиком и приходят на 1,2–1,4 с позже него. Процессор весит меньше: от прихода JS до первого кадра — 0,2 с повторно и 0,5 с в первый визит (в первый — сборка шейдеров).

**Пробы** (копия сборки с правкой в `index.html`, те же условия, gzip-сервер как Pages, по три прогона):

| Проба | Первые буквы, первый / повторный | `START`, повторный |
|---|---|---|
| как есть | 4791 / 4498 | 5810 |
| `<link rel="preload">` двух файлов шрифта программы (латиница DotGothic16 и японский набор, 29 КБ) | 4221 / 3715 | 5038 |
| то же и без Forum (шрифт передач, 3 файла, 61 КБ) | 4183 / 3729 | 5038 |

Preload шрифтов программы — **−0,6…−0,8 с** до первых букв и **−0,8 с** до `START`. Forum на путь к первым буквам не влияет: он запрашивается после JS и шрифт программы не держит.

**Сколько весят части кода в gzip** (пробная сборка, где каждая часть — свой чанк; границы примерные):

| Часть | КБ gzip | ≈ мс на Fast 3G |
|---|---|---|
| three.js | 136,7 | 760 |
| `src/render` + `src/display` | 50,4 | 280 |
| `src/shell` | 46,9 | 260 |
| `src/signal` (передачи) | 32,5 | 180 |
| `src/app` | 27,7 | 150 |
| пять словарей `src/ui/lang/{de,es,fr,pt,tr}` | 18,0 | 100 |
| файлы удаляемых режимов (без веток в общих файлах) | 16,5 | 90 |
| `src/audio` | 14,5 | 80 |
| `src/ui/readme.ts` (текст README) | 12,7 | 70 |
| `src/app/archiveData.ts` | ≈1,5 | 10 |

## 5. Что делить на чанки

Правило, которое дали замеры: **на Fast 3G лишний круг запроса (0,56 с) дороже 100 КБ**. Всё, что нужно до первых букв, должно прийти первой волной вместе с JS; ленивое — только то, что нужно позже первого кадра, и грузится оно в фоне сразу после первого кадра, а не по нажатию.

| Кандидат | Выигрыш | Что видит игрок | Решение |
|---|---|---|---|
| **Ч1. Preload шрифта программы** в `index.html` | −0,6…−0,8 с до букв, −0,8 с до `START` (замер) | то же, раньше | **делать** |
| **Ч2. Мёртвый код** (раздел 3) | ≈ −20 КБ, ≈ −0,1 с (расчёт) | ничего | **делать** |
| **Ч3. Текст README** — свой чанк | −12,7 КБ, −0,07 с | README открывается из меню, до которого секунды игры; к тому времени чанк в фоне давно пришёл | **делать** |
| **Ч4. Передачи (`src/signal`)** — свой чанк | −32,5 КБ, −0,18 с (расчёт) | передача нужна сразу после `START` (окно подсказки доски). Чанк грузится в фоне с первого кадра; boot не отдаёт экран `START`, пока чанк не пришёл: при нажатии `SKIP` на первом визите последний кадр boot (логотип) стоит чуть дольше — до 0,75 с на Fast 3G. Новых элементов нет | **делать**, если владелец согласен, что boot ждёт (вопрос 9.2) |
| Словари пяти языков | −18 КБ (−0,1 с) для ru/en | язык известен только после хранилища и площадки: для de/es/fr/pt/tr — лишний круг, +0,56 с к первым буквам | **не делать** |
| Звук (`src/audio`) | −14,5 КБ (−0,08 с) | звук открывается только жестом игрока; не пришёл к первому нажатию — первое нажатие беззвучно | **не делать** |
| Архив вымышленных игроков | ≈ −1,5 КБ | — | **не делать** (после коммита 1 он ещё вдвое меньше) |
| Forum на старте | 0 до букв (замер) | — | **не трогать** |
| **Ч5. Доска после оболочки:** вход — только boot и шрифт; three.js, `src/render`, `src/display`, игра — следом | первые буквы ≈ 1,8–2,0 с вместо ≈ 3,2 с после Ч1–Ч4; `START` ≈ 3,4 с вместо ≈ 4,4 с (**оценка по байтам, не замер**) | см. ниже | **вопрос владельцу** (9.3) |

**Ч5 подробно.** Сейчас boot рисуется не сам по себе: оболочка — 2D-холст в 240 строк, но на экран его выводит WebGL-рендерер three.js (`src/display/present.ts`) шейдером с дизерингом и глубиной. Чтобы boot появился до three.js, ему нужен свой вывод — тот же холст, увеличенный по пикселям на обычный 2D-холст, без шейдера, — и передача кадра WebGL-выводу, когда тот придёт. Цена:
- кадры boot до и после передачи могут различаться (дизеринг шейдера) — это вопрос вида, его решает владелец;
- игра строится, пока идёт boot: один подвисший кадр boot на 0,2–0,5 с на слабом телефоне;
- у повторного визита короткий boot (1,2 с) кончается раньше, чем приходит доска (≈ 0,5 с разницы на Fast 3G): нужно состояние «доска грузится» — новый элемент интерфейса (вопрос 9.3).

Рекомендация: сначала Ч1–Ч4 (без нового интерфейса, без смены вида), замер; Ч5 — отдельной спекой, если после замера владелец скажет, что 3,2 с до первых букв на медленном телефоне — всё ещё долго.

## 6. Цель в числах

Те же условия (Fast 3G, процессор ×4, 360×640), медиана трёх прогонов `scripts/load-bench.mjs`:

| | Сейчас | Цель после Ч1–Ч4 | Если делать Ч5 (оценка) |
|---|---|---|---|
| первые буквы, повторный визит | 4,48 с | **≤ 3,3 с** | ≈ 2,0 с |
| первые буквы, первый визит | 4,75 с | **≤ 3,8 с** | ≈ 2,3 с |
| `START`, повторный визит | 5,81 с | **≤ 4,6 с** | ≈ 3,4 с |
| JS и шрифты до первых букв | 452 КБ (всё) | **≤ 340 КБ** | ≈ 110 КБ |

Если цель не взята — в README пишется, что получилось и почему, а не подгоняются условия.

## 7. Порядок работ (для плана)

Код начинается после слова пользователя, что работа над слоем платформы влита в main (по `git log` она в main с v0.2.61 — подтвердить у пользователя).

1. **Ч0. Скрипт замера** `scripts/load-bench.mjs` — то, чем мерился раздел 4: запускает Chrome по CDP с указанными условиями, открывает адрес, пишет медиану событий; `node scripts/load-bench.mjs [url] [runs]`. Строка в README.md (раздел «Продакшн-сборка»). Числа «до» записываются его же выводом.
2. Коммит 1 — сеанс дня (3.1).
3. Коммит 2 — обучение (3.2).
4. Коммит 3 — пазлы (3.3).
5. Коммит 4 — ворота (3.4).
6. Коммит 5 — мелочь knip (3.5).
7. **Ч1** — плагин в `vite.config.ts` (`transformIndexHtml` в сборке): `<link rel="preload" as="font" type="font/woff2" crossorigin>` на файлы шрифта программы, которые нужны boot (латиница DotGothic16 и японский набор; кириллица у него встроена в CSS). Имена файлов — из собранного бандла, не руками.
8. **Ч3** — README: `src/ui/readme.ts` через `import()`; запрос в фоне после первого кадра.
9. **Ч4** — передачи: `src/signal` через `import()`; `SignalPlayer` создаётся, когда чанк пришёл; запрос в фоне после первого кадра; boot передаёт экран `START` только после прихода (по ответу 9.2).
10. Замеры после — тем же скриптом, в README.md.

Каждый шаг — отдельный коммит, каждый зелёный: `npm test`, `npm run typecheck`, `npm run build`, после документов `node scripts/docs-check.mjs`; для шагов 2–5 ещё `node scripts/pace.mjs` до и после — тот же вывод, для шага 5 — `node scripts/stars.mjs`. После шагов 7–9 — игра в preview: boot, `START`, первая доска, окно подсказки, пауза, меню, README, журнал, лаборатории `?lab=shell`, `board`, `sound`.

## 8. Что меняется в документах

- **README.md** — «Продакшн-сборка»: чанки, preload шрифта, замер и его условия, числа до и после, `scripts/load-bench.mjs`. «Журнал сеансов»: одна вкладка `PROTOCOL`, абзац про сеанс дня и пункты о 56 игроках дня и ключе `timed` уходят. «Аналитика»: из таблицы уходят `timed`, `tutorial`, `task`, `tutorial_step`, `timed_level`, «сеанс дня дошёл до конца», «обучение пройдено», «задача решена»; строка «Значения … остались от…» уходит. «Структура»: строка `src/puzzle` уходит; `src/app` — без «статистики пазлов»; `src/shell` — панели без «задач»; `src/ui` — без «статистики задач»; `src/levels` — без «ворот у пробы нет».
- **docs/art/VI_Interface_Layer.md** — строки вкладки `LIMITED` и подробностей сеанса дня, слов упражнения, правил/списка/итога задач, `LADDER`/`LOCKED · STARS` и бледной клетки, `NEXT` перед закрытой главой; первая фраза «Правила» без «обучения и пазлов». Строка Boot — что boot передаёт `START` только когда пришло то, что `START` нужно (если 9.2 — «да»). Если делается Ч5 — строка нового состояния «доска грузится».
- **docs/art/VI_World_Logic.md** — строки сеанса дня, упражнения, пазлов и ворот.
- **docs/ROADMAP.md** — «Решено удалить»: исполнено, со ссылкой на эту спеку; журнал.
- **docs/README.md** — раздел «Уйдут вместе с кодом» уходит; спеки пазлов и обучения Endless (`2026-10-01-vi-puzzle-design.md`, `2026-10-01-vi-tutorial-design.md`) — в «В истории git» с коммитом; эта спека — «построено».
- **docs/VI_Endless_Rules.md** — строки о коде `timed` и о «коде решено удалить».
- **docs/VI_Tutorial_Research.md:23** — ссылка на `src/rules/tutorial.ts` становится текстом (иначе docs-check падает «ссылка в никуда»); остальные решения и исследования не правятся, кроме шапки там, где это требует индекс.
- **platforms/playgama/README.md** — строка о таблице `timed`.

## 9. Вопросы владельцу

**Ответы владельца 15 октября 2026:** «Ответы на вопросы раздела 9 — по твоим рекомендациям». Где рекомендация была, она и принята:

- 9.1 — (а): ряд вкладок журнала убран, заголовок — `PROTOCOL`.
- 9.2 — да: boot передаёт `START`, когда пришёл чанк передач.
- 9.3 — Ч5 не сейчас: после замера Ч1–Ч4; если делать — вариант (а), последний кадр boot стоит, пока доска не придёт.
- 9.4 — звуки `cleared`, `deadEnd`, `begin`, `clock` удаляются вместе с режимами.
- 9.6 — экспорты не трогать.
- 9.8 — лишние поля старых сохранений снимаются при загрузке.
- 9.9 — `src/levels/boardSamples.ts` остаётся; адреса продакшн-сборки остаются.

Где рекомендации не было, ничего не удаляется и не меняется — это вне решения: `PuzzleDie` не переименовывается (9.5); таблица `timed` в кабинете Playgama не трогается (9.7); `src/levels/rules.ts`, `src/levels/voices.ts`, `src/rules/goalBot.ts`, `src/levels/limit.ts`, `scripts/teach.mjs`, старый предел ходов в `scripts/stars.mjs` остаются; `fontverter` в `package.json` не добавляется (9.9). Любое из этого — отдельным словом владельца.

1. **Журнал сеансов с одной таблицей.** После сеанса дня у журнала одна вкладка. Варианты: (а) ряд вкладок убрать, заголовок журнала — `PROTOCOL`; (б) оставить ряд с одной вкладкой `PROTOCOL`. Рекомендую (а). Это вид панели — решаете вы.
2. **Boot ждёт передачи (Ч4).** Если игрок пропускает boot раньше, чем пришёл чанк передач, последний кадр boot (логотип) стоит до 0,75 с на медленной сети, потом `START`. Без нового элемента. Да / нет (тогда передачи остаются в первом файле, −0,18 с выигрыша нет).
3. **Ч5 — доска после оболочки.** Делать ли сейчас (отдельной спекой) или после замера Ч1–Ч4? Если делать — что видит игрок, когда короткий boot кончился, а доска ещё не пришла. Варианты из того, что в оболочке уже есть: (а) последний кадр boot — логотип со строкой — стоит, пока доска не придёт; (б) экран `START` без доски под ним, команда тусклым тоном `dim`, пока доска грузится, и полным — когда пришла; (в) ещё одна строка проверки модулей длинного boot, которая ждёт («доска» — модуль программы) — это текст лора, его надо сверить с VI_Lore и журналом утверждений. Цвет и вид — только по `src/shell/theme.ts`. Рекомендую (а): нового элемента нет вовсе.
4. **Звуки удаляемых режимов.** `cleared` («задача решена»), `deadEnd` («задача: тупик»), `begin` («поле после обучения»), `clock` («последние секунды сеанса дня») после удаления звучат только кнопками лаборатории звука. Удалить вместе с режимами (рекомендую) или оставить как заготовки?
5. **`PuzzleDie`** — живой тип кости раскладки уровня с именем удалённого режима. Переименовать в `LayoutDie` отдельным коммитом (только имя, ~15 файлов) или оставить?
6. **70 экспортов, которые нужны только своему файлу** (приложение А). Снимать `export` — уборка, к мёртвому коду не относится. Рекомендую не трогать.
7. **Таблица `timed` в кабинете Playgama** хранит старые очки сеанса дня. Из конфига SDK её строку уберёт коммит 1; удалить саму таблицу в кабинете — отдельное действие в кабинете, вашей рукой или по вашему слову.
8. **Лишние поля старых сохранений** (`puzzle`, `tutorialDone`, `runs.timed*`) снимать при загрузке, как `fixedSaid` (рекомендую), или оставить лежать?
9. **Сомнительное: используется только тестом или только скриптом.**
   - `src/levels/rules.ts`, `src/levels/voices.ts` — уроки и окна прежней лестницы. В продакшн-сборке лежат, но не звучат: окно урока открывается только у уровня с `lesson`, а таких в ряду нет (это держат `levels.test.ts` и `road.test.ts`); `showLevelRules` не зовёт никто. README: «ждут, когда вернётся обучение». Удалить или оставить ждать?
   - `src/rules/goalBot.ts` — игрок Endless на уровнях с целью и приходом; зовут только тесты. Оставить?
   - `src/levels/boardSamples.ts` — образцы досок для тестов лаборатории; зовут только тесты. Это часть тестов — оставить (рекомендую).
   - `src/levels/limit.ts` — предел решателя, только `node scripts/ladder.mjs limit`. Пользуетесь?
   - `scripts/teach.mjs` — «чему учат уровни»; правился 5 октября, в индексе команд его нет, но работает. Оставить или убрать?
   - Старый предел ходов в `scripts/stars.mjs` (`moveLimit`, `limitOf`) — оставлен «чтобы мерить против». Оставить?
   - `fontverter` — его импортирует `scripts/cyrillic-font.mjs` (`npm run fonts`), а в `package.json` его нет: на чистой установке `npm run fonts` упадёт. Добавить в `devDependencies`? К мёртвому коду не относится.
   - Адреса в продакшн-сборке, которых нет в меню: `?levels`, `?first`, `?road=R05`, `?bg`, вид поля (`?pitch`, `?yaw`, …), качество (`?water=off`, `?halo=off`, …). Это инструменты проверки на телефоне по ссылке Pages, кода в них — строки. Рекомендую оставить.

## Приложение А. knip

`npx knip@5 --config <вне репозитория> --reporter compact`; входы — `src/main.ts`, `src/**/*.worker.ts`, `src/lab/*.ts`, `scripts/*.mjs`, `platforms/**/*.ts`, `vite.config.ts`, `vite.boards.ts`, тесты vitest. Прогон без тестов и без скриптов дал тот же список.

```
Unused files (1)
src/levels/limit.ts                      — его грузит scripts/ladder.mjs через runnerImport, knip этого не видит
Unlisted dependencies (1)
scripts/cyrillic-font.mjs: fontverter
Unused exports (23)
src/app/comboHint.ts: HINT_MOVES, HINT_MAX_STATES
src/app/ritual.ts: RITUAL_THRESHOLDS
src/audio/engine.ts: SoundChain
src/audio/score.ts: KNOCK_VARIANTS
src/audio/stock.ts: NOISE_SECONDS
src/input/controller.ts: FIRST_REPEAT_MS, REPEAT_MS
src/input/gesture.ts: HYSTERESIS_DEG, LEASH_PX, degreesTo
src/levels/grammar.ts: SAVES, PLANNER_SLACK
src/levels/labText.ts: gridText, showText, wayPlays, checkPassed, regressFailed
src/levels/library.ts: withHead, rowCodes
src/levels/orderSearch.ts: ORDER_MAX_STATES
src/levels/progress.ts: THREE_STARS_OVER, TWO_STARS_OVER   — их читает scripts/stars.mjs
src/levels/select.ts: WALK_LIMIT, fill, boardText
src/levels/table.ts: ROAD_WALK_LIMIT, slowFactsOf, grammarText
src/levels/variety.ts: ARRANGE_AMONG
src/levels/walk.ts: SOLVE_MAX_STATES
src/platform/settings.ts: topRuns
src/render/board.ts: TOP_Y
src/render/ease.ts: linear, inQuad, inCubic
src/render/textures.ts: PIP_LAYOUT, pipRadius
src/signal/kit.ts: tickNoise
src/signal/places/open.ts: SKY_RADIUS, skyGeometry
src/ui/perfFirst.ts: MOVE_MS
Unused exported types (50) — типы, нужные только своему файлу; список в выводе knip
```

Из этих имён не используются нигде, даже в своём файле, только `withHead`, `fill`, `slowFactsOf`, `grammarText` (коммит 5).

## Приложение Б. Кто доходит до файлов, которых нет в продакшн-сборке

Граф импортов (статические, `import()`, воркеры, пути `runnerImport` скриптов). Файлы `src/lab/*`, `src/ui/{debug,devText,devtools,fps,screens}.ts` — лаборатории и инструменты DEV, живые. Остальное:

| Файл | Кто доходит |
|---|---|
| `src/app/boardProbe.ts` | лаборатория (`?board=`), тест |
| `src/levels/boardSvg.ts`, `library.ts` | лаборатория, скрипт, тест |
| `src/levels/snapshot.ts` | лаборатория, тест |
| `src/levels/grammar.ts`, `table.ts` | скрипт, тест |
| `src/rules/bot.ts`, `paceBot.ts` | скрипт, тест |
| `src/levels/limit.ts` | только скрипт (`ladder.mjs limit`) — вопрос 9.9 |
| `src/rules/goalBot.ts` | только тест — вопрос 9.9 |
| `src/levels/boardSamples.ts` | только тест (образцы для тестов) |
| `src/rules/testkit.ts` | только тест (помощник тестов) |
| `src/shell/screen.ts`, `src/signal/stage.ts` | только типы: в сборку не попадают, но их типы читает живой код |
