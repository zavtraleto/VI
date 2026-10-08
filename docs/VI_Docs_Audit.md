# Аудит документов VI

> Вид: исследование. Статус: черновик (ждёт решений владельца). Дата: 2026-10-08. Проверено: 2026-10-08.
> Снимок: `origin/main` 7780049, версия игры 0.2.25. План: docs/superpowers/plans/2026-10-08-vi-docs-cleanup.md.

Рабочий документ для агентов. Ничего в документах проекта этой сессией не менялось. Подробные записи по каждому документу (номера строк, проверки решений по коду) лежат вне репозитория, в папке заметок сессий: `audit-A-endless.md`, `audit-B-teaching.md`, `audit-C-levels.md`, `audit-D-art.md`.

## 1. Что в игре сейчас (точка отсчёта)

- Уровни: 30 досок `P01`–`P30` (`src/levels/levels.ts`), одна глава `probe` без ворот (`src/levels/recipes.ts:185`), уроков и окон перед уровнем нет. Правила — `docs/VI_Levels_Rules.md`.
- Endless: правила по `src/rules/config.ts`; последние слои — pace-v2 (дополнения 4–8) и «стекло не держит». Одной страницы с правилами Endless нет.
- На полке, код цел: обучение Endless (`?tutorial`), пазлы (`?tasks`) — `SHELVED` в `src/app/game.ts:117`. Сеанс дня из меню недостижим с 4 октября (d1a738b). Ворота глав выключены, `?gates=off` ничего не меняет. `settings.tutorialDone` пишется, но не читается.
- Все `?lab=*` и `?signal=` работают только в dev-сборке (`src/main.ts:25-26`).

## 2. Числа

- На `origin/main` в `docs/` 58 документов (не 63), плюс `CLAUDE.md` и `README.md`. `AGENTS.md` в `origin/main` нет: он есть только в резервных ветках `backup/main-folder-*`.
- Ещё 10 документов лежат только в других ветках (см. раздел 7).
- По видам: истина 9, решение 23, исследование 14, план 12.
- По действиям: архив 16, слить 2, править раздел 7 (плюс README и CLAUDE.md), шапка 30, оставить 3.
- Без ссылки из входных страниц (CLAUDE, README, ROADMAP): 24 из 58. Без единой ссылки откуда-либо: 10.

## 3. Таблица

Сокращения: VL — `docs/art/VI_Visual_Language.md`, IL — `docs/art/VI_Interface_Layer.md`, WL — `docs/art/VI_World_Logic.md`, Rules — `docs/VI_Levels_Rules.md`, specs/ и plans/ — `docs/superpowers/specs/` и `docs/superpowers/plans/`. Номера в графе «противоречит» — пункты раздела 4.

### Входные страницы

| Путь | Вид | Статус | Живёт в коде | Противоречит | Действие |
|---|---|---|---|---|---|
| README.md | истина | в силе | 36/36 путей, все флаги найдены, таблица структуры = `ls src` | 1, 2, 3, 6 | править раздел «вход» (строки 3–7) и описание сеанса дня |
| CLAUDE.md | истина (инструкции) | в силе | 24/24 путей; `ladder.mjs chapter=N` только при N=0; `teach.mjs` на P* пуст | 1, 5 | править раздел «Где что лежит» (см. раздел 8) |
| docs/ROADMAP.md | истина: план + журнал | в силе | 13/13 путей | 2, 3, 4, 7 | править разделы «Сделано», пазлы и задачи, «Платформа», языки, пустой хвост (157–159) |

### Правила и Endless

