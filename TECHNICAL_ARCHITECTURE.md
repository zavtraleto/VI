# VI — техническая архитектура

> Вид: истина. Статус: в силе. Дата: 2026-11-04.

Кто правит: директор студии; при расхождении с кодом правится в том же коммите.

Как устроен код: модули и их связи, инварианты, цикл, сборка, платформы, хранилище, тесты, инструменты, риски. Что лежит в каждой папке подробно — таблица «Структура» в [README.md](README.md); правила игры — страницы-истины из [docs/README.md](docs/README.md). Снимок: `main` на `1d44051` (0.2.93); числа строк — 4 ноября 2026, комментарии входят.

## 1. Стек

TypeScript 7.0 (`strict`, `noUnused*`, target ES2022), Vite 8.3 (сборка rolldown), three.js 0.186, Vitest 5.0, Node 24 в CI. Рантайм-зависимости: `three`, `@fontsource/dotgothic16` (`@fontsource/forum` не используется). Dev: `@playgama/bridge`, `javascript-obfuscator`, `lil-gui`, `fflate`, `opentype.js`, `subset-font`. Звук — WebAudio в коде, без файлов. Один канвас WebGL, интерфейс рисуется в нём же.

## 2. Карта модулей

| Папка | Назначение | Файлов / строк (прод) | Тест-файлов |
|---|---|---|---|
| `src/main.ts` | вход: платформа, хранилище, настройки, игра или лаборатория | 1 / 70 | 0 |
| `src/rules` | чистая детерминированная симуляция; решатель и боты уровней и Endless | 25 / 6261 | 23 |
| `src/app` | игровой цикл (`game.ts`), раннер, сок, статистика, архив и журналы, переходы, подсказки, телеметрия, сохранённая партия | 28 / 5414 | 19 |
| `src/levels` | ряд кампании из `boards/`, генераторы, отбор и мерила досок, прогресс и звёзды, шкала D | 44 / 18921 (9334 — `row.gen.ts`) | 36 |
| `src/input` | клавиатура, жесты, повтор | 4 / 401 | 3 |
| `src/render` | three.js: поле, кости, фигура, сетка, вода, искры, кадр | 26 / 6980 | 13 |
| `src/display` | единственный рендерер и канвас, слои, вывод, линза, PS1-материал, качество, governor | 10 / 2260 | 5 |
| `src/signal` | передачи: места, предметы, композиция, проигрыватель | 29 / 4815 | 10 |
| `src/shell` | единый слой интерфейса в канвасе; `theme.ts` — цвета, шрифт, сетка | 28 / 8423 | 15 |
| `src/lab` | лаборатории `?lab=…`, мастерская уровней и её клиент | 33 / 6862 | 12 |
| `src/audio` | синтез звука: строй, партитура событий, голоса, движок | 8 / 2797 | 5 |
| `src/ui` | тексты на семи языках (`i18n.ts`, `lang/`), инструменты разработки | 16 / 2018 | 2 |
| `src/platform` | тип `Platform` и `none`, хранилище, настройки, Telegram | 4 / 668 | 3 |
| `platforms/` | адаптеры площадок и плагины сборки | 6 / 537 | 2 |
| **Итого** | | 263 / 66433 | 148 |

Вне кода: `boards/` — 435 досок `.txt`, `boards/row.json` (ряд), кэш мерил `boards/.measures/` (в git); `docs/`; `scripts/*.mjs`. Самые большие файлы: `src/levels/row.gen.ts` (генерируется), `src/app/game.ts` 2954, `src/render/view.ts` 1464, `src/shell/hud.ts` 1301, `src/audio/score.ts` 1092, `src/shell/screens/panel.ts` 1084, `src/render/water.ts` 1066.

## 3. Зависимости и инварианты

Направление: `rules` ← все; `display` — лист; `app` собирает `rules`, `levels`, `render`, `display`, `signal`, `shell`, `audio`, `platform`; `lab` читает всех и в продакшн не входит.

Инварианты (держатся сейчас, проверено 4 ноября):

1. `src/rules` в прод-коде не импортирует ничего вне себя и ни одного пакета; нет `Math.random`, `Date.now`, `performance.now`, DOM. Случайность — только `src/rules/rng.ts` по `state.rng`.
2. Визуал, звук и интерфейс берут из правил только чтение (`cubeAt`, `previewMove`, типы); `step` и `createRun` вне `app` и `levels` — только в тестах.
3. `src/display` не импортирует ни одной папки `src`.
4. Площадка — только через `@platform` (`src/main.ts`, `src/app/game.ts`, `src/app/health.ts`, `src/platform/storage.ts`); алиас — `tsconfig.json` `paths` и `vite.config.ts` `resolve.alias`.
5. Интерфейс игрока — канвас через `src/shell`, цвета и шрифт — `src/shell/theme.ts`; DOM вне `src/ui` и `src/lab` — только холсты, контейнер поля, зонды `safe-area` и `<textarea>` копирования.
6. Два семейства ботов друг на друга не ссылаются — держит `src/rules/families.test.ts`.

