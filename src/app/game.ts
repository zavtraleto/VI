import { InputController } from '../input/controller';
import { GestureTracker, bindGestures } from '../input/gesture';
import { bindKeyboard } from '../input/keyboard';
import { loadSettings, saveSettings, type Settings } from '../platform/settings';
import { storageAvailable } from '../platform/storage';
import { PROTOTYPE_THEME } from '../render/theme';
import { BoardView } from '../render/view';
import { createRun, cubeAt, defaultConfig, previewMove, ruleKey, DIRS, type GameEvent, type RunState } from '../rules';
import { formatTime, h } from '../ui/dom';
import { ChainLabels, HintBubble, Hud } from '../ui/hud';
import { t, type TextKey } from '../ui/i18n';
import { Pad } from '../ui/pad';
import { Screens } from '../ui/screens';
import { Runner } from './runner';
import { statsText } from './stats';

const coarsePointer = window.matchMedia('(pointer: coarse)').matches;

export class Game {
  private settings: Settings = loadSettings();
  private runner!: Runner;
  private paused = false;
  private lastFrame = 0;
  private lastStats = '';
  private resultShown = false;

  private readonly controller = new InputController();
  private readonly tracker: GestureTracker;
  private readonly view: BoardView;
  private readonly hud: Hud;
  private readonly labels: ChainLabels;
  private readonly hint: HintBubble;
  private readonly pad: Pad;
  private readonly screens: Screens;
  private readonly stage: HTMLElement;

