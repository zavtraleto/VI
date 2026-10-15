# VI — слой платформы: план сборки

> Вид: план. Статус: не выполнен. Дата: 2026-10-15.
> Что заменило: —. Что живёт в коде: src/platform/platform.ts, platforms/, vite.config.ts, scripts/pack.mjs.

> **Для исполнителя:** шаги отмечаются чекбоксами (`- [ ]`). Исполнитель — Opus в основной папке, ветка `main`. Каждая задача кончается вопросом «коммит?» владельцу; коммит — только после его «ок», пуш — отдельным «ок».

**Цель:** игра знает только тип `Platform`; Playgama Bridge подставляется адаптером `platforms/playgama/` лишь при сборке с `VI_PLATFORM=playgama`; обычная сборка и сборка для GitHub Pages без SDK.

**Устройство:** псевдоним `@platform` в `vite.config.ts` и `tsconfig.json` ведёт на `platforms/none.ts` или на `platforms/<имя>/adapter.ts`. Тип, `none` и браузерные помощники — `src/platform/platform.ts`. Плагины площадки — `platforms/<имя>/vite.ts` через реестр в `vite.config.ts`.

**Стек:** TypeScript 7, Vite 8 (rolldown), Vitest 5, `@playgama/bridge` 2.3.0 (devDependency), `fflate` для архива.

**Спека:** [2026-10-15-vi-platform-layer-design.md](../specs/2026-10-15-vi-platform-layer-design.md). Исполнитель читает спеку (раздел 3 — интерфейс, 3.3 — замены в игре) и файлы, названные в задаче. Весь репозиторий не изучается.

## Общие условия