| Путь | Вид | Статус | Живёт в коде | Противоречит | Действие |
|---|---|---|---|---|---|
| specs/2026-10-01-vi-mvp-design.md | решение (слоистая спека) | построено (v0.1.0, b10a047); разд. 3–5, 7–12, 14–16 вытеснены pace-v2, glass и кодом | 9/10 имён; расходятся `sinkMs`, пороги высоты, меню, `rulesVersion` (0.9 в коде) | 1, 8 | слить в docs/VI_Endless_Rules.md (новая страница), спека — архив. Решение владельца №1 |
| docs/RITE_Design_MVP.md | решение (исходная спека) + исследование (разд. 2, 16) | вытеснено: specs/2026-10-01-vi-mvp-design.md | поле 7×7, формула очков есть; `stageForScore`, серверные таблицы — нет | 1 | архив |
| specs/2026-10-01-vi-puzzle-design.md | решение | построено (v0.1.0, af76641); из меню убрано 6 окт (6727db5), код за `?tasks` | 4/4 путей | 3 | шапка |
| specs/2026-10-03-vi-floor-and-islands-design.md | решение | построено (v0.2.0, d425e55) | 13/13 путей | 9 | шапка |
| specs/2026-10-02-vi-pace-design.md | решение + исследование | вытеснено: specs/2026-10-03-vi-pace-v2-design.md | 13/13 путей; `paceRatio`, `phaseLevels`, `calmMs` удалены | 8 | архив |
| specs/2026-10-03-vi-pace-v2-design.md | решение (основа + 8 дополнений) | построено (v0.2.2, 560e03b; доп. 7–8 — v0.2.3, a7b5cad) | 12/12 путей; числа последних дополнений = `DEFAULT_TUNING` | 8 | шапка с картой действующих чисел |
| specs/2026-10-07-vi-glass-does-not-hold-design.md | решение + отчёт | построено (v0.2.22, ac2d956; v0.2.23, e4d893b) | 20/20 путей | — | шапка |
| docs/VI_Randomness_Research.md | исследование + предложения | в силе; предложения C и E построены (560e03b), A, B, D, F — нет | 1/1 | 10 | шапка |
| docs/VI_Retention_Research.md | исследование + предложения | в силе; предложения 4, 6, 7 сделаны, но числятся ждущими | имена найдены | 10 | шапка |
| docs/VI_Playgama_Page.md | истина (тексты кабинета) | черновик | путей нет | 11 | править раздел со списком режимов и шагом 5 |
| plans/2026-10-01-vi-stage1-playable-endless.md | план | выполнен | 22/25; нет `src/input/dpad.ts`, `src/render/pips.ts`, `src/render/scene.ts` | — | архив |
| plans/2026-10-01-vi-stage2-vertical-slice.md | план | выполнен | 2/2; `OCCULT_THEME`, `stageForScore` нет | — | архив |
| plans/2026-10-03-vi-ads-in-world.md | план | не выполнен | 3/3 | — | шапка |
| plans/2026-10-03-vi-leaderboard-climb.md | план + отчёт | выполнен (v0.2.7, be4cca7) | 12/12 | — | архив |
| plans/2026-10-03-vi-performance.md | план + отчёт | выполнен (v0.1.0, 1d46b6a); этап 3 не выполнен | 19/19 | — | архив |

### Обучение

| Путь | Вид | Статус | Живёт в коде | Противоречит | Действие |
|---|---|---|---|---|---|
| specs/2026-10-01-vi-tutorial-design.md | решение | построено (v0.1.0, 8a0a73b); рельсы сняты aa85e5e; из меню убрано 6 окт, код за `?tutorial` | 8/9; нет `src/ui/tutorial.ts` | 12 | шапка |
| plans/2026-10-01-vi-tutorial.md | план | выполнен (v0.1.0, 48a834c) | 16/17; нет `src/ui/tutorial.ts`, `TutorialGuide`, `TUTORIAL_SCRIPT` | 12 | архив |
| docs/VI_Tutorial_Decisions.md | решение (+ непостроенный §5) | вытеснено: specs/2026-10-06-vi-levels-onboarding-design.md | 2/2 | 13 | архив |
| docs/VI_Tutorial_Research.md | исследование (+ решения §7) | в силе как материал; §7 и §10 вытеснены onboarding-design | 1/1 | 13 | шапка |
| specs/2026-10-06-vi-levels-onboarding-design.md | решение + отчёт (§14–15) | построено (v0.2.20, 6c05dcd; v0.2.21, ddc5073), убрано из игры d639e93; шаги 2–3 не построены | 21/21 путей; нет `softStuck`, `story*`, `lineHold`; `guard/until/story/guide` не читаются | 14, 15 | шапка |
| docs/VI_Levels_Onboarding_Decisions.md | решение (сводка, точка возврата к обучению) | в силе; построенное убрано из игры d639e93 | 17/17; пример `place=T04` устарел | 14 | оставить |
| docs/VI_Levels_Onboarding_Research.md | исследование | в силе | путей нет; битая ссылка (п. 16) | 16 | шапка |
| docs/VI_Levels_Teaching.md | план: решение + словарь (§2) + замеры (§7) | построено (v0.2.13, 43e334e); вытеснено: specs/2026-10-06-vi-levels-onboarding-design.md; убрано из игры d639e93 | 13/13; уроки на P* пусты | 14, 17 | слить в docs/VI_Levels_Onboarding_Decisions.md (словарь §2), остаток — архив |
| plans/2026-10-06-vi-levels-onboarding-1-rules-and-boards.md | план | выполнен (v0.2.20, 6c05dcd); результат убран d639e93 | 34/34 | — | архив |

### Уровни и боты

