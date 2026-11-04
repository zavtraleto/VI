// A playtest of the row by bots of several kinds (word of the owner, 4 November 2026: «добавить самостоятельные
// плейтесты разными ботами — с планированием, с перебором, только по видимым игроку граням»). Every bot is a
// persona of src/rules/levelBot.ts; one is new here: the planner who reads the board as a person does
// (`readerPlanner`, depth 5 and the misreading of READER). For each place: the share of single runs that clear
// the board (the first try), the moves of the runs that clear it against par, the share of them on three stars
// (par + 1), and for the two readers the tries a player who begins again needs (up to eight, as the owner on 60).
// Under the table: the techniques of the way of each place, by ten places, and the cores that come back.
//
//   node scripts/playtest.mjs                       places 31–60 of the row (src/levels/row.gen.ts)
//   node scripts/playtest.mjs places=1-30           other places
//   node scripts/playtest.mjs boards=a,b,c          boards of boards/ by their files, as they are, or paths to board files
//   runs=30 workers=6 json
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
const runs = Number(named.runs ?? 30);
const TRIES = 8;

const bot = await load('/src/rules/levelBot.ts');
const { parseBoard } = await load('/src/levels/boardFile.ts');
const { needsOf } = await load('/src/levels/needs.ts');
const { scoreOf } = await load('/src/rules/levelScore.ts');
const { moveOf } = await load('/src/rules/levelSolver.ts');
const { coreOf, coreKey } = await load('/src/levels/signature.ts');
const { goalFaces } = await load('/src/levels/goalFaces.ts');

/** The players of the test: planners by depth, the trying one, and the two who see only what a person sees. */
const PLAYERS = {
  casual: bot.PERSONAS.casual,
  careful: bot.PERSONAS.careful,
  planner: bot.PERSONAS.planner,
  deep: bot.DEEP,
  explorer: bot.explorerOf('planner'),
  reader: bot.READER,
  readerPlanner: { ...bot.PERSONAS.planner, misread: bot.READER.misread },
};
const RETRY = ['reader', 'readerPlanner'];

async function stops() {
  if (named.boards) {
    // A name is a file of boards/, or a path to a board file anywhere.
    return named.boards.split(',').map((name, index) => {
      const path = /[\\/]/.test(name) ? resolve(process.cwd(), name) : resolve(root, 'boards', `${name}.txt`);
      const code = name.replace(/^.*[\\/]/, '').replace(/\.txt$/, '');
      return { number: index + 1, code, spec: parseBoard(readFileSync(path, 'utf8'), code) };
    });
  }
  const { ROW } = await load('/src/levels/row.gen.ts');
  const [lo, hi] = (named.places ?? '31-60').split('-').map(Number);
  return ROW.places.filter((place) => place.number >= lo && place.number <= (hi ?? lo));
}

/** What the players do on one board. */
function playOf(stop) {
  const { spec } = stop;
  const par = spec.par;
  const out = { number: stop.number, code: stop.code, par, faces: goalFaces(spec).join(' '), players: {} };
  for (const [name, persona] of Object.entries(PLAYERS)) {
    let passed = 0;
    let moves = 0;
    let stars = 0;
    for (let seed = 1; seed <= runs; seed++) {
      const { state, way } = bot.personaRun(spec, persona, seed);
      if (state.endReason !== 'passed') continue;
      passed++;
      moves += way.length;
      if (way.length <= par + 1) stars++;
    }
    const facts = { first: passed / runs, moves: passed ? moves / passed : null, stars: passed ? stars / passed : 0 };
    if (RETRY.includes(name)) {
      // A player who begins again until the board is cleared, up to eight tries, each try a new run of their own.
      let tries = 0;
      let solved = 0;
      for (let player = 1; player <= runs; player++) {
        for (let attempt = 1; attempt <= TRIES; attempt++) {
          if (bot.personaRun(spec, persona, player * 100 + attempt).state.endReason === 'passed') {
            tries += attempt;
            solved++;
            break;
          }
        }
      }
      facts.tries = solved ? tries / solved : null;
      facts.solved = solved / runs;
    }
    out.players[name] = facts;
  }
  const way = (spec.solution ?? []).map(moveOf);
  out.needs = [...needsOf(spec, way)];
  out.pushes = way.filter((move) => move.push).length;
  out.rolls = way.length - out.pushes;
  out.route = scoreOf(spec, way).route;
  out.core = coreKey(coreOf(spec));
  return out;
}

