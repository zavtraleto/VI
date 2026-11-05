# VI — доска студии

> Вид: истина. Статус: в силе. Дата: 2026-11-04.

Кто правит: директор студии; при расхождении с кодом правится в том же коммите.

Что студия делает, в каком порядке и что ждёт владельца. Порядок работ игры владелец ведёт в [docs/ROADMAP.md](docs/ROADMAP.md); эта доска — исполнение. Риски `R1`–`R5` — [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md), раздел 11; вопросы `Q1`–`Q14` — [GAME_DESIGN.md](GAME_DESIGN.md). Размер: S — до часа агента, M — сессия, L — несколько сессий. Задача снимается с доски в коммите, который её закрыл.

## В работе

| # | Что | Где | Кому | Разм. | Проверка |
|---|---|---|---|---|---|
| T0 | Настройка студии: шесть агентов, hooks, раздел «Студия» в CLAUDE.md и README, документы студии в корне | `.claude/agents/`, `.claude/hooks/`, `.claude/settings.json`, `CLAUDE.md`, `README.md`, `PROJECT_CONTEXT.md`, `GAME_DESIGN.md`, `TECHNICAL_ARCHITECTURE.md`, `TASKS.md`, `DECISIONS.md`, `CHANGELOG.md` | директор | M | `node scripts/docs-check.mjs`; hooks — JSON в stdin, коды 2 и 0; `npm test`, `npm run typecheck`, `npm run build`. Сделано: в `main` с `feafe0c` |
| T-novel | Новелла за звёзды, первая простая сборка — под флагом, ждёт слова владельца о включении | `src/app/novel.ts`, `src/ui/novel.ts`, `src/shell/panels.ts`, `src/app/game.ts`; [спека](docs/superpowers/specs/2026-11-04-vi-star-novel-design.md) | game-designer, developer | S–M | `npm test`, `npm run typecheck`, `npm run build`, docs-check; preview 360×640 и 1920×1080 с `?novel` и без |

## Сделано

| # | Что | Где | Кому | Разм. | Проверка |
|---|---|---|---|---|---|
| 1 | R1: предел ожидания чтения хранилища площадки, при сбое — откат на браузер и `save_failed`; заодно предел у межстраничной в OPENED и награды | `src/platform/storage.ts:38`, `src/main.ts:19`, `platforms/playgama/adapter.ts:176-181`, `:221-225` | architect → developer | S | тест на `read`, который не отвечает; `platforms/playgama/adapter.test.ts`; qa — запуск через `vi-build` |
| 2 | R2: проверка формы сохранения по полям с откатом на значения по умолчанию; битое сохранение не роняет запуск и не затирается без копии | `src/platform/settings.ts:128-144`, `src/platform/storage.ts:63-71`, `src/main.ts:21` | architect → developer | M | тесты `src/platform/settings.test.ts` на `null` в `levels.passed/told/lives` |
| 3 | Тесты путей сбоя хранилища: `reject`, битый JSON, `save_failed`, откат на браузер | `src/platform/storage.test.ts` | qa-engineer | S | `npm test` |
| 4 | R3: правило «меняется форма `RunState`/`RunConfig` — меняется `KeptRun.version` или `RULES_VERSION`» и тест-сторож на ключи состояния | `src/app/savedRun.ts`, `src/rules/config.ts:10`, `src/rules/types.ts` | architect → developer | S | новый тест в `src/app/savedRun.test.ts`; строка в [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md), раздел 7 |
| 12 | Открытие без boot сразу на `START`, мгновенный `START`, тихий щелчок включения, `STORY` отдельным чанком; замер до/после, разбор остальных чанков | `src/app/game.ts`, `src/shell/`, `src/audio/score.ts`, `src/ui/readme.ts`, [README.md](README.md) «Продакшн-сборка» | developer | M | `npm test`, typecheck, build, docs-check, путь в `vi-dev`, замер по CDP |
| 13 | Список уровней во весь экран: пластина на экран, 12 клеток в ряду на столе, клетки по высоте в оставшееся место, `MENU` у низа (вариант «А» из трёх словами; глав нет) | `src/shell/screens/panel.ts`, `src/shell/panels.ts`, `src/shell/theme.ts`, `docs/art/VI_Visual_Spec.md` 8.4, `docs/art/VI_Interface_Layer.md` | ui-ux-designer | S | `npm test`, typecheck, build, docs-check; путь игрока на 360×640 и 1920×1080 |
| 14 | Вид по словам владельца 4 ноября: зона двух комбо светится цветами обеих групп по очереди в такт 700 мс; с воды убраны «пятна Роршаха» (присутствия, `shadeFace`) | `src/render/signs.ts`, `src/render/marks.ts`, `src/render/water.ts`, `src/render/params.ts`, `src/lab/boardPanel.ts`, `docs/art/VI_World_Logic.md`, `docs/art/VI_Visual_Language.md` | art-director | S | `npm test`, typecheck, build, docs-check; место 50 на 360×640, 1024×768 и 1920×1080; вода 3 мин; `?perf` до/после |
| 11 | Слепые места аналитики: `page_hidden`/`load_hidden` до слушателей Bridge (`visibilitychange`, `pagehide`), поля рекламы и ухода, `left` без хода | `src/app/health.ts`, `src/app/adverts.ts`, `src/app/leaving.ts`, `src/app/game.ts`, [docs/VI_Analytics.md](docs/VI_Analytics.md) | developer | S | тесты с заглушкой платформы (`health`, `adverts`, `leaving`); `vi-dev`: скрытие, `pagehide`, меню, LEVELS |