- После каждой задачи проходят `npm test`, `npm run typecheck`, `npm run build`, и `npm run pack -- playgama` даёт рабочий архив Playgama (с задачи 1). Завтра выкладка: ни один коммит не ломает сборку.
- Поведение на Playgama не меняется ни в чём: тела функций `src/platform/bridge.ts` переносятся как есть. Единственное видимое расхождение — в сборке без площадки `SHARE` не дописывает адрес (`gameUrl` у `none` — `null`).
- Новых возможностей в `Platform` не добавлять. Таблицу `timed`, `dailyValue`, вкладку `LIMITED` не трогать.
- Комментарии в коде — по-английски, в голосе файла (`bridge.ts` — образец); в документах — по-русски.
- В PowerShell переменная окружения ставится так: `$env:VI_PLATFORM='playgama'; npm run build; Remove-Item Env:VI_PLATFORM`. В Bash: `VI_PLATFORM=playgama npm run build`.
- Коммит: заголовок до 70 знаков, тело до пяти строк, в конце `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. В коммит — только свои файлы, без `git add -A`.

## На что смотреть ревьюеру

1. SDK есть в окне, но `initialize()` не отвечает: через 8 с игра идёт как без платформы — тест в задаче 1 (`hangs`).
2. SDK живой, а таблицы у площадки нет (`leaderboards.type === 'not_available'`): `leaderboard` — `null`, отправка счёта молча не идёт — тест в задаче 1 (`live`).
3. Хранилище SDK отдаёт не строки (объект, `undefined`): `read` даёт JSON-строку и `null`, как прежде — тест в задаче 1 (`live`).
4. Буфер обмена площадки бросает: `share` переходит к буферу браузера — тест `browserShare` в задаче 1.
5. Обычная сборка не несёт ни файла, ни строки Playgama: проверка `dist` в задаче 3 (шаг «чистая сборка»).

---

### Задача 1: тип `Platform`, `none`, адаптер Playgama, псевдоним, архив по имени площадки

Игра ещё читает `bridge.ts`, плагин SDK ещё в общей сборке. Новое лежит рядом и проверяется тестами; архив уже собирается с `VI_PLATFORM`.

**Файлы:**
- Создать: `src/platform/platform.ts`, `src/platform/platform.test.ts`, `platforms/none.ts`, `platforms/playgama/adapter.ts`, `platforms/playgama/adapter.test.ts`
- Изменить: `vite.config.ts` (весь `export default`, импорты), `tsconfig.json`, `scripts/pack.mjs`, `package.json` (скрипт `pack`)

**Интерфейсы:**
- Даёт: `Platform`, `PlatformMessage`, `PlatformData`, `Shared`, `BoardEntry`, `PlatformStorage`, `PlatformLeaderboard`, `PlatformAuth`, `none`, `takeFocus()`, `browserShare(text, copy?)` из `src/platform/platform.ts`; `platform: Platform` из `@platform`.

- [ ] **Шаг 1. Тест `none` и `browserShare`** — `src/platform/platform.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserShare, none } from './platform';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('no platform', () => {
  it('starts at once and has nothing of its own', async () => {
    await none.init();
    expect(none.language()).toBeNull();
    expect(none.storage).toBeNull();
    expect(none.leaderboard).toBeNull();
    expect(none.auth).toBeNull();
    expect(none.gameUrl).toBeNull();
  });

  it('tells the time by the device', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_234_567);
    expect(none.now()).toBe(1_234_567);
  });

  it('shows no advertisement and goes on at once', () => {
    const done = vi.fn();
    none.interstitial(done);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('never asks for a pause or for silence, and hears nothing', () => {
    const listener = vi.fn();
    none.onPause(listener);
    none.onAudio(listener);
    none.tell('game_ready');
    none.tell('level_started', 'endless');
    none.track('records_opened', { network: false });
    none.trackPerformance({ fps: 60 });
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('sending text out by the browser', () => {
  /** A desktop browser: no sheet of the device, a clipboard that writes what it is given. */
  function desktop(): string[] {
    const written: string[] = [];
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    vi.stubGlobal('navigator', { clipboard: { writeText: async (text: string) => void written.push(text) } });
    return written;
  }

  it('puts the text on the clipboard of the browser', async () => {
    const written = desktop();
    expect(await browserShare('VI 120')).toBe('copied');
    expect(written).toEqual(['VI 120']);
  });

  it('asks the clipboard of the platform first, where it is given', async () => {
    const written = desktop();
    const copied: string[] = [];
    expect(await browserShare('VI 120', async (text) => void copied.push(text))).toBe('copied');
    expect(copied).toEqual(['VI 120']);
    expect(written).toEqual([]);
  });

  it('goes to the browser when the platform cannot', async () => {
    const written = desktop();
    expect(await browserShare('VI 120', () => Promise.reject(new Error('denied')))).toBe('copied');
    expect(written).toEqual(['VI 120']);
  });
});
```

- [ ] **Шаг 2. Запустить — падает:** `npx vitest run src/platform/platform.test.ts` → FAIL, `Cannot find module './platform'` (или «Failed to resolve import»).

- [ ] **Шаг 3. `src/platform/platform.ts`.** Тип — ровно как в разделе 3 спеки, с теми же комментариями. Тела `takeFocus`, `copyByHand` и `browserShare` — из `bridge.ts` (`takeFocus`, `copyByHand`, `shareOut`) с такими отличиями: `browserShare` не дописывает адрес, а вместо `sdk?.clipboard` зовёт `copy`:

```ts
/**
 * Everything the game asks of the place it is played on, and the game without one. The game
 * reads the platform from `@platform` only: the build puts there `none` or the adapter of a
 * platform (platforms/). This file knows no platform.
 */

// … типы раздела 3 спеки: PlatformMessage, PlatformData, Shared, BoardEntry,
// PlatformStorage, PlatformLeaderboard, PlatformAuth, Platform — дословно …

/**
 * On a platform the game stands in a frame of somebody else's page, and that page keeps the
 * keys until the frame is clicked. The game takes them to itself: when it opens, and again
 * when what the platform had over it is gone. Where the game is the page itself it changes nothing.
 */
export function takeFocus(): void {
  window.focus();
}

/** Puts text on the clipboard the way pages did before they were given one to write to. */
function copyByHand(text: string): boolean {
  // тело copyByHand из bridge.ts без изменений
}

/**
 * Sends a line of text out. A phone has a sheet of its own for this; anywhere else, and where
 * the sheet is not allowed to a frame, the text goes to the clipboard: through `copy` where it
 * is given (the clipboard of a platform), else through the browser. Called from a press of the
 * player, as browsers ask.
 */
export async function browserShare(text: string, copy?: (text: string) => Promise<void>): Promise<Shared> {
  const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  if (touch && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text });
      return 'sent';
    } catch (error) {
      // The player shut the sheet: nothing was asked for after all.
      if ((error as { name?: string } | null)?.name === 'AbortError') return 'failed';
    }
  }
  try {
    if (copy) {
      await copy(text);
      return 'copied';
    }
  } catch {
    // The platform could not: the browser is asked.
  }
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return 'copied';
    }
  } catch {
    // No permission in this frame: the old way below needs none.
  }
  return copyByHand(text) ? 'copied' : 'failed';
}

