# VI — мёртвый код и быстрая загрузка: план

> Вид: план. Статус: не выполнен. Дата: 2026-10-15. Принят владельцем 15 октября 2026; код — после его слова, что слой платформы в main. Исполняет спеку [2026-10-15-vi-dead-code-and-loading-design.md](../specs/2026-10-15-vi-dead-code-and-loading-design.md).

> **Исполнителю-агенту:** нужен навык superpowers:executing-plans (или superpowers:subagent-driven-development). Шаги — флажки `- [ ]`. Модель — Opus (CLAUDE.md: реализация по плану).

**Цель:** убрать из игры четыре режима, которых нет в меню, и сократить время до первого кадра boot и до `START` на медленном телефоне.

**Как:** пять коммитов удаления (по режиму, каждый зелёный), затем три шага загрузки: preload шрифта программы в `index.html`, текст README отдельным чанком, тяжёлая часть передач отдельным чанком, который boot ждёт перед `START`. До и после — один и тот же замер, `scripts/load-bench.mjs`.

**Стек:** TypeScript, Vite 8 (rolldown), vitest, three.js, Chrome по CDP для замера.

**Спека:** `docs/superpowers/specs/2026-10-15-vi-dead-code-and-loading-design.md` — исполнитель читает её разделы 3, 4, 5, 7, 8 и ответы раздела 9 и этот план. Весь проект заново не изучается.

## Общие правила

