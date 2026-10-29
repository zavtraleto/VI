import * as THREE from 'three';
import type { Display } from '../display/display';
import type { Layer, Rect } from '../display/layer';
import type { ParamValues } from '../signal/scene';
import { shapeKey, type BoardShape } from './board';

/** What of the scene of the board is seen in the water: the dice and the figure, and nothing that lies on the floor. */
export const REFLECT_LAYER = 3;
/** How far past the cells the rings of the water are counted, in cells: as far as the surface of the board goes. */
const MARGIN = 4;
/** Points along a side of the picture the rings are counted in. */
const RIPPLE_SIDE = 256;
/** Rings started on one frame: more than this and the rest are let go. */
const DROPS = 32;
/** How many times smaller along a side the picture of the mirror is than the layer of the board. */
const MIRROR_SHRINK = 4;
/** Lines of the picture of the water, and on a window narrower than this share of its height. */
const LINES = 240;
const TALL = 0.8;
const TALL_LINES = 400;
/** Never more than this many steps of the rings on a frame: a page that was away does not catch up. */
const STEPS_A_FRAME = 2;
const NOISE_SIDE = 128;
/** The far and the near of the camera of the water, in cells: the plane runs off the frame at any pitch. */
const DEEP = 400;
/** Rings from past the frame at one time. */
const OUTER = 3;

const FULL_VERTEX = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * One step of the rings: a height and how fast it changes at every point, the height drawn
 * towards that of its four neighbours (Hugo Elias, "2D Water"; GPU Gems, chapter 1). A ring
 * that starts is a hump with a trough around it that holds as much as the hump: the water is
 * moved, none is added. The edge of the picture takes what reaches it.
 */
const RIPPLE_FRAGMENT = /* glsl */ `
uniform sampler2D uWas;
uniform vec2 uTexel;
/** How hard a point is drawn to its neighbours; what of its speed a ring of a step loses on a step of the count, and a ring of a die. */
uniform vec3 uStep;
/** Rings that start on this step: where, in the picture (two further to the right for a ring of a die); how wide; how strong. */
uniform vec4 uDrops[${DROPS}];

varying vec2 vUv;

#ifdef BYTES
vec4 read(vec2 at) { return texture2D(uWas, at) * 2.0 - 1.0; }
#else
vec4 read(vec2 at) { return texture2D(uWas, at); }
#endif

void main() {
  // Two waters in one picture: the rings of the figure's steps, which last, and the rings of
  // the dice, which are gone sooner. A height and its speed for each.
  vec4 here = read(vUv);
  vec2 dx = vec2(uTexel.x, 0.0);
  vec2 dy = vec2(0.0, uTexel.y);
  vec2 beside = (read(vUv + dx) + read(vUv - dx) + read(vUv + dy) + read(vUv - dy)).rb;
  vec2 across = (read(vUv + dx + dy) + read(vUv + dx - dy) + read(vUv - dx + dy) + read(vUv - dx - dy)).rb;
  // The eight neighbours, not four: counted by four a ring runs faster cornerwise than along
  // the lines of the picture, and a square one turns into a diamond as it goes.
  vec2 pull = (4.0 * beside + across - 20.0 * here.rb) / 6.0;
  vec2 speed = (here.ga + uStep.x * pull) * (1.0 - uStep.yz);
  vec2 height = (here.rb + speed) * 0.998;
  for (int i = 0; i < ${DROPS}; i++) {
    vec4 drop = uDrops[i];
    if (drop.w == 0.0) continue;
    float die = step(1.5, drop.x);
    // A die is square where it stands in the water, and its ring starts square, lying as the die lies; it
    // rounds off as it runs. What is round, the figure, starts a round one: its width is given under nought.
    vec2 from = (vUv - vec2(drop.x - 2.0 * die, drop.y)) / abs(drop.z);
    float far = dot(from, from);
    // The round one is a hump with a trough around it that holds as much. The square one is the foot of the die
    // pressed flat into the water: a hump with a trough would send its ring off cornerwise, as a diamond,
    // the hump and the trough of each flat side cancelling straight ahead of it.
    vec2 foot = 1.0 - smoothstep(0.65, 1.1, abs(from));
    float lift = drop.z < 0.0 ? (1.0 - far) * exp(-far) : foot.x * foot.y * 0.6;
    height += drop.w * lift * vec2(1.0 - die, die);
  }
  vec2 edge = min(vUv, 1.0 - vUv);
  float kept = smoothstep(0.0, 0.05, min(edge.x, edge.y));
  vec4 next = vec4(height.x, speed.x, height.y, speed.y) * kept;
#ifdef BYTES
  gl_FragColor = clamp(next, -1.0, 1.0) * 0.5 + 0.5;
#else
  gl_FragColor = next;
#endif
}
`;

/** The rings of one picture read at the places of another: where the other has none, the water is flat. */
const CARRY_FRAGMENT = /* glsl */ `
uniform sampler2D uWas;
/** From a place of this picture to the same place of the world in the picture before: times, and plus. */
uniform vec4 uMap;

varying vec2 vUv;

void main() {
  vec2 at = vUv * uMap.xy + uMap.zw;
  vec2 inside = step(vec2(0.0), at) * step(at, vec2(1.0));
  vec2 edge = min(vUv, 1.0 - vUv);
  float kept = inside.x * inside.y * smoothstep(0.0, 0.05, min(edge.x, edge.y));
#ifdef BYTES
  gl_FragColor = (texture2D(uWas, at) * 2.0 - 1.0) * kept * 0.5 + 0.5;
#else
  gl_FragColor = texture2D(uWas, at) * kept;
#endif
}
`;