/** No platform: the game runs on its own. Nothing is kept but in the browser, nothing is told, nothing is shown over the game. */
export const none: Platform = {
  init: () => Promise.resolve(),
  language: () => null,
  now: () => Date.now(),
  storage: null,
  tell: () => undefined,
  onPause: () => undefined,
  onAudio: () => undefined,
  interstitial: (done) => done(),
  track: () => undefined,
  trackPerformance: () => undefined,
  leaderboard: null,
  share: (text) => browserShare(text),
  gameUrl: null,
  auth: null,
};
```

- [ ] **Шаг 4. Запустить — проходит:** `npx vitest run src/platform/platform.test.ts` → PASS, 7 тестов.

- [ ] **Шаг 5. `platforms/none.ts`:**

```ts
// The build without a platform: the dev server, the tests, GitHub Pages. See src/platform/platform.ts.
export { none as platform } from '../src/platform/platform';
```

- [ ] **Шаг 6. Тест адаптера** — `platforms/playgama/adapter.test.ts`. Модуль адаптера держит состояние SDK, поэтому каждый тест берёт его заново:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Platform } from '../../src/platform/platform';

/** The adapter as the page has it at its start: nothing of the SDK has happened yet. */
async function fresh(): Promise<Platform> {
  vi.resetModules();
  return (await import('./adapter')).platform;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Playgama without its SDK', () => {
  it('is no platform, but for the address of the game', async () => {
    const platform = await fresh();
    await platform.init();
    expect(platform.language()).toBeNull();
    expect(platform.storage).toBeNull();
    expect(platform.leaderboard).toBeNull();
    expect(platform.auth).toBeNull();
    expect(platform.gameUrl).toBe('https://playgama.ai/play/hbhtrqdwvr');
    const done = vi.fn();
    platform.interstitial(done);
    expect(done).toHaveBeenCalledTimes(1);
    const listener = vi.fn();
    platform.onPause(listener);
    platform.onAudio(listener);
    expect(() => {
      platform.tell('game_ready');
      platform.track('records_opened', { network: false });
      platform.trackPerformance({ fps: 60 });
    }).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });

  it('hangs: an SDK that does not start is not waited for past its patience', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('bridge', { initialize: () => new Promise(() => undefined) });
    const platform = await fresh();
    const started = platform.init();
    await vi.advanceTimersByTimeAsync(8000);
    await started;
    expect(platform.storage).toBeNull();
    expect(platform.language()).toBeNull();
  });
});

describe('Playgama with its SDK', () => {
  it('live: reads what it keeps as text, and has no table where the platform has none', async () => {
    vi.stubGlobal('bridge', {
      initialize: () => Promise.resolve(),
      platform: { language: 'ru', getServerTime: () => Promise.reject(new Error('no clock')) },
      storage: { get: async () => ['text', null, { a: 1 }, undefined] },
      leaderboards: { type: 'not_available' },
      player: { isAuthorizationSupported: false, isGuest: true },
    });
    const platform = await fresh();
    await platform.init();
    expect(platform.language()).toBe('ru');
    expect(await platform.storage!.read(['a', 'b', 'c', 'd'])).toEqual(['text', null, '{"a":1}', null]);
    expect(platform.leaderboard).toBeNull();
    expect(platform.auth).toBeNull();
  });
});
```

- [ ] **Шаг 7. Запустить — падает:** `npx vitest run platforms` → «No test files found» (include ещё только `src/**`) или FAIL «Cannot find module './adapter'».

- [ ] **Шаг 8. `platforms/playgama/adapter.ts`.** Константы, `sdk`, `clockAhead` и тела — из `bridge.ts`; что поменялось — показано полностью:

```ts
import type { PlaygamaBridge } from '@playgama/bridge';
import { browserShare, none, type BoardEntry, type Platform, type PlatformAuth, type PlatformData, type PlatformLeaderboard, type PlatformStorage } from '../../src/platform/platform';

/**
 * The game on Playgama: its Bridge SDK, put in the page before the game by `vite.ts` here.
 * Where it is absent or did not start, every member is that of `none`, and the game runs on
 * its own.
 */

/** A start of the SDK that has not finished by then is not waited for. */
const INIT_PATIENCE_MS = 8000;
/** Nothing has been heard of an advertisement by then: none is coming. */
const AD_SILENCE_MS = 1500;
/** One that is being fetched and has not opened by then is not waited for. */
const AD_LOADING_MS = 8000;
/** The break the advertisement stands in: named in `playgama-bridge-config.json`. */
const AD_PLACEMENT = 'session_end';

let sdk: PlaygamaBridge | null = null;
/** How far the clock of the platform is ahead of the clock of the device, once the platform has said. */
let clockAhead = 0;

/** An event of the game for the analytics of the platform: a short name and plain values. */
function track(event: string, data?: PlatformData): void {
  // тело track из bridge.ts
}

const storage: PlatformStorage = {
  async read(keys) {
    if (!sdk) throw new Error('no platform');
    // дальше — тело platformRead из bridge.ts
  },
  write(keys, values) {
    if (!sdk) return Promise.reject(new Error('no platform'));
    return sdk.storage.set([...keys], [...values]);
  },
};

const leaderboard: PlatformLeaderboard = {
  get inGame() {
    return sdk?.leaderboards.type === 'in_game';
  },
  submit(board, score) {
    if (!sdk || sdk.leaderboards.type === 'not_available') return Promise.resolve(false);
    return sdk.leaderboards.setScore(board, score).then(
      () => true,
      () => false,
    );
  },
  async entries(board): Promise<BoardEntry[]> {
    if (!sdk || !leaderboard.inGame) throw new Error('no table');
    // дальше — тело boardEntries из bridge.ts начиная с `const answer = …`
  },
  playerName() {
    // тело playerName из bridge.ts, с его комментарием о гостях
  },
};

const auth: PlatformAuth = {
  get guest() {
    return sdk?.player.isGuest ?? false;
  },
  register() {
    // тело register из bridge.ts
  },
};

export const platform = {
  async init() {
    // тело initPlatform из bridge.ts без изменений
  },
  language: () => sdk?.platform.language ?? none.language(),
  now: () => Date.now() + clockAhead,
  get storage() {
    return sdk ? storage : null;
  },
  tell(message, level) {
    if (!sdk) return;
    void sdk.platform.sendMessage(message, level === undefined ? undefined : { world: 'vi', level }).catch(() => undefined);
  },
  onPause(listener) {
    // тело onPlatformPause из bridge.ts
  },
  onAudio(listener) {
    // тело onPlatformAudio из bridge.ts
  },
  interstitial(done) {
    // тело showInterstitial из bridge.ts без строки `takeFocus();` и комментария над ней:
    // фокус после рекламы теперь берёт игра (спека, 3.3)
  },
  track,
  // The sample of frames goes the way of the game's own events until the SDK has a way of its own for it.
  trackPerformance: (sample) => track('performance_sample', sample),
  get leaderboard() {
    return sdk && sdk.leaderboards.type !== 'not_available' ? leaderboard : null;
  },
  share(text) {
    const bridge = sdk;
    return browserShare(text, bridge?.clipboard.isSupported ? (whole) => bridge.clipboard.write(whole) : undefined);
  },
  /** Where the game is played: the address a player sends along with a result. */
  gameUrl: 'https://playgama.ai/play/hbhtrqdwvr',
  get auth() {
    return sdk?.player.isAuthorizationSupported ? auth : null;
  },
} satisfies Platform;
```

