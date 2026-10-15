# VI — слой платформы: игра без SDK, площадка — адаптер при сборке

> Вид: решение. Статус: в силе. Дата: 2026-10-15. Принято владельцем 15 октября 2026 (чат Fable): способ «выбор модуля при сборке»; не построено.
> Что заменит: `src/platform/bridge.ts` (уходит целиком), `public/playgama-bridge-config.json` (переезжает в `platforms/playgama/`), вызов плагина `@playgama/bridge/vite` в `vite.config.ts`. Что будет жить в коде: src/platform/platform.ts, platforms/none.ts, platforms/playgama/adapter.ts, platforms/playgama/vite.ts, platforms/playgama/playgama-bridge-config.json, platforms/playgama/README.md, vite.config.ts, scripts/pack.mjs, src/main.ts, src/app/game.ts, src/platform/storage.ts.

Исполнитель читает эту спеку и файлы, названные в разделе 4. Весь проект заново не изучается.

## 1. Зачем

Сейчас с SDK площадки говорит `src/platform/bridge.ts`, и скрипт Playgama Bridge вшивается в любую сборку, даже для GitHub Pages: в `dist` лежит `playgama-bridge.js` на 307 КБ. Игра должна знать одно — тип `Platform` — и не знать ни одной площадки. Площадка — тонкий адаптер в `platforms/<имя>/`, который подставляется только при сборке для неё. Дев-сервер, тесты и сборка для GitHub Pages всегда идут с платформой `none`: без SDK, без сети площадки, без её файлов.

Новых возможностей не добавляется. Интерфейс — ровно то, что игра вызывает сейчас. Мёртвый код (таблица `timed`, `dailyValue`, вкладка `LIMITED`) не трогается: его уберёт отдельная задача.

## 2. Как это устроено

- Игра получает платформу одним импортом: `import { platform } from '@platform'`. Псевдоним `@platform` разрешает `vite.config.ts`:
  - `vite build` без `VI_PLATFORM` и всё, что не сборка (`vite` — дев-сервер, `vitest`), — `platforms/none.ts`;
  - `vite build` с `VI_PLATFORM=<имя>` — `platforms/<имя>/adapter.ts`; нет такого файла — сборка падает с ошибкой, называющей путь.
- Для `tsc` тот же псевдоним стоит в `tsconfig.json` (`paths`) и всегда указывает на `platforms/none.ts`. Адаптеры площадок проверяются типами сами по себе: папка `platforms` входит в `include`, и каждый адаптер объявлен через `satisfies Platform`.
- Тип `Platform`, реализация `none` и общие для игры и адаптеров браузерные помощники лежат в `src/platform/platform.ts`. Этот файл не импортирует `@platform` и ничего из `platforms/` — иначе круг.
- `platforms/none.ts` — одна строка: отдаёт `none` из `src/platform/platform.ts` под именем `platform`.
- Адаптер площадки импортирует из игры только `src/platform/platform.ts` (тип и `none`, браузерные помощники) и SDK своей площадки. Игра на `platforms/` не ссылается никак, кроме псевдонима.
- Остаётся в игре, не в адаптере: захват фокуса во фрейме (`takeFocus`, в `src/platform/platform.ts`) и `src/platform/telegram.ts`.

## 3. Интерфейс

Весь `src/platform/platform.ts`, кроме тел функций, которые переносятся из `bridge.ts` как есть:

