import * as THREE from 'three';
import { ps1Material } from '../../display/ps1';
import { shade } from '../kit';
import type { Mood, ParamValues } from '../scene';
import type { Stage } from '../stage';
import { Surface, type Block } from '../surface';

/** A box of a thing: its size, and where its middle is, turned about the vertical by `turn`. */
export function block(w: number, h: number, d: number, x: number, y: number, z: number, turn = 0): Block {
  const matrix = new THREE.Matrix4().makeTranslation(x, y, z);
  if (turn) matrix.multiply(new THREE.Matrix4().makeRotationY(turn));
  return { size: new THREE.Vector3(w, h, d), matrix };
}

/**
 * The lit body of a thing: boxes in one colour, cut as finely as the place needs and lit by
 * its lamps every frame. Returns the surface, the mesh and the boxes, for shadows.
 */
export function body(stage: Stage, blocks: Block[], tone: string, parent: THREE.Object3D): { surface: Surface; mesh: THREE.Mesh } {
  const surface = new Surface();
  const color = new THREE.Color(tone);
  // A surface lit the same everywhere needs no cutting; one under a lamp is cut to a hand's width.
  const cell = Number.isFinite(stage.cell) ? Math.min(stage.cell, 0.35) : stage.cell;
  for (const item of blocks) surface.box(item, color, cell);
  const mesh = new THREE.Mesh(stage.keep(surface.geometry()), stage.keep(ps1Material({ vertexColors: true, fog: stage.fog, snap: stage.snap, light: null })));
  mesh.frustumCulled = false;
  parent.add(mesh);
  return { surface, mesh };
}

/** Something that gives its own light: one colour, untouched by the lamps, only by the air. */
export function glowing(stage: Stage, geometry: THREE.BufferGeometry, tone: string, fogged = true): THREE.Mesh {
  const mesh = new THREE.Mesh(
    stage.keep(geometry),
    stage.keep(ps1Material({ color: tone, fog: fogged ? stage.fog : null, snap: stage.snap, light: null })),
  );
  mesh.frustumCulled = false;
  return mesh;
}

/**
 * The moods of a plain thing: its colour goes greyer, then darker, until in fear it is a
 * shape against the light. `extra` adds what else changes in the thing.
 */
export function shadeMoods(name: string, tone: string, extra: Partial<Record<Mood, Partial<ParamValues>>> = {}): Record<Mood, Partial<ParamValues>> {
  return {
    dream: { ...extra.dream },
    sad: { [name]: shade(tone, 0.3), ...extra.sad },
    strange: { [name]: shade(tone, 0.35), ...extra.strange },
    anxious: { [name]: shade(tone, 0.75), ...extra.anxious },
    fear: { [name]: shade(tone, 0.94), ...extra.fear },
  };
}