Тела «из `bridge.ts`» копируются дословно, с их комментариями. Где тело зовёт другой экспорт `bridge.ts` (`hasBoard()` внутри `boardEntries`, `track` внутри `trackPerformance`) — зовёт член адаптера или функцию модуля, как показано. Сам объект `platform` внутри своих членов не упоминается: TypeScript не выведет тип объекта, который ссылается на себя в своём же инициализаторе.

- [ ] **Шаг 9. Псевдоним и тесты в `platforms/`.** В `vite.config.ts`:

```ts
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
```

над `export default`:

```ts
/**
 * The platform a build is made for: `VI_PLATFORM`, read by `vite build` only. The dev server
 * and the tests always have none. The game reads it as `@platform`.
 */
function platformOf(command: 'build' | 'serve'): string {
  return (command === 'build' && process.env.VI_PLATFORM) || 'none';
}

/** The file `@platform` stands for: platforms/none.ts, or the adapter of a platform. */
function platformModule(name: string): string {
  const file = resolve(name === 'none' ? 'platforms/none.ts' : `platforms/${name}/adapter.ts`);
  if (!existsSync(file)) throw new Error(`VI_PLATFORM=${name}: there is no ${file}`);
  return file;
}
```

`export default defineConfig({ … })` становится `export default defineConfig(({ command }) => ({ … }))`; внутри добавляется

```ts
  resolve: { alias: [{ find: /^@platform$/, replacement: platformModule(platformOf(command)) }] },
```

и `test.include` — `['src/**/*.test.ts', 'platforms/**/*.test.ts']`. Остальное (плагины, `server`, `build`, комментарии) — без изменений.

- [ ] **Шаг 10. `tsconfig.json`:**

```json
    "types": ["vite/client"],
    "paths": { "@platform": ["./platforms/none.ts"] }
  },
  "include": ["src", "platforms"],
  "exclude": ["platforms/*/vite.ts"]
```

- [ ] **Шаг 11. Запустить:** `npx vitest run src/platform platforms` → PASS (7 + 3 + тесты `storage`, `settings`); `npm run typecheck` → без ошибок.

- [ ] **Шаг 12. Архив по имени площадки.** `scripts/pack.mjs` — шапка и начало:

```js
// Packs the production build for a platform into one archive: `index.html` at its root, and
// the names of the files inside written with forward slashes, whatever system it is made on.
// Run `npm run pack -- playgama` (or with VI_PLATFORM): the build is made here, for that platform,
// and the archive is written to release/vi-<version>-<platform>.zip; its size is printed in bytes.
// A build without a platform is not packed.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { zipSync } from 'fflate';

const DIST = 'dist';
const OUT_DIR = 'release';
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

const platform = process.argv[2] || process.env.VI_PLATFORM;
if (!platform || platform === 'none') throw new Error('An archive is made for a platform only: npm run pack -- playgama');
if (!existsSync(join('platforms', platform, 'adapter.ts'))) throw new Error(`No platform "${platform}": platforms/${platform}/adapter.ts is missing`);
// `npm run pack -- <name>` puts the name at the end of the script: the build is run here, so it is made for that platform.
execSync('npm run build', { stdio: 'inherit', env: { ...process.env, VI_PLATFORM: platform } });
```