- Работа в основной папке, ветка `main`. Перед началом: `git fetch` и `git status -sb`; если `main` позади `origin/main` — `git pull --ff-only`; не проходит — сказать пользователю, силой не чинить.
- Код начинается только после слова пользователя, что слой платформы влит в main (спека, раздел 7).
- **Коммит — только после «ок» пользователя.** В конце каждой задачи: показать, что сделано и что проверено, спросить «коммит?». Перед коммитом — `git pull --ff-only`. В коммит — только свои файлы, поимённо (`git add <путь> …`), никогда `git add -A`. Пуш в `main` публикует сборку на GitHub Pages — только по отдельному «ок».
- Сообщение коммита: заголовок до 70 знаков, не больше пяти строк тела (зачем и что проверено), последняя строка — `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Каждый коммит зелёный: `npm test`, `npm run typecheck`, `npm run build`; после правки документов — `node scripts/docs-check.mjs`. Полный vitest под нагрузкой — `npx vitest run --maxWorkers=3`; `src/rules/bot.test.ts` иногда не укладывается — гонять его отдельно.
- `src/rules` — чистая симуляция; правила Endless не меняются: `node scripts/pace.mjs endless` до и после каждой задачи удаления выводит те же строки.
- Ключ перевода удаляется во всех семи словарях сразу: `src/ui/i18n.ts` (ru, en) и `src/ui/lang/{de,es,fr,pt,tr}.ts`.
- Правка игры, которая расходится со страницей-истиной, правит её в том же коммите (спека, раздел 8). На страницу-истину нельзя оставлять ссылку на удалённый файл: docs-check это ловит.
- Дев-сервер — только через preview (`vi-dev`, порт 5183); сборка — `vi-build` (`npx vite preview`, порт 5184).
- Номера строк в спеке и здесь — по дереву `26c8a10`; искать по имени.

## На что смотреть ревьюеру

Пять случаев, которых спека прямо не называет, но о которые игрок споткнётся первым; каждый закрыт тестом или проверкой в своей задаче:

1. **Сохранение старой версии** с `puzzle`, `tutorialDone`, `runs.timed*`, с партией `kind: 'timed'` в `vi.run.v1` — игра открывается как обычно, лишнее снято (тесты в задачах 2, 3, 4).
2. **Чанк передач не пришёл** (обрыв сети, медленная сеть): boot не зависает навсегда, `START` приходит; подсказка доски не теряется и не засчитывается показанной без показа (тест `frames.test.ts` и ручная проверка, задача 9).
3. **Игрок жмёт `SKIP` сразу** на медленной сети: `START` не появляется раньше передач; последний кадр boot стоит (задача 9, проверка под троттлингом).
4. **README открыт, пока чанк ещё идёт, и игрок ушёл из меню**: панель README не всплывает поверх другого экрана (задача 8).
5. **Сборка для Playgama** (`npm run pack -- playgama`): в архиве есть новые чанки и preload, игра в архиве открывается (задачи 7–9).

---

### Задача 1: замер загрузки — метки и скрипт

**Файлы:**
- Изменить: `src/app/game.ts` (метод `frame`, конец, блок `if (!this.announced && this.shell.ready)`; метод `showStart`)
- Создать: `scripts/load-bench.mjs`
- Изменить: `README.md` (раздел «Продакшн-сборка и платформа»)

**Интерфейсы:**
- Даёт: метки `performance` `vi-letters` (первый кадр со шрифтом программы) и `vi-start` (экран `START` показан). Их читает `scripts/load-bench.mjs`; задачи 7–10 мерят им.

- [ ] **Шаг 1: метки в игре.** В `src/app/game.ts` `mark` уже импортирован из `./spans`. В конце `frame()`:

```ts
    // The first picture with the program's own letters is on screen: the platform takes its loading screen away.
    if (!this.announced && this.shell.ready) {
      this.announced = true;
      mark('letters');
      platform.tell('game_ready');
```

В `showStart()` перед `this.shell.showStart(() => {`:

```ts
    mark('start');
```

- [ ] **Шаг 2: скрипт замера.** Создать `scripts/load-bench.mjs`:

```js
// How fast the game opens on a slow phone: Chrome over its debugging protocol, the processor four
// times slower, the network of DevTools' "Fast 3G", a phone screen of 360 by 640 at density 2.
//
//   npm run build && npx vite preview --port 5184     the build to measure, in another terminal
//   node scripts/load-bench.mjs                       three runs at http://localhost:5184/
//   node scripts/load-bench.mjs <url> <runs>
//
// A run is a profile of its own, empty: the first visit, with the long boot. Then the same
// profile with the cache of the browser cleared: a returning player, short boot, then START.
// Printed are the medians, in milliseconds from the start of the navigation, of the marks the
// game sets (`vi-letters`: the first picture with the font of the program; `vi-start`: START is
// shown) and of what came over the network before the letters.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const url = process.argv[2] ?? 'http://localhost:5184/';
const runs = Number(process.argv[3] ?? 3);
/** DevTools' "Fast 3G": its latency and throughput, as DevTools sets them. */
const FAST_3G = { offline: false, latency: 562.5, downloadThroughput: 180000, uploadThroughput: 84375 };
const CPU_SLOWDOWN = 4;
const PATIENCE_MS = 60_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pageSocket(port) {
  for (let i = 0; i < 100; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((target) => target.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // Chrome is not up yet.
    }
    await sleep(200);
  }
  throw new Error('Chrome did not open its debugging port');
}

function connect(address) {
  const socket = new WebSocket(address);
  let id = 0;
  const waiting = new Map();
  socket.onmessage = (message) => {
    const data = JSON.parse(message.data);
    if (data.id && waiting.has(data.id)) {
      waiting.get(data.id)(data);
      waiting.delete(data.id);
    }
  };
  return new Promise((resolve) => {
    socket.onopen = () =>
      resolve({
        send: (method, params = {}) =>
          new Promise((answer) => {
            const sent = ++id;
            waiting.set(sent, answer);
            socket.send(JSON.stringify({ id: sent, method, params }));
          }),
        close: () => socket.close(),
      });
  });
}

const READ = `JSON.stringify((() => {
  const at = (name) => { const found = performance.getEntriesByName(name)[0]; return found ? Math.round(found.startTime) : null; };
  const letters = at('vi-letters');
  const start = at('vi-start');
  const paint = at('first-contentful-paint');
  const files = performance.getEntriesByType('resource');
  const page = performance.getEntriesByType('navigation')[0];
  const before = letters === null ? 0 : files.filter((file) => file.responseEnd <= letters).reduce((sum, file) => sum + file.encodedBodySize, 0) + page.encodedBodySize;
  return { letters, start, paint, kb: Math.round(before / 1024) };
})())`;

async function open(page, wanted) {
  await page.send('Page.navigate', { url });
  const from = Date.now();
  let read = null;
  while (Date.now() - from < PATIENCE_MS) {
    await sleep(250);
    const answer = await page.send('Runtime.evaluate', { expression: READ, returnByValue: true });
    read = JSON.parse(answer.result?.result?.value ?? 'null');
    if (read && read[wanted] !== null) return read;
  }
  throw new Error(`no ${wanted} in ${PATIENCE_MS / 1000} s at ${url}`);
}

const first = [];
const again = [];
for (let run = 0; run < runs; run++) {
  const profile = mkdtempSync(join(tmpdir(), 'vi-load-'));
  const port = 9400 + run;
  const chrome = spawn(CHROME, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--lang=en-US', 'about:blank'], { stdio: 'ignore' });
  try {
    const page = await connect(await pageSocket(port));
    await page.send('Page.enable');
    await page.send('Network.enable');
    await page.send('Network.emulateNetworkConditions', FAST_3G);
    await page.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
    await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 2, mobile: true });
    await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    first.push(await open(page, 'letters'));
    await page.send('Network.clearBrowserCache');
    again.push(await open(page, 'start'));
    page.close();
  } finally {
    chrome.kill();
    await sleep(800);
    rmSync(profile, { recursive: true, force: true });
  }
}

const median = (list, key) => {
  const values = list.map((read) => read[key]).filter((value) => value !== null).sort((a, b) => a - b);
  return values.length ? values[Math.floor(values.length / 2)] : '—';
};
console.log(`${url}, ${runs} runs, Fast 3G, CPU x${CPU_SLOWDOWN}, 360x640@2; medians, ms from navigation`);
console.log(`first visit:  first paint ${median(first, 'paint')}  letters ${median(first, 'letters')}  KB before letters ${median(first, 'kb')}`);
console.log(`returning:    first paint ${median(again, 'paint')}  letters ${median(again, 'letters')}  START ${median(again, 'start')}  KB before letters ${median(again, 'kb')}`);
```

- [ ] **Шаг 3: проверки.** `npm run typecheck`, `npm test`, `npm run build`. Потом `preview_start vi-build` (порт 5184) и `node scripts/load-bench.mjs`.
  Ожидается: числа рядом с разделом 4 спеки — первые буквы ≈ 4500 (повторный) и ≈ 4750 (первый), `START` ≈ 5800, «KB before letters» ≈ 400–450. Если скрипт падает «no letters» — метка не ставится: проверить шаг 1.

- [ ] **Шаг 4: README.** В раздел «Продакшн-сборка и платформа» после строки про обфускацию добавить пункт:

```markdown
- Загрузка мерится `node scripts/load-bench.mjs` по собранной игре в `npx vite preview --port 5184`: Chrome с процессором ×4, сетью «Fast 3G» и экраном 360×640, медиана трёх прогонов; метки игры `vi-letters` (первый кадр со шрифтом программы) и `vi-start` (экран `START`). До работы над загрузкой (v0.2.61, 15 октября 2026): первые буквы — <первый визит> мс, повторный — <повторный> мс, `START` — <мс>, до первых букв приходит <КБ> КБ. Как делили на чанки — спека загрузки (ссылкой на `docs/superpowers/specs/2026-10-15-vi-dead-code-and-loading-design.md`).
```

Числа — из вывода шага 3, не из спеки.

- [ ] **Шаг 5:** `node scripts/docs-check.mjs`; `preview_stop` сервера сборки. Показать пользователю вывод замера, спросить «коммит?». После «ок»:

```bash
git pull --ff-only
git add src/app/game.ts scripts/load-bench.mjs README.md
git commit -m "Замер загрузки: метки vi-letters, vi-start и scripts/load-bench.mjs"
```

---

### Задача 2: сеанс дня (`LIMITED`, `timed`)

**Файлы:** спека, раздел 3.1 — там полный список. Главные:
- Удалить: `src/app/daily.ts`, `src/app/daily.test.ts`
- Изменить: `src/app/archive.ts`, `scripts/archive.mjs`, `src/app/archiveData.ts` (скриптом), `src/app/game.ts`, `src/app/savedRun.ts`, `src/app/clock.ts`, `src/app/stats.ts`, `src/rules/{types,config,sim,reactions,wave,spawn,paceBot}.ts`, `scripts/pace.mjs`, `src/shell/{hud,panels,text}.ts`, `src/shell/screens/menu.ts`, `src/platform/settings.ts`, `src/audio/{engine,score}.ts`, `src/lab/{soundLab,shellLab,juiceLab}.ts`, словари, `src/ui/lang/words.ts`, `src/ui/devText.ts`, `platforms/playgama/playgama-bridge-config.json`, `platforms/playgama/README.md`
- Тесты: `src/app/{archive,savedRun}.test.ts`, `src/platform/settings.test.ts`, `src/shell/{text,panels}.test.ts`, `src/rules/{pace,paceBot,director,wave,sim}.test.ts`, `src/audio/score.test.ts`
- Документы: `README.md`, `docs/art/VI_Interface_Layer.md`, `docs/art/VI_World_Logic.md`, `docs/VI_Endless_Rules.md`, `docs/ROADMAP.md`

**Интерфейсы:**
- Даёт: `RunKind` без `'timed'`; `RunMode` без `'timed'`; `endReason` без `'time'`; `recordsPanel(table: () => RecordsTable, actions: RecordsActions): PanelSpec` — одна таблица, `share.action: () => void`; `unpackRun(raw: unknown): KeptRun | null` — без второго параметра; `KeptRun.day` больше не пишется и не требуется.

- [ ] **Шаг 1: запомнить темп Endless.** `node scripts/pace.mjs endless > <scratchpad>/pace-before.txt` (≈ 20 с).

- [ ] **Шаг 2: тесты сохранений, которые должны упасть.** В `src/platform/settings.test.ts`, в `describe` с `'are not lost when the rules get a new version…'`, заменить этот тест на:

```ts
  it('are not lost when the rules get a new version: what was kept by version is one log now', () => {
    saved({
      runs: {
        'endless:0.7-gclq': [run(900, '2026-10-01')],
        'endless:0.9-gclqdtwuepo': [run(27770, '2026-10-04'), run(300, '2026-10-03')],
      },
    });
    const settings = loadSettings();
    expect(Object.keys(settings.runs)).toEqual(['endless']);
    expect(bestOf(settings, 'endless', 'score')).toBe(27770);
    // Newest last: a log that grows too long lets go of its oldest runs.
    expect(settings.runs.endless.map((kept) => kept.date)).toEqual(['2026-10-01', '2026-10-03', '2026-10-04']);
  });

  it('let go of the sessions of the day, which the game has no more', () => {
    saved({ runs: { endless: [run(500, '2026-10-04')], timed: [run(708, '2026-10-03')], 'timed:0.8-gclqd': [run(70, '2026-10-02')], 'timed/0.9-g': [run(7, '2026-10-04')] } });
    expect(Object.keys(loadSettings().runs)).toEqual(['endless']);
  });
```

Импорт `bestOn` из строки 3 убрать. В `src/app/savedRun.test.ts` помощник `running(timed = false)` становится `running()` (без `timed` в `createRun`), а тест «lets a session of the day be finished on its own day only» заменяется двумя:

```ts
  it('lets a session of the day that was kept go: there is no such session any more', () => {
    const kept = { version: 1, kind: 'timed', day: '2026-10-03', state: { ...running(), mode: 'timed' }, tally: new RunTally().keep() };
    expect(unpackRun(stored(kept))).toBeNull();
  });

  it('reads a run of Endless kept with the day it was started on, as runs were kept before', () => {
    const kept = { ...packRun('endless', running(), new RunTally())!, day: '2026-10-03' };
    expect(unpackRun(stored(kept))).not.toBeNull();
  });
```

Остальные вызовы `unpackRun(x, '2026-10-09')` → `unpackRun(x)`, `packRun('endless', '2026-10-03', …)` → `packRun('endless', …)`.

- [ ] **Шаг 3:** `npx vitest run src/platform/settings.test.ts src/app/savedRun.test.ts` — новые тесты падают (ключи `timed` на месте; сигнатуры другие — ошибка типов/вызова).

- [ ] **Шаг 4: сохранения.** В `src/platform/settings.ts` после `loaded.runs = joinRuns(loaded.runs);`:

```ts
  // The session of the day is gone from the game (the owner, 15 October 2026): what was kept of it goes.
  for (const kind of Object.keys(loaded.runs)) if (kind === 'timed' || kind.startsWith('timed/')) delete loaded.runs[kind];
```

Убрать `bestOn` и слово `timed` из комментария к `runs`. В `src/app/savedRun.ts`:

```ts
/** The kind of run that is worth coming back to: the scored one. */
export type KeptKind = 'endless';

export interface KeptRun {
  version: 1;
  kind: KeptKind;
  state: RunState;
  tally: TallyData;
}

export function packRun(kind: KeptKind, state: RunState, tally: RunTally): KeptRun | null {
  if (state.over || state.tick === 0) return null;
  if (state.mode !== 'endless') return null;
  // The events are those of the last tick alone: they have been heard already.
  return { version: 1, kind, state: { ...state, events: [] }, tally: tally.keep() };
}
```

В `isRun` — `mode !== 'endless'`. `unpackRun(raw: unknown)`: проверки `kind !== 'endless'`, без строк про `timed`, `today` и `typeof kept.day`; партия, сохранённая со старым полем `day`, читается (поле просто лишнее). Комментарии — без «сессии дня».

- [ ] **Шаг 5: остальное по спеке 3.1** — удалить файлы, снять ветки и слова. Порядок, чтобы компилятор вёл: `src/rules/types.ts` (`RunMode`, `endReason`, поля `timed*`) → `npm run typecheck` → чинить по ошибкам `src/rules`, `src/app`, `src/shell`, `src/audio`, `src/lab`, `src/ui`. Для журнала (ответ 9.1, вариант «а»): в `recordsPanel` нет ряда `tabs`; заголовок панели — `{ native: 'プロトコル', name: 'PROTOCOL' }` (слова файла меню `protocol` из `MENU_FILES` в `src/shell/text.ts`; перевод `PROTOCOL` в `src/ui/lang/words.ts` уже есть); `RECORDS.modes` удалить; голова таблицы — `RECORDS.name`. В `game.ts`: `SCORED`/`Scored` уходят, `this.boards` хранит одну таблицу `endless`, `showRecords` зовёт `recordsPanel(() => ({ lines: this.log(), link: … }), { …, share: { label: …, action: () => this.share() } })`. Дата записи партии в `addRun`: `new Date(platform.now()).toISOString().slice(0, 10)`.
  `scripts/archive.mjs` — снять вариант `timed` и экспорт `ARCHIVE_TIMED`, потом `node scripts/archive.mjs` (в фоне, может идти минуты). `git diff src/app/archiveData.ts` — меняются только шапка и строка `ARCHIVE_TIMED`; числа `ARCHIVE_ENDLESS` те же. Если числа сдвинулись — стоп, сказать пользователю.
  `platforms/playgama/playgama-bridge-config.json` — убрать таблицу `{ "id": "timed" }`; таблицу в кабинете Playgama не трогать (ответ 9.7).

- [ ] **Шаг 6: тесты по спеке 3.1** — удалить и поправить перечисленные там. Потом:

```bash
npm run typecheck
npx vitest run --maxWorkers=3
npm run build
```

Ожидается: всё зелёное.

- [ ] **Шаг 7: следов нет.**

```bash
grep -rnE "daily|Daily|LIMITED|timedTicks|timedSec|timedStart|timedEnd|'timed'|dailyArchive|ARCHIVE_TIMED|clockLeft|bestOn|eraDate|fileLine|limitSec|timeUp" src scripts platforms
```

Ожидается: пусто (слово `timed` в смысле «по времени» в комментариях `src/rules/testkit.ts` допустимо — проверить глазами).

- [ ] **Шаг 8: темп Endless тот же.** `node scripts/pace.mjs endless > <scratchpad>/pace-after.txt` и `diff` с шагом 1 — без различий.

- [ ] **Шаг 9: документы** (спека, раздел 8):
  - `README.md`, «Журнал сеансов»: первый абзац (про сеанс дня и `src/app/daily.ts`) убрать; «две вкладки» → одна таблица `PROTOCOL`; пункт про 56 игроков сеанса дня убрать; «Рекорды игрока хранятся по виду сессии (`endless`)». «Аналитика»: `timed` и `timed_level`, «сеанс дня дошёл до конца» убрать; в строке «Значения … остались от …» оставить только то, что ещё осталось (обучение, пазлы — до задач 3–4).
  - `docs/art/VI_Interface_Layer.md`: строка 82 (рекорды) — без вкладок, заголовок `PROTOCOL`; строка 84 (сеанс дня) — убрать; строка 115 — без сеанса дня.
  - `docs/art/VI_World_Logic.md`: строки 116–117 — убрать или отметить «убрано из кода 15 октября 2026».
  - `docs/VI_Endless_Rules.md:115` — «код удалён 15 октября 2026».
  - `docs/ROADMAP.md`, «Решено удалить»: пункт «Сеанс дня» — исполнено, коммит; журнал (строка про сеанс дня) — «код удалён».
  - `platforms/playgama/README.md:24` — одна таблица `endless`; `timed` в кабинете осталась от сеанса дня.
  `node scripts/docs-check.mjs` — без расхождений.

- [ ] **Шаг 10: глазами.** `preview_start vi-dev`; меню → `RECORDS`: одна таблица, без вкладок, `SHARE` работает; `?lab=shell&screen=records` (или как называется экран журнала в `SHELL_SCREENS`) — открывается; `?lab=sound` — открывается, кнопки «Последние секунды сеанса дня» нет. Снимок журнала показать пользователю.

- [ ] **Шаг 11:** итог и «коммит?». После «ок»: `git pull --ff-only`, `git add` поимённо всех изменённых и удалённых файлов (`git add -u <пути>` для удалённых), commit «Сеанс дня удалён: LIMITED, timed, daily.ts».

---

### Задача 3: обучение Endless (`?tutorial`)

**Файлы:** спека, раздел 3.2. Главные:
- Удалить: `src/rules/tutorial.ts`, `src/rules/tutorialHint.ts`, `src/rules/tutorial.test.ts`, `docs/superpowers/specs/2026-10-01-vi-tutorial-design.md`
- Изменить: `src/rules/{sim,types,index}.ts`, `src/app/{game,juice}.ts`, `src/shell/{hud,hudLayout,text}.ts`, `src/render/{overlays,textures,cubes,leaving}.ts`, `src/lab/boardLab.ts`, `src/platform/settings.ts`, `src/ui/{screens,devtools,devText}.ts`, `src/audio/{engine,score}.ts`, `src/lab/soundLab.ts`, словари, `src/ui/lang/words.ts`
- Тесты: `src/rules/{pace,wave,level}.test.ts`, `src/app/{savedRun,juice,hint}.test.ts`, `src/shell/text.test.ts`, `src/platform/settings.test.ts`, `src/audio/score.test.ts`
- Документы: `README.md`, `docs/README.md`, `docs/ROADMAP.md`, `docs/art/VI_Interface_Layer.md`, `docs/art/VI_World_Logic.md`, `docs/VI_Endless_Rules.md`, `docs/VI_Tutorial_Research.md`

**Интерфейсы:**
- Даёт: `RunState` без `tutorial`; `RunMode` без `'practice'`; `SHELVED` в `game.ts` знает только `'tasks'` (уходит в задаче 4); `Settings` без `tutorialDone`.

- [ ] **Шаг 1:** `node scripts/pace.mjs endless > <scratchpad>/pace-before.txt`.

- [ ] **Шаг 2: тест сохранения, который должен упасть.** В `src/platform/settings.test.ts` в тесте «do not hold back what became a rule…» убрать строку `expect(settings.tutorialDone).toBe(true);` и добавить тест:

```ts
  it('let go of the exercise that was done: the game has no exercise any more', () => {
    saved({ tutorialDone: true });
    expect('tutorialDone' in loadSettings()).toBe(false);
  });
```

`npx vitest run src/platform/settings.test.ts` — падает.

- [ ] **Шаг 3:** в `loadSettings` (`src/platform/settings.ts`) после строки с `fixedSaid`:

```ts
  // The exercise of Endless is gone from the game (the owner, 15 October 2026): what was kept of it goes.
  delete (loaded as Partial<{ tutorialDone: boolean }>).tutorialDone;
```

Поле `tutorialDone` убрать из `Settings` и из `fallback`. Тест проходит.

- [ ] **Шаг 4: остальное по спеке 3.2.** Начать с удаления трёх файлов и `src/rules/index.ts`, потом `npm run typecheck` и чинить по ошибкам. В `game.ts` строку `SHELVED` оставить только с `tasks`:

```ts
/**
 * The tasks have no file in the menu since 6 October 2026, and `?tasks` opens on them until
 * they go: see docs/ROADMAP.md.
 */
const SHELVED = new URLSearchParams(window.location.search).has('tasks') ? 'tasks' : null;
```

и в колбэке boot: `if (SHELVED) { this.saveWithoutRun(); this.openPuzzle(); return; }`. Звук `begin` (`audio/engine.ts` `begin()`, `score.ts` кейс `begin`, `soundLab.ts` кнопка «Поле после обучения», `score.test.ts`) — удалить (ответ 9.4). `src/render/view.ts` (`clear`, `setClear`) не трогать.

- [ ] **Шаг 5: тесты по спеке 3.2**, потом `npm run typecheck`, `npx vitest run --maxWorkers=3`, `npm run build` — зелёные.

- [ ] **Шаг 6: следов нет.**

```bash
grep -rnE "tutorial|Tutorial|tut_|exercise|EXERCISE|practice|isHeld\(|BoardGuide|GuideArrow|lineSize|shellExercise|practiceNote" src scripts platforms
```

Ожидается: пусто, кроме `isPuzzleHeld` (уйдёт в задаче 4) и названия теста в `src/rules/orientation.test.ts:47` (живой тест поворота — не трогать).

- [ ] **Шаг 7:** `node scripts/pace.mjs endless` — тот же вывод, что в шаге 1.

- [ ] **Шаг 8: документы.**
  - `README.md`, «Аналитика»: `tutorial`, `tutorial_step`, «обучение пройдено» убрать; «Плейтест»: кнопка повтора обучения, если названа, — убрать; строка `src/puzzle` в «Структуре» — без `?tutorial`.
  - `docs/README.md`: строку спеки обучения из «Уйдут вместе с кодом» перенести в «В истории git»: `| docs/superpowers/specs/2026-10-01-vi-tutorial-design.md | спека обучения Endless из шести уроков; код удалён 15 октября 2026; достать — git show <коммит>:<путь> | — |`, где `<коммит>` — `git rev-parse --short HEAD` до этого коммита. Строку 132 (`VI_Tutorial_Decisions.md`) не трогать. Абзац раздела «Уйдут вместе с кодом» — без обучения.
  - `docs/VI_Tutorial_Research.md:23` — ссылки на спеку и на `src/rules/tutorial.ts` сделать текстом в обратных кавычках («в истории git»).
  - `docs/art/VI_Interface_Layer.md`: строка 12 — без «обучения»; строка 95 — убрать.
  - `docs/art/VI_World_Logic.md`: 194 — «код обучения Endless удалён 15 октября 2026».
  - `docs/VI_Endless_Rules.md:116` — обучение удалено.
  - `docs/ROADMAP.md`: пункт «Обучение Endless» — исполнено; журнал, строка 201 — «код удалён».
  - `node scripts/docs-check.mjs` — без расхождений.

- [ ] **Шаг 9: глазами.** `?lab=board` — образец поля как был (стрелок упражнения в нём и не было); игра: `START`, первая доска, ход, пауза, меню. `?tutorial` открывает обычный `START`.

- [ ] **Шаг 10:** «коммит?» → «Обучение Endless удалено: ?tutorial, tutorial.ts, слова tut_*».

---

### Задача 4: пазлы (`?tasks`)

**Файлы:** спека, раздел 3.3. Главные:
- Удалить: `src/rules/puzzle.ts`, `src/rules/puzzle.test.ts`, `src/puzzle/levels.ts`, `src/puzzle/levels.test.ts`, `src/app/puzzleStats.ts`, `src/app/puzzleStats.test.ts`, `docs/superpowers/specs/2026-10-01-vi-puzzle-design.md`
- Изменить: `src/app/game.ts`, `src/shell/{panels,hud,text}.ts`, `src/rules/{sim,movement,reactions,board,index,types,paceBot}.ts`, `src/render/{marks,signs}.ts`, `src/platform/settings.ts`, `src/ui/{screens,devtools,devText}.ts`, `src/lab/{shellLab,boardLab,soundLab}.ts`, `src/audio/score.ts`, словари
- Тесты: `src/shell/{panels,levelPanels}.test.ts`, `src/app/savedRun.test.ts`, `src/rules/level.test.ts`, `src/audio/score.test.ts`, `src/platform/settings.test.ts`
- Документы: `README.md`, `docs/README.md`, `docs/ROADMAP.md`, `docs/art/VI_Interface_Layer.md`, `docs/art/VI_World_Logic.md`, `docs/VI_Endless_Rules.md`, `docs/VI_Levels_Brief.md`

**Интерфейсы:**
- Даёт: `RunOptions` без `puzzle`; `RunState` без `puzzle`; `RunMode` = `'endless' | 'level'` (сверить с `types.ts` после задач 2–3); `endReason` без `'cleared'`; `SHELVED` нет; тип `PuzzleDie` остаётся с этим именем (ответ 9.5).

- [ ] **Шаг 1:** `node scripts/pace.mjs endless > <scratchpad>/pace-before.txt`.

- [ ] **Шаг 2: тест сохранения, который должен упасть.** В `src/platform/settings.test.ts`:

```ts
  it('let go of the tasks that were played: the game has no tasks any more', () => {
    saved({ puzzle: { stars: { 1: 3 }, stats: {}, rulesSeen: true } });
    expect('puzzle' in loadSettings()).toBe(false);
  });
```

`npx vitest run src/platform/settings.test.ts` — падает.

- [ ] **Шаг 3:** в `loadSettings` строку `loaded.puzzle = { ...fallback.puzzle, ...loaded.puzzle };` заменить на:

```ts
  // The tasks are gone from the game (the owner, 15 October 2026): what was kept of them goes.
  delete (loaded as Partial<{ puzzle: unknown }>).puzzle;
```

`PuzzleStat`, `PuzzleProgress`, поле `puzzle`, `puzzleStat()` и `puzzle` в `fallback` — убрать. Тест проходит.

- [ ] **Шаг 4: образец поля лаборатории без пазла.** `src/lab/boardLab.ts:65-67` строит поле через `createRun({ puzzle: { size, dice, start } })`. Перед правкой: `preview_start vi-dev`, `?lab=board`, снимок. Переписать без `opts.puzzle`: `createRun` пустого забега (как в `src/rules/testkit.ts` — посмотреть его помощник пустого поля) с `config.size = size`, кости раскладки — тем же путём, которым `testkit.ts` ставит кость, игрок — на `start`, `state.mode = 'endless'`. Снимок после — тот же, что до (сравнить глазами и показать оба пользователю).

- [ ] **Шаг 5: остальное по спеке 3.3.** Удалить шесть файлов кода, затем `src/rules/index.ts` и `types.ts`, `npm run typecheck`, чинить по ошибкам. В `game.ts`: `SHELVED` и его ветку в boot убрать целиком; `undoTask`/`restartTask` заменить вызовами `undoLevel`/`restartLevel` (в колбэках HUD и в слушателе `KeyZ`/`Backspace`/`KeyR`, где условие `levelRun`). Звуки `cleared` и `deadEnd` (`score.ts` типы, ноты, `cuesOfEvent`; `soundLab.ts` кнопки «Задача решена», «Задача: тупик»; `score.test.ts`) — удалить (ответ 9.4). `GoalWhat 'cleared'`, `PANELS.rules`, `PANELS.cleared`, `COMMANDS.next`, `COMMANDS.again`, `RESULT.moves` — живые, оставить.

- [ ] **Шаг 6: тесты по спеке 3.3**, затем `npm run typecheck`, `npx vitest run --maxWorkers=3`, `npm run build`.

- [ ] **Шаг 7: следов нет.**

```bash
grep -rnE "puzzle|Puzzle|SHELVED|tasksPanel|rulesPanel|clearedPanel|tier_|puzzleRule|puzzleHeld|deadNoExit|deadSingle|shellTasks|TASKS_TO_AD|'task'" src scripts platforms
```

Ожидается: только `PuzzleDie` (тип кости раскладки и его импорты) и `VI_Puzzle_Principles` в комментариях, если есть.

- [ ] **Шаг 8:** `node scripts/pace.mjs endless` — тот же вывод.

- [ ] **Шаг 9: документы.**
  - `README.md`: «Аналитика» — `task`, «задача решена», строка «Значения … остались от …» уходит целиком; «Структура» — строка `src/puzzle` уходит, `src/app` без «пазлов», `src/shell` без «задачи» в панелях, `src/ui` без «статистики задач».
  - `docs/README.md`: раздел «Уйдут вместе с кодом» уходит целиком; спека пазлов — в «В истории git» так же, как спека обучения в задаче 3.
  - `docs/VI_Levels_Brief.md:268` — ссылку на спеку пазлов сделать текстом («в истории git»).
  - `docs/art/VI_Interface_Layer.md`: строка 12 — без «пазлов»; строки 98 и 126 — убрать «задачи».
  - `docs/art/VI_World_Logic.md:118` — «код удалён 15 октября 2026».
  - `docs/VI_Endless_Rules.md:116` — пазлы удалены.
  - `docs/ROADMAP.md`: пункт пазлов — исполнено; журнал, строка 202 — «код удалён».
  - `node scripts/docs-check.mjs`.

- [ ] **Шаг 10: глазами.** Игра: уровень, отмена (`Z`), заново (`R`), итог уровня, список уровней; `?lab=shell` — экраны открываются, `rules`/`tasks`/`cleared` в списке нет; `?lab=board` — образец как в шаге 4.

- [ ] **Шаг 11:** «коммит?» → «Пазлы удалены: ?tasks, puzzle.ts, src/puzzle».

---

### Задача 5: ворота глав и `?gates=off`

**Файлы:** спека, раздел 3.4.
- Удалить: `src/levels/gates.test.ts`
- Изменить: `src/levels/{progress,recipes}.ts`, `src/app/game.ts`, `src/shell/{panels,text}.ts`, `src/shell/screens/panel.ts`, `src/ui/lang/words.ts`, `scripts/stars.mjs`
- Тесты: `src/levels/{progress,levels,recipes}.test.ts`, `src/shell/{levelPanels,text}.test.ts`
- Документы: `README.md`, `docs/ROADMAP.md`, `docs/art/VI_Interface_Layer.md`, `docs/art/VI_World_Logic.md`

**Интерфейсы:**
- Даёт: `src/levels/progress.ts` экспортирует только `THREE_STARS_OVER`, `TWO_STARS_OVER`, `levelStars`, `starsHeld`, `STAR_POINTS`, `starScore`. Клетка списка уровней — без `locked`.

- [ ] **Шаг 1:** `node scripts/stars.mjs > <scratchpad>/stars-before.txt`.

- [ ] **Шаг 2: правки по спеке 3.4.** `progress.ts` (уходят `Chapter`, `chaptersOf`, `ruleOf`, `GATE_SHARE`, `gateOf`, `LadderProgress`, `ladderProgress`; шапка без ворот) → `npm run typecheck` → чинить. `CHAPTERS` в `src/levels/recipes.ts` и `CHAPTERS` в `src/levels/chapters.ts` — разные: удаляется только первый. В `scripts/stars.mjs` раздел 6 считать по всему ряду (`chaptersOf` больше нет: одна глава — весь список `all`), раздел 7 («A gate of stars before a chapter») убрать. `LADDER` в `text.ts`, `LOCKED` и `STARS` в `words.ts` — убрать (их читает только `text.test.ts`).

- [ ] **Шаг 3: тесты по спеке 3.4**, потом `npm run typecheck`, `npx vitest run --maxWorkers=3`, `npm run build`.

- [ ] **Шаг 4:** `node scripts/stars.mjs > <scratchpad>/stars-after.txt`; `diff` — различия только в разделе 7 (его нет) и в заголовке раздела 6, числа разделов 1–6 те же.

- [ ] **Шаг 5: следов нет.**

```bash
grep -rnE "gates|GATE|gateOf|ladderProgress|LadderProgress|chaptersOf|LEVEL_GATES|locked|LOCKED|LADDER\b" src scripts
```

Ожидается: только `locked` редактора досок в `src/lab/{boardEditor,boardStage,levelsLab}.ts`.

- [ ] **Шаг 6: документы.** `README.md` (строка `src/levels`: «ворот у пробы нет» → «ворот нет»; не ссылаться на удалённое); `docs/art/VI_Interface_Layer.md` строки 119–120 — без `LADDER`, `LOCKED · STARS`, `ladderProgress`, бледной клетки и `NEXT` перед закрытой главой; `docs/art/VI_World_Logic.md:137` — «код ворот удалён 15 октября 2026»; `docs/ROADMAP.md` — пункт ворот исполнен, журнал строка 206 — «код удалён». `node scripts/docs-check.mjs`.

- [ ] **Шаг 7: глазами.** Список уровней: клетки как были, все открыты, `NEXT` в итоге уровня есть, где есть следующий.

- [ ] **Шаг 8:** «коммит?» → «Ворота глав удалены: ?gates=off, ladderProgress, LOCKED».

---

### Задача 6: мелочь, которую нашёл knip

**Файлы:** `src/levels/library.ts` (`withHead`), `src/levels/select.ts` (`fill`), `src/levels/table.ts` (`slowFactsOf`, `grammarText`).

- [ ] **Шаг 1: убедиться, что не зовут.**

```bash
grep -rnwE "withHead|fill|slowFactsOf|grammarText" src scripts --include=*.ts --include=*.mjs
```

Ожидается: только определения (у `fill` — много чужих совпадений вроде `.fill(`: смотреть только вызовы импортированной из `select.ts` функции). Если кто-то зовёт — не удалять, сказать пользователю.

- [ ] **Шаг 2:** удалить четыре функции и то, что после них в этих файлах никем не используется (компилятор и `npx knip@5` подскажут). `npm run typecheck`, `npx vitest run --maxWorkers=3`, `npm run build`, `node scripts/ladder.mjs levels` и `node scripts/library.mjs check` — работают как до.

- [ ] **Шаг 3:** «коммит?» → «Четыре функции уровней, которых никто не зовёт (knip)».

---

### Задача 7: preload шрифта программы (Ч1)

**Файлы:**
- Изменить: `vite.config.ts`
- Документы: `README.md`

**Интерфейсы:**
- Даёт: в собранном `dist/index.html` две строки `<link rel="preload" as="font" type="font/woff2" crossorigin href="./assets/dotgothic16-…woff2">` — латиница DotGothic16 и японский набор. Кириллица шрифта встроена в CSS `data:`-адресом и preload не нужна.

- [ ] **Шаг 1: убедиться, что сейчас preload нет.** `npm run build`, затем `grep -c 'as="font"' dist/index.html` → `0`.

- [ ] **Шаг 2: плагин.** В `vite.config.ts` после `woff2Only()`:

```ts
/** The files of the program's font the boot is written in: its Latin and its Japanese signs. */
const PROGRAM_FONT_FILES = /dotgothic16-(latin-400-normal|jp)-[^/]+\.woff2$/;

/**
 * Asks for the program's font with the page. Its style comes with the code of the game, so the
 * browser learns of the font only once that code has run: on a slow network that is a second
 * more before the first letters. The names are read from the build; a build that has other
 * names than the two looked for stops here instead of shipping without them.
 */
function programFontPreload(): Plugin {
  return {
    name: 'vi-program-font-preload',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        const files = Object.keys(context.bundle ?? {}).filter((name) => PROGRAM_FONT_FILES.test(name));
        if (files.length !== 2) throw new Error(`vi-program-font-preload: expected the Latin and the Japanese file of DotGothic16, found ${files.join(', ') || 'none'}`);
        return files.map((file) => ({
          tag: 'link',
          attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: '', href: `./${file}` },
          injectTo: 'head' as const,
        }));
      },
    },
  };
}
```

и в `plugins`: `[woff2Only(), programFontPreload(), viBoards(), …]`.

- [ ] **Шаг 3: проверка.** `npm run typecheck`, `npm run build`; `grep -o '<link rel="preload" as="font"[^>]*>' dist/index.html` — две строки, файлы с этими именами есть в `dist/assets/`. `npm run pack -- playgama`, затем `unzip -l release/vi-0.2.61-playgama.zip | grep dotgothic` — оба файла в архиве (версия — из `package.json`). `npm test`.

- [ ] **Шаг 4: замер.** `preview_start vi-build`, `node scripts/load-bench.mjs`. Ожидается: первые буквы повторного визита — на 600–800 мс раньше, чем в задаче 1 (проба спеки: 4498 → 3715). Записать числа себе для задачи 10.

- [ ] **Шаг 5: документы.** `README.md`, «Продакшн-сборка»: пункт «Шрифт программы (латиница DotGothic16 и японский набор) запрашивается вместе со страницей: `<link rel="preload">` ставит плагин `programFontPreload` в `vite.config.ts`». `node scripts/docs-check.mjs`.

- [ ] **Шаг 6:** «коммит?» → «Шрифт программы грузится со страницей: preload в index.html».

---

### Задача 8: текст README отдельным чанком (Ч3)

**Файлы:**
- Изменить: `src/app/game.ts` (импорт `readmePages` строка 75; `showReadme`; конец `frame()`), `src/shell/shell.ts` (геттер `inMenu`)

**Интерфейсы:**
- Даёт: модуль `src/ui/readme.ts` грузится `import('../ui/readme')`: впервые — в фоне сразу после первого кадра с буквами, и при открытии README, если ещё не пришёл. Чанк в сборке — `dist/assets/readme-*.js`.

- [ ] **Шаг 1:** `npm run build`; `ls dist/assets | grep -i readme` → пусто (сейчас текст в `index-*.js`).

- [ ] **Шаг 2: правка.** В `src/shell/shell.ts` рядом с `get visible()` (`MenuScreen` там уже импортирован — его создаёт `showMenu`):

```ts
  /** The main menu is on screen, and nothing over it. */
  get inMenu(): boolean {
    return this.screen instanceof MenuScreen;
  }
