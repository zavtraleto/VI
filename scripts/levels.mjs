// Plays the levels of the probe with players made of the rules and prints, for every level and
// player, how many moves its goal takes: the share of runs that met it, the moves at the 5th,
// 50th, 75th and 90th percentile, and the share that would have passed in the level's limit.
// The seed and the limit of every level are taken from these tables.
// The player is described in src/rules/bot.ts, the table in src/rules/levelBot.ts, the levels
// in src/levels/levels.ts.
//
//   node scripts/levels.mjs                      the levels as they are
//   node scripts/levels.mjs runs=100             more runs to a row
//   node scripts/levels.mjs players=novice,pro   some of the players only
//   node scripts/levels.mjs level=p03,p05        some of the levels only
//   node scripts/levels.mjs seeds=12             the novice's median on seeds 1 to 12 of every level, and the seed in the middle
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const load = async (path) => (await runnerImport(path, { root, configFile: false, logLevel: 'error' })).module;
const { levelTable } = await load('/src/rules/levelBot.ts');
const { PROBE_LEVELS } = await load('/src/levels/levels.ts');

const table = { levels: PROBE_LEVELS };
for (const arg of process.argv.slice(2)) {
  const [key, value] = arg.split('=');
  if (key === 'runs' && Number(value) > 0) table.runs = Number(value);
  else if (key === 'seeds' && Number(value) > 0) table.seeds = Number(value);
  else if (key === 'players' && value) table.skills = value.split(',');
  else if (key === 'level' && value) table.levels = PROBE_LEVELS.filter((level) => value.split(',').includes(level.id));
  else throw new Error(`cannot read "${arg}": write it as runs=40, players=novice,pro, level=p03 or seeds=12`);
}

console.log(levelTable(table));