| Путь | Вид | Статус | Живёт в коде | Противоречит | Действие |
|---|---|---|---|---|---|
| docs/VI_Levels_Rules.md | истина | в силе (v0.2.25, 3abb5aa); в шапке стоит 0.2.21 | 10/10 | 18 | править раздел: шапка (версия), §4 и §12 (число мест с единицами) |
| docs/VI_Levels_Probe_Key.md | истина (ключ слепой пробы, закрыт от владельца) | в силе | 6/6; команды с `P06` работают | — | оставить; в индексе пометить «владельцу не показывать» |
| docs/VI_Levels_Brief.md | решение (§1) + исследование | в силе (§1); §4, §5, §7 вытеснены docs/VI_Production_Order_Research.md | 11/11; «кода под уровни нет» устарело | 19, 20 | шапка |
| docs/VI_Levels_Routes_Brief.md | решение + замер | построено (v0.2.24, 57beb71; v0.2.25, 3abb5aa); §11 выполнен | 18/18; `level=B13` не работает; битая ссылка (п. 16) | 21, 22 | шапка |
| docs/VI_Production_Order_Research.md | исследование + решение (§5) | в силе (§5); §3–4 — снимок до решения | 2/2 | 4 | шапка |
| docs/VI_TurnBased_Research.md | исследование | в силе как материал; предложения Р1–Р10, О1–О7 отменено (стр. 415) | 4/4 | 19 | шапка |
| docs/VI_Levels_Constraints.md | исследование (замер + решения) | вытеснено: specs/2026-10-04-vi-levels-types-design.md | путей нет | 20 | шапка |
| docs/VI_Levels_Reference_Research.md | исследование | в силе | путей нет | — | шапка |
| docs/VI_Levels_Progression_Research.md | исследование + замер + решения | построено (v0.2.12, 82846ea); ворота и числа глав вытеснены Rules §8 | 3/3; звёзды и предел живы (`progress.ts`), ворота выключены | 20, 23 | шапка |
| specs/2026-10-04-vi-levels-probe-design.md | решение | построено (v0.2.8, 320ee63); вытеснено: specs/2026-10-04-vi-levels-types-design.md | 25/26; нет `scripts/levels.mjs`, `PROBE_LEVELS` | 20, 24 | архив |
| specs/2026-10-04-vi-levels-types-design.md | решение | построено (v0.2.8, 320ee63); вытеснено: docs/VI_Levels_Rules.md | 14/15; нет `scripts/levels.mjs` | 20, 24 | архив |
| docs/VI_Levels_First20_Build.md | план: решения + замер | выполнен (v0.2.9, 31e3ba2); убрано из игры 57beb71 | 9/9; `slot=N`, `level=B13`, `climb=off` не работают | 21, 22 | архив |
| docs/VI_Levels_Backlog.md | план (отчёт + три постановки) | выполнен; вытеснено: docs/VI_Levels_Routes_Brief.md §11 | 16/16; B01–B23 нет | 21 | архив |
| specs/2026-10-07-vi-bots-design.md | решение | построено (v0.2.21, 0777bb1; Endless — 6da35b5) | 21/21; в тексте остались `climb=off`, `level=B13` (§12 их поправляет) | 22 | шапка |
| plans/2026-10-07-vi-bots-1-levels.md | план | выполнен (0777bb1) | 31/31 | — | архив |
| plans/2026-10-07-vi-bots-2-endless.md | план | выполнен (6da35b5) | 11/11 | — | архив |

### Арт, вид, звук

| Путь | Вид | Статус | Живёт в коде | Противоречит | Действие |
|---|---|---|---|---|---|
| docs/art/VI_World_Logic.md | истина | в силе | 9/9; устарели строки 86, 104–122 (выборочно), 175, 198 | 25, 26 | править раздел «Механики» (и «Голоса и приборы», «Звук») |
| docs/art/VI_Lore.md | истина | в силе | путей нет; строки 121–123 («конструктор — позже») устарели | — | оставить |
| docs/art/VI_Interface_Layer.md | истина | в силе | 31/31 путей, 42 имени найдены; DOM-интерфейса игрока в `src/` нет | 26 | править раздел «Что входит в слой» и «Порядок переноса» |
| docs/art/VI_Visual_Language.md | истина (ч. 1, 3.1, 8) + исследование (ч. 5, 6, 10) + снимок (ч. 2) | в силе; ч. 2 устарела («v0.2.10», «метки в ветке») | 2/2; 32 параметра есть | 25, 27 | править раздел «Часть 2»; добавить в индекс |
| docs/art/VI_Claims.md | истина (журнал) + предложения | черновик (одобрен только README R.1–R.14) | 2/2; уроки L.1–L.19 не звучат, уровней B05/B11/B13 нет | 26, 28 | править раздел «Уровни: окна правил, строки уроков»; добавить в индекс |
| docs/art/VI_Art_Direction_and_Signal_v01.md | исследование (черновик) + решения 2 окт | черновик; §2.1, 2.3, 3.3–3.5, 5.1, 6.2 вытеснены VL и IL | путей нет; меню и состояния контакта в коде другие | 27 | шапка |
| docs/art/VI_Shell_Research.md | исследование + решения 2 окт | вытеснено: docs/art/VI_Interface_Layer.md | путей нет; зоны меню ≠ `MENU_FILES` | 29 | шапка |
| docs/art/VI_Style_Research.md | исследование + «принято 2 окт» | черновик; §4.1.1 вытеснен IL | 1/1 | 29 | шапка |
| docs/art/VI_Juice_Research.md | исследование | в силе | путей нет | — | шапка |
| docs/art/VI_Signal_Director.md | исследование: принятое + построенное + предложения | в силе для построенного, черновик для предложений (строки 36–41, 62–69) | 4/4; числа сверены с `leak.ts`, `director.ts` | — | шапка |
| specs/2026-10-02-vi-board-look-design.md | решение | построено (v0.1.0, aa85e5e); вид костей вытеснен VL | 20/21 (нет `src/render/theme.ts`) | 30 | шапка |
| specs/2026-10-02-vi-display-foundation-design.md | решение | построено (v0.1.0, 21618fa) | 7/8 (нет `src/signal/scenes/seaPole.ts`) | 31 | шапка |
| specs/2026-10-02-vi-juice-design.md | решение | построено (v0.1.0, aa85e5e) | 4/4; пороги теперь в отправленных костях, не в очках | 30 | шапка |
| specs/2026-10-02-vi-program-shell-design.md | решение | построено (v0.1.0, 3793305); содержание, палитра, таблица файлов вытеснены IL | 4/4; нет `src/shell/object.ts` | 29 | архив |
| specs/2026-10-02-vi-scene-constructor-design.md | решение | построено (v0.1.0, aa85e5e) | 15/15 | — | шапка |
| specs/2026-10-03-vi-phone-view-design.md | решение | построено (v0.2.1, ab40693) в упрощённом виде; строки 1–148 (линза) отменено самой спекой | 11/11; `?lens=1` работает, по умолчанию 0 | 31 | шапка |
| specs/2026-10-03-vi-sound-design.md | решение | построено (v0.1.0, 964a9ff); на слух не проверено | 4/4 | — | шапка |

