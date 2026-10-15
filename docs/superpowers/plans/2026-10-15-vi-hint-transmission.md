# VI — подсказка доски как передача: план реализации

> Вид: план. Статус: в силе. Дата: 2026-10-15.
> Что заменило: —. Что живёт в коде: src/signal/hintFrame.ts, src/signal/caption.ts, src/signal/player.ts, src/app/hint.ts, src/app/game.ts.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Подсказка доски показывается окном передачи с морем, столбом и закатом, текст печатается по словам на тёмной полосе. Строка над полем и строка про тусклую кость убраны. После прохождения всего ряда выходит такое же окно «Продолжение следует…» со ссылкой в Endless.

**Architecture:** `SignalPlayer` получает третий вид показа — `tell`, в дополнение к ответу и проблеску. Карточку сцены собирает новый `src/signal/hintFrame.ts`: только `sea` + `pole` + `sun`. Подпись (`caption.ts`) умеет подложку, печать по словам и подчёркнутую ссылку. `game.ts` зовёт `tell` в `runLevel` и в конце ряда, а всё про строку над полем удаляется.

**Tech Stack:** TypeScript, three.js, Vite, vitest.

**Spec:** [docs/superpowers/specs/2026-10-15-vi-hint-transmission-design.md](../specs/2026-10-15-vi-hint-transmission-design.md). Исполнитель читает спеку и этот план.

## Дополнение владельца, 15 октября 2026 (после принятия спеки)

Слова владельца: «после прохождения всех уровней также покажи всплывающее окно с текстом "продолжение следует. в ожидании новых уровней вы можете попробовать бесконечный режим", при этом текст "бесконечный режим" с нижним подчёркиванием и когда игрок кликает на него — он попадает в endless mode».

Решения исполнителя (сказаны владельцу):

- Окно то же, что у подсказки: море, столб, закат, полоса с текстом по словам.
- Выходит, когда пройдена последняя непройденная доска ряда: после того как кости ушли под пол, до окна итога или до следующей доски.
- Выходит один раз на длину ряда: ключ `end:<CAMPAIGN.length>` в `settings.levels.told`. Новые уровни удлиняют ряд, и когда игрок пройдёт их все, окно выйдет снова.
- Тап по подчёркнутым словам запускает Endless, как пункт меню (`this.open(FILE_LEADS.protocol)`). Тап мимо них: пока текст печатается — дописывает его, когда дописан — закрывает окно, и дальше всё идёт как обычно.
- Клавиши: `Enter` при дописанном тексте запускает Endless, любая другая клавиша ведёт себя как тап мимо ссылки.

Русский текст: «Продолжение следует. В ожидании новых уровней вы можете попробовать {бесконечный режим}.» Фигурные скобки отмечают ссылку и не рисуются.

## Global Constraints

- Интерфейс рисуется только в канвасе; новый DOM не заводить.
- `src/rules` не трогать.
- Тексты на семи языках: `ru` (база `RU` в `src/ui/i18n.ts`), `en` (там же), `de`, `es`, `fr`, `pt`, `tr` (`src/ui/lang/*.ts`). Новый ключ — сначала в `RU`, иначе typecheck падает.
- Слова в подсказках без `!`.
- Проверки: `npm test`, `npm run typecheck`, `npm run build`, `node scripts/docs-check.mjs`.
- Коммиты — в `main`, только свои файлы (в папке лежат чужие `.codex/`, `AGENTS.md`). Без пуша: пуш — по «ок» владельца.
- Версия: `package.json` 0.2.60.

## Review Focus

1. **Клавиша, закрывшая окно, не делает ход.** Слушатели `keydown` на `window` идут в порядке регистрации: `SignalPlayer` закрывает окно раньше, чем `bindKeyboard` проверяет `moving()`. Решение: `SignalPlayer` слушает в фазе захвата и при открытом `tell` гасит событие (`stopImmediatePropagation`). Проверяется в превью.
2. **Проход между досками стоит, пока окно открыто.** `runPassage` вызывается без проверки `signal.busy` (`game.ts` около строки 2892). Без правки поднятие костей шло бы под окном.
3. **Узкий экран 360×640.** Столб и солнце в кадре, текст не мельче 19 css px и не шире кадра. Покрывает тест `hintComposition` для `aspect < 1`; остальное — снимок.
4. **Уменьшенное движение.** Текст стоит целиком сразу, без щелчков, первый тап закрывает окно. Тест на `revealed` в `caption.test.ts`.
5. **Старое сохранение без `told`.** Загружается и получает `[]`. Тест в `settings`.

