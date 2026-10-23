# VI — реклама по желанию: путь за рекламу на доске, удвоение счёта сеанса; пауза между межстраничными 180 секунд

> Вид: решение. Статус: в силе (принято владельцем 23 октября 2026 в чате планирования релиза на Fable; не построено). Дата: 2026-10-23.
> Что заменило: —. Что живёт в коде: после сборки — `src/platform/platform.ts`, `platforms/playgama/adapter.ts`, `platforms/playgama/playgama-bridge-config.json`, `src/app/game.ts`.

Исполнитель читает эту спеку и файлы раздела 4. Строится после [сеансов вживую](2026-10-22-vi-live-sessions-design.md) и [рекламы за отмены](2026-10-23-vi-ads-after-undos-design.md), которые уже в `main` (0.2.79).

## 1. Слова владельца, 23 октября 2026

Вопрос владельца: «есть идеи куда ещё рекламу поставить (но немного рекламы хочу, чтобы не бесила)». Предложение агента: межстраничных мест уже три (итог PROTOCOL, итог сеанса вживую, каждая третья отмена), больше не добавлять, паузу Bridge между показами поднять со 120 до 180 секунд; добавить два показа по желанию игрока — «показать путь» за рекламу на доске после третьей неудачной попытки и «удвоить счёт» в итоге сеанса; не ставить рекламу на возврат в меню и на перезапуск доски после тупика («жизнь за рекламу при каждом проигрыше»). Ответ: «да, давай сделаем по рекламе как ты предлагаешь. действуй! и увеличь до 180 секунд».

