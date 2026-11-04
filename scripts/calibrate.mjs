// How the measures of a board and the bots go with what people did on it
// (docs/superpowers/specs/2026-11-04-vi-level-craft-design.md, section 7, step 1). The people are in
// src/levels/players.ts: the players of Playgama on the first places, the owner on places 31-60. Every board
// is measured by the passport of the generator (`node scripts/lay.mjs passport file=<board> json`), several
// at once; then each measure is set against each signal of the people by Spearman's rank correlation.
//
//   node scripts/calibrate.mjs              both sets, the table of correlations and the boards
//   node scripts/calibrate.mjs set=crowd    the players of the platform only (set=owner: the owner's moves on 31-60;
//                                           set=words: his words of 28 October that placed boards of the row, D_ROWS)
//   workers=6 json
import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const load = async (path) => (await runnerImport(path, { root, configFile: false, logLevel: 'error' })).module;
const named = Object.fromEntries(process.argv.slice(2).filter((a) => a.includes('=')).map((a) => a.split('=')));
const flags = new Set(process.argv.slice(2).filter((a) => !a.includes('=')));
for (const key of Object.keys(named)) if (!['set', 'workers'].includes(key)) refuse(`unknown key ${key}`);
for (const flag of flags) if (flag !== 'json') refuse(`unknown flag ${flag}`);
const workers = Number(named.workers ?? Math.max(1, Math.min(6, availableParallelism() - 1)));

function refuse(what) {
  console.error(what);
  process.exit(2);
}

const { CROWD, OWNER_PLAYS, spearman } = await load('/src/levels/players.ts');
const { D_ROWS } = await load('/src/levels/calibration.ts');
/** The owner's words of 28 October placing boards of the row (`D_ROWS`, the scale D was tuned on), the first thirty left out: the middle of each band. */
const WORDS = D_ROWS.filter((row) => row.words !== 'первые тридцать').flatMap((row) => row.codes.map((code) => ({ code, band: (row.lo + row.hi) / 2 })));

/** The passport of one board, from the generator's command. */
function passport(code) {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [resolve(root, 'scripts/lay.mjs'), 'passport', `file=${code}`, 'json'], { cwd: root });
    let out = '';
    child.stdout.on('data', (chunk) => (out += chunk));
    child.on('close', (code_) => {
      if (code_ !== 0) return fail(new Error(`passport of ${code} ended with ${code_}`));
      try {
        done(JSON.parse(out));
      } catch {
        fail(new Error(`passport of ${code} is not JSON`));
      }
    });
  });
}

async function passports(codes) {
  const out = new Map();
  let next = 0;
  let doneCount = 0;
  const run = async () => {
    while (next < codes.length) {
      const code = codes[next++];
      out.set(code, await passport(code));
      process.stderr.write(`\r${++doneCount}/${codes.length} boards`);
    }
  };
  await Promise.all(Array.from({ length: workers }, run));
  process.stderr.write('\n');
  return out;
}

/** The measures of a passport set against people: higher means harder, as far as each is read. */
const MEASURES = {
  par: (p) => p.par,
  dice: (p) => p.dice,
  D: (p) => p.d,
  risk: (p) => p.risk,
  search: (p) => p.search,
  narrow: (p) => p.craft?.narrow,
  choice: (p) => p.craft?.choice,
  counter: (p) => p.craft?.counter,
  'last share': (p) => p.craft?.lastShare,
  rank: (p) => p.rank,
  forks: (p) => p.depth?.forks,
  ways: (p) => p.depth?.ways,
  waysLong: (p) => p.depth?.waysLong,
  slack: (p) => p.depth?.slack,
  lossAt: (p) => (p.depth?.lossAt === null ? 99 : p.depth?.lossAt),
  lostShare: (p) => p.depth?.lostShare,
  hidden: (p) => p.hidden,
  firsts: (p) => p.firsts,
  'hasty fails': (p) => 1 - p.shares?.hasty,
  'casual fails': (p) => 1 - p.shares?.casual,
  'careful fails': (p) => 1 - p.shares?.careful,
  'planner fails': (p) => 1 - p.shares?.planner,
  'reader fails': (p) => 1 - p.reader,
  'reading cost': (p) => p.shares?.careful - p.reader,
};

const SIGNALS = {
  crowd: {
    boards: CROWD.map((b) => b.code),
    of: {
      'failed at least once': (b) => b.failedPlayers / b.began,
      'failures a player': (b) => b.failures / b.began,
      'did not pass': (b) => (b.began - b.passed) / b.began,
    },
    rows: CROWD,
  },
  words: {
    boards: WORDS.map((w) => w.code),
    of: { 'his place in words (28 Oct)': (w) => w.band },
    rows: WORDS,
  },
  owner: {
    boards: OWNER_PLAYS.map((p) => p.code),
    of: { 'his moves / par': (p) => p.moves / p.par },
    rows: OWNER_PLAYS,
  },
};

const sets = named.set ? [named.set] : ['crowd', 'owner', 'words'];
for (const set of sets) if (!SIGNALS[set]) refuse(`no set ${set}: crowd, owner or words`);
const measured = await passports([...new Set(sets.flatMap((set) => SIGNALS[set].boards))]);

const report = {};
for (const set of sets) {
  const { of, rows } = SIGNALS[set];
  report[set] = {};
  for (const [signal, read] of Object.entries(of)) {
    report[set][signal] = Object.entries(MEASURES)
      .map(([name, measure]) => {
        const pairs = rows
          .map((row) => [measure(measured.get(row.code)), read(row)])
          .filter(([m, s]) => Number.isFinite(m) && Number.isFinite(s));
        return { measure: name, rho: spearman(pairs.map((p) => p[0]), pairs.map((p) => p[1])), n: pairs.length };
      })
      .sort((a, b) => Math.abs(b.rho ?? 0) - Math.abs(a.rho ?? 0));
  }
}

if (flags.has('json')) {
  const boards = Object.fromEntries([...measured].map(([code, p]) => [code, Object.fromEntries(Object.entries(MEASURES).map(([n, m]) => [n, m(p)]))]));
  console.log(JSON.stringify({ report, boards }, null, 2));
} else {
  const fmt = (x) => (x === null || x === undefined ? '  —  ' : (x >= 0 ? ' ' : '') + x.toFixed(2));
  for (const set of sets) {
    for (const [signal, rows] of Object.entries(report[set])) {
      console.log(`\n${set}: ${signal} (Spearman, boards)`);
      for (const r of rows) console.log(`  ${r.measure.padEnd(14)} ${fmt(r.rho)}  n=${r.n}`);
    }
  }
  console.log('\nboards');
  const names = Object.keys(MEASURES);
  console.log(`  ${'code'.padEnd(22)}${names.map((n) => n.slice(0, 6).padStart(7)).join('')}`);
  for (const [code, p] of measured) {
    console.log(`  ${code.padEnd(22)}${names.map((n) => {
      const v = MEASURES[n](p);
      return (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : '—').padStart(7);
    }).join('')}`);
  }
}
