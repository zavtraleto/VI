# VI — индекс документов

Все документы проекта по областям. У каждого в шапке вид, статус и дата; здесь — куда идти. Порядок чтения в области: сначала **истина** (как игра устроена сейчас), потом решения, исследования — только если задача на них ссылается. Проверка индекса, шапок и ссылок — `node scripts/docs-check.mjs`.

Виды: **истина** правится на месте; **решение** (спека, бриф) и **исследование** датированы и не правятся, меняется только шапка; **план** живёт, пока не выполнен.

## Игра и порядок работ

| Документ | Вид | Что в нём |
|---|---|---|
| [ROADMAP.md](ROADMAP.md) | истина | что в игре сейчас, порядок работ, журнал убранного |
| [VI_Production_Order_Research.md](VI_Production_Order_Research.md) | исследование | порядок работ, принятый владельцем 7 октября 2026, — раздел 5 |

## Уровни (основной режим)

| Документ | Вид | Что в нём |
|---|---|---|
| [VI_Levels_Rules.md](VI_Levels_Rules.md) | истина | правила уровня; заморожены 7 октября 2026, идеи правил — в её раздел 11 |
| [VI_Levels_Probe_Key.md](VI_Levels_Probe_Key.md) | истина | ключ слепой пробы `P01`–`P30`; **владельцу не показывать и не пересказывать** |
| [VI_Levels_Routes_Brief.md](VI_Levels_Routes_Brief.md) | решение | формы и маршруты уровня, постройка доски от маршрута, слепая оценка |
| [VI_Levels_Brief.md](VI_Levels_Brief.md) | решение | уровни — основной режим (раздел 1); остальное — материал на 4 октября |
| [VI_Levels_Onboarding_Decisions.md](VI_Levels_Onboarding_Decisions.md) | решение | точка возврата к обучению: слова владельца, голос текста, темп, словарь, где лежит убранное |
| [superpowers/specs/2026-10-06-vi-levels-onboarding-design.md](superpowers/specs/2026-10-06-vi-levels-onboarding-design.md) | решение | вводный курс и уроки по главам; построено и убрано из игры 7 октября |
| [superpowers/specs/2026-10-07-vi-bots-design.md](superpowers/specs/2026-10-07-vi-bots-design.md) | решение | боты уровней и боты Endless; что вышло иначе — раздел 12 |
| [VI_Levels_Progression_Research.md](VI_Levels_Progression_Research.md) | исследование | звёзды за ходы, предел ходов (живы), ворота глав (убраны) |
| [VI_Levels_Onboarding_Research.md](VI_Levels_Onboarding_Research.md) | исследование | как учат в играх-ориентирах; замер прежних уровней |
| [VI_Level_Generation_Deep_Research.md](VI_Level_Generation_Deep_Research.md) | исследование | генерация и режиссура первых уровней |
| [VI_Levels_Reference_Research.md](VI_Levels_Reference_Research.md) | исследование | разбор Color Sort, Blockudoku, Royal Match |
| [VI_Levels_Constraints.md](VI_Levels_Constraints.md) | исследование | замер первой пробы 4 октября; вытеснено правилами |
| [VI_TurnBased_Research.md](VI_TurnBased_Research.md) | исследование | пошаговые игры с источниками |
| [VI_Tutorial_Research.md](VI_Tutorial_Research.md) | исследование | как учат правилам: источники |

Команды: отчёт о досках — `node scripts/bots.mjs` (`level=P06` — один уровень с партитурой, `climb=on`, `edits level=P06`); подбор досок места — `node scripts/ladder.mjs place=P06`, таблица — `node scripts/ladder.mjs levels`; звёзды — `node scripts/stars.mjs`. Код: `src/levels/`, `src/rules/level.ts`, `src/rules/levelSolver.ts`.

## Endless (сессии)

