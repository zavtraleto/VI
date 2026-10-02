// Plays the pace of the game with a stand-in for a player and prints how long a run lasts and
// what level it reaches at 10, 20 and 40 cubes cleared a minute. The player's model is described
// in src/rules/paceBot.ts.
//
//   node scripts/pace.mjs                      the pace as it is
//   node scripts/pace.mjs paceRatio=0.9 calmMs=0   with variables of the debug panel changed
//   node scripts/pace.mjs chainCalm=false          with an experiment switched
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { module } = await runnerImport('/src/rules/paceBot.ts', { root, configFile: false, logLevel: 'error' });

const tuning = {};
const experiments = {};
for (const arg of process.argv.slice(2)) {
  const [key, value] = arg.split('=');
  if (value === 'true' || value === 'false') experiments[key] = value === 'true';
  else if (value !== undefined && !Number.isNaN(Number(value))) tuning[key] = Number(value);
  else throw new Error(`cannot read "${arg}": write it as name=number or name=true`);
}

console.log(module.paceTable({ tuning, experiments }));
