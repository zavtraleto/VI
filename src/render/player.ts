import * as THREE from 'three';
import { cubeAt, cubeHeight, isHeld, type Level, type MoveKind, type RunState } from '../rules';
import type { Theme } from './theme';

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

/** A small ivory figure: a robe and a head. */
export class PlayerFigure {
  readonly group = new THREE.Group();

  constructor(theme: Theme) {
    // Large enough to be made out on a phone, where a cell is some forty pixels wide.
    const robe = new THREE.ConeGeometry(0.26, 0.65, 14);
    robe.translate(0, 0.325, 0);
    const head = new THREE.SphereGeometry(0.135, 14, 10);
    head.translate(0, 0.715, 0);

    const solid = new THREE.MeshLambertMaterial({ color: theme.ivory });
    // Drawn only where a cube hides the figure, so the player never gets lost behind the dice.
    const ghost = new THREE.MeshBasicMaterial({
      color: theme.ivory,
      transparent: true,
      opacity: 0.4,
      depthFunc: THREE.GreaterDepth,
      depthWrite: false,
    });
    for (const geometry of [robe, head]) {
      const through = new THREE.Mesh(geometry, ghost);
      through.renderOrder = 10;
      this.group.add(new THREE.Mesh(geometry, solid), through);
    }
  }

  sync(state: RunState, alpha: number, dip: (cubeId: number) => number): void {
    const { player, config } = state;
    const supportHeight = (x: number, z: number, level: Level): number => {
      if (level === 'ground') return 0;
      const cube = cubeAt(state, x, z);
      return cube ? cubeHeight(cube, config, isHeld(state, cube) ? 0 : alpha) + dip(cube.id) : 0;
    };

    const toY = supportHeight(player.x, player.z, player.level);
    const action = player.action;
    if (!action) {
      this.group.position.set(player.x, toY, player.z);
      return;
    }
    const p = Math.min(1, (action.t + alpha) / config.actionTicks);
    // A rolling cube has already left its old cell, so the ride starts at full height.
    const fromY = action.kind === 'roll' ? 1 : supportHeight(action.fromX, action.fromZ, action.fromLevel);
    this.group.position.set(
      action.fromX + (player.x - action.fromX) * p,
      fromY + (toY - fromY) * p + ARC[action.kind] * Math.sin(p * Math.PI),
      action.fromZ + (player.z - action.fromZ) * p,
    );
  }
}
