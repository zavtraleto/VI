import * as THREE from 'three';
import type { Layer, Rect } from '../display/layer';
import { figureGeometry } from '../render/figure';
import type { ParamValues } from '../signal/scene';
import { NET, netPosition, type NetProjection } from './layout';
import type { Palette } from './theme';

/** Pixels of the texture of a top face. */
const PIP_CELL = 32;
/** Pips of each value on a grid of three by three, row by row. */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 3, 6, 2, 5, 8],
};
/** How bright each side of the glass is: +x, -x, top, bottom, +z, -z. The top is the face that counts. */
const SIDE_LIGHT = [0.5, 0.28, 1, 0.12, 0.7, 0.2];
/** How far the camera stands from what it looks at; without perspective only the order of things depends on it. */
const CAMERA_DISTANCE = 30;
/** How high the figure rises in the middle of a step, in dice. */
const HOP_ARC = 0.4;
/** The size of the figure here against its size on the board. */
const FIGURE_SCALE = 12 / 13;
/** Radii of the rings under the dice, in distances between dice. */
const RING_RADII = [1.9, 2.75];
const WHITE = new THREE.Color('#ffffff');

/** The pips of a face, white on nothing. The one is a single large dot. */
function pipTexture(value: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = PIP_CELL;
  canvas.height = PIP_CELL;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  const size = value === 1 ? 12 : 6;
  for (const cell of PIPS[value]) {
    const cx = PIP_CELL * (0.22 + 0.28 * (cell % 3));
    const cy = PIP_CELL * (0.22 + 0.28 * Math.floor(cell / 3));
    ctx.fillRect(Math.round(cx - size / 2), Math.round(cy - size / 2), size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

/** A unit cube whose sides differ in brightness, so that glass of one colour still has a shape. */
function glassGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.fill(SIDE_LIGHT[Math.floor(i / 4)], i * 3, i * 3 + 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

interface Die {
  group: THREE.Group;
  glass: THREE.MeshBasicMaterial;
  edges: THREE.LineBasicMaterial;
  pips: THREE.MeshBasicMaterial;
}

/**
 * The face of the program: six dice of glass hanging in the dark, laid out as the net of a
 * die. Each shows its own face and glows with the colour of its channel. The red figure — the
 * seventh — stands on one of them; stepping onto a die is how a file of the menu is chosen.
 */
export class ShellSpace {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, CAMERA_DISTANCE * 3);
  private readonly dice: Die[] = [];
  private readonly figure = new THREE.Group();
  private readonly figureMaterial = new THREE.MeshBasicMaterial();
  private readonly rings: THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>[] = [];
  private readonly disposables: { dispose(): void }[] = [];
  private readonly clear = new THREE.Color();
  /** The die the figure left, the die it goes to, and the frame it set off at. */
  private from = 1;
  private to = 1;
  private start: number | null = null;

  constructor(private readonly values: ParamValues) {
    const glass = glassGeometry();
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    const top = new THREE.PlaneGeometry(1, 1);
    top.rotateX(-Math.PI / 2);
    this.disposables.push(glass, edges, top);

    NET.forEach((_, i) => {
      const die: Die = {
        group: new THREE.Group(),
        glass: new THREE.MeshBasicMaterial({
          vertexColors: true,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
        edges: new THREE.LineBasicMaterial(),
        pips: new THREE.MeshBasicMaterial({ map: pipTexture(i + 1), transparent: true, depthWrite: false }),
      };
      const body = new THREE.Mesh(glass, die.glass);
      const lines = new THREE.LineSegments(edges, die.edges);
      const face = new THREE.Mesh(top, die.pips);
      body.position.y = 0.5;
      lines.position.y = 0.5;
      face.position.y = 1.002;
      face.renderOrder = 2;
      die.group.add(body, lines, face);
      this.scene.add(die.group);
      this.dice.push(die);
      this.disposables.push(die.glass, die.edges, die.pips, die.pips.map!);
    });

    // The body of the board, a little smaller: the dice here stand apart.
    const body = figureGeometry(FIGURE_SCALE);
    this.figure.add(new THREE.Mesh(body, this.figureMaterial));
    this.scene.add(this.figure);
    this.disposables.push(body, this.figureMaterial);

    for (const radius of RING_RADII) {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i < 72; i++) {
        const angle = (i / 72) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
      }
      const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial());
      this.rings.push(ring);
      this.scene.add(ring);
      this.disposables.push(ring.geometry, ring.material);
    }
  }

  /** The figure goes to a die. The first call puts it there at once. */
  stand(face: number): void {
    if (face === this.to) return;
    this.from = this.to;
    this.to = face;
    this.start = null;
  }

  /** Puts the figure on a die without a step: where the screen opens. */
  place(face: number): void {
    this.from = face;
    this.to = face;
    this.start = 0;
  }

  /**
   * Draws the dice into the part of the layer that `rect` is, over the dark of the tube, as
   * the projection says. `still` stops everything that moves by itself.
   */
  render(layer: Layer, rect: Rect, projection: NetProjection, palette: Palette, timeMs: number, still: boolean): void {
    const { values } = this;
    const n = (name: string): number => Number(values[name] ?? 0);
    const gap = n('spaceGap');

    this.start ??= timeMs;
    const hop = n('hopMs');
    const step = still || hop <= 0 ? 1 : Math.min(1, Math.max(0, (timeMs - this.start) / hop));

    const period = Math.max(0.5, n('spaceBobSec')) * 1000;
    const heights: number[] = [];
    this.dice.forEach((die, i) => {
      const place = netPosition(i + 1, gap);
      // Every die breathes at its own moment, so the net never moves as one board.
      const phase = still ? 0 : (timeMs / period + i * 0.37) * Math.PI * 2;
      const height = still ? 0 : Math.sin(phase) * n('spaceBob');
      heights.push(height);
      die.group.position.set(place.x, height, place.z);
      die.group.rotation.y = still ? 0 : THREE.MathUtils.degToRad(n('spaceTurn')) * Math.sin(phase * 0.5 + i);

      const lit = i + 1 === this.to && step >= 0.5 ? n('spaceLit') : 1;
      const channel = palette.channels[i];
      die.glass.color.set(channel).multiplyScalar(n('spaceGlass') * lit);
      die.edges.color.set(channel).multiplyScalar(Math.min(1, n('spaceEdge') * (lit > 1 ? 1 : 0.6)));
      // The one is a red dot on white: the dot is the seventh.
      die.pips.color.set(i === 0 ? palette.signal : channel).lerp(WHITE, i === 0 ? 0 : 0.5);
    });

    const from = netPosition(this.from, gap);
    const to = netPosition(this.to, gap);
    const fromY = 1 + heights[this.from - 1];
    const toY = 1 + heights[this.to - 1];
    this.figure.position.set(
      from.x + (to.x - from.x) * step,
      fromY + (toY - fromY) * step + HOP_ARC * Math.sin(step * Math.PI),
      from.z + (to.z - from.z) * step,
    );
    this.figureMaterial.color.set(palette.signal);

    const rings = n('spaceRings');
    this.rings.forEach((ring, i) => {
      ring.visible = rings > 0;
      ring.scale.setScalar(gap);
      ring.material.color.set(palette.ink).multiplyScalar(rings * (i === 0 ? 1 : 0.6));
    });

    const yaw = THREE.MathUtils.degToRad(n('spaceYaw'));
    const pitch = THREE.MathUtils.degToRad(n('spacePitch'));
    const { camera } = this;
    const { target } = projection;
    camera.left = -projection.halfWidth;
    camera.right = projection.halfWidth;
    camera.top = projection.halfHeight;
    camera.bottom = -projection.halfHeight;
    camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * CAMERA_DISTANCE,
      target.y + Math.sin(pitch) * CAMERA_DISTANCE,
      target.z + Math.cos(yaw) * Math.cos(pitch) * CAMERA_DISTANCE,
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(target.x, target.y, target.z);
    camera.updateProjectionMatrix();

    layer.render(this.scene, camera, { rect, clear: this.clear.set(palette.bg) });
  }

  dispose(): void {
    for (const item of this.disposables) item.dispose();
    this.disposables.length = 0;
  }
}
