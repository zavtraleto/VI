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
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { module } = await runnerImport('/src/rules/paceBot.ts', { root, configFile: false, logLevel: 'error' });

const tuning = {};
const experiments = {};
const table = {};
for (const arg of process.argv.slice(2)) {
  const [key, value] = arg.split('=');
  if (arg === 'endless' || arg === 'timed') table.modes = [arg === 'timed'];
  else if (key === 'seeds') table.seeds = Array.from({ length: Number(value) }, (_, i) => i + 1);
  else if (key === 'players') table.skills = value.split(',');
  else if (key === 'minutes') table.limitMinutes = Number(value);
  else if (value === 'true' || value === 'false') experiments[key] = value === 'true';
  else if (value !== undefined && !Number.isNaN(Number(value))) tuning[key] = Number(value);
  else throw new Error(`cannot read "${arg}": write it as name=number or name=true`);
}

console.log(module.paceTable({ tuning, experiments, ...table }));
