import * as THREE from 'three';
import { GLOW_LAYER } from './cubes';
import { farthest, type GridSegment } from './gridLines';
import type { BoardLook } from './params';

/** How far past its line a side is given room, in cells: for the half pixel its edge is smoothed over. */
const ROOM = 0.06;
/** How much wider than its line the running point is, in widths of the line, for every one of `headGlow`. */
const HEAD_SWELL = 1;
/** How much of `headGlow` the light around a point has at its middle: at 2 it is as bright there as the core. */
const HALO_SHARE = 0.5;

const VERTEX = /* glsl */ `
uniform float uLine;
uniform float uEdge;
uniform float uPoint;

attribute vec4 aSide;
attribute vec2 aKind;

varying float vAlong;
varying float vAcross;
varying float vWide;
varying float vReach;

void main() {
  // A side is one cell long, so the way along it is a unit.
  vec2 along = aSide.zw - aSide.xy;
  vec2 across = vec2(-along.y, along.x);
  vWide = 0.5 * mix(uLine, uEdge, aKind.y);
  vReach = aKind.x;
  float room = vWide * max(1.0, uPoint) + ${ROOM.toFixed(3)};
  vAlong = mix(-room, 1.0 + room, position.x);
  vAcross = position.y * room;
  vec2 at = aSide.xy + along * vAlong + across * vAcross;
  // The corners of the cells are half a cell back from where the rules count them.
  gl_Position = projectionMatrix * modelViewMatrix * vec4(at.x - 0.5, 0.0, at.y - 0.5, 1.0);
}
`;

/**
 * A side of a cell, as much of it as the wave has drawn. Its edges are smoothed by how much of
 * a pixel the line covers, counted in cells of the board, so the line is as wide and as bright
 * wherever it lies and however it is turned. The end that is being drawn is a round point lit
 * in full, and what it has just drawn is still lit and goes down to the light of the lines; a
 * line that is erased is left by the point as that light going out.
 */
const FRAGMENT = /* glsl */ `
uniform vec3 uColour;
uniform float uOpacity;
uniform float uWave;
uniform float uTail;
uniform float uAfter;
uniform float uHead;
uniform float uPoint;
uniform float uErase;

varying float vAlong;
varying float vAcross;
varying float vWide;
varying float vReach;

// How much of a pixel that is 'px' wide and stands at 'at' lies between 'low' and 'high'.
float cover(float at, float low, float high, float px) {
  return clamp((min(at + 0.5 * px, high) - max(at - 0.5 * px, low)) / px, 0.0, 1.0);
}

void main() {
  float drawn = clamp(uWave - vReach, 0.0, 1.0);
  float px = max(fwidth(vAlong), 1e-5);
  float py = max(fwidth(vAcross), 1e-5);
  float body = cover(vAcross, -vWide, vWide, py);

  // What is there of the side: from its square end to where the point is, or to its other square end.
  float kept = drawn <= 0.0 ? 0.0 : cover(vAlong, -vWide, drawn >= 1.0 ? 1.0 + vWide : drawn, px);
  // What is not there: only an erasing leaves light on it.
  float lost = drawn >= 1.0 ? 0.0 : cover(vAlong, drawn <= 0.0 ? -vWide : drawn, 1.0 + vWide, px);

  // How far this place is from the point, in steps of the wave, and what is left there of its light.
  float apart = abs(vReach + clamp(vAlong, 0.0, 1.0) - uWave);
  float glow = clamp(1.0 - apart / max(uTail, 1e-4), 0.0, 1.0);
  glow *= glow * uAfter;
  float lit = mix(uOpacity, 1.0, uHead * glow);

  float level = body * max(kept * mix(lit, uOpacity, uErase), lost * uErase * glow * lit);

  // The point itself: round, and there only while its side is being drawn.
  float off = length(vec2(vAlong - drawn, vAcross));
  float pr = max(fwidth(off), 1e-5);
  float running = drawn > 0.0 && drawn < 1.0 && uHead > 0.001 ? 1.0 : 0.0;
  float point = running * clamp((vWide * uPoint - off) / pr + 0.5, 0.0, 1.0);
  level = max(level, point * mix(uOpacity, 1.0, uHead));

  gl_FragColor = vec4(uColour, 1.0);
  #include <colorspace_fragment>
  // Light times how much of it there is: where two sides meet the stronger one stands, not their sum.
  gl_FragColor = vec4(gl_FragColor.rgb * level, level);
}
`;

/**
 * The point that draws a side, as a light of its own: a square that faces the camera, standing
 * where the wave has come to on its side, and nowhere while the side is not being drawn.
 */
