const STIFFNESS = 200;
/** Just under critical: the cube dips once and comes back without bouncing. */
const DAMPING = 25;
const MAX_STEP = 0.008;

interface Spring {
  y: number;
  v: number;
}

/**
 * A cube dips briefly under the player's weight when they step onto it, then returns to
 * rest; a cube that a chain lifts comes up the same way instead of jumping. Purely visual;
 * rolling and sliding cubes are not affected.
 */
export class CubeSprings {
  private readonly springs = new Map<number, Spring>();

  /** Pushes a cube down, as when the player lands on it. */
  kick(id: number, velocity: number): void {
    const spring = this.springs.get(id) ?? { y: 0, v: 0 };
    spring.v += velocity;
    this.springs.set(id, spring);
  }

  /** Draws a cube `offset` away from where it is, to be let back from there. */
  shift(id: number, offset: number): void {
    const spring = this.springs.get(id) ?? { y: 0, v: 0 };
    spring.y += offset;
    this.springs.set(id, spring);
  }

  update(dtMs: number): void {
    let remaining = Math.min(dtMs, 100) / 1000;
    while (remaining > 0) {
      const dt = Math.min(MAX_STEP, remaining);
      remaining -= dt;
      for (const spring of this.springs.values()) {
        spring.v += (-STIFFNESS * spring.y - DAMPING * spring.v) * dt;
        spring.y += spring.v * dt;
      }
    }
    for (const [id, spring] of this.springs) {
      if (Math.abs(spring.y) < 0.0005 && Math.abs(spring.v) < 0.005) this.springs.delete(id);
    }
  }

  offset(id: number): number {
    return this.springs.get(id)?.y ?? 0;
  }

  reset(): void {
    this.springs.clear();
  }
}
