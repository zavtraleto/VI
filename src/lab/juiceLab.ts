import GUI from 'lil-gui';
import type { Game } from '../app/game';
import { chainTier, matchTier, peakBeat, stepBeat, type Beat } from '../app/juice';
import { CONTACT_STEPS, type Ritual } from '../app/ritual';
import type { RunState } from '../rules';

/** Narrower than this, the panel starts folded: on a phone it would cover the board. */
const NARROW_PX = 600;
/** How often the time a frame takes is shown anew, and how far apart the joins of a played chain are, in milliseconds. */
const COST_WINDOW_MS = 500;
const JOIN_MS = 520;

/** What the lab reaches inside the game. These are private to it: the lab is a tool and looks inside. */
interface Inside {
  readonly state: RunState;
  readonly ritual: Ritual;
  startRun(kind: 'endless' | 'timed'): void;
  beat(beat: Beat): void;
  frame(time: number): void;
}

/**
 * The page where what the game answers with is looked at: `?lab=juice`. It is the game itself,
 * in a session that can be played, with a panel that fires every beat by a button and sets how
 * far the contact has gone. A beat fired here changes nothing on the board: its dice stay.
 */
export function startJuiceLab(game: Game): void {
  const inside = game as unknown as Inside;
  inside.startRun('endless');

  // The time a frame takes, drawing and all.
  const reading = { cost: 0, stage: 0 };
  let spent = 0;
  let frames = 0;
  let since = 0;
  const frame = inside.frame.bind(game);
  inside.frame = (time: number) => {
    const started = performance.now();
    frame(time);
    spent += performance.now() - started;
    frames++;
    if (time - since >= COST_WINDOW_MS || time < since) {
      reading.cost = Math.round((spent / frames) * 100) / 100;
      reading.stage = inside.ritual.stage;
      spent = 0;
      frames = 0;
      since = time;
    }
  };

  /** Dice for a group that is not there: those that show the value first, then whatever stands nearest to them. */
  const cells = (value: number, count: number): { x: number; z: number }[] => {
    const { state } = inside;
    const idle = state.cubes.filter((cube) => cube.state === 'idle');
    const first = idle.find((cube) => cube.ori.top === value) ?? idle[0];
    if (!first) return [{ x: state.player.x, z: state.player.z }];
    return [...idle]
      .sort((a, b) => Math.hypot(a.x - first.x, a.z - first.z) - Math.hypot(b.x - first.x, b.z - first.z))
      .slice(0, count)
      .map((cube) => ({ x: cube.x, z: cube.z }));
  };

  const head = {
    value: 3,
    score: 0,
    auto: false,
    match: () => inside.beat({ kind: 'match', value: head.value, tier: matchTier(head.value), cells: cells(head.value, head.value), points: head.value * head.value, chain: 1 }),
    large: () => inside.beat({ kind: 'match', value: head.value, tier: matchTier(6), cells: cells(head.value, 6), points: head.value * 6, chain: 1 }),
    one: () => inside.beat({ kind: 'one', value: 1, tier: 2, cells: cells(1, 4), points: 4, chain: 0 }),
    step: () => inside.beat(stepBeat()),
    peak: () => {
      inside.ritual.look.peak = 1;
      inside.beat(peakBeat());
    },
    series: () => {
      for (let chain = 2; chain <= 6; chain++) window.setTimeout(() => join(chain), (chain - 2) * JOIN_MS);
    },
    restart: () => {
      inside.startRun('endless');
      head.score = 0;
      score.updateDisplay();
    },
  };
  const join = (chain: number): void => {
    const total = head.value + chain - 1;
    inside.beat({ kind: 'chain', value: head.value, tier: chainTier(chain), cells: cells(head.value, chain >= 3 ? total : 1), points: head.value * total * chain, chain });
  };

  const gui = new GUI({ title: 'VI · сок' });
  gui.add(reading, 'cost').name('мс на кадр').listen().disable();
  gui.add(head, 'restart').name('Новая партия');

  const beats = gui.addFolder('События');
  beats.add(head, 'value', [1, 2, 3, 4, 5, 6]).name('канал').onChange((value: number) => (head.value = Number(value)));
  beats.add(head, 'match').name('Группа');
  beats.add(head, 'large').name('Большая группа');
  for (const chain of [2, 3, 4, 6]) beats.add({ fire: () => join(chain) }, 'fire').name(`Цепочка ×${chain}`);
  beats.add(head, 'series').name('Цепочка ×2 … ×6 подряд');
  beats.add(head, 'one').name('Единицы');
  beats.add(head, 'step').name('Порог контакта');
  beats.add(head, 'peak').name('За последним порогом');
  beats
    .add(head, 'auto')
    .name('сами, раз в секунду');
  window.setInterval(() => {
    if (!head.auto) return;
    const chain = 1 + Math.floor(Math.random() * 5);
    head.value = 2 + Math.floor(Math.random() * 5);
    if (chain === 1) head.match();
    else join(chain);
  }, 1000);

  // The contact follows the dice sent: a step, once reached, stays until the session ends.
  const contact = gui.addFolder('Контакт');
  const last = CONTACT_STEPS[CONTACT_STEPS.length - 1].sent;
  const score = contact
    .add(head, 'score', 0, Math.round(last * 1.2), 1)
    .name('отправлено костей')
    .onChange((value: number) => {
      if (value < inside.state.removed) inside.ritual.reset();
      inside.state.removed = value;
    });
  contact.add(reading, 'stage').name(`порогов из ${CONTACT_STEPS.length}`).listen().disable();
  for (const [name, at] of [
    ['Шаг вперёд', 1],
    ['Шаг назад', -1],
  ] as const) {
    contact
      .add(
        {
          go: () => {
            const stage = Math.max(0, Math.min(CONTACT_STEPS.length, inside.ritual.stage + at));
            if (at < 0) inside.ritual.reset();
            inside.state.removed = stage === 0 ? 0 : CONTACT_STEPS[stage - 1].sent;
            head.score = inside.state.removed;
            score.updateDisplay();
          },
        },
        'go',
      )
      .name(name);
  }

  if (window.innerWidth < NARROW_PX) gui.close();
}
