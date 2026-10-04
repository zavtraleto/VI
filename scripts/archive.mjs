// Plays the sessions the log of sessions is filled with while few people play: sessions of the
// player made of the rules (src/rules/bot.ts), at strengths between its named ones, from one who
// has just been shown the rules up to one who plays for chains. Their scores are written to
// src/app/archiveData.ts, weakest player first; who the lines belong to and when they come into
// the log is made in src/app/archive.ts.
//
//   node scripts/archive.mjs          plays the sessions and writes the file
//   node scripts/archive.mjs probe    prints strength, seed and score of every session, writes nothing
//
// Run it again after the pace or the scoring has changed: the log should hold scores that can
// be made under the rules as they are.
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const load = async (path) => (await runnerImport(path, { root, configFile: false, logLevel: 'error' })).module;
const { SKILLS, SKILL_NAMES, createBot, botCommand } = await load('/src/rules/bot.ts');
const { createRun, step, defaultConfig, RULES_VERSION } = await load('/src/rules/index.ts');

/** The strongest player of the log stands this far along the named ones: 3 is the one who plays for chains. */
const STRONGEST = 3.2;
/**
 * Players of the log. Each has a strength, plays one session without a limit, and one session
 * of the day that the days take their lines from.
 */
const PLAYERS = 250;
/** A session that lasts longer than this is given up. */
const LIMIT_MINUTES = 40;

const mix = (a, b, t) => a + (b - a) * t;

/** A player between two named ones: `strength` 0 is the first of them, 1 the second, and so on. */
function skillAt(strength) {
  const at = Math.min(Math.max(strength, 0), SKILL_NAMES.length - 1);
  const low = Math.min(Math.floor(at), SKILL_NAMES.length - 2);
  const t = at - low;
  const a = SKILLS[SKILL_NAMES[low]];
  const b = SKILLS[SKILL_NAMES[low + 1]];
  const whole = (name) => Math.round(mix(a[name], b[name], t));
  const range = (name) => [Math.round(mix(a[name][0], b[name][0], t)), Math.round(mix(a[name][1], b[name][1], t))];
  const part = (name) => mix(a[name], b[name], t);
  return {
    depth: whole('depth'),
    rolls: whole('rolls'),
    budget: whole('budget'),
    think: range('think'),
    thinkPerMove: part('thinkPerMove'),
    thinkPerCube: part('thinkPerCube'),
    pause: range('pause'),
    idle: range('idle'),
    miss: part('miss'),
    missPerRoll: part('missPerRoll'),
    lapse: part('lapse'),
    lapseTicks: range('lapseTicks'),
    slip: part('slip'),
    greed: part('greed'),
    tidy: t < 0.5 ? a.tidy : b.tidy,
  };
}

function play(strength, seed, timed) {
  const config = defaultConfig();
  const state = createRun({ seed, config, timed });
  const bot = createBot(skillAt(strength), seed);
  const limit = Math.round((LIMIT_MINUTES * 60000) / config.tickMs);
  while (!state.over && state.tick < limit) step(state, botCommand(bot, state));
  return state.score;
}

/** The sessions of one kind: strengths spread evenly from the weakest to the strongest, each on a seed of its own. */
function sessions(count, timed) {
  const runs = [];
  for (let i = 0; i < count; i++) {
    const strength = (STRONGEST * i) / (count - 1);
    const seed = (timed ? 70_000 : 10_000) + i * 7919;
    runs.push({ strength, seed, score: play(strength, seed, timed) });
  }
  return runs;
}

const probe = process.argv.includes('probe');
const started = Date.now();
const endless = sessions(PLAYERS, false);
const timed = sessions(PLAYERS, true);

if (probe) {
  for (const [name, runs] of [['endless', endless], ['timed', timed]]) {
    console.log(name);
    for (const run of runs) console.log(`  ${run.strength.toFixed(2)}  seed ${run.seed}  ${run.score}`);
  }
} else {
  const list = (runs) => runs.map((run) => run.score).join(', ');
  const text = `/**
 * Written by \`node scripts/archive.mjs\`, under the rules of ${RULES_VERSION}: not to be changed by hand.
 * Scores of sessions played by the player made of the rules, at ${PLAYERS} strengths from one who has
 * just been shown the rules to one who plays for chains. In the order of the players, the
 * weakest first: the same place in both lists is the same player.
 */

/** A session without a limit of each player. */
export const ARCHIVE_ENDLESS: readonly number[] = [${list(endless)}];

/** A session of the day of each player: what the days take their lines from. */
export const ARCHIVE_TIMED: readonly number[] = [${list(timed)}];
`;
  writeFileSync(resolve(root, 'src/app/archiveData.ts'), text);
  console.log(`src/app/archiveData.ts: ${endless.length} sessions without a limit, ${timed.length} of the day`);
}
console.log(`${Math.round((Date.now() - started) / 1000)} s`);