```ts
/** What the game tells the platform about itself. */
export type PlatformMessage =
  | 'game_ready' | 'level_started' | 'level_completed' | 'level_failed'
  | 'level_paused' | 'level_resumed' | 'player_got_achievement';

/** Plain values of an analytics event. */
export type PlatformData = Record<string, string | number | boolean>;

/** What came of sending something out: it went to the sheet of the device, it lies on the clipboard, or neither. */
export type Shared = 'sent' | 'copied' | 'failed';

/** A line of the table of players. */
export interface BoardEntry {
  rank: number;
  name: string;
  score: number;
  /** The line of the one who is playing. */
  own: boolean;
}

/** What the platform keeps for the player, as text by key. */
export interface PlatformStorage {
  /** Text under each key; null for a key it has nothing under. Rejects where it cannot be read. */
  read(keys: readonly string[]): Promise<(string | null)[]>;
  /** All keys in one call, as the platform asks. */
  write(keys: readonly string[], values: readonly string[]): Promise<void>;
}

/** The table of players of the platform. */
export interface PlatformLeaderboard {
  /** The game draws the table itself, so its lines can be read (`entries`). */
  readonly inGame: boolean;
  /** Hands a score to the table, whoever draws it. Answers whether it was taken. */
  submit(board: string, score: number): Promise<boolean>;
  /** The top of the table, best first. Rejects where it cannot be read. */
  entries(board: string): Promise<BoardEntry[]>;
  /** The name the player has on the platform; null for a guest. */
  playerName(): string | null;
}

/** The platform's own sign-in. */
export interface PlatformAuth {
  /** The player is a guest the platform can give a name. */
  readonly guest: boolean;
  /** Opens the sign-in. Answers whether the player is known by name after it. */
  register(): Promise<boolean>;
}

/**
 * Everything the game asks of the place it is played on. `storage`, `leaderboard` and `auth`
 * are read after `init()` is over; before it, and where the platform did not start, they are null.
 */
export interface Platform {
  /** Starts the platform. Waits for it no longer than the adapter allows; never rejects. */
  init(): Promise<void>;
  /** The language the player has set on the platform (`ru`, `en`); null where it has none. */
  language(): string | null;
  /** The time it is now, by the clock of the platform where it has one, else by the device. */
  now(): number;
  readonly storage: PlatformStorage | null;
  /** `level` is the name of what is being played: a kind of session, or a task. */
  tell(message: PlatformMessage, level?: string): void;
  /** The platform asks the game to stop and to go on. Told at once how it stands now, if it knows. */
  onPause(listener: (paused: boolean) => void): void;
  /** The platform allows sound or takes it away. Told at once how it stands now, if it knows. */
  onAudio(listener: (enabled: boolean) => void): void;
  /** An advertisement between sessions. `done` is called once: closed, failed, or not shown. */
  interstitial(done: () => void): void;
  /** An event of the game for the analytics of the platform. */
  track(event: string, data?: PlatformData): void;
  /** The sample of frames the platform asks for (`FrameSampler` in src/app/telemetry.ts). */
  trackPerformance(sample: PlatformData): void;
  readonly leaderboard: PlatformLeaderboard | null;
  /** Sends text out as it is: the sheet of a phone, else the clipboard. Called from a press of the player. */
  share(text: string): Promise<Shared>;
  /** Where the game is played: the address a player sends along with a result; null where there is none. */
  readonly gameUrl: string | null;
  readonly auth: PlatformAuth | null;
}

/** The keys of the page are taken by the game: on a platform the game stands in a frame. */
export function takeFocus(): void;

/**
 * The browser's own way of sending text out: the sheet of a phone, else `copy` where it is
 * given (a platform's clipboard), else the clipboard of the browser, else the old way by hand.
 */
export function browserShare(text: string, copy?: (text: string) => Promise<void>): Promise<Shared>;

/** No platform: the game runs on its own. */
export const none: Platform;
```

### 3.1. `none`

| Член | Что делает |
|---|---|
| `init` | сразу решается |
| `language` | `null` |
| `now` | `Date.now()` |
| `storage`, `leaderboard`, `auth` | `null` |
| `tell`, `track`, `trackPerformance` | ничего |
| `onPause`, `onAudio` | ничего: слушатель не зовётся (как сейчас без SDK) |
| `interstitial(done)` | `done()` сразу |
| `share(text)` | `browserShare(text)` |
| `gameUrl` | `null` |