---

### Task 1: Тексты

**Files:**
- Modify: `src/ui/i18n.ts` — ключи около строк 142–160 (RU) и 288–294 (EN)
- Modify: `src/ui/lang/de.ts`, `es.ts`, `fr.ts`, `pt.ts`, `tr.ts`
- Test: `src/app/hint.test.ts`

**Interfaces:**
- Produces: ключи `roadHintChain`, `roadHintWalk`, `roadHintPush`, `roadHintClimb`, `hintSeven` с новыми словами; новый ключ `campaignEnd`; `roadHintFixed` удалён.

- [ ] **Step 1.** Заменить тексты в RU:

```ts
  roadHintChain: 'К уходящему комбо можно добавлять кости.',
  roadHintWalk: 'По уходящим костям можно ходить.',
  roadHintPush: 'Спустись по уходящим костям и толкай.',
  roadHintClimb: 'Уходящие кости позволяют подниматься и опускаться.',
  hintSeven: 'Сумма точек на противоположных гранях всегда равна 7.',
  // The window after the last board of the row: the words in braces are the way to the endless session (word of the owner, 15 October 2026).
  campaignEnd: 'Продолжение следует. В ожидании новых уровней вы можете попробовать {бесконечный режим}.',
```

Удалить `roadHintFixed`. Комментарий над блоком поправить: тексты — слова владельца 15 октября; показываются окном передачи.

- [ ] **Step 2.** EN:

```ts
  roadHintChain: 'Dice can be added to a leaving combo.',
  roadHintWalk: 'You can walk on leaving dice.',
  roadHintPush: 'Go down the leaving dice and push.',
  roadHintClimb: 'Leaving dice let you climb up and down.',
  hintSeven: 'Opposite faces always add up to 7.',
  campaignEnd: 'To be continued. While new levels are on their way, you can try {endless mode}.',
```

- [ ] **Step 3.** DE, ES, FR, PT, TR — перевести по смыслу; `roadHintFixed` удалить. Образец:
  - DE: `'Zu einer verschwindenden Kombo kann man Würfel hinzufügen.'`, `'Auf verschwindenden Würfeln kann man gehen.'`, `'Steig über die verschwindenden Würfel hinab und schiebe.'`, `'Verschwindende Würfel lassen dich hinauf- und hinabsteigen.'`, `'Gegenüberliegende Seiten ergeben immer 7.'`, `'Fortsetzung folgt. Bis neue Level kommen, probiere den {Endlosmodus}.'`
  - ES: `'A un combo que se va se le pueden añadir dados.'`, `'Puedes caminar sobre los dados que se van.'`, `'Baja por los dados que se van y empuja.'`, `'Los dados que se van te dejan subir y bajar.'`, `'Las caras opuestas siempre suman 7.'`, `'Continuará. Mientras llegan nuevos niveles, prueba el {modo infinito}.'`
  - FR: `'On peut ajouter des dés à un combo qui s’en va.'`, `'On peut marcher sur les dés qui s’en vont.'`, `'Descends par les dés qui s’en vont et pousse.'`, `'Les dés qui s’en vont permettent de monter et descendre.'`, `'Les faces opposées font toujours 7.'`, `'À suivre. En attendant de nouveaux niveaux, essaie le {mode infini}.'`
  - PT: `'Dá para juntar dados a um combo que está indo embora.'`, `'Dá para andar sobre dados que estão indo embora.'`, `'Desça pelos dados que estão indo embora e empurre.'`, `'Dados que estão indo embora deixam subir e descer.'`, `'Faces opostas sempre somam 7.'`, `'Continua. Enquanto novos níveis não chegam, experimente o {modo infinito}.'`
  - TR: `'Giden komboya zar eklenebilir.'`, `'Giden zarların üstünde yürüyebilirsin.'`, `'Giden zarlardan aşağı in ve it.'`, `'Giden zarlar inip çıkmanı sağlar.'`, `'Karşılıklı yüzler her zaman 7 eder.'`, `'Devam edecek. Yeni bölümler gelene kadar {sonsuz modu} deneyebilirsin.'`