Задача 11 вышла в 0.2.98 (2026-11-04). Задача 14 вышла в 0.2.97 (2026-11-04). Задача 13 вышла в 0.2.96 (2026-11-04). Задача 12 вышла в 0.2.95 (2026-11-04). Задачи 1–4 вышли в `main` коммитом `8906af0`, версия 0.2.94 (2026-11-04): `npm test` 2472, `npm run typecheck`, `npm run build`, `node scripts/docs-check.mjs`, QA в preview. Копия битого сохранения не сделана — вопрос `W11`.

## Следующие

По приоритету. Ничего из этого не требует слова владельца об игре — только «ок» на коммит.

| # | Что | Где | Кому | Разм. | Проверка |
|---|---|---|---|---|---|
| 5 | Свести ROADMAP, README, VI_Analytics, Owner Words, индекс и страницы областей с кодом (список ниже). Только после того, как чат основной папки закоммитит свои правки `docs/README.md` | `docs/ROADMAP.md`, `README.md`, `docs/VI_Analytics.md`, `docs/VI_Owner_Words.md`, `docs/README.md`, `docs/VI_Levels_Rules.md`, `docs/VI_Endless_Rules.md`, `docs/art/VI_Interface_Layer.md`, шапки спек и планов | game-designer (игра), developer (код и README) | M | `node scripts/docs-check.mjs`; каждое число сверено с кодом файл:строка |
| 6 | Нет WebGL — слово игроку вместо чёрного экрана; заглушка до первой картинки | `src/display/display.ts:25`, `src/main.ts:17-19`, `index.html` | architect → developer; вид — ui-ux-designer по слову владельца | S–M | qa: запуск с выключенным WebGL, `vi-build` |
| 7 | R4: вынести из `game.ts` по куску с тестом — отмена и снимки, реклама и награды, сохранение при уходе — по ходу ближайших задач, не переписывая | `src/app/game.ts:1311-1351`, `:690-760`, `:2483` | architect (план) → developer | L | новые тесты на вынесенные куски; `npm test`; qa — уровень с отменой, Endless с уходом со страницы |
| 8 | Разбор воронки по местам из телеметрии Playgama: `progression_failed` по `step_index`, `page_hidden`, уход на загрузке | кабинет Playgama, [docs/VI_Analytics.md](docs/VI_Analytics.md), «Где смотреть» | game-designer | S | отчёт с числами и их объёмом; выводы только при достаточном трафике |
| 9 | `docs-check` в CI перед сборкой | `.github/workflows/deploy.yml` | developer | S | прогон workflow на ветке; «ок» владельца — это меняет выкладку |
| 10 | Хрупкие тесты: время на стене и закреплённые числа ряда | `src/app/signWay.test.ts:177-180`, `src/levels/depth.test.ts:55-59`, `src/levels/row.test.ts:129-134` | qa-engineer | S | `npm test` трижды подряд под нагрузкой |

### Список для задачи 5