const WATER_VERTEX = /* glsl */ `
varying vec3 vWorld;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/**
 * The water. It is nearly black and is seen by what is in it: the dice stood on their heads, a
 * line of light on the side of a wave that is turned to the light, and something large and dim
 * under it. Only its slope is counted: seen from above with no perspective, a wave does not
 * move the place it is drawn at.
 */
const WATER_FRAGMENT = /* glsl */ `
uniform float uTime;
/** The dark of the water and the light of the program, as light adds up. */
uniform vec3 uDark;
uniform vec3 uTone;
/** The swell: height of its small humps, their size in cells, how fast they drift; height of the large ones. */
uniform vec4 uSwell;
/** Where the cell (0, 0) of the board lies; cells along its side; cells the rings are counted past it. */
uniform vec4 uField;
/** How still the water is under the cells; what the mirror loses there; how still it is in a cell cut out; how strong the rings are. */
uniform vec4 uCalm;
/** The mirror: how strong, and how far the slope moves it. The dice are drawn into it fading up from the water. */
uniform vec4 uMirrorLook;
/** The light on a wave; how far the slope moves what is under the water. */
uniform vec3 uLook;
/** The middle of the frame on the floor, and half of the frame across and in depth, in cells. */
uniform vec4 uFrame;
/** What the water gives back of the sky: how light it is, how large its shapes are in cells, how fast the currents carry it in cells a second, how far a slope moves it in cells. */
uniform vec4 uSky;
/** In how many seconds what the currents carry is let go and taken up afresh. */
uniform float uSkyFlow;
/** Clouds over the water, seen in it: how light, how large in cells, how fast the wind takes them in cells a second, what of the path of glints they hide. */
uniform vec4 uCloud;
/** What lies dark under the water: how dark, how large in cells, how fast it is carried in cells a second, how soft its edge is. */
uniform vec4 uShade;
/** Something that comes up out of the murk now and then: where, how large in cells, how far it has come, 0 to 1 (0: nothing). */
uniform vec4 uFace;
/** Right along the screen on the water, and up the screen, shortened as the water is seen: a cell up the screen is this much of a cell across it. */
uniform vec4 uFaceAxes;
/** What it is: below a half a face, above a blot folded in two; and a seed. */
uniform vec2 uFaceKind;
/** Rings that come from past the frame: where each started in the world, how far it has run, and how high it is now. */
uniform vec4 uOuter[${OUTER}];
/** How wide the crest of such a ring is, in cells. */
uniform float uOuterWidth;
/** A lamp over the water and the eye it is seen by, in the world: the glints of the lamp lie between the two. */
uniform vec3 uLampAt;
uniform vec3 uEyeAt;
/** How bright the glints are, and how tight. */
uniform vec2 uGlint;
/** The far of the water: how much lighter it is at the top of the frame; one over the height of the picture; what the rings lose under the cells of the board. */
uniform vec3 uFar;
uniform sampler2D uNoise;
uniform mat4 uReflect;
uniform sampler2D uMask;
uniform sampler2D uRipple;
uniform sampler2D uMirror;
uniform sampler2D uBelow;

varying vec3 vWorld;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

/**
 * The currents of the water at a place of the world, in cells: which way and how fast, at most
 * about one. They turn round on themselves and gather or spread nowhere - the curl of large soft
 * humps - and the humps go by so slowly that the currents change over minutes.
 */
vec2 current(vec2 at) {
  vec2 g = texture2D(uNoise, at * 0.0125 + vec2(0.0021, 0.0013) * uTime).gb;
  return vec2(g.y, -g.x) * 0.12;
}

/**
 * Soft noise, 0 to 1, at two sizes only: the edge of what is made of it stays simple, and a
 * simple edge is where the eye finds most things (Taylor et al., "Seeing shapes in seemingly
 * random spatial patterns: fractal analysis of Rorschach inkblots", 2017: the blots with the
 * fewest wrinkles on their edge are seen as the most things).
 */
float ink(vec2 p) {
  return 0.7 * texture2D(uBelow, p).r + 0.3 * texture2D(uBelow, p * 2.03 + 0.31).r;
}

/** Ink that a current has drawn out into threads: noise bent by noise. */
float threads(vec2 p) {
  vec2 bend = vec2(ink(p * 0.8 + vec2(0.13, 0.71)), ink(p * 0.8 + vec2(0.57, 0.29))) - 0.5;
  return ink(p + bend * 0.9);
}

/**
 * Two pictures of what a current carries, carried by turns: each is drawn out a little more on
 * its turn, faded out as the other is full and taken up afresh at a new place (a flow map, as in
 * Vlachos, "Water Flow in Portal 2", 2010). Two faded into one are flatter than either: what is
 * lost is given back. \`kind\` 0 is the sky, 1 the murk.
 */
float carried(vec2 at, vec2 flow, float period, float wide, float kind) {
  float turns = uTime / period + 0.25 * kind;
  float a = fract(turns);
  float b = fract(turns + 0.5);
  float wa = 1.0 - abs(2.0 * a - 1.0);
  vec2 ja = vec2(hash(vec2(floor(turns), 3.1 + kind)), hash(vec2(floor(turns), 7.7 + kind)));
  vec2 jb = vec2(hash(vec2(floor(turns + 0.5), 5.3 + kind)), hash(vec2(floor(turns + 0.5), 1.9 + kind)));
  vec2 pa = (at - flow * (a * period)) * wide + ja;
  vec2 pb = (at - flow * (b * period)) * wide + jb;
  float ca;
  float cb;
  if (kind < 0.5) {
    ca = 0.6 * texture2D(uNoise, pa).r + 0.3 * texture2D(uNoise, pa * 2.1 + 0.5).r + 0.1 * texture2D(uNoise, pa * 4.3 + 0.2).r;
    cb = 0.6 * texture2D(uNoise, pb).r + 0.3 * texture2D(uNoise, pb * 2.1 + 0.5).r + 0.1 * texture2D(uNoise, pb * 4.3 + 0.2).r;
  } else {
    ca = threads(pa);
    cb = threads(pb);
  }
  return 0.5 + (mix(cb, ca, wa) - 0.5) / sqrt(wa * wa + (1.0 - wa) * (1.0 - wa));
}

/**
 * The murk under the water: dark stuff that the deep currents carry and draw out into threads, as
 * cream is in coffee or milk in tea, slower than the light on top. It is not everywhere: it lies
 * in clouds of its own, which go their own way - now faster, now slower, turning as they go, and
 * a thing that changes its speed and its way is seen as alive (Tremoulet and Feldman, "Perception
 * of animacy from the motion of a single object", 2000) - and gather and part.
 */
float murk(vec2 at) {
  float wide = 1.0 / (8.0 * max(uShade.y, 0.3));
  vec2 flow = current(at * 0.7 + 13.0) * uShade.z;
  float d = carried(at, flow, max(1.0, uSkyFlow) * 1.6, wide, 1.0);
  float turn = 0.6 + 0.7 * sin(uTime * 0.017);
  vec2 gone = vec2(cos(turn), sin(turn)) * (uShade.z * (uTime + 5.0 * sin(uTime * 0.13)));
  float where = smoothstep(0.5, 0.8, ink((at - gone) * wide * 0.35 + 0.17));
  return smoothstep(0.52 - uShade.w * 0.5, 0.52 + uShade.w, d) * where;
}

/**
 * Now and then the murk comes together into something, holds a few seconds and runs apart: two
 * dark places side by side over a third, which the eye takes for a face (the eyes and the mouth
 * are what a face is found by: Omer et al., "What is a face? Critical features for face
 * detection", 2019), or a blot that is the same on its left and its right, as a Rorschach blot
 * is. Both stand upright on the screen: what is the same to the left and the right is seen as a
 * thing far more often. Its outline is the murk's own, so it never quite is anything.
 */
