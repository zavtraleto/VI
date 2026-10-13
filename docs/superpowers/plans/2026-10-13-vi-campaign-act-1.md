# Кампания, акт I «Чтение кости»: обвязка актов, шесть мест, строка семи

> Вид: план. Статус: не выполнен. Дата: 2026-10-13.
> Что заменило: —. Что живёт в коде: после выполнения — src/levels/campaign.ts, src/levels/campaignRecipes.ts, src/levels/levels.ts, src/app/game.ts, src/app/hint.ts, src/ui/i18n.ts, src/ui/lang/*.ts, boards/.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Места 17–22 ряда становятся актом I: шесть досок на тройках с ролями открытие → применение → твист → соединение → пик → передышка, строка «Напротив всегда семь.» на открытии; остаток прежнего списка идёт хвостом за актом, пока его не заменят следующие акты.

**Architecture:** Ряд (`CAMPAIGN`) получает у каждой остановки акт и роль из таблицы по коду; строки над полем читаются из одной таблицы `HINTS` по коду любой доски. Новые места описаны рецептами в `src/levels/campaignRecipes.ts`, доски для них лаборатория кладёт и судит как для мест дороги (`gen place=`, `fit`, `ladder place=`), выбор — по паспорту спеки (раздел 5.4), глазами на 360×640. В `levels.ts` список делится на `ACT_1` и `TAIL`; `LEVELS` остаётся их склейкой, так что ряд, звёзды и тесты списка продолжают работать.

**Tech Stack:** TypeScript, Vite, vitest; `node scripts/level.mjs`, `node scripts/ladder.mjs`, страница `?lab=levels`, адрес `?board=`; документы с `node scripts/docs-check.mjs`.

**Spec:** [docs/superpowers/specs/2026-10-12-vi-campaign-design.md](../specs/2026-10-12-vi-campaign-design.md): разделы 4 (хребет), 5 (модель, паспорт, полосы по ролям — 5.3, 5.4), 7 «Акт I» (места и брифы), 8 (строки), 9 (механизм), 10 (постройка, «акт готов, когда», журнал процесса), 15 (слова владельца после шага 1). Шаг 1 выполнен: [2026-10-12-vi-campaign-1-row.md](2026-10-12-vi-campaign-1-row.md), его раздел «Что вышло иначе» — состояние кода.

## Global Constraints

- Свой worktree от `origin/main`; в основную папку `GAMES\VI` ничего не писать. Публикация: `git fetch`, rebase на `origin/main`, проверки, `git push origin HEAD:main` — только после «ок» владельца.
- `src/rules` не трогать: правила заморожены (`docs/VI_Levels_Rules.md`, раздел 10). Доски — только в рамках правил как они есть.
- Весь интерфейс — канвас через `src/shell`, цвета и размеры из `src/shell/theme.ts`; новых элементов интерфейса в акте нет. Строка над полем — существующий механизм дороги (`hint.ts`, `hudLayout.ts`).
- Тексты игрока — семь языков: `src/ui/i18n.ts` (ru, en) и `src/ui/lang/{de,es,fr,pt,tr}.ts`. Строка урока — до восьми слов, запись в `docs/art/VI_Claims.md`, сверка с `docs/art/VI_Lore.md`.
- Пол на всех досках после пролога открыт (`floor` не задан). Рамка доски не больше 4×5; внутренних вырезанных клеток (дырок внутри поля) нет — только силуэтные формы (спека 5.5).
- Каждая новая доска — файл в `boards/` (истина лаборатории) и строка в `levels.ts` через `node scripts/level.mjs source`; `node scripts/level.mjs regress` после каждого переноса.
- Коммит после каждой задачи; заголовок до 70 знаков, тело до пяти строк. Проверки: `npm test`, `npm run typecheck`; перед публикацией ещё `npm run build`, `node scripts/docs-check.mjs`, `node scripts/level.mjs regress`.
- Слова владельца и решения — в документах. Ключ акта (что каждая доска задумана показать и где её ловушка) владельцу в сообщениях не пересказывать: он играет акт и говорит своё.

## Review Focus

1. **Сохранение с пройденными `P03`, `P16`, `P09`** (они стояли в списке на других местах): их звёзды остаются при переезде в акт — записи идут по коду. → Задача 1, тест `campaignCells` на новой раскладке `LEVELS`.
2. **Строка семи звучит один раз.** Игрок прошёл `K17`, вернулся к нему из списка: строка не звучит снова (как `roadHintFixed`), а гаснет она на первом комбо. → Задача 3, тест `hintOver('combo', …)` уже есть; проверка «один раз» — в preview, и если механизм дороги звучит на каждом запуске куска (посмотреть `runLevel`: `carried` ставится при каждом старте), то для актов это решение владельца («строка звучит один раз на открытии акта» — спека 8); сделать так: строка акта не ставится, если `passed[spec.id]`.
3. **Фокус списка после акта I**: игрок за дорогой, прошёл места 17–19, список открывается на 20-м, а не на первом непройденном хвоста. `nextLevel()` ищет первый непройденный в `LEVELS` — это и есть 20-е. → Задача 1, тест `campaignFocus` с `passed` трёх первых уровней акта.
4. **Доска `K17` с четырьмя тройками: комбо из четырёх.** Если решатель находит путь, где все четыре уходят одним комбо, звено не нужно — допустимо (урок семь), но паспорт `last` обязан это записать, а не притворяться звеном. → Задача 3, `check` и запись в ключе.
5. **`P23` на телефоне**: коридор 5×5 с вырезанными рядами — поле шире телефона было бедой `P22`. Если на 360×640 клетки коридора мельче клеток `P03` больше чем на четверть, `P23` не берётся, строится `K21`. → Задача 4, замер в preview.

---

## Процедура доски

Так строится каждая новая доска акта. Задачи ниже ссылаются сюда и добавляют только своё.

1. **Положить кандидатов.** `node scripts/level.mjs gen place=<код> out=boards/out/<код>/ seeds=400 keep=30` (способ кладки — тот, что у места: `mode=route`, если у рецепта есть `scenes`, иначе случайно; при пустой выдаче — `mode=both`, затем `seeds=1200`). Код выхода 1 — ни одна не подошла: ослаблять границы рецепта **только** в порядке, названном в брифе задачи, и записать, что ослаблено. Если и так пусто — положить руками на странице `?lab=levels` (редактор, `E` — играть, «записать путь решателя в файл»).
2. **Судить каждого кандидата.** `node scripts/level.mjs check file=boards/out/<код>/<файл>` — `par`, путь, маршрут, `turns`, `away`, партитура; `node scripts/level.mjs moves file=…` — верные первые ходы, тупики на глубине 1; `node scripts/level.mjs fit file=… place=<код>` — чего не хватает месту; `node scripts/ladder.mjs place=<код>` — персоны (торопливый, обычный, планирующий) по судье места. Паспорт сравнить с полосой роли (спека 5.4); две-три лучшие доски записать в журнал процесса с числами.
3. **Глазами.** `?board=boards/out/<код>/<файл>` в preview, рамка 360×640 и 1920×1080, по правой колонке паспорта (спека 5.3): у каждой кости где рабочая грань (сверху, видимый бок, низ, скрытый бок); заслонён ли нужный бок соседом; куда падает взгляд (какой ход напрашивается первым — записать); рамка по пути плюс клетка, лишние ряды срезаны; чем доска отличается от соседей по акту.
4. **Выбрать и перенести.** Файл победителя → `boards/<код>.txt` (статус `good`, в `note` — роль и крючок); `node scripts/level.mjs source file=<код>` → строка в `ACT_1` в `src/levels/levels.ts` под кодом места; `node scripts/level.mjs check file=game:<код>` даёт то же, что файл; `node scripts/level.mjs regress` чист. Непобедителей — в `boards/out/<код>/` оставить со статусом `idea` (запас), в коммит брать только `boards/<код>.txt`; папка `boards/out/` — в `.gitignore`, если ещё нет.
5. **Ключ.** В `docs/VI_Levels_Probe_Key.md`, раздел «Ключ акта I»: код, роль, что доска задумана показать, где ловушка или откат, паспорт (`par`, `turns`, `away`, сцепка, `firsts`, тупики, персоны), кандидаты, которых не взяли, и почему.
6. **Журнал процесса** — раздел «Что не хватало» этого плана: сколько зёрен и правок ушло, что считалось руками, какой паспорт лаборатория не посчитала.

---

### Task 1: Акты и роли в ряду, `HINTS`, `ACT_1` и `TAIL`

**Files:**
- Modify: `src/levels/campaign.ts` (`Stop`, `CAMPAIGN`, новая таблица `ROLES`, `HINTS`)
- Modify: `src/levels/levels.ts` (`ACT_1`, `TAIL`, `LEVELS`)
- Modify: `src/levels/road.ts:337-361` (`HintUntil`, `RoadHintKey` → `HintKey`), `src/app/hint.ts:78-95` (`roomLines`, `PROBE`)
- Modify: `src/app/game.ts:40-41,1320` (импорт `HINTS` вместо `ROAD_HINTS`)
- Test: `src/levels/campaign.test.ts`, `src/levels/levels.test.ts:95-110`, `src/app/hint.test.ts`

**Interfaces:**
- Produces:

```ts
export type Role = 'lesson' | 'free' | 'mix' | 'opening' | 'apply' | 'twist' | 'join' | 'peak' | 'rest' | 'wall' | 'coda' | 'tail';
export interface Stop { spec: LevelSpec; number: number; board: Board; act: number | null; role: Role }  // act 0 — пролог; null — хвост
export const ROLES: Readonly<Record<string, { act: number; role: Role }>>;   // по коду доски; дорога из ROAD_PLACES (free/mix) и 'lesson' для остальных кусков
export type HintKey = 'roadHintChain' | 'roadHintWalk' | 'roadHintPush' | 'roadHintClimb' | 'hintSeven' | 'hintLinkMove' | 'hintOnes';
export interface Hint { key: HintKey; until: HintUntil }
export const HINTS: Readonly<Record<string, Hint>>;   // ROAD_HINTS плюс строки актов
// levels.ts
export const ACT_1: readonly LevelSpec[];   // шесть досок акта I, в порядке мест 17–22
export const TAIL: readonly LevelSpec[];    // прежний список без досок, ушедших в акты, в прежнем порядке
export const LEVELS: readonly LevelSpec[] = [...ACT_1, ...TAIL];
```

- [ ] **Step 1: Тесты**

В `src/levels/campaign.test.ts` добавить:

```ts
it('names the act and the role of every stop: the road is act 0, the levels of the first act are act 1, the tail is none', () => {
  expect(CAMPAIGN[0]).toMatchObject({ act: 0, role: 'lesson' });
  expect(CAMPAIGN[2]).toMatchObject({ act: 0, role: 'free' });
  expect(CAMPAIGN[ROAD.length]).toMatchObject({ act: 1, role: 'opening' });
  expect(CAMPAIGN.slice(ROAD.length, ROAD.length + ACT_1.length).map((stop) => stop.role)).toEqual(['opening', 'apply', 'twist', 'join', 'peak', 'rest']);
  expect(CAMPAIGN[ROAD.length + ACT_1.length]).toMatchObject({ act: null, role: 'tail' });
});

it('carries the lines of the road and of the acts by the code of the board', () => {
  expect(HINTS.R06).toEqual({ key: 'roadHintChain', until: 'chain' });
  expect(HINTS[ACT_1[0].id]).toEqual({ key: 'hintSeven', until: 'combo' });
  expect(HINTS[ACT_1[1].id]).toBeUndefined();
});

it('keeps the stars of a level that moved into an act: they are kept by its code', () => {
  const cells = campaignCells({ passed: { P03: true }, stats: { P03: { bestMoves: 99 } } });
  const at = CAMPAIGN.findIndex((stop) => stop.spec.id === 'P03');
  expect(at).toBe(ROAD.length + 1);
  expect(cells[at]).toMatchObject({ passed: true, stars: 1 });
});

it('opens the list on the first level of the act not yet passed', () => {
  const passed = Object.fromEntries(ACT_1.slice(0, 3).map((spec) => [spec.id, true]));
  // nextLevel of the game is the first index of LEVELS not passed: here 3.
  expect(campaignFocus({ passed, stats: {} , road: ROAD_END }, false, 3)).toBe(ROAD.length + 3);
});
```

До задачи 3 `ACT_1` содержит заглушки? Нет: в этой задаче `ACT_1` собирается из досок, которые уже есть, в порядке мест: `[P03 (место 18), P16 (19), P09 (20)]` временно без 17, 21, 22 — тогда тест ролей упадёт. Поэтому порядок такой: в этой задаче `ACT_1 = [P03, P16, P09]` с ролями `apply, twist, join`, а тест ролей проверяет `['apply', 'twist', 'join']` и дописывается в задачах 3–5 по мере прихода досок. Тест `HINTS[ACT_1[0].id]` в этой задаче проверяет `HINTS.K17` напрямую: ключ `K17` в `HINTS` заводится сейчас, доска приходит в задаче 3.

В `src/levels/levels.test.ts` тест 95 («are levels of the probe in the order of the owner, each a level of a place») заменить на два: «`LEVELS` — акт I и за ним хвост в прежнем порядке» (`LEVELS` равно `[...ACT_1, ...TAIL]`; `TAIL` — прежний порядок `P13 P04 P14 P20 P07 P01 P12 P08 P06 P05 P17 P15 P31 P19` без `P03`, `P16`, `P09`) и «каждый уровень — место из `PLACES` или `CAMPAIGN_PLACES`» (второе — когда задача 2 заведёт `CAMPAIGN_PLACES`; до того — `PLACES`). Тест 100 («keep parked…») остаётся до задачи 4.

- [ ] **Step 2: Запустить — падают.** `npx vitest run src/levels/campaign.test.ts src/levels/levels.test.ts`.

- [ ] **Step 3: `levels.ts`**

Разбить `LEVELS` на `ACT_1` (пока `P03`, `P16`, `P09` в этом порядке; записи как есть) и `TAIL` (остальные четырнадцать в прежнем порядке); `export const LEVELS = [...ACT_1, ...TAIL]`. Комментарий шапки модуля: список — ряд кампании после пролога, акт за актом, хвост — прежняя проба до её замены актами; ссылка на спеку.

- [ ] **Step 4: `campaign.ts`**

```ts
export type Role = 'lesson' | 'free' | 'mix' | 'opening' | 'apply' | 'twist' | 'join' | 'peak' | 'rest' | 'wall' | 'coda' | 'tail';

/** The act and the role of every board of the acts, by code; the road's come from its places. */
const ACT_ROLES: Readonly<Record<string, { act: number; role: Role }>> = {
  K17: { act: 1, role: 'opening' }, P03: { act: 1, role: 'apply' }, P16: { act: 1, role: 'twist' },
  P09: { act: 1, role: 'join' }, K21: { act: 1, role: 'peak' }, K22: { act: 1, role: 'rest' },
};
export const ROLES: Readonly<Record<string, { act: number; role: Role }>> = {
  ...Object.fromEntries(ROAD.map((spec) => [spec.id, { act: 0, role: (ROAD_PLACES.find((place) => place.id === spec.id)?.role ?? 'lesson') as Role }])),
  ...ACT_ROLES,
};
```

`Stop` получает `act: number | null` и `role: Role`; в `CAMPAIGN` для доски `spec`: `ROLES[spec.id] ?? { act: null, role: 'tail' }`. Если `P23` займёт место 21 (задача 4), ключ `K21` в `ACT_ROLES` заменяется на `P23`.

```ts
export type HintKey = RoadHintKey | 'hintSeven' | 'hintLinkMove' | 'hintOnes';
export interface Hint { key: HintKey; until: HintUntil }
export const HINTS: Readonly<Record<string, Hint>> = { ...ROAD_HINTS, K17: { key: 'hintSeven', until: 'combo' } };
```

`RoadHint` в `road.ts` оставить как есть (его тип `key: RoadHintKey`), а `HINTS` типизировать своим `Hint`; `hint.ts` `roomLines(lesson: HintKey | null, …)` и `PROBE` → `Record<string, Hint>` с добавкой `seven: { key: 'hintSeven', until: 'combo' }`. В `game.ts` строка 1320: `HINTS[spec.id]` вместо `ROAD_HINTS[spec.id]`; импорт из `../levels/campaign`.

- [ ] **Step 5: Строка звучит один раз (Review Focus 2)**

В `runLevel` (`game.ts`, около 1320): строка акта не ставится, если доска уже пройдена игроком: `const hint = HINTS[spec.id]; const carried = this.labSpec === null ? (hint && (this.piece !== null || this.settings.levels.passed[spec.id] !== true) ? hint : (this.piece !== null ? HINT_PROBE : null)) : null;` — на дороге поведение не меняется (куски дороги звучат как сейчас), на уровнях акта строка идёт только до первого прохода. Записать это в раздел «Что вышло иначе» и в [VI_Interface_Layer.md](../../art/VI_Interface_Layer.md), строку о строках над полем.

- [ ] **Step 6: Прогнать и закоммитить**

```bash
npm test && npm run typecheck
git add src/levels/campaign.ts src/levels/campaign.test.ts src/levels/levels.ts src/levels/levels.test.ts src/levels/road.ts src/app/hint.ts src/app/hint.test.ts src/app/game.ts docs/art/VI_Interface_Layer.md
git commit -m "Ряд: акты и роли остановок, строки по коду любой доски, акт I и хвост"
```

---

### Task 2: Рецепты мест акта I и их место в лаборатории

**Files:**
- Create: `src/levels/campaignRecipes.ts`
- Modify: `src/lab/labFacts.ts:6-7,109,116` (`GEN_PLACES`, поиск рецепта), `scripts/ladder.mjs:157-180` (ветка `place=`), `src/levels/labText.ts` (`fitOf` — список мест по умолчанию, `gen`)
- Test: `src/levels/campaignRecipes.test.ts`

**Interfaces:**
- Produces: `export type CampaignPlace = Recipe & { id: string; act: number; role: Role; brief: string }`; `export const CAMPAIGN_PLACES: readonly CampaignPlace[]` с местами `K17`, `K21`, `K22`; `levelId(place)` даёт `id`.

- [ ] **Step 1: Рецепты**

```ts
import { cutFrom, type Recipe } from './recipes';
import type { Role } from './campaign';

