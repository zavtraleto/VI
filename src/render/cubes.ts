import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { cubeHeight, isHeld, worldRuns, type Cube, type RunState } from '../rules';
import type { ParamValues } from '../signal/scene';
import { mixHex, type Palette } from '../shell/theme';
import { CANONICAL_FACE_VALUES, ROLL_AXIS, quatFor } from './orientationQuat';
import { comeShare, goneShare, isLit, litFlash, passingHeight, faded, type DicePassing } from './passing';
import { PIP_STEP } from './textures';

/**
 * How a cube is drawn. A die at rest or on the move is solid. One that is coming up or going
 * down is frosted glass: the same die with all its faces, milky with the colour of the channel
 * on top and with its edges lit in it, drawn through a mesh of the dots of the tube. As much of
 * the die as is here, so many dots it has: one that comes up gathers them and has them all when
 * it stands, one that goes down loses them and has none at the very end. The "low" looks have
 * fewer dots at once: a rising cube that can still be stepped onto from the ground, or a sinking
 * cube that can be rolled over. The step from one to the other is plain to see: it is what says
 * a die can be climbed.
 */
type Look = 'idle' | 'rising' | 'risingLow' | 'sinking' | 'sinkingLow';

export const CUBE_SIZE = 0.94;
/**
 * What gives light off is drawn once more, alone and small, for the light the tube spreads
 * around it: the dice and the edges of the glass ones are on this layer of the scene as well.
 */
export const GLOW_LAYER = 1;
/** How much of the rounding of a die its lit edges are drawn inside of: they run along the middle of it. */
const EDGE_INSET = 0.586;
/** How far the lit edges of the glass are from the colour of the channel towards white. */
const EDGE_PALE = 0.3;
/** Most dice there can be: one on every cell of the largest board. */
const MAX_DICE = 9 * 9;
/** Which way each side of the unrotated die looks, in the order a box has its sides: +x, -x, +y, -y, +z, -z. */
const FACE_NORMALS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
/** How much of the answer of the dice goes into their light: 1 would double it. */
const LIFT = 0.6;
/**
 * How a die that is going down loses its dots with its height: under 1, it keeps most of
 * them for most of the way and loses the last of them at the very end. A die that is coming
 * up gathers them the same way, turned round.
 */
const MELT_CURVE = 0.6;
/** The height from which a die that is coming up shows the line of its own edges, in the colour of its channel. */
const OWN_LINE_FROM = 0.6;
/** How much of the light of its channel a die takes over all of itself at the moment its group is sent, or it lights up. */
const FLASH_FROST = 0.6;

export interface CubeGlow {
  /** How much brighter the dice at rest are than they stand: the answer to a clear, their breathing, the last step of the contact. */
  idle: number;
  /** How bright the edges of a die going down are against those of one coming up. */
  sinking: number;
  /** 1 at the moment a group is sent, falling to 0: its dice flash with their channel. */
  flash: number;
  /** The light a group going down throws on the dice around it: where it stands, its colour, how strong it is. */
  lamp: { x: number; y: number; z: number; colour: THREE.Color; power: number };
  /** The size of a dot of the tube the board is shown on, in pixels of the picture. */
  dot: number;
  /** Milliseconds since the frame before: a die that has just come up settles over a few of them. */
  dt: number;
}

type DieMaterial = THREE.ShaderMaterial;
type GlassDie = THREE.Mesh<THREE.BufferGeometry, DieMaterial>;