дальше — как было, кроме имени архива: `` const out = join(OUT_DIR, `vi-${version}-${platform}.zip`); ``. В `package.json`: `"pack": "node scripts/pack.mjs"`.

- [ ] **Шаг 13. Проверка задачи:**

```bash
npm test
npm run typecheck
npm run build
npm run pack
```
Ожидается: тесты зелёные; `npm run pack` без имени падает с «An archive is made for a platform only».

```bash
npm run pack -- playgama
node -e "const {unzipSync}=require('fflate');const f=require('fs');const z=unzipSync(f.readFileSync(process.argv[1]));console.log(Object.keys(z).join('\n'))" release/vi-0.2.61-playgama.zip
```
Ожидается: архив `release/vi-0.2.61-playgama.zip` (версия — из `package.json`), в списке `index.html`, `playgama-bridge.js`, `playgama-bridge-config.json`.

- [ ] **Шаг 14. Спросить владельца «коммит?».** После «ок»:

```bash
git add docs/superpowers/specs/2026-10-15-vi-platform-layer-design.md docs/superpowers/plans/2026-10-15-vi-platform-layer.md docs/README.md src/platform/platform.ts src/platform/platform.test.ts platforms/none.ts platforms/playgama/adapter.ts platforms/playgama/adapter.test.ts vite.config.ts tsconfig.json scripts/pack.mjs package.json
git commit -m "Тип Platform, none и адаптер Playgama; архив по имени площадки"
```
Спека, этот план и строки индекса идут этим же коммитом: до него они не закоммичены.

---

### Задача 2: игра переходит на `@platform`, `bridge.ts` удаляется

**Файлы:**
- Изменить: `src/main.ts:3,18,20`, `src/platform/storage.ts`, `src/platform/storage.test.ts:3-16,30-35,60-62`, `src/app/game.ts` (импорт строки 11–29, вызовы по таблице 3.3 спеки)
- Удалить: `src/platform/bridge.ts`

**Интерфейсы:**
- Берёт: `platform` из `@platform`; `takeFocus`, `BoardEntry`, `Shared`, `PlatformStorage` из `src/platform/platform.ts`.

- [ ] **Шаг 1. Тест хранилища на новый источник** — в `src/platform/storage.test.ts` подмена `./bridge` заменяется подменой `@platform` (состояние `platform` в `vi.hoisted` то же):

```ts
vi.mock('@platform', () => ({
  platform: {
    get storage() {
      return platform.live
        ? {
            read: async (keys: readonly string[]) => keys.map((key) => platform.kept.get(key) ?? null),
            write: async (keys: readonly string[], values: readonly string[]) => {
              platform.writes.push({ keys: [...keys], values: [...values] });
              keys.forEach((key, i) => platform.kept.set(key, values[i]));
            },
          }
        : null;
    },
  },
}));
```

- [ ] **Шаг 2. Запустить — падает:** `npx vitest run src/platform/storage.test.ts` → FAIL: `storage.ts` ещё читает `./bridge`, и платформенные тесты не видят записей (`expected [] to equal [{ keys: ['a','b'] … }]`).

- [ ] **Шаг 3. `src/platform/storage.ts`:**

```ts
import { platform } from '@platform';
import type { PlatformStorage } from './platform';

// … комментарий файла без изменений …
let available = true;
/** What the platform kept at the start, and what has been saved since; null without a platform. */
let kept: Map<string, string> | null = null;
/** Where it goes on a platform: what `kept` was read from. */
let store: PlatformStorage | null = null;

/** Reads everything the game keeps, in one call, before anything asks for it. */
export async function openStorage(keys: readonly string[]): Promise<void> {
  const platformStore = platform.storage;
  if (!platformStore) return;
  try {
    const values = await platformStore.read(keys);
    kept = new Map();
    store = platformStore;
    // … цикл keys.forEach без изменений …
  } catch {
    // The platform cannot be read: the browser's own storage is used.
    kept = null;
    store = null;
  }
}
```

В `saveAll` ветка `if (kept)` становится `if (kept && store)`, вызов `platformWrite(keys, raws)` — `store.write(keys, raws)`. Остальное без изменений.

- [ ] **Шаг 4. Запустить — проходит:** `npx vitest run src/platform/storage.test.ts` → PASS, 3 теста.

- [ ] **Шаг 5. `src/main.ts`:** строка 3 — `import { platform } from '@platform';`; строка 18 — `await platform.init();`; строка 20 — `const language = loadSettings().language ?? platform.language();`.

- [ ] **Шаг 6. `src/app/game.ts`, механические замены** — скрипт в папке-черновике сессии (не в репозитории), запуск из корня проекта: `node <черновик>/move-game.mjs`:

