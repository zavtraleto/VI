import type { Quality } from '../display/quality';

/** How often the lines are written anew, and how far back they look, in milliseconds. */
const WRITE_MS = 500;
const WINDOW_MS = 5000;
/** A frame that comes later than this after the one before is felt as a stumble. */
const LONG_MS = 33;
/** A gap longer than this is the page having been away, not a frame. */
const AWAY_MS = 1000;

/** What the lines say, as numbers: for the console and for whoever steps the frames by hand. */
export interface PerfReading {
  /** Frames drawn in a second. */
  fps: number;
  /** Time between two frames in milliseconds: most of them are under `p95`, none is over `max`. */
  p95: number;
  max: number;
  /** Frames that came later than 33 ms after the one before. */
  long: number;
  /** Milliseconds of the game's own code in a frame. */
  js: number;
  /** What a frame asks of the graphics card: changes of the picture drawn into, draws, pixels sent up. */
  binds: number;
  draws: number;
  uploaded: number;
  /** Shaders built within the window: each of them holds a frame up. */
  shaders: number;
}

interface Frame {
  at: number;
  gap: number;
  js: number;
  binds: number;
  draws: number;
  uploaded: number;
  shaders: number;
}

type Call = (this: unknown, ...args: unknown[]) => unknown;

/**
 * Lines of measurements in a corner of the page, asked for with `?perf` in the address, in
 * any build: how many frames a second there are, how late the slowest come, how long the
 * code of a frame runs and what the frame asks of the graphics card. A tool, not a part of
 * the program's interface. It has to be started before the game is built: it stands between
 * the game and the frames of the browser. `set` is the quality the page is drawn with, written
 * under the measurements so that a picture of the screen says what was measured.
 */
export function startPerf(set: Quality): void {
  const frames: Frame[] = [];
  let current: Frame | null = null;
  let last = 0;
  let written = 0;

  const proto = WebGL2RenderingContext.prototype as unknown as Record<string, Call>;
  const watch = (name: string, note: (frame: Frame, args: unknown[]) => void): void => {
    const original = proto[name];
    proto[name] = function (...args) {
      if (current) note(current, args);
      return original.apply(this, args);
    };
  };
  watch('bindFramebuffer', (frame) => frame.binds++);
  watch('compileShader', (frame) => frame.shaders++);
  for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) watch(name, (frame) => frame.draws++);
  for (const name of ['texImage2D', 'texSubImage2D']) {
    watch(name, (frame, args) => {
      const source = args[args.length - 1];
      if (!(source instanceof HTMLCanvasElement)) return;
      // A part of a picture is sent with its width and height named after the place it goes to.
      const part = name === 'texSubImage2D' && args.length === 9;
      frame.uploaded += part ? (args[4] as number) * (args[5] as number) : source.width * source.height;
    });
  }

  const el = document.createElement('div');
  el.style.cssText =
    // Above the frame counter of development, which has the corner itself.
    'position:fixed;left:env(safe-area-inset-left,0);bottom:calc(env(safe-area-inset-bottom,0px) + 14px);z-index:60;' +
    'padding:1px 4px;font:10px/12px ui-monospace,Menlo,Consolas,monospace;color:#b6f0c0;white-space:pre;' +
    'background:rgba(0,0,0,0.7);pointer-events:none;user-select:none';
  el.textContent = 'perf';
  document.body.append(el);

  const read = (): PerfReading => {
    const gaps = frames.map((frame) => frame.gap).filter((gap) => gap > 0).sort((a, b) => a - b);
    const sum = (pick: (frame: Frame) => number): number => frames.reduce((total, frame) => total + pick(frame), 0);
    const mean = (pick: (frame: Frame) => number): number => (frames.length > 0 ? sum(pick) / frames.length : 0);
    const span = gaps.reduce((total, gap) => total + gap, 0);
    return {
      fps: span > 0 ? (gaps.length * 1000) / span : 0,
      p95: gaps.length > 0 ? gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * 0.95))] : 0,
      max: gaps.length > 0 ? gaps[gaps.length - 1] : 0,
      long: gaps.filter((gap) => gap > LONG_MS).length,
      js: mean((frame) => frame.js),
      binds: mean((frame) => frame.binds),
      draws: mean((frame) => frame.draws),
      uploaded: mean((frame) => frame.uploaded),
      shaders: sum((frame) => frame.shaders),
    };
  };

  const write = (): void => {
    const r = read();
    // Written anew every time: the game may have given samples up since.
    const settings = `msaa ${set.samples}${set.auto ? ' auto' : ''}  ratio ${set.maxRatio}  video ${set.video ? 'on' : 'off'}  leak ${set.leak ? 'on' : 'off'}  cap ${set.fpsCap || '-'}${set.patches ? '' : '  patch off'}`;
    el.textContent =
      `${r.fps.toFixed(0)} fps  p95 ${r.p95.toFixed(1)}  max ${r.max.toFixed(0)}  >33ms ${r.long}  js ${r.js.toFixed(1)}\n` +
      `fb ${r.binds.toFixed(1)}  draws ${r.draws.toFixed(0)}  up ${(r.uploaded / 1000).toFixed(0)}k  sh ${r.shaders}\n` +
      settings;
  };

  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) =>
    raf((time) => {
      const frame: Frame = { at: time, gap: 0, js: 0, binds: 0, draws: 0, uploaded: 0, shaders: 0 };
      current = frame;
      const started = performance.now();
      try {
        callback(time);
      } finally {
        current = null;
        // A frame the game has let pass draws nothing, and is not a frame of the picture.
        if (frame.draws > 0) {
          frame.js = performance.now() - started;
          const gap = last === 0 ? 0 : time - last;
          frame.gap = gap > AWAY_MS ? 0 : gap;
          last = time;
          frames.push(frame);
          while (frames.length > 0 && frames[0].at < time - WINDOW_MS) frames.shift();
          if (time - written >= WRITE_MS) {
            written = time;
            write();
          }
        }
      }
    });

  (window as unknown as { viPerf: { read: () => PerfReading } }).viPerf = { read };
}