```

В `game.ts` убрать `import { readmePages } from '../ui/readme';`. Поле рядом с `announced`:

```ts
  /** The note that came with the program: a chunk of its own, asked for behind the first picture. */
  private readme: typeof import('../ui/readme') | null = null;
```

В конце `frame()` в блоке `if (!this.announced && this.shell.ready)` после `takeFocus();`:

```ts
      // What only the menu needs comes behind the first picture, not before it.
      void this.loadReadme();
```

Методы вместо прежнего `showReadme`:

```ts
  /** The note that came with the program, fetched once; a failed fetch is asked again next time. */
  private loadReadme(): Promise<typeof import('../ui/readme') | null> {
    if (this.readme) return Promise.resolve(this.readme);
    return import('../ui/readme').then(
      (module) => (this.readme = module),
      () => null,
    );
  }

  /** The note that came with the program, from the menu: a page to a window. Back leads to the menu. */
  private showReadme(page = 0): void {
    if (!this.readme) {
      // Behind the first picture it has almost always come; if not, it opens when it comes, unless the player has gone on by then.
      void this.loadReadme().then((module) => {
        if (module && this.shell.inMenu) this.showReadme(page);
      });
      return;
    }
    // A screen that lies on its side and is low holds a paragraph or two, not a page.
    const low = this.display.width > this.display.height && this.display.height < README_LOW;
    this.shell.showPanel(readmePanel(this.readme.readmePages(language(), low ? README_SIGNS : undefined), page, { onPage: (next) => this.showReadme(next), onBack: () => this.showMenu('readme') }), true);
  }