- [ ] **Step 4.** В `src/app/hint.test.ts`:
  - убрать `['fixed', { key: 'roadHintFixed' }]` из `pieces` (строка 76);
  - предел слов поднять с 8 до 10;
  - убрать тест «помещается в два ряда на телефоне» (около строки 107): окно шире строки;
  - добавить тест:

```ts
it('the end of the row names its link once, in braces, in every language', () => {
  for (const language of LANGUAGES) {
    setLanguage(language);
    const text = t('campaignEnd');
    expect(text.match(/\{[^{}]+\}/g)?.length, language).toBe(1);
  }
});
```

(имена `LANGUAGES` и `setLanguage` взять те, что уже использует этот файл).

- [ ] **Step 5.** `npx vitest run src/app/hint.test.ts` — проходит, кроме тестов, которые удаляются в Task 4. Коммит в конце Task 4.

### Task 2: Подпись — подложка, печать по словам, ссылка

**Files:**
- Modify: `src/signal/caption.ts`
- Modify: `src/shell/hudLayout.ts` — `wordsShown` и `HINT_WORD_MS` переезжают в `caption.ts`; в `hudLayout.ts` оставить реэкспорт до Task 4, там его удалить
- Test: `src/signal/caption.test.ts` (новый)

**Interfaces:**
- Produces:
  - `wordsShown(text: string, elapsedMs: number, perWordMs?: number): string` — без изменений, теперь из `src/signal/caption.ts`;
  - `HINT_WORD_MS = 180`;
  - `captionWords(text: string): { word: string; link: boolean }[]` — слова без скобок, с отметкой ссылки;
  - `drawCaption(ctx, text, x, y, width, height, opts?: CaptionOptions): CaptionDrawn`, где
    - `interface CaptionOptions { plate?: boolean; words?: number }` (`words` — сколько слов напечатано, по умолчанию все);
    - `interface CaptionDrawn { link: { x: number; y: number; w: number; h: number }[] }` — прямоугольники ссылки в координатах `ctx`.

- [ ] **Step 1.** Тест (`src/signal/caption.test.ts`):

```ts
import { describe, expect, it } from 'vitest';
import { captionWords, wordsShown } from './caption';

describe('caption words', () => {
  it('marks the words in braces as the link and drops the braces', () => {
    expect(captionWords('try {endless mode}.')).toEqual([
      { word: 'try', link: false },
      { word: 'endless', link: true },
      { word: 'mode.', link: true },
    ]);
  });
  it('says one more word every step, the first at once', () => {
    expect(wordsShown('a b c', 0, 180)).toBe('a');
    expect(wordsShown('a b c', 360, 180)).toBe('a b c');
    expect(wordsShown('a b c', 0, 0)).toBe('a b c');
  });
});
```

Подложку и рисование с `ctx` проверить заглушкой контекста:
- `measureText` возвращает `{ width: line.length * 10 }`;
- `fillRect`, `strokeText`, `fillText` пишутся в массив.

Проверить три вещи:
- (а) без `opts` вызывается только `strokeText`/`fillText` и нет `fillRect`;
- (б) с `plate: true` первым идёт `fillRect` на всю `width`;
- (в) с `words: 1` нарисовано одно слово, и его `x` такой же, как у первого слова при полном тексте: слова не сдвигаются.

- [ ] **Step 2.** `npx vitest run src/signal/caption.test.ts` — падает, `captionWords` нет.

