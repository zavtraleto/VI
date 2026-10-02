import * as THREE from 'three';

export interface Ps1Fog {
  color: THREE.ColorRepresentation;
  /** Distance from the camera where the fog starts and where nothing else is left. */
  near: number;
  far: number;
}

export interface Ps1Light {
  /** Unit vector towards the light, in world space. */
  direction: THREE.Vector3;
  /** 0 leaves the colours flat; 1 is the directional light alone, with no ambient part. */
  amount: number;
}

/**
 * Glints on a level surface that lies between the eye and the light, as on water. They are
 * cells of the view, not of the surface: far ones are as large on screen as near ones, and
 * there are more of them towards the horizon.
 */
export interface Ps1Glint {
  color: THREE.ColorRepresentation;
  /** 0..1, the share of the cells that are lit at the brightest place. */
  amount: number;
  /** Size of a cell as angles seen from the eye, in radians: across the view and down it. */
  cell: THREE.Vector2;
  /** Unit vector towards the light over the surface, as world x and z. */
  direction: THREE.Vector2;
  /** Half-width of the path of glints, as an angle in radians seen from the eye. */
  width: number;
  /** How many times a second a cell is lit or put out anew. */
  rate: number;
}

export interface Ps1Options {
  color?: THREE.ColorRepresentation;
  map?: THREE.Texture;
  vertexColors?: boolean;
  /** null leaves the surface out of the fog. */
  fog: Ps1Fog | null;
  /** Cells of the grid the vertices snap to, down the height of the picture; 0 turns it off. */
  snap: number;
  /** null leaves the surface unlit. Geometry without normals has to be unlit. */
  light: Ps1Light | null;
  /** Moved by the `uTime` uniform of the material, in seconds. */
  glint?: Ps1Glint | null;
}

const VERTEX = /* glsl */ `
uniform vec3 uColor;
uniform float uSnap;
uniform vec3 uLightDir;
uniform float uLightAmount;
uniform float uFogNear;
uniform float uFogFar;

varying vec3 vColor;
varying float vFog;
varying vec3 vAffineUv;
#ifdef PS1_GLINT
  varying vec3 vWorld;
#endif

void main() {
  #ifdef PS1_GLINT
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  #endif
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  vec4 clip = projectionMatrix * viewPosition;

  // Vertices land on a coarse grid of the screen, so geometry trembles as it moves.
  if (uSnap > 0.0 && clip.w > 0.0) {
    vec2 grid = 0.5 * uSnap * vec2(projectionMatrix[1][1] / projectionMatrix[0][0], 1.0);
    clip.xy = floor(clip.xy / clip.w * grid + 0.5) / grid * clip.w;
  }
  gl_Position = clip;

  // Light is worked out at the vertices only and blended between them.
  float light = 1.0;
  #ifdef PS1_LIGHT
    vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
    light = (1.0 - uLightAmount) + uLightAmount * max(dot(worldNormal, uLightDir), 0.0);
  #endif
  vColor = uColor * light;
  #ifdef USE_COLOR
    vColor *= color;
  #endif

  #ifdef PS1_FOG
    vFog = clamp((-viewPosition.z - uFogNear) / max(uFogFar - uFogNear, 0.0001), 0.0, 1.0);
  #else
    vFog = 0.0;
  #endif

  // GLSL ES 3.0 has no noperspective: multiplying by w here and dividing in the fragment
  // shader cancels the perspective correction, which leaves the texture swimming.
  vAffineUv = vec3(uv * clip.w, clip.w);
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uFogColor;
uniform sampler2D uMap;

varying vec3 vColor;
varying float vFog;
varying vec3 vAffineUv;

#ifdef PS1_GLINT
  uniform vec3 uGlintColor;
  uniform float uGlintAmount;
  uniform vec2 uGlintCell;
  uniform vec2 uGlintDir;
  uniform float uGlintEdge;
  uniform float uGlintRate;
  uniform float uTime;
  varying vec3 vWorld;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
#endif

void main() {
  vec3 colour = vColor;
  #ifdef PS1_MAP
    colour *= texture2D(uMap, vAffineUv.xy / vAffineUv.z).rgb;
  #endif
  colour = mix(colour, uFogColor, vFog);
  #ifdef PS1_GLINT
    // The path of light runs over the surface from under the eye towards the light, and is
    // at its fullest far away, where the surface is seen at a glancing angle.
    vec2 away = vWorld.xz - cameraPosition.xz;
    float reach = max(length(away), 0.0001);
    float down = atan(cameraPosition.y - vWorld.y, reach);
    float path = smoothstep(uGlintEdge, 1.0, dot(away / reach, uGlintDir));
    path *= path * (1.0 - 0.85 * smoothstep(0.0, 0.5, down));
    // Each cell is lit or dark by chance, and draws again at its own moment.
    vec2 cell = floor(vec2(atan(away.x, -away.y), down) / uGlintCell);
    float tick = floor(uTime * uGlintRate + hash(cell + 0.5) * 16.0);
    float lit = step(1.0 - uGlintAmount * path, hash(cell + tick * vec2(0.731, 1.377)));
    // Haze takes half of a glint, not all of it: light gets through where colour does not.
    float glint = max(lit, 0.2 * uGlintAmount * path) * (1.0 - 0.5 * vFog);
    colour = mix(colour, uGlintColor, glint);
  #endif
  gl_FragColor = vec4(colour, 1.0);
  #include <colorspace_fragment>
}
`;

/**
 * The material of the transmissions: vertices snapped to a grid, affine texture mapping,
 * light per vertex from one direction plus ambient, linear fog, glints for water. The low
 * resolution, the colour depth and the dither belong to the layer the scene is drawn into.
 */
export function ps1Material(options: Ps1Options): THREE.ShaderMaterial {
  const { map, fog, light, glint } = options;
  if (map) {
    map.magFilter = THREE.NearestFilter;
    map.minFilter = THREE.NearestFilter;
    map.generateMipmaps = false;
    map.needsUpdate = true;
  }
  const defines: Record<string, string> = {};
  if (map) defines.PS1_MAP = '';
  if (fog) defines.PS1_FOG = '';
  if (light) defines.PS1_LIGHT = '';
  if (glint) defines.PS1_GLINT = '';
  return new THREE.ShaderMaterial({
    defines,
    uniforms: {
      uColor: { value: new THREE.Color(options.color ?? 0xffffff) },
      uMap: { value: map ?? null },
      uSnap: { value: options.snap },
      uLightDir: { value: light ? light.direction.clone().normalize() : new THREE.Vector3(0, 1, 0) },
      uLightAmount: { value: light ? light.amount : 0 },
      uFogColor: { value: new THREE.Color(fog ? fog.color : 0x000000) },
      uFogNear: { value: fog ? fog.near : 0 },
      uFogFar: { value: fog ? fog.far : 1 },
      uGlintColor: { value: new THREE.Color(glint ? glint.color : 0xffffff) },
      uGlintAmount: { value: glint ? glint.amount : 0 },
      uGlintCell: { value: glint ? glint.cell.clone() : new THREE.Vector2(1, 1) },
      uGlintDir: { value: glint ? glint.direction.clone().normalize() : new THREE.Vector2(0, -1) },
      uGlintEdge: { value: glint ? Math.cos(glint.width) : 1 },
      uGlintRate: { value: glint ? glint.rate : 0 },
      uTime: { value: 0 },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    vertexColors: options.vertexColors ?? false,
  });
}
