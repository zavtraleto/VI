// Plays the pace of the game with a player made of its rules and prints how a run goes for
// five players, from one just shown the rules to one who plays for a living: how long it lasts,
// what level it reaches, how it scores.
// The player is described in src/rules/bot.ts, the table in src/rules/paceBot.ts.
//
//   node scripts/pace.mjs                          the pace as it is
//   node scripts/pace.mjs paceGrowth=0.08 restMs=0 with variables of the debug panel changed
//   node scripts/pace.mjs waves=false              with an experiment switched
//   node scripts/pace.mjs endless                  Endless alone; `timed` for the session of the day
//   node scripts/pace.mjs seeds=9 minutes=45       more runs to a row, a longer trial
//   node scripts/pace.mjs players=newbie,esports   some of the players only
//   node scripts/pace.mjs grid                     heads against hands: time and score of every pair
//   node scripts/pace.mjs styles                   a survivor and a builder of chains beside the player as it is
//   node scripts/pace.mjs survival minutes=12      the share of the runs still going at every minute
//   node scripts/pace.mjs edges                    a board nobody plays, and the most a player can do
//   node scripts/pace.mjs rush                     the players slip and overlook more as the board fills
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { module } = await runnerImport('/src/rules/paceBot.ts', { root, configFile: false, logLevel: 'error' });

const tuning = {};
const experiments = {};
const table = {};
let which = 'table';
for (const arg of process.argv.slice(2)) {
  const [key, value] = arg.split('=');
  if (['grid', 'styles', 'survival', 'edges'].includes(arg)) which = arg;
  else if (arg === 'rush') table.rush = true;
  else if (arg === 'endless' || arg === 'timed') {
    table.modes = [arg === 'timed'];
    table.timed = arg === 'timed';
  } else if (key === 'seeds') table.seeds = Array.from({ length: Number(value) }, (_, i) => i + 1);
  else if (key === 'players') table.skills = value.split(',');
  else if (key === 'minutes') table.limitMinutes = Number(value);
  else if (value === 'true' || value === 'false') experiments[key] = value === 'true';
  else if (value !== undefined && !Number.isNaN(Number(value))) tuning[key] = Number(value);
  else throw new Error(`cannot read "${arg}": write it as name=number or name=true`);
}

// The table of the pace plays both modes by `modes`; the others play the one that was named, Endless if none.
const { modes, skills, timed, limitMinutes, ...shared } = table;
const print = {
  table: () => module.paceTable({ tuning, experiments, ...table, timed: undefined }),
  grid: () => module.paceGrid({ tuning, experiments, ...shared, timed, limitMinutes }),
  styles: () => module.paceStyles({ tuning, experiments, ...shared, skills, timed, limitMinutes }),
  survival: () => module.survivalTable({ tuning, experiments, ...shared, skills, timed, minutes: limitMinutes }),
  edges: () => module.paceEdges({ tuning, experiments, ...shared, timed, limitMinutes }),
};
console.log(print[which]());
