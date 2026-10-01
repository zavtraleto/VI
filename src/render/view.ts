import * as THREE from 'three';
import type { RunState } from '../rules';
import { CubeMeshes } from './cubes';
import { FloorOverlays, type OverlayOptions } from './overlays';
import { PlayerFigure } from './player';
import type { Theme } from './theme';

const MAX_DPR = 1.5;
/** World units that must stay visible around the board centre. */
const NEED_HALF_WIDTH = 5.5;
const NEED_HALF_HEIGHT = 4.1;

/** Fixed orthographic isometric view: North goes up-right, East down-right. */
export class BoardView {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private readonly cubes: CubeMeshes;
  private readonly player: PlayerFigure;
  private readonly overlays: FloorOverlays;
  private readonly tmp = new THREE.Vector3();
  private width = 1;
  private height = 1;

  constructor(private readonly container: HTMLElement, theme: Theme, size: number) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setClearColor(theme.background);
    this.renderer.domElement.className = 'board-canvas';
    container.prepend(this.renderer.domElement);

    const centre = (size - 1) / 2;
    this.camera.position.set(centre + 20, 20, centre + 20);
    this.camera.lookAt(centre, 0.35, centre);

    this.scene.add(new THREE.AmbientLight(theme.ambient, 1.5));
    const key = new THREE.DirectionalLight(theme.key, 1.6);
    key.position.set(4, 10, 7);
    this.scene.add(key);

    const slab = new THREE.Mesh(new THREE.BoxGeometry(size, 1.4, size), [
      new THREE.MeshLambertMaterial({ color: theme.slabSide }),
      new THREE.MeshLambertMaterial({ color: theme.slabSide }),
      new THREE.MeshLambertMaterial({ color: theme.slab }),
      new THREE.MeshLambertMaterial({ color: theme.slabSide }),
      new THREE.MeshLambertMaterial({ color: theme.slabSide }),
      new THREE.MeshLambertMaterial({ color: theme.slabSide }),
    ]);
    slab.position.set(centre, -0.7, centre);
    this.scene.add(slab);
    this.scene.add(this.gridLines(size, theme.grid));

    this.cubes = new CubeMeshes(theme);
    this.player = new PlayerFigure(theme);
    this.overlays = new FloorOverlays(theme);
    this.scene.add(this.overlays.group, this.cubes.group, this.player.group);

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  private gridLines(size: number, color: number): THREE.LineSegments {
    const points: number[] = [];
    for (let i = 0; i <= size; i++) {
      const v = i - 0.5;
      points.push(v, 0.003, -0.5, v, 0.003, size - 0.5);
      points.push(-0.5, 0.003, v, size - 0.5, 0.003, v);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color }));
  }

  resize(): void {
    this.width = Math.max(1, this.container.clientWidth);
    this.height = Math.max(1, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    this.renderer.setSize(this.width, this.height, false);
    const aspect = this.width / this.height;
    const halfHeight = Math.max(NEED_HALF_HEIGHT, NEED_HALF_WIDTH / aspect);
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.left = -halfHeight * aspect;
    this.camera.right = halfHeight * aspect;
    this.camera.updateProjectionMatrix();
  }

  draw(state: RunState, alpha: number, timeMs: number, options: OverlayOptions): void {
    this.cubes.sync(state, alpha);
    this.player.sync(state, alpha);
    this.overlays.sync(state, timeMs, options);
    this.renderer.render(this.scene, this.camera);
  }

  /** World position to CSS pixels inside the container. */
  project(x: number, y: number, z: number): { x: number; y: number } {
    this.tmp.set(x, y, z).project(this.camera);
    return { x: ((this.tmp.x + 1) / 2) * this.width, y: ((1 - this.tmp.y) / 2) * this.height };
  }
}