Известные отступления (живут, но не образец для нового кода):

| Что | Где |
|---|---|
| Двусторонние связи `app` ↔ `audio`, `shell` ↔ `render`, `shell` ↔ `signal`, `levels` ↔ `app` | `src/audio/engine.ts:1`, `src/audio/score.ts:1-4`; `src/levels/library.ts:7` → `src/app/boardProbe.ts` |
| Настройки знают ряд и правила | `src/platform/settings.ts:1-3` (`RULES_VERSION`, `CAMPAIGN`, `placeOfCode`) |
| `levels` → `shell` и `ui` | `src/levels/boardSvg.ts:2` (тема), `src/levels/rules.ts:2` (тип `TextKey`) |
| Литерал цвета мимо темы | `src/shell/hud.ts:735`, `:1145` (`'#ffffff'`); белые маски `pixelText.ts`, `space.ts` допустимы |
| `localStorage` мимо слоя хранилища | `src/app/game.ts:264`, `:276` (ключ `vi.samples.v2`) |
| Два зонда `safe-area` | `src/shell/hud.ts:398-411`, `src/shell/shell.ts:30-48` |

## 4. Цикл и шаг симуляции

- Шаг правил — `TICK_MS = 20` (`src/rules/config.ts:3`); `createRun` и `step(state, cmd)` — `src/rules/sim.ts`. Состояние `RunState` — простой JSON (`src/rules/types.ts`), PRNG — число `state.rng` (`src/rules/rng.ts`). Правила уровня поверх того же шага — `src/rules/level.ts`.
- `Runner` (`src/app/runner.ts`) переводит время кадра в целые шаги и пишет журнал команд `log: { tick, dir }[]`; предел кадра — 250 мс в сессии, 40 мс на уровне (`frameBound`). Возвращает долю следующего шага для интерполяции.
- `src/app/game.ts` — кадр: ввод → раннер → события правил → сок, звук, передачи → вид поля → показания и панели → вывод. Отчёт площадке и запись настроек откладываются с кадра хода (`src/app/later.ts`).
- Отмена хода на уровне — снимки состояния `structuredClone` на каждом тике с движением (`src/app/game.ts:2483`).

## 5. Сборка и выкладка

- `npm run build` = `tsc --noEmit && vite build`; конфиг — `vite.config.ts`: `base './'`, версия из `package.json` в `import.meta.env.VI_VERSION`, без sourcemap, чанк `vendor` для `node_modules`. Код игры, `vendor`, воркер подсказки комбо, строки `?perf`; лабораторий и инструментов разработки в сборке нет (`import.meta.env.DEV`).
- `VI_PLATFORM` (только `vite build`): `@platform` → `platforms/none.ts` или `platforms/<имя>/adapter.ts`; плагины площадок — `platforms/plugins.ts`. Дев-сервер, тесты и Pages — всегда `none`.
- Обфускация — только `VI_OBFUSCATE=1` (`javascript-obfuscator`, чанк `vendor` не трогает).
- `npm run pack -- playgama|crazygames` (`scripts/pack.mjs`) — сборка под площадку и zip в `release/vi-<версия>-<площадка>.zip`.
- `.github/workflows/deploy.yml`: на push в `main` — `npm ci`, `npm test`, `npm run build`, выкладка `dist/` на GitHub Pages. `docs-check` в CI не входит.
- Дев-сервер `vite` на 5183 (`.claude/launch.json`: `vi-dev`; `vi-build` — `vite preview` на 5184); плагин `vite.boards.ts` даёт мастерской API `/__boards` только в `serve`.
- Размер (сборка 30 октября): код игры 707 КБ (239 gzip; `row.gen.ts` — 176 КБ исходника), `vendor` 546 КБ, Bridge 307 КБ.

## 6. Платформы

Тип `Platform` — `src/platform/platform.ts`: `init`, `language`, `now`, `storage`, `tell`, `onPause`, `onAudio`, `interstitial`, `rewarded` и флаги поддержки, `track`, `trackPerformance`, `leaderboard`, `share`, `gameUrl`, `auth`. Устройство и как добавить площадку — [спека слоя платформы](docs/superpowers/specs/2026-10-15-vi-platform-layer-design.md).

