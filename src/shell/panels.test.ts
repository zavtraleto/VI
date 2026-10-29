import { describe, expect, it } from 'vitest';
import { Climb } from './climb';
import { textWidth } from './layout';
import { LANGUAGES, setLanguage } from '../ui/i18n';
import { languagePanel, liveResultPanel, pausePanel, recordsPanel, resultPanel, systemPanel, type RecordsTable } from './panels';
import type { PanelRow, PanelSpec } from './screens/panel';

const nothing = (): void => undefined;

// The words of the program are looked at in English here: what they are in the other languages is measured with its texts.
setLanguage('en');

function row<K extends PanelRow['kind']>(spec: PanelSpec, kind: K, nth = 0): Extract<PanelRow, { kind: K }> {
  return spec.rows.filter((candidate) => candidate.kind === kind)[nth] as Extract<PanelRow, { kind: K }>;
}

/** Ids of everything of a panel that can be pressed. */
function pressed(spec: PanelSpec): string[] {
  return spec.rows.flatMap((candidate) =>
    candidate.kind === 'command' || candidate.kind === 'switch'
      ? [candidate.id]
      : candidate.kind === 'commands'
        ? candidate.commands.map((command) => command.id)
        : [],
  );
}

const PAUSE = { onResume: nothing, onRestart: nothing, onMenu: nothing };

describe('the panels of the program', () => {
  it('open with the focus on something that can be pressed', () => {
    const specs = [
      pausePanel(PAUSE),
      systemPanel({ values: () => ({ muted: false, reducedMotion: false, shake: true, backdrop: false, control: 'gesture', view: 'auto', language: 'en' }), onToggle: nothing, onLanguage: nothing, onBack: nothing }),
      languagePanel({ languages: LANGUAGES, current: 'pt', onPick: nothing, onBack: nothing }),
      resultPanel({ score: 10, best: 20, maxChain: 2, ticks: 100, tickMs: 20, note: null }, { onAgain: nothing, onRecords: nothing, onMenu: nothing }),
      recordsPanel(() => ({ lines: [] }), { onBack: nothing }),
    ];
    for (const spec of specs) expect(pressed(spec)).toContain(spec.home);
  });

  it('have commands short enough for the panel of a phone', () => {
    for (const candidate of pausePanel(PAUSE).rows) {
      if (candidate.kind === 'command') expect(textWidth(`${candidate.label.native} ${candidate.label.name}`)).toBeLessThanOrEqual(200);
    }
  });

  it('have three commands in the pause and no more: go on, start over, the menu', () => {
    expect(pressed(pausePanel(PAUSE))).toEqual(['resume', 'restart', 'menu']);
  });

  it('open the settings from the pause where they are given, before the menu', () => {
    expect(pressed(pausePanel({ ...PAUSE, onSystem: nothing }))).toEqual(['resume', 'restart', 'system', 'menu']);
    expect(pressed(pausePanel({ ...PAUSE, onWay: nothing, onSystem: nothing }))).toEqual(['resume', 'restart', 'way', 'system', 'menu']);
  });

  it('have the way for an advertisement in the pause only where it is given, after starting over', () => {
    const spec = pausePanel({ ...PAUSE, onWay: nothing });
    expect(pressed(spec)).toEqual(['resume', 'restart', 'way', 'menu']);
    expect(spec.home).toBe('resume');
  });

  it('have the score of a live session doubled for an advertisement once, and the command only where it is given', () => {
    const live = { onAgain: nothing, onNext: nothing, onMenu: nothing };
    expect(pressed(liveResultPanel({ score: 120, best: 300, maxChain: 2 }, live))).toEqual(['again', 'next', 'menu']);
    expect(pressed(liveResultPanel({ score: 120, best: 300, maxChain: 2 }, { ...live, onDouble: nothing }))).toEqual(['again', 'next', 'double', 'menu']);
    expect(row(liveResultPanel({ score: 120, best: 300, maxChain: 2, doubled: true }, live), 'number').value).toBe(240);
  });

  it('show a setting as it stands now', () => {
    const values = { muted: false, reducedMotion: false, shake: true, backdrop: false, control: 'gesture' as const, view: 'auto' as 'auto' | 'full', language: 'en' as const };
    const spec = systemPanel({
      values: () => values,
      onToggle: (key) => {
        if (key === 'muted') values.muted = !values.muted;
        if (key === 'view') values.view = values.view === 'auto' ? 'full' : 'auto';
      },
      onLanguage: nothing,
      onBack: nothing,
    });
    const sound = row(spec, 'switch');
    expect(sound.value()).toBe('ON');
    sound.action();
    expect(sound.value()).toBe('OFF');
    // The camera follows by itself, or is kept on the whole board.
    const view = spec.rows.find((candidate) => candidate.kind === 'switch' && candidate.id === 'view');
    if (view?.kind !== 'switch') throw new Error('no switch of the view');
    expect(view.value()).toBe('AUTO');
    view.action();
    expect(view.value()).toBe('FIXED');
  });

  it('say what there is to say about a record under the readings of a result', () => {
    const actions = { onAgain: nothing, onRecords: nothing, onMenu: nothing };
    const data = { score: 10, best: 20, maxChain: 2, ticks: 9000, tickMs: 20, note: 'a new best' };
    const spec = resultPanel(data, actions);
    expect(spec.title).toMatchObject({ name: 'RESULT' });
    expect(row(spec, 'say').text).toBe('a new best');
    expect(row(spec, 'field', 2).value).toBe('03:00');
    expect(resultPanel({ ...data, note: null }, actions).rows.some((candidate) => candidate.kind === 'say')).toBe(false);
  });
});