## 4. Противоречия

Формат: что расходится → что верно по коду → предложение.

**Входные страницы**

1. `README.md:5-6`, `CLAUDE.md:16`, `docs/ROADMAP.md:3` называют правилами игры RITE и mvp-design → правила Endless сейчас в `src/rules/config.ts:36-92`, pace-v2 и glass; уровней — в Rules → править три строки; решение №1.
2. `README.md:36,44-46,67`, `ROADMAP.md:5-11,115` описывают сеанс дня как играемый → в меню его нет с 4 окт (`src/shell/text.ts:88-100`, d1a738b) → править; решение №4.
3. `README.md:7`, `ROADMAP.md:126-135` подают пазлы и задачи как живые ↔ `ROADMAP.md:47` «убрано 6 октября» → верно `SHELVED` (`src/app/game.ts:117`) → править README и ROADMAP; решение №3.
4. `ROADMAP.md:11,33-43,56` держат обучение из шести уроков и вводный курс как сделанное и действующее ↔ `ROADMAP.md:22`, Rules:12 → курс убран 7 окт (d639e93, 57beb71) → пометить в «Сделано».
5. `CLAUDE.md:22` подаёт лестницу глав, ворота, уроки и курс как действующие ↔ `CLAUDE.md:24` (всё заменено пробой) → раздел сжать до ссылки на индекс.
6. `README.md:3` открывается как игра-Endless ↔ `CLAUDE.md:22` «основной режим — уровни» → править README.
7. `ROADMAP.md:137-139` «платформа — по команде» ↔ Bridge уже интегрирован (b98615c); `ROADMAP.md:143` «не закоммичено» ↔ 8e7c0d5 (v0.2.15); `ROADMAP.md:62` «возвращать ли подъём группы» ↔ построено (`config.ts:71`) → править.

**Endless**

8. pace-design ↔ pace-v2: фазы и `paceRatio` заменены линейным ростом; внутри pace-v2 разд. 1 и 4 и доп. 1–3 заменены доп. 4–8; `pace-v2:388` (прогоны ботов) ↔ `glass:96-102`; mvp-design разд. 8–10, 14–16 ↔ `config.ts` → pace-design «вытеснено», в шапке pace-v2 — какие дополнения действуют.
9. `floor-and-islands:16-47` (сход с причала) ↔ `glass:36-39`, `src/rules/movement.ts:76-81`; `floor-and-islands:28` (`floorClimb`) верно только для сессий (Rules:54, `src/rules/level.ts:141`) → оговорки в шапке.
10. `VI_Randomness_Research.md:23` «floorClimb выключен» ↔ `config.ts:16-18`; в Retention предложения 4, 6, 7 «ждут», хотя сделаны → шапки.
11. `VI_Playgama_Page.md:21-23,36` перечисляет EXERCISE, TASKS и правило «пока низко» → в игре нет → править.

**Обучение**