```js
// One-off: moves src/app/game.ts from src/platform/bridge.ts to @platform. Fails on a pattern that finds nothing.
import { readFileSync, writeFileSync } from 'node:fs';
const file = 'src/app/game.ts';
let code = readFileSync(file, 'utf8');
const swap = (from, to) => {
  const before = code;
  code = code.replace(from, to);
  if (code === before) throw new Error(`no match: ${from}`);
};
swap(/import \{\n  boardEntries,[\s\S]*?\} from '\.\.\/platform\/bridge';\n/, "import { platform } from '@platform';\nimport { takeFocus, type BoardEntry, type Shared } from '../platform/platform';\n");
swap(/platformNow\(\)/g, 'platform.now()');
swap(/onPlatformAudio\(/g, 'platform.onAudio(');
swap(/onPlatformPause\(/g, 'platform.onPause(');
swap('new FrameSampler(trackPerformance)', 'new FrameSampler((sample) => platform.trackPerformance(sample))');
swap(/(?<![.\w])track\(/g, 'platform.track(');
swap(/(?<![.\w])tell\(/g, 'platform.tell(');
swap(/(?<![.\w])showInterstitial\(/g, 'interstitial(');
writeFileSync(file, code);
```

Проверка счёта: `grep -c "platform\.track(" src/app/game.ts` → 22, `grep -c "platform\.tell(" src/app/game.ts` → 11, `grep -c "this\.signal\.tell(" src/app/game.ts` → 2 (не тронуты).

- [ ] **Шаг 7. `src/app/game.ts`, помощники.** Сразу после строки `import { FrameSampler, … } from './telemetry';` (конец импортов) вставить:

```ts

// What the game asks of the table and the sign-in of the platform, where it has them, and how it sends a result out.

/** The platform keeps a table of players that the game draws itself. */
function hasBoard(): boolean {
  return platform.leaderboard?.inGame === true;
}

/** Hands a score to the table of the platform, whoever draws that table. */
function submitScore(board: string, score: number): Promise<boolean> {
  return platform.leaderboard?.submit(board, score) ?? Promise.resolve(false);
}

/** The top of a table of the platform, best first. Rejects where it cannot be read. */
function boardEntries(board: string): Promise<BoardEntry[]> {
  return platform.leaderboard?.entries(board) ?? Promise.reject(new Error('no table'));
}

/** The name the player has on the platform; null for a guest, or where there is no table. */
function playerName(): string | null {
  return platform.leaderboard?.playerName() ?? null;
}

/** The player is a guest of a platform that can give them a name. */
function canRegister(): boolean {
  return platform.auth?.guest === true;
}

/** Opens the platform's own sign-in. Answers whether the player is known by name after it. */
function register(): Promise<boolean> {
  return platform.auth?.register() ?? Promise.resolve(false);
}

/** Sends a line out, with the address of the game under it where the game has one. */
function shareOut(text: string): Promise<Shared> {
  return platform.share(platform.gameUrl === null ? text : `${text}\n${platform.gameUrl}`);
}

/** The advertisement of the platform between sessions. One that was open took the keys with it: the game takes them back. */
function interstitial(next: () => void): void {
  platform.interstitial(() => {
    takeFocus();
    next();
  });
}
```

Вызовы `hasBoard()`, `submitScore(…)`, `boardEntries(…)`, `playerName()`, `canRegister()`, `register()`, `shareOut(…)` в теле класса остаются как есть: имена те же.

- [ ] **Шаг 8. Удалить `src/platform/bridge.ts`:** `git rm src/platform/bridge.ts`. Проверка, что читателей нет: `grep -rn "platform/bridge\|from './bridge'" src platforms` → пусто.

- [ ] **Шаг 9. Проверка задачи:**

```bash
npm test
npm run typecheck
npm run build
npm run pack -- playgama
```
Ожидается: всё зелёное; архив `release/vi-<версия>-playgama.zip` с `playgama-bridge.js` и конфигом. В обычной сборке тег SDK пока есть — его уберёт задача 3.

- [ ] **Шаг 10. Игра в превью без площадки.** `preview_start` с `vi-dev` (порт 5183): меню открывается, `read_console_messages` без ошибок, партия Endless идёт, пауза по `Esc` и выход в меню работают, журнал (`RECORDS`) открывается без строк платформы, `SHARE` пишет `COPIED`. Снимок экрана меню — владельцу.

- [ ] **Шаг 11. Игра Playgama в превью.** Собрать для площадки (`$env:VI_PLATFORM='playgama'; npm run build; Remove-Item Env:VI_PLATFORM`), `preview_start` с `vi-build` (порт 5184). На localhost SDK работает в режиме `mock`. Проверить через `javascript_tool`: `window.bridge.platform.id` → `'mock'`; в консоли нет ошибок; партия Endless до конца → после итога реклама `mock` не держит игру (игра продолжается); перезагрузка страницы — настройки (например, звук выключен) сохранились.

- [ ] **Шаг 12. Спросить владельца «коммит?».** После «ок»:

