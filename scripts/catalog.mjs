// The catalog of boards (docs/superpowers/specs/2026-11-05-vi-board-catalog-design.md): the machine lays every plot we
// have with its variations, measures the finalists by the passport and keeps them in boards/catalog/; an agent or a
// person asks it for boards instead of laying them round and round.
//
//   node scripts/catalog.mjs run hours=3 workers=3       lay the works not yet done, a process to each, three at a time;
//                                                        after the hours no new work starts, those begun are finished.
//     source=solution|plot|row|recipe step=0-4 jobs=N    only these works; at most N of them
//   node scripts/catalog.mjs find kind=polish faces=2,4 D=6-7 par=5-8 near<0.75 troubles=0 holds top=20 json
//     keys: kind faces faces~ D par dice forks ways frame=5x4 size fixed floor=open|shut near< troubles holds source base top;
//     how like the row a board is, is read now against the row as it stands (row=rebuild: as the rebuild began)
//   node scripts/catalog.mjs take key=<10 signs> name=<word>   the board written as boards/<word>-<n>.txt, status N
//   node scripts/catalog.mjs stats                       boards and works, by source, kind and D
//   node scripts/catalog.mjs jobs                        the works there are and how many are done
//   node scripts/catalog.mjs job id=<work>               one work (what `run` starts): lines of JSON to stdout
//
// Codes: 0 done; 1 nothing found; 2 the command could not be read.
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const script = fileURLToPath(import.meta.url);
const root = resolve(dirname(script), '..');
const load = async (path) => (await runnerImport(path, { root, configFile: false, logLevel: 'error' })).module;
const catalogDir = resolve(root, 'boards', 'catalog');
const journalPath = resolve(catalogDir, 'jobs.jsonl');
const SOURCES = ['solution', 'plot', 'row', 'recipe'];

/** The funnel of a work is cut after this, and the finalists are picked of what came through. */
const FUNNEL_MINUTES = 4;
/** A funnel with no board through the way after this is cut. */
const HOPELESS_SECONDS = 90;

/** A work that runs longer than this is stopped and journalled as such, so that a run never waits on it again. */
const JOB_MINUTES = 20;

function refuse(what) {
  console.error(what);
  process.exit(2);
}

const COMMANDS = {
  run: { keys: ['hours', 'workers', 'source', 'step', 'jobs'], flags: [] },
  job: { keys: ['id'], flags: [] },
  find: { keys: null, flags: ['json'] },
  take: { keys: ['key', 'name'], flags: [] },
  stats: { keys: [], flags: ['json'] },
  jobs: { keys: ['source', 'step'], flags: ['json'] },
};

const [command, ...args] = process.argv.slice(2);
if (!Object.hasOwn(COMMANDS, command ?? '')) refuse(`${command ? `no command "${command}"` : 'no command'}: the commands are ${Object.keys(COMMANDS).join(', ')}`);
const { keys, flags } = COMMANDS[command];
const flag = (name) => args.includes(name);
const named = Object.fromEntries(args.filter((arg) => /^[a-z]+=/i.test(arg)).map((arg) => [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)]));
if (keys) {
  for (const key of Object.keys(named)) if (!keys.includes(key)) refuse(`${command}: cannot read "${key}=": its keys are ${keys.map((k) => `${k}=`).join(', ') || 'none'}`);
  for (const arg of args) if (!arg.includes('=') && !flags.includes(arg)) refuse(`${command}: cannot read "${arg}"`);
}
const number = (key, fallback) => {
  if (named[key] === undefined) return fallback;
  if (!/^\d+(\.\d+)?$/.test(named[key])) refuse(`${command}: "${key}=${named[key]}" is not a number`);
  return Number(named[key]);
};

const catalog = await load('/src/levels/catalog.ts');
const jobsLib = await load('/src/levels/catalogJobs.ts');

/**
 * The plots read off the boards of the row, kept in boards/out (not in git) by the board and its way: a few boards take
 * a minute to read, and every `run` and `jobs` reads them all.
 */