- `docs/ROADMAP.md` «Сделано» и шапка: 0.2.25, 30 досок `P01`–`P30`, три отмены, предел ходов → 0.2.93, 100 мест, отмена без счёта, предела нет; «Проверено: 2026-10-12».
- Места сеансов вживую 16, 28, 43, **55, 74, 86**, 92 (`boards/row.json`, `src/levels/row.test.ts:134`): в ROADMAP «Сделано» и «Сеансы вживую», `docs/VI_Endless_Rules.md` раздел 13, `docs/art/VI_Interface_Layer.md` (клетка сеанса), `docs/VI_Analytics.md:32`.
- ROADMAP «Кампания»: 31–60 пересобраны в 0.2.89/0.2.90; плашки `near` на местах 1–16, а не «скрыты на всех».
- ROADMAP «Генератор от замысла» и индекс: генератор в `main` (`e86dc64`); индекс: спека управления тапом в `main` (`3c81989`…`fa3183a`).
- План пересборки 31–100: шаги 0 и 1 выполнены (`4821e25`, `73ec982`) — шапка и строка индекса; раздел 11 спеки пересборки пуст.
- `docs/VI_Owner_Words.md` раздел 8: ветки и worktree, которых нет; записи о построенных рекламных спеках; пробы мягкости утрачены (сказать владельцу — `Q14`).
- `docs/VI_Levels_Rules.md` раздел 8 и шапка: PAR на экране с 28–29 октября (`2cc7d9f`, `f99a4ce`); обучение — окна и плашки ряда. Это запись факта, не правка правил.
- `docs/art/VI_Interface_Layer.md`: шапка уровня без очков с `0af49c9` (`LEVEL N`, ходы:PAR); надписи на языке игрока — `src/ui/i18n.ts` и `src/ui/lang/`, не `src/shell/text.ts` (строка 19).
- ROADMAP «Очки за звёзды»: построено 10 октября, убрано из показаний 29 октября, `starScore` мёртв.
- ROADMAP «Лидерборд»: таблица `HIGH SCORES`, `LIMITED` удалён 15 октября.
- ROADMAP «Платформа» и план релиза Playgama: отправлено на модерацию 24 октября; ответ — задача «Модерация Playgama» ниже.
- ROADMAP «Обучающая дорога» и «Вводный курс»: дорога вошла в пролог, ветки `first-level` нет.
- ROADMAP:193 `言語 LANGUAGE` → `ことば LANGUAGE` (`src/shell/text.ts:208`); ROADMAP:196 — шрифт один, DotGothic16.
- `README.md` «Продакшн-сборка»: реклама не чаще раза в 180 с (`platforms/playgama/playgama-bridge-config.json:3`), а не 120.
- Принципы головоломок 2.1 и правила уровня 7: отмены «на время плейтеста», а с 23 октября каждая третья — реклама.
- Шапка спеки ста уровней: плейтест прошёл 28 октября, для 31–100 её заменила спека пересборки.
- План загрузки, задача 9: `src/render/levelScene.ts` больше нет — пометить в шапке плана.

## Ждут слова владельца