```

Смысл условия: если игрок за время загрузки открыл другой файл или ушёл в игру — README не всплывает поверх.

- [ ] **Шаг 3: проверка.** `npm run typecheck`, `npm test`, `npm run build`; `ls dist/assets | grep readme` — есть чанк ≈ 28 КБ (≈ 13 КБ gzip); `grep -c "readmePages" dist/assets/index-*.js` → `0` или только имя в обёртке `import()`.

- [ ] **Шаг 4: глазами.** `preview_start vi-build`; меню → `README`: страницы листаются, «назад» — в меню; во вкладке сети чанк readme пришёл сразу после первого кадра, а не по нажатию.

- [ ] **Шаг 5:** «коммит?» → «README программы — отдельный чанк, приходит после первого кадра».

---

### Задача 9: тяжёлая часть передач отдельным чанком, boot ждёт её (Ч4)

**Что выяснилось при планировании.** Код, который грузит только проигрыватель передач, — 34 КБ (≈ 11 КБ gzip): места и предметы передач (`src/signal/places/`, `things/`, `compose.ts`, `director.ts`, `card.ts`, `hintFrame.ts`, `recipes.ts`, `surface.ts`, `kit.ts`, `src/display/ps1.ts` — ≈ 40 КБ gzip вместе) держит ещё и сцена за доской `src/render/levelScene.ts` (по умолчанию выключена). Поэтому чанк — не «весь `src/signal`», а его тяжёлая часть, и её ждут три места: проигрыватель (`player.ts`), просачивания (`leak.ts`), сцена за доской (`levelScene.ts`). Классы `SignalPlayer`, `SignalLeak`, `LevelScene` остаются в первом файле и создаются там же, где сейчас: порядок слоёв и слушателей клавиш не меняется.

**Файлы:**
- Создать: `src/signal/frames.ts` (загрузчик, лёгкий), `src/signal/framesChunk.ts` (вход чанка), `src/signal/frames.test.ts`
- Изменить: `src/signal/scene.ts` (`thingParam` переезжает сюда), `src/signal/compose.ts` (реэкспорт `thingParam`), `src/signal/player.ts`, `src/signal/leak.ts`, `src/render/levelScene.ts`, `src/app/game.ts` (колбэк `this.shell.boot`, конец `frame()`)
- Документы: `README.md`, `docs/art/VI_Interface_Layer.md` (строка Boot)

**Интерфейсы:**
- Даёт:
  - `src/signal/framesChunk.ts`: `export { frameDef } from './compose'; export { GLIMPSE_SECONDS, cardScene, cardTitle, randomCard } from './card'; export { hintCard } from './hintFrame'; export { PLACES } from './places'; export { THINGS } from './things';`
  - `src/signal/frames.ts`: `type Frames = typeof import('./framesChunk')`; `loadFrames(): Promise<Frames>` — один запрос на всех, после неудачи следующий вызов спрашивает снова; `framesNow(): Frames | null` — модуль, если пришёл; если нет — заказывает его и отдаёт `null`.
  - `thingParam(thing: string, name: string): string` — в `src/signal/scene.ts`; `compose.ts` его реэкспортирует, импорты остальных файлов не меняются.

- [ ] **Шаг 1: тест загрузчика, который должен упасть.** `src/signal/frames.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