```bash
git add src/main.ts src/app/game.ts src/platform/storage.ts src/platform/storage.test.ts
git commit -m "Игра читает платформу из @platform; bridge.ts убран"
```
(`git rm` из шага 8 уже в индексе.)

---

### Задача 3: SDK Playgama только в её сборке

**Файлы:**
- Создать: `platforms/playgama/vite.ts`
- Переместить: `public/playgama-bridge-config.json` → `platforms/playgama/playgama-bridge-config.json` (`git mv`, содержимое не меняется)
- Изменить: `vite.config.ts` (импорт `@playgama/bridge/vite`, список `plugins`)

- [ ] **Шаг 1. `platforms/playgama/vite.ts`:**

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import playgamaBridge from '@playgama/bridge/vite';
import type { Plugin } from 'vite';

/** The settings of the SDK: advertisement, tables, the public token. It lies beside the page in the build. */
const CONFIG = 'playgama-bridge-config.json';

/**
 * Playgama in a build: the Bridge SDK in the page, from its CDN with the copy of the package as
 * a fallback, and its settings beside the page.
 */
export function playgama(): Plugin[] {
  let root = '.';
  return [
    playgamaBridge({ mode: 'cdn' }),
    {
      name: 'vi-playgama-config',
      apply: 'build',
      configResolved(config) {
        root = config.root;
      },
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: CONFIG, source: readFileSync(join(root, 'platforms', 'playgama', CONFIG)) });
      },
    },
  ];
}
```

- [ ] **Шаг 2. Конфиг переезжает:** `git mv public/playgama-bridge-config.json platforms/playgama/playgama-bridge-config.json`. Если `public/` опустела — папка остаётся пустой и в git не видна; ничего больше не делать.

- [ ] **Шаг 3. `vite.config.ts`:** убрать `import playgamaBridge from '@playgama/bridge/vite';`; добавить `import type { Plugin, PluginOption } from 'vite';` (вместо `import type { Plugin }`) и `import { playgama } from './platforms/playgama/vite';`; над `platformOf`:

```ts
/** The plugins a platform adds to its build: the SDK in the page, its files. A platform without any is not named here. */
const PLATFORM_PLUGINS: Record<string, () => PluginOption[]> = { playgama };
```

Внутри `defineConfig(({ command }) => { const platform = platformOf(command); return { … }; })` (тело функции из выражения становится блоком):

```ts
    // The SDK of a platform and its files come with the build for that platform only (platforms/).
    // The boards of the lab of the levels are read and written by the dev server only: `viBoards` takes no part in a build.
    plugins: [woff2Only(), viBoards(), ...(PLATFORM_PLUGINS[platform]?.() ?? []), ...(process.env.VI_OBFUSCATE ? [obfuscate()] : [])],
