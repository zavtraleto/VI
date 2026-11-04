// The players who solve as people do (src/rules/humanBot.ts; docs/superpowers/specs/2026-11-04-vi-level-craft-design.md,
// section 3) on boards, and how they go with what people did (src/levels/players.ts): the newcomer against the players of
// Playgama, the owner against his playtest of places 31-60, on the boards as he played them.
//
//   node scripts/humans.mjs boards=R05,R08          the people on these boards: first try, failed once, gave up, tries, moves
//   node scripts/humans.mjs places=31-60            places of the row (src/levels/row.gen.ts)
//   node scripts/humans.mjs calibrate [set=crowd|owner]   the people against people, by Spearman over the boards
//   tune=owner.figure=3,newcomer.lure=0.6  a person changed for the run: <person>.<field>=<number>, a field of the persona
//                                           (depth, budget, slip, misread, figure, counts 0 or 1) or of the person (lure, load, loadDepth, bored, tries)
//   people=20 workers=6 json
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const script = fileURLToPath(import.meta.url);
const root = resolve(dirname(script), '..');
const load = async (path) => (await runnerImport(path, { root, configFile: false, logLevel: 'error' })).module;
const args = process.argv.slice(2);
const named = Object.fromEntries(args.filter((a) => a.includes('=')).map((a) => [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)]));
const flags = new Set(args.filter((a) => !a.includes('=')));
const KEYS = ['boards', 'places', 'people', 'workers', 'one', 'path', 'who', 'tune', 'set', 'plaques'];
for (const key of Object.keys(named)) if (!KEYS.includes(key)) refuse(`unknown key ${key}`);
for (const flag of flags) if (!['calibrate', 'json'].includes(flag)) refuse(`unknown flag ${flag}`);
const people = Number(named.people ?? 20);
const workers = Number(named.workers ?? Math.max(1, Math.min(6, availableParallelism() - 1)));

function refuse(what) {
  console.error(what);
  process.exit(2);
}

// One board in a process of its own: `one=<code> [path=<file>] [who=a,b]` prints the facts as JSON.
if (named.one) {
  const { parseBoard } = await load('/src/levels/boardFile.ts');
  const { fileBoard } = await load('/src/levels/boardFiles.ts');
  const { HUMANS, humanFacts } = await load('/src/rules/humanBot.ts');
  const { readFileSync } = await import('node:fs');
  const spec = named.path ? parseBoard(readFileSync(named.path, 'utf8'), named.one) : fileBoard(named.one);
  const who = named.who ? named.who.split(',') : Object.keys(HUMANS);
  const tuned = tunedOf(HUMANS, named.tune);
  // The plaques over the dice of a place of the row (`help.plaques` in boards/row.json) show their sides: nothing is misread there.
  if (named.plaques === '1') for (const name of Object.keys(tuned)) tuned[name].persona.misread = 0;
  const out = {};
  for (const name of who) out[name] = humanFacts(spec, tuned[name], people);
  console.log(JSON.stringify(out));
  process.exit(0);
}

/** The people with the changes of `tune=` made: `<person>.<field>=<number>`, joined by commas. */
function tunedOf(humans, tune) {
  const out = structuredClone(humans);
  const PERSONA = ['depth', 'budget', 'slip', 'misread', 'figure', 'counts'];
  const HUMAN = ['lure', 'load', 'loadDepth', 'bored', 'tries'];
  for (const part of (tune ?? '').split(',').filter(Boolean)) {
    const [path, value] = part.split('=');
    const [name, field] = path.split('.');
    if (!out[name] || !(PERSONA.includes(field) || HUMAN.includes(field)) || !Number.isFinite(Number(value))) refuse(`tune: cannot read ${part}`);
    if (field === 'counts') out[name].persona.counts = Number(value) !== 0;
    else if (PERSONA.includes(field)) out[name].persona[field] = Number(value);
    else out[name][field] = Number(value);
  }
  return out;
}

/** The facts of the people on one board, in a child process. */
function factsOf(job) {
  return new Promise((done, fail) => {
    const argv = [script, `one=${job.code}`, `people=${people}`];
    if (job.path) argv.push(`path=${job.path}`);
    if (job.who) argv.push(`who=${job.who.join(',')}`);
    if (named.tune) argv.push(`tune=${named.tune}`);
    if (job.plaques) argv.push('plaques=1');
    const child = spawn(process.execPath, argv, { cwd: root });
    let out = '';
    child.stdout.on('data', (chunk) => (out += chunk));
    child.on('close', (code) => {
      if (code !== 0) return fail(new Error(`${job.code} ended with ${code}`));
      done(JSON.parse(out));
    });
  });
}

async function run(jobs) {
  const out = new Map();
  let next = 0;
  let count = 0;
  const go = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      out.set(job.key ?? job.code, await factsOf(job));
      process.stderr.write(`\r${++count}/${jobs.length} boards`);
    }
  };
  await Promise.all(Array.from({ length: workers }, go));
  process.stderr.write('\n');
  return out;
}