12. `specs/…tutorial-design.md:36-38` (рельсы) ↔ `src/rules/tutorial.ts:299-307` (свободный ход); `plans/…vi-tutorial.md:3-4` («раскладка модулей в силе») ↔ нет `src/ui/tutorial.ts` → шапка спеке, план в архив.
13. `VI_Tutorial_Decisions.md:45-46,52,68-98` и `VI_Tutorial_Research.md:139,148` (обучение в первой партии, пункт меню остаётся, «семь» и езду на боку не учим, 8 шагов) ↔ onboarding-design:34-59,83 → Decisions «вытеснено», §7 Research помечается.
14. onboarding-design, Onboarding_Decisions (`:16-18,141,152` в настоящем времени) и Teaching описывают уроки, окна, строку у доски ↔ Rules:106,118 и `src/levels/levels.test.ts:121-127` (в игре их нет с 7 окт) → в шапки «убрано из игры d639e93».
15. `onboarding-design:134,164` (`arrow` уходит, стрелка через `guide`) ↔ `src/rules/types.ts:433`, `game.ts:1964-1970` (`arrow` жив, `guide` не читается); `:299-306` (окна `story*` «есть») ↔ ключей нет в `i18n.ts` → пометить в шапке.
16. Битая ссылка на `docs/VI_Level_Generation_Deep_Research.md`: `VI_Levels_Routes_Brief.md:11,344`, `VI_Levels_Onboarding_Research.md:185`, `onboarding-design:9` → файл есть только в ветке `backup/main-folder-2026-10-06`; решение №7.
17. `VI_Levels_Teaching.md:59-61` (подъём с пола на стоящую кость) и `:54-55` (закрытый пол) ↔ Rules:31,52-54, `level.ts:141` → верно Rules; `Teaching:67-93` (26 мест) ↔ onboarding-design:30-43 → Teaching «вытеснено».

**Уровни**

18. `VI_Levels_Rules.md:3` «версия 0.2.21» ↔ 0.2.25; `Rules:48,146,148` («одна-две доски с единицами») ↔ `src/levels/recipes.ts` (три места) → править (страница заморожена: это правка описания, не правила).
19. `VI_Levels_Brief.md:5,145-153`, `VI_TurnBased_Research.md:282-289` («кода под уровни нет») ↔ `src/rules/level.ts`, `src/levels/progress.ts` → шапки.
20. Отмена хода: Brief:160 и probe-design:18 «нет» ↔ types-design:16 «сколько угодно» ↔ Rules:97 «три» → верно три (`level.ts:51`). Приход костей: Brief, probe-design, types-design, Constraints ↔ Rules:11,115 (отложен; у всех P* `arrival:'none'`). Предел ходов: types-design:17, Constraints:184 ↔ Progression:229 ↔ Rules:105 → верно `progress.ts:72-75` → оба спека 4 октября в архив.
21. Лестница B01–B23 и главы: First20_Build:33-104, Backlog:84,152, Progression:116-141, Routes_Brief:253-259 ↔ `levels.ts:32-62` (только P01–P30) → First20_Build и Backlog в архив.
22. Команды: `climb=off`, `level=B13`, `slot=N` (First20_Build:170-172, bots-design:338-339,479, Routes_Brief:102,133,179) ↔ `scripts/bots.mjs:48,115`, `scripts/ladder.mjs:40` (`climb=on`, `level=P06`, `place=P06`); `Routes_Brief:49-55,82,98,236` («строгого пола в коде ещё нет») ↔ построено → шапки.
23. Ворота глав: Progression:228,238 ↔ Rules:104,117 → ворот нет (`recipes.ts:185`); код ворот (`progress.ts:83-112`) и `?gates=off` (`game.ts:131`) мёртвые → решение №6.
24. Имена досок `p01`–`p08` (probe-design) и `c1`–`h3` (types-design) ↔ `P01`–`P30`: путаются при поиске → ещё один довод за архив.

**Арт и вид**

25. `WL:86` (знак прихода) ↔ `VL:485` → по коду верно VL (`src/render/textures.ts:64-87`) → править WL. `VL:88,126-133` («метки клеток только в ветке, v0.2.10») ↔ в main → править VL ч. 2.
26. `IL:89,92,96-99,105,107-108`, `WL:104-122,175` описывают обучение, задачи, окна уроков, ворота как часть игры ↔ `IL:109-110`, `game.ts:105-117`, `levels.ts` → пометить «до 7 октября» или «на полке».
27. Art_Direction ↔ VL и код: три визуальных языка (`:74-82`) ↔ один экран; светлая игра (`:79,112`) ↔ тёмная трубка; меню (`:192-199`) ↔ `text.ts:88-100`; контакт от счёта в 5 состояний (`:448`) ↔ 16 шагов по отправленным костям (`src/rules/ritual.ts:8-47`) → Art_Direction «черновик, частично вытеснен VL». В CLAUDE.md названа она, а VL — нет.
28. `VI_Claims.md:55` (строка 1.3) в коде не найдена; `Claims:167-221` (окна L.1–L.19) не звучат → сверить с владельцем при правке, содержание не трогать.
29. Меню и сцена: Shell_Research:77, Style_Research:119, program-shell:76-110,171 ↔ IL:28-69 и `text.ts`, `theme.ts:11,22-23`, `shell.ts:89` → program-shell в архив, исследованиям шапки.
30. board-look:24-123 (грани, точки, рёбра, пороги по очкам, «свечения нет») и juice-design:41-68 (пороги в очках) ↔ VL:139-165 и `src/render/params.ts:22,41,55`, `ritual.ts:18` → шапки «вид костей вытеснен VL».
31. phone-view:9-99 (линза по умолчанию, числа) ↔ `:150-165` и `params.ts` (lens=0); display-foundation:182,186 (лаборатория в обычной сборке) ↔ `main.ts:25-26` (только dev) → шапки.

