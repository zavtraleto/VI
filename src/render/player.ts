import * as THREE from 'three';
import { cubeAt, cubeHeight, isHeld, worldRuns, type Level, type MoveKind, type RunState } from '../rules';
import { figureGeometry } from './figure';

/**
 * How high the one who plays stands in a cell: on the die there, or, off the dice, on the upper
 * frame of a cell beside a chain (`frame`), or on the floor.
 */
function footing(state: RunState, x: number, z: number, level: Level, alpha: number, dip: (cubeId: number) => number, frame: (x: number, z: number) => number): number {
  if (level === 'ground') return frame(x, z);
  const cube = cubeAt(state, x, z);
  // The die stays put between ticks while the tutorial holds it or the world of a level stands.
  return cube ? cubeHeight(cube, state.config, isHeld(state, cube) || !worldRuns(state) ? 0 : alpha) + dip(cube.id) : 0;
}

/** Extra lift at the middle of a step, per move kind. */
const ARC: Record<MoveKind, number> = {
  roll: 0.21, // the cube's top rises as it turns over its edge
  hop: 0.22,
  mount: 0.18,
  climb: 0.3,
  descend: 0.12,
  walk: 0.05,
  push: 0.03,
};

/** How fast the figure comes down when what held it up is gone, in cells a second. */
const FALL = 6;

/**
 * The one who plays, as a pictogram of one colour: a grey mannequin, for the program has no
 * record of them, that grows into the red of the seventh. The same body is the cursor of the
 * program's menu.
 */
export class PlayerFigure {
  readonly group = new THREE.Group();
  private readonly geometry = figureGeometry();
  private readonly solid = new THREE.MeshBasicMaterial();
  // Drawn only where a cube hides the figure, so the player never gets lost behind the dice.
  private readonly ghost = new THREE.MeshBasicMaterial({
    transparent: true,
    depthFunc: THREE.GreaterDepth,
    depthWrite: false,
  });
  /** The cell the figure was in on the last frame and how high it stood there. */
  private cell = -1;
  private y = 0;

  constructor() {
    const through = new THREE.Mesh(this.geometry, this.ghost);
    through.renderOrder = 10;
    this.group.add(new THREE.Mesh(this.geometry, this.solid), through);
  }

  /** `through` is how much of the figure shows where a die stands in front of it. */
  setColor(color: string, through: number): void {
    this.solid.color.set(color);
    this.ghost.color.set(color);
    this.ghost.opacity = through;
  }

  /** A new board: the figure is put where it stands, it does not come down to there. */
  reset(): void {
    this.cell = -1;
  }

  /**
   * `frame` is how high the upper frame of a cell beside a chain lies, nought where there is
   * none: off the dice the figure stands on that frame and comes down with it, not on the floor
   * under it.
   */
  sync(state: RunState, alpha: number, dt: number, dip: (cubeId: number) => number, frame: (x: number, z: number) => number): void {
    const { player, config } = state;

    const supportHeight = (x: number, z: number, level: Level): number => footing(state, x, z, level, alpha, dip, frame);

    const toY = supportHeight(player.x, player.z, player.level);
    const action = player.action;
    const cell = player.x + player.z * config.size;
    if (!action) {
      // A die that comes up under the figure on a frame takes the cell from the frame: the
      // figure comes down to it, quickly, and is not put on it at once.
      this.y = cell === this.cell ? Math.max(toY, this.y - (FALL * dt) / 1000) : toY;
      this.cell = cell;
      this.group.position.set(player.x, this.y, player.z);
      return;
    }
    const p = Math.min(1, (action.t + alpha) / config.actionTicks);
    // A rolling cube has already left its old cell, so the ride starts at full height.
    const fromY = action.kind === 'roll' ? 1 : supportHeight(action.fromX, action.fromZ, action.fromLevel);
    // A step up goes up first and over after, a step down goes over first and down after: the
    // figure clears the edge of the die it climbs or leaves, and the step reads as one move up
    // or one move down, not as a slide through the corner of the die. A ride on a rolling cube
    // stays even.
    const rise = toY - fromY;
    const lifted = action.kind === 'roll' ? p : rise > 0 ? 1 - (1 - p) * (1 - p) : p * p;
    this.y = fromY + rise * lifted;
    this.cell = cell;
    this.group.position.set(
      action.fromX + (player.x - action.fromX) * p,
      this.y + ARC[action.kind] * Math.sin(p * Math.PI),
      action.fromZ + (player.z - action.fromZ) * p,
    );
  }

  dispose(): void {
    this.geometry.dispose();
    this.solid.dispose();
    this.ghost.dispose();
  }
}
