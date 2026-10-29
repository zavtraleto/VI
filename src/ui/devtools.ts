import './devtools.css';
import type { Settings } from '../platform/settings';
import type { ExperimentConfig } from '../rules';
import { DebugPanel } from './debug';
import { h } from './dom';
import { FpsCounter } from './fps';
import { td } from './devText';
import { Screens } from './screens';

export interface DevActions {
  /** A variable of the debug panel has changed. */
  onChange: () => void;
  onCamera: () => void;
  onRestart: () => void;
}

/**
 * Everything on the page that is a tool of development and not a part of the program the
 * player sees: the panel of the playtest, the debug panel with its
 * button, the frame counter. This module is loaded in development only; a production build
 * does not carry it.
 */
export class DevTools {
  private readonly screens: Screens;
  private readonly debug: DebugPanel;
  private readonly button: HTMLButtonElement;
  private readonly fps = new FpsCounter();

  constructor(root: HTMLElement, settings: Settings, actions: DevActions) {
    const overlay = h('div', { class: 'overlay' });
    root.append(overlay);
    this.screens = new Screens(overlay);
    this.debug = new DebugPanel(root, settings, actions);
    this.button = h('button', { class: 'debug-btn', text: '⚙', attrs: { 'aria-label': td('debugTitle'), type: 'button' }, onClick: () => this.debug.toggle() });
    this.button.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:40';
    this.button.hidden = !settings.debugPanel;
    root.append(this.button);
  }

  /** A panel of the tools lies over the canvas and takes the input. */
  get visible(): boolean {
    return this.screens.visible;
  }

  hide(): void {
    this.screens.hide();
  }

  /** Counts a frame. */
  tick(timeMs: number): void {
    this.fps.tick(timeMs);
  }

  /** Shows or hides the button that opens the debug panel; hiding it closes the panel. */
  showDebugButton(show: boolean): void {
    this.button.hidden = !show;
    if (!show) this.debug.toggle(false);
  }

  showPlaytest(
    settings: Settings,
    statsText: string,
    actions: {
      onApply: (experiments: ExperimentConfig, debugPanel: boolean) => void;
      onBack: () => void;
    },
  ): void {
    this.screens.showPlaytest(settings, statsText || td('noStats'), actions);
  }
}