  constructor(root: HTMLElement) {
    const hudEl = h('header', { class: 'hud' });
    this.stage = h('div', { class: 'stage' });
    const overlayLayer = h('div', { class: 'stage-layer' });
    this.stage.append(overlayLayer);
    const controls = h('div', { class: 'controls' });
    const play = h('div', { class: 'play' }, [this.stage, controls]);
    const overlay = h('div', { class: 'overlay' });
    root.append(hudEl, play, overlay);

    const now = () => this.now();
    const enabled = () => this.inputEnabled();

    this.view = new BoardView(this.stage, PROTOTYPE_THEME, defaultConfig().size);
    this.hud = new Hud(hudEl, () => this.togglePause());
    this.labels = new ChainLabels(overlayLayer);
    this.hint = new HintBubble(overlayLayer);
    this.pad = new Pad(controls, this.controller, now, () => enabled() && this.settings.controlMode === 'dpad');
    this.screens = new Screens(overlay);

    this.tracker = new GestureTracker(this.controller, now);
    bindGestures(play, this.tracker, () => enabled() && this.settings.controlMode === 'gesture');
    bindKeyboard(this.controller, now, enabled, () => this.togglePause());

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
    });

    this.startRun();
    requestAnimationFrame((time) => this.frame(time));
  }

  private get state(): RunState {
    return this.runner.state;
  }

  private now(): number {
    return this.state.tick * this.state.config.tickMs;
  }

  private inputEnabled(): boolean {
    return !this.paused && !this.state.over && !this.screens.visible;
  }

  private bestKey(state: RunState): string {
    return `${state.mode}:${ruleKey(state.config)}`;
  }

  private startRun(): void {
    const { experiments } = this.settings;
    const tutorial = experiments.guidedStart && !this.settings.tutorialDone;
    const seed = (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0;
    this.runner = new Runner(createRun({ seed, config: defaultConfig(experiments), tutorial }));
    this.controller.cancel();
    this.paused = false;
    this.resultShown = false;
    this.screens.hide();
    this.labels.clear();
    this.hint.reset();
    this.pad.setMode(this.settings.controlMode);
    this.pad.setPulse(null);
    this.stage.classList.remove('warning');
    if (tutorial) {
      this.settings.hintsSeen = [];
      this.pad.setPulse('N');
      this.hint.showSticky(`${t('hintRollHere')} · ${t(coarsePointer ? 'hintRollSwipe' : 'hintRollKey')}`);
    }
  }

  private togglePause(): void {
    if (this.state.over) return;
    if (this.paused) this.resume();
    else this.pause();
  }

  private pause(): void {
    if (this.paused || this.state.over) return;
    this.paused = true;
    this.controller.cancel();
    this.showPause();
  }

  private resume(): void {
    this.paused = false;
    this.screens.hide();
    this.lastFrame = 0;
  }

  private showPause(): void {
    this.screens.showPause({
      onResume: () => this.resume(),
      onRestart: () => this.startRun(),
      onPlaytest: () => this.showPlaytest(() => this.showPause()),
    });
  }

  private showPlaytest(back: () => void): void {
    const text = this.state.tick > 0 ? statsText(this.state) : this.lastStats || t('noStats');
    this.screens.showPlaytest(this.settings, text, {
      onApply: (experiments, mode) => {
        this.settings.experiments = experiments;
        this.settings.controlMode = mode;
        saveSettings(this.settings);
        this.startRun();
      },
      onBack: back,
      onReplayTutorial: () => {
        this.settings.tutorialDone = false;
        this.settings.hintsSeen = [];
        this.settings.experiments.guidedStart = true;
        saveSettings(this.settings);
        this.startRun();
      },
    });
  }

  private showResult(): void {
    const state = this.state;
    this.lastStats = statsText(state);
    const key = this.bestKey(state);
    const previous = this.settings.best[key] ?? 0;
    let note: string | null = null;
    if (state.mode === 'practice') {
      note = t('practiceNote');
    } else if (state.score > previous) {
      this.settings.best[key] = state.score;
      note = saveSettings(this.settings) && storageAvailable() ? t('newBest') : t('notSaved');
    }
    const result = () =>
      this.screens.showResult(
        {
          score: state.score,
          best: state.mode === 'practice' ? this.settings.best[`endless:${ruleKey(state.config)}`] ?? 0 : Math.max(previous, state.score),
          maxChain: state.maxChain,
          time: formatTime(state.tick, state.config.tickMs),
          note,
        },
        { onAgain: () => this.startRun(), onPlaytest: () => this.showPlaytest(result) },
      );
    result();
  }

  private hintOnce(id: TextKey): void {
    if (!this.settings.experiments.guidedStart || this.settings.hintsSeen.includes(id)) return;
    this.settings.hintsSeen.push(id);
    saveSettings(this.settings);
    this.hint.show(t(id));
  }

  private onTick(state: RunState): void {
    for (const event of state.events) this.onEvent(state, event);
    const { player } = state;
    if (player.level === 'ground' && !player.action && state.tick % 10 === 0) {
      if (DIRS.some((dir) => previewMove(state, dir).kind === 'mount')) this.hintOnce('hintMount');
    }
  }

  private onEvent(state: RunState, event: GameEvent): void {
    switch (event.type) {
      case 'match':
        if (state.tutorial?.phase === 'cleared') {
          this.pad.setPulse(null);
          this.hint.clearSticky();
          this.hintOnce('hintTwos');
        } else if (state.stats.clears >= 2) {
          this.hintOnce('hintChain');
        }
        break;
      case 'tutorialRefill':
        this.settings.tutorialDone = true;
        saveSettings(this.settings);
        break;
      case 'fell':
        this.hintOnce('hintFloor');
        break;
      case 'landed': {
        const own = state.player.level === 'top' ? cubeAt(state, state.player.x, state.player.z) : undefined;
        if (own && own.ori.top === 1 && state.tutorial?.phase !== 'await') this.hintOnce('hintOne');
        break;
      }
      default:
        break;
    }
  }

  private frame(time: number): void {
    requestAnimationFrame((next) => this.frame(next));
    const dt = this.lastFrame === 0 ? 0 : time - this.lastFrame;
    this.lastFrame = time;

    let alpha = 0;
    if (!this.paused && !this.state.over) {
      alpha = this.runner.advance(dt, () => this.controller.take(this.now()), (s) => this.onTick(s));
    }
    const state = this.state;
    if (state.over && !this.resultShown) {
      this.resultShown = true;
      this.showResult();
    }

    const { experiments } = this.settings;
    const marker = state.tutorial?.phase === 'await' ? { x: state.config.startX, z: state.config.startZ - 1 } : null;
    this.view.draw(state, alpha, time, { boardPreview: experiments.boardPreview, matchHint: experiments.matchHint, marker });
    this.hud.update(state, this.settings.best[this.bestKey(state)] ?? 0);
    this.labels.update(state, this.view);
    this.pad.update(state, experiments.matchHint);
    this.pad.setActive(this.tracker.direction);
    this.stage.classList.toggle('warning', state.cubes.length >= state.config.warnOccupied && !state.over);
  }
}