describe('the heavy part of the transmissions', () => {
  it('is not there until it is asked for, and is there once it has come', async () => {
    const { framesNow, loadFrames } = await import('./frames');
    expect(framesNow()).toBeNull();
    const frames = await loadFrames();
    expect(framesNow()).toBe(frames);
    expect(typeof frames.frameDef).toBe('function');
    expect(frames.PLACES.length).toBeGreaterThan(0);
  });

  it('is fetched once for everyone who asks at the same time', async () => {
    vi.resetModules();
    const { loadFrames } = await import('./frames');
    const [a, b] = await Promise.all([loadFrames(), loadFrames()]);
    expect(a).toBe(b);
  });
});
```

`npx vitest run src/signal/frames.test.ts` — падает: нет `./frames`.

- [ ] **Шаг 2: загрузчик и вход чанка.** `src/signal/framesChunk.ts`:

```ts
/**
 * The heavy part of the transmissions: their places and things, and how a frame is put
 * together of them. A chunk of its own, fetched behind the first picture: the boot and START
 * do not wait for it, and the window of a hint, a glimpse, a leak and the place behind a board
 * find it there. Read it through `./frames`, never import it directly.
 */
export { frameDef } from './compose';
export { GLIMPSE_SECONDS, cardScene, cardTitle, randomCard } from './card';
export { hintCard } from './hintFrame';
export { PLACES } from './places';
export { THINGS } from './things';
```

`src/signal/frames.ts`:

```ts
/** What the chunk of the heavy part of the transmissions holds. */
export type Frames = typeof import('./framesChunk');

