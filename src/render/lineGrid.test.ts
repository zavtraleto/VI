import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { shellDefaults } from '../shell/theme';
import { GLOW_LAYER } from './cubes';
import { gridSegments, waveFrom } from './gridLines';
import { LineGrid } from './lineGrid';
import { boardDefaults, type BoardLook } from './params';

const look = (over: Record<string, number> = {}): BoardLook => ({ board: { ...boardDefaults(), ...over }, shell: shellDefaults() });
const sides = (size: number) => waveFrom(gridSegments(size, []), { x: 0, z: 0 });
/** What the picture of the light of the board is drawn from: the things on its layer. */
const glows = (object: THREE.Object3D): boolean => {
  const tube = new THREE.Layers();
  tube.set(GLOW_LAYER);
  return object.layers.test(tube);
};

describe('the points that draw the lines of a board', () => {
  it('are a draw of their own beside the lines, one point for every side, placed by the same numbers', () => {
    const grid = new LineGrid(look());
    grid.set(sides(3));
    const { lines, heads } = grid;
    expect(grid.object.children).toEqual([lines, heads]);
    expect(heads.geometry.instanceCount).toBe(lines.geometry.instanceCount);
    expect(heads.geometry.instanceCount).toBe(sides(3).length);
    expect(heads.geometry.getAttribute('aSide')).toBe(lines.geometry.getAttribute('aSide'));
    expect(heads.geometry.getAttribute('aKind')).toBe(lines.geometry.getAttribute('aKind'));
    // Another board has another number of sides: the points follow the lines.
    grid.set(sides(5));
    expect(grid.heads.geometry.instanceCount).toBe(sides(5).length);
    expect(grid.heads.geometry.getAttribute('aSide')).toBe(grid.lines.geometry.getAttribute('aSide'));
  });

  it('give their light to the tube, and the lines do not', () => {
    const grid = new LineGrid(look());
    expect(glows(grid.heads)).toBe(true);
    expect(glows(grid.lines)).toBe(false);
  });

  it('are not there on a board at rest: with all its lines, or with none', () => {
    const grid = new LineGrid(look());
    grid.set(sides(3));
    grid.show(1, true, 0);
    expect(grid.heads.visible).toBe(false);
    grid.show(0, false, 16);
    expect(grid.heads.visible).toBe(false);
    expect(grid.lines.visible).toBe(true);
  });

  it('are there while a wave draws the lines or erases them, and not where the look asks for no point', () => {
    const grid = new LineGrid(look());
    grid.set(sides(3));
    grid.show(0.4, true, 0);
    expect(grid.heads.visible).toBe(true);
    grid.show(0.4, false, 16);
    expect(grid.heads.visible).toBe(true);
    const plain = new LineGrid(look({ headGlow: 0 }));
    plain.set(sides(3));
    plain.show(0.4, true, 0);
    expect(plain.heads.visible).toBe(false);
  });

  it('have a hot core as wide as the look asks, in widths of the thin line, and light around it as far as it asks, in cells', () => {
    const grid = new LineGrid(look({ gridLine: 0.05, headSize: 3, headHalo: 0.4, headGlow: 1.5 }));
    grid.set(sides(3));
    grid.show(0.4, true, 0);
    const { uniforms } = grid.heads.material;
    expect(uniforms.uCore.value).toBeCloseTo(0.075, 6);
    expect(uniforms.uHalo.value).toBeCloseTo(0.4, 6);
    expect(uniforms.uGlow.value).toBeCloseTo(1.5, 6);
    // The square a point is drawn in has room for all of its light.
    expect(uniforms.uRoom.value).toBeGreaterThanOrEqual(0.4);
    // The points are where the wave is: the same number the lines are drawn by.
    expect(uniforms.uWave).toBe(grid.lines.material.uniforms.uWave);
  });
});
