const PRESS_DEPTH = 0.05;
const STIFFNESS = 380;
const DAMPING_BOUNCY = 18;
const DAMPING_CALM = 39; // critical: settles without overshoot
const MAX_STEP = 0.008;

interface Spring {
  y: number;
  v: number;
}

/**
 * Small vertical give of cubes under the player's weight: the cube being stood on sits
 * slightly lower and bobs when stepped onto. Purely visual.
 */
export class CubeSprings {
  private readonly springs = new Map<number, Spring>();

  /** Pushes a cube down, as when the player lands on it. */
  kick(id: number, velocity: number): void {
    const spring = this.springs.get(id) ?? { y: 0, v: 0 };
    spring.v += velocity;
    this.springs.set(id, spring);
  }

  update(dtMs: number, pressedId: number | null, bouncy: boolean): void {
    if (pressedId !== null && !this.springs.has(pressedId)) this.springs.set(pressedId, { y: 0, v: 0 });
    const damping = bouncy ? DAMPING_BOUNCY : DAMPING_CALM;
    let remaining = Math.min(dtMs, 100) / 1000;
    while (remaining > 0) {
      const dt = Math.min(MAX_STEP, remaining);
      remaining -= dt;
      for (const [id, spring] of this.springs) {
        const target = id === pressedId ? -PRESS_DEPTH : 0;
        spring.v += (-STIFFNESS * (spring.y - target) - damping * spring.v) * dt;
        spring.y += spring.v * dt;
      }
    }
    for (const [id, spring] of this.springs) {
      if (id !== pressedId && Math.abs(spring.y) < 0.0005 && Math.abs(spring.v) < 0.005) this.springs.delete(id);
    }
  }

  offset(id: number): number {
    return this.springs.get(id)?.y ?? 0;
  }

  reset(): void {
    this.springs.clear();
  }
}
