// The generator of levels from a plot (docs/superpowers/specs/2026-10-14-vi-level-generator-design.md; the plan
// docs/superpowers/plans/2026-10-28-vi-level-generator.md). A plot says which dice stand, which come and how, the
// events in their order and what the board is to teach; every board of it is laid backwards from its end
// (src/levels/layBack.ts), put through a funnel of checks from the cheapest (src/levels/plotJudge.ts), and the best
// that come through are measured on the scale of difficulty (src/levels/plotFinal.ts) and written as a batch of new
// boards (status N) that the workshop shows.
//
//   node scripts/lay.mjs plots                          the plots there are, each with its brief
//   node scripts/lay.mjs lay plot=wall                  lay a plot of src/levels/plots.ts
//   node scripts/lay.mjs lay from=act-k21 vary=rolls1   lay the plot read off a board (its way), varied: the same thought,
//                                                       other layouts; vary= rolls1 (a move more), link (one die more),
//                                                       face2-3 (2s become 3s), joined by commas
//     workers=6 limit=200000 seed=1 states=20000 upto=laid|path|lesson|final final=12 keep=5 dry loose json
//     (limit: layouts up to which every one is laid, more are sampled; final: boards measured in full, a dozen; keep: boards
//      written, five, of other shapes first; dry: only the size of the space; loose: write the best boards even where they miss a gate)
//     kind=insight idea="…" lemma="…" frame=5x3   the thought of the place over the plot's own (src/levels/plot.ts, PLOT_KINDS):
//      the kind orders the finalists after the gates and the troubles, the frame makes the field a rectangle, all go into the note
//   node scripts/lay.mjs lay solution=wall-loop         lay the solution an author wrote (boards/solutions/<name>.txt, the language of
//                                                       src/levels/solution.ts): its events in order, its faces and field; the
//                                                       thought is held against the row first, and a plot whose thought the row has
//                                                       had at 0.85 or more is not laid (force lays it all the same)
//   node scripts/lay.mjs thought solution=wall-loop     only that: the places the thought is like, and faces that would be new
//   node scripts/lay.mjs passport file=<board>          the passport of any board: the measures of the scale and how like
//                                                       the row it is
//
// What is asked for goes to stdout, progress to stderr. Codes: 0 boards written; 1 none came through; 2 the plot or
// the command could not be read; 3 the last two boards of the plot's batch the owner marked were both taken off.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const script = fileURLToPath(import.meta.url);
const root = resolve(dirname(script), '..');
const load = async (path) => (await runnerImport(path, { root, configFile: false, logLevel: 'error' })).module;

const COMMANDS = {
  plots: { keys: [], flags: ['json'] },
  lay: { keys: ['plot', 'from', 'solution', 'vary', 'workers', 'limit', 'seed', 'states', 'upto', 'final', 'keep', 'share', 'phase', 'runs', 'row', 'd', 'kind', 'idea', 'lemma', 'frame', 'strict'], flags: ['dry', 'loose', 'rejudge', 'json', 'force'] },
  thought: { keys: ['plot', 'solution', 'row'], flags: ['json'] },
  passport: { keys: ['file', 'plot', 'runs', 'row'], flags: ['json'] },
};

function refuse(what) {
  console.error(what);
  process.exit(2);
}

const [command, ...args] = process.argv.slice(2);
if (!Object.hasOwn(COMMANDS, command ?? '')) refuse(`${command ? `no command "${command}"` : 'no command'}: the commands are ${Object.keys(COMMANDS).join(', ')}`);
const { keys, flags } = COMMANDS[command];
const named = Object.fromEntries(args.filter((arg) => arg.includes('=')).map((arg) => [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)]));
const flag = (name) => args.includes(name);
for (const key of Object.keys(named)) if (!keys.includes(key)) refuse(`${command}: cannot read "${key}=": its keys are ${keys.map((name) => `${name}=`).join(', ') || 'none'}`);
for (const arg of args) if (!arg.includes('=') && !flags.includes(arg)) refuse(`${command}: cannot read "${arg}": its words are ${flags.join(', ') || 'none'}`);
const number = (key, fallback) => {
  if (named[key] === undefined) return fallback;
  if (!/^\d+$/.test(named[key])) refuse(`${command}: "${key}=${named[key]}" is not a number`);
  return Number(named[key]);
};