| Документ | Вид | Что в нём |
|---|---|---|
| [VI_Endless_Rules.md](VI_Endless_Rules.md) | истина | правила и числа сессии, как они есть в коде |
| [superpowers/specs/2026-10-07-vi-glass-does-not-hold-design.md](superpowers/specs/2026-10-07-vi-glass-does-not-hold-design.md) | решение | «стекло не держит» |
| [superpowers/specs/2026-10-03-vi-pace-v2-design.md](superpowers/specs/2026-10-03-vi-pace-v2-design.md) | решение | темп: волны, рост, режиссёр (действуют дополнения 4–8) |
| [superpowers/specs/2026-10-03-vi-floor-and-islands-design.md](superpowers/specs/2026-10-03-vi-floor-and-islands-design.md) | решение | пол и острова |
| [VI_Randomness_Research.md](VI_Randomness_Research.md) | исследование | случайность и честная помощь |
| [VI_Retention_Research.md](VI_Retention_Research.md) | исследование | удержание, разрыв между сильным и слабым игроком |

Команды: темп — `node scripts/pace.mjs` (`grid`, `styles`, `survival`, `edges`, `rush`). Код: `src/rules/config.ts`, `src/rules/sim.ts`.

## Вид, интерфейс, звук

Визуальный стиль ведёт владелец; агент исполняет принесённый слой.

| Документ | Вид | Что в нём |
|---|---|---|
| [art/VI_Visual_Language.md](art/VI_Visual_Language.md) | истина | главная страница по виду игры: принципы, кости, состояние |
| [art/VI_Interface_Layer.md](art/VI_Interface_Layer.md) | истина | правило единого слоя и перечень всех элементов интерфейса |
| [art/VI_World_Logic.md](art/VI_World_Logic.md) | истина | почему каждый элемент игры устроен так; новый элемент — новая строка |
| [superpowers/specs/2026-10-02-vi-display-foundation-design.md](superpowers/specs/2026-10-02-vi-display-foundation-design.md) | решение | один канвас, слои, лаборатория |
| [superpowers/specs/2026-10-02-vi-board-look-design.md](superpowers/specs/2026-10-02-vi-board-look-design.md) | решение | вид поля (вид костей заменён Visual_Language) |
| [superpowers/specs/2026-10-02-vi-juice-design.md](superpowers/specs/2026-10-02-vi-juice-design.md) | решение | первый слой сока |
| [superpowers/specs/2026-10-02-vi-scene-constructor-design.md](superpowers/specs/2026-10-02-vi-scene-constructor-design.md) | решение | конструктор сцен сигнала |
| [superpowers/specs/2026-10-03-vi-phone-view-design.md](superpowers/specs/2026-10-03-vi-phone-view-design.md) | решение | вид на телефоне: приближение за игроком |
| [superpowers/specs/2026-10-03-vi-sound-design.md](superpowers/specs/2026-10-03-vi-sound-design.md) | решение | звук |
| [art/VI_Art_Direction_and_Signal_v01.md](art/VI_Art_Direction_and_Signal_v01.md) | исследование | черновик владельца от 2 октября; при расхождении верна Visual_Language |
| [art/VI_Signal_Director.md](art/VI_Signal_Director.md) | исследование | сцены сигнала: принятое, построенное, предложения |
| [art/VI_Shell_Research.md](art/VI_Shell_Research.md) | исследование | оболочка: ориентиры и варианты |
| [art/VI_Style_Research.md](art/VI_Style_Research.md) | исследование | стиль шире оболочки |
| [art/VI_Juice_Research.md](art/VI_Juice_Research.md) | исследование | как делают сок: разбор ориентиров |

Код: `src/render/`, `src/shell/` (цвета и размеры — только `src/shell/theme.ts`), `src/signal/`, `src/audio/`. Лаборатория `?lab=board|shell|juice|sound|frame` — только в dev-сборке.

## Лор и текст

| Документ | Вид | Что в нём |
|---|---|---|
| [art/VI_Lore.md](art/VI_Lore.md) | истина | твёрдые факты, чтения, тёмные места, правила подачи |
| [art/VI_Claims.md](art/VI_Claims.md) | истина | журнал: что каждая строка текста игры утверждает о мире |
| [VI_Story_Brief.md](VI_Story_Brief.md) | решение | мир, лор и сюжет: бриф для обсуждения на 5 октября (черновик) |

## Платформа