- [ ] **Step 3.** Реализация в `caption.ts`:
  - **Скобки.** `captionWords` режет текст по пробелам; слово, в котором есть `{`, открывает ссылку, слово с `}` закрывает её; скобки из слов убираются.
  - **Раскладка.** `drawCaption` раскладывает по строкам полный текст без скобок через `wrapCaption`. Каждую строку пишет от левого края `x + (width − ширинаСтроки)/2` с `textAlign = 'left'`: слово за словом, через ширину пробела, и только первые `opts.words` слов.
  - **Ссылка.** Слова ссылки подчёркиваются линией толщиной `max(1, size/14)` на `size*0.12` ниже базовой линии, тем же цветом, с тем же тёмным краем. Их прямоугольник (`x`, верх строки `at − size`, ширина, `size*LEADING`) идёт в `link`. Соседние слова ссылки в одной строке сливаются в один прямоугольник.
  - **Подложка** при `plate`:
    - `ctx.fillStyle = 'rgba(0,0,0,0.55)'`;
    - высота `(lines.length + 1) * size * LEADING`;
    - низ на `y + height * (1 − PLATE_BOTTOM)`, где `PLATE_BOTTOM = 0.06`;
    - во всю `width`, рисуется до текста.
  - **Текст на подложке.** Последняя строка стоит на `y + height*(1−PLATE_BOTTOM) − size*LEADING*0.5 − size*0.25`, остальные строки выше на `size*LEADING`. Без подложки — как сейчас: `BOTTOM`.
  - **Размер букв:**
    - без подложки — прежний `unit * SIZE`;
    - с подложкой — `max(unit * SIZE, minPx)`, где `minPx` передаётся в `opts.minSize` (в пикселях `ctx`);
    - ширина строки с подложкой — `0.86 * width`.
  - Добавить `minSize?: number` в `CaptionOptions`.

- [ ] **Step 4.** `npx vitest run src/signal/caption.test.ts` — проходит.

- [ ] **Step 5.** Коммит: `git add src/signal/caption.ts src/signal/caption.test.ts src/shell/hudLayout.ts` — «Подпись передачи: подложка, слова по одному, ссылка».

### Task 3: Сцена подсказки

**Files:**
- Create: `src/signal/hintFrame.ts`
- Test: `src/signal/hintFrame.test.ts`

**Interfaces:**
- Consumes:
  - `Recipe`, `thingParam` из `./compose`;
  - `figureOf`, `SignalCard` из `./card`;
  - `Frame` из `./director`.
- Produces:
  - `HINT_SCENE` — таблица пределов из раздела 4.2 спеки;
  - `HINT_RECIPE: Recipe = { id: 'sea_pole_sun', place: 'sea', things: ['pole', 'sun'] }`;
  - `hintComposition(random: () => number, aspect: number): { pole: number; sun: number; elevation: number }` — доли со знаком, от −1 до 1 по половине ширины кадра; `elevation` в градусах;
  - `hintCard(random: () => number, aspect: number, text: string): SignalCard` — `contact` в `[0, 0.25]`, `frame.mixing === 1`, `frame.variant === 'a'`, `seconds: Infinity`, `caption: text`.

- [ ] **Step 1.** Тест:

```ts
import { describe, expect, it } from 'vitest';
import { HINT_RECIPE, hintCard, hintComposition } from './hintFrame';

const seq = (seed: number) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

describe('the scene of a hint', () => {
  it('puts the pole and the sun on two sides of the frame', () => {
    for (let i = 1; i < 200; i++) {
      const wide = hintComposition(seq(i), 16 / 9);
      expect(Math.sign(wide.pole)).toBe(-Math.sign(wide.sun));
      expect(Math.abs(wide.pole)).toBeGreaterThanOrEqual(0.25);
      expect(Math.abs(wide.pole)).toBeLessThanOrEqual(0.45);
      expect(Math.abs(wide.sun)).toBeGreaterThanOrEqual(0.2);
      expect(Math.abs(wide.sun)).toBeLessThanOrEqual(0.45);
      expect(wide.elevation).toBeGreaterThanOrEqual(2);
      expect(wide.elevation).toBeLessThanOrEqual(14);
      const tall = hintComposition(seq(i), 9 / 16);
      expect(Math.abs(tall.pole)).toBeLessThanOrEqual(0.3);
      expect(tall.elevation).toBeGreaterThanOrEqual(4);
    }
  });
  it('is the sea with the pole and the sun, light, and the same for the same chance', () => {
    const a = hintCard(seq(7), 1.5, 'x');
    expect(a.frame.recipe).toEqual(HINT_RECIPE);
    expect(a.frame.mixing).toBe(1);
    expect(a.contact).toBeLessThanOrEqual(0.25);
    expect(a.caption).toBe('x');
    expect(a.seconds).toBe(Infinity);
    expect(hintCard(seq(7), 1.5, 'x')).toEqual(a);
  });
});
```

