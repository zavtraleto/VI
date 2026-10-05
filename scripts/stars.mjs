// What the levels cost in moves: how many moves over the fewest a pass takes, for the players
// made of the rules. The fewest moves of a level are proved by the solver; this measures the
// other end, the moves of the passes that are not the shortest, to set stars, gates and limits by.
// The players are the personas and the random one of src/rules/levelBot.ts; the stars, the limit
// of moves and the gates are the game's own, src/levels/progress.ts: change them there and the
// tables follow. What the numbers came to is in docs/VI_Levels_Progression_Research.md.
//
//   node scripts/stars.mjs                 the tables, 200 runs of each player on each level
//   node scripts/stars.mjs runs=60         fewer runs
//   node scripts/stars.mjs json            the counts as they are, one line per level and player
//   node scripts/stars.mjs from=counts.jsonl   the tables of counts kept that way, with nothing played anew
//   workers=6                              processes the work is shared among
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const script = fileURLToPath(import.meta.url);
const root = resolve(dirname(script), '..');
const load = async (path) => (await runnerImport(path, { root, configFile: false, logLevel: 'error' })).module;

const args = process.argv.slice(2);
const named = Object.fromEntries(args.filter((arg) => arg.includes('=')).map((arg) => arg.split('=')));
const flag = (name) => args.includes(name);
for (const key of Object.keys(named)) {
  if (!['runs', 'workers', 'share', 'from'].includes(key)) throw new Error(`cannot read "${key}=": write it as runs=200, workers=6 or from=counts.jsonl`);
}

/** Counts kept by an earlier run, one line per level and player; none when the levels are to be played. */
const kept = named.from ? readFileSync(named.from, 'utf8').split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line)) : null;
const RUNS = kept ? kept[0].runs : Number(named.runs ?? 200);
/** Moves after which a run is called off: a persona's own sixty, and a hundred for the random player. */
const PERSONA_CAP = 60;
const RANDOM_CAP = 100;
const PLAYERS = ['random', 'hasty', 'casual', 'careful', 'planner'];
const PERSONAS = PLAYERS.slice(1);

const { LEVELS } = await load('/src/levels/levels.ts');
const { personaPlay, randomPlay } = await load('/src/rules/levelBot.ts');
const { THREE_STARS_OVER, TWO_STARS_OVER, chaptersOf, gateOf, levelStars, moveLimit } = await load('/src/levels/progress.ts');
/** Moves over the fewest that still earn three stars, and two. */
const TOP = THREE_STARS_OVER;
const TWO = THREE_STARS_OVER + TWO_STARS_OVER;

const [shareIndex, shareOf] = (named.share ?? '0/1').split('/').map(Number);

/** What the runs of a player on a level came to: the moves of every run that cleared it, the fewest first, and the runs that ended at a dead end. */
function playsOf(spec, player) {
  const moves = [];
  let failed = 0;
  for (let seed = 1; seed <= RUNS; seed++) {
    const state = player === 'random' ? randomPlay(spec, seed, RANDOM_CAP) : personaPlay(spec, player, seed, PERSONA_CAP);
    if (state.endReason === 'passed') moves.push(state.levelRun.moves);
    else if (state.endReason === 'failed') failed++;
  }
  return { moves: moves.sort((a, b) => a - b), failed };
}

if (named.share !== undefined) {
  let job = 0;
  for (const spec of LEVELS) {
    for (const player of PLAYERS) {
      if (job++ % shareOf === shareIndex) console.log(JSON.stringify({ id: spec.id, player, ...playsOf(spec, player) }));
    }
  }
  process.exit(0);
}

/** plays[level][player]: the moves of the runs that cleared it, and the runs lost. */
const plays = LEVELS.map(() => ({}));
const keep = ({ id, player, moves, failed }) => {
  const level = LEVELS.findIndex((spec) => spec.id === id);
  if (level < 0) throw new Error(`no level ${id} in the ladder`);
  plays[level][player] = { moves, failed };
};
if (kept) kept.forEach(keep);
else {
  const workers = Math.max(1, Number(named.workers ?? Math.min(6, Math.max(1, availableParallelism() - 2))));
  let done = 0;
  await Promise.all(
    Array.from({ length: workers }, (_, index) => new Promise((ok, fail) => {
      const child = spawn(process.execPath, [script, `runs=${RUNS}`, `share=${index}/${workers}`], { stdio: ['ignore', 'pipe', 'inherit'] });
      let rest = '';
      child.stdout.on('data', (chunk) => {
        const lines = (rest + chunk).split('\n');
        rest = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          keep(JSON.parse(line));
          console.error(`${++done} of ${LEVELS.length * PLAYERS.length} measured`);
        }
      });
      child.on('error', fail);
      child.on('close', (code) => (code === 0 ? ok() : fail(new Error(`a worker ended with ${code}`))));
    })),
  );
}