| Документ | Вид | Что в нём |
|---|---|---|
| [VI_Playgama_Page.md](VI_Playgama_Page.md) | истина | тексты страницы игры в кабинете Playgama (временные) |
| [superpowers/plans/2026-10-03-vi-ads-in-world.md](superpowers/plans/2026-10-03-vi-ads-in-world.md) | план | реклама в мире игры; не выполнен |

## Уйдут вместе с кодом

Владелец 8 октября 2026 решил удалить код пазлов (`?tasks`), обучения Endless (`?tutorial`) и ворот глав. Пока код лежит, лежат и спеки.

| Документ | Вид | Что в нём |
|---|---|---|
| [superpowers/specs/2026-10-01-vi-puzzle-design.md](superpowers/specs/2026-10-01-vi-puzzle-design.md) | решение | пазлы |
| [superpowers/specs/2026-10-01-vi-tutorial-design.md](superpowers/specs/2026-10-01-vi-tutorial-design.md) | решение | обучение Endless из шести уроков |

## Служебное

| Документ | Вид | Что в нём |
|---|---|---|
| [VI_Docs_Audit.md](VI_Docs_Audit.md) | исследование | аудит документов 8 октября 2026: таблица, противоречия, решения владельца |
| [superpowers/plans/2026-10-08-vi-docs-cleanup.md](superpowers/plans/2026-10-08-vi-docs-cleanup.md) | план | план аудита |

## В истории git

Вытесненные спеки и выполненные планы убраны из дерева 8 октября 2026 по слову владельца. Последний коммит, где они лежат, — `7780049`; достать: `git show 7780049:<путь>`.

| Путь | Что это было | Что заменило |
|---|---|---|
| docs/RITE_Design_MVP.md | исходная спека игры | VI_Endless_Rules.md |
| docs/superpowers/specs/2026-10-01-vi-mvp-design.md | спека MVP, «что решено иначе» | VI_Endless_Rules.md |
| docs/superpowers/specs/2026-10-02-vi-pace-design.md | темп, первая версия | спека pace-v2 |
| docs/superpowers/specs/2026-10-02-vi-program-shell-design.md | оболочка-программа | art/VI_Interface_Layer.md |
| docs/superpowers/specs/2026-10-04-vi-levels-probe-design.md | первая проба уровней (`p01`–`p08`) | VI_Levels_Rules.md |
| docs/superpowers/specs/2026-10-04-vi-levels-types-design.md | типы уровней (`c1`–`h3`) | VI_Levels_Rules.md |
| docs/VI_Tutorial_Decisions.md | решения по обучению 4 октября | спека onboarding-design |
| docs/VI_Levels_Teaching.md | лестница уроков из 26 мест, замеры | спека onboarding-design; словарь — в VI_Levels_Onboarding_Decisions.md |
| docs/VI_Levels_First20_Build.md | лестница `B01`–`B23` по главам | VI_Levels_Routes_Brief.md |
| docs/VI_Levels_Backlog.md | плейтест лестницы, три постановки | VI_Levels_Routes_Brief.md |
| docs/superpowers/plans/2026-10-01-vi-stage1-playable-endless.md | план, выполнен | — |
| docs/superpowers/plans/2026-10-01-vi-stage2-vertical-slice.md | план, выполнен | — |
| docs/superpowers/plans/2026-10-01-vi-tutorial.md | план, выполнен | — |
| docs/superpowers/plans/2026-10-03-vi-leaderboard-climb.md | план, выполнен (v0.2.7) | — |
| docs/superpowers/plans/2026-10-03-vi-performance.md | план, выполнен; этап 3 не делался | — |
| docs/superpowers/plans/2026-10-06-vi-levels-onboarding-1-rules-and-boards.md | план, выполнен (v0.2.20) | — |
| docs/superpowers/plans/2026-10-07-vi-bots-1-levels.md | план, выполнен | — |
| docs/superpowers/plans/2026-10-07-vi-bots-2-endless.md | план, выполнен | — |

Убранные из игры уровни (курс, лестница глав) и их слова — коммит `534b3ea`; подробно — [VI_Levels_Onboarding_Decisions.md](VI_Levels_Onboarding_Decisions.md), раздел 8.