const rowPlotsPath = resolve(root, 'boards', 'out', 'catalog-row-plots.json');
async function rowPlotReader() {
  const { plotOfBoard } = await load('/src/levels/plot.ts');
  const kept = existsSync(rowPlotsPath) ? JSON.parse(readFileSync(rowPlotsPath, 'utf8')) : {};
  let added = false;
  const reader = (spec) => {
    const key = JSON.stringify([spec.size, spec.holes ?? [], spec.floor ?? true, spec.layout, spec.solution ?? []]);
    if (!kept[key]) {
      try {
        kept[key] = { plot: plotOfBoard(spec) };
      } catch (error) {
        kept[key] = { fault: error.message };
      }
      added = true;
    }
    if (kept[key].fault) throw new Error(kept[key].fault);
    return structuredClone(kept[key].plot);
  };
  const save = () => {
    if (!added) return;
    mkdirSync(dirname(rowPlotsPath), { recursive: true });
    writeFileSync(rowPlotsPath, JSON.stringify(kept));
  };
  return { reader, save };
}

/** Every work, in the order a run takes them; with `only`, the works of that base alone. */
async function allJobs(only) {
  const { PLOTS } = await load('/src/levels/plots.ts');
  const { CAMPAIGN } = await load('/src/levels/campaign.ts');
  const { PLACES } = await load('/src/levels/recipes.ts');
  const { ROAD_PLACES } = await load('/src/levels/roadRecipes.ts');
  const { CAMPAIGN_PLACES } = await load('/src/levels/campaignRecipes.ts');
  const dir = resolve(root, 'boards', 'solutions');
  const solutions = readdirSync(dir)
    .filter((file) => file.endsWith('.txt'))
    .sort()
    .map((file) => ({ name: file.slice(0, -4), text: readFileSync(resolve(dir, file), 'utf8') }));
  const { reader, save } = await rowPlotReader();
  const jobs = jobsLib.catalogJobs({ solutions, plots: PLOTS, row: CAMPAIGN, recipes: [...PLACES, ...ROAD_PLACES, ...CAMPAIGN_PLACES], rowPlot: reader, ...(only ? { only } : {}) });
  save();
  return jobs;
}

/** The works asked for by source= and step=. */
function picked(jobs) {
  let out = jobs;
  if (named.source !== undefined) {
    if (!SOURCES.includes(named.source)) refuse(`${command}: "source=${named.source}" is none of ${SOURCES.join(', ')}`);
    out = out.filter((job) => job.source === named.source);
  }
  if (named.step !== undefined) {
    const m = /^(\d)(?:-(\d))?$/.exec(named.step);
    if (!m) refuse(`${command}: "step=${named.step}" is a step or steps, as in step=0 or step=0-2`);
    const [lo, hi] = [Number(m[1]), Number(m[2] ?? m[1])];
    out = out.filter((job) => job.step >= lo && job.step <= hi);
  }
  return out;
}

const readText = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : '');

/** Every board of the catalog, of this version. */
function allEntries() {
  if (!existsSync(catalogDir)) return [];
  return readdirSync(catalogDir)
    .filter((file) => file.endsWith('.jsonl') && file !== 'jobs.jsonl')
    .sort()
    .flatMap((file) => catalog.readLines(readText(resolve(catalogDir, file))));
}

const journal = () => catalog.readLines(readText(journalPath));

async function rowBoards() {
  const { CAMPAIGN } = await load('/src/levels/campaign.ts');
  const { rowAfterRebuild } = await load('/src/levels/plots.ts');
  const { rowBoardsOf } = await load('/src/levels/plotFinal.ts');
  if (named.row !== undefined && !['now', 'rebuild'].includes(named.row)) refuse(`${command}: "row=${named.row}" is now or rebuild`);
  return rowBoardsOf(named.row === 'rebuild' ? rowAfterRebuild(CAMPAIGN) : CAMPAIGN);
}

const out = (line) => process.stdout.write(`${JSON.stringify(line)}\n`);