if (flag('json')) {
  LEVELS.forEach((spec, level) => {
    for (const player of PLAYERS) console.log(JSON.stringify({ id: spec.id, par: spec.par, player, runs: RUNS, ...plays[level][player] }));
  });
  process.exit(0);
}

const pct = (part, whole = RUNS) => `${Math.round((100 * part) / Math.max(1, whole))}%`;
const at = (sorted, percent) => (sorted.length === 0 ? null : sorted[Math.max(0, Math.ceil((percent / 100) * sorted.length) - 1)]);
const over = (value, par) => (value === null ? '-' : `+${value - par}`);
const table = (rows) => {
  const widths = rows[0].map((_, column) => Math.max(...rows.map((row) => String(row[column]).length)));
  return rows.map((row) => row.map((cell, column) => String(cell).padEnd(widths[column])).join('  ').trimEnd()).join('\n');
};
const movesOf = (level, player) => plays[level][player].moves;
const all = LEVELS.map((_, level) => level);

/** The chapters of the ladder, each with its levels, counted from 0, and the stars its gate asks for. */
const chapters = chaptersOf(LEVELS).map(({ from, to }) => ({ faces: LEVELS[from].faces.join(''), levels: all.slice(from, to), gate: gateOf({ from, to }) }));
const chapterOf = (level) => chapters.findIndex(({ levels }) => levels.includes(level));
/** The limit of moves a level is played with. */
const limitOf = (level) => moveLimit(LEVELS[level].par, chapterOf(level));

console.log(`Runs of each player on each level: ${RUNS}. A persona is called off at ${PERSONA_CAP} moves, the random player at ${RANDOM_CAP}.`);
console.log(`The game: three stars within ${TOP} of the fewest moves, two within ${TWO}, one for a pass; the limits of moves are ${all.map(limitOf).join(' ')}; the gates ask for ${chapters.map(({ gate }) => gate).join(', ')} stars.`);

console.log('\n1. Passes with no limit, and the moves of a pass over the fewest: median / nine in ten');
console.log(table([
  ['level', 'par', ...PLAYERS.flatMap((player) => [player, 'over'])],
  ...LEVELS.map((spec, level) => [spec.id, spec.par, ...PLAYERS.flatMap((player) => {
    const moves = movesOf(level, player);
    return [pct(moves.length), `${over(at(moves, 50), spec.par)} / ${over(at(moves, 90), spec.par)}`];
  })]),
]));

console.log('\n2. Of all the passes of a player over the ladder, by the moves over the fewest: the fewest / those of three stars / those of two / up to 9 / 10 and more');
console.log(table([
  ['player', 'passes', 'fewest', `to +${TOP}`, `to +${TWO}`, 'to +9', '+10..'],
  ...PLAYERS.map((player) => {
    const overs = all.flatMap((level) => movesOf(level, player).map((moves) => moves - LEVELS[level].par));
    const share = (from, to) => pct(overs.filter((o) => o >= from && o <= to).length, overs.length);
    return [player, `${overs.length} of ${LEVELS.length * RUNS}`, share(-Infinity, 0), share(1, TOP), share(TOP + 1, TWO), share(TWO + 1, 9), share(10, Infinity)];
  }),
]));

console.log('\n3. Of the passes of a player on a level, the share within so many moves of the fewest: 0 / 1 / 2 / 3');
console.log(table([
  ['level', 'par', ...PLAYERS],
  ...LEVELS.map((spec, level) => [spec.id, spec.par, ...PLAYERS.map((player) => {
    const moves = movesOf(level, player);
    if (moves.length === 0) return '-';
    return [0, 1, 2, 3].map((extra) => pct(moves.filter((m) => m <= spec.par + extra).length, moves.length)).join(' / ');
  })]),
]));