| Адаптер | Что реализует |
|---|---|
| `none` (`src/platform/platform.ts`, `platforms/none.ts`) | ничего: хранилище — браузер, реклама — нет, `share` — системный или буфер |
| `platforms/playgama/adapter.ts` | Bridge SDK: `init` с терпением 8 с, язык, серверное время, хранилище, сообщения, пауза и звук, межстраничная и по желанию (на экране ждётся не дольше 60 с, `AD_OPEN_MS`), аналитика и `performance_sample`, таблица игроков, вход, `gameUrl` песочницы |
| `platforms/crazygames/adapter.ts` | SDK v3: `init` с терпением 8 с, язык, хранилище `data`, gameplay start/stop, пауза на рекламу, звук; реклама только при `VITE_CRAZYGAMES_ADS=on`; аналитики, таблицы и входа нет |

Кабинеты и выгрузка — `platforms/playgama/README.md`, `platforms/crazygames/README.md`; события аналитики — [docs/VI_Analytics.md](docs/VI_Analytics.md).

## 7. Хранилище

Один слой — `src/platform/storage.ts`: без площадки — `localStorage`, на площадке — `platform.storage` (все ключи читаются одним вызовом в `src/main.ts`, дальше копия в памяти, запись всех ключей одним вызовом). Чтение площадки ждётся не дольше 3 с (`READ_PATIENCE_MS`): не ответила или отказала — визит идёт на `localStorage`. Сбой — событие `save_failed`.

| Ключ | Где объявлен | Что |
|---|---|---|
| `vi.settings.v3` | `src/platform/settings.ts` (`SETTINGS_KEY`) | настройки, рекорды Endless, прогресс ряда, звёзды и статистика мест, сеансы вживую |
| `vi.run.v1` | `src/app/savedRun.ts` (`RUN_KEY`) | прерванная партия Endless; не поднимается под другими `KeptRun.version` (`KEPT_VERSION`, сейчас 2) и `RULES_VERSION`, и не той формы |
| `vi.samples.v2` | `src/app/game.ts` | ступень качества, срок 3 дня; только `localStorage` |

Версия — в имени ключа; цепочки переносов между ключами нет. Старые формы правит `loadSettings()` по полям; перенос прогресса дороги на ряд — `toRowEdition()`. Битое сохранение запуск не роняет: поле не того вида берёт значение по умолчанию (`mend` в `settings.ts`), не разобранное целиком — умолчания, партия не той формы отпускается; во всех случаях `save_failed` с `parse`. Держат тесты `src/platform/settings.test.ts`, `src/platform/storage.test.ts`, `src/app/savedRun.test.ts`.

Правило: меняется форма `RunState` или его правил (`RulesConfig`) — поднимается `KeptRun.version` (`KEPT_VERSION` в `src/app/savedRun.ts`) или `RULES_VERSION`; сторож — тест формы в `src/app/savedRun.test.ts` (`KEPT_FORM`).

## 8. Тесты

Vitest, блок `test` в `vite.config.ts`: `src/**/*.test.ts`, `platforms/**/*.test.ts`, окружение node, тайм-аут 20 с; 148 файлов, прогон около минуты. Покрытие по папкам (тест-файлов на исходники): `rules` 23/25, `levels` 36/44, `app` 19/28, `shell` 15/28, `render` 13/26, `signal` 10/29, `display` 5/10, `audio` 5/8, `platform` 3/4 и `platforms` 2/3, `input` 3/4, `ui` 2/16.

Тонко:

- `src/app/game.ts` — без теста (отмена, реклама после отмен, сохранение при уходе, возврат, награды); также `standings.ts`, `stats.ts`, `clock.ts`, `hints.ts`.
- `src/display/present.ts`, `layer.ts`, `display.ts`; `src/render/view.ts`, `water.ts`, `cubes.ts`; `src/shell/hud.ts` (косвенно — `hudLayout.test.ts`), `shell.ts`, `kit.ts`, `screens/panel.ts`; `src/audio/engine.ts`; `src/signal/player.ts`.
- Хрупкие: время на стене (`src/app/signWay.test.ts:177-180`, `src/levels/depth.test.ts:55-59`), 22 теста с тайм-аутом от 10 с, `src/levels/row.test.ts:129-134` закрепляет 100 мест и места сеансов.

## 9. Инструменты разработки