const HEAD_VERTEX = /* glsl */ `
uniform float uWave;
uniform float uRoom;

attribute vec4 aSide;
attribute vec2 aKind;

varying vec2 vOff;

void main() {
  float drawn = clamp(uWave - aKind.x, 0.0, 1.0);
  vec2 centre = aSide.xy + (aSide.zw - aSide.xy) * drawn;
  // In cells of the board, around the point.
  vOff = position.xy * uRoom;
  // The corners of the cells are half a cell back from where the rules count them.
  vec4 at = modelViewMatrix * vec4(centre.x - 0.5, 0.0, centre.y - 0.5, 1.0);
  // Turned to the camera: the point is round on the screen however the board lies.
  at.xy += vOff;
  // A side that is whole, or not begun, has no point: its square is put out of the picture.
  gl_Position = drawn > 0.0 && drawn < 1.0 ? projectionMatrix * at : vec4(2.0, 2.0, 2.0, 1.0);
}
`;

/**
 * A point of light: a hot core lit in full, with a sharp rim, and light around it that falls
 * off to nothing. It is put together with the lines by the stronger of the two, as the lines
 * are with one another, so a corner where several points part is no brighter than one of them.
 */
const HEAD_FRAGMENT = /* glsl */ `
uniform vec3 uColour;
uniform float uCore;
uniform float uHalo;
uniform float uGlow;

varying vec2 vOff;

void main() {
  float off = length(vOff);
  float px = max(fwidth(off), 1e-5);
  float core = clamp((uCore - off) / px + 0.5, 0.0, 1.0);
  float fall = clamp(1.0 - off / max(uHalo, 1e-4), 0.0, 1.0);
  float level = min(1.0, max(core, uGlow * ${HALO_SHARE.toFixed(2)} * fall * fall));

  gl_FragColor = vec4(uColour, 1.0);
  #include <colorspace_fragment>
  gl_FragColor = vec4(gl_FragColor.rgb * level, level);
}
`;

type Strips = THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;

/**
 * The lines of the surface of a board, as geometry: a strip of the floor for every side of
 * every cell, all of them one mesh and one draw. The thin line between two cells and the heavy
 * one around the board are the widths the look names, in cells. How much of each side is drawn
 * is counted on the graphics card from one number, how far the wave has come; nothing is built
 * anew while the lines are drawn or erased.
 *
 * Where sides meet, at every crossing of the lines, the strips lie over one another: they are
 * put together by the larger of the two, so a crossing is no brighter than a line.
 *
 * The points that draw the lines are a second draw, there only while a wave runs: a bright
 * point of light for every side that is being drawn, placed on the graphics card by the same
 * numbers as the sides. They are on the layer of what gives light off, so the tube spreads
 * their light around them; the lines are not.
 */
export class LineGrid {
  /** The lines and the points that draw them: what is put on the board. Its order in the picture is the order of both. */
  readonly object = new THREE.Group();
  readonly lines: Strips;
  readonly heads: Strips;
  /** The colour of the lines, and how much of it they take, 0 to 1: set before `show`. */
  readonly colour = new THREE.Color(1, 1, 1);
  opacity = 1;
  /** How far the wave has come: the lines and the points are drawn by the one number. */
  private readonly wave = { value: 1 };
  private readonly uniforms = {
    uColour: { value: this.colour },
    uOpacity: { value: 1 },
    uLine: { value: 0.05 },
    uEdge: { value: 0.05 },
    uWave: this.wave,
    uTail: { value: 0 },
    uAfter: { value: 0 },
    uHead: { value: 0 },
    uPoint: { value: 1 },
    uErase: { value: 0 },
  };
  private readonly headUniforms = {
    uColour: { value: this.colour },
    uWave: this.wave,
    /** Half the side of the square a point is drawn in, the radius of its core and that of the light around it, in cells. */
    uRoom: { value: 0.1 },
    uCore: { value: 0.05 },
    uHalo: { value: 0.1 },
    uGlow: { value: 1 },
  };
  private readonly material: THREE.ShaderMaterial;
  private readonly headMaterial: THREE.ShaderMaterial;
  /** The sides that are set: how many, and how far the farthest is. */
  private count = 0;
  private far = 0;
  private sides: Float32Array = new Float32Array(0);
  private kinds: Float32Array = new Float32Array(0);
  /** The share shown on the last frame, and when it last changed: light left behind goes out while nothing moves. */
  private shown = 1;
  private movedAt = -Infinity;