```

и псевдоним — `platformModule(platform)`. Прежний комментарий «The Bridge SDK of the platform: from its CDN…» уходит в `platforms/playgama/vite.ts` (шаг 1).

- [ ] **Шаг 4. Чистая сборка без площадки:**

```bash
npm run build
ls dist
grep -c "playgama" dist/index.html
grep -l "playgama" dist/assets/*.js
```
Ожидается: в `dist` нет `playgama-bridge.js` и `playgama-bridge-config.json`; `grep -c` → `0`; `grep -l` ничего не находит (код выходит с 1). Если `grep -l` что-то нашёл — выяснить, откуда строка, до коммита.

- [ ] **Шаг 5. Сборка Playgama:**

```bash
npm run pack -- playgama
node -e "const {unzipSync}=require('fflate');const f=require('fs');const z=unzipSync(f.readFileSync(process.argv[1]));console.log(Object.keys(z).join('\n'));console.log(new TextDecoder().decode(z['index.html']).match(/<script[^>]*playgama[^>]*>/g))" release/vi-0.2.61-playgama.zip
```
Ожидается: в архиве `playgama-bridge.js` и `playgama-bridge-config.json`; в `index.html` тег `https://bridge.playgama.com/v2/stable/playgama-bridge.js`. Содержимое конфига в архиве совпадает с `platforms/playgama/playgama-bridge-config.json`.

- [ ] **Шаг 6. Полная проверка и превью Playgama:** `npm test`, `npm run typecheck`; затем шаг 11 задачи 2 ещё раз (сборка с `VI_PLATFORM=playgama`, `vi-build`, `window.bridge.platform.id === 'mock'`, без ошибок в консоли, сохранение настроек после перезагрузки). Дев-сервер `vi-dev`: в `read_network_requests` нет запросов к `bridge.playgama.com`.

- [ ] **Шаг 7. Спросить владельца «коммит?».** После «ок»:

```bash
git add platforms/playgama/vite.ts vite.config.ts
git commit -m "SDK Playgama и его конфиг — только в сборке для Playgama"
```
(`git mv` из шага 2 уже в индексе.)

---

### Задача 4: документы

**Файлы:**
- Создать: `platforms/playgama/README.md`
- Изменить: `README.md` (разделы «Запуск», «Продакшн-сборка и платформа», «Выкладка на Playgama», «Журнал сеансов» — пункт `SHARE`, «Аналитика» — первая строка, «Структура» — строка `src/platform` и новая строка `platforms`), `docs/art/VI_Interface_Layer.md:83`, `docs/README.md` (строка спеки: «не построено» → «построено 15 октября»; строка этого плана — удаляется из раздела «Платформа» и пишется в «В истории git»), шапка спеки (статус)

- [ ] **Шаг 1. `platforms/playgama/README.md`** — по-русски: что в папке (`adapter.ts`, `vite.ts`, `playgama-bridge-config.json`, тест); сборка `npm run pack -- playgama` → `release/vi-<версия>-playgama.zip`; весь нынешний текст раздела «Выкладка на Playgama» корневого README (кабинет, id `cmusa94kw028hpr0hzb9wqkrf`, таблицы `endless` и `timed`, публичный токен — теперь в `platforms/playgama/playgama-bridge-config.json`, порядок `start_archive_upload` → PUT → `confirm_archive_upload` → `get_archive_status` → `publish_sandbox`, модерация руками, ссылка на `docs/VI_Playgama_Page.md` относительным путём `../../docs/VI_Playgama_Page.md`) с новым именем архива; проверка сборки на localhost (`vi-build`, `window.bridge.platform.id === 'mock'`).

- [ ] **Шаг 2. `README.md`** — по разделу 6 спеки:
  - «Запуск»: `npm run pack -- playgama   # сборка и архив для площадки: release/vi-<версия>-playgama.zip`.
  - «Продакшн-сборка и платформа»: пункты 3 и 4 (про SDK и про `bridge.ts`) — одним пунктом: игра знает только тип `Platform` (ссылка на `src/platform/platform.ts`) и получает его из `@platform`; площадка подставляется при сборке с `VI_PLATFORM` (адаптеры — ссылка на `platforms/`); без неё — `none`, сборка без SDK и его файлов; дев-сервер и тесты — всегда `none`; устройство и как добавить площадку — ссылка на эту спеку.
  - «Выкладка на Playgama»: два предложения и ссылка на `platforms/playgama/README.md`.
  - «Журнал сеансов», пункт `SHARE`: «копирует строку со счётом и адресом игры (`gameUrl` площадки; в сборке без площадки адреса нет)…».
  - «Аналитика»: «События уходят через `platform.track` (на Playgama — `analytics.send` Bridge SDK)…».
  - «Структура»: `src/platform` — «Хранилище, настройки и тип платформы: `platform.ts` — `Platform` и `none`; игра читает платформу только из `@platform`»; новая строка `platforms` — «Адаптеры площадок, подставляются при сборке (`VI_PLATFORM`): `none.ts`, `playgama/`».

- [ ] **Шаг 3. `docs/art/VI_Interface_Layer.md`, строка 83:** во второй ячейке `shareOut` в `src/platform/bridge.ts` → `browserShare` в `src/platform/platform.ts`, адрес — `gameUrl` площадки.

- [ ] **Шаг 4. Индекс и шапки:** шапка спеки — `Статус: построено`, «построено 15 октября 2026, v<версия>»; строка спеки в `docs/README.md` — «**Построено 15 октября 2026.**» вместо «**в силе с 15 октября 2026; не построено.**». План выполнен: его строка в разделе «Платформа» удаляется, в таблицу «В истории git» добавляется строка по образцу строки плана hint-transmission: `| docs/superpowers/plans/2026-10-15-vi-platform-layer.md | план слоя платформы, выполнен (v<версия>); достать — `git show <хеш>:<путь>` | спека platform-layer-design |`, где `<хеш>` — короткий хеш коммита задачи 3 (`git log -1 --format=%h` после него: там файл плана ещё лежит). Сам файл плана — `git rm` в коммите задачи 4. Если по ходу что-то вышло иначе, чем в плане, — раздел «Что вышло иначе» дописывается в план до коммита задачи 3.

- [ ] **Шаг 5. Проверка:** `node scripts/docs-check.mjs` → «расхождений нет»; `npm test`, `npm run typecheck`, `npm run build`.

- [ ] **Шаг 6. Спросить владельца «коммит?».** После «ок»:

```bash
git add README.md platforms/playgama/README.md docs/art/VI_Interface_Layer.md docs/README.md docs/superpowers/specs/2026-10-15-vi-platform-layer-design.md
git commit -m "Документы: слой платформы, выкладка на Playgama из platforms/"
```

- [ ] **Шаг 7. Пуш** — только после отдельного «ок» владельца: `git push origin main` (публикует сборку `none` на GitHub Pages). Выгрузка архива на Playgama — отдельно, по `platforms/playgama/README.md`, тоже по его слову.