### 3.2. Адаптер Playgama

`platforms/playgama/adapter.ts` — тела функций `bridge.ts`, разложенные по членам `Platform`, без изменения поведения:

- `init` — `initialize()` с терпением `INIT_PATIENCE_MS` (8 с), `gameVersion`, часы платформы через `getServerTime`. Нет `window.bridge`, не дождались или SDK бросил — адаптер остаётся без SDK.
- Без SDK каждый член ведёт себя как у `none` (адаптер берёт его член): игра идёт сама. Исключение — `gameUrl`: это адрес площадки, `https://playgama.ai/play/hbhtrqdwvr`, он от SDK не зависит.
- `storage` — `storage.get` / `storage.set` (нынешние `platformRead` / `platformWrite`); `null` без SDK.
- `leaderboard` — `null` без SDK или при `leaderboards.type === 'not_available'`; `inGame` — `type === 'in_game'`; `entries` — нынешний `boardEntries`; `playerName` — нынешний `playerName`.
- `auth` — `null` без SDK или без `player.isAuthorizationSupported`; `guest` — `player.isGuest`.
- `interstitial` — нынешний `showInterstitial` с `AD_SILENCE_MS`, `AD_LOADING_MS`, местом `session_end`; без `takeFocus` (см. 3.3).
- `share(text)` — `browserShare(text, copy)`, где `copy` — `clipboard.write` SDK, если `clipboard.isSupported`.
- `trackPerformance` — `track('performance_sample', sample)`, как сейчас.

`storage`, `leaderboard`, `auth` — геттеры: до конца `init` и без SDK дают `null`.

### 3.3. Что меняется в игре

| Сейчас (`bridge.ts`) | Станет |
|---|---|
| `initPlatform()`, `platformLanguage()` в `main.ts` | `platform.init()`, `platform.language()` |
| `platformLive`, `platformRead`, `platformWrite` в `storage.ts` | `platform.storage` (`null` — работа с `localStorage`, как уже умеет) |
| `platformNow()` | `platform.now()` |
| `tell`, `track`, `trackPerformance` | `platform.tell`, `platform.track`, `platform.trackPerformance` |
| `onPlatformPause`, `onPlatformAudio` | `platform.onPause`, `platform.onAudio` |
| `showInterstitial(next)` | `platform.interstitial(() => { takeFocus(); next(); })` — фокус после рекламы берёт игра |
| `hasBoard()` | `platform.leaderboard?.inGame === true` |
| `submitScore(board, score)` | `platform.leaderboard?.submit(board, score) ?? Promise.resolve(false)` |
| `boardEntries(board)` | `platform.leaderboard` с `inGame`, иначе отказ, как сейчас |
| `playerName()` | `platform.leaderboard?.playerName() ?? null` |
| `canRegister()`, `register()` | `platform.auth?.guest`, `platform.auth.register()` |
| `shareOut(text)` (сам дописывал `GAME_URL`) | игра дописывает `\n${platform.gameUrl}`, если адрес есть, и зовёт `platform.share` |
| `takeFocus`, типы `BoardEntry`, `Shared` | из `src/platform/platform.ts` |

**Одно видимое расхождение.** В сборке для GitHub Pages (`none`) `SHARE` перестаёт дописывать адрес Playgama: у `none` `gameUrl` — `null`, как решено. В сборке для Playgama всё как сейчас.

## 4. Раскладка файлов

