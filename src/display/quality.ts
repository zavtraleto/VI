import { MAX_PIXEL_RATIO } from './sizing';

/**
 * How heavy the picture is allowed to be. The defaults are what the game is drawn with. The
 * address can set each of them, in any build, to see on a device what it costs:
 * `?msaa=2&ratio=1.25&video=off&halo=off&leak=off&cap=60&patch=off&auto=off`.
 */
export interface Quality {
  /**
   * Samples of anti-aliasing the board is drawn with: 0, 2 or 4. Where the address does not
   * name them, the game starts with the most and gives them up if the device does not keep up.
   */
  samples: number;
  /** The game may give samples up by itself. Off where the address names them, or says `auto=off`. */
  auto: boolean;
  /** The canvas is never denser than this many pixels per CSS pixel. */
  maxRatio: number;
  /** Layers are worked as a worn video signal: blur, parted colours, glow, grain. */
  video: boolean;
  /** The tube spreads light around what gives light off on the board: a small picture of it, blurred and added. */
  halo: boolean;
  /** Things come through behind the board during a session. */
  leak: boolean;
  /** Most frames drawn in a second; 0 follows the screen. */
  fpsCap: number;
  /**
   * A canvas layer sends to the graphics card only the part of it that has changed. Off, it
   * sends all of itself every time: for a browser that puts a part in the wrong place.
   */
  patches: boolean;
}

export const DEFAULT_QUALITY: Quality = { samples: 4, auto: true, maxRatio: MAX_PIXEL_RATIO, video: true, halo: true, leak: true, fpsCap: 0, patches: true };

const SAMPLES = [0, 2, 4];
const OFF = ['off', '0', 'false'];

/** The quality an address asks for: the defaults with what its query names laid over them. */
export function readQuality(search: string): Quality {
  const query = new URLSearchParams(search);
  const quality = { ...DEFAULT_QUALITY };
  const number = (name: string): number | null => {
    const text = query.get(name);
    const value = text === null || text === '' ? Number.NaN : Number(text);
    return Number.isFinite(value) ? value : null;
  };
  const samples = number('msaa');
  if (samples !== null && SAMPLES.includes(samples)) {
    quality.samples = samples;
    quality.auto = false;
  }
  if (OFF.includes(query.get('auto') ?? '')) quality.auto = false;
  const ratio = number('ratio');
  if (ratio !== null && ratio >= 0.5 && ratio <= 3) quality.maxRatio = ratio;
  const cap = number('cap');
  if (cap !== null && cap >= 0 && cap <= 240) quality.fpsCap = Math.round(cap);
  if (OFF.includes(query.get('video') ?? '')) quality.video = false;
  if (OFF.includes(query.get('halo') ?? '')) quality.halo = false;
  if (OFF.includes(query.get('leak') ?? '')) quality.leak = false;
  if (OFF.includes(query.get('patch') ?? '')) quality.patches = false;
  return quality;
}

let current: Quality | null = null;

/** The quality of this page. It is read once: it does not change while the page lives. */
export function quality(): Quality {
  current ??= readQuality(typeof window === 'undefined' ? '' : window.location.search);
  return current;
}