float presence(vec2 at) {
  if (uFace.w <= 0.0) return 0.0;
  vec2 d = at - uFace.xy;
  vec2 q = vec2(dot(d, uFaceAxes.xy), dot(d, uFaceAxes.zw)) / uFace.z;
  if (dot(q, q) > 4.0) return 0.0;
  float u = uFace.w;
  float shown = smoothstep(0.0, 0.4, u) * (1.0 - smoothstep(0.6, 1.0, u));
  // It comes out of the murk and goes back into it: smeared before and after.
  float smear = 0.15 + 0.6 * (1.0 - shown);
  vec2 s = vec2(abs(q.x), q.y);
  vec2 wob = vec2(ink(s * 0.9 + uFaceKind.y), ink(s * 0.9 + uFaceKind.y + 0.5)) - 0.5;
  vec2 w = s + wob * smear;
  vec2 h = w / vec2(0.85, 1.05);
  float hull = exp(-dot(h, h) * 1.6);
  float f;
  if (uFaceKind.x < 0.5) {
    vec2 e = (w - vec2(0.32, 0.2)) / vec2(0.15, 0.12);
    vec2 m = (w - vec2(0.0, -0.34)) / vec2(0.26, 0.08);
    f = max(exp(-dot(e, e)), 0.8 * exp(-dot(m, m))) + 0.25 * hull;
  } else {
    f = smoothstep(0.45, 0.7, ink(w * 0.8 + uFaceKind.y) * (0.4 + 0.9 * hull));
  }
  return clamp(f, 0.0, 1.0) * shown;
}

/** The clouds over the water at a place of the sky the water gives back, 0 to 1: large and soft, the wind takes them over. */
float clouds(vec2 sky) {
  float turn = 0.58 + 0.3 * sin(uTime * 0.01);
  vec2 p = (sky - vec2(cos(turn), sin(turn)) * (uTime * uCloud.z)) / (8.0 * max(uCloud.y, 0.5));
  float c = 0.6 * texture2D(uNoise, p).r + 0.3 * texture2D(uNoise, p * 2.03 + 0.37).r + 0.1 * texture2D(uNoise, p * 4.1 + 0.71).r;
  return smoothstep(0.38, 0.72, c);
}

float rings(vec2 at) {
  // The rings of the steps and the rings of the dice are one water to the eye.
  vec4 both = texture2D(uRipple, at);
#ifdef BYTES
  return (both.r + both.b) * 2.0 - 2.0;
#else
  return both.r + both.b;
#endif
}

