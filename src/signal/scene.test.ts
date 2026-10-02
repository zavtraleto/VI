import { describe, expect, it } from 'vitest';
import {
  LOOK_PARAMS,
  MOODS,
  captionLines,
  changedValues,
  defaultValues,
  sceneRecord,
  sceneValues,
  seededRandom,
  signalLook,
  variantValues,
  type SceneDef,
  type SceneInstance,
} from './scene';
import { SCENES, sceneById } from './scenes';
import { seaPole } from './scenes/seaPole';

const DEF: SceneDef = {
  id: 'test',
  params: {
    height: { kind: 'number', value: 8, min: 1, max: 20, step: 0.5 },
    sky: { kind: 'color', value: '#aabbcc' },
    broken: { kind: 'boolean', value: false },
    ...LOOK_PARAMS,
  },
  variants: {
    a: {},
    b: { broken: true, height: 5 },
    stray: { broken: true, unknown: 3 },
  },
  moods: {
    dream: {},
    sad: { sky: '#445566' },
    strange: { height: 12 },
    anxious: { sky: '#221100', depth: 4 },
    fear: { sky: '#110000', broken: true, unknown: 1 },
  },
  build: () => {
    throw new Error('not built in tests');
  },
};

describe('variantValues', () => {
  it('gives the defaults for a variant with no differences', () => {
    expect(variantValues(DEF, 'a')).toEqual(defaultValues(DEF));
    expect(variantValues(DEF, 'a')).toMatchObject({ height: 8, sky: '#aabbcc', broken: false, lines: 240, depth: 5 });
  });

  it('lays the differences of a variant over the defaults', () => {
    const b = variantValues(DEF, 'b');
    expect(b.broken).toBe(true);
    expect(b.height).toBe(5);
    expect(b.sky).toBe('#aabbcc');
    expect(b.lines).toBe(240);
  });

  it('treats a variant it does not know as the defaults', () => {
    expect(variantValues(DEF, 'nope')).toEqual(defaultValues(DEF));
  });

  it('ignores values for parameters the scene does not have', () => {
    const stray = variantValues(DEF, 'stray');
    expect(stray.broken).toBe(true);
    expect('unknown' in stray).toBe(false);
  });

  it('does not touch the definition', () => {
    const b = variantValues(DEF, 'b');
    b.height = 1;
    expect(DEF.params.height.value).toBe(8);
    expect(variantValues(DEF, 'b').height).toBe(5);
  });
});

describe('sceneValues', () => {
  it('is the variant for the lightest mood', () => {
    expect(sceneValues(DEF, 'a', 'dream')).toEqual(defaultValues(DEF));
    expect(sceneValues(DEF, 'b', 'dream')).toEqual(variantValues(DEF, 'b'));
  });

  it('lays the mood over the variant', () => {
    const values = sceneValues(DEF, 'b', 'strange');
    expect(values.broken).toBe(true);
    expect(values.height).toBe(12);
    expect(sceneValues(DEF, 'b', 'sad')).toMatchObject({ broken: true, height: 5, sky: '#445566' });
  });

  it('ignores values of a mood for parameters the scene does not have', () => {
    const values = sceneValues(DEF, 'a', 'fear');
    expect(values.broken).toBe(true);
    expect('unknown' in values).toBe(false);
  });
});

describe('changedValues', () => {
  it('is empty for the defaults', () => {
    expect(changedValues(DEF, defaultValues(DEF))).toEqual({});
  });

  it('keeps only what differs from the defaults', () => {
    const values = { ...defaultValues(DEF), height: 11.5, depth: 4 };
    expect(changedValues(DEF, values)).toEqual({ height: 11.5, depth: 4 });
  });

  it('is the differences of the variant for an untouched variant', () => {
    expect(changedValues(DEF, variantValues(DEF, 'b'))).toEqual({ broken: true, height: 5 });
  });

  it('does not count a colour written in another case as changed', () => {
    expect(changedValues(DEF, { ...defaultValues(DEF), sky: '#AABBCC' })).toEqual({});
    expect(changedValues(DEF, { ...defaultValues(DEF), sky: '#aabbcd' })).toEqual({ sky: '#aabbcd' });
  });

  it('leaves out values the scene has no parameter for', () => {
    expect(changedValues(DEF, { ...defaultValues(DEF), unknown: 1 })).toEqual({});
  });
});