let frames: Frames | null = null;
let asked: Promise<Frames> | null = null;

/** Fetches the heavy part of the transmissions, once for everyone; a fetch that failed is asked anew by the next call. */
export function loadFrames(): Promise<Frames> {
  asked ??= import('./framesChunk').then(
    (module) => (frames = module),
    (error: unknown) => {
      asked = null;
      throw error;
    },
  );
  return asked;
}

/** The heavy part of the transmissions if it has come; if not, it is asked for and there is nothing yet. */
export function framesNow(): Frames | null {
  if (!frames) void loadFrames().catch(() => undefined);
  return frames;
}
```

`npx vitest run src/signal/frames.test.ts` — проходит.

- [ ] **Шаг 3: `thingParam` — в лёгкий файл.** В `src/signal/scene.ts` добавить (рядом с прочими помощниками параметров):

```ts
/** The name of a parameter of a thing in the values of a frame. */
export const thingParam = (thing: string, name: string): string => `${thing}.${name}`;
```

В `src/signal/compose.ts` строку `export const thingParam = …` заменить на `export { thingParam } from './scene';` и добавить `thingParam` в его импорт из `./scene`, если он используется внутри `compose.ts` (используется: строки 64–65).

- [ ] **Шаг 4: сцена за доской.** `src/render/levelScene.ts`: импорт `import { frameDef, thingParam, type Recipe } from '../signal/compose';` заменить на

```ts
import type { Recipe } from '../signal/compose';
import { framesNow } from '../signal/frames';
```

и `thingParam` взять из `'../signal/scene'` (добавить в его импорт). В `frame()` сразу после проверки `if (!state || strength <= 0) { … return; }`:

```ts
    // The places are a chunk of their own: until it has come, the board stands on its own dark.
    const frames = framesNow();
    if (!frames) {
      this.layer.look.opacity = 0;
      return;
    }