| Путь | Что |
|---|---|
| `src/platform/platform.ts` | новый: тип `Platform` и его части, `none`, `takeFocus`, `browserShare` (с `copyByHand`) |
| `src/platform/platform.test.ts` | новый: `none` — то, что в таблице 3.1, без браузера |
| `src/platform/bridge.ts` | удаляется |
| `src/platform/storage.ts` | читает `platform.storage` вместо трёх функций `bridge.ts` |
| `src/platform/storage.test.ts` | подменяет `@platform` объектом с поддельным `storage` (вместо `./bridge`); случай без платформы — `storage: null` |
| `src/main.ts`, `src/app/game.ts` | вызовы по таблице 3.3 |
| `platforms/none.ts` | новый: `export { none as platform } from '../src/platform/platform';` |
| `platforms/playgama/adapter.ts` | новый: `export const platform = { … } satisfies Platform` |
| `platforms/playgama/adapter.test.ts` | новый: без `bridge` в `globalThis` после `init()` адаптер — как `none` (кроме `gameUrl`), `interstitial` зовёт `done` сразу, `tell` и `track` не бросают |
| `platforms/playgama/vite.ts` | новый: `playgama(): Plugin[]` — плагин `@playgama/bridge/vite` (`mode: 'cdn'`) и свой плагин, который кладёт `playgama-bridge-config.json` в сборку (`generateBundle` → `emitFile`, файл читается от `config.root`) |
| `platforms/playgama/playgama-bridge-config.json` | переезжает из `public/` без изменений |
| `platforms/playgama/README.md` | новый: что в папке, сборка, порядок выгрузки в кабинет (перенос раздела «Выкладка на Playgama» корневого README) |
| `vite.config.ts` | `defineConfig(({ command }) => …)`: площадка из `VI_PLATFORM` только при `build`; псевдоним `@platform`; плагины площадки из реестра `PLATFORM_PLUGINS`; импорт `@playgama/bridge/vite` уходит в `platforms/playgama/vite.ts`; `test.include` получает `platforms/**/*.test.ts` |
| `tsconfig.json` | `include: ["src", "platforms"]`, `exclude: ["platforms/*/vite.ts"]` (сборочный код, как `vite.config.ts`, им проверка не нужна — у них свои типы Node); `paths: { "@platform": ["./platforms/none.ts"] }` |
| `scripts/pack.mjs` | площадка обязательна (раздел 5) |
| `package.json` | `"pack": "node scripts/pack.mjs"`; `@playgama/bridge` остаётся в `devDependencies` |

## 5. Сборка и архив

- `npm run dev`, `npm test`, `npm run build` — платформа `none`. В `dist` нет `playgama-bridge.js`, `playgama-bridge-config.json` и тега скрипта SDK в `index.html`; в коде игры нет строки `playgama`.
- `VI_PLATFORM=playgama npm run build` (PowerShell: `$env:VI_PLATFORM='playgama'; npm run build`) — в `dist` есть `playgama-bridge.js`, `playgama-bridge-config.json`, в `index.html` — тег SDK с CDN и запасной локальный.
- `npm run pack -- playgama` (или `VI_PLATFORM=playgama npm run pack`): `scripts/pack.mjs` берёт имя площадки из первого аргумента, иначе из `VI_PLATFORM`; без имени или с `none` — ошибка «архив собирается только для площадки». Проверяет, что есть `platforms/<имя>/adapter.ts`. Сам запускает `npm run build` с `VI_PLATFORM=<имя>` (остальное окружение, например `VI_OBFUSCATE`, передаётся как есть) и пакует `dist` в `release/vi-<версия>-<имя>.zip`. Сборку `pack` делает сам, потому что `npm run pack -- playgama` дописывает аргумент в конец строки скрипта, и `npm run build && …` собрал бы `none`.
- Реестр плагинов площадок в `vite.config.ts`: `const PLATFORM_PLUGINS: Record<string, () => PluginOption[]> = { playgama }`. Площадка без своих плагинов в реестр не пишется.

## 6. README.md