describe('sceneRecord', () => {
  it('holds the scene, the seed and the changed values, and survives JSON', () => {
    const record = sceneRecord(DEF, 3, { ...variantValues(DEF, 'b'), sky: '#101010' });
    expect(JSON.parse(JSON.stringify(record))).toEqual({
      scene: 'test',
      seed: 3,
      values: { height: 5, sky: '#101010', broken: true },
    });
  });
});

describe('signalLook', () => {
  it('reads the look of the layer out of the values of a scene', () => {
    const look = signalLook({ ...defaultValues(DEF), depth: 4, dither: 0.5, blur: 1.5, smear: 2, chroma: 1, glow: 0.3 });
    expect(look).toMatchObject({ depth: 4, dither: 0.5, blur: 1.5, smear: 2, chroma: 1, glow: 0.3 });
    expect(look.noise).toBe(LOOK_PARAMS.noise.value);
  });

  it('stretches the picture softly or in hard squares', () => {
    expect(signalLook({ ...defaultValues(DEF), smooth: true }).filter).toBe('linear');
    expect(signalLook({ ...defaultValues(DEF), smooth: false }).filter).toBe('nearest');
  });

  it('leaves every effect off for values that do not name it', () => {
    expect(signalLook({})).toEqual({
      depth: 8,
      dither: 0,
      filter: 'nearest',
      blur: 0,
      smear: 0,
      chroma: 0,
      glow: 0,
      noise: 0,
      scanlines: 0,
      vignette: 0,
    });
  });
});

describe('captionLines', () => {
  it('gives the text the lines of the scene on a wide window', () => {
    expect(captionLines(240, 16 / 9)).toBe(240);
    expect(captionLines(240, 4 / 3)).toBe(240);
  });

  it('gives the text more lines on a tall window, to be as wide as on a 4:3 screen', () => {
    const lines = captionLines(240, 375 / 812);
    expect(lines).toBeGreaterThan(240);
    expect(Math.round(lines * (375 / 812))).toBe(320);
  });
});