- [ ] **Step 2.** Запустить — падает (нет модуля).

- [ ] **Step 3.** Реализация:
  - `hintComposition`:
    - сторона столба `side = random() < 0.5 ? -1 : 1`;
    - `pole = side * lerp(aspect < 1 ? 0.15 : 0.25, aspect < 1 ? 0.3 : 0.45, random())`;
    - `sun = -side * lerp(0.2, 0.45, random())`;
    - `elevation = aspect < 1 ? lerp(4, 18, random()) : lerp(2, 14, random())`.
  - `hintCard`:
    - берёт `comp`, затем тройку цветов `HINT_SCENE.palettes[floor(random()*4)]` и остальные пределы;
    - строит `values`: ключи места — `skyTop`, `skyHorizon`, `ground`, `lightAmount`, `glow`, `waveHeight`, `waveSpeed`, `glint`, `glintColor`, `glintWidth`, `lightAngle`; ключи предметов через `thingParam('pole', 'height')` и т. д., `thingParam('sun', 'elevation')`, `thingParam('pole', 'x')`.
  - Перевод долей в мир:
    - `fov` — вертикальный угол камеры места (взять из `src/signal/kit.ts`/`open.ts`: на чём строится `PerspectiveCamera`);
    - `halfH = atan(tan(fov/2) * aspect)`;
    - `lightAngle = 180 + deg(atan(comp.sun * tan(halfH)))` (знак проверить глазами: солнце должно оказаться на стороне `sun`);
    - `pole.x = comp.pole * tan(halfH) * camDistance`, где `camDistance` — значение места `sea` (`subject: 8`; камеру ставит `subject`, взять расстояние из `values.camDistance` по умолчанию `openPlace`).
  - Волна: `waveHeight` и `waveSpeed` — значения места `sea` × `lerp(0.6, 1.4, random())`; базу брать из `def.params` через `frameDef(HINT_RECIPE)` (`./compose`).
  - `contact = random() * 0.25`; `seed = 1 + floor(random()*9999)`; `figure = figureOf(frame)`.

- [ ] **Step 4.** Тест проходит.

- [ ] **Step 5.** Коммит: «Сцена подсказки: море, столб и солнце по третям».

### Task 4: Подсказки по коду доски без строки; сохранение

**Files:**
- Modify: `src/app/hint.ts`, `src/levels/campaign.ts:44-67`, `src/levels/road.ts:348-369`, `src/platform/settings.ts:67-84,150`
- Modify: `src/shell/hud.ts`, `src/shell/hudLayout.ts` (удаление строки)
- Test: `src/app/hint.test.ts`, `src/levels/campaign.test.ts:100-105`, `src/levels/road.test.ts:358`, тест настроек (тот файл, где уже тестируется `loadSettings`; найти `grep -rl loadSettings src --include=*.test.ts`)

**Interfaces:**
- Produces:
  - `interface Hint { key: HintKey }`;
  - `HINTS: Record<string, Hint>` и `ROAD_HINTS` без `until`;
  - `tellsHint(id: string, told: readonly string[]): boolean`;
  - `endKey(length: number): string` → `` `end:${length}` ``;
  - `endDue(passed: Record<string, boolean|undefined>, ids: readonly string[], told: readonly string[]): boolean` — все `ids` пройдены и `endKey(ids.length)` нет в `told`;
  - `LevelProgress.told: string[]`;
  - `probeHint(name): Hint | null` — прежний, без `until`.

- [ ] **Step 1.** Тесты:

```ts
it('tells a hint once for a board', () => {
  expect(tellsHint('R07', [])).toBe(true);
  expect(tellsHint('R07', ['R07'])).toBe(false);
});
it('says the end of the row once for its length', () => {
  const passed = { A: true, B: true };
  expect(endDue(passed, ['A', 'B'], [])).toBe(true);
  expect(endDue(passed, ['A', 'B'], ['end:2'])).toBe(false);
  expect(endDue({ A: true }, ['A', 'B'], [])).toBe(false);
  expect(endDue({ A: true, B: true, C: true }, ['A', 'B', 'C'], ['end:2'])).toBe(true);
});
```

