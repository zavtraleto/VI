# Дорога, вторая редакция: план сборки

> Вид: план. Статус: в силе (выполняется в ветке `first-level`). Дата: 2026-10-09. Проверено: 2026-10-09.
> Что заменило: —. Что живёт в коде: src/levels/walk.ts (задача 1); остальное строится по плану.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дорога из 18 кусков: уроки как были, между ними свободные куски на открытых досках без фиксированных костей, строки над полем появляются по слову, одна строка про тусклую кость, очки за звёзды.

**Architecture:** Куски остаются `LevelSpec` в `src/levels/road.ts`; свободные доски кладёт генератор по рецептам нового файла `src/levels/roadRecipes.ts` с тремя новыми условиями отбора в `src/levels/select.ts` (первые ходы, обход состояний, персоны). Строка-подсказка печатается по словам в оболочке; очки считает `src/levels/progress.ts` и хранит `settings.levels`. Правила не меняются.

**Tech Stack:** TypeScript, Vitest, Vite, канвас оболочки `src/shell`. Проверка: `npm test`, `npm run typecheck`, `npm run build`, `node scripts/ladder.mjs`.

**Spec:** [docs/superpowers/specs/2026-10-09-vi-road-free-pieces-design.md](../specs/2026-10-09-vi-road-free-pieces-design.md); первая редакция дороги — [2026-10-08-vi-teaching-road-design.md](../specs/2026-10-08-vi-teaching-road-design.md).

## Global Constraints

- Worktree `.claude/worktrees/first-level`, ветка `first-level`; основную папку не трогать; коммит после каждой задачи; пуш в `main` только после «ок» владельца.
- `src/rules` не меняется: `git diff --stat <старт> -- src/rules` пуст в конце.
- Фиксированных костей (`fixed: true`) нет ни на одном куске, кроме уроков `R01`, `R02`, `R07`, `R11`, `R15` и куска `R16`; тест это держит.
- Вид ведёт владелец; слова строк — предложение, помечены в коде.
- Субагентам указывать `model`: `opus` для задач 2, 3; `sonnet` для 1, 4, 5.
- Коммиты короткие, на русском или английском в стиле последних коммитов ветки.

## Карта файлов

| Файл | Что |
|---|---|
| `src/levels/roadRecipes.ts` (новый) | `ROAD_PLACES`: рецепты 12 свободных кусков и смесей |
| `src/levels/select.ts` | условия `firsts`, `worst`, `personas` в `judge` |
| `src/levels/walk.ts` (новый, из `road.test.ts`) | обход достижимых состояний: `walkBoards(spec)` → худшее число ходов, есть ли тупик |
| `scripts/ladder.mjs` | `place=R03` для мест дороги; `road` — таблица кусков |
| `src/levels/road.ts`, `road.test.ts` | 18 кусков, блоки, подсказки, тесты |
| `src/shell/hint.ts` (или где живёт строка) | печать по словам |
| `src/app/game.ts` | строка про тусклую кость; очки в строке итога |
| `src/levels/progress.ts` | `POINTS_BY_STARS`, `pointsFor(stars)` |
| `src/platform/settings.ts` | `levels.points`, `levels.fixedSaid`, `LevelStat.points` |
| `src/ui/i18n.ts`, `src/ui/lang/*.ts` | `roadHintFixed`, новые слова `roadHintPush` |
| `src/shell/panels.ts` | сумма очков в списке уровней |

---

### Task 1: Условия отбора свободного куска и обход состояний как функция

**Files:**
- Create: `src/levels/walk.ts`, `src/levels/walk.test.ts`
- Modify: `src/levels/select.ts` (`judge`, `Verdict`), `src/levels/recipes.ts` (`Recipe`: поля `firsts?`, `worst?`, `lossless?`, `personas?`)
- Modify: `scripts/ladder.mjs` (столбцы `worst`, `lossless`; `place=` понимает места дороги из задачи 2)