Опора: [правила Playgama о rewarded](https://wiki.playgama.com/playgama/bridge-sdk/api/advertisement/rewarded.md) — награда только по состоянию `rewarded`, кнопка заранее говорит, что будет реклама и что за неё дают; [чеклист](https://wiki.playgama.com/playgama/mcp/game-checklist.md), пункты 14–15; свод психологии игр (`docs/VI_Game_Psychology_Digest.md`, пока не в main), «Реклама за награду».

## 2. Что это для игрока

**Путь за рекламу.** Доска кампании не далась три раза (три попытки кончились тупиком или перезапуском с ходами). С этого момента на панели итога проигранной попытки стоит команда «ПУТЬ ЗА РЕКЛАМУ». Нажал — реклама площадки; досмотрел — доска начинается заново, и знак свайпа у фигуры показывает следующий ход кратчайшего пути всю попытку, шаг за шагом, пока игрок с пути не сошёл. Сошёл — знак гаснет; отмена хода возвращает его. Звёзды считаются как обычно. Закрыл рекламу раньше — ничего не происходит, доска стоит как стояла. Без площадки или если площадка reward не поддерживает — команды нет вовсе.

**Удвоить счёт.** В итоге сеанса вживую, пока игрок с итога не ушёл, стоит команда «УДВОИТЬ ЗА РЕКЛАМУ». Досмотрел — счёт на панели удваивается, лучший счёт места пересчитывается, команда исчезает. Только в сеансах вживую: у PROTOCOL счёт уже ушёл в таблицу площадки к моменту итога, и удвоение потребовало бы второй отправки и второго подъёма по журналу.

**Межстраничная** остаётся там, где стоит (итог PROTOCOL, итог сеанса вживую, третья отмена), но не чаще раза в 180 секунд: это делает сам Bridge по настройке.

## 3. Голос и вид

Команды — программы, шрифтом программы, в `words.ts` на семи языках: `SHOW WAY · AD` / «ПУТЬ ЗА РЕКЛАМУ», `DOUBLE · AD` / «УДВОИТЬ ЗА РЕКЛАМУ». Слово «AD» в команде обязательно: кнопка говорит, что будет реклама (чеклист, пункт 14). Вид кнопки — как остальные команды панели; владелец ведёт вид и может заменить. Строки — в [VI_Interface_Layer.md](../../art/VI_Interface_Layer.md), утверждения — в [VI_Claims.md](../../art/VI_Claims.md): реклама — помеха на канале, программа её не объясняет (арт-документ, раздел 8).

## 4. Как строить

**Слой платформы.** `src/platform/platform.ts`: в `Platform` —

```ts
/** Whether the platform shows rewarded advertisements: a button for one is drawn only then. */
readonly rewardedSupported: boolean;
/** Shows a rewarded advertisement; `done(true)` only when the platform says it was watched to the end. */
rewarded(placement: 'show_way' | 'double_score', done: (rewarded: boolean) => void): void;
```

`none`: `rewardedSupported: false`, `rewarded: (_, done) => done(false)`. `platforms/playgama/adapter.ts`: по образцу `interstitial` — `bridge.advertisement.isRewardedSupported`; подписка на `REWARDED_STATE_CHANGED`; `rewarded` → `done(true)`, `closed` без `rewarded` и `failed` → `done(false)`; отписка после конца; без SDK — `done(false)`. Пауза и звук на время рекламы — уже по событиям платформы, ничего не дублировать. `platforms/playgama/playgama-bridge-config.json`: `minimumDelayBetweenInterstitial: 180`; `advertisement.rewarded.placements` — `show_way`, `double_score`; `placementFallback: "show_way"`. `adapter.test.ts`: состояния `rewarded`, `closed`, `failed`, без SDK.

**Путь за рекламу.** `src/platform/settings.ts`, `LevelStat`: поле `hinted: number` — сколько раз путь показан (по умолчанию 0; старые сохранения — 0). `src/app/game.ts`:
- Условие кнопки: `this.labSpec === null`, `platform.rewardedSupported`, `levelStat(...).fails >= 3`, у доски есть путь — `spec.solution` из файла, иначе решатель (`solveFrom`, как в `signWay.ts`; в пределах `SIGN_MAX_STATES`, иначе кнопки нет).
- `levelResultPanel`: действие `onWay?: () => void`; команда рисуется, когда действие передано. Отдельная строка в `panels.ts`.
- По нажатию: `platform.rewarded('show_way', (ok) => { if (!ok) return; stat.hinted++; this.startRun('level'); this.wayShown = way; })`. Реклама идёт поверх панели итога; панель остаётся, пока не вернулся ответ.
- Показ: пока `this.wayShown` стоит, направление знака свайпа берётся из `nextPress(state, way)` (`src/lab/showWay.ts` — чистая функция на правилах; перенести её в `src/app/` или импортировать оттуда, лаборатория в сборке игры не нужна — проверить, что `showWay.ts` не тянет DOM). `'done'` или `'lost'` — знак гаснет; `undoLevel` снова спрашивает. `signView` и `waiting.dir` — там, где знак сейчас решается (`game.ts`, строка с `sign: levelRun && this.waiting.dir ? …`). Новая попытка без рекламы сбрасывает `wayShown`.
- Аналитика: в `levelTry()` поле `hinted: boolean` этой попытки; `README.md`, таблица «Аналитика».

**Удвоить счёт.** `src/app/game.ts`, `showLiveResult`: действие `onDouble?: () => void` в `liveResultPanel`, передаётся, когда `platform.rewardedSupported` и удвоения ещё не было в этом итоге. По нажатию `platform.rewarded('double_score', ok => …)`: при `ok` — `state.score *= 2` не трогать (правила чистые): панель получает `doubled: true` и показывает удвоенное число, `noteLive(this.settings, live.code, score * 2)` пересчитывает лучший; `progression_completed` уже ушло — дослать `platform.track('reward_double', { step_id, score })`. Кнопка после ответа исчезает в обоих случаях.

**Документы в том же коммите:** [ROADMAP.md](../../ROADMAP.md), «Реклама как часть мира» (места межстраничной, два показа по желанию, пауза 180); [VI_Interface_Layer.md](../../art/VI_Interface_Layer.md) — две команды; [VI_Claims.md](../../art/VI_Claims.md) — строки команд; [platforms/playgama/README.md](../../../platforms/playgama/README.md) — места рекламы; `README.md` — аналитика; индекс [docs/README.md](../../README.md) — статус спеки; план релиза — пункт 1.7.

## 5. Проверка

`npm test`, `npm run typecheck`, `npm run build`, `node scripts/docs-check.mjs`. Сборка `VI_PLATFORM=playgama` в превью `vi-build` (SDK в режиме `mock`): на доске после трёх проигрышей есть команда, нажатие зовёт `showRewarded('show_way')`; в итоге сеанса — `showRewarded('double_score')`. Версия 0.2.80. Что вышло иначе — последним разделом здесь.