## 5. Документы без ссылок

Ни одной ссылки ниоткуда (10): `docs/art/VI_Visual_Language.md`; планы stage1, stage2, tutorial, performance, onboarding-1, bots-1, bots-2; спеки program-shell, phone-view.

Нет ссылки из входных страниц, но ссылаются другие документы (14): `VI_Randomness_Research`, `VI_Retention_Research`, `VI_Tutorial_Decisions`, `VI_Tutorial_Research`, `art/VI_Claims`, `art/VI_Signal_Director`; спеки display-foundation, pace, pace-v2, scene-constructor, sound, levels-probe, levels-types, glass-does-not-hold.

В индекс обязательно: VL (главная страница по виду), Claims (`VI_Lore.md:22` требует сверять с ним любой текст лора).

## 6. Первый прогон будущего `scripts/docs-check.mjs`

Пути из документов, которых нет в коде:

| Документ | Нет в коде |
|---|---|
| plans/2026-10-01-vi-stage1-playable-endless.md | `src/input/dpad.ts`, `src/render/pips.ts`, `src/render/scene.ts` |
| plans/2026-10-01-vi-tutorial.md | `src/ui/tutorial.ts` |
| specs/2026-10-01-vi-tutorial-design.md | `src/ui/tutorial.ts` |
| specs/2026-10-02-vi-board-look-design.md | `src/render/theme.ts` |
| specs/2026-10-02-vi-display-foundation-design.md | `src/signal/scenes/seaPole.ts` |
| specs/2026-10-02-vi-program-shell-design.md | `src/shell/object.ts` |
| specs/2026-10-04-vi-levels-probe-design.md | `scripts/levels.mjs` |
| specs/2026-10-04-vi-levels-types-design.md | `scripts/levels.mjs` |

Битые ссылки на документы: `VI_Level_Generation_Deep_Research.md` (три места, п. 16). Остальные ссылки в 60 страницах целы.

Команды и флаги, которые названы, но не работают как написано: `ladder.mjs slot=N`, `ladder.mjs chapter=N` при N>0, `ladder.mjs place=T04`, `bots.mjs level=B13`, `bots.mjs climb=off`, `?gates=off` (без эффекта), `teach.mjs` (работает, но уроков нет). Все живые документы после шага 3 должны проходить эту проверку; архив из неё исключается.

Мелочь вне документов: мёртвые подписи `tune_spawnStartMs`, `tune_sparseFactor` в `src/ui/devText.ts`.

## 7. Документы вне `origin/main`

| Путь | Ветка |
|---|---|
| docs/VI_Level_Generation_Deep_Research.md | backup/main-folder-2026-10-06 |
| docs/VI_Story_Brief.md | backup/main-folder-2026-10-05-before-sync, backup/main-folder-2026-10-06 |
| AGENTS.md | backup/main-folder-* (старая копия CLAUDE.md) |
| docs/VI_Level_Types_Research.md, docs/VI_Levels_First20.md, specs/2026-10-04-vi-levels-board-shape-design.md, specs/2026-10-04-vi-levels-first20-design.md | claude/nice-chebyshev-0be447 |
| specs/2026-10-08-vi-first-level-design.md, specs/2026-10-08-vi-teaching-road-design.md, plans/2026-10-08-vi-first-level.md, plans/2026-10-08-vi-teaching-road.md | first-level (живая работа, придёт в main сама; шапки по образцу ставить при слиянии) |

## 8. CLAUDE.md: что остаётся, что переезжает

Остаётся (до 40 строк):

- «Модели» — как есть (7 строк).
- «Где что лежит» — три строки: структура кода в `README.md`; все документы с видом и статусом — индекс `docs/README.md`; перед правкой области прочитать её страницу-истину из индекса.
- «Работа» — как есть (11 пунктов), плюс три правила документов: новый документ начинается с шапки (вид, статус, дата); спеки и исследования после принятия не правятся, меняется только шапка; правка игры, которая расходится со страницей-истиной, правит эту страницу в том же коммите; `node scripts/docs-check.mjs` входит в проверку.
- Два запрета, которые нельзя терять при переезде: ключ пробы (`docs/VI_Levels_Probe_Key.md`) владельцу не показывать; правила уровня заморожены, правка хода уровня — только по слову владельца с записью в Rules.

Переезжает в `docs/README.md` (индекс): весь нынешний раздел «Где что лежит» (строки 14–25) в виде таблицы «область → страница-истина → решения → исследования → команды», без хроники («с 5 октября», «первая поставка собрана…»). Хроника уже есть в ROADMAP и сообщениях коммитов. В индекс добавить VL и Claims, которых сейчас нет нигде.