**Interfaces:**

```ts
// src/levels/walk.ts
export interface Walk { boards: number; worst: number; lost: number /* состояния, из которых доска не очищается */ }
export function walkBoards(spec: LevelSpec, limit = 5000): Walk;  // перенос обхода из road.test.ts («is cleared from every board…»); решение из состояния — solveFrom
// src/levels/recipes.ts
firsts?: number;                 // не меньше стольких первых ходов ведут к par или par+1
worst?: number;                  // худшее число ходов из любого достижимого состояния, не больше
lossless?: boolean;              // ни одного состояния без решения
personas?: Partial<Record<'hasty' | 'casual' | 'careful', number>>;  // доля прохождений не ниже, 0..1
```

- [ ] Прочитать обход в `road.test.ts` (строки ~255–313) и `judge` в `select.ts`; `firsts` уже считается для таблицы (`ladder.mjs`): найти, где, и вернуть его в `Verdict`.
- [ ] Тесты `walk.test.ts`: на `ROAD[2]` (R03 первой редакции) `worst === 2`, `lost === 0`; на доске с тупиком (взять `P03` из `levels.ts`) `lost > 0`.
- [ ] Реализовать `walkBoards`; `road.test.ts` переводится на неё (поведение теста прежнее).
- [ ] `judge`: условия `firsts`, `worst`, `lossless`, `personas` (персоны — `personaPlay` из `src/rules/levelBot.ts`, 30 прогонов на персону); тест в `select.test.ts`: рецепт с `lossless: true` отвергает `P03`.
- [ ] `npm test`, `typecheck`; commit.

---

### Task 2: Рецепты и доски 18 кусков

**Files:**
- Create: `src/levels/roadRecipes.ts`
- Modify: `src/levels/road.ts`, `src/levels/road.test.ts`, `scripts/ladder.mjs`

**Interfaces:**

```ts
// src/levels/roadRecipes.ts
export const ROAD_PLACES: readonly (Recipe & { id: string; role: 'free' | 'mix' })[];  // R03–R06, R08–R10, R12–R14, R16–R18 по разделу 4 спеки
```

Рецепты — по таблицам раздела 4 спеки: `size`, `dice`, `faces`, `standing`, `par`, `needs`, `firsts: 2`, `worst: 6`, `lossless: true` для `R03`, `R04`, `personas: { hasty: 0.7, casual: 0.9 }` в блоке A и `{ hasty: 0.7, casual: 0.75 }` дальше; `holes` нет; у `R13` старт на полу с лесенкой (`layout.leaving`, `onFloor`) — генератор лесенку не кладёт: взять доску `R14` первой редакции и открыть её (убрать вырезы, снять `fixed`), проверить теми же условиями; у `R16` две фиксированные кости по спеке — руками.

- [ ] Для каждого места: `node scripts/ladder.mjs place=R03` (и т. д.), три лучшие доски; выбрать одну по крючку куска (раздел 3 спеки: разнообразие граней, размеров, формы кучки) и переписать в `road.ts` картинкой и костями, как сейчас. Уроки `R01`, `R02`, `R07` (бывший R09), `R11` (бывший R13), `R15` (бывший R17 с одной пустой клеткой у уходящей кости) — перенести под новые коды.
- [ ] `ROAD_BLOCKS`: A `R01`–`R06`, B `R07`–`R10`, C `R11`–`R14`, D `R15`–`R18`; `ROAD_HINTS` на `R07`, `R11`, `R15`; `ROAD_SIGNS` `R01: 'N'`; `roadPlace` с неизвестным кодом → `R01`.
- [ ] `road.test.ts`: 18 кусков; уроки как прежние тесты; свободные: условия места через `judge` на самой доске, `walkBoards` (`lost === 0` на `R03`, `R04`; `worst <= 6` везде), `fixed` только там, где разрешено, `par`/`solution` решателем, грани соседних кусков разные, размер чередуется.
- [ ] `node scripts/ladder.mjs road` — таблица 18 кусков: `par`, `firsts`, `worst`, персоны.
- [ ] `npm test`, `typecheck`, `build`; commit.