/** A board as it stood at a commit, in a file of its own: the owner played the row of that commit. */
function boardAt(commit, code) {
  const dir = join(tmpdir(), 'vi-humans', commit);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${code}.txt`);
  writeFileSync(path, execFileSync('git', ['show', `${commit}:boards/${code}.txt`], { cwd: root }));
  return path;
}

const pct = (x) => (x === null || x === undefined ? '  —' : `${Math.round(x * 100)}%`.padStart(4));
const num = (x) => (x === null || x === undefined ? '  —' : x.toFixed(1).padStart(4));

if (flags.has('calibrate')) {
  const { CROWD, OWNER_PLAYS, PLAYED_AT, spearman } = await load('/src/levels/players.ts');
  const { readFileSync } = await import('node:fs');
  const row = JSON.parse(readFileSync(resolve(root, 'boards/row.json'), 'utf8'));
  const PLAQUES = new Set(row.chapters.flatMap((chapter) => chapter.places ?? []).filter((place) => place.help?.plaques).map((place) => place.board));
  const sets = named.set ? [named.set] : ['crowd', 'owner'];
  const jobs = [
    ...(sets.includes('crowd') ? CROWD.map((b) => ({ code: b.code, key: `crowd:${b.code}`, who: ['newcomer'], plaques: PLAQUES.has(b.code) })) : []),
    ...(sets.includes('owner') ? OWNER_PLAYS.map((p) => ({ code: p.code, key: `owner:${p.code}`, who: ['owner'], path: boardAt(PLAYED_AT, p.code) })) : []),
  ];
  const facts = await run(jobs);
  const rows = [];
  const against = (label, set, read, bot, measure) => {
    if (!sets.includes(label)) return;
    const pairs = set.map((row) => [measure(facts.get(`${label}:${row.code}`)[bot]), read(row)]).filter(([m, s]) => Number.isFinite(m) && Number.isFinite(s));
    rows.push({ people: `${label}: ${read.name}`, bot, measure: measure.name, rho: spearman(pairs.map((p) => p[0]), pairs.map((p) => p[1])), n: pairs.length });
  };
  const failedShare = (b) => b.failedPlayers / b.began;
  const failuresEach = (b) => b.failures / b.began;
  const movesOverPar = (p) => p.moves / p.par;
  const failedOnce = (f) => f.failedOnce;
  const triesOver1 = (f) => (f.tries ?? 9) - 1 + f.gaveUp * 9;
  const notFirst = (f) => 1 - f.first;
  against('crowd', CROWD, failedShare, 'newcomer', failedOnce);
  against('crowd', CROWD, failuresEach, 'newcomer', triesOver1);
  against('owner', OWNER_PLAYS, movesOverPar, 'owner', notFirst);
  against('owner', OWNER_PLAYS, movesOverPar, 'owner', triesOver1);
  // The owner's moves against the bot's moves over par: the par of each board divides.
  if (sets.includes('owner')) {
    const pairs = OWNER_PLAYS.map((p) => [(facts.get(`owner:${p.code}`).owner.moves ?? 99) / p.par, p.moves / p.par]);
    rows.push({ people: 'owner: movesOverPar', bot: 'owner', measure: 'botMovesOverPar', rho: spearman(pairs.map((x) => x[0]), pairs.map((x) => x[1])), n: pairs.length });
  }
  if (flags.has('json')) console.log(JSON.stringify({ rows, facts: Object.fromEntries(facts) }, null, 2));
  else {
    console.log('people against people (Spearman over the boards)');
    for (const r of rows) console.log(`  ${r.people.padEnd(28)} ${r.bot.padEnd(9)} ${r.measure.padEnd(16)} ${r.rho === null ? '—' : r.rho.toFixed(2)}  n=${r.n}`);
    console.log('\nboards: first try · failed once · gave up · tries · moves');
    for (const [key, f] of facts) {
      console.log(`  ${key.padEnd(34)} ${Object.entries(f).map(([name, x]) => `${name} ${pct(x.first)} ${pct(x.failedOnce)} ${pct(x.gaveUp)} ${num(x.tries)} ${num(x.moves)}`).join('   ')}`);
    }
  }
} else {
  let codes;
  if (named.boards) codes = named.boards.split(',');
  else {
    const { ROW } = await load('/src/levels/row.gen.ts');
    const [lo, hi] = (named.places ?? '1-30').split('-').map(Number);
    codes = ROW.places.filter((place) => place.number >= lo && place.number <= (hi ?? lo)).map((place) => place.code);
  }
  const facts = await run(codes.map((code) => ({ code })));
  if (flags.has('json')) console.log(JSON.stringify(Object.fromEntries(facts), null, 2));
  else {
    console.log('board: first try · failed once · gave up · tries · moves, for each person');
    for (const code of codes) {
      const f = facts.get(code);
      console.log(`  ${code.padEnd(24)} ${Object.entries(f).map(([name, x]) => `${name} ${pct(x.first)} ${pct(x.failedOnce)} ${pct(x.gaveUp)} ${num(x.tries)} ${num(x.moves)}`).join('   ')}`);
    }
  }
}