describe('seededRandom', () => {
  it('gives the same numbers for the same seed, in 0..1', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    for (let i = 0; i < 20; i++) {
      const value = a();
      expect(value).toBe(b());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('gives other numbers for another seed', () => {
    expect(seededRandom(1)()).not.toBe(seededRandom(2)());
  });
});

/** Every vertex of a built scene, in a fixed order. */
function vertices(instance: SceneInstance): number[] {
  const out: number[] = [];
  instance.scene.updateMatrixWorld(true);
  instance.scene.traverse((object) => {
    const geometry = (object as { geometry?: { getAttribute(name: string): { array: ArrayLike<number> } | undefined } }).geometry;
    const position = geometry?.getAttribute('position');
    if (!position) return;
    out.push(...object.matrixWorld.elements, ...Array.from(position.array));
  });
  const { position, rotation, fov } = instance.camera;
  out.push(position.x, position.y, position.z, rotation.x, rotation.y, rotation.z, fov);
  return out;
}

function frame(variant: string, seed: number, timeMs: number, overrides: Record<string, number> = {}): number[] {
  const instance = seaPole.build({ ...variantValues(seaPole, variant), ...overrides }, seed);
  instance.update(timeMs, 16 / 9);
  const out = vertices(instance);
  instance.dispose();
  return out;
}

describe('the registry', () => {
  it('finds a scene by its id', () => {
    expect(sceneById('sea_pole')).toBe(seaPole);
    expect(sceneById('nope')).toBeUndefined();
    expect(sceneById(null)).toBeUndefined();
    expect(SCENES[0]).toBe(seaPole);
  });

  it('gives every scene the parameters of the look and unique ids', () => {
    expect(new Set(SCENES.map((scene) => scene.id)).size).toBe(SCENES.length);
    for (const scene of SCENES) {
      for (const name of Object.keys(LOOK_PARAMS)) expect(scene.params[name]).toBeDefined();
    }
  });

  it('keeps the defaults of every scene inside their ranges and its variants inside its parameters', () => {
    for (const scene of SCENES) {
      for (const spec of Object.values(scene.params)) {
        if (spec.kind !== 'number') continue;
        expect(spec.value).toBeGreaterThanOrEqual(spec.min);
        expect(spec.value).toBeLessThanOrEqual(spec.max);
      }
      for (const variant of Object.values(scene.variants)) {
        for (const name of Object.keys(variant)) expect(scene.params[name]).toBeDefined();
      }
    }
  });

  it('gives every scene the five moods, the lightest of them being its defaults', () => {
    for (const scene of SCENES) {
      expect(Object.keys(scene.moods)).toEqual([...MOODS]);
      expect(scene.moods.dream).toEqual({});
      const seen = new Set<string>();
      for (const mood of MOODS) {
        for (const [name, value] of Object.entries(scene.moods[mood])) {
          const spec = scene.params[name];
          expect(spec, `${scene.id}.${mood}.${name}`).toBeDefined();
          expect(typeof value, `${scene.id}.${mood}.${name}`).toBe(typeof spec.value);
          if (spec.kind === 'number') {
            expect(value, `${scene.id}.${mood}.${name}`).toBeGreaterThanOrEqual(spec.min);
            expect(value, `${scene.id}.${mood}.${name}`).toBeLessThanOrEqual(spec.max);
          }
        }
        // No two moods of a scene are the same picture.
        const key = JSON.stringify(sceneValues(scene, Object.keys(scene.variants)[0], mood));
        expect(seen.has(key), `${scene.id}.${mood}`).toBe(false);
        seen.add(key);
      }
    }
  });

  it('keeps what a variant changes out of the moods, so a variant shows in every mood', () => {
    for (const scene of SCENES) {
      const changed = new Set(Object.values(scene.variants).flatMap((variant) => Object.keys(variant)));
      for (const mood of MOODS) {
        for (const name of Object.keys(scene.moods[mood])) expect(changed.has(name), `${scene.id}.${mood}.${name}`).toBe(false);
      }
    }
  });

  it('builds every scene in every variant and mood, the same from the same seed, and moves it', () => {
    for (const scene of SCENES) {
      for (const variant of Object.keys(scene.variants)) {
        for (const mood of MOODS) {
          const shot = (timeMs: number): number[] => {
            const instance = scene.build(sceneValues(scene, variant, mood), 5);
            instance.update(timeMs, 4 / 3);
            const out = vertices(instance);
            instance.dispose();
            return out;
          };
          const first = shot(1500);
          expect(first.every(Number.isFinite), `${scene.id}.${variant}.${mood}`).toBe(true);
          expect(shot(1500), `${scene.id}.${variant}.${mood}`).toEqual(first);
          expect(shot(4000), `${scene.id}.${variant}.${mood}`).not.toEqual(first);
        }
      }
    }
  });
});

describe('sea_pole', () => {
  it('has the two variants: the defaults, and one wire under the water', () => {
    expect(changedValues(seaPole, variantValues(seaPole, 'a'))).toEqual({});
    expect(changedValues(seaPole, variantValues(seaPole, 'b'))).toEqual({ wireUnderwater: true });
  });

  it('builds the same frame from the same seed and time', () => {
    expect(frame('a', 3, 1234)).toEqual(frame('a', 3, 1234));
    expect(frame('b', 9, 0)).toEqual(frame('b', 9, 0));
  });

  it('builds another frame from another seed', () => {
    expect(frame('a', 3, 1234)).not.toEqual(frame('a', 4, 1234));
  });

  it('moves with time', () => {
    expect(frame('a', 3, 0)).not.toEqual(frame('a', 3, 5000));
  });

  it('holds the camera still without drift and moves it with drift', () => {
    // A sway of nothing is +0 or -0 by the moment: `+ 0` makes them one.
    const camera = (drift: number, timeMs: number): number[] =>
      frame('a', 3, timeMs, { drift })
        .slice(-7)
        .map((value) => value + 0);
    expect(camera(0, 0)).toEqual(camera(0, 4000));
    expect(camera(0.5, 0)).not.toEqual(camera(0.5, 4000));
  });

  it('trembles the wires with time, and only as much as it is told to', () => {
    const wires = (wireTremble: number, timeMs: number): number[] => {
      const instance = seaPole.build({ ...variantValues(seaPole, 'a'), drift: 0, wireTremble }, 3);
      instance.update(timeMs, 16 / 9);
      let found: number[] = [];
      instance.scene.traverse((object) => {
        if ((object as { isLineSegments?: boolean }).isLineSegments) {
          const geometry = (object as unknown as { geometry: { getAttribute(name: string): { array: ArrayLike<number> } } }).geometry;
          found = Array.from(geometry.getAttribute('position').array);
        }
      });
      instance.dispose();
      return found;
    };
    expect(wires(0, 0)).toEqual(wires(0, 700));
    const still = wires(0, 700);
    const moved = wires(0.5, 700);
    expect(moved).not.toEqual(still);
    // A wire never leaves its tie: the first point of each wire stays where it hangs.
    for (let i = 0; i < still.length; i += 16 * 6) {
      for (let k = 0; k < 3; k++) expect(moved[i + k]).toBeCloseTo(still[i + k], 5);
    }
  });

  it('differs between the variants in the wires alone', () => {
    const a = seaPole.build(variantValues(seaPole, 'a'), 3);
    const b = seaPole.build(variantValues(seaPole, 'b'), 3);
    a.update(0, 1);
    b.update(0, 1);
    const wires = (instance: SceneInstance): number[] => {
      let found: number[] = [];
      instance.scene.traverse((object) => {
        if ((object as { isLineSegments?: boolean }).isLineSegments) {
          const geometry = (object as unknown as { geometry: { getAttribute(name: string): { array: ArrayLike<number> } } }).geometry;
          found = Array.from(geometry.getAttribute('position').array);
        }
      });
      return found;
    };
    const wa = wires(a);
    const wb = wires(b);
    expect(wa.length).toBeGreaterThan(0);
    expect(wb.length).toBe(wa.length);
    // One wire of sixteen segments goes another way, the rest hang exactly as they did.
    let changed = 0;
    for (let i = 0; i < wa.length; i += 6) {
      if (wa.slice(i, i + 6).some((v, k) => v !== wb[i + k])) changed++;
    }
    expect(changed).toBeGreaterThan(0);
    expect(changed).toBeLessThanOrEqual(16);
    // The loose wire ends below the surface.
    expect(Math.min(...wb.filter((_, i) => i % 3 === 1))).toBeLessThan(0);
    expect(Math.min(...wa.filter((_, i) => i % 3 === 1))).toBeGreaterThan(0);
    a.dispose();
    b.dispose();
  });

  it('survives the ends of its ranges', () => {
    for (const end of ['min', 'max'] as const) {
      const values = variantValues(seaPole, 'b');
      for (const [name, spec] of Object.entries(seaPole.params)) {
        if (spec.kind === 'number') values[name] = spec[end];
      }
      const instance = seaPole.build(values, 1);
      instance.update(1000, 0.46);
      expect(vertices(instance).every((v) => Number.isFinite(v))).toBe(true);
      instance.dispose();
    }
  });
});