---

### Task 3: Строки по словам, строка про тусклую кость, слова спуска

**Files:**
- Modify: там, где рисуется строка-подсказка (`rg -n "RoadHint|roadHint" src/shell src/app`), `src/app/game.ts`, `src/ui/i18n.ts`, `src/ui/lang/*.ts`, `src/platform/settings.ts` (`levels.fixedSaid: boolean`)
- Test: тест печати по словам (чистая функция `wordsShown(text, elapsedMs, perWordMs): string`), тест условия показа `roadHintFixed`

**Interfaces:**

```ts
export function wordsShown(text: string, elapsedMs: number, perWordMs = 180): string;  // первые n слов; n = floor(elapsed / perWordMs) + 1
// game.ts: при `resolveMove(...).kind === 'blocked'` и своя кость `fixed` и `!settings.levels.fixedSaid` → hint = { key: 'roadHintFixed', until: 'walk' /* первый hop */ }, fixedSaid = true, таймер 6 с
```

- [ ] Тест `wordsShown`: 0 мс → первое слово; 179 → одно; 180 → два; за концом → весь текст.
- [ ] Печать по словам со щелчком `audio.typed` на каждом новом слове; уменьшенное движение — целиком.
- [ ] `roadHintFixed` в семи языках (ru «Тусклая кость стоит. Шагни на другую»; остальные — предложение, ≤ 8 слов); `roadHintPush` ru «Сойди с уходящей кости на пол и толкни» и шесть языков; тест i18n на полноту и ≤ 8 слов.
- [ ] Условие показа и гашение; `fixedSaid` в настройках с умолчанием `false` и миграцией.
- [ ] Preview: `?road=R05` — свайп с фиксированной кости… на `R05` фиксированных нет: проверить на `?road=R07`; слова появляются по одному; commit.

---

### Task 4: Очки за звёзды

**Files:**
- Modify: `src/levels/progress.ts`, `src/levels/progress.test.ts`, `src/platform/settings.ts`, `src/app/game.ts` (`countLevel`, `outcome`), `src/shell/hud.ts` (строка итога `★★☆ +200`), `src/shell/panels.ts` (`levelsPanel`: сумма внизу)

**Interfaces:**

```ts
// src/levels/progress.ts
export const POINTS_BY_STARS: readonly [number, number, number, number] = [0, 100, 200, 300];
export function pointsFor(stars: number): number;
// settings: levels.points: number; LevelStat.points: number (лучшее за уровень)
```

- [ ] Тест: `pointsFor(3) === 300`; `countLevel` при повторном прохождении добавляет к `levels.points` только разницу `max(0, pointsFor(stars) − stat.points)`.
- [ ] Строка итога и список; миграция настроек (`points: 0`, `LevelStat.points: 0`).
- [ ] `npm test`, `typecheck`, `build`; commit.

---

### Task 5: Документы и отчёт

- [ ] Страницы раздела 9 спеки; в спеке второй редакции — раздел «Что при сборке вышло иначе».
- [ ] Полная проверка, `git diff --stat <старт> -- src/rules` пуст; снимки телефона и экрана: `R03`, `R05` с тупиком, строка по словам, строка итога с очками.
- [ ] Отчёт владельцу коротко: что собрано, таблица `ladder.mjs road`, что иначе, открытое (раздел 12 спеки), вопрос «коммит и пуш?».

## Самопроверка по спеке

| Раздел | Задача |
|---|---|
| 3 принцип, 4 набор | 2 |
| 5 подбор | 1, 2 |
| 6 строки | 3 |
| 7 очки | 4 |
| 8 хранение | 2 (`roadPlace`), 4 |
| 9 документы, 10 проверка | 5 |