```

`valuesFor` и `build` получают `frameDef` параметром или берут `framesNow()!.frameDef` — проще параметром: `private valuesFor(frameDef: Frames['frameDef'], place, …)` и `private build(frameDef: Frames['frameDef'], key, …)`, вызовы из `frame()` передают `frames.frameDef`. Тип `Frames` — `import type { Frames } from '../signal/frames';`.

- [ ] **Шаг 5: проигрыватель.** `src/signal/player.ts`: импорты `GLIMPSE_SECONDS, cardScene, cardTitle, randomCard` из `./card` и `hintCard` из `./hintFrame` убрать (оставить `import type { SignalCard } from './card';`), добавить `import { framesNow, type Frames } from './frames';`.

**Важно: когда чанк пришёл, `tell` и `answer` остаются синхронными.** `game.ts` читает `this.signal.busy` сразу после `tell` (`tellEnd`, ≈ строка 1430: «True when the window is up»), поэтому окно должно открыться в том же вызове. Ждать (`.then`) — только если чанка ещё нет; boot ждёт его перед `START`, так что в игре это случается лишь при отказе загрузки.

```ts
  answer(contact: number, onDone: () => void): void {
    const frames = framesNow();
    // Without the heavy part there is no frame to answer with: the session ends without an answer.
    if (!this.enabled || !frames) {
      onDone();
      return;
    }
    this.play(frames, frames.randomCard(this.random, contact), contact, () => {
      this.answered = true;
      onDone();
    });
  }
```

В `glimpse()` перед `this.play(…)`:

```ts
    const frames = framesNow();
    if (!frames) return;
    this.play(frames, frames.randomCard(this.random, 0, frames.GLIMPSE_SECONDS), 0, () => undefined, true);
```

(счётчик `untilGlimpse` к этому месту уже сдвинут — пропущенный проблеск не повторяется, это допустимо).

`tell(telling)`:

```ts
  tell(telling: Telling): void {
    if (!this.enabled) {
      telling.onDone();
      return;
    }
    // Without the heavy part there is no window: the words are not told and not marked as told,
    // so the board tells them the next time it is played. `busy` stays false, and the game goes on.
    const frames = framesNow();
    if (!frames) return;
    const layout = windowLayout(this.pictureNow(), 1, TOLD_PLACE);
    const plain = plainCaption(telling.text);
    const card = frames.hintCard(this.random, layout.content.w / Math.max(1, layout.content.h), telling.text);
    const total = plain.split(' ').length;
    const full = telling.reduced || !(telling.wordMs > 0);
    const told: Told = { telling, plain, total, words: full ? total : 0, full, since: null, links: [] };
    this.play(frames, card, card.contact, telling.onDone, false, 1, TOLD_PLACE, told);
  }