console.log('\n4. A limit of moves: the share of the passes of a player over the ladder that it keeps');
console.log(table([
  ['limit', ...PLAYERS],
  ...[
    ['twice the fewest', (level) => 2 * LEVELS[level].par],
    ['four times', (level) => 4 * LEVELS[level].par],
    ['the fewest and 10', (level) => LEVELS[level].par + 10],
    ['the fewest and 20', (level) => LEVELS[level].par + 20],
    ['five times and 10', (level) => 5 * LEVELS[level].par + 10],
    ['of the game', limitOf],
  ].map(([name, limit]) => [name, ...PLAYERS.map((player) => {
    const passed = all.reduce((sum, level) => sum + movesOf(level, player).length, 0);
    const within = all.reduce((sum, level) => sum + movesOf(level, player).filter((m) => m <= limit(level)).length, 0);
    return pct(within, passed);
  })]),
]));

console.log('\n5. Under the limit of the game, level by level: the limit, and the passes of all runs with it / with none');
console.log(table([
  ['level', 'par', 'limit', ...PLAYERS],
  ...LEVELS.map((spec, level) => [spec.id, spec.par, limitOf(level), ...PLAYERS.map((player) => {
    const moves = movesOf(level, player);
    return `${pct(moves.filter((m) => m <= limitOf(level)).length)} / ${pct(moves.length)}`;
  })]),
]));

/**
 * Stars a player is expected to hold on a level after so many tries, the best try kept, by the
 * stars and under the limit of the game: a run over the limit is no pass.
 */
function starsAfter(level, player, tries) {
  const { par } = LEVELS[level];
  const passes = movesOf(level, player).filter((m) => m <= limitOf(level));
  const share = (stars) => passes.filter((m) => levelStars(m, par) >= stars).length / RUNS;
  return [1, 2, 3].reduce((sum, stars) => sum + (1 - (1 - share(stars)) ** tries), 0);
}
const starsOver = (levels, player, tries) => levels.reduce((sum, level) => sum + starsAfter(level, player, tries), 0);

console.log('\n6. Stars expected by chapter after 1 / 3 / 10 tries of every level, by the stars and under the limit of the game');
console.log(table([
  ['chapter', 'faces', 'levels', 'stars', ...PERSONAS],
  ...chapters.map(({ faces, levels }, index) => [index + 1, faces, levels.length, levels.length * 3, ...PERSONAS.map((player) => [1, 3, 10].map((tries) => starsOver(levels, player, tries).toFixed(1)).join(' / '))]),
]));

console.log('\n7. A gate of stars before a chapter: tries of every level before it after which a player is expected to hold them; the gate of the game is marked');
{
  const rows = [['chapter', 'gate', ...PERSONAS]];
  chapters.slice(1).forEach(({ gate: own }, index) => {
    const before = chapters.slice(0, index + 1).flatMap((chapter) => chapter.levels);
    const stars = before.length * 3;
    // From a star for every level to two for every level, by sixths of what there is, and the gate of the game among them.
    const gates = [...new Set([2, 2.5, 3, 3.5, 4].map((sixths) => Math.round((stars * sixths) / 6)).concat(own))].sort((a, b) => a - b);
    for (const gate of gates) {
      rows.push([index + 2, `${gate} of ${stars}${gate === own ? ' *' : ''}`, ...PERSONAS.map((player) => {
        for (let tries = 1; tries <= 30; tries++) if (starsOver(before, player, tries) >= gate) return tries;
        return 'over 30';
      })]);
    }
  });
  console.log(table(rows));
}

console.log(`\n8. How ${RANDOM_CAP} moves at random end, with no limit`);
console.log(table([
  ['level', 'dice', 'faces', 'cleared', 'dead end', 'still going'],
  ...LEVELS.map((spec, level) => {
    const { moves, failed } = plays[level].random;
    return failed === undefined ? [spec.id, spec.norm, spec.faces.join(''), pct(moves.length), '-', '-'] : [spec.id, spec.norm, spec.faces.join(''), pct(moves.length), pct(failed), pct(RUNS - moves.length - failed)];
  }),
]));

