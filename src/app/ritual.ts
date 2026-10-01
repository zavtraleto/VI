/** Score thresholds of the ritual stages. Presentation only: rules never read these. */
export const RITUAL_THRESHOLDS: readonly number[] = [100, 300, 700, 1500, 3000];

export const STAGE_TRANSITION_MS = 1500;
export const PHASE_SHIFT_MS = 900;

export function stageForScore(score: number): number {
  let stage = 0;
  while (stage < RITUAL_THRESHOLDS.length && score >= RITUAL_THRESHOLDS[stage]) stage++;
  return stage;
}

export function nextThreshold(score: number): number | null {
  const stage = stageForScore(score);
  return stage < RITUAL_THRESHOLDS.length ? RITUAL_THRESHOLDS[stage] : null;
}

/**
 * Tracks the stage reached in the current run and eases each stage's visuals in.
 * A stage, once reached, stays until the run ends.
 */
export class Ritual {
  stage = 0;
  /** Eased 0..1 presence of each stage, index 0 = stage 1. */
  readonly levels: number[] = RITUAL_THRESHOLDS.map(() => 0);
  /** 1 at the moment the final stage is reached, decaying to 0. */
  phaseShift = 0;

  reset(): void {
    this.stage = 0;
    this.levels.fill(0);
    this.phaseShift = 0;
  }

  /** Returns the stages newly reached by this update, in order. */
  update(score: number, dtMs: number): number[] {
    const reached: number[] = [];
    const target = stageForScore(score);
    while (this.stage < target) {
      this.stage++;
      reached.push(this.stage);
      if (this.stage === RITUAL_THRESHOLDS.length) this.phaseShift = 1;
    }
    for (let i = 0; i < this.levels.length; i++) {
      if (i < this.stage) this.levels[i] = Math.min(1, this.levels[i] + dtMs / STAGE_TRANSITION_MS);
    }
    this.phaseShift = Math.max(0, this.phaseShift - dtMs / PHASE_SHIFT_MS);
    return reached;
  }
}
