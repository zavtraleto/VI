import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PlayerFigure } from './player';

/** The meshes of the figure in the order they are added: the body, the figure while it comes, what shows of it through a die. */
function parts(figure: PlayerFigure): THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] {
  return figure.group.children as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[];
}

/** The fragment shader the material of the coming figure is built with, and the numbers it reads. */
function compiled(material: THREE.Material): { fragmentShader: string; uniforms: Record<string, { value: unknown }> } {
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.basic.vertexShader, fragmentShader: THREE.ShaderLib.basic.fragmentShader };
  material.onBeforeCompile(shader as never, null as never);
  return shader;
}

describe('the figure on the board', () => {
  it('is drawn as it always is, its body and what shows of it through a die, until it is told to come', () => {
    const figure = new PlayerFigure();
    const [body, arriving, through] = parts(figure);
    expect(parts(figure).length).toBe(3);
    expect(body.visible).toBe(true);
    expect(arriving.visible).toBe(false);
    expect(through.visible).toBe(true);
    // The body has the material every board draws it with: nothing is added to its shader.
    expect(compiled(body.material).fragmentShader).toBe(THREE.ShaderLib.basic.fragmentShader);
    figure.setColor('#ff0000', 0.3);
    expect(through.material.opacity).toBe(0.3);
  });

  it('comes through the dots of the tube in place of its body, and what shows through a die comes with it', () => {
    const figure = new PlayerFigure();
    const [body, arriving, through] = parts(figure);
    figure.come(0.25, 3);
    figure.setColor('#ff0000', 0.4);
    expect(body.visible).toBe(false);
    expect(arriving.visible).toBe(true);
    expect(through.material.opacity).toBeCloseTo(0.1);
    expect(arriving.material.color.getHexString()).toBe('ff0000');
    const { uniforms } = compiled(arriving.material);
    expect(uniforms.uCover.value).toBe(0.25);
    expect(uniforms.uDot.value).toBe(3);
    // The numbers are read where they are kept: the next share needs no new shader.
    figure.come(0.5, 3);
    expect(uniforms.uCover.value).toBe(0.5);
  });

  it('is its body again when all of it is here, and on a new board', () => {
    const figure = new PlayerFigure();
    const [body, arriving, through] = parts(figure);
    figure.come(0.5, 3);
    figure.come(1, 3);
    expect([body.visible, arriving.visible]).toEqual([true, false]);
    figure.come(0, 3);
    figure.reset();
    expect([body.visible, arriving.visible]).toEqual([true, false]);
    figure.setColor('#ff0000', 0.4);
    expect(through.material.opacity).toBe(0.4);
  });

  it('is drawn, while it comes, through the mesh the dice come through, put into the shader of a plain colour once', () => {
    const figure = new PlayerFigure();
    const { fragmentShader } = compiled(parts(figure)[1].material);
    expect(fragmentShader.match(/void main\(\) \{/g)?.length).toBe(1);
    expect(fragmentShader).toContain('uniform float uCover;');
    expect(fragmentShader).toContain('uniform float uDot;');
    // The table of the mesh stands before the body of the shader, and the dots are left out first of all in it.
    const table = fragmentShader.indexOf('const float MESH[16]');
    const main = fragmentShader.indexOf('void main() {');
    const left = fragmentShader.indexOf('> uCover) discard;');
    expect(table).toBeGreaterThan(-1);
    expect(table).toBeLessThan(main);
    expect(left).toBeGreaterThan(main);
    expect(left).toBeLessThan(fragmentShader.indexOf('vec4 diffuseColor'));
  });
});
