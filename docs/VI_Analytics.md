# VI — аналитика

> Вид: истина. Статус: в силе. Дата: 2026-10-30. Проверено: 2026-10-30.
> Что заменило: —. Что живёт в коде: `src/app/telemetry.ts`, `src/app/health.ts`, вызовы `platform.track` в `src/app/game.ts` и `src/platform/storage.ts`.
> Какие события игра шлёт в аналитику площадки, с какими полями, и куда они уходят на каждой площадке.

## Куда уходит

Игра зовёт `platform.track(событие, поля)` и `platform.tell(сообщение)` (тип `Platform`, [src/platform/platform.ts](../src/platform/platform.ts)); куда это идёт, решает адаптер площадки.

- **Playgama** — `analytics.send` Bridge SDK; читать через кабинет (`get_game_telemetry_analytics`). Bridge сам добавляет свои события: `core_*` (сеанс, пинг), `gameplay_30s/60s`, `advertisement_*`, `platform_message_*` (то, что игра говорит через `tell`). Сторонняя аналитика в сборке Playgama запрещена.
- **CrazyGames** — событий игры нет: SDK не принимает своих событий (только `analytics.trackOrder` для покупок). Площадка сама считает запуски, время игры, удержание D1, «конверсию» (доля сыгравших минуту) и выручку; для этого ей нужны `gameplayStart/Stop` и `loadingStart/Stop`, их шлёт адаптер по `tell`. Своей аналитики на CrazyGames не заводим — владелец 30 октября: «обходимся метриками кабинета».
- **Без площадки** (дев-сервер, GitHub Pages) — никуда.

Правила для новых событий (гайд телеметрии Playgama): имя события постоянное, изменчивое — в полях (`step_id`, `step_index`); значения полей из короткого словаря; никаких текстов ошибок, адресов, стеков, имён игроков; не дублировать то, что площадка считает сама.

## События игры

### Прогрессия

| Событие | Когда | Поля |
|---|---|---|
| `progression_started` | начат уровень, сеанс Endless или сеанс вживую; первый уровень, на котором открылась программа, — с первым ходом | `step_id` (`level_<код>`, `endless`, код сеанса вживую), `step_index` (номер в ряду), у уровня `try` |
| `progression_completed` | уровень пройден; сеанс вживую дожил до конца часов; уровень внутри сеанса Endless (`step_id` `<режим>_level`) | уровень: `moves`, `left`, `limit`, `par`, `undos`, `try`, `hinted`, `duration_sec`, `stars`; сеанс: сводка `runSummary`; уровень сеанса: `levelSummary` |
| `progression_failed` | уровень или сеанс не дошёл | `reason`: `moves`, `stuck` (тупик), `full` (доска полна), `left` (ушёл в меню), `restart`, `skipped` (пропустил сеанс вживую); с теми же полями, что и `completed`, у уровня ещё `short` |
| `progression_resumed` | продолжен сохранённый сеанс | `step_id`, `duration_sec` |
| `session_checkpoint` | каждая целая минута сеанса Endless | `minute`, `score`, `level`, `cubes`, `removed`, `max_chain`, `danger_sec` |
| `tutorial_hint` | показана подсказка обучения (один раз на игрока) | `hint`: `hintMount`, `hintLow`, `hintChain`, `hintFloor`, `hintOne` |

Значения обучения Endless (`tutorial`, `tutorial_step`) и пазлов (`task`) ушли вместе с их кодом 15 октября 2026. У уровня `step_id` — `level_<id>`, например `level_P06`; в событиях попытки уровня (`progression_completed`, `progression_failed`) с 0.2.80 есть `hinted` — показан ли на этой попытке путь доски за рекламу.

Сеанс вживую (с 0.2.79): `step_id` — код сеанса `live-<ступень>` (`live-1` … `live-7`), `step_index` — номер места, после которого он стоит (с 0.2.85 — 16, 28, 43, 56, 71, 85, 92). `progression_started` — начало сеанса; `progression_completed` — сеанс дошёл до конца по часам, со сводкой сессии и `ticks`; `progression_failed` с `reason`: `full` — поле заполнилось раньше часов, `skipped` — ссылка «пропустить» в окне перед сеансом (только `step_id` и `step_index`), `left` — уход в меню, `restart` — заново из паузы. `session_checkpoint` и уровни сессии (`endless_level`) сеанс не шлёт.

Сводка сессии (по ней настраивается темп и приход костей): `rules` — ключ правил, `score`, `level`, `duration_sec`, `max_chain`, `best_chain_score`, `clears`, `removed`, `spawned`, `cubes_end`, `first_clear_sec`, `steps`, `blocked_steps`, `falls`, `ground_sec`, `floor_climbs` (подъёмы с пола на кость, которую нельзя толкнуть), `dock_descents` и `dock_climbs` (сходы с уходящей кости на клетку рядом с цепочкой и подъёмы с такой клетки на стоящую кость), `danger_sec`, `saves` (сколько раз поле уходило от опасной отметки), `chain_quiet_max_sec`, `match_2`…`match_6` (группы по числу на гранях), `ones`, `chains_2`, `chains_3`, `chains_4plus` (цепочки по длине), `contact`, `scored`, `best`. Считает [src/app/telemetry.ts](../src/app/telemetry.ts).