if (command === 'job') {
  // One work: the funnel, then a passport to each finalist, every board a line as soon as it is measured.
  const said = /^([a-z]+):(.+):([^:@]+)@\d+$/.exec(named.id ?? '');
  if (!said) refuse(`job: "id=${named.id}" is no work, as in id=solution:wall-loop:as@1`);
  const job = (await allJobs({ source: said[1], base: said[2] })).find((one) => one.id === named.id);
  if (!job) refuse(`job: no work ${named.id}`);
  const began = Date.now();
  const { passportOf } = await load('/src/levels/plotFinal.ts');
  const known = new Set(allEntries().map((entry) => entry.key));
  const cut = Date.now() + FUNNEL_MINUTES * 60_000;
  // A funnel that has let no board through the way in its first minute and a half will hardly do so later: it ends.
  const hopeless = began + HOPELESS_SECONDS * 1000;
  const { tally, finalists } = catalog.funnelOf(job, { known, stop: (so) => Date.now() > cut || (so.path === 0 && Date.now() > hopeless) });
  const funnelSeconds = Math.round((Date.now() - began) / 1000);
  const row = await rowBoards();
  const passportSeconds = [];
  for (const finalist of finalists) {
    const at = Date.now();
    const passport = passportOf(job.plot ?? null, finalist.spec, { runs: 30, row, longestDetour: finalist.longestDetour });
    out({ type: 'entry', entry: catalog.entryOf(job, finalist, passport) });
    passportSeconds.push(Math.round((Date.now() - at) / 1000));
  }
  out({ type: 'done', line: { v: jobsLib.CATALOG_VERSION, job: job.id, tally, finalists: finalists.length, written: passportSeconds.length, seconds: Math.round((Date.now() - began) / 1000), funnelSeconds, passportSeconds } });
} else if (command === 'run') {
  mkdirSync(catalogDir, { recursive: true });
  const hours = number('hours', 3);
  const workers = Math.max(1, number('workers', 3));
  const deadline = Date.now() + hours * 3600_000;
  const done = new Set(journal().map((line) => line.job));
  let pending = picked(await allJobs()).filter((job) => !done.has(job.id));
  if (named.jobs !== undefined) pending = pending.slice(0, number('jobs', pending.length));
  const began = Date.now();
  const sum = { jobs: 0, boards: 0, laid: 0, lesson: 0, faults: 0 };
  console.error(`catalog run: ${pending.length} works to do, ${done.size} done before; ${workers} at a time for ${hours} h`);
  const keep = (line) => appendFileSync(journalPath, `${catalog.lineText(line)}\n`);
  // The works whose plot does not hold are journalled at once: nothing to lay.
  for (const job of pending.filter((one) => one.fault)) {
    keep({ v: jobsLib.CATALOG_VERSION, job: job.id, tally: { laid: 0, path: 0, lesson: 0, reasons: {} }, finalists: 0, written: 0, seconds: 0, fault: job.fault });
    sum.faults++;
  }
  const queue = pending.filter((one) => !one.fault);
  const runOne = (job) =>
    new Promise((resolveJob) => {
      const child = spawn(process.execPath, ['--max-old-space-size=4096', script, 'job', `id=${job.id}`], { stdio: ['ignore', 'pipe', 'pipe'] });
      let rest = '';
      let finished = false;
      let errors = '';
      const timer = setTimeout(() => child.kill(), JOB_MINUTES * 60_000);
      child.stderr.on('data', (chunk) => (errors = (errors + chunk).slice(-2000)));
      child.stdout.on('data', (chunk) => {
        const lines = (rest + chunk).split('\n');
        rest = lines.pop();
        for (const text of lines) {
          if (!text.trim()) continue;
          const line = JSON.parse(text);
          if (line.type === 'entry') {
            appendFileSync(resolve(catalogDir, `${line.entry.source}.jsonl`), `${catalog.lineText(line.entry)}\n`);
            sum.boards++;
          } else if (line.type === 'done') {
            keep(line.line);
            finished = true;
            sum.laid += line.line.tally.laid;
            sum.lesson += line.line.tally.lesson;
          }
        }
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        sum.jobs++;
        if (!finished) {
          // A work that fell or ran past its time is journalled with why, so that no run waits on it again.
          keep({ v: jobsLib.CATALOG_VERSION, job: job.id, tally: { laid: 0, path: 0, lesson: 0, reasons: {} }, finalists: 0, written: 0, seconds: 0, fault: code === null ? `stopped after ${JOB_MINUTES} min` : `fell (${code}): ${errors.trim().split('\n').slice(-1)[0] ?? ''}` });
          sum.faults++;
        }
        const minutes = ((Date.now() - began) / 60_000).toFixed(0);
        console.error(`catalog run: ${minutes} min, ${sum.jobs} of ${queue.length} works, ${sum.boards} boards, ${sum.lesson} through the lesson; ${job.id}${finished ? '' : ' FAILED'}`);
        resolveJob();
      });
    });
  let next = 0;
  const slot = async () => {
    while (next < queue.length && Date.now() < deadline) await runOne(queue[next++]);
  };
  await Promise.all(Array.from({ length: workers }, slot));
  console.log(`catalog run: ${sum.jobs} works in ${((Date.now() - began) / 60_000).toFixed(0)} min, ${sum.boards} boards written, ${sum.laid} layouts laid, ${sum.lesson} through the lesson, ${sum.faults} works laid nothing for a fault; ${queue.length - next} left`);
} else if (command === 'find') {
  const words = args.filter((arg) => arg !== 'json' && !arg.startsWith('row='));
  let query;
  try {
    query = catalog.parseQuery(words);
  } catch (error) {
    refuse(`find: ${error.message}`);
  }
  const entries = allEntries();
  const found = catalog.findBoards(entries, query, await rowBoards());
  if (flag('json')) console.log(JSON.stringify(found.map((one) => ({ key: catalog.shortKey(one.entry), ...one })), null, 1));
  else {
    console.log(found.map(catalog.foundLine).join('\n'));
    console.error(`find: ${found.length} of ${entries.length} boards of the catalog`);
  }
  if (found.length === 0) process.exitCode = 1;
} else if (command === 'take') {
  if (!named.key || !named.name) refuse('take: key=<the ten signs find gives> name=<the word of the file>');
  if (!/^[a-z][a-z0-9-]*$/.test(named.name)) refuse(`take: "name=${named.name}" is no word of a file, as in name=wall`);
  const entry = allEntries().find((one) => catalog.shortKey(one) === named.key);
  if (!entry) refuse(`take: no board ${named.key} in the catalog`);
  const { batchFile, batchTaken } = await load('/src/levels/labText.ts');
  const boardsDir = resolve(root, 'boards');
  const histories = existsSync(resolve(boardsDir, '.history')) ? readdirSync(resolve(boardsDir, '.history')) : [];
  const taken = batchTaken(readdirSync(boardsDir), histories);
  const thought = [entry.kind ? `вид ${entry.kind}` : '', entry.idea ?? '', entry.lemma ? `лемма: ${entry.lemma}` : ''].filter(Boolean).join('; ');
  const note = `каталог ${entry.source}:${entry.base}:${entry.vary}, ключ ${named.key}${thought ? `; ${thought}` : ''}`;
  const { name, text } = batchFile(entry.spec, named.name, taken, new Date().toISOString().slice(0, 10), note);
  writeFileSync(resolve(boardsDir, `${name}.txt`), text);
  console.log(`take: boards/${name}.txt`);
} else if (command === 'stats') {
  const entries = allEntries();
  const lines = journal();
  const sum = (key) => lines.reduce((total, line) => total + (line.tally?.[key] ?? 0), 0);
  const stats = {
    boards: entries.length,
    jobs: lines.length,
    faults: lines.filter((line) => line.fault).length,
    laid: sum('laid'),
    path: sum('path'),
    lesson: sum('lesson'),
    bySource: catalog.countBy(entries, (entry) => entry.source),
    byKind: catalog.countBy(entries, (entry) => entry.kind ?? '-'),
    byD: catalog.countBy(entries, (entry) => `D${String(Math.floor(entry.p.d)).padStart(2, '0')}`),
    byFaces: catalog.countBy(entries, (entry) => entry.field.faces.join('') || '-'),
    byVary: catalog.countBy(entries, (entry) => entry.vary.replace(/^face.*/, 'face').replace(/^f\d+x\d+$/, 'frame')),
  };
  if (flag('json')) console.log(JSON.stringify(stats, null, 1));
  else
    console.log(
      [
        `boards ${stats.boards}; works ${stats.jobs} (${stats.faults} laid nothing for a fault); layouts ${stats.laid}, through the way ${stats.path}, through the lesson ${stats.lesson}`,
        `by source: ${stats.bySource}`,
        `by kind: ${stats.byKind}`,
        `by D: ${stats.byD}`,
        `by faces: ${stats.byFaces}`,
        `by variation: ${stats.byVary}`,
      ].join('\n'),
    );
} else if (command === 'jobs') {
  const jobs = picked(await allJobs());
  const done = new Set(journal().map((line) => line.job));
  const by = (keyOf) => catalog.countBy(jobs, keyOf);
  const said = { jobs: jobs.length, done: jobs.filter((job) => done.has(job.id)).length, faults: jobs.filter((job) => job.fault).length, bySource: by((job) => job.source), byStep: by((job) => `step ${job.step}`) };
  console.log(flag('json') ? JSON.stringify(said, null, 1) : `works ${said.jobs}, done ${said.done}, plot does not hold ${said.faults}\nby source: ${said.bySource}\nby step: ${said.byStep}`);
}