  constructor(private readonly look: BoardLook) {
    // Put together with what is under it by the stronger of the two.
    const strongest = {
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.CustomBlending,
      blendEquation: THREE.MaxEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
    } as const;
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT, ...strongest });
    this.headMaterial = new THREE.ShaderMaterial({ uniforms: this.headUniforms, vertexShader: HEAD_VERTEX, fragmentShader: HEAD_FRAGMENT, ...strongest });
    const { strips, points } = this.build(0);
    this.lines = new THREE.Mesh(strips, this.material);
    this.heads = new THREE.Mesh(points, this.headMaterial);
    // Both are placed by the graphics card: neither has bounds to be culled by.
    this.lines.frustumCulled = false;
    this.heads.frustumCulled = false;
    // The points over the lines they draw.
    this.heads.renderOrder = 1;
    // A point is light, and the tube spreads it.
    this.heads.layers.enable(GLOW_LAYER);
    // A board at rest has none.
    this.heads.visible = false;
    this.object.add(this.lines, this.heads);
  }

  /**
   * A strip for each of `count` sides, and a square for the point of each: one shape of each,
   * drawn that many times, by the same numbers of the sides.
   */
  private build(count: number): { strips: THREE.InstancedBufferGeometry; points: THREE.InstancedBufferGeometry } {
    this.sides = new Float32Array(count * 4);
    this.kinds = new Float32Array(count * 2);
    const side = new THREE.InstancedBufferAttribute(this.sides, 4);
    const kind = new THREE.InstancedBufferAttribute(this.kinds, 2);
    const strips = new THREE.InstancedBufferGeometry();
    // Along the side from 0 to 1, across it from -1 to 1.
    strips.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3));
    const points = new THREE.InstancedBufferGeometry();
    // Around the point, from -1 to 1 each way.
    points.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    for (const geometry of [strips, points]) {
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
      geometry.setAttribute('aSide', side);
      geometry.setAttribute('aKind', kind);
      geometry.instanceCount = count;
    }
    this.count = count;
    return { strips, points };
  }

  /**
   * The sides that are drawn from now on: those of another board, or the same ones as another
   * wave finds them. Done when a board is put on and when a wave starts, never while it runs.
   */
  set(segments: readonly GridSegment[]): void {
    if (segments.length !== this.count) {
      this.lines.geometry.dispose();
      this.heads.geometry.dispose();
      const { strips, points } = this.build(segments.length);
      this.lines.geometry = strips;
      this.heads.geometry = points;
    }
    const { sides, kinds } = this;
    segments.forEach((segment, i) => {
      sides[i * 4] = segment.ax;
      sides[i * 4 + 1] = segment.az;
      sides[i * 4 + 2] = segment.bx;
      sides[i * 4 + 3] = segment.bz;
      kinds[i * 2] = segment.reach;
      kinds[i * 2 + 1] = segment.edge ? 1 : 0;
    });
    const { attributes } = this.lines.geometry;
    attributes.aSide.needsUpdate = true;
    attributes.aKind.needsUpdate = true;
    this.far = farthest(segments);
  }

  /** How far the farthest side is from the cell the wave starts from, in cells. */
  get reach(): number {
    return this.far;
  }

  /**
   * share 0..1 of the wave: with `drawing` the lines are being drawn from the cell the wave
   * starts from, without it they are being erased towards it; 1 is the whole board either way,
   * 0 none of it. The wave has one part for every step it makes and one more: a side is drawn
   * in one part. The light the point leaves behind lasts `afterglowMs` of the time the whole
   * wave is given (`drawMs`, `eraseMs`), and goes out in that time when the share stops changing.
   *
   * The points of light are there only between the two: a board with all its lines, or with
   * none, has no point, and neither has one whose look asks for none (`headGlow` 0).
   */
  show(share: number, drawing: boolean, timeMs: number): void {
    const { uniforms, headUniforms, look } = this;
    const n = (name: string): number => Number(look.board[name] ?? 0);
    const parts = this.far + 1;
    if (share !== this.shown) {
      this.shown = share;
      this.movedAt = timeMs;
    }
    const lasts = Math.max(0, n('afterglowMs'));
    const whole = Math.max(1, drawing ? n('drawMs') : n('eraseMs'));
    const glow = Math.max(0, n('headGlow'));
    uniforms.uOpacity.value = this.opacity;
    uniforms.uLine.value = n('gridLine');
    uniforms.uEdge.value = n('gridEdge');
    // At 1 the wave is past every side whatever the arithmetic makes of it.
    this.wave.value = share >= 1 ? parts + 1 : Math.max(0, share) * parts;
    uniforms.uTail.value = (lasts / whole) * parts;
    uniforms.uAfter.value = lasts > 0 ? Math.min(1, Math.max(0, 1 - (timeMs - this.movedAt) / lasts)) : 0;
    uniforms.uHead.value = Math.min(1, glow);
    uniforms.uPoint.value = 1 + HEAD_SWELL * glow;
    uniforms.uErase.value = drawing ? 0 : 1;

    // The hot core, in widths of the thin line; the light around it, in cells.
    const core = 0.5 * n('gridLine') * Math.max(0, n('headSize'));
    const halo = Math.max(0, n('headHalo'));
    headUniforms.uCore.value = core;
    headUniforms.uHalo.value = halo;
    headUniforms.uGlow.value = glow;
    headUniforms.uRoom.value = Math.max(core, halo) + ROOM;
    this.heads.visible = glow > 0 && share > 0 && share < 1;
  }

  dispose(): void {
    this.lines.geometry.dispose();
    this.heads.geometry.dispose();
    this.material.dispose();
    this.headMaterial.dispose();
  }
}