describe('the result of a session', () => {
  const data = { score: 10, best: 20, maxChain: 2, ticks: 9000, tickMs: 20, note: null };
  const actions = { onAgain: nothing, onRecords: nothing, onMenu: nothing };

  it('has its three commands in one line that stacks on a tall picture', () => {
    const commands = row(resultPanel(data, actions), 'commands');
    expect(commands.stacked).toBe(true);
    expect(commands.commands.map((command) => command.id)).toEqual(['again', 'records', 'menu']);
  });
});

describe('the result of a session that goes up the log', () => {
  const actions = { onAgain: nothing, onRecords: nothing, onMenu: nothing };
  const lines = [
    { name: 'a', score: 900, own: false, subject: false },
    { name: 'me', score: 400, own: true, subject: false },
    { name: 'b', score: 100, own: false, subject: false },
  ];
  const result = (score: number) => {
    const climb = new Climb({ lines, score, name: 'me', record: score > 400 });
    const spec = resultPanel({ score, best: Math.max(400, score), before: 400, maxChain: 2, ticks: 100, tickMs: 20, note: 'a new best' }, actions, climb);
    return { climb, spec };
  };
  const title = (spec: PanelSpec): string => (typeof spec.title === 'function' ? spec.title() : spec.title).name;
  const best = (spec: PanelSpec): string => {
    const field = row(spec, 'field');
    return typeof field.value === 'function' ? field.value() : field.value;
  };

  it('counts the score up beside its place, and shows the log around the session', () => {
    const { spec } = result(500);
    const standing = row(spec, 'standing');
    expect(standing.value()).toBe(0);
    expect(standing.place()).toBe(4);
    expect(standing.of()).toBe(4);
    expect(row(spec, 'climb').rows(3).map((line) => line?.name ?? null)).toEqual(['b', 'me', null]);
    expect(pressed(spec)).toContain(spec.home);
  });

  it('keeps the record to itself until the place is taken', () => {
    const { climb, spec } = result(500);
    expect(title(spec)).toBe('RESULT');
    expect(best(spec)).toBe('000400');
    expect(row(spec, 'say').when?.()).toBe(false);
    expect(spec.flash?.()).toBe(false);
    expect(spec.live?.(0)).toBe(true);
    climb.finish();
    spec.live?.(16);
    expect(title(spec)).toBe('NEW RECORD');
    expect(best(spec)).toBe('000500');
    expect(row(spec, 'say').when?.()).toBe(true);
    expect(spec.flash?.()).toBe(true);
    expect(row(spec, 'standing').place()).toBe(2);
    expect(row(spec, 'standing').of()).toBe(3);
    // The bar stops blinking a moment later, and the name stays.
    spec.live?.(5000);
    expect(spec.flash?.()).toBe(false);
    expect(title(spec)).toBe('NEW RECORD');
  });

  it('is a plain result where the session stays under the best there was', () => {
    const { climb, spec } = result(300);
    climb.finish();
    spec.live?.(16);
    expect(title(spec)).toBe('RESULT');
    expect(best(spec)).toBe('000400');
    expect(spec.flash?.()).toBe(false);
    expect(row(spec, 'standing').place()).toBe(3);
    expect(row(spec, 'standing').of()).toBe(4);
  });
});

