import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BoardBursts, FX_LAYER } from './burst';

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
/** What a camera that looks at one layer of the scene draws of the light of a group. */
const seenOn = (bursts: BoardBursts, layer: number): THREE.Object3D[] => {
  const layers = new THREE.Layers();
  layers.set(layer);
  return bursts.group.children.filter((child) => child.visible && child.layers.test(layers));
};
const fired = (): BoardBursts => {
  const bursts = new BoardBursts();
  bursts.setColours([1, 2, 3, 4, 5, 6].map(() => new THREE.Color(1, 1, 1)));
  bursts.fire({ kind: 'chain', value: 3, tier: 4, cells: [{ x: 0, z: 0 }], });
  bursts.update(16, camera);
  return bursts;
};

describe('the light a group throws', () => {
  it('is all drawn over the whole window, the ring with the sparks: none of it is kept inside the part the board has', () => {
    const bursts = fired();
    const over = seenOn(bursts, FX_LAYER);
    // The sparks, and the ring that runs out over the surface.
    expect(over).toHaveLength(2);
    expect(over.some((object) => (object as THREE.Mesh).geometry instanceof THREE.RingGeometry)).toBe(true);
    // Nothing of it is drawn with the board, where the edge of that part would cut it.
    expect(seenOn(bursts, 0)).toEqual([]);
  });

  it('says there is something to draw there for as long as a spark flies or a ring runs, and no longer', () => {
    const bursts = new BoardBursts();
    expect(bursts.thrown).toBe(false);
    const lit = fired();
    expect(lit.thrown).toBe(true);
    for (let ms = 0; ms < 3000; ms += 50) lit.update(50, camera);
    expect(lit.thrown).toBe(false);
    expect(seenOn(lit, FX_LAYER)).toEqual([]);
  });

  it('counts a ring that still runs when the last spark is gone', () => {
    const bursts = fired();
    // The sparks are put out; the ring is left running.
    (bursts as unknown as { count: number }).count = 0;
    bursts.update(16, camera);
    expect(bursts.flying).toBe(false);
    expect(bursts.thrown).toBe(true);
  });
});