## 9. Решения, которые нужны от владельца

1. Правила Endless: выжать действующее из mvp-design, pace-v2 и glass в одну живую страницу `docs/VI_Endless_Rules.md`, спеки в архив или под шапку (А) — или оставить mvp-design «правилами» и править на месте (Б)? Предложение: А.
2. `docs/RITE_Design_MVP.md` — в архив? Предложение: да.
3. Код пазлов (`?tasks`) и обучения Endless (`?tutorial`): удалить (А), оставить на полке (Б)? ROADMAP ждёт этого решения с 6 октября. От ответа зависит статус двух спек.
4. Сеанс дня: в меню его нет с 4 октября. Убрать из README и ROADMAP как режим (А) или он вернётся (Б)?
5. Архив: 16 документов по таблице уезжают в `docs/archive/` — да/нет? (Все — вытесненные спеки и выполненные планы.)
6. Ворота глав и `?gates=off`: мёртвый код — удалить (А), оставить до решения о прогрессии (Б)?
7. `VI_Level_Generation_Deep_Research.md` и `VI_Story_Brief.md` лежат только в резервной ветке: внести в main (А) или убрать ссылки (Б)?
8. `AGENTS.md`: в main его нет. Не заводить — да/нет?
9. Art_Direction v0.1: шапка «черновик, частично вытеснен Visual_Language», а в индексе главной по виду назвать Visual_Language — да/нет?
10. Худой CLAUDE.md и индекс `docs/README.md` по разделу 8 — да/нет?
11. ROADMAP: «Сделано» ужать до того, что в игре сейчас, остальное — в журнал внизу страницы (А) или только пометить убранное (Б)?

## 10. Опись

«Другие документы» — число документов в `docs/` (кроме ROADMAP), где встречается имя файла.