describe('the log of sessions', () => {
  const line = (rank: number, name: string, score: number, own = false) => ({ rank, name, score, own });
  let shown: RecordsTable = { lines: [line(1, 'Ada', 5200), line(2, '  ', 900), line(41, 'A name far too long for the table', 70, true)] };
  const table = (): RecordsTable => shown;

  it('is one log under the name of the one session there is, with no tabs', () => {
    const spec = recordsPanel(table, { onBack: nothing });
    expect(spec.rows.filter((candidate) => candidate.kind === 'tabs')).toHaveLength(0);
    expect(typeof spec.title === 'function' ? spec.title() : spec.title).toEqual({ native: 'プロトコル', name: 'PROTOCOL' });
  });

  it('shows the lines by name, with their places and the line of the one who plays', () => {
    const spec = recordsPanel(table, { onBack: nothing });
    const log = row(spec, 'table');
    expect(log.head()).toBe('名前');
    expect(log.status?.()).toBe('');
    const rows = log.rows();
    expect(rows.slice(0, 2)).toEqual([
      ['Ada', '005200', false, 1],
      ['NO NAME', '000900', false, 2],
    ]);
    // A long name is cut where it would pass sixteen places of the font.
    const [name, score, own, place] = rows[2];
    expect([score, own, place]).toEqual(['000070', true, 41]);
    expect('A name far too long for the table'.startsWith(name)).toBe(true);
    expect(name.length).toBeLessThan('A name far too long for the table'.length);
    expect(textWidth(name)).toBeLessThanOrEqual(16 * 8);
  });

  it('says how the platform stands while its players are on their way', () => {
    const spec = recordsPanel(table, { onBack: nothing });
    const log = row(spec, 'table');
    shown = { lines: [], link: 'waiting' };
    expect(log.head()).toBe('名前');
    expect(log.rows()).toEqual([]);
    expect(log.empty()).toBe('記録なし NO ENTRY');
    expect(log.status?.()).toBe('接続中');
    shown = { ...shown, link: 'failed' };
    expect(log.status?.()).toBe('接続なし');
    // The head and what the platform has to say of itself fit the panel of a phone side by side.
    expect(textWidth(`No. ${log.head()} ${log.status?.()}`)).toBeLessThanOrEqual(248);
  });

  it('lets a guest be given a name where the platform can give one', () => {
    expect(pressed(recordsPanel(table, { onBack: nothing }))).toEqual(['back']);
    const spec = recordsPanel(table, { onBack: nothing, onRegister: nothing });
    expect(pressed(spec)).toEqual(['register', 'back']);
    expect(spec.home).toBe('back');
  });

  it('has the sharing under the way back: it sends the best of the player, and reads what came of it', () => {
    let sent = 0;
    let label = { native: '共有', name: 'SHARE' };
    const spec = recordsPanel(table, { onBack: nothing, share: { label: () => label, action: () => sent++ } });
    expect(pressed(spec)).toEqual(['back', 'share']);
    const share = spec.rows[spec.rows.length - 1];
    if (share.kind !== 'command') throw new Error('no command of sharing');
    expect(share.label.name).toBe('SHARE');
    // Writing to the clipboard is allowed only inside a press.
    expect(share.instant).toBe(true);
    share.action();
    expect(sent).toBe(1);
    label = { native: '複写済', name: 'COPIED' };
    expect(share.label.name).toBe('COPIED');
    expect(share.label.native).toBe('複写済');
  });
});

describe('the languages of the voice', () => {
  it('are each a line of the list, under a name of its own that fits the panel of a phone', () => {
    let picked = '';
    const spec = languagePanel({ languages: LANGUAGES, current: 'en', onPick: (code) => (picked = code), onBack: nothing });
    expect(pressed(spec)).toEqual([...LANGUAGES.map((code) => `language-${code}`), 'back']);
    for (const candidate of spec.rows) {
      if (candidate.kind === 'command') expect(textWidth(`${candidate.label.native} ${candidate.label.name}`)).toBeLessThanOrEqual(200);
    }
    const turkish = spec.rows.find((candidate) => candidate.kind === 'command' && candidate.id === 'language-tr');
    if (turkish?.kind === 'command') turkish.action();
    expect(picked).toBe('tr');
  });

  it('are named in the settings by the one that is set', () => {
    const values = () => ({ muted: false, reducedMotion: false, shake: true, backdrop: false, control: 'gesture' as const, view: 'auto' as const, language: 'ru' as const });
    const spec = systemPanel({ values, onToggle: nothing, onLanguage: nothing, onBack: nothing });
    const line = spec.rows.find((candidate) => candidate.kind === 'switch' && candidate.id === 'language');
    expect(line?.kind === 'switch' && line.value()).toBe('РУССКИЙ');
  });
});

describe('the tools of development', () => {
  const tool = { id: 'playtest', label: { native: 'DEV', name: 'PLAYTEST' }, action: nothing };

  it('are in a panel only when they are passed to it', () => {
    const values = () => ({ muted: false, reducedMotion: false, shake: true, backdrop: false, control: 'gesture' as const, view: 'auto' as const, language: 'en' as const });
    expect(pressed(systemPanel({ values, onToggle: nothing, onLanguage: nothing, onBack: nothing }))).toEqual(['sound', 'motion', 'shake', 'backdrop', 'control', 'view', 'language', 'back']);
    expect(pressed(systemPanel({ values, onToggle: nothing, onLanguage: nothing, tools: [tool], onBack: nothing }))).toContain('playtest');
  });
});