| # | Что | Где | Кому | Разм. | Проверка | Нужно от владельца |
|---|---|---|---|---|---|---|
| W1 | Пересборка мест 61–100 (шаг 2 плана), потом шаг 3; сначала досчитать кэш пяти мест без D | `boards/row.json`, `boards/*.txt`, [план](docs/superpowers/plans/2026-10-28-vi-rebuild-31-100.md) | game-designer → developer | L | `node scripts/ladder.mjs campaign`, `node scripts/row.mjs check`, `npm test`; qa — 360×640 | `Q1`, `Q2` |
| W2 | Окно первого сеанса вживую говорит, что правило пола другое; семь языков, сверка с Lore и Claims | `src/ui/i18n.ts` (`liveIntro`), `src/ui/lang/` | ui-ux-designer | S | qa — место 16 на двух экранах и двух языках | `Q3` |
| W3 | Петля возврата: два-три варианта словами | — | game-designer | S | обсуждение с владельцем | `Q4`, `Q5` |
| W4 | Межстраничная за отмены — не раньше N-го места; проверить, считает ли Bridge 180 с от начала визита | `src/app/game.ts:1348`, `src/platform/settings.ts:267` | developer | S | тест; qa — первые пять мест с отменами | `Q6` |
| W5 | Остаток CrazyGames: обложки 1920×1080 / 800×1200 / 800×800, видео 15–20 с, Safari и iOS, читаемость при dpr 1 в окнах 907×510 и 800×450, отправка | `platforms/crazygames/README.md`, [исследование](docs/VI_CrazyGames_Research.md) | владелец (обложки, видео); qa-engineer (проверки) | S–M | список требований исследования закрыт | `Q7` |
| W6 | Модерация Playgama: узнать статус в кабинете и записать | кабинет Playgama; [план релиза](docs/superpowers/plans/2026-10-22-vi-release-playgama.md) | директор с владельцем (вход — его) | S | статус записан в плане релиза | войти в кабинет |
| W7 | Уборка девяти пустых worktree и их веток (все уже в `main`) | `.claude/worktrees/`; `git worktree remove`, `git branch -d` | владелец решает, исполняет директор | S | `git worktree list`, `git branch` | да / нет |
| W8 | Чужие незакоммиченные правки в основной папке: `docs/README.md`, `docs/VI_Playgama_Page.md`, `docs/art/VI_Claims.md` — мешают `git pull --ff-only` и задаче 5 | основная папка | чат основной папки | S | `git status` в основной папке чист | чей это чат и коммитить ли |
| W9 | Архив вымышленных игроков: пересчитать по нынешним правилам или оставить | `scripts/archive.mjs` → `src/app/archiveData.ts` | developer | S | `node scripts/archive.mjs probe` | `Q8` |
| W10 | Новички на телефоне на местах 1–30 и первом сеансе (стена 27–28) | — | game-designer (план плейтеста) | S | слова игроков записаны | кого звать |
| W11 | Копия битого сохранения под новым ключом — нужна ли (сейчас битое затирается умолчаниями) | `src/platform/settings.ts`, `src/platform/storage.ts` | developer | S | тест: битое сохранение остаётся под новым ключом | да / нет |
| W12 | Битый не-JSON `vi.run.v1` лежит до первой партии Endless и шлёт `save_failed parse` при каждом запуске (`src/app/game.ts:756`, `saveWithoutRun`) — стирать без копии? | `src/app/game.ts:756`, `src/app/savedRun.ts` | developer | S | тест: битый `vi.run.v1` не шлёт `save_failed` второй раз | да / нет |
| W13 | Места 1–30: дать перекат крупных граней до 34-го — одну из досок 24–28 заменить короткой доской четвёрок на перекатах (как `fours-round-the-hole-1`, `D` 3,5) | `boards/row.json`, места 24–28 | game-designer | S | `node scripts/ladder.mjs campaign`, `npm test` | да / нет; [плейтест 4 ноября](docs/VI_Levels_Playtest_2026-11-04.md), раздел 6 |
| W14 | Рисовать ли вырезанную клетку так, чтобы её было видно и под костями (сейчас у неё только нет линий сетки; на 34-м её закрывали кости — доска поправлена, новая беда «вырез под костями» ловит такие доски) | `gridTexture` в `src/render/textures.ts`; [слой интерфейса](docs/art/VI_Interface_Layer.md) | владелец решает, исполняет чат вида | S | 360×640 и 1920×1080: вырез под костью читается | да / нет и как; [плейтест 4 ноября](docs/VI_Levels_Playtest_2026-11-04.md), раздел 7 |

## Отложено

| Что | Где | Почему отложено |
|---|---|---|
| Запись на площадку при уходе асинхронна; визит со сбоем чтения пишет в браузер | `src/platform/storage.ts:46-51`, `:91-99`, `src/app/game.ts:611-614` | P2, после задач 1–2 |
| WebGL: восстановление после потери контекста | `src/app/health.ts:108`, `src/display/layer.ts` | P2, нужна проверка на телефоне |
| Отмена хранит снимок на каждый тик | `src/app/game.ts:2483` | P2, вместе с задачей 7 |
| Ссылка «поделиться» прибита к sandbox | `platforms/playgama/adapter.ts:249` | до выхода в каталог |
| Тесты вида: `display`, `render/view.ts`, `shell/hud.ts`, `audio/engine.ts`, `signal/player.ts` | см. [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md), раздел 8 | L, по ходу задач в этих файлах |
| P3: ключ HUD из `JSON.stringify` (`src/shell/hud.ts:559`), два зонда `safe-area`, `'#ffffff'` мимо темы, печать под флагом (`src/app/game.ts:207`), сторож импорта `boardFiles.ts`, `@fontsource/forum` в `package.json`, `ctx.resume()` без catch (`src/audio/engine.ts:333`) | по путям | мелочь; брать попутно, своим набором файлов |
| План загрузки, задачи 1 и 7–9: замер, preload шрифта, README и передачи отдельными чанками | [план](docs/superpowers/plans/2026-10-15-vi-dead-code-and-loading.md) | слово владельца 15 октября: «загрузка пока не проблема»; задача 9 устарела |
| Бандл растёт вместе с рядом (`row.gen.ts` в главном чанке) | `src/levels/row.gen.ts`, `vite.config.ts` | P3: замер 4 ноября — 176 КБ исходника, но 10 КБ gzip; делить незачем |