```

Проверить в `game.ts`, что ни `tellHint`, ни `tellEnd` не ждут `onDone`, чтобы идти дальше (по коду — не ждут: `onDone` пишет `told`, `tellEnd` смотрит `busy`); если ждут — сказать пользователю.

`play(card, …)` получает первым параметром `frames: Frames` и берёт `frames.cardScene(card)`, `frames.cardTitle(card)`. Других вызовов `play` нет (сверить `grep -n "this.play(" src/signal/player.ts`).

- [ ] **Шаг 6: просачивания.** `src/signal/leak.ts`: импорты `cardScene, randomCard` из `./card`, `frameDef` из `./compose`, `PLACES` из `./places`, `THINGS` из `./things` убрать; `import { framesNow } from './frames';`. В месте, где готовится следующее просачивание вида `flash` или вещи (≈ строки 220–236), в начале ветки `else` (после `const seed = …`):

```ts
      // The frames are a chunk of their own: until it has come, this one is let go and the next is drawn as usual.
      const frames = framesNow();
      if (!frames) return;
```

и дальше `frames.cardScene(frames.randomCard(…))`, `frames.THINGS`, `frames.PLACES`, `frames.frameDef(…)`. Что значит `return` в этом методе (не сломает ли счётчики «следующего» просачивания) — прочитать метод целиком; если `return` оставляет `coming` недоделанным — вместо него выставить то же, что ставится, когда «всё сказано» (`if (line === null) return;` выше — образец).

- [ ] **Шаг 7: boot ждёт чанк, первый кадр его заказывает.** `src/app/game.ts`: `import { loadFrames } from '../signal/frames';`. Колбэк boot:

```ts
    // START needs the heavy part of the transmissions: the window of a hint opens with it. The boot
    // hands over to it once that has come; till then its last picture stays. A chunk that fails to
    // come does not hold the program: START is shown, and the hint waits for its next board.
    this.shell.boot(() =>
      void loadFrames()
        .catch(() => undefined)
        .then(() => {
          this.booted = true;
          // … прежнее тело колбэка без изменений …
        }),
    );
```

В конце `frame()` рядом с `void this.loadReadme();` (задача 8):

```ts
      void loadFrames().catch(() => undefined);
```

Проверить в `src/shell/screens/boot.ts`, что после `finish()` экран boot остаётся на последнем кадре и повторное нажатие не зовёт `onDone` второй раз (флаг `finished`). Если зовёт — сказать пользователю, не чинить молча.

- [ ] **Шаг 8: тяжёлое не утекло в первый файл.** `npm run typecheck`; `npm run build`; затем:

```bash
ls dist/assets | grep -i frames
node -e "const z=require('zlib'),fs=require('fs');for(const f of fs.readdirSync('dist/assets').filter(f=>f.endsWith('.js')))console.log(f, (z.gzipSync(fs.readFileSync('dist/assets/'+f)).length/1024).toFixed(1)+' KB gz')"
```

Ожидается: `framesChunk-*.js` ≈ 35–45 КБ gzip; `index-*.js` меньше, чем после задачи 8, на столько же. Если чанк маленький (< 15 КБ) — кто-то в первом файле импортирует `compose`, `places`, `things`, `card` или `director` статически: найти (`grep -rn "signal/compose'\|/places'\|/things'\|/card'\|/director'" src --include=*.ts | grep -v test | grep -v src/lab`) и перевести на `framesNow()`; лаборатории (`src/lab`) не в счёт — они только под DEV.

- [ ] **Шаг 9: тесты.** `npx vitest run --maxWorkers=3` — зелёные (тесты `src/signal/*.test.ts` импортируют модули напрямую и не меняются; если какой-то зовёт `player.tell`/`answer` синхронно и ждёт кадр сразу — сделать тест `async` и дождаться `loadFrames()`).

- [ ] **Шаг 10: глазами и под троттлингом.** `preview_start vi-build`:
  - обычная сеть: boot, `START`, первая доска — окно подсказки на доске с подсказкой; Endless — проблеск перед сессией, просачивания в сессии, ответ после неё; настройки → место за доской включить — сцена на месте;
  - Chrome DevTools (chrome-devtools MCP: `emulate` с `cpuThrottlingRate: 4`, `networkConditions: 'Fast 3G'`) на чистом профиле: нажать сразу на первом кадре boot — последний кадр boot стоит, пока не пришёл `framesChunk`, потом `START`; то же с заблокированным `framesChunk` (`Network.setBlockedURLs` в `scripts/load-bench.mjs`-подобном прогоне или DevTools «Block request URL») — `START` всё равно приходит, игра играется, подсказка не показана и при следующем входе на доску показывается.
  - `npm run pack -- playgama`; `unzip -l release/vi-<версия>-playgama.zip | grep -E "framesChunk|readme"` — оба чанка в архиве.

- [ ] **Шаг 11: документы.** `docs/art/VI_Interface_Layer.md`, строка Boot (71): «Boot передаёт экран `START`, когда пришла тяжёлая часть передач (отдельный чанк): до тех пор стоит его последний кадр — логотип со строкой. С 15 октября 2026, ответ владельца 9.2 спеки загрузки» (ссылкой на `../superpowers/specs/2026-10-15-vi-dead-code-and-loading-design.md`). `README.md`, «Продакшн-сборка»: пункт о чанках — `vendor` (three.js), `framesChunk` (места и предметы передач, приходит после первого кадра, `START` его ждёт), `readme` (текст README), воркер подсказки, `perf`. `node scripts/docs-check.mjs`.

- [ ] **Шаг 12:** «коммит?» → «Места и предметы передач — отдельный чанк; boot ждёт его перед START».

---

### Задача 10: замеры после, документы, версия

**Файлы:** `README.md`, `docs/ROADMAP.md`, `docs/README.md`, `docs/superpowers/specs/2026-10-15-vi-dead-code-and-loading-design.md` (только шапка), этот план (шапка и «Что вышло иначе»), `package.json`

- [ ] **Шаг 1: замер.** `npm run build`, `preview_start vi-build`, `node scripts/load-bench.mjs` — те же условия, что в задаче 1.

- [ ] **Шаг 2: сверить с целью спеки (раздел 6):** первые буквы повторного ≤ 3,3 с, первого ≤ 3,8 с; `START` повторного ≤ 4,6 с; «KB before letters» ≤ 340. Не взято — так и написать, с тем, на что ушло время (не подгонять условия).

- [ ] **Шаг 3: README.** В пункт задачи 1 дописать «После (v0.2.62): …» теми же словами и тем же форматом, и одной строкой — что дало больше всего (по замерам задач 7–9).

- [ ] **Шаг 4: документы.** `docs/ROADMAP.md`: «Решено удалить» — все четыре пункта исполнены; раздел можно свести к строке со ссылкой на спеку и коммиты. Спека: шапка — «Статус: построено 15 октября 2026 (или дата), v0.2.62»; в индексе `docs/README.md` её строка — «построено». Этот план — «Статус: выполнен», внизу раздел «Что вышло иначе» (если что-то вышло иначе, чем здесь написано); по правилу индекса выполненный план уходит в «В истории git» с коммитом, где он последний раз лежит. `node scripts/docs-check.mjs`.

- [ ] **Шаг 5: версия.** `package.json`: `0.2.61` → `0.2.62`. `npm run typecheck`, `npm test`, `npm run build`.

- [ ] **Шаг 6:** «коммит?» → «Версия 0.2.62: мёртвый код удалён, загрузка быстрее; замеры в README». Пуш в `main` — только по отдельному «ок» пользователя; после пуша основная папка — `git pull --ff-only`. Выкладка на Playgama (`npm run pack -- playgama` и загрузка) — отдельно, по слову пользователя.