const VERTEX = /* glsl */ `
/** Where on its face a point lies, and the value of the face. */
attribute vec3 face;
/** Which way the face looks on a die that has not been turned. */
attribute vec3 faceNormal;
#ifdef USE_INSTANCING
/** A die that has just come up: the light of its channel, and how far it has settled, 1 for a die that stands. */
attribute vec4 arrive;
/** 1 for a fixed die that no combo has lit yet: its screens are out. */
attribute float dim;
#else
uniform float uDim;
#endif

uniform float uSide;
uniform float uTilt;

varying vec3 vFace;
varying vec3 vNormal;
varying vec3 vWorld;
/** How lit the face is; how far it looks up; how high on the die the point is, 0 at its foot. */
varying vec3 vStand;
varying vec4 vArrive;
varying float vDim;

void main() {
  #ifdef USE_INSTANCING
    mat4 placed = modelMatrix * instanceMatrix;
    vArrive = arrive;
    vDim = dim;
  #else
    mat4 placed = modelMatrix;
    vArrive = vec4(0.0, 0.0, 0.0, 1.0);
    vDim = uDim;
  #endif
  mat3 turned = mat3(placed);
  vec4 world = placed * vec4(position, 1.0);
  vec3 facing = normalize(turned * faceNormal);
  // The face on top is the one that counts, and is lit in full. The others all have one
  // lower light, a little apart from one side of the die to the next: the die has a shape.
  float up = clamp(facing.y, 0.0, 1.0);
  float side = uSide * (1.0 + uTilt * 0.5 * (facing.z - facing.x));
  vStand = vec3(mix(side, 1.0, up * up), up, (turned * position).y / ${CUBE_SIZE.toFixed(4)} + 0.5);
  vFace = face;
  vNormal = turned * normal;
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/**
 * The mesh of the dots of the tube a thing that is not all here is drawn through, as lines of a
 * fragment shader: the order its dots go out in, and what leaves out of the picture the dots a
 * share `uCover` of them does not have, `uDot` being the size of a dot in pixels of the picture.
 * The dice that come and go are drawn through it.
 */
const DOT_MESH = /* glsl */ `/** The order the dots of a mesh of four by four go out in: evenly over it, never two neighbours in a row. */
const float MESH[16] = float[16](
  0.0, 8.0, 2.0, 10.0,
  12.0, 4.0, 14.0, 6.0,
  3.0, 11.0, 1.0, 9.0,
  15.0, 7.0, 13.0, 5.0
);`;
const THROUGH_DOTS = /* glsl */ `  if (uCover < 1.0) {
    // The mesh stands on the screen, not on the die: the die goes down through it.
    vec2 spot = floor(gl_FragCoord.xy / uDot);
    int at = int(mod(spot.x, 4.0)) + int(mod(spot.y, 4.0)) * 4;
    if ((MESH[at] + 0.5) / 16.0 > uCover) discard;
  }`;

/**
 * A die is a body with six screens. A face gives its own light, the colour of its channel as
 * it is, and no lamp changes it; its pips are the places where the screen is not lit. Along
 * the middle of the rounded edges of the body runs a pale line of light, and the faces run up
 * to it: nothing dark stands between a face and its edge. `EMIT` leaves only what the tube
 * spreads light around: the face on top,
 * the edges, the red of the one. `GLASS` is the die that is not all here: its edges are drawn
 * over it in the colour of its channel, and it is drawn through a mesh of the dots of the tube,
 * the way a console that could not blend made a thing half here; a tube runs such a mesh
 * together. Near its full height a die that comes up shows the line of its own edges as well,
 * in the colour of its channel; standing, it keeps that colour for a moment and lets it go
 * to the pale of the program, and only then gives its light to the tube.
 *
 * A fixed die that no combo has lit yet looks dead: its faces are the colours of their channels
 * faded, washed out by as much as the look says and keeping as much of their light as it says,
 * so the channel can still be told; its edges keep a share of their light, its pips are where
 * they were, and it gives the tube nothing but those edges.
 */
const FRAGMENT = /* glsl */ `
uniform vec3 uChannels[6];
uniform vec3 uSignal;
uniform vec3 uPipDark;
uniform vec3 uEdge;
/** Radius of a pip; how many times larger the pip of the one is; how far the dusk around a pip reaches, in radii; how dark it is. */
uniform vec4 uPip;
/** How much a face darkens towards its edges; how much the sides darken towards the foot; what is left of a face that does not work. */
uniform vec3 uFace;
/** Half the width of the line of an edge; how bright it is; how far its light spreads over the face; how bright that light is. */
uniform vec4 uLine;
/** What the edges that are not around the face on top keep of their light. */
uniform float uLineSide;
/** The faces that do not work, a bit for each. */
uniform int uCrossed;
/** How much brighter than it stands the die is at this moment. */
uniform float uLift;
uniform vec3 uLamp;
uniform vec3 uLampColour;
uniform float uOpacity;
uniform vec3 uFrost;
/** The share of the dots of the tube a die that is not all here has, and the size of a dot in pixels of the picture. */
uniform float uCover;
uniform float uDot;
/** The line of the edges of a glass die: the light of its channel, as much of it as there is. */
uniform vec3 uOwn;
/** What the edges keep of their light in the picture the tube spreads. */
uniform float uEmitEdge;
/** A fixed die that is not lit: how much of the colour of its faces is washed out, what they keep of their light, and what its edges keep. */
uniform vec3 uFixed;

varying vec3 vFace;
varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vStand;
varying vec4 vArrive;
varying float vDim;

const float STEP = ${PIP_STEP.toFixed(4)};
/** The pips of each value, a bit for each place of three by three, row by row from the top. */
const int PIPS[7] = int[7](0, 16, 257, 273, 325, 341, 365);
${DOT_MESH}