`campaign.test.ts`: ожидание `HINTS` — те же пять кодов, только `{ key }`. `road.test.ts`: `{ R07: { key: 'roadHintChain' } }`. Настройки: старое сохранение без `told` даёт `levels.told` равным `[]`.

- [ ] **Step 2.** Запустить — падает.

- [ ] **Step 3.** Реализация:
  - **`hint.ts`.**
    - Удалить `hintOver`, `FIXED_LINE_MS`, `fixedStopped`, `saysFixed`, `fixedLineOver`, `roomLines`, `saysLine` и ставшие лишними импорты (`DELTA`, `cubeAt`, `inBounds`, `isFree`, `CubeState`, `GameEvent`, `RunState`, `HintUntil`), если у них не осталось читателей.
    - Добавить `tellsHint`, `endKey`, `endDue`. `PROBE` — без `until`.
  - **`road.ts`.** Удалить `HintUntil`; `RoadHint = { key: RoadHintKey }`; `ROAD_HINTS = { R07: { key: 'roadHintChain' } }`.
  - **`campaign.ts`.** `Hint = { key: HintKey }`; из `HINTS` убрать `until`; комментарий: показывается окном передачи один раз на доску.
  - **`settings.ts`.** `fixedSaid` заменить на `told: string[]`, по умолчанию `told: []` в `fallback.levels`.
  - **`hud.ts`.** Удалить:
    - `HudView.hint`, `onHintWord`;
    - поля `hintText`, `hintSince`, `hintGone`, `hintSaid`, `hintSigns`;
    - `hintFade`, `hintRoom`, `hintPlace`;
    - блоки около строк 685–690 и 789–793;
    - `hint` в строке `state` (около 714);
    - сброс в строках 608–609.
  - **`hudLayout.ts`.** Удалить `hintBox`, `hintAlpha`, `hintResumes`, `hintSaidFor`, `HINT_FADE_MS`, `HINT_STEPS`, `HINT_EM`, `HINT_TOP`, `HINT_SIDE`, `HINT_BELOW` и реэкспорт `wordsShown`/`HINT_WORD_MS` (их читатели берут из `src/signal/caption.ts`). Если `toolButtons` принимает место строки — убрать параметр.
  - **`hint.test.ts`.** Удалить тесты `hintBox`, `hintAlpha`, кнопок против строки, `hintResumes`, `roomLines`/`saysLine`, `saysFixed`/`fixedLineOver`, `hintOver`. `wordsShown` импортировать из `../signal/caption`.

- [ ] **Step 4.** `npx vitest run src/app src/levels src/signal src/platform` проходит. `npm run typecheck` покажет только `game.ts`: он чинится в Task 6. Для промежуточного коммита Task 4 и 5 делаются вместе с Task 6, и коммит идёт после Task 6.

### Task 5: `SignalPlayer.tell`

**Files:**
- Modify: `src/signal/player.ts`

**Interfaces:**
- Consumes:
  - `hintCard` (Task 3);
  - `drawCaption`, `captionWords`, `wordsShown`, `HINT_WORD_MS` (Task 2).
- Produces:

```ts
export interface Telling {
  text: string;
  onDone: () => void;
  /** Called instead of `onDone` when the link of the text is pressed. */
  onLink?: () => void;
  /** Milliseconds a word; 0 shows the text at once. */
  wordMs: number;
  /** Motion kept low: the text stands whole and makes no sound. */
  reduced: boolean;
}
tell(telling: Telling): void;
onWord: ((sign: string) => void) | null;
```

- [ ] **Step 1.** В `Playing` добавить поля:
  - `size: number`;
  - `told: { telling: Telling; full: boolean; words: number; since: number | null; links: Rect[] } | null`.

  В `play(...)` добавить параметры `size = contact`, `place`, `told = null`. `answer` и `glimpse` идут как раньше: `size` равен `contact`, место случайное.

- [ ] **Step 2.** `tell(telling)`:
  - если `!this.enabled`, вызвать `telling.onDone()` и выйти;
  - иначе взять `layout = windowLayout(размер картинки по текущему экрану, 1, { x: 0.5, y: 0.5 })`, `aspect = layout.content.w / layout.content.h`; размер картинки — так же, как в `frame()`: `pictureSize(...)` от `display`;
  - `card = hintCard(this.random, aspect, текстБезСкобок)`, `card.caption = telling.text` (со скобками, их разбирает `drawCaption`);
  - `this.play(card, card.contact, telling.onDone, false, 1, { x: 0.5, y: 0.5 }, { telling, full: telling.reduced || telling.wordMs <= 0, words: 0, since: null, links: [] })`.