void main() {
  vec2 at = vWorld.xz;
  vec2 cell = at - uField.xy;
  float size = uField.z;

  // The board is a stiff sheet on the water: under its cells the water is nearly still.
  float sheet = clamp(texture2D(uMask, (cell + 1.5) / (size + 2.0)).r * 2.0, 0.0, 1.0);
  vec2 out2 = max(-0.5 - cell, cell - (size - 0.5));
  float inside = 1.0 - smoothstep(-0.25, 0.25, max(out2.x, out2.y));
  float quiet = uCalm.x * mix(inside * uCalm.z, 1.0, sheet);

  // The swell is soft humps, not lines: the picture of them laid over the water three times.
  // Twice small, the two going different ways, so that what is seen of them never stands as a
  // pattern that slides (as the water of Super Mario Sunshine is two layers of one picture);
  // and once large and slow under them. Slopes are added, not normals mixed.
  float small = 1.0 / (8.0 * max(uSwell.y, 0.02));
  float large = small * 0.27;
  vec2 run = vec2(uSwell.z * uTime);
  vec2 turned = vec2(0.6157 * at.x - 0.7880 * at.y, 0.7880 * at.x + 0.6157 * at.y);
  vec2 one = texture2D(uNoise, at * small + run * vec2(0.9, 0.35) * small).gb;
  vec2 two = texture2D(uNoise, turned * small * 1.31 - run * vec2(0.3, 0.8) * small).gb;
  vec2 under = texture2D(uNoise, turned.yx * large + run * vec2(-0.5, 0.6) * large).gb;
  vec2 slope = one * (uSwell.x * small);
  slope += vec2(0.6157 * two.x + 0.7880 * two.y, -0.7880 * two.x + 0.6157 * two.y) * (uSwell.x * small * 1.31 * 0.8);
  slope += under.yx * (uSwell.w * large);

  float span = size + 2.0 * uField.w;
  vec2 ring = (cell + 0.5 + uField.w) / span;
  float texel = 1.0 / ${RIPPLE_SIDE.toFixed(1)};
  vec2 ringed = vec2(rings(ring + vec2(texel, 0.0)) - rings(ring - vec2(texel, 0.0)), rings(ring + vec2(0.0, texel)) - rings(ring - vec2(0.0, texel)));
  ringed *= (uCalm.w / (2.0 * texel * span)) * (1.0 - quiet * uFar.z);
  // Rings that come from past the frame, from nothing that is seen. Each is drawn as a ring of
  // a step is: one crest between two troughs, as low, only of a far larger circle. Come from
  // far, it is no line drawn over the water: it has grown wider on the way and lower for it,
  // and is strongest where it comes straight on and fades along itself to either side.
  vec2 outer = vec2(0.0);
  for (int i = 0; i < ${OUTER}; i++) {
    vec4 o = uOuter[i];
    if (o.w == 0.0) continue;
    vec2 from = at - o.xy;
    float r = max(length(from), 0.001);
    float grown = 1.0 + 0.05 * o.z;
    float x = (r - o.z) / (uOuterWidth * grown);
    // The slope of (1 - 2 x x) exp(-x x) across the ring: the crest, and a trough on each side.
    float rise = (4.0 * x * x * x - 6.0 * x) * exp(-x * x) / (uOuterWidth * grown);
    float on = smoothstep(0.5, 0.95, dot(from / r, normalize(uFrame.xy - o.xy + 0.0001)));
    outer += from * (o.w * rise * on / (r * sqrt(grown)));
  }
  ringed += outer * (1.0 - quiet * uFar.z);
  slope = slope * (1.0 - quiet) + ringed;
  vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));

  // Something dark moves deep under the water. It darkens the water itself, not what the water
  // gives back: the sky lies over it. Deep, so it is soft, and the swell rocks it far.
  vec2 deep = at + normal.xz * uLook.y;
  float shade = 1.0 - (1.0 - murk(deep)) * (1.0 - presence(deep));
  vec3 colour = uDark * (1.0 - uShade.x * shade * (1.0 - 0.5 * uCalm.y * sheet));

  // The sky is far off, so what of it is seen goes with the frame; a slope moves it, so it rocks
  // on the swell and a ring bends it. Clouds go over it on the wind, the light of the sky between
  // them, so no place of the water is always the lighter.
  vec2 sky = (at - uFrame.xy) + normal.xz * uSky.w;
  float cover = clouds(sky);
  // Over the murk the sky in the water is a little dimmer: the dark below shows through it, as a
  // stone at the bottom does through what a pond gives back.
  float bare = (1.0 - uCalm.y * sheet) * (1.0 - 0.35 * uShade.x * shade);
  // No part of the water is lighter for being far off: what is light is where a cloud is, and
  // the clouds go over all of it (29 October: «вся поверхность воды должна быть подвержена
  // движению»). What is left of the far is a hook, nought unless asked for.
  float far = smoothstep(0.15, 1.0, gl_FragCoord.y * uFar.y);
  colour += uTone * (uFar.x * far * far * cover * (1.0 - 0.35 * uShade.x * shade));
  colour += uTone * (uCloud.x * cover * bare);

  // In the clouds the sky has no lamp and no moon, and nothing in it is a cloud one could name:
  // lighter and darker shapes, large and soft, that the currents of the water carry, slower than
  // a ring runs, so they are drawn out and turn as a stain in still water does.
  float lit = smoothstep(0.35, 0.8, carried(sky, current(at) * uSky.z, max(1.0, uSkyFlow), 1.0 / (8.0 * max(uSky.y, 0.1)), 0.0));
  colour += uTone * (uSky.x * lit * (0.4 + 0.6 * cover) * bare);


  // The dice, stood on their heads: bright at the foot, fainter up the die.
  vec4 seen = uReflect * vec4(vWorld, 1.0);
  vec2 mirrorAt = seen.xy + normal.xz * uMirrorLook.y;
  vec4 mirror = texture2D(uMirror, mirrorAt);
  float held = uMirrorLook.x * (1.0 - uCalm.y * sheet);
  colour = colour * (1.0 - mirror.a * held) + pow(mirror.rgb, vec3(2.2)) * held;

  // A ring is seen all the way round: its own slope gives light on either side of it. The swell has no light of its own: the lamp shows it.
  colour += uTone * (uLook.x * min(1.0, length(ringed)));

  // A lamp stands over the water, and the water gives it back where a slope is turned just so
  // between the lamp and the eye: the glints gather into a path from the one to the other, and
  // beside the path the water is dark. With a camera that has no perspective and a light from
  // nowhere every place of the water would glint alike; so the eye and the lamp have places.
  vec3 toEye = normalize(uEyeAt - vWorld);
  vec3 toLamp = normalize(uLampAt - vWorld);
  float glint = pow(max(dot(normal, normalize(toEye + toLamp)), 0.0), uGlint.y);
  // The lamp is seen through the clouds as the moon is, the path lit under them and dim between:
  // the light goes over the water with them.
  colour += uTone * (uGlint.x * glint * mix(1.0, 1.3 * cover, uCloud.w));

  gl_FragColor = vec4(colour, 1.0);
  #include <colorspace_fragment>
}
`;

/** One triangle over the whole of a picture. */
function fullTriangle(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  return geometry;
}

/**
 * Soft humps that meet themselves at the edges of the picture: a height, 0 to 1, and beside it
 * how fast it changes to the right and upwards over one whole picture. The swell is this
 * picture laid over the water at several sizes; what passes under the water is its height.
 */
function noiseTexture(): THREE.DataTexture {
  const cells = 8;
  // The same numbers on every page: nothing of the picture is left to chance.
  let seed = 0x2f6e2b1;
  const random = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  // Large humps and, at half their height, humps half as large.
  const lattices = [1, 2].map((times) => ({ side: cells * times, values: Array.from({ length: (cells * times) ** 2 }, random) }));
  const smooth = (lattice: { side: number; values: number[] }, u: number, v: number): number => {
    const { side, values } = lattice;
    const at = (x: number, y: number): number => values[(((y % side) + side) % side) * side + (((x % side) + side) % side)];
    const fx = u * side;
    const fy = v * side;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    // Smoother than a cubic at the lattice: the slope of the hump has no crease there.
    const ease = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
    const sx = ease(fx - ix);
    const sy = ease(fy - iy);
    const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx;
    const bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx;
    return top + (bottom - top) * sy;
  };
  const height = new Float32Array(NOISE_SIDE * NOISE_SIDE);
  for (let y = 0; y < NOISE_SIDE; y++) {
    for (let x = 0; x < NOISE_SIDE; x++) {
      const u = x / NOISE_SIDE;
      const v = y / NOISE_SIDE;
      height[y * NOISE_SIDE + x] = (smooth(lattices[0], u, v) + 0.5 * smooth(lattices[1], u, v)) / 1.5;
    }
  }
  const h = (x: number, y: number): number => height[((y + NOISE_SIDE) % NOISE_SIDE) * NOISE_SIDE + ((x + NOISE_SIDE) % NOISE_SIDE)];
  const data = new Uint16Array(NOISE_SIDE * NOISE_SIDE * 4);
  const half = THREE.DataUtils.toHalfFloat;
  for (let y = 0; y < NOISE_SIDE; y++) {
    for (let x = 0; x < NOISE_SIDE; x++) {
      const at = (y * NOISE_SIDE + x) * 4;
      data[at] = half(h(x, y));
      data[at + 1] = half(((h(x + 1, y) - h(x - 1, y)) / 2) * NOISE_SIDE);
      data[at + 2] = half(((h(x, y + 1) - h(x, y - 1)) / 2) * NOISE_SIDE);
      data[at + 3] = half(1);
    }
  }
  const texture = new THREE.DataTexture(data, NOISE_SIDE, NOISE_SIDE, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** What the view of the board gives the water on a frame. */
export interface WaterFrame {
  /** The dark behind the board as this frame has it, and the light of the program. */
  dark: THREE.Color;
  tone: THREE.Color;
  /** The picture is turned inside out for this frame. */
  inverted: boolean;
  /** The player keeps motion low: the swell stands, no ring runs, the mirror is not moved. */
  still: boolean;
  /** How quiet the water is kept, 0 to 1: its swell goes down while a board is passed. */
  hush: number;
  /** Where the camera stands when no beat shakes it, with the whole board in view; null where the water follows the camera as it is. */
  home: THREE.Vector3 | null;
  /** The scene of the board, and its layer: what is seen in the water is drawn from them. */
  scene: THREE.Scene;
  board: Layer;
  /** Called around the drawing of the mirror, with how many times smaller its picture is and how fast the dice fade up from the water: they are cut at the water for it. */
  mirrored: (on: boolean, shrink: number, fade: number) => void;
}

/**
 * The water the board lies on. A probe (`docs/superpowers/specs/2026-10-13-vi-water-backdrop-probe.md`).
 *
 * One plane at the height of the floor, as large as the frame, drawn small into a layer of its
 * own under the board's: the layer of the board is clear wherever no die and no line is, so the
 * water shows around the board, in the cells cut out of it and between its dice. It is drawn
 * with the camera of the board, opened to the whole window.
 *
 * It reads the board and changes nothing of it. What happens on the board is told to it as
 * rings (`drop`), which run through a small picture of heights.
 */
export class Water {
  /** Drawn on this frame; its owner says so before the board is drawn. */
  on = false;
  private readonly layer: Layer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -DEEP, DEEP);
  private readonly mirrorCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 120);
  private readonly plane: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly noise = noiseTexture();
  private mask: THREE.DataTexture;
  private laid = '';
  private readonly origin = { x: 0, z: 0 };
  private size = 1;
  /** The rings: the picture as it is and as it was, changing places on every step. */
  private readonly ripples: THREE.WebGLRenderTarget[];
  private readonly bytes: boolean;
  private readonly stepScene = new THREE.Scene();
  private readonly stepCamera = new THREE.Camera();
  private readonly stepMaterial: THREE.ShaderMaterial;
  private readonly carryMaterial: THREE.ShaderMaterial;
  private readonly drops: THREE.Vector4[] = Array.from({ length: DROPS }, () => new THREE.Vector4());
  private pending = 0;
  private owed = 0;
  private mirror: THREE.WebGLRenderTarget | null = null;
  /** The time the swell is counted from, in seconds: it stands while motion is kept low. */
  private clock = 0;
  private fade = 0;
  /**
   * Rings that come from past the frame: where each started in the world, in cells, when by the
   * clock of the water, and how high. When the next one comes; where the frame was last.
   */
  private readonly outer: { x: number; z: number; at: number; height: number }[] = [];
  private readonly outerRings: THREE.Vector4[] = Array.from({ length: OUTER }, () => new THREE.Vector4());
  private nextOuter = -1;
  /** What comes up out of the murk: where, when by the clock of the water, what it is; when the next one comes. */
  private face: { x: number; z: number; at: number; kind: number; seed: number; size: number } | null = null;
  private nextFace = -1;
  /** How far past the frame they start, in cells. */
  private far = 0;
  private readonly seen = { x: 0, z: 0, reach: 1 };
  /** The same rings on every page: when and where they come is counted, not left to chance. */
  private seed = 0x51ab3c7;
  private readonly forward = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);

  constructor(
    private readonly display: Display,
    /** The layer of the board: the water lies under it. */
    under: Layer,
  ) {
    this.layer = display.addLayer({ name: 'water', lines: LINES, samples: 0, encoded: under.encoded, look: { opacity: 0, filter: 'linear' } }, under);

    const { extensions } = display.renderer;
    this.bytes = !(extensions.has('EXT_color_buffer_half_float') || extensions.has('EXT_color_buffer_float'));
    const picture = (): THREE.WebGLRenderTarget =>
      new THREE.WebGLRenderTarget(RIPPLE_SIDE, RIPPLE_SIDE, {
        type: this.bytes ? THREE.UnsignedByteType : THREE.HalfFloatType,
        depthBuffer: false,
        generateMipmaps: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
      });
    this.ripples = [picture(), picture()];
    const defines = this.bytes ? { BYTES: '' } : {};
    this.stepMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uWas: { value: null },
        uTexel: { value: new THREE.Vector2(1 / RIPPLE_SIDE, 1 / RIPPLE_SIDE) },
        uStep: { value: new THREE.Vector3() },
        uDrops: { value: this.drops },
      },
      vertexShader: FULL_VERTEX,
      fragmentShader: RIPPLE_FRAGMENT,
      defines,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    });
    this.carryMaterial = new THREE.ShaderMaterial({
      uniforms: { uWas: { value: null }, uMap: { value: new THREE.Vector4(1, 1, 0, 0) } },
      vertexShader: FULL_VERTEX,
      fragmentShader: CARRY_FRAGMENT,
      defines,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    });
    const step = new THREE.Mesh(fullTriangle(), this.stepMaterial);
    step.frustumCulled = false;
    this.stepScene.add(step);
    this.still();

    this.mask = this.maskOf({ size: 1, holes: [], origin: { x: 0, z: 0 } });
    this.plane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uDark: { value: new THREE.Color() },
          uTone: { value: new THREE.Color() },
          uSwell: { value: new THREE.Vector4() },
          uField: { value: new THREE.Vector4(0, 0, 1, MARGIN) },
          uCalm: { value: new THREE.Vector4() },
          uMirrorLook: { value: new THREE.Vector4() },
          uLook: { value: new THREE.Vector3() },
          uFrame: { value: new THREE.Vector4() },
          uSky: { value: new THREE.Vector4() },
          uSkyFlow: { value: 0 },
          uCloud: { value: new THREE.Vector4() },
          uShade: { value: new THREE.Vector4() },
          uFace: { value: new THREE.Vector4() },
          uFaceAxes: { value: new THREE.Vector4(1, 0, 0, 1) },
          uFaceKind: { value: new THREE.Vector2() },
          uOuter: { value: this.outerRings },
          uOuterWidth: { value: 1 },
          uLampAt: { value: new THREE.Vector3() },
          uEyeAt: { value: new THREE.Vector3() },
          uGlint: { value: new THREE.Vector2() },
          uFar: { value: new THREE.Vector3() },
          uNoise: { value: this.noise },
          uReflect: { value: new THREE.Matrix4() },
          uMask: { value: this.mask },
          uRipple: { value: this.ripples[0].texture },
          uMirror: { value: null },
          // A hook: a picture of anything can be given here to be the outline of what is under the water.
          uBelow: { value: this.noise },
        },
        vertexShader: WATER_VERTEX,
        fragmentShader: WATER_FRAGMENT,
        defines,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.plane.rotation.x = -Math.PI / 2;
    this.plane.frustumCulled = false;
    this.scene.add(this.plane);
    // The mirror is made ready with the rest: its picture is asked for before the first frame.
    this.plane.material.uniforms.uMirror.value = this.mirrorPicture(under).texture;
    void this.layer.warm(this.scene, this.camera);
  }

  /** The board that is on: where it lies, and which of its cells are there. The rings of the board before are let go. */
  setBoard(shape: BoardShape): void {
    const was = { x: this.origin.x, z: this.origin.z, span: this.size + MARGIN * 2, laid: this.laid !== '' };
    const moved = shape.origin.x !== this.origin.x || shape.origin.z !== this.origin.z;
    this.origin.x = shape.origin.x;
    this.origin.z = shape.origin.z;
    const key = shapeKey(shape);
    if (key !== this.laid) {
      this.laid = key;
      this.size = shape.size;
      this.mask.dispose();
      this.mask = this.maskOf(shape);
      this.plane.material.uniforms.uMask.value = this.mask;
    } else if (!moved) {
      return;
    }
    // The water is one water under every board: the rings that run on it are where they were
    // in the world, in the picture of the board that comes.
    if (was.laid) this.carry(was);
    else this.still();
  }

  /** Takes the rings over from the picture they were counted in, of a board that lay at `was`, into the picture of the board that is on. */
  private carry(was: { x: number; z: number; span: number }): void {
    const { renderer } = this.display;
    const span = this.size + MARGIN * 2;
    const { uniforms } = this.carryMaterial;
    (uniforms.uMap.value as THREE.Vector4).set(span / was.span, span / was.span, (this.origin.x - was.x) / was.span, (this.origin.z - was.z) / was.span);
    uniforms.uWas.value = this.ripples[0].texture;
    const mesh = this.stepScene.children[0] as THREE.Mesh;
    mesh.material = this.carryMaterial;
    renderer.setRenderTarget(this.ripples[1]);
    renderer.render(this.stepScene, this.stepCamera);
    renderer.setRenderTarget(null);
    mesh.material = this.stepMaterial;
    this.ripples.reverse();
    this.pending = 0;
    for (const drop of this.drops) drop.w = 0;
  }

  /**
   * A ring starts at a place of the world, in cells: `strength` is how high it is, `radius` how
   * wide, in cells; it starts square, as a die is, or round;
   * and it is a ring of a die, soon gone, or of a step, which lasts. A place the rings are not counted at is left out.
   */
  drop(x: number, z: number, strength: number, radius: number, square = true, die = true): void {
    if (!this.on || this.pending >= DROPS || strength === 0 || radius <= 0) return;
    const span = this.size + MARGIN * 2;
    const u = (x - this.origin.x + 0.5 + MARGIN) / span;
    const v = (z - this.origin.z + 0.5 + MARGIN) / span;
    if (u < 0 || u > 1 || v < 0 || v > 1) return;
    this.drops[this.pending++].set(die ? u + 2 : u, v, (square ? 1 : -1) * (radius / span), strength);
  }

  /**
   * Draws the water for this frame, with the camera of the board as it stands and the part of
   * the window `rect` the board goes to, in CSS pixels. Called before the board is drawn into
   * its own layer.
   */
  frame(dt: number, timeMs: number, camera: THREE.OrthographicCamera, rect: Rect, values: ParamValues, from: WaterFrame): void {
    const { layer, display } = this;
    if (!this.on) {
      this.hide();
      return;
    }
    const n = (name: string): number => Number(values[name] ?? 0);
    const { uniforms } = this.plane.material;
    const tall = display.width < display.height * TALL;
    layer.setLines(tall ? TALL_LINES : LINES);
    layer.look.opacity = 1;
    layer.look.invert = from.inverted;

    if (!from.still) this.clock += dt / 1000;
    this.rings(from.still ? 0 : dt, n);
    this.open(camera, rect, from.home);

    const reflects = n('reflectStrength') > 0;
    this.fade = n('reflectFade');
    if (reflects) this.reflect(from);

    uniforms.uTime.value = this.clock;
    (uniforms.uDark.value as THREE.Color).copy(from.dark).multiplyScalar(1 - n('waterDeep'));
    (uniforms.uTone.value as THREE.Color).copy(from.tone);
    const quiet = 1 - Math.min(1, Math.max(0, n('passCalm'))) * from.hush;
    (uniforms.uSwell.value as THREE.Vector4).set(n('swellHeight') * quiet, n('swellLength'), n('swellSpeed'), n('longSwell') * quiet);
    (uniforms.uField.value as THREE.Vector4).set(this.origin.x, this.origin.z, this.size, MARGIN);
    (uniforms.uCalm.value as THREE.Vector4).set(n('calm'), n('calmReflect'), n('holeCalm'), from.still ? 0 : 1);
    (uniforms.uMirrorLook.value as THREE.Vector4).set(reflects ? n('reflectStrength') : 0, from.still ? 0 : n('reflectWarp'), 0, 0);
    (uniforms.uFar.value as THREE.Vector3).set(n('farLight'), 1 / Math.max(1, layer.height), n('ringCalm'));
    (uniforms.uLook.value as THREE.Vector3).set(n('crestLight'), n('refract'), 0);
    (uniforms.uSky.value as THREE.Vector4).set(n('skyLight'), n('skySize'), n('skySpeed'), n('skyWarp'));
    uniforms.uSkyFlow.value = n('skyFlow');
    (uniforms.uCloud.value as THREE.Vector4).set(n('cloudLight'), n('cloudSize'), n('cloudSpeed'), n('cloudGlint'));
    (uniforms.uShade.value as THREE.Vector4).set(n('shadeDark'), n('shadeSize'), n('shadeSpeed'), n('shadeSoft'));
    uniforms.uRipple.value = this.ripples[0].texture;
    const { look, forward } = this;
    // The middle of the whole frame on the floor, and how far the frame reaches from it across and in depth.
    const own = this.camera;
    look.set((own.left + own.right) / 2, (own.top + own.bottom) / 2, 0).applyMatrix4(own.matrixWorld);
    const sunk = forward.y !== 0 ? -look.y / forward.y : 0;
    const across = (own.right - own.left) / 2;
    const depth = (own.top - own.bottom) / 2 / Math.max(0.3, Math.abs(forward.y));
    (uniforms.uFrame.value as THREE.Vector4).set(look.x + forward.x * sunk, look.z + forward.z * sunk, across, depth);
    this.seen.x = look.x + forward.x * sunk;
    this.seen.z = look.z + forward.z * sunk;
    this.seen.reach = Math.hypot(across, depth);
    this.outerFrame(n, from.still ? 0 : quiet);
    this.faceFrame(n, across, depth);
    uniforms.uOuterWidth.value = Math.max(0.1, n('outerWidth'));
    // The middle of the frame of the board on the floor: the lamp and the eye stand by it.
    look.set((camera.left + camera.right) / 2, (camera.top + camera.bottom) / 2, 0).applyMatrix4(camera.matrixWorld);
    const down = forward.y !== 0 ? -look.y / forward.y : 0;
    const midX = look.x + forward.x * down;
    const midZ = look.z + forward.z * down;
    // The lamp stands far off to the left, on the side the dice are lit from, and the eye near, below the frame.
    const flat = Math.hypot(forward.x, forward.z) || 1;
    const awayX = forward.x / flat;
    const awayZ = forward.z / flat;
    const half = (this.camera.top - this.camera.bottom) / 2;
    const side = n('lampSide');
    // The right of the camera lies level with the water: (awayZ, -awayX) turned the other way.
    const rightX = -awayZ;
    const rightZ = awayX;
    (uniforms.uLampAt.value as THREE.Vector3).set(midX + awayX * half * 5 + rightX * half * side * 2.4, half * 1.4, midZ + awayZ * half * 5 + rightZ * half * side * 2.4);
    (uniforms.uEyeAt.value as THREE.Vector3).set(midX - awayX * half * 2.6 + rightX * half * side * 0.5, half * 2, midZ - awayZ * half * 2.6 + rightZ * half * side * 0.5);
    (uniforms.uGlint.value as THREE.Vector2).set(n('glint'), Math.max(1, n('glintTight')));

    this.plane.position.set(this.camera.position.x, 0, this.camera.position.z);
    const reach = Math.max(this.camera.right - this.camera.left, this.camera.top - this.camera.bottom) * 6 + DEEP;
    this.plane.scale.set(reach, reach, 1);
    layer.render(this.scene, this.camera);
    void timeMs;
  }

  /**
   * Something comes up out of the murk now and then, on a time of its own and never on a beat,
   * somewhere in the frame and never under the board: a face, or a blot. It stands upright on
   * the screen, as the eye finds such things.
   */
  private faceFrame(n: (name: string) => number, across: number, depth: number): void {
    const { uniforms } = this.plane.material;
    const every = n('shadeFace');
    const life = 12;
    const face = uniforms.uFace.value as THREE.Vector4;
    if (every <= 0) {
      this.face = null;
      this.nextFace = -1;
      face.set(0, 0, 1, 0);
      return;
    }
    if (this.nextFace < 0 || this.nextFace > this.clock + every * 1.5) this.nextFace = this.clock + every * (0.3 + this.random());
    if (!this.face && this.clock >= this.nextFace) this.startFace(across, depth);
    const one = this.face;
    if (!one || this.clock - one.at >= life) {
      if (one) {
        this.face = null;
        this.nextFace = this.clock + every * (0.5 + this.random());
      }
      face.set(0, 0, 1, 0);
      return;
    }
    face.set(one.x, one.z, Math.max(0.5, n('shadeSize')) * one.size, Math.max(0.001, (this.clock - one.at) / life));
    (uniforms.uFaceKind.value as THREE.Vector2).set(one.kind, one.seed);
    const { forward } = this;
    const flat = Math.hypot(forward.x, forward.z) || 1;
    const awayX = forward.x / flat;
    const awayZ = forward.z / flat;
    const short = Math.max(0.3, Math.abs(forward.y));
    (uniforms.uFaceAxes.value as THREE.Vector4).set(-awayZ, awayX, awayX * short, awayZ * short);
  }

  /** Something comes up now, out of turn: the lab asks for one to look at. */
  presence(): void {
    const { uFrame } = this.plane.material.uniforms;
    const frame = uFrame.value as THREE.Vector4;
    this.face = null;
    this.startFace(frame.z, frame.w);
  }

  private startFace(across: number, depth: number): void {
    const { forward } = this;
    const flat = Math.hypot(forward.x, forward.z) || 1;
    const awayX = forward.x / flat;
    const awayZ = forward.z / flat;
    // Somewhere in the frame, off the board: under its cells the water is still and dim. Where
    // the board leaves no room, nothing comes this time.
    const low = { x: this.origin.x - 1.5, z: this.origin.z - 1.5 };
    const high = { x: this.origin.x + this.size + 0.5, z: this.origin.z + this.size + 0.5 };
    for (let i = 0; i < 20; i++) {
      const a = (this.random() * 2 - 1) * across * 0.75;
      const b = (this.random() * 2 - 1) * depth * 0.65;
      const x = this.seen.x - awayZ * a + awayX * b;
      const z = this.seen.z + awayX * a + awayZ * b;
      if (x >= low.x && x <= high.x && z >= low.z && z <= high.z) continue;
      this.face = { x, z, at: this.clock, kind: this.random() < 0.55 ? 0 : 1, seed: this.random() * 10, size: 0.8 + 0.5 * this.random() };
      return;
    }
  }

  /** A ring comes from past the frame now, out of turn: the lab asks for one to look at. */
  outerRing(): void {
    this.startOuter();
  }

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }

  /** A ring starts past the frame, on a side of it as chance has it, far enough off that where it starts is never seen. */
  private startOuter(): void {
    const turn = this.random() * Math.PI * 2;
    const off = this.seen.reach + this.far;
    if (this.outer.length >= OUTER) this.outer.shift();
    this.outer.push({ x: this.seen.x + Math.cos(turn) * off, z: this.seen.z + Math.sin(turn) * off, at: this.clock, height: 0.7 + 0.6 * this.random() });
  }

  /**
   * The rings from past the frame on this frame: one comes when its time is up, now and then and
   * never on a beat; each runs and dies out by the clock of the water, and stands while it does.
   * `quiet` is what of their height is shown: none while motion is kept low.
   */
  private outerFrame(n: (name: string) => number, quiet: number): void {
    const every = n('outerEvery');
    const speed = n('outerSpeed');
    const life = Math.max(0.1, n('outerLife'));
    this.far = n('outerFar');
    if (every <= 0) this.nextOuter = -1;
    else {
      if (this.nextOuter < 0 || this.nextOuter > this.clock + every * 1.5) this.nextOuter = this.clock + every * (0.3 + this.random());
      if (this.clock >= this.nextOuter) {
        this.startOuter();
        this.nextOuter = this.clock + every * (0.5 + this.random());
      }
    }
    // A ring that has died out is let go.
    while (this.outer.length > 0 && this.clock - this.outer[0].at > life * 5) this.outer.shift();
    this.outerRings.forEach((ring, i) => {
      const one = this.outer[i];
      if (!one) {
        ring.set(0, 0, 0, 0);
        return;
      }
      const age = this.clock - one.at;
      const height = n('outerHeight') * one.height * quiet * Math.min(1, age / 2) * Math.exp(-age / life);
      ring.set(one.x, one.z, speed * age, height);
    });
  }

  /** Nothing of the water is on screen. */
  hide(): void {
    this.layer.look.opacity = 0;
    this.pending = 0;
    for (const drop of this.drops) drop.w = 0;
  }

  dispose(): void {
    this.display.removeLayer(this.layer);
    this.plane.geometry.dispose();
    this.plane.material.dispose();
    this.stepMaterial.dispose();
    this.carryMaterial.dispose();
    for (const child of this.stepScene.children) (child as THREE.Mesh).geometry.dispose();
    for (const picture of this.ripples) picture.dispose();
    this.mirror?.dispose();
    this.mask.dispose();
    this.noise.dispose();
  }

  /**
   * The camera of the board, opened from the part of the window the board goes to, to the whole
   * of the window; standing at `home`, and not leant in, where one is given.
   */
  private open(camera: THREE.OrthographicCamera, rect: Rect, home: THREE.Vector3 | null): void {
    const own = this.camera;
    const { left, right, top, bottom } = camera;
    // A beat leans the camera in and shakes it: the water is drawn as if it did neither.
    const zoom = home ? 1 : camera.zoom;
    const middle = { x: (left + right) / 2, y: (top + bottom) / 2 };
    const half = { x: (right - left) / 2 / zoom, y: (top - bottom) / 2 / zoom };
    const per = { x: (half.x * 2) / Math.max(1, rect.width), y: (half.y * 2) / Math.max(1, rect.height) };
    const { width, height } = this.display;
    own.left = middle.x - half.x - rect.x * per.x;
    own.right = middle.x + half.x + (width - rect.x - rect.width) * per.x;
    own.top = middle.y + half.y + rect.y * per.y;
    own.bottom = middle.y - half.y - (height - rect.y - rect.height) * per.y;
    own.zoom = 1;
    own.position.copy(home ?? camera.position);
    own.quaternion.copy(camera.quaternion);
    own.updateProjectionMatrix();
    own.updateMatrixWorld();
    camera.getWorldDirection(this.forward);
  }

  /**
   * Draws what is seen in the water: the dice and the figure, by a camera that stands under the
   * water where the camera of the board stands over it (as `Reflector` of three.js has it). It
   * is turned, not mirrored, so every face is drawn as it is; what the turning puts on the other
   * side is the left and the right of its frame.
   */
  private reflect(from: WaterFrame): void {
    const { renderer } = this.display;
    const { camera, mirrorCamera, forward } = this;
    const target = this.mirrorPicture(from.board);
    mirrorCamera.position.set(camera.position.x, -camera.position.y, camera.position.z);
    mirrorCamera.up.set(0, -1, 0);
    this.look.set(mirrorCamera.position.x + forward.x, mirrorCamera.position.y - forward.y, mirrorCamera.position.z + forward.z);
    mirrorCamera.lookAt(this.look);
    mirrorCamera.left = -camera.right;
    mirrorCamera.right = -camera.left;
    mirrorCamera.top = camera.top;
    mirrorCamera.bottom = camera.bottom;
    mirrorCamera.updateProjectionMatrix();
    mirrorCamera.updateMatrixWorld();
    (this.plane.material.uniforms.uReflect.value as THREE.Matrix4).copy(this.bias).multiply(mirrorCamera.projectionMatrix).multiply(mirrorCamera.matrixWorldInverse);

    from.mirrored(true, MIRROR_SHRINK, this.fade);
    mirrorCamera.layers.set(REFLECT_LAYER);
    target.viewport.set(0, 0, target.width, target.height);
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, false);
    renderer.render(from.scene, mirrorCamera);
    renderer.setRenderTarget(null);
    from.mirrored(false, 1, 0);
  }

  /** The picture of the mirror: a part of the layer of the board in size, written as that layer is. */
  private mirrorPicture(board: Layer): THREE.WebGLRenderTarget {
    const width = Math.max(1, Math.ceil(board.width / MIRROR_SHRINK));
    const height = Math.max(1, Math.ceil(board.height / MIRROR_SHRINK));
    let target = this.mirror;
    if (!target) {
      target = new THREE.WebGLRenderTarget(width, height, {
        depthBuffer: true,
        generateMipmaps: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      });
      if (board.encoded) {
        // Written as the layer of the board is, sRGB in 8 bits: see `Layer.renderTarget`.
        target.texture.colorSpace = THREE.SRGBColorSpace;
        target.texture.internalFormat = 'RGBA8';
        (target as THREE.WebGLRenderTarget & { isXRRenderTarget: boolean }).isXRRenderTarget = true;
      }
      this.mirror = target;
    }
    if (target.width !== width || target.height !== height) target.setSize(width, height);
    return target;
  }

  /** The rings, as many steps on as the time that has gone asks for; none while the water stands. */
  private rings(dt: number, n: (name: string) => number): void {
    const hz = Math.max(1, n('rippleHz'));
    if (dt <= 0) {
      this.pending = 0;
      for (const drop of this.drops) drop.w = 0;
      return;
    }
    this.owed = Math.min(STEPS_A_FRAME, this.owed + (dt / 1000) * hz);
    const { renderer } = this.display;
    const { uniforms } = this.stepMaterial;
    // A ring runs as many cells in a second on a large board as on a small one: a point of the picture is larger there.
    const reach = (n('rippleSpeed') * RIPPLE_SIDE) / (hz * (this.size + MARGIN * 2));
    (uniforms.uStep.value as THREE.Vector3).set(Math.min(0.5, reach * reach), Math.min(1, Math.max(0, n('rippleDamp'))), Math.min(1, Math.max(0, n('dieDamp'))));
    while (this.owed >= 1) {
      this.owed -= 1;
      this.ripples.reverse();
      uniforms.uWas.value = this.ripples[1].texture;
      renderer.setRenderTarget(this.ripples[0]);
      renderer.render(this.stepScene, this.stepCamera);
      // A ring starts once.
      this.pending = 0;
      for (const drop of this.drops) drop.w = 0;
    }
    renderer.setRenderTarget(null);
  }

  /** The water of the board stands flat. */
  private still(): void {
    const { renderer } = this.display;
    const level = this.bytes ? 0.5 : 0;
    for (const picture of this.ripples) {
      renderer.setRenderTarget(picture);
      renderer.setClearColor(new THREE.Color(level, level, level), level);
      renderer.clear(true, false, false);
    }
    renderer.setRenderTarget(null);
    this.pending = 0;
    for (const drop of this.drops) drop.w = 0;
    this.owed = 0;
  }

  /** The cells of a board as a picture, a point to a cell and one more around them: 1 where a cell is, 0 where one is cut out and past the board. */
  private maskOf(shape: BoardShape): THREE.DataTexture {
    const side = shape.size + 2;
    const data = new Uint8Array(side * side * 4);
    const cut = new Set(shape.holes.map((cell) => `${cell.x},${cell.z}`));
    for (let z = 0; z < shape.size; z++) {
      for (let x = 0; x < shape.size; x++) {
        if (!cut.has(`${x},${z}`)) data[((z + 1) * side + x + 1) * 4] = 255;
      }
    }
    const texture = new THREE.DataTexture(data, side, side);
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }
}
