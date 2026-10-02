/** How often the number on screen changes, in milliseconds. */
const WINDOW_MS = 500;

/**
 * A small frame counter in the bottom left corner. A tool for debugging, not a part of the
 * interface: it lives in the page over the canvas and leaves the production build with the
 * other tools.
 */
export class FpsCounter {
  private readonly el = document.createElement('div');
  private frames = 0;
  private since = 0;

  constructor() {
    this.el.style.cssText =
      'position:fixed;left:env(safe-area-inset-left,0);bottom:env(safe-area-inset-bottom,0);z-index:50;' +
      'padding:0 4px;font:10px/12px ui-monospace,Menlo,Consolas,monospace;color:#9aa0a8;' +
      'background:rgba(0,0,0,0.6);pointer-events:none;user-select:none';
    this.el.textContent = '-- FPS';
    document.body.append(this.el);
  }

  /** Counts a frame drawn at `timeMs`. */
  tick(timeMs: number): void {
    // The first frame, or a clock that went back: the count starts over.
    if (this.since === 0 || timeMs < this.since) {
      this.since = timeMs;
      this.frames = 0;
      return;
    }
    this.frames++;
    const span = timeMs - this.since;
    if (span < WINDOW_MS) return;
    this.el.textContent = `${Math.round((this.frames * 1000) / span)} FPS`;
    this.frames = 0;
    this.since = timeMs;
  }
}