void main() {
#ifdef GLASS
${THROUGH_DOTS}
#endif
  int value = int(vFace.z + 0.5);
  vec2 uv = vFace.xy;
  // The pips are laid out from the top down.
  vec2 p = vec2(uv.x, 1.0 - uv.y);
  // How far in from the side of the face: its side lies along the middle of the rounding.
  float border = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  // A pixel of the picture, in faces: every outline is that soft, and no softer.
  float px = length(fwidth(uv)) * 0.7071;

  vec2 grid = (p - 0.5) / STEP;
  vec2 node = value == 1 ? vec2(0.0) : clamp(floor(grid + 0.5), -1.0, 1.0);
  int place = int(node.x + 1.0) + int(node.y + 1.0) * 3;
  float away = ((PIPS[value] >> place) & 1) == 1 ? length((grid - node) * STEP) : 1.0;
  float radius = uPip.x * (value == 1 ? uPip.y : 1.0);
  float pip = 1.0 - smoothstep(radius - px, radius + px, away);

  bool off = ((uCrossed >> (value - 1)) & 1) == 1;
  float up = vStand.y;
  float screen = 1.0 - uFace.x * smoothstep(0.1, 0.7, length(uv - 0.5));
  vec3 tint = uChannels[value - 1];
  // The screens of a fixed die are out: the channel faded, towards the pale of its brightest part, and with less light.
  tint = mix(tint, mix(tint, vec3(max(max(tint.r, tint.g), tint.b)), uFixed.x) * uFixed.y, vDim);
  vec3 normal = normalize(vNormal);
  float rim = mix(uLineSide, 1.0, smoothstep(0.2, 0.6, normal.y));
  float line = 1.0 - smoothstep(uLine.x - px, uLine.x + px, border);
#ifdef GLASS
  vec3 edge = uOwn;
#else
  // A die that has just come up has the line of its edges in the colour of its channel still.
  vec3 edge = mix(vArrive.rgb, uEdge, vArrive.a);
#endif
  edge *= mix(1.0, uFixed.z, vDim);

#ifdef EMIT
  // Light is the colour of a channel at its fullest: a blue face spreads as much of it as a
  // yellow one. A face with little colour in it spreads less: white would outshine the six.
  float most = max(max(tint.r, tint.g), max(tint.b, 0.001));
  vec3 pure = tint / most * (0.6 + 0.4 * (most - min(min(tint.r, tint.g), tint.b)) / most);
  // A screen that is out gives the tube nothing.
  vec3 colour = off ? vec3(0.0) : pure * (up * up * screen * (1.0 - pip) * (1.0 + uLift) * (1.0 - vDim));
  // The pip of the one is lit: it is the seventh.
  if (value == 1) colour = mix(colour, uSignal, pip * up * up);
  // A die that has just come up gives its light to the tube little by little.
  colour *= vArrive.a;
  colour += edge * (rim * line * uLine.y * uEmitEdge * (1.0 + uLift));
  gl_FragColor = vec4(colour, 1.0);
#else
  float power = vStand.x * (1.0 - uFace.y * (1.0 - up) * (1.0 - vStand.z));
  power *= off ? uFace.z : 1.0 + uLift;
  // Around a pip the screen is a little less lit: a place that is out has no sharp end.
  float dusk = uPip.w * (1.0 - smoothstep(radius, radius * (1.0 + uPip.z), away));
  vec3 colour = tint * (power * screen * (1.0 - dusk));
  vec3 mark = value == 1 ? uSignal * min(1.0, power) : uPipDark;
  colour = mix(colour, mark, pip);
  if (off) {
    // Crossed out quietly: a dark line with a pale one in it reads on a light face and on a dark one.
    vec2 q = abs(p - 0.5);
    float reach = 1.0 - smoothstep(0.3 - px, 0.3 + px, max(q.x, q.y));
    float gap = min(abs(p.x - p.y), abs(p.x + p.y - 1.0)) * 0.7071;
    colour *= 1.0 - 0.4 * reach * (1.0 - smoothstep(0.0275 - px, 0.0275 + px, gap));
    colour += vec3(0.028) * reach * (1.0 - smoothstep(0.011 - px, 0.011 + px, gap));
  }
  colour += edge * (rim * (line * uLine.y + exp(-border / max(uLine.z, 0.0001)) * uLine.w) * (1.0 + uLift));
  // A group going down lights what stands around it: the body takes that light as matter does.
  vec3 toLamp = uLamp - vWorld;
  float span = max(length(toLamp), 0.001);
  float fall = pow(clamp(1.0 - pow(span / 7.0, 4.0), 0.0, 1.0), 2.0) / max(pow(span, 1.6), 0.01);
  colour += tint * uLampColour * (fall * max(dot(normal, toLamp / span), 0.0) * 0.3183 * (1.0 - pip));
  gl_FragColor = vec4(colour + uFrost, uOpacity);
#endif
  #include <colorspace_fragment>
}
`;

/** A die whose every point knows where on which face it lies: a single draw, and no picture to read. */
function dieGeometry(round: number): THREE.BufferGeometry {
  const geometry =
    round > 0
      ? new RoundedBoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE, 3, round)
      : new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
  const uv = geometry.getAttribute('uv');
  const index = geometry.getIndex();
  const face = new Float32Array(uv.count * 3);
  const faceNormal = new Float32Array(uv.count * 3);
  for (const group of geometry.groups) {
    const side = group.materialIndex ?? 0;
    for (let i = group.start; i < group.start + group.count; i++) {
      const vertex = index ? index.getX(i) : i;
      face.set([uv.getX(vertex), uv.getY(vertex), CANONICAL_FACE_VALUES[side]], vertex * 3);
      faceNormal.set(FACE_NORMALS[side], vertex * 3);
    }
  }
  geometry.setAttribute('face', new THREE.BufferAttribute(face, 3));
  geometry.setAttribute('faceNormal', new THREE.BufferAttribute(faceNormal, 3));
  geometry.clearGroups();
  return geometry;
}

function smoothstep(from: number, to: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - from) / Math.max(1e-6, to - from)));
  return t * t * (3 - 2 * t);
}

/** A share of light as the eye takes it, as the share of it the picture is worked out in. */
function light(share: number): number {
  return Math.pow(Math.max(0, share), 2.2);
}

/**
 * The dice of the board. Those at rest and on the move are all one draw: they are the same
 * matter and differ only in where they stand and how they are turned. The lit edges of the
 * glass ones are one draw too. A glass die itself is a draw of its own: every such die is here
 * to a degree of its own, and they are seen through one another in the order they stand in.
 *
 * A draw is a round of talk with the graphics card, and on a phone thirty of them where two
 * would do take a good part of the time a frame has.
 */
export class CubeMeshes {
  readonly group = new THREE.Group();
  private readonly geometry: THREE.BufferGeometry;
  /** What every die is drawn from, whatever it is drawn as: one set of numbers for all of them. */
  private readonly shared = {
    uChannels: { value: [1, 2, 3, 4, 5, 6].map(() => new THREE.Color()) },
    uSignal: { value: new THREE.Color() },
    uPipDark: { value: new THREE.Color() },
    uEdge: { value: new THREE.Color() },
    uPip: { value: new THREE.Vector4() },
    uFace: { value: new THREE.Vector3() },
    uLine: { value: new THREE.Vector4() },
    uLineSide: { value: 1 },
    uSide: { value: 1 },
    uTilt: { value: 0 },
    uCrossed: { value: 0 },
    uLift: { value: 0 },
    uLamp: { value: new THREE.Vector3() },
    uLampColour: { value: new THREE.Color(0) },
    uEmitEdge: { value: 0 },
    uFixed: { value: new THREE.Vector3(0, 1, 1) },
    uDot: { value: 4 },
  };
  private readonly material: DieMaterial;
  /** The same dice as the light they give off alone. */
  private readonly emitted: DieMaterial;
  /** Every solid die, each at its own place. */
  private readonly solids: THREE.InstancedMesh<THREE.BufferGeometry, DieMaterial>;
  /** The solid dice have a shape of their own: each of them carries how far it has settled. */
  private readonly solidGeometry: THREE.BufferGeometry;
  private readonly arrivals: THREE.InstancedBufferAttribute;
  /** And whether it is a fixed die that is not lit: 1, or 0. */
  private readonly dims: THREE.InstancedBufferAttribute;
  /** The dice that have just come up, by cube: how far each has settled, 0 to 1. */
  private readonly settling = new Map<number, number>();
  /** The glass dice as the last frame drew them, by cube: how high, how many of their dots, which face on top. */
  private readonly shown = new Map<number, { height: number; cover: number; value: number }>();
  /** The twelve edges of a die, as the ends of their lines around its middle. */
  private readonly outline: Float32Array;
  /** The lit edges of every glass die, in the colour each of them has. */
  private readonly edges: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private readonly edgePlaces: THREE.BufferAttribute;
  private readonly edgeColours: THREE.BufferAttribute;
  private readonly channels: THREE.Color[] = [];
  /** The glass dice now on the board, by the cube they show. */
  private readonly worn = new Map<number, GlassDie>();
  /**
   * Glass dice nothing wears at the moment, unseen. They are kept and handed to the next cube
   * that needs one: the program glass is drawn with lives as long as one material of it does,
   * and building it again in the middle of a session holds a frame up.
   */
  private readonly spare: GlassDie[] = [];
  private readonly alive = new Set<number>();
  private readonly matrix = new THREE.Matrix4();
  private readonly at = new THREE.Vector3();
  private readonly turn = new THREE.Quaternion();
  private readonly whole = new THREE.Vector3(1, 1, 1);
  private readonly colour = new THREE.Color();
  /** The light of the die in hand: that of its channel, or the grey of it. */
  private readonly light = new THREE.Color();
  private readonly tmpVec = new THREE.Vector3();

  constructor(
    palette: Palette,
    private readonly values: ParamValues,
  ) {
    const round = Number(values.dieRound);
    this.geometry = dieGeometry(round);
    this.material = this.dieMaterial('solid');
    this.emitted = this.dieMaterial('emit');
    this.solidGeometry = this.geometry.clone();
    this.arrivals = new THREE.InstancedBufferAttribute(new Float32Array(MAX_DICE * 4).fill(1), 4);
    this.arrivals.setUsage(THREE.DynamicDrawUsage);
    this.solidGeometry.setAttribute('arrive', this.arrivals);
    this.dims = new THREE.InstancedBufferAttribute(new Float32Array(MAX_DICE), 1);
    this.dims.setUsage(THREE.DynamicDrawUsage);
    this.solidGeometry.setAttribute('dim', this.dims);
    this.solids = new THREE.InstancedMesh(this.solidGeometry, this.material, MAX_DICE);
    this.solids.count = 0;
    this.solids.frustumCulled = false;
    this.solids.layers.enable(GLOW_LAYER);

    const frame = CUBE_SIZE - round * EDGE_INSET;
    const box = new THREE.BoxGeometry(frame, frame, frame);
    const outline = new THREE.EdgesGeometry(box);
    this.outline = Float32Array.from(outline.getAttribute('position').array);
    box.dispose();
    outline.dispose();
    this.edgePlaces = new THREE.BufferAttribute(new Float32Array(MAX_DICE * this.outline.length), 3);
    this.edgeColours = new THREE.BufferAttribute(new Float32Array(MAX_DICE * this.outline.length), 3);
    this.edgePlaces.setUsage(THREE.DynamicDrawUsage);
    this.edgeColours.setUsage(THREE.DynamicDrawUsage);
    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute('position', this.edgePlaces);
    edgeGeometry.setAttribute('color', this.edgeColours);
    // The edges of one die, of no size, until the first frame: something to be made ready with.
    edgeGeometry.setDrawRange(0, this.outline.length / 3);
    // Drawn with the glass, after it: the edges of the far side show through the die.
    this.edges = new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ transparent: true, vertexColors: true }));
    this.edges.frustumCulled = false;
    // Over the glass they belong to, whichever of the two is nearer.
    this.edges.renderOrder = 2;
    // The edges of the glass are light, and the tube spreads it.
    this.edges.layers.enable(GLOW_LAYER);
    this.group.add(this.solids, this.edges);
    this.setPalette(palette);

    // One glass die is there from the start, unseen: the board has none when it is made
    // ready, and what glass is drawn with has to be there to be made ready with it.
    this.spare.push(this.glassDie());
  }

  /**
   * The faces that do not work in the run go out and are crossed out: on a level that names
   * its faces, every other one.
   */
  private markFaces(state: RunState): void {
    const faces = state.levelRun?.spec.faces;
    let crossed = 0;
    if (faces) for (let face = 1; face <= 6; face++) if (!faces.includes(face)) crossed |= 1 << (face - 1);
    this.shared.uCrossed.value = crossed;
  }

  /** The colours have changed with the hour, or the look has: every die is drawn from them from now on. */
  setPalette(palette: Palette): void {
    const { shared, values } = this;
    const n = (name: string): number => Number(values[name] ?? 0);
    // Light is paler than the channel it belongs to, so that the darkest of them still shows
    // in the dark. The one is not a channel: its light is the red of its pip.
    for (let value = 1; value <= 6; value++) {
      this.channels[value - 1] = new THREE.Color(value === 1 ? palette.signal : mixHex(palette.channels[value - 1], '#ffffff', EDGE_PALE));
      shared.uChannels.value[value - 1].set(mixHex(palette.channels[value - 1], '#000000', n('faceMute')));
    }
    shared.uSignal.value.set(palette.signal);
    shared.uPipDark.value.set(String(values.pipDark));
    shared.uEdge.value.set(mixHex(palette.ink, '#ffffff', n('edgePale')));
    shared.uPip.value.set(n('pipSize'), n('pipOne'), n('pipDusk'), n('pipDuskDark'));
    shared.uFace.value.set(n('faceShade'), n('sideFall'), light(n('faceOff')));
    shared.uLine.value.set(n('edgeWidth') / 2, light(n('edgeBright')), n('edgeSpread'), light(n('edgeGlow')));
    shared.uLineSide.value = light(n('edgeSide'));
    shared.uSide.value = light(n('faceSide'));
    shared.uTilt.value = n('sideTilt');
    shared.uEmitEdge.value = n('glowEdge');
    shared.uFixed.value.set(n('fixedFade'), n('fixedLight'), n('fixedEdge'));
  }

  /** A die has come up to its full height: it stands from now on, and settles into a die that stands. */
  risen(cubeId: number): void {
    this.settling.set(cubeId, 0);
  }

  /** A new board: no die of it has just come up. */
  reset(): void {
    this.settling.clear();
    this.shown.clear();
  }

  /**
   * A die has been taken away. If it was glass and there was still something of it to see,
   * says what: where it stood, up to what height, what share of its dots it had and the light
   * of its channel. Null for a die that had gone out by itself, or was never glass.
   */
  left(cubeId: number): { x: number; z: number; top: number; share: number; colour: THREE.Color } | null {
    const die = this.worn.get(cubeId);
    const seen = this.shown.get(cubeId);
    if (!die || !seen || seen.height < 0.03 || seen.cover <= 0) return null;
    return {
      x: die.position.x,
      z: die.position.z,
      top: die.position.y + CUBE_SIZE / 2 + this.group.position.y,
      share: seen.cover * Math.min(1, seen.height + 0.15),
      colour: this.channels[seen.value - 1],
    };
  }

  /**
   * Turns the dice into the light they give off, and back: for the small picture of it that
   * the tube spreads. The glass dice are not in that picture; their edges are.
   */
  emitting(on: boolean): void {
    this.solids.material = on ? this.emitted : this.material;
  }

  /** The sinking cubes of running reactions, for the reaction light. */
  sinkingCentre(state: RunState): { x: number; z: number; count: number } {
    let x = 0;
    let z = 0;
    let count = 0;
    for (const cube of state.cubes) {
      if (cube.state !== 'sinking') continue;
      x += cube.x;
      z += cube.z;
      count++;
    }
    return count > 0 ? { x: x / count, z: z / count, count } : { x: 0, z: 0, count: 0 };
  }

  private look(cube: Cube, state: RunState): Look {
    if (cube.state === 'idle' || cube.state === 'moving') return 'idle';
    const height = cubeHeight(cube, state.config);
    if (cube.state === 'rising') return height <= state.config.mountHeight ? 'risingLow' : 'rising';
    // On a level a die that sinks is glass at once, the one under the player like any other.
    return height <= state.config.sinkLowHeight ? 'sinkingLow' : 'sinking';
  }

  /**
   * `passing` is how the dice stand in a passage between two boards, null outside one: a die
   * of a board that is passed stands whole until it is lit and then goes down by its own time,
   * and a die of a board that comes is not there until its turn, comes up as a die comes in a
   * session, and then stands as the rules have it.
   */
  sync(state: RunState, alpha: number, glow: CubeGlow, dip: (cubeId: number) => number, passing: DicePassing | null = null): void {
    const n = (name: string): number => Number(this.values[name] ?? 0);
    this.markFaces(state);
    const { shared } = this;
    shared.uLift.value = glow.idle * LIFT;
    // The dice hang with their group: the light is told where it stands among them.
    shared.uLamp.value.set(glow.lamp.x, glow.lamp.y, glow.lamp.z);
    shared.uLampColour.value.copy(glow.lamp.colour).multiplyScalar(glow.lamp.power);
    shared.uDot.value = Math.max(1, glow.dot * n('meshDot'));
    const melt = n('sinkMelt');
    const gather = n('riseMelt');
    // Where every rising die can be stepped onto until it stands, there is no step to show among them.
    const mounts = state.config.mountHeight < 1;
    const settleMs = n('settleMs');
    for (const [id, settled] of this.settling) {
      const next = settleMs > 0 ? settled + glow.dt / settleMs : 1;
      if (next >= 1) this.settling.delete(id);
      else this.settling.set(id, next);
    }
    const arrivals = this.arrivals.array as Float32Array;
    const dims = this.dims.array as Float32Array;
    const fade = n('fixedFade');
    const dead = n('fixedLight');
    const body = n('glassBody');
    const low = n('glassLow');
    const solid = n('glassSolid');
    const frost = n('glassFrost');
    const edge = n('glassEdge');
    const { alive, outline } = this;
    const places = this.edgePlaces.array as Float32Array;
    const colours = this.edgeColours.array as Float32Array;

    alive.clear();
    let solids = 0;
    let glasses = 0;
    for (const cube of state.cubes) {
      let look = this.look(cube, state);
      // A die held by the tutorial stays put between ticks, and so does one on a level whose world stands.
      let height = look === 'idle' ? 1 : cubeHeight(cube, state.config, isHeld(state, cube) || !worldRuns(state) ? 0 : alpha);
      // What is left of the light a die of a combo took when it lit up.
      let lit = 0;
      const rank = passing?.ranks.get(cube.id);
      if (passing && rank !== undefined) {
        height = passingHeight(passing, rank, height);
        if (passing.mode === 'leave') {
          const gone = goneShare(passing, rank);
          // Gone under: there is nothing of it to draw.
          if (gone >= 1) continue;
          // Until its turn a die of the combo stands as it stood before the combo; one that the
          // combo left standing stands so until it goes.
          if (!isLit(passing, rank) || (cube.state !== 'sinking' && gone <= 0)) look = 'idle';
          else {
            look = 'sinking';
            lit = litFlash(passing, rank);
          }
        } else {
          const come = comeShare(passing, rank);
          if (come <= 0) continue;
          // It comes as a die comes in a session, whatever the rules have it as, and then is that.
          if (come < 1) look = 'rising';
        }
      }
      // The screens of a fixed die are out until its combo: it is lit when it goes.
      const dimmed = cube.fixed === true && look !== 'sinking' && look !== 'sinkingLow';
      if (look === 'idle') {
        if (solids >= MAX_DICE) continue;
        this.pose(cube, state, alpha);
        this.at.y += dip(cube.id);
        // A die that has just come up keeps the light of its channel on its edges and lets it go.
        const settled = this.settling.get(cube.id);
        const own = this.light.copy(this.channels[cube.ori.top - 1]);
        if (dimmed) own.setRGB(...faded(own.r, own.g, own.b, fade, dead));
        arrivals[solids * 4] = settled === undefined ? 0 : own.r;
        arrivals[solids * 4 + 1] = settled === undefined ? 0 : own.g;
        arrivals[solids * 4 + 2] = settled === undefined ? 0 : own.b;
        arrivals[solids * 4 + 3] = settled === undefined ? 1 : smoothstep(0, 1, settled);
        dims[solids] = dimmed ? 1 : 0;
        this.solids.setMatrixAt(solids++, this.matrix.compose(this.at, this.turn, this.whole));
        continue;
      }
      alive.add(cube.id);
      let die = this.worn.get(cube.id);
      if (!die) {
        die = this.spare.pop() ?? this.glassDie();
        die.visible = true;
        this.worn.set(cube.id, die);
      }
      const glass = die.material.uniforms;
      const faint = look === 'risingLow' || look === 'sinkingLow';
      // The nearer its full height, the more of the die is here: it comes up into being solid,
      // and stops being solid as it starts to go down.
      const here = body + (1 - body) * smoothstep(solid, 1, height);
      const sinking = look === 'sinking' || look === 'sinkingLow';
      // As much of the die as is here, so many dots of the tube it has. One that is going down
      // has fewer the further gone it is and none at the very end; one that is coming up
      // gathers them, and has them all when it stands. A low one at once has fewer: the step
      // that says it can be rolled over, or stepped onto.
      const share = Math.pow(height, MELT_CURVE);
      glass.uOpacity.value = here;
      glass.uCover.value = sinking
        ? (1 - melt * (1 - share)) * (faint ? low : 1)
        : (1 - gather * (1 - share)) * (faint && mounts ? low : 1);
      this.shown.set(cube.id, { height, cover: glass.uCover.value as number, value: cube.ori.top });
      // The frost is the light of the channel spread evenly over the die: its faces and pips
      // show through it, and none of them shines by itself.
      const channel = this.light.copy(this.channels[cube.ori.top - 1]);
      // A fixed die that comes has its screens out already: its light is its channel faded.
      if (dimmed) channel.setRGB(...faded(channel.r, channel.g, channel.b, fade, dead));
      glass.uDim.value = dimmed ? 1 : 0;
      (glass.uFrost.value as THREE.Color)
        .copy(channel)
        .multiplyScalar(frost * (1 - smoothstep(solid, 1, height)) + (sinking ? Math.max(cube.state === 'sinking' ? glow.flash : 0, lit) * FLASH_FROST : 0));
      // Near its full height a die that comes up shows the line of its own edges, in the colour
      // of its channel: the line it will stand with, before it lets the colour go.
      (glass.uOwn.value as THREE.Color).copy(channel).multiplyScalar(sinking ? 0 : smoothstep(OWN_LINE_FROM, 1, height));
      const y = height - 0.5 + dip(cube.id);
      die.position.set(cube.x, y, cube.z);
      die.quaternion.copy(quatFor(cube.ori));

      // Its edges, around where it stands: brighter on the way down, fainter while it is low.
      if (glasses >= MAX_DICE) continue;
      // A fixed die that comes has the fainter line of a fixed die, as it will stand with.
      const bright = (sinking ? Math.max(1, glow.sinking) : 1) * (faint && (sinking || mounts) ? low : 1) * (dimmed ? n('fixedEdge') : 1);
      this.colour.copy(channel).multiplyScalar(Math.min(1, edge * bright));
      const from = glasses++ * outline.length;
      for (let i = 0; i < outline.length; i += 3) {
        places[from + i] = outline[i] + cube.x;
        places[from + i + 1] = outline[i + 1] + y;
        places[from + i + 2] = outline[i + 2] + cube.z;
        colours[from + i] = this.colour.r;
        colours[from + i + 1] = this.colour.g;
        colours[from + i + 2] = this.colour.b;
      }
    }

    this.solids.count = solids;
    this.solids.visible = solids > 0;
    if (solids > 0) {
      this.solids.instanceMatrix.needsUpdate = true;
      this.arrivals.needsUpdate = true;
      this.dims.needsUpdate = true;
    }
    this.edges.geometry.setDrawRange(0, (glasses * outline.length) / 3);
    this.edges.visible = glasses > 0;
    if (glasses > 0) {
      this.edgePlaces.needsUpdate = true;
      this.edgeColours.needsUpdate = true;
    }
    for (const [id, die] of this.worn) {
      if (alive.has(id)) continue;
      die.visible = false;
      this.spare.push(die);
      this.worn.delete(id);
      this.shown.delete(id);
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.solidGeometry.dispose();
    this.material.dispose();
    this.emitted.dispose();
    this.solids.dispose();
    this.edges.geometry.dispose();
    this.edges.material.dispose();
    for (const die of this.worn.values()) die.material.dispose();
    for (const die of this.spare) die.material.dispose();
  }

  /**
   * What a die is drawn with. All of them read the same numbers of the look; a glass die has
   * its own for how much of it is here and how milky it is.
   */
  private dieMaterial(kind: 'solid' | 'glass' | 'emit'): DieMaterial {
    return new THREE.ShaderMaterial({
      uniforms: { ...this.shared, uOpacity: { value: 1 }, uFrost: { value: new THREE.Color(0) }, uCover: { value: 1 }, uOwn: { value: new THREE.Color(0) }, uDim: { value: 0 } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      defines: kind === 'emit' ? { EMIT: '' } : kind === 'glass' ? { GLASS: '' } : {},
      transparent: kind === 'glass',
      depthWrite: kind !== 'glass',
    });
  }

  /** A die that is not all here, unseen until a cube wears it. What lies behind it shows through; the die hides nothing. */
  private glassDie(): GlassDie {
    const die: GlassDie = new THREE.Mesh(this.geometry, this.dieMaterial('glass'));
    die.visible = false;
    this.group.add(die);
    return die;
  }

  /** Where a solid die stands and how it is turned, into `at` and `turn`. */
  private pose(cube: Cube, state: RunState, alpha: number): void {
    const move = cube.move;
    if (cube.state === 'moving' && move) {
      const p = Math.min(1, (cube.t + alpha) / state.config.actionTicks);
      if (move.kind === 'roll') {
        // Turn around the bottom edge shared by the two cells.
        const pivotX = (move.fromX + cube.x) / 2;
        const pivotZ = (move.fromZ + cube.z) / 2;
        this.turn.setFromAxisAngle(ROLL_AXIS[move.dir], (p * Math.PI) / 2);
        this.tmpVec.set(move.fromX - pivotX, 0.5, move.fromZ - pivotZ).applyQuaternion(this.turn);
        this.at.set(pivotX + this.tmpVec.x, this.tmpVec.y, pivotZ + this.tmpVec.z);
        this.turn.multiply(quatFor(move.prevOri));
      } else {
        this.at.set(move.fromX + (cube.x - move.fromX) * p, 0.5, move.fromZ + (cube.z - move.fromZ) * p);
        this.turn.copy(quatFor(cube.ori));
      }
      return;
    }
    this.at.set(cube.x, 0.5, cube.z);
    this.turn.copy(quatFor(cube.ori));
  }
}