В сводку сессии входят и показания, по которым сверяются боты ([src/rules/bot.ts](../src/rules/bot.ts)): `drought_max_sec` (самое долгое ожидание очистки), `gifts` (подарки режиссёра), `clean_boards` (чистое поле), `wave` (до какой волны дошла партия). И то, что партия значит внутри визита: `run_index` (какая по счёту), `losses_in_row` (сколько партий подряд до неё кончились заполненным полем), `since_last_run_sec` (пауза после прошлой партии), `resumed` (партия продолжена после ухода со страницы), `control` (`swipe` — свайпы, `tap` — клик и тап по полю; клавиши работают при обоих), `touch` (сенсорный экран).

### Открытие игры и здоровье

| Событие | Когда | Поля |
|---|---|---|
| `game_loaded` | первая картинка игры на экране, раз за визит | `load_ms` (от начала загрузки страницы), `page_ms` (страница и скрипты), `platform_ms` (старт SDK), `storage_ms` (чтение сохранений), `game_ms` (сборка игры до первой картинки), `returning` (сохранение уже было), `language`, `touch`, `width`, `height` (окно, шаг 10 px), `dpr`, `hidden_while_loading`, `game_version` |
| `load_hidden` | страница скрыта до первой картинки (игрок ушёл с загрузки или переключил вкладку), раз за визит | `stage`: `platform`, `storage`, `game`; `elapsed_ms`, `game_version` |
| `game_error` | ошибка скрипта, отвергнутое обещание, не загрузился файл, потерян контекст WebGL; не больше 5 за визит, одинаковые — раз | `kind`: `error`, `rejection`, `asset`, `context_lost`; `name` (`TypeError` и другие встроенные, иначе `other`); `source`: `game`, `vendor`, `external` (SDK, реклама), `other`; `where`; `game_version` |
| `save_failed` | сохранение не записалось или не прочиталось, раз за визит на вид | `stage`: `read`, `write`, `parse`; `store`: `platform`, `browser` |
| `page_hidden` | страница скрыта во время игры (раз за попытку) или в меню (раз за визит): последнее, что видно от игрока, который ушёл | `where`, `visit_sec`; в игре ещё `step_id`, `step_index`, `run_sec`, `over`, `paused`, у уровня `moves`, `undos`, у сеанса `score` |
| `performance_sample` | каждые ~30 секунд активной игры | по гайду Playgama: `target_fps`, `fps_avg`, `fps_p10`, `frame_time_*`, `frames_over_*ms`, `js_error_count`, `unhandled_rejection_count`, `webgl_context_loss_count`, `game_version` |

`where` — где игрок: `loading`, `menu`, `endless`, `live`, `level`, `lab`.

Воронка открытия на Playgama: `core_initialization_started` (Bridge) → `game_loaded` → `progression_started`. Ушедшие на загрузке видны как `load_hidden` со стадией; ушедшие до старта SDK не видны никак.

### Реклама

| Событие | Когда | Поля |
|---|---|---|
| `ad_requested` | игра просит межстраничную рекламу (площадка её показывает) | `kind`: `interstitial`; `reason`: `session_end`, `live_end`, `undos` |
| `reward_offered` | показана кнопка рекламы за награду: раз за попытку уровня, раз за итог сеанса вживую | `placement`: `show_way`, `double_score`; `step_id`, `step_index` |
| `reward_result` | реклама за награду закончилась | `placement`, `rewarded` (досмотрена), `step_id`, `step_index` |
| `reward_double` | счёт сеанса вживую удвоен | `step_id`, `step_index`, `score` |

Показ, закрытие и сбой рекламы считает сама площадка (у Playgama — `advertisement_*`); игра добавляет, что её вызвало.

### Прочее

| Событие | Когда | Поля |
|---|---|---|
| `settings_changed` | игрок поменял настройку | `setting`, `value` |
| `records_opened` | открыт журнал рекордов | `network` (есть таблица площадки) |
| `player_registered` | игрок прошёл вход площадки из журнала | `known` |
| `result_shared` | игрок отправил результат | `mode`, `how` (`sent`, `copied`, `failed`), `score` |

## Сообщения площадке (`tell`)

`game_ready` (первая картинка), `level_started`, `level_completed`, `level_failed`, `level_paused`, `level_resumed`, `player_got_achievement` (новый лучший счёт Endless). Playgama видит их как `platform_message_*`. CrazyGames — как `loadingStop`, `gameplayStart` и `gameplayStop` ([platforms/crazygames/adapter.ts](../platforms/crazygames/adapter.ts)).

## Где смотреть

Кабинет разработчика Playgama, раздел аналитики игры; агент читает те же данные через `get_game_telemetry_analytics` (сводка, потом одно событие — `get_game_telemetry_event_analytics`, порядок событий в сеансах — `get_game_telemetry_session_facts`). Числа сравнивать по `game_version`: поэтому каждая выкладка поднимает версию. CrazyGames — кабинет разработчика, его метрики (раздел 1).
