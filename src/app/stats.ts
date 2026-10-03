import { ruleKey, type ExperimentConfig, type RunState } from '../rules';
import { formatTime } from '../ui/dom';

/** Plain-text summary of a run for the playtest panel. */
export function statsText(state: RunState): string {
  const { config, stats } = state;
  const ms = (ticks: number) => ticks * config.tickMs;
  const seconds = (ticks: number) => (ms(ticks) / 1000).toFixed(1) + 's';
  const flags = (Object.keys(config.experiments) as (keyof ExperimentConfig)[]).filter((k) => config.experiments[k]);
  // One entry for a level: how long it lasted, how many cubes came and how many were removed.
  const levels = stats.levels.map((l, i) => `${i + 1}: ${seconds(l.ticks)} +${l.spawned} -${l.removed}`);
  // A run changes its chain window with the level; a tutorial and a puzzle keep one of their own.
  const paced = state.mode === 'endless' || state.mode === 'timed';
  const sink = paced ? `${ms(config.sinkStartTicks)} to ${ms(config.sinkFloorTicks)}` : `${ms(config.sinkingTicks)}`;
  return [
    `VI · rules ${ruleKey(config)} · ${state.mode} · seed ${state.seed}`,
    `time ${formatTime(state.tick, config.tickMs)} · score ${state.score} · max chain x${state.maxChain} · best chain score ${stats.bestChainScore} · level ${state.level}`,
    `first clears: ${stats.clearTicks.length > 0 ? stats.clearTicks.map(seconds).join(', ') : '-'}`,
    `clears ${stats.clears} · steps ${stats.steps} · blocked ${stats.blockedSteps}`,
    `ground time ${seconds(stats.groundTicks)} · falls ${stats.falls} · removed ${state.removed}`,
    `climbs from the floor ${stats.floorClimbs} · steps down to a dock ${stats.dockDescents} · climbs from a dock ${stats.dockClimbs}`,
    `danger time ${seconds(stats.dangerTicks)} · longest chain silence ${seconds(stats.longestChainQuiet)}`,
    `levels (time +came -removed): ${levels.length > 0 ? levels.join(' · ') : '-'}`,
    `flags: ${flags.length > 0 ? flags.join(', ') : 'none'}${config.custom ? ' · custom variables' : ''}`,
    `step ${ms(config.actionTicks)} · warn ${ms(config.warnTicks)} · rise ${ms(config.risingTicks)} · sink ${sink} ms`,
    `pace ${config.paceStartMs} x${config.paceRatio}/lvl, min ${config.paceMinMs} · phase ${config.phaseLevels} lvl, back ${config.breathLevels}, calm ${ms(config.calmTicks)} · refill ${config.refillMs} to ${config.refillEndMs} · ${config.cubesPerLevel} cubes/lvl`,
    `chain calm ${ms(config.chainCalmTicks)}/link, max ${ms(config.chainCalmMaxTicks)} · timed ${config.timedStartMs} to ${config.timedEndMs}, calm ${ms(config.timedCalmTicks)} ms`,
  ].join('\n');
}
