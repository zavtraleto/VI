const STIFFNESS = 200;
/** Just under critical: the cube dips once and comes back without bouncing. */
const DAMPING = 25;
const MAX_STEP = 0.008;

interface Spring {
  y: number;
  v: number;
  /** Where the spring comes to rest: 0, or lower for the cube that is held down. */
  rest: number;
}

/**
 * The cube the player stands on sits lower than the others for as long as they stand on it:
 * the weight of the one who plays is felt by the world. A cube that a chain lifts comes up
 * softly instead of jumping. Purely visual: the rules know nothing of it.
 */
export class CubeSprings {
  private readonly springs = new Map<number, Spring>();

  /** Pushes a cube down, as when the player lands on it. */
  kick(id: number, velocity: number): void {
    this.spring(id).v += velocity;
  }

  /** Draws a cube `offset` away from where it is, to be let back from there. */
  shift(id: number, offset: number): void {
    this.spring(id).y += offset;
  }

  /** Holds one cube down by `depth`, and lets go of every other. `null` holds none. */
  hold(id: number | null, depth: number): void {
    for (const [key, spring] of this.springs) spring.rest = key === id ? -depth : 0;
    if (id !== null && depth > 0) this.spring(id).rest = -depth;
  }

  update(dtMs: number): void {
    let remaining = Math.min(dtMs, 100) / 1000;
    while (remaining > 0) {
      const dt = Math.min(MAX_STEP, remaining);
      remaining -= dt;
      for (const spring of this.springs.values()) {
        spring.v += (-STIFFNESS * (spring.y - spring.rest) - DAMPING * spring.v) * dt;
        spring.y += spring.v * dt;
      }
    }
    for (const [id, spring] of this.springs) {
      if (spring.rest === 0 && Math.abs(spring.y) < 0.0005 && Math.abs(spring.v) < 0.005) this.springs.delete(id);
    }
  }

  offset(id: number): number {
    return this.springs.get(id)?.y ?? 0;
  }

  reset(): void {
    this.springs.clear();
  }

  private spring(id: number): Spring {
    let spring = this.springs.get(id);
    if (!spring) {
      spring = { y: 0, v: 0, rest: 0 };
      this.springs.set(id, spring);
    }
    return spring;
  }
}