- «Запуск»: строка `npm run pack` — `npm run pack -- playgama   # сборка и архив для площадки: release/vi-<версия>-playgama.zip`.
- «Продакшн-сборка и платформа»: пункт про SDK и пункт про `bridge.ts` заменяются одним: игра знает только `Platform` (`src/platform/platform.ts`), площадка подставляется при сборке (`VI_PLATFORM`), без неё сборка чистая — без SDK и без его файлов; адаптеры и порядок добавления площадки — `platforms/`. Ссылка на эту спеку.
- «Выкладка на Playgama»: короткая, со ссылкой на `platforms/playgama/README.md`; там — id игры, таблицы, публичный токен, порядок выгрузки с новым именем архива.
- «Журнал сеансов», пункт `SHARE`: адрес игры — `platform.gameUrl`, у Playgama — её адрес, в сборке без площадки адреса нет.
- «Аналитика»: события уходят через `platform.track`; у Playgama — `analytics.send` Bridge SDK.
- «Структура»: строка `src/platform` без `bridge.ts`; новая строка `platforms/`.
- Страница-истина `docs/art/VI_Interface_Layer.md`, строка `SHARE`: `shareOut` в `src/platform/bridge.ts` → `browserShare` в `src/platform/platform.ts`, адрес — `platform.gameUrl`. `docs/VI_Owner_Words.md` и `docs/art/VI_World_Logic.md` не меняются: игровых элементов не добавляется.

## 7. Новая площадка (Poki, CrazyGames)

1. Папка `platforms/<имя>/` с `adapter.ts`: `export const platform = { … } satisfies Platform`. Каждый член, которого у площадки нет, берётся у `none`; без SDK в окне адаптер целиком ведёт себя как `none`. Что площадка не умеет — `null` (`storage`, `leaderboard`, `auth`).
2. SDK площадки — `devDependency` корневого `package.json`. Если SDK ставится тегом в страницу или требует своих файлов в сборке — `platforms/<имя>/vite.ts` с функцией, отдающей плагины, и одна строка в `PLATFORM_PLUGINS` в `vite.config.ts`. Если SDK — модуль npm, адаптер импортирует его сам, и плагин не нужен.
3. `platforms/<имя>/adapter.test.ts`: без SDK — как `none`.
4. `platforms/<имя>/README.md`: сборка, архив, порядок выгрузки.
5. Сборка: `VI_PLATFORM=<имя> npm run build`, архив: `npm run pack -- <имя>`.

Игра при этом не меняется. Если площадке нужно то, чего в `Platform` нет (награда за рекламу, покупки), — это решение владельца и отдельная спека: член интерфейса добавляется в `Platform` и в `none`.

## 8. Порядок работ и проверка

Каждый шаг — коммит, после которого проходят `npm test`, `npm run typecheck`, `npm run build`, а сборка `VI_PLATFORM=playgama` даёт рабочую игру на Playgama. Порядок, чтобы ни один шаг не ломал выкладку:

1. `src/platform/platform.ts` с `none`, `platforms/none.ts`, `platforms/playgama/adapter.ts`, псевдоним в `vite.config.ts` и `tsconfig.json`, тесты `none` и адаптера; `pack.mjs` и `package.json` (архив собирается с `VI_PLATFORM`). Игра ещё читает `bridge.ts`, плагин SDK ещё стоит в общей сборке: архив Playgama работает, как прежде.
2. Игра (`main.ts`, `game.ts`, `storage.ts`) переходит на `@platform`; `bridge.ts` удаляется. Архив Playgama собирается с её адаптером и SDK; обычная сборка — с `none`, тег SDK в ней пока остаётся и ничего не делает.
3. `platforms/playgama/vite.ts`, конфиг переезжает из `public/`, плагин SDK уходит из общей сборки.
4. README.md, `platforms/playgama/README.md`, `VI_Interface_Layer.md`; `node scripts/docs-check.mjs`.

Проверка в конце: обычная сборка без `playgama-bridge.js` и конфига; `npm run pack -- playgama` даёт `release/vi-<версия>-playgama.zip` с ними; сборка Playgama в превью песочницы (или QA-tool Playgama) — `game_ready`, сохранение, таблица, реклама после сессии, как в 0.2.61. Точные команды и пути — в плане.