| Путь | Строк | Дата | Коммитов | Входные страницы | Другие документы |
|---|---|---|---|---|---|
| CLAUDE.md | 39 | 2026-10-07 | 19 |  | 4 |
| README.md | 157 | 2026-10-07 | 30 | CLAUDE | 7 |
| docs/RITE_Design_MVP.md | 322 | 2026-10-01 | 1 | README | 3 |
| docs/ROADMAP.md | 159 | 2026-10-07 | 21 | CLAUDE, README | 12 |
| docs/VI_Levels_Backlog.md | 191 | 2026-10-05 | 3 | CLAUDE | 7 |
| docs/VI_Levels_Brief.md | 268 | 2026-10-04 | 2 | CLAUDE | 4 |
| docs/VI_Levels_Constraints.md | 188 | 2026-10-04 | 1 | CLAUDE | 4 |
| docs/VI_Levels_First20_Build.md | 175 | 2026-10-07 | 5 | CLAUDE | 8 |
| docs/VI_Levels_Onboarding_Decisions.md | 226 | 2026-10-07 | 3 | CLAUDE, ROADMAP | 3 |
| docs/VI_Levels_Onboarding_Research.md | 202 | 2026-10-06 | 1 | CLAUDE, ROADMAP | 3 |
| docs/VI_Levels_Probe_Key.md | 1416 | 2026-10-07 | 2 | CLAUDE, README, ROADMAP | 1 |
| docs/VI_Levels_Progression_Research.md | 285 | 2026-10-05 | 1 | CLAUDE | 7 |
| docs/VI_Levels_Reference_Research.md | 175 | 2026-10-04 | 1 | CLAUDE | 3 |
| docs/VI_Levels_Routes_Brief.md | 388 | 2026-10-07 | 5 | CLAUDE, ROADMAP | 5 |
| docs/VI_Levels_Rules.md | 148 | 2026-10-07 | 6 | CLAUDE, ROADMAP | 8 |
| docs/VI_Levels_Teaching.md | 201 | 2026-10-07 | 5 | CLAUDE, ROADMAP | 8 |
| docs/VI_Playgama_Page.md | 45 | 2026-10-03 | 1 | README | 1 |
| docs/VI_Production_Order_Research.md | 184 | 2026-10-07 | 2 | CLAUDE, ROADMAP | 4 |
| docs/VI_Randomness_Research.md | 156 | 2026-10-02 | 1 |  | 4 |
| docs/VI_Retention_Research.md | 323 | 2026-10-03 | 1 |  | 4 |
| docs/VI_TurnBased_Research.md | 525 | 2026-10-04 | 1 | CLAUDE | 6 |
| docs/VI_Tutorial_Decisions.md | 126 | 2026-10-04 | 1 |  | 2 |
| docs/VI_Tutorial_Research.md | 250 | 2026-10-04 | 1 |  | 5 |
| docs/art/VI_Art_Direction_and_Signal_v01.md | 785 | 2026-10-02 | 2 | CLAUDE, ROADMAP | 7 |
| docs/art/VI_Claims.md | 272 | 2026-10-07 | 12 |  | 10 |
| docs/art/VI_Interface_Layer.md | 137 | 2026-10-07 | 30 | CLAUDE, ROADMAP | 16 |
| docs/art/VI_Juice_Research.md | 152 | 2026-10-02 | 1 | CLAUDE, ROADMAP | 4 |
| docs/art/VI_Lore.md | 154 | 2026-10-02 | 1 | CLAUDE, ROADMAP | 9 |
| docs/art/VI_Shell_Research.md | 159 | 2026-10-02 | 1 | CLAUDE, ROADMAP | 4 |
| docs/art/VI_Signal_Director.md | 167 | 2026-10-02 | 1 |  | 1 |
| docs/art/VI_Style_Research.md | 212 | 2026-10-02 | 1 | CLAUDE | 1 |
| docs/art/VI_Visual_Language.md | 567 | 2026-10-06 | 4 |  | 0 |
| docs/art/VI_World_Logic.md | 241 | 2026-10-07 | 32 | CLAUDE, ROADMAP | 23 |
| docs/superpowers/plans/2026-10-01-vi-stage1-playable-endless.md | 133 | 2026-10-01 | 2 |  | 0 |
| docs/superpowers/plans/2026-10-01-vi-stage2-vertical-slice.md | 74 | 2026-10-01 | 1 |  | 0 |
| docs/superpowers/plans/2026-10-01-vi-tutorial.md | 352 | 2026-10-01 | 3 |  | 0 |
| docs/superpowers/plans/2026-10-03-vi-ads-in-world.md | 35 | 2026-10-03 | 1 | ROADMAP | 0 |
| docs/superpowers/plans/2026-10-03-vi-leaderboard-climb.md | 71 | 2026-10-04 | 4 | ROADMAP | 0 |
| docs/superpowers/plans/2026-10-03-vi-performance.md | 231 | 2026-10-03 | 1 |  | 0 |
| docs/superpowers/plans/2026-10-06-vi-levels-onboarding-1-rules-and-boards.md | 713 | 2026-10-06 | 1 |  | 0 |
| docs/superpowers/plans/2026-10-07-vi-bots-1-levels.md | 120 | 2026-10-07 | 1 |  | 0 |
| docs/superpowers/plans/2026-10-07-vi-bots-2-endless.md | 744 | 2026-10-07 | 1 |  | 0 |
| docs/superpowers/specs/2026-10-01-vi-mvp-design.md | 309 | 2026-10-02 | 11 | CLAUDE, README, ROADMAP | 4 |
| docs/superpowers/specs/2026-10-01-vi-puzzle-design.md | 63 | 2026-10-01 | 2 | README, ROADMAP | 1 |
| docs/superpowers/specs/2026-10-01-vi-tutorial-design.md | 119 | 2026-10-01 | 6 | ROADMAP | 4 |
| docs/superpowers/specs/2026-10-02-vi-board-look-design.md | 191 | 2026-10-02 | 1 | ROADMAP | 1 |
| docs/superpowers/specs/2026-10-02-vi-display-foundation-design.md | 244 | 2026-10-02 | 2 |  | 4 |
| docs/superpowers/specs/2026-10-02-vi-juice-design.md | 70 | 2026-10-02 | 1 | ROADMAP | 1 |
| docs/superpowers/specs/2026-10-02-vi-pace-design.md | 164 | 2026-10-02 | 1 |  | 2 |
| docs/superpowers/specs/2026-10-02-vi-program-shell-design.md | 243 | 2026-10-02 | 1 |  | 0 |
| docs/superpowers/specs/2026-10-02-vi-scene-constructor-design.md | 66 | 2026-10-02 | 1 |  | 1 |
| docs/superpowers/specs/2026-10-03-vi-floor-and-islands-design.md | 103 | 2026-10-03 | 1 | README | 1 |
| docs/superpowers/specs/2026-10-03-vi-pace-v2-design.md | 389 | 2026-10-03 | 2 |  | 2 |
| docs/superpowers/specs/2026-10-03-vi-phone-view-design.md | 174 | 2026-10-03 | 4 |  | 0 |
| docs/superpowers/specs/2026-10-03-vi-sound-design.md | 218 | 2026-10-03 | 1 |  | 1 |
| docs/superpowers/specs/2026-10-04-vi-levels-probe-design.md | 277 | 2026-10-04 | 1 |  | 3 |
| docs/superpowers/specs/2026-10-04-vi-levels-types-design.md | 261 | 2026-10-04 | 2 |  | 1 |
| docs/superpowers/specs/2026-10-06-vi-levels-onboarding-design.md | 407 | 2026-10-07 | 3 | CLAUDE, ROADMAP | 8 |
| docs/superpowers/specs/2026-10-07-vi-bots-design.md | 522 | 2026-10-07 | 3 | CLAUDE, README, ROADMAP | 5 |
| docs/superpowers/specs/2026-10-07-vi-glass-does-not-hold-design.md | 114 | 2026-10-07 | 2 |  | 2 |
