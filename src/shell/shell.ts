import type { Display } from '../display/display';
import type { CanvasLayer, Layer } from '../display/layer';
import { prefersReducedMotion, type Settings } from '../platform/settings';
import { signalLook, type ParamValues } from '../signal/scene';
import { loadShellFonts } from './fonts';
import { ShellInput } from './input';
import { Kit } from './kit';
import { pictureSize, type Insets } from './layout';
import type { ShellContext, ShellFocus, ShellItem, ShellScreen } from './screen';
import { BootScreen } from './screens/boot';
import { MenuScreen, type MenuActions, type MenuData } from './screens/menu';
import { PanelScreen, type PanelSpec } from './screens/panel';
import { clockHour, paletteAt, shellDefaults, type Palette } from './theme';
import { Voice } from './voice';

export type { MenuActions, MenuData } from './screens/menu';

export interface ShellOptions {
  /** Something of the page lies over the shell and takes the input: a tool of the playtest. */
  blocked?: () => boolean;
  /** The look of the interface, where whoever owns the shell shares it with what else it draws. */
  values?: ParamValues;
}

let probe: HTMLElement | null = null;

/** What the edges of the screen keep to themselves in CSS pixels, read from an element padded by them. */
function safeInsets(): Insets {
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.append(probe);
  }
  const style = getComputedStyle(probe);
  const side = (value: string): number => Number.parseFloat(value) || 0;
  return {
    top: side(style.paddingTop),
    right: side(style.paddingRight),
    bottom: side(style.paddingBottom),
    left: side(style.paddingLeft),
  };
}

/**
 * The interface of the found program: its boot, its menu, its screens. It is one layer of
 * the one canvas — a picture of few pixels, drawn as a tube shows it — and takes the pointer
 * and the keyboard while it is on screen. Whoever owns the frame calls `frame()` before the
 * display presents.
 *
 * Under the text lies a second layer of the same pixels for what a screen has in three
 * dimensions; it carries the dark of the tube, so the text layer over it stays clear.
 */
export class Shell {
  /** The look of the interface. The same object for as long as the shell lives: the lab's panel is bound to it. */
  readonly values: ParamValues;
  /** How many times the picture has been drawn anew. A screen that stands still does not add to it. */
  redraws = 0;
  private readonly sceneLayer: Layer;
  private readonly layer: CanvasLayer;
  /** Prose in the language of the player, over the picture of the program. */
  private readonly voice: Voice;
  private readonly kit: Kit;
  private readonly input: ShellInput;
  private readonly context: ShellContext;
  private screen: ShellScreen | null = null;
  private covering = false;
  private dirty = true;
  private fontsReady = false;
  private palette: Palette;
  /** The zone that was pressed and is answering before its action; `start` is the frame it began at. */
  private firing: { item: ShellItem; start: number | null } | null = null;

  constructor(
    private readonly display: Display,
    private readonly settings: Settings,
    private readonly options: ShellOptions = {},
  ) {
    this.values = options.values ?? shellDefaults();
    this.palette = paletteAt(this.values, clockHour());
    this.sceneLayer = display.addLayer({ name: 'shell-scene', lines: 240, look: { opacity: 0 } });
    this.layer = display.addCanvasLayer({ name: 'shell', lines: 240, look: { opacity: 0 } });
    this.layer.onResize = () => this.invalidate();
    this.voice = new Voice(display, this.values, 'shell-voice');
    this.kit = new Kit(this.layer, display, this.values, this.palette);
    this.context = {
      values: this.values,
      window: () => ({ width: display.width, height: display.height }),
      picture: () => ({ width: this.layer.width, height: this.layer.height }),
      safe: () => {
        const css = safeInsets();
        // Pixels of the picture per CSS pixel.
        const scale = this.layer.height / Math.max(1, display.height);
        return { top: css.top * scale, right: css.right * scale, bottom: css.bottom * scale, left: css.left * scale };
      },
      reducedMotion: () => prefersReducedMotion(this.settings),
      voice: this.voice,
    };
    this.input = new ShellInput({
      active: () => this.screen !== null && this.fontsReady && this.firing === null && !this.options.blocked?.(),
      items: () => this.screen?.items() ?? [],
      changed: () => this.invalidate(),
      activate: (item) => {
        this.firing = { item, start: null };
        this.invalidate();
      },
      move: (focus, dir) => this.screen?.move?.(focus, dir),
      back: () => this.screen?.back?.(),
      skip: () => {
        if (!this.screen?.skip) return false;
        this.screen.skip();
        return true;
      },
    });
    this.loadFonts();
  }

  get visible(): boolean {
    return this.screen !== null;
  }

  /** The screen hides the board altogether (boot, menu) instead of lying over it (pause). */
  get covers(): boolean {
    return this.screen !== null && this.covering;
  }