| Что | Адрес или команда | Где |
|---|---|---|
| Список лабораторий | `?lab` | `src/lab/labIndex.ts` |
| Мастерская уровней | `?lab=workshop` | `src/lab/workshop.ts`, API `vite.boards.ts` |
| Поле, сок, звук, оболочка, сцены | `?lab=board`, `?lab=juice`, `?lab=sound`, `?lab=shell&screen=…`, `?lab=sea_pole&variant=b` | `src/lab/` |
| Панель плейтеста, дебаг-панель | пауза → DEV / PLAYTEST; `?debug` | `src/ui/devtools.ts`, `src/ui/debug.ts` |
| Замер, качество, вид (любая сборка) | `?perf`, `?msaa=`, `?view=` и др. | `src/ui/perf.ts`, `src/display/quality.ts`, `src/render/params.ts` |
| Место ряда напрямую | `?levels`, `?place=R05` | `src/app/game.ts` |
| Ряд из файлов | `npm run row` (`check`, `report`) | `scripts/row.mjs` → `src/levels/row.gen.ts` |
| Боты уровней / Endless | `node scripts/bots.mjs`, `node scripts/pace.mjs` | `src/rules/levelBot.ts`, `src/rules/bot.ts` |
| Доски и ряд | `node scripts/level.mjs`, `scripts/ladder.mjs`, `scripts/lay.mjs`, `scripts/library.mjs`, `scripts/stars.mjs`, `scripts/teach.mjs` | [docs/VI_Levels_Lab.md](docs/VI_Levels_Lab.md) |
| Архив вымышленных игроков | `node scripts/archive.mjs` | → `src/app/archiveData.ts` |
| Шрифты | `npm run fonts` | `scripts/subset-fonts.mjs`, `scripts/cyrillic-font.mjs` |
| Документы | `node scripts/docs-check.mjs` | индекс, шапки, ссылки, пути кода в истинах |

## 10. Производительность

- Качество подстраивает governor (`src/display/governor.ts`): ступенями убавляет сглаживание, плотность холста, ореол и возвращает их, когда устройство держит 60 кадров; ступень помнится три дня. Параметры — README, «Замер производительности».
- Бережно: объекты three.js переиспользуются, шейдеры и геометрия освобождаются, слои холста заливаются частями.
- Два заметных расхода: показания каждый кадр строят ключ из ~10 `JSON.stringify` (`src/shell/hud.ts:559`, `:570`); отмена хранит снимок на каждом тике с движением (`src/app/game.ts:2483`).

## 11. Известные риски

P0 — ломает игрока; P1 — ломает выпуск или развитие; P2 — долг; P3 — мелочь. Здесь — P1; P2 и P3 — в задачах [TASKS.md](TASKS.md).

| # | Риск | Где |
|---|---|---|
| R1 | Чтение сохранений с площадки ждёт без тайм-аута: SDK не ответил — чёрный экран навсегда, `game_ready` не уходит. Исправлено (предел 3 с), ждёт QA | `src/platform/storage.ts:38`, `src/main.ts:19` |
| R2 | Сохранение с «битым по типам» полем роняет каждый запуск: проверяется только верхний уровень, `loadSettings()` без try. Исправлено (проверка по полям), ждёт QA | `src/platform/settings.ts:128-144`, `src/platform/storage.ts:66`, `src/main.ts:21` |
| R3 | Сохранённая партия проверяется по `RULES_VERSION` (`'0.9'` с 3 октября), а форма `RunState`/`RunConfig` менялась (`c2c5c48`, `fef9bab`). Исправлено (`KEPT_VERSION` 2 и тест формы), ждёт QA | `src/rules/config.ts:10`, `src/app/savedRun.ts:31-38`, `:49` |
| R4 | `game.ts` — бог-объект без тестов и главная точка конфликтов (32 коммита с 15 октября) | `src/app/game.ts`: отмена `:1311-1351`, сохранение `:690-760` |
| R5 | Страница-истина ROADMAP описывает 0.2.25 и 30 досок; агенты читают её первой | `docs/ROADMAP.md:3`, `:10-14` против `src/levels/row.test.ts:129-134` |

## 12. Горячие точки

Чаще всего менялись с 15 октября: `src/app/game.ts` (32 коммита), `src/levels/row.gen.ts` (27; при конфликте — пересобрать `npm run row`, не сливать руками), `src/levels/grammar.ts` (22), `src/shell/hud.ts` (21), `src/shell/text.ts` (20), `src/shell/panels.ts` (17). Параллельные задачи не должны делить эти файлы. `src/app/game.ts` не переписывать целиком: выносить по куску с тестом там, где правок больше всего, по ходу ближайших задач.