export type CampaignPlace = Recipe & { id: string; act: number; role: Role; brief: string };

/** Four cells wide and three long: the square of four with its north row cut off. */
const WIDE = cutFrom(['....', '####', '####', '####']);
const ACT = { chapter: 0, compact: false } as const;

export const CAMPAIGN_PLACES: readonly CampaignPlace[] = [
  {
    ...ACT, slot: 1017, id: 'K17', act: 1, role: 'opening', size: 3, dice: 4, faces: [3], standing: [{ value: 3, count: 2 }],
    seven: true, under: true, par: [3, 4], firsts: [2, 99], kinds: ['top'], worst: 6, personas: { hasty: 0.7, casual: 0.9 },
    brief: 'the rule of seven: a pair of 3s stands, the own die shows a 4 with its 3 underneath; two rolls one way bring it up; the fourth die joins as a link or is left alone',
  },
  {
    ...ACT, slot: 1021, id: 'K21', act: 1, role: 'peak', size: 3, dice: 5, faces: [3], under: true, ride: true, movers: 2,
    par: [4, 6], firsts: [1, 2], tail: [0, 1], last: [5, 5], kinds: ['top'], personas: { hasty: 0.3, casual: 0.6 }, gap: [0.3, 1],
    brief: 'eureka on 3s: two hidden faces, one roll away and back, and the five go at once',
  },
  {
    ...ACT, slot: 1022, id: 'K22', act: 1, role: 'rest', size: 4, holes: WIDE, dice: 5, more: 1, faces: [3], standing: [{ value: 3, count: 2 }, { value: 3, count: 2 }],
    front: true, par: [1, 2], lossless: true, last: [5, 6], kinds: ['top'], personas: { hasty: 0.9, casual: 1 },
    brief: 'the breather: two pairs of 3s a cell apart, the own 3 on the side the player sees; one roll into the gap and all of them go',
  },
];
```

Поля сверить с `Recipe` в `src/levels/recipes.ts:41-150` (`standing.count` меньше группы — у троек пара допустима; `last` — кости последнего события; `lossless` ходит обходом `walk`). Если судья не знает `worst` без `walkLimit` — задать `walkLimit` как у мест дороги. `slot` — любые уникальные числа выше 1000.

- [ ] **Step 2: Тест**

`src/levels/campaignRecipes.test.ts`: коды уникальны и не пересекаются с `PLACES` и `ROAD_PLACES`; у каждого места `act`, `role`, `brief`; `faces` акта I — только `[3]`; `size` ≤ 4 и `holes`, если есть, — силуэт (каждая вырезанная клетка касается края квадрата по стороне — проверка «нет дырок внутри»: для каждой `hole` либо `x` равно 0 или `size-1`, либо `z` равно 0 или `size-1`, либо соседняя по стороне клетка тоже вырезана и так до края; простая проверка — ряд или столбец вырезан целиком, как `WIDE`).

- [ ] **Step 3: Лаборатория знает места**

`labFacts.ts`: `GEN_PLACES` и поиск рецепта — `[...PLACES, ...ROAD_PLACES, ...CAMPAIGN_PLACES]`. `labText.ts` `fitOf` по умолчанию — те же три списка. `scripts/ladder.mjs` ветка `place=` — тот же состав (строка 177: куда собираются `recipes`). Проверить: `node scripts/level.mjs fit file=game:P03 place=K17` печатает, чем `P03` не подходит месту `K17`; `node scripts/ladder.mjs place=K17` что-то кладёт или честно говорит, что ни одна из 200 не подошла.

- [ ] **Step 4: Коммит**

```bash
npm test && npm run typecheck
git add src/levels/campaignRecipes.ts src/levels/campaignRecipes.test.ts src/lab/labFacts.ts src/levels/labText.ts scripts/ladder.mjs
git commit -m "Места акта I: рецепты K17, K21, K22 и их место в лаборатории"
```

---

### Task 3: Место 17, открытие `K17`, и строка «Напротив всегда семь.»

**Files:**
- Create: `boards/K17.txt`
- Modify: `src/levels/levels.ts` (`ACT_1`: `K17` первым), `src/levels/campaign.ts` (тест ролей дописать), `src/ui/i18n.ts`, `src/ui/lang/{de,es,fr,pt,tr}.ts` (`hintSeven`), `docs/art/VI_Claims.md`, `docs/VI_Levels_Probe_Key.md`
- Test: `src/levels/levels.test.ts`, `src/levels/campaign.test.ts`, `src/ui` тест ключей (все семь языков имеют `hintSeven`)

- [ ] **Step 1: Доска по процедуре**

Место `K17`, бриф спеки (раздел 7, акт I, место 17): пара троек стоит рядом; своя кость четвёркой вверх (тройка внизу, по семи); два переката в одну сторону поднимают тройку к паре; четвёртая кость берётся звеном или остаётся одна — тупик «одна кость» (`levelDeadEnd` говорит сразу). Полоса роли: `turns` 1, `away` 0, `firsts` ≥ 2, тупик только объявляемый. Порядок ослабления, если пусто: `firsts` → `[1, 99]`; `par` → `[3, 5]`; `size` 4 с `WIDE`. Review Focus 4: если путь решателя — комбо из четырёх без звена, записать `last 4` в ключ; доска остаётся, урок места — семь.

- [ ] **Step 2: Строка**

`hintSeven` в семи языках, черновики (слова владельца за ним; записать в «Что вышло иначе», что слова — исполнителя):

| Язык | Строка |
|---|---|
| ru | Напротив всегда семь. |
| en | Opposite faces make seven. |
| de | Gegenüber ergibt immer sieben. |
| es | Las caras opuestas suman siete. |
| fr | Les faces opposées font sept. |
| pt | Faces opostas somam sete. |
| tr | Karşı yüzler yedi eder. |

Ключ рядом с `roadHintClimb` в каждом файле; комментарий в `i18n.ts` (строки 140–150) — что строка акта I, черновик 13 октября. В `docs/art/VI_Claims.md` — строка журнала: утверждение «противоположные грани кости в сумме семь» (твёрдый факт правил, `docs/art/VI_Lore.md`, «Твёрдые факты», пункт о правилах костей).

- [ ] **Step 3: В ряд**

`ACT_1 = [K17, P03, P16, P09]`; `ACT_ROLES` уже знает `K17`; тест ролей в `campaign.test.ts` — `['opening', 'apply', 'twist', 'join']`. `levels.test.ts`: тест «каждый уровень — место» теперь ищет и в `CAMPAIGN_PLACES`; тест 127 («teach nothing… no line») остаётся верным: строка идёт из `HINTS`, не из `spec.lesson`.

- [ ] **Step 4: Preview**

`?board=K17` и в ряду с чистыми настройками за дорогой (`levels.road = ROAD_END`): `START` на `K17`, `LV 17`, строка приходит по слову, гаснет на комбо; после прохода при повторном запуске из списка строки нет. На 360×640 все четыре кости и бок своей кости (где тройка внизу) читаются.

- [ ] **Step 5: Коммит**

```bash
npm test && npm run typecheck && node scripts/level.mjs regress
git add boards/K17.txt src/levels/levels.ts src/levels/levels.test.ts src/levels/campaign.ts src/levels/campaign.test.ts src/ui docs/art/VI_Claims.md docs/VI_Levels_Probe_Key.md
git commit -m "Акт I, место 17: открытие K17 и строка «Напротив всегда семь»"
```

---

### Task 4: Места 18–21: `P03`, `P16`, `P09` на своих ролях и пик (`P23` или `K21`)

**Files:**
- Modify: `src/levels/levels.ts` (`ACT_1`, `PARKED`), `src/levels/campaign.ts` (`ACT_ROLES`), `docs/VI_Levels_Probe_Key.md`
- Create (если нужна): `boards/K21.txt`
- Test: `src/levels/levels.test.ts:100` (parked), `src/levels/campaign.test.ts`

- [ ] **Step 1: Паспорта мест 18–20**

`node scripts/level.mjs check file=game:P03`, `game:P16`, `game:P09`: записать `par`, `turns`, `away`, маршрут в ключ акта под ролями применение, твист, соединение. Ожидание по спеке: `P03` t2 a1; `P16` t1 a1; `P09` t1 a0 (толчок). Если число расходится с полосой роли больше чем на единицу — не перекладывать доску (слово владельца о них есть), записать расхождение в «Что вышло иначе».

- [ ] **Step 2: Пик: `P23` или `K21`**

`P23` (`PARKED`, «Семь вслепую» на коридоре 5×5 с вырезанными рядами): `check file=game:P23` — ожидание t2–3, a1, `par` 7, `firsts` 1. Preview `?board=game:P23` на 360×640: сравнить размер клетки с `P03` (считать по снимку или по `view` — клетка в CSS-пикселях; у `P03` 3×3). Если клетка `P23` меньше клетки `P03` больше чем на четверть, или спрятанные грани у всех трёх костей (три поворота в уме, как на `P11`, который владелец назвал «дрочево»), — `P23` не берётся: строить `K21` по процедуре (бриф: две спрятанные грани из пяти костей, один откат, пять уходят разом; ослабление: `firsts` `[1, 3]` → `last` `[4, 5]`). Если `P23` берётся — перенести его из `PARKED` в `ACT_1` (место 21), `ACT_ROLES.P23 = { act: 1, role: 'peak' }`, ключ `K21` из `ACT_ROLES` убрать; тест `levels.test.ts:100` поправить (в `PARKED` остаются `P10`, `P18`, `P21`, `P22`, `P24`–`P30`).

- [ ] **Step 3: В ряд**

`ACT_1 = [K17, P03, P16, P09, <P23 | K21>]`; тест ролей — пять ролей. Preview: переход `P09` → пик цел, пик читается на телефоне.

- [ ] **Step 4: Коммит**

```bash
npm test && npm run typecheck && node scripts/level.mjs regress
git add boards src/levels/levels.ts src/levels/levels.test.ts src/levels/campaign.ts src/levels/campaign.test.ts docs/VI_Levels_Probe_Key.md
git commit -m "Акт I, места 18–21: применение, твист, соединение и пик на тройках"
```

---

### Task 5: Место 22, передышка `K22`

**Files:**
- Create: `boards/K22.txt`
- Modify: `src/levels/levels.ts`, `src/levels/campaign.test.ts`, `docs/VI_Levels_Probe_Key.md`

- [ ] **Step 1: Доска по процедуре**

Место `K22`: две пары троек через клетку, своя кость тройкой на видимом боку; один перекат в зазор — и уходят все пять (или шесть: `more: 1`). Полоса передышки: `turns` 0, `away` 0, `firsts` много, `lossless`, последнее событие — две трети костей и больше. Форма `WIDE` (4×3). Ослабление: `lossless` → `worst` ≤ `par` + 2; `last` `[5, 6]` → `[4, 6]`. Review Focus: доска не должна начинаться готовым комбо (`checkLayout` откажет — пары по две тройки это разрешают, три рядом нет).

- [ ] **Step 2: В ряд, тест, preview**

`ACT_1` — шесть досок; тест ролей — `['opening', 'apply', 'twist', 'join', 'peak', 'rest']`. Preview: переход пик → `K22` → `P13` (первый уровень хвоста, шестёрки): граница акта читается контрастом (маленькая свежая доска после крупного ухода). Записать в «Что вышло иначе», как читается стык с хвостом: он временный, до акта II и черновиков III–V.

- [ ] **Step 3: Коммит**

```bash
npm test && npm run typecheck && node scripts/level.mjs regress
git add boards/K22.txt src/levels/levels.ts src/levels/campaign.test.ts docs/VI_Levels_Probe_Key.md
git commit -m "Акт I, место 22: передышка K22, шесть троек одним ходом"
```

---

### Task 6: Акт целиком: таблица, проход исполнителя, документы, версия

**Files:**
- Modify: `docs/ROADMAP.md` (раздел «Кампания»), `docs/README.md` (строка этого плана), `docs/VI_Levels_Probe_Key.md` (шапка: где стоят доски), `docs/VI_Levels_Lab.md` (если менялись команды), этот план (статус, «Что вышло иначе», «Что не хватало»)
- Modify: `package.json`, `package-lock.json` — версия 0.2.52

- [ ] **Step 1: Таблица ряда**

`node scripts/ladder.mjs campaign` (в фоне, минуты): строки 17–22 с актом и ролью, `turns`/`away` в полосах ролей (спека 5.4); расхождения — в «Что вышло иначе» с объяснением.

- [ ] **Step 2: Проход исполнителя**

Preview на 360×640, чистые настройки с `levels.road = ROAD_END`: сыграть `R16` (конец пролога) и места 17–22 подряд. Записать по каждой доске: первый напрашивающийся ход; читается ли новая грань; где застрял; сколько ходов против `par`; что чувствуется как граница акта. Это запись в «Что вышло иначе», не слово владельца.

- [ ] **Step 3: Документы**

ROADMAP «Кампания»: состояние — акт I собран <дата>, версия 0.2.52, ждёт игры владельца; следующий — акт II по [плану](2026-10-13-vi-campaign-act-2.md). Индекс: строка этого плана — «выполнен». Ключ: шапка — места 17–22 заняты актом I, хвост 23–36 — прежний список; раздел «Ключ акта I» заполнен. Этот план: статус `выполнен`, разделы «Что вышло иначе» и «Что не хватало» (спека 10.2, журнал процесса: зёрна и правки на доску, что считали руками, какие брифы не нашли доски).

- [ ] **Step 4: Проверки, версия, «ок»**

```bash
npm test && npm run typecheck && npm run build && node scripts/docs-check.mjs && node scripts/level.mjs regress
npm version 0.2.52 --no-git-tag-version
git add package.json package-lock.json docs
git commit -m "Версия 0.2.52: акт I кампании, чтение кости"
```

Сообщение владельцу: что изменилось (места 17–22 — акт I на тройках, строка семи на 17-м, `P03`/`P16`/`P09` переехали, `P23` или новая доска на пике, хвост с 23-го — прежний список), как играть (с `R16` подряд до 22-го и дальше в хвост на два уровня, чтобы почувствовать границу), чего не говорить (ключ акта), и вопрос «ок?». После «ок»: `git fetch origin main && git rebase origin/main`, проверки ещё раз, `git push origin HEAD:main`.

---

## Что вышло иначе

Заполняется исполнителем.

## Что не хватало

Журнал процесса (спека, раздел 10.2): по каждой новой доске — зёрна, правки, что считалось руками, какой паспорт лаборатория не посчитала, какие брифы не нашли доски и почему. Отсюда растёт следующая работа по лаборатории.