- [ ] **Step 3.** В `frame()`:
  - `windowLayout(…, playing.size, playing.place)`;
  - `if (elapsed >= playing.durationMs)` для `tell` не срабатывает: `durationMs = Infinity`;
  - для `told`:
    - отсчёт слов начинается, когда окно раскрылось: `since ??= timeMs` при `opened >= 1`;
    - `shown = wordsShown(plain, timeMs − since, wordMs)`, где `plain` — текст без скобок;
    - `words = shown.split(' ').length`;
    - каждое новое слово — `onWord?.(первая буква)`, если не `reduced`;
    - при `words` равном числу слов — `full = true`;
  - полоса показаний: `played = words / всего слов`;
  - `contact` в ячейках связи — как есть.

- [ ] **Step 4.** `writeCaption` для `told`:
  - вызывать `drawCaption(ctx, text, …, { plate: true, words, minSize: 19 * scale })`;
  - в строку `state` добавить `words`;
  - возвращённые `link` перевести в css-пиксели (поделить на `scale`) и сохранить в `told.links`.

- [ ] **Step 5.** Ввод:
  - Слушатели переписать на фазу захвата: `window.addEventListener('pointerdown', (e) => this.press(e.clientX, e.clientY, e), true)` и `window.addEventListener('keydown', (e) => this.key(e), true)`.
  - `press`/`key` при `playing?.told` гасят событие (`e.stopImmediatePropagation(); e.preventDefault()` — только для `pointerdown` без `preventDefault`, чтобы не ломать фокус):
    - текст не дописан — `full = true`, `since` сдвинуть так, чтобы все слова стояли;
    - дописан, прошло `SKIP_AFTER_MS`, нажатие в `links` или `Enter` при наличии ссылки — `finish(true)`: зовёт `onLink`, если он задан;
    - иначе — `finish()`.
  - Для обычных передач — прежний `skip()`.

- [ ] **Step 6.** `finish(link = false)`: в конце звать `link && told?.telling.onLink ? told.telling.onLink() : playing.onDone()`.

- [ ] **Step 7.** `npm run typecheck` по этому файлу чист.

### Task 6: `game.ts`: окно подсказки, конец ряда, удаление строки

**Files:**
- Modify: `src/app/game.ts`
- Modify: `src/lab/boardPanel.ts:156` — подпись «окно подсказки: мс на слово»

**Interfaces:**
- Consumes: `tellsHint`, `endKey`, `endDue`, `probeHint` (Task 4); `SignalPlayer.tell`, `onWord` (Task 5).

- [ ] **Step 1.** Удалить:
  - поля `hint`, `fixedLine`, `fixedShown` (около строк 413–420) и их сброс в `begin` (около 1055–1058);
  - блок тика с `hintOver`/`saysFixed`/`fixedLineOver` (около 2486–2503);
  - `hintRoom()` (около 1934) и его вызовы: `runLevel` — `this.view.setClear(0)`, `layoutGuide` — `this.inMenu ? 0 : 0`, упростить до 0 (проверить, что делает `setClear`, и оставить вызов с 0);
  - `hint:` в виде HUD (около 2806);
  - `onHintWord` (около 494).

- [ ] **Step 2.** `this.signal.onWord = (sign) => this.audio.typed(sign);` рядом с `onSound` (около 610).

- [ ] **Step 3.** В `runLevel` после `this.begin(...)` и `sayLevelStarted`:

```ts
const own = HINTS[spec.id];
const probe = this.labSpec === null && this.piece !== null ? HINT_PROBE : null;
const told = this.settings.levels.told;
if (this.labSpec === null && (probe || (own && tellsHint(spec.id, told)))) {
  const key = (probe ?? own)!.key;
  this.signal.tell({
    text: t(key),
    wordMs: Number(this.look.board.hintWordMs),
    reduced: prefersReducedMotion(this.settings),
    onDone: () => {
      if (probe || told.includes(spec.id)) return;
      told.push(spec.id);
      this.later.after(() => saveSettings(this.settings), 'settings');
    },
  });
}
```