  /**
   * Starts the program: the long boot the first time on this device, the short one after.
   * `onDone` comes when it has run or been passed, and is where the next screen is shown.
   */
  boot(onDone: () => void): void {
    const first = !this.settings.bootSeen;
    this.settings.bootSeen = true;
    this.show(new BootScreen(this.context, first, onDone), true);
  }

  showMenu(tutorialFirst: boolean, actions: MenuActions, data: MenuData): void {
    this.show(new MenuScreen(this.context, tutorialFirst, actions, data), true);
  }

  /**
   * A panel of the program. Over a session it lies on the board, which stays in sight and
   * steps back; opened from the menu it stands alone on the dark of the tube.
   */
  showPanel(spec: PanelSpec, alone: boolean): void {
    this.show(new PanelScreen(this.context, spec, alone), alone);
  }

  /** The font of the program has come: what is on screen is written with it. */
  get ready(): boolean {
    return this.fontsReady;
  }

  hide(): void {
    if (!this.screen) return;
    this.screen.dispose?.();
    this.screen = null;
    this.voice.clear();
    this.firing = null;
    this.input.reset(null);
    this.layer.look.opacity = 0;
    this.sceneLayer.look.opacity = 0;
  }

  /** A value of the look has changed: fonts and the picture follow. */
  touch(): void {
    this.loadFonts();
    this.invalidate();
  }

  /** Draws the interface into its layers. Called every frame before `display.present()`. */
  frame(timeMs: number): void {
    let screen = this.screen;
    if (!screen) return;
    this.applyLook();
    // The window may have changed since the last frame: the layer says so through `onResize`.
    this.display.sync();
    this.followClock();

    if (!this.fontsReady) {
      // Nothing is written with a stand-in font: the screen waits in the dark.
      if (this.dirty) {
        this.kit.begin();
        this.kit.fill(this.palette.bg);
        this.kit.end();
        this.dirty = false;
      }
      this.sceneLayer.look.opacity = 0;
      return;
    }

    if (this.firing) {
      this.firing.start ??= timeMs;
      if (timeMs - this.firing.start >= Number(this.values.pressMs)) {
        const { item } = this.firing;
        this.firing = null;
        this.dirty = true;
        item.action();
      }
    }
    // An action or the end of the boot may have put another screen up, or none.
    screen = this.screen;
    if (!screen) return;
    if (screen.update(timeMs)) this.dirty = true;
    if (this.screen !== screen) {
      screen = this.screen;
      if (!screen) return;
      screen.update(timeMs);
      this.dirty = true;
    }

    const focus: ShellFocus = { focus: this.input.focus, pressed: this.firing?.item.id ?? this.input.down };
    if (this.dirty) {
      this.dirty = false;
      this.redraws++;
      this.voice.begin();
      this.kit.begin();
      screen.draw(this.kit, focus);
      this.kit.end();
      this.voice.end();
    } else if (screen.tick?.(this.kit, timeMs)) {
      // Only a corner of the picture has changed: it alone was drawn again.
      this.kit.end();
    }
    const drawn = screen.scene?.(this.sceneLayer, this.palette, focus, timeMs) ?? false;
    this.sceneLayer.look.opacity = drawn ? 1 : 0;
  }

  private show(screen: ShellScreen, covers: boolean): void {
    this.screen?.dispose?.();
    this.screen = screen;
    this.covering = covers;
    this.firing = null;
    this.input.reset(screen.home ?? null);
    this.invalidate();
  }

  private invalidate(): void {
    this.dirty = true;
  }

  private loadFonts(): void {
    void loadShellFonts().then(() => {
      this.fontsReady = true;
      this.kit.forgetText();
      this.invalidate();
    });
  }

  /** The colours follow the hour: lighter by day, darker by night. */
  private followClock(): void {
    const palette = paletteAt(this.values, clockHour());
    const same =
      palette.bg === this.palette.bg &&
      palette.ink === this.palette.ink &&
      palette.dim === this.palette.dim &&
      palette.faint === this.palette.faint &&
      palette.signal === this.palette.signal &&
      palette.channels.join() === this.palette.channels.join();
    if (same) return;
    this.palette = palette;
    this.kit.palette = palette;
    this.invalidate();
  }

  /** Brings both layers to the size of the picture and to the look of the tube. */
  private applyLook(): void {
    const { values, display } = this;
    const canvas = { width: display.width * display.pixelRatio, height: display.height * display.pixelRatio };
    const picture = pictureSize(canvas, Number(values.pixelsTall), Number(values.pixelsWide));
    const look = signalLook(values);
    for (const layer of [this.sceneLayer, this.layer]) layer.setLines(picture.height);
    Object.assign(this.layer.look, look, { opacity: 1, depth: 8, dither: 0 });
    // The dice are a picture of the same tube, with the few colours of its time.
    Object.assign(this.sceneLayer.look, look, { depth: Number(values.spaceDepth), dither: Number(values.spaceDither) });
  }
}
