import { ruleKey, type ExperimentConfig, type RunState } from '../rules';
import { formatTime } from '../ui/dom';

/** Plain-text summary of a run for the playtest panel. */
export function statsText(state: RunState): string {
  const { config, stats } = state;
  const seconds = (ticks: number) => ((ticks * config.tickMs) / 1000).toFixed(1) + 's';
  const flags = (Object.keys(config.experiments) as (keyof ExperimentConfig)[]).filter((k) => config.experiments[k]);
  return [
    `VI · rules ${ruleKey(config)} · ${state.mode} · seed ${state.seed}`,
    `time ${formatTime(state.tick, config.tickMs)} · score ${state.score} · max chain x${state.maxChain} · level ${state.level}`,
    `first clears: ${stats.clearTicks.length > 0 ? stats.clearTicks.map(seconds).join(', ') : '-'}`,
    `clears ${stats.clears} · steps ${stats.steps} · blocked ${stats.blockedSteps}`,
    `ground time ${seconds(stats.groundTicks)} · falls ${stats.falls} · removed ${state.removed}`,
    `flags: ${flags.length > 0 ? flags.join(', ') : 'none'}`,
  ].join('\n');
}