(Имя `this.look.board.hintWordMs` взять то, по которому HUD сейчас читает `hintWordMs`: `grep -n hintWordMs src/app/game.ts src/shell/hud.ts`.)

- [ ] **Step 4.** Проход стоит под окном: условие около строки 2892 → `if (this.passage && !this.inMenu && !this.signal.busy)`.

- [ ] **Step 5.** Конец ряда. В `runPassage`, после `if (now.phase === 'combo' || now.phase === 'sink') return;` и до `if (!passage.next)`:

```ts
if (!passage.endAsked) {
  passage.endAsked = true;
  const ids = CAMPAIGN.map(({ spec }) => spec.id);
  const { levels } = this.settings;
  if (this.labSpec === null && endDue(levels.passed, ids, levels.told)) {
    const mark = (): void => {
      levels.told.push(endKey(ids.length));
      this.later.after(() => saveSettings(this.settings), 'settings');
    };
    this.signal.tell({
      text: t('campaignEnd'),
      wordMs: Number(this.look.board.hintWordMs),
      reduced,
      onDone: mark,
      onLink: () => {
        mark();
        this.open(FILE_LEADS.protocol);
      },
    });
    return;
  }
}
```

Поле `endAsked: boolean` добавить в тип прохода (там, где описаны `struck`, `aligned`, `swapped`) и в место, где проход создаётся (`startPassage`), со значением `false`. Если `FILE_LEADS.protocol` — не тот ключ, что ведёт в Endless, проверить `open()` около строки 2019: нужен путь до `startRun('endless')`.

- [ ] **Step 6.** `npm test`, `npm run typecheck`, `npm run build` — всё зелёное.

- [ ] **Step 7.** Коммит Task 4–6 вместе: только свои файлы (`git add` по списку), сообщение «Подсказка доски — окно передачи; окно конца ряда».

### Task 7: Документы и версия

**Files:**
- Modify: `docs/art/VI_Interface_Layer.md` — строки «Строка-подсказка над полем» и «Строка акта кампании» (около 117–118) заменить одной строкой «Окно подсказки доски» и добавить строку «Окно конца ряда»
- Modify: `docs/art/VI_World_Logic.md` — строки 249–250 заменить строкой окна подсказки и строкой окна конца ряда; причина в мире — за владельцем, открытый вопрос из раздела 9 спеки
- Modify: `docs/VI_Owner_Words.md` — запись 15 октября (подсказки окном передачи, тексты прямее, окно конца ряда со ссылкой в Endless)
- Modify: `docs/VI_Levels_Rules.md` — только если там есть слова о строке над полем или о тусклой кости (`grep -n "тускл\|строк" docs/VI_Levels_Rules.md`)
- Modify: `docs/README.md` — статус спеки «построено, v0.2.60»; строка этого плана — «выполнен»
- Modify: шапка плана — статус «выполнен»; в конце раздел «Что вышло иначе»
- Modify: `package.json` — `"version": "0.2.60"`

- [ ] **Step 1.** Правки по списку.
- [ ] **Step 2.** `node scripts/docs-check.mjs` — расхождений нет.
- [ ] **Step 3.** Коммит: «Документы: окно подсказки и конец ряда, v0.2.60».

### Task 8: Глазами

- [ ] **Step 1.** Превью `vi-dev` (порт 5183).
- [ ] **Step 2.** 1920×1080:
  - открыть `?hint=chain` на куске дороги;
  - снимок в середине печати и с полным текстом;
  - тап — текст дописан, второй тап — окно закрыто, фигура на месте, кости поднимаются, над полем пусто.
- [ ] **Step 3.** 360×640 — то же.
- [ ] **Step 4.** Конец ряда:
  - в консоли разработчика выставить все коды пройденными, кроме последнего, и пройти последнюю доску, или временно вызвать окно из консоли;
  - проверить, что ссылка подчёркнута;
  - тап по ней ведёт в Endless.
- [ ] **Step 5.** Снимки прислать владельцу. Превью оставить запущенным.

## Что вышло иначе

(заполняется по ходу)