const { parseBoard, readBoardHead } = await load('/src/levels/boardFile.ts');
const { PLOTS } = await load('/src/levels/plots.ts');
const plotLib = await load('/src/levels/plot.ts');
const solutionLib = await load('/src/levels/solution.ts');
const final = await load('/src/levels/plotFinal.ts');

/** A board by a path or by its name in boards/. */
function boardOf(said) {
  const path = [resolve(process.cwd(), said), resolve(root, 'boards', `${said}.txt`)].find((candidate) => existsSync(candidate) && /\.txt$/i.test(candidate));
  if (!path) refuse(`${command}: no board ${said}`);
  const text = readFileSync(path, 'utf8');
  try {
    return { spec: parseBoard(text, path.slice(path.lastIndexOf('\\') + 1).replace(/^.*\//, '').replace(/\.txt$/i, '')), head: readBoardHead(text) };
  } catch (error) {
    return refuse(error.message);
  }
}

/** The vary= of a plot read off a board: `rolls1`, `link`, `face2-3`, joined by commas. */
function varyOf(text) {
  const vary = {};
  for (const word of (text ?? '').split(',').filter(Boolean)) {
    let m;
    if ((m = /^rolls(\d)$/.exec(word))) vary.rolls = Number(m[1]);
    else if (word === 'link' || word === 'die') vary.grow = word;
    else if ((m = /^face(\d)-(\d)$/.exec(word))) vary.face = { ...(vary.face ?? {}), [m[1]]: Number(m[2]) };
    else refuse(`lay: cannot read "vary=${word}": it is rolls1, link, face2-3`);
  }
  return vary;
}

/** The plot asked for: one of the list, or read off a board and varied. */
function plotAsked() {
  let plot;
  if (named.plot) {
    plot = PLOTS[named.plot];
    if (!plot) refuse(`${command}: no plot ${named.plot}: the plots are ${Object.keys(PLOTS).join(' ')}`);
  } else if (named.solution) {
    const path = [resolve(process.cwd(), named.solution), resolve(root, 'boards', 'solutions', `${named.solution}.txt`)].find((one) => existsSync(one) && /\.txt$/i.test(one));
    if (!path) refuse(`${command}: no solution ${named.solution} (boards/solutions/<name>.txt)`);
    try {
      plot = solutionLib.readSolution(readFileSync(path, 'utf8'), path.replace(/^.*[\\/]/, '').replace(/\.txt$/i, ''));
    } catch (error) {
      refuse(`${command}: ${error.message}`);
    }
  } else if (named.from) {
    try {
      plot = plotLib.plotOfBoard(boardOf(named.from).spec);
    } catch (error) {
      refuse(`${command}: ${error.message}`);
    }
  } else refuse(`${command}: name a plot, as in plot=wall, a solution, as in solution=wall-loop, or a board to read one off, as in from=act-k21`);
  if (named.vary) {
    plot = plotLib.varyPlot(plot, varyOf(named.vary));
    plot = { ...plot, name: `${plot.name}-${named.vary.replace(/(\d)-(\d)/g, '$1to$2').replace(/[^a-z0-9]+/g, '-')}` };
  }
  // d=lo-hi: the band of D the boards are to keep, over the plot's own (a plot read off a board says none).
  if (named.d !== undefined) {
    const band = /^(\d+(?:\.5)?)-(\d+(?:\.5)?)$/.exec(named.d);
    if (!band) refuse(`${command}: "d=${named.d}" is no band of D, as in d=3.5-5`);
    plot = { ...plot, want: { ...plot.want, d: [Number(band[1]), Number(band[2])] } };
  }
  // The thought of the place said on the line: kind, idea, lemma, and a frame that makes the field a rectangle.
  if (named.kind !== undefined) {
    if (!(named.kind in plotLib.PLOT_KINDS)) refuse(`${command}: "kind=${named.kind}" is none of ${Object.keys(plotLib.PLOT_KINDS).join(', ')}`);
    plot = { ...plot, kind: named.kind };
  }
  if (named.idea !== undefined) plot = { ...plot, idea: named.idea };
  if (named.lemma !== undefined) plot = { ...plot, lemma: named.lemma };
  if (named.frame !== undefined) {
    const frame = /^(\d)x(\d)$/.exec(named.frame);
    if (!frame) refuse(`${command}: "frame=${named.frame}" is no frame, as in frame=5x3`);
    plot = { ...plot, frame: { w: Number(frame[1]), h: Number(frame[2]) }, name: `${plot.name}-f${frame[1]}x${frame[2]}` };
  }
  plot = plotLib.framedPlot(plot);
  const faults = plotLib.checkPlot(plot);
  if (faults.length > 0) refuse(`${command}: the plot ${plot.name} does not hold together:\n${faults.join('\n')}`);
  return plot;
}

const print = (text, json) => console.log(flag('json') ? JSON.stringify(json, null, 2) : text);

/** Times a worker that falls before it says anything (a module that would not load on a busy machine) is started again. */
const WORKER_TRIES = 3;

/** Runs this script again in several processes, each taking its share of the work, and gives back what they print, line by line. */
function shareOut(extra, onLine) {
  const workers = Math.max(1, number('workers', Math.min(6, Math.max(1, availableParallelism() - 2))));
  const passed = process.argv.slice(2).filter((arg) => !/^(workers|share|phase)=/.test(arg));
  const run = (index, tries) =>
    new Promise((done, fail) => {
      const child = spawn(process.execPath, ['--max-old-space-size=4096', script, ...passed, ...extra, `share=${index}/${workers}`], { stdio: ['ignore', 'pipe', 'inherit'] });
      let rest = '';
      let said = false;
      child.stdout.on('data', (chunk) => {
        const lines = (rest + chunk).split('\n');
        rest = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          said = true;
          onLine(JSON.parse(line), index);
        }
      });
      child.on('error', fail);
      child.on('close', (code) => {
        if (code === 0) return done();
        // A worker that fell before it said a word has done nothing that would be counted twice: it is started again.
        if (!said && tries + 1 < WORKER_TRIES) {
          console.error(`lay: worker ${index} fell before it said anything (${code}); started again`);
          return run(index, tries + 1).then(done, fail);
        }
        fail(new Error(`a worker ended with ${code}`));
      });
    });
  return Promise.all(Array.from({ length: workers }, (_, index) => run(index, 0)));
}

/** The row of the campaign as the passports hold a board against it. */
async function rowBoards() {
  const { CAMPAIGN } = await load('/src/levels/campaign.ts');
  const { rowAfterRebuild } = await load('/src/levels/plots.ts');
  // A new board is new against the row as it stands (5 November 2026: the rebuild of 31–80 is in the row); row=rebuild asks
  // for the row as the rebuild of 31–100 began, the places up to 47 and the boards it kept.
  if (named.row !== undefined && !['now', 'rebuild'].includes(named.row)) refuse(`${command}: "row=${named.row}" is now or rebuild`);
  return final.rowBoardsOf(named.row === 'rebuild' ? rowAfterRebuild(CAMPAIGN) : CAMPAIGN);
}

const STAGES = ['laid', 'path', 'lesson', 'final'];

/** Strict, how many times the limit of layouts may be tried to lay so many that hold. */
const OVERDRAW = 20;

/**
 * What a plot's thought is like before a board of it is laid (src/levels/solution.ts): its core, the places of the row
 * it comes nearest whatever the layout, and, where the nearest is too like, faces that would be new. `shut` where the
 * nearest is at the gate of novelty of the passport (`TOO_LIKE`) or more and the plot asks to be new.
 */
async function thoughtOf(plot) {
  const { coreKey, SIMILAR_ROW } = await load('/src/levels/signature.ts');
  const core = solutionLib.plotCore(plot);
  const row = (await rowBoards()).map(({ code, number, core }) => ({ code, number, core }));
  const near = solutionLib.thoughtFloor(plot, row);
  const novel = plot.want?.novel !== false;
  const bound = solutionLib.thoughtBound(plot, row);
  const shut = novel && bound !== null && bound.sim >= final.TOO_LIKE;
  const lines = [
    `thought of ${plot.name}: ${core.route} on ${core.faces.join(', ') || '—'}${core.needs.length ? `, ${core.needs.join(' ')}` : ''}${core.alone ? `, one event: ${core.alone.dice} dice, ${core.alone.length}` : ''} (${coreKey(core)})`,
    `  like, whatever the layout: ${near.map((one) => `${one.code} (${one.number}) ${one.sim.toFixed(2)}`).join(', ') || 'none'}; ${bound ? `at the least ${bound.sim.toFixed(2)} (${bound.code})` : 'the least not known: the route is not said'}`,
  ];
  let free = [];
  if (near.length > 0 && near[0].sim >= SIMILAR_ROW) {
    free = solutionLib.freeFaces(plot, row, SIMILAR_ROW).slice(0, 5);
    lines.push(`  ${shut ? 'no board of it can be new' : near[0].sim >= final.TOO_LIKE ? `boards of it will hardly be new (${final.TOO_LIKE})` : `rule 17 warns at ${SIMILAR_ROW}`}; faces of the events under ${SIMILAR_ROW}: ${free.map((one) => `${one.faces.join(' ')} (${one.near} ${one.floor.toFixed(2)})`).join(', ') || 'none: the route is had whatever the faces'}`);
  }
  return { plot: plot.name, core, near, bound, shut, free, lines };
}

if (command === 'plots') {
  const rows = Object.values(PLOTS).map((plot) => {
    const [lo, hi] = plotLib.plotLength(plot);
    return { name: plot.name, size: plot.size, dice: plot.dice.length, moves: lo === hi ? `${lo}` : `${lo}-${hi}`, brief: plot.brief ?? '' };
  });
  print(rows.map((row) => `${row.name.padEnd(18)} ${row.size}x${row.size} dice ${String(row.dice).padStart(2)} moves ${row.moves.padEnd(5)} ${row.brief}`).join('\n'), rows);
} else if (command === 'passport') {
  if (!named.file) refuse('passport: name a board, as in file=act-k21');
  const { spec } = boardOf(named.file);
  const plot = named.plot ? PLOTS[named.plot] ?? refuse(`passport: no plot ${named.plot}`) : null;
  const passport = final.passportOf(plot, spec, { runs: number('runs', 30), row: await rowBoards() });
  print(final.passportLine(spec.id, passport), passport);
} else if (command === 'thought') {
  const plot = plotAsked();
  const said = await thoughtOf(plot);
  print(said.lines.join('\n'), said);
} else if (command === 'lay') {
  const plot = plotAsked();
  // The thought before the layouts: a plot whose route and faces the row has had shuts the gate of novelty for every board of it.
  if (named.share === undefined) {
    const said = await thoughtOf(plot);
    console.error(said.lines.join('\n'));
    if (said.shut && !flag('force') && !flag('rejudge')) {
      console.error(`lay: not laid: no board of ${plot.name} can be new (force lays it all the same)`);
      process.exit(1);
    }
  }
  const out = resolve(root, 'boards', 'out', 'lay', plot.name);
  const faces = plot.dice.map((die) => die.face);
  const boardsDir = resolve(root, 'boards');
  const writtenPath = resolve(out, 'written.json');

  /** The boards of the plot's batch so far, as the owner marked them in the workshop: good (RC), to be done (D), off (X). */
  function batchState() {
    const ours = readdirSync(boardsDir)
      .filter((file) => file.endsWith('.txt'))
      .flatMap((file) => {
        const text = readFileSync(resolve(boardsDir, file), 'utf8');
        const head = readBoardHead(text);
        if (!head.batch || head.batch.split(' ')[0] !== plot.name) return [];
        const name = file.slice(0, -'.txt'.length);
        return [{ name, status: head.status ?? 'N', number: Number(name.slice(plot.name.length + 1)) || 0, spec: parseBoard(text, name) }];
      });
    if (final.twoOff(ours)) {
      console.log(`lay ${plot.name}: the last two boards of its batch the owner marked were both taken off — ask him about the plot itself`);
      process.exit(3);
    }
    const writtenBefore = existsSync(writtenPath) ? JSON.parse(readFileSync(writtenPath, 'utf8')) : {};
    return {
      writtenBefore,
      playedKeys: new Set(ours.map((one) => final.boardKey(one.spec))),
      offShapes: new Set(ours.filter((one) => one.status === 'X' && writtenBefore[one.name]).map((one) => writtenBefore[one.name].shape)),
      liked: ours.filter((one) => one.status === 'RC' && writtenBefore[one.name]).map((one) => writtenBefore[one.name].passport),
    };
  }

  /**
   * The measured finalists put in order and the best that hold every gate written as the batch (with `loose`, the best
   * whatever they miss); the passports and a line of the report for the stage. Gives back the order and what was written.
   */
  async function writeBatch(measured, round, liked, writtenBefore, lines, from, after) {
    const ranked = final.rankPassports(measured, plot.want, liked, plot.kind);
    const holding = ranked.filter((one) => one.passport.misses.length === 0);
    lines.push(`3 final   ${from}${holding.length} hold every gate   ${after}`);
    const misses = {};
    for (const one of ranked) for (const miss of one.passport.misses) misses[miss.replace(/[\d.]+/g, '#')] = (misses[miss.replace(/[\d.]+/g, '#')] ?? 0) + 1;
    if (Object.keys(misses).length) lines.push(`  gates missed: ${Object.entries(misses).sort((a, b) => b[1] - a[1]).map(([miss, n]) => `${miss} ${n}`).join('; ')}`);
    const playedKeys = batchState().playedKeys;
    // Five of a dozen, of other shapes first: the owner plays them blind, one by one (his answer of 13 October).
    const toWrite = final.otherShapesFirst((flag('loose') ? ranked : holding).filter((one) => !playedKeys.has(final.boardKey(one.spec))), number('keep', 5));
    const { batchFile, batchTaken } = await load('/src/levels/labText.ts');
    const histories = existsSync(resolve(boardsDir, '.history')) ? readdirSync(resolve(boardsDir, '.history')) : [];
    const taken = batchTaken(readdirSync(boardsDir), histories);
    const date = new Date().toISOString().slice(0, 10);
    const written = [];
    for (const one of toWrite) {
      const p = one.passport;
      const spec = { ...one.spec, faces: plot.faces ?? [...new Set(faces.filter((face) => face !== 1))].sort((a, b) => a - b), par: p.par, exact: true, solution: p.way };
      const { name, text } = batchFile(spec, plot.name, taken, date, `замысел ${plot.name}, круг ${round}${plot.brief ? `: ${plot.brief}` : ''}${plotLib.thoughtLine(plot) ? `; ${plotLib.thoughtLine(plot)}` : ''}`);
      taken.push(name);
      writeFileSync(resolve(boardsDir, `${name}.txt`), text);
      written.push({ name, passport: p });
      writtenBefore[name] = { passport: p, shape: one.shape, round };
    }
    writeFileSync(writtenPath, JSON.stringify(writtenBefore));
    const passports = ranked.map((one, at) => final.passportLine(written.find((w) => w.passport === one.passport)?.name ?? `#${at + 1}`, one.passport));
    writeFileSync(resolve(out, `passport-${round}.txt`), passports.join('\n') + '\n');
    writeFileSync(resolve(out, `passport-${round}.json`), JSON.stringify(ranked.map((one) => one.passport), null, 1));
    lines.push(...written.map((w) => `  ${final.passportLine(w.name, w.passport)}`));
    return { ranked, written };
  }

  if (flag('rejudge')) {
    // The last round measured, read against the gates of the plot as they are now: nothing is laid or measured again.
    const rounds = existsSync(out) ? readdirSync(out).flatMap((file) => /^measured-(\d+)\.json$/.exec(file)?.slice(1).map(Number) ?? []) : [];
    if (rounds.length === 0) refuse(`lay: no round of ${plot.name} was measured whole yet (measured-<k>.json): lay it first`);
    const round = Math.max(...rounds);
    const row = await rowBoards();
    const measured = JSON.parse(readFileSync(resolve(out, `measured-${round}.json`), "utf8")).map((one) => {
      const passport = { ...one.passport, ...final.kinOf(plot, { ...one.spec, par: one.passport.par, solution: one.passport.way }, row) };
      return { ...one, passport: { ...passport, misses: final.missesOf(plot.want, passport) } };
    });
    const { writtenBefore, liked } = batchState();
    const lines = [`lay ${plot.name}, round ${round} judged again against the gates as they are now`];
    const { written } = await writeBatch(measured, round, liked, writtenBefore, lines, `${measured.length} → `, '');
    lines.push(`written: ${written.length}`);
    writeFileSync(resolve(out, `rejudge-${round}.txt`), lines.join('\n') + '\n');
    print(lines.join('\n'), { plot: plot.name, round, written: written.map((w) => w.name) });
    process.exit(written.length === 0 ? 1 : 0);
  }

  const { layBack, indexOrder } = await load('/src/levels/layBack.ts');
  const { judgeLaid } = await load('/src/levels/plotJudge.ts');
  const seed = number('seed', 1);
  const limit = number('limit', 200_000);
  const upto = named.upto ?? 'final';
  if (!STAGES.includes(upto)) refuse(`lay: "upto=${upto}" is none of ${STAGES.join(', ')}`);
  // Strict (src/levels/layBack.ts): a die goes to its event over cells free then; the default for a solution, strict=0 or 1 says.
  if (named.strict !== undefined && !['0', '1'].includes(named.strict)) refuse(`lay: "strict=${named.strict}" is 0 or 1`);
  const strict = named.strict !== undefined ? named.strict === '1' : named.solution !== undefined;
  const space = layBack(plot, { seed, strict });
  const sampled = space.sampled || space.total > limit;

  if (named.share !== undefined && named.phase === 'final') {
    // A worker of the last stage: the finalists of its share measured in full.
    const [index, of] = named.share.split('/').map(Number);
    const finalists = JSON.parse(readFileSync(resolve(out, 'finalists.json'), 'utf8'));
    const row = await rowBoards();
    finalists.forEach((one, at) => {
      if (at % of !== index) return;
      const passport = final.passportOf(plot, one.spec, { runs: number('runs', 30), row, longestDetour: one.longestDetour ?? 0 });
      console.log(JSON.stringify({ at, passport }));
    });
  } else if (named.share !== undefined) {
    // A worker of the funnel: its share of the layouts, laid and judged up to the lesson.
    const [index, of] = named.share.split('/').map(Number);
    // Strict, a layout that does not hold is not counted to the limit: up to OVERDRAW times as many are tried.
    const indices = sampled ? indexOrder(space.total, seed, strict ? Math.min(space.total, limit * OVERDRAW) : limit) : null;
    const count = indices ? indices.length : space.total;
    const mine = Math.ceil(limit / of);
    let held = 0;
    const seen = new Set();
    const tally = { laid: 0, stage: [0, 0, 0, 0], reasons: {} };
    const near = [];
    let last = Date.now();
    const say = () => console.log(JSON.stringify({ type: 'tally', tally, near }));
    for (let at = index; at < count; at += of) {
      const which = indices ? indices[at] : at;
      const laid = space.at(which);
      tally.laid++;
      if (!laid) {
        tally.reasons['0 cells meet'] = (tally.reasons['0 cells meet'] ?? 0) + 1;
        continue;
      }
      if (strict && sampled && ++held > mine) break;
      const judged = judgeLaid(plot, laid, { states: number('states', 20_000), seen, upto: upto === 'final' ? 'lesson' : upto });
      for (let stage = 0; stage < judged.stage; stage++) tally.stage[stage]++;
      if (judged.reason) {
        const key = `${judged.stage} ${judged.reason}`;
        tally.reasons[key] = (tally.reasons[key] ?? 0) + 1;
        // The nearest of those that fail: the ones that went farthest, a few of each stage.
        if (judged.stage >= 1 && near.filter((one) => one.stage === judged.stage).length < 3) near.push({ stage: judged.stage, reason: judged.reason, detail: judged.detail ?? '', spec: laid.spec });
      } else {
        const spec = laid.spec;
        const keeps = (judged.lessons ?? []).find((lesson) => lesson.kind === 'keeps');
        console.log(JSON.stringify({ type: 'pass', order: ((which * 2654435761) >>> 0) ^ seed, spec, uses: judged.uses ?? [], shape: final.shapeOf(spec, final.sidesOf(spec, faces)), longestDetour: keeps?.longestDetour ?? 0 }));
      }
      if (Date.now() - last > 2000) {
        say();
        tally.laid = 0;
        tally.stage = [0, 0, 0, 0];
        tally.reasons = {};
        near.length = 0;
        last = Date.now();
      }
    }
    say();
  } else {
    // The main process: the size of the space, the funnel shared out, the finalists measured, the batch written.
    const count = sampled ? Math.min(limit, space.total) : space.total;
    const head = `lay ${plot.name}, ${sampled ? `sampled ${count} of ${space.total}` : `every layout: ${space.total}`}${strict ? `, strict${sampled ? ` (up to ${Math.min(space.total, limit * OVERDRAW)} tried)` : ''}` : ''}`;
    if (flag('dry')) {
      print(head, { plot: plot.name, total: space.total, sampled, count });
      process.exit(0);
    }
    mkdirSync(out, { recursive: true });
    // What the batch is laid from, so that the workshop can ask for ten more of it.
    writeFileSync(resolve(out, 'args.json'), JSON.stringify({ args: ['plot', 'from', 'solution', 'vary', 'kind', 'idea', 'lemma', 'frame'].filter((key) => named[key] !== undefined).map((key) => `${key}=${named[key]}`) }));
    const round = readdirSync(out).filter((file) => /^report-\d+\.txt$/.test(file)).length + 1;
    const { writtenBefore, playedKeys, offShapes, liked } = batchState();
    const began = Date.now();
    const sum = { laid: 0, stage: [0, 0, 0, 0], reasons: {} };
    const passed = [];
    const seen = new Set();
    const near = [];
    let told = Date.now();
    await shareOut(['phase=funnel'], (line) => {
      if (line.type === 'pass') {
        const key = final.boardKey(line.spec);
        // A board of the batch already, or of a shape the owner took off, is not given again.
        if (seen.has(key) || playedKeys.has(key) || offShapes.has(line.shape)) return;
        seen.add(key);
        passed.push(line);
      } else if (line.type === 'tally') {
        sum.laid += line.tally.laid;
        line.tally.stage.forEach((n, stage) => (sum.stage[stage] += n));
        for (const [reason, n] of Object.entries(line.tally.reasons)) sum.reasons[reason] = (sum.reasons[reason] ?? 0) + n;
        near.push(...line.near);
      }
      if (Date.now() - told > 5000) {
        const seconds = (Date.now() - began) / 1000;
        console.error(`lay ${plot.name}: ${sum.laid} of ${count} laid, ${sum.stage.slice(0, 3).join(' / ')} through stages 0/1/2, ${Math.round(sum.laid / seconds)} a second`);
        told = Date.now();
      }
    });
    const funnelSeconds = (Date.now() - began) / 1000;
    const lines = [`${head} in ${funnelSeconds.toFixed(0)} s, round ${round}`];
    const reasonsAt = (prefix) =>
      Object.entries(sum.reasons)
        .filter(([reason]) => reason.startsWith(prefix))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([reason, n]) => `${reason.slice(prefix.length)} ${n}`)
        .join('; ');
    lines.push(`0 layout  ${sum.laid} → ${sum.stage[0]}   ${reasonsAt('0 ')}`);
    lines.push(`1 way     ${sum.stage[0]} → ${sum.stage[1]}   ${reasonsAt('1 ')}`);
    lines.push(`2 lesson  ${sum.stage[1]} → ${sum.stage[2]}   ${reasonsAt('2 ')}`);
    // What every board through the way leans on is a finding a random laying could not say.
    if (passed.length > 0) {
      const common = ['link', 'glass', 'floor', 'ones'].filter((use) => passed.every((one) => one.uses.includes(use)));
      if (common.length) lines.push(`findings: every board through the lesson leans on ${common.join(', ')}`);
    } else lines.push(`findings: no board came through stage ${sum.stage[1] === 0 ? 1 : 2}`);

    let written = [];
    let ranked = [];
    if (upto === 'final' && passed.length > 0) {
      const finalists = final.pickFinalists(passed, number('final', 12));
      writeFileSync(resolve(out, 'finalists.json'), JSON.stringify(finalists.map((one) => ({ spec: one.spec, longestDetour: one.longestDetour }))));
      const shapes = new Set(passed.map((one) => one.shape)).size;
      const measured = [];
      const finalBegan = Date.now();
      await shareOut(['phase=final'], (line) => {
        measured.push({ ...finalists[line.at], passport: line.passport });
        console.error(`lay ${plot.name}: ${measured.length} of ${finalists.length} finalists measured`);
      });
      // The finalists with their passports, kept whole: `rejudge` reads them against gates said again, without laying anew.
      writeFileSync(resolve(out, `measured-${round}.json`), JSON.stringify(measured.map(({ spec, shape, longestDetour, passport }) => ({ spec, shape, longestDetour, passport }))));
      ({ ranked, written } = await writeBatch(measured, round, liked, writtenBefore, lines, `${finalists.length} → `, `(${shapes} shapes; ${((Date.now() - finalBegan) / 1000).toFixed(0)} s)`));
    }
    if (written.length === 0) {
      const nearest = [...near].sort((a, b) => b.stage - a.stage).slice(0, 3);
      if (nearest.length) lines.push('nearest of those that failed:', ...nearest.map((one) => `  stage ${one.stage}: ${one.reason} ${one.detail}`));
    }
    lines.push(`written: ${written.length} (${((Date.now() - began) / 1000).toFixed(0)} s)`);
    writeFileSync(resolve(out, `report-${round}.txt`), lines.join('\n') + '\n');
    print(lines.join('\n'), { plot: plot.name, round, total: space.total, sampled, funnel: sum, written: written.map((w) => w.name), passports: ranked.map((one) => one.passport) });
    if (written.length === 0) process.exitCode = 1;
  }
}
