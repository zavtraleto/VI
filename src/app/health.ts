import { platform } from '@platform';
import type { PlatformData } from '../platform/platform';

/**
 * How the visit goes outside the play itself, for the analytics of the platform: how long the
 * game takes to open and where a player who leaves before it opens was waiting, and what goes
 * wrong while it runs. Only bounded values are sent: never the text of an error, an address or
 * a trace (the telemetry guide of Playgama asks the same). Nothing here changes the game.
 */

/** Where the player is when something happens: the game before its first picture, the menu, or what is played. */
export type Where = 'loading' | 'menu' | 'endless' | 'live' | 'level' | 'lab';

/** The steps of opening, in order: the page and its scripts, the platform, what is kept, the game up to its first picture. */
type Stage = 'page' | 'platform' | 'storage' | 'game';

/** No more errors than this are told in one visit: the first ones say what is broken, the rest repeat it. */
const MAX_ERRORS = 5;

/** The names of errors the language has: anything else is `other`, so the values stay few. */
const ERROR_NAMES = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'EvalError', 'URIError', 'AggregateError', 'SecurityError', 'QuotaExceededError', 'NotAllowedError', 'AbortError', 'NetworkError', 'NotSupportedError', 'InvalidStateError']);

let stage: Stage = 'page';
let stageFrom = 0;
const stageMs: Partial<Record<Stage, number>> = {};
let ready = false;
let platformUp = false;
/** What was said before the platform could hear it: sent once it can. */
const waiting: [string, PlatformData][] = [];
let where: () => Where = () => 'loading';
const errorsSeen = new Set<string>();
let errorsSent = 0;
let hiddenWhileLoading = false;

function send(event: string, data: PlatformData): void {
  if (platformUp) platform.track(event, data);
  else waiting.push([event, data]);
}

function nextStage(next: Stage): void {
  const now = performance.now();
  stageMs[stage] = Math.round(now - stageFrom);
  stage = next;
  stageFrom = now;
}

/** The address of the first file named in a trace, or in the event itself. */
function firstFile(text: string | undefined): string | null {
  const found = text?.match(/(https?:\/\/[^\s)'"]+?)(?::\d+){0,2}(?=[\s)'"]|$)/m);
  return found ? found[1] : null;
}

/** Whose file the error came from: the game's own, the libraries it carries, a script of another site (the SDK, its advertisement), or unknown. */
export function sourceOf(file: string | null, origin = location.origin): 'game' | 'vendor' | 'external' | 'other' {
  if (!file) return 'other';
  let url: URL;
  try {
    url = new URL(file);
  } catch {
    return 'other';
  }
  if (url.origin !== origin) return 'external';
  if (/\/vendor[-.]|\/node_modules\//.test(url.pathname)) return 'vendor';
  if (/\/assets\/|\/src\//.test(url.pathname)) return 'game';
  // The page itself, or a script laid beside it by a platform (its SDK copy).
  return 'other';
}

/** The name of an error, out of a few: what it is, never what it says. */
export function nameOf(error: unknown): string {
  const name = (error as { name?: unknown } | null)?.name;
  return typeof name === 'string' && ERROR_NAMES.has(name) ? name : 'other';
}

function noteError(kind: 'error' | 'rejection' | 'asset' | 'context_lost', name: string, source: string): void {
  const at = where();
  const key = `${kind}|${name}|${source}|${at}`;
  if (errorsSeen.has(key) || errorsSent >= MAX_ERRORS) return;
  errorsSeen.add(key);
  errorsSent++;
  send('game_error', { kind, name, source, where: at, game_version: import.meta.env.VI_VERSION });
}

/**
 * Starts watching, first thing the page runs: the errors of opening are kept until the
 * platform can hear them.
 */
export function watchHealth(): void {
  stageFrom = performance.now();
  stageMs.page = Math.round(stageFrom);
  stage = 'platform';
  window.addEventListener(
    'error',
    (event: Event) => {
      // A file that did not load fires on its element, seen here on the way down; it has no error of its own.
      if (!(event instanceof ErrorEvent)) {
        const target = event.target as { src?: string; href?: string } | null;
        noteError('asset', 'other', sourceOf(target?.src ?? target?.href ?? null));
        return;
      }
      noteError('error', nameOf(event.error), sourceOf(event.filename || firstFile((event.error as Error | undefined)?.stack)));
    },
    true,
  );
  window.addEventListener('unhandledrejection', (event) => {
    noteError('rejection', nameOf(event.reason), sourceOf(firstFile((event.reason as Error | undefined)?.stack)));
  });
  window.addEventListener('webglcontextlost', () => noteError('context_lost', 'other', 'game'), true);
  // A player who leaves before the game has opened: where the opening stood, and for how long it had gone.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden || ready || hiddenWhileLoading) return;
    hiddenWhileLoading = true;
    send('load_hidden', { stage, elapsed_ms: Math.round(performance.now()), game_version: import.meta.env.VI_VERSION });
  });
}

/** The platform has started (or there is none): what was waiting is sent. */
export function platformStarted(): void {
  nextStage('storage');
  platformUp = true;
  for (const [event, data] of waiting.splice(0)) platform.track(event, data);
}

/** What is kept has been read: the game is built next. */
export function storageRead(): void {
  nextStage('game');
}

/** Where the player is, asked when something happens. */
export function watchWhere(read: () => Where): void {
  where = read;
}

/**
 * The game has its first picture on screen. Said once: how long each step of the opening took,
 * and what the player opens it on.
 */
export function gameOpened(returning: boolean, language: string): void {
  if (ready) return;
  ready = true;
  nextStage('game');
  const round = (value: number, step: number): number => Math.round(value / step) * step;
  send('game_loaded', {
    load_ms: Math.round(performance.now()),
    page_ms: stageMs.page ?? 0,
    platform_ms: stageMs.platform ?? 0,
    storage_ms: stageMs.storage ?? 0,
    game_ms: stageMs.game ?? 0,
    returning,
    language,
    touch: window.matchMedia?.('(pointer: coarse)').matches ?? false,
    width: round(window.innerWidth, 10),
    height: round(window.innerHeight, 10),
    dpr: round(window.devicePixelRatio || 1, 0.25),
    hidden_while_loading: hiddenWhileLoading,
    game_version: import.meta.env.VI_VERSION,
  });
}