if (named.share) {
  const [index, of] = named.share.split('/').map(Number);
  for (const [at, stop] of (await stops()).entries()) if (at % of === index) console.log(JSON.stringify(playOf(stop)));
  process.exit(0);
}

const all = await stops();
const workers = Math.max(1, Number(named.workers ?? Math.min(6, Math.max(1, availableParallelism() - 2))));
const results = [];
await Promise.all(
  Array.from({ length: workers }, (_, index) => new Promise((done, fail) => {
    const child = spawn(process.execPath, ['--max-old-space-size=4096', script, ...args.filter((arg) => !arg.startsWith('share=') && !arg.startsWith('workers=')), `share=${index}/${workers}`], { stdio: ['ignore', 'pipe', 'inherit'] });
    let rest = '';
    child.stdout.on('data', (chunk) => {
      const lines = (rest + chunk).split('\n');
      rest = lines.pop();
      for (const line of lines) if (line.trim()) results.push(JSON.parse(line));
    });
    child.on('close', (code) => (code === 0 ? done() : fail(new Error(`a worker ended with ${code}`))));
  })),
);
results.sort((a, b) => a.number - b.number);
if (args.includes('json')) {
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

const pct = (share) => `${Math.round(share * 100)}%`.padStart(4);
const mv = (facts) => (facts.moves === null ? '   -' : facts.moves.toFixed(1).padStart(4));
const head = ['n', 'board'.padEnd(24), 'par', 'faces', ...Object.keys(PLAYERS).map((name) => name.padEnd(15)), 'tries r/rp', 'route'];
console.log(head.join(' '));
for (const r of results) {
  const cells = Object.keys(PLAYERS).map((name) => `${pct(r.players[name].first)} ${mv(r.players[name])} ${pct(r.players[name].stars)}`.padEnd(15));
  const tries = RETRY.map((name) => (r.players[name].tries === null ? '-' : `${r.players[name].tries.toFixed(1)}/${pct(r.players[name].solved).trim()}`)).join(' ');
  console.log([String(r.number).padEnd(3), r.code.padEnd(24), String(r.par).padStart(3), r.faces.padEnd(5), ...cells, tries.padEnd(10), r.route].join(' '));
}
console.log('\ncells: share cleared at the first try, mean moves of the runs that clear, share of those on three stars; tries: mean tries to clear / share cleared in eight');

// Techniques by ten places: how many boards of each ten ask for each, and the rolls and pushes of their ways.
const TECH = ['link', 'walk', 'glass', 'lift', 'push', 'ones', 'twoFaces', 'seven', 'loop'];
console.log(`\n${'places'.padEnd(8)} ${TECH.map((t) => t.padEnd(8)).join(' ')} rolls pushes faces`);
const tens = new Map();
for (const r of results) {
  const ten = Math.floor((r.number - 1) / 10);
  if (!tens.has(ten)) tens.set(ten, []);
  tens.get(ten).push(r);
}
for (const [ten, rs] of tens) {
  const counts = TECH.map((t) => String(rs.filter((r) => r.needs.includes(t)).length).padEnd(8));
  const rolls = rs.reduce((s, r) => s + r.rolls, 0);
  const pushes = rs.reduce((s, r) => s + r.pushes, 0);
  const faces = new Map();
  for (const r of rs) for (const face of r.faces.split(' ')) faces.set(face, (faces.get(face) ?? 0) + 1);
  console.log(`${`${ten * 10 + 1}–${ten * 10 + 10}`.padEnd(8)} ${counts.join(' ')} ${String(rolls).padEnd(5)} ${String(pushes).padEnd(7)} ${[...faces].sort().map(([f, n]) => `${f}×${n}`).join(' ')}`);
}
// The routes that come back: the same signs of the way on two places or more.
const routes = new Map();
for (const r of results) routes.set(r.route, [...(routes.get(r.route) ?? []), r.number]);
const again = [...routes].filter(([, ns]) => ns.length > 1);
console.log(`\nroutes on two places or more: ${again.length ? again.map(([route, ns]) => `${route} — ${ns.join(', ')}`).join('; ') : 'none'}`);
