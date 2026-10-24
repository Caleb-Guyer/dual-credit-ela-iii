import * as T from 'three';
import { paintTexture, type PaintedSurface } from './paint';
import {
  hotspots,
  spawns,
  navigationObstacles,
  isWalkable,
  sceneryRandom,
  INSPECT_DISTANCE,
  type Hotspot,
  type Collider,
} from './navigation';
export { hotspots, type Hotspot } from './navigation';

type State = {
  paused: boolean;
  reduced: boolean;
  collected: string[];
};
type Batch = { geometry: T.BufferGeometry; material: T.Material; matrices: T.Matrix4[] };

/** Original scenery and fictional encounter staging, not a reconstruction of historic Concord. */
export class ConcordWorld {
  readonly scene = new T.Scene();
  readonly camera = new T.PerspectiveCamera(64, 1, 0.08, 140);
  readonly renderer: T.WebGLRenderer;
  readonly keys = new Set<string>();
  yaw = 0;
  pitch = -0.03;
  private boxes: Collider[] = [];
  private batches = new Map<string, Batch>();
  private materials = new Map<string, T.MeshStandardMaterial>();
  private geometries = new Map<string, T.BufferGeometry>();
  private objectives: { point: Hotspot; group: T.Group; crystal: T.Mesh }[] = [];
  private flames: { mesh: T.Mesh; y: number; phase: number }[] = [];
  private lights: T.PointLight[] = [];
  private particles?: T.Points;
  private observer: ResizeObserver;
  private disposed = false;
  private raf = 0;
  private time = 0;
  private last = 0;
  private lastReport = 0;
  private previousNear: string | null = null;
  private step = 0;
  private software = false;
  private dummy = new T.Object3D();
  private textures: T.Texture[] = [];
  near: Hotspot | null = null;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly act: number,
    readonly preview: boolean,
    readonly getState: () => State,
    readonly onNear: (point: Hotspot | null) => void,
    readonly onPosition: (x: number, z: number, yaw: number) => void,
  ) {
    this.boxes = navigationObstacles(act);
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    const gl = this.renderer.getContext();
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const driver = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : '';
    this.software = /swiftshader|llvmpipe|software rasterizer/i.test(driver);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.software ? 0.65 : 1.6));
    this.renderer.shadowMap.enabled = !this.software;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = act === 2 ? 1.2 : 1.18;
    const dawn = act === 3;
    this.scene.background = new T.Color(act === 2 ? '#16252d' : dawn ? '#a5b6ba' : '#132b3a');
    this.scene.fog = new T.FogExp2(
      act === 2 ? '#16252d' : dawn ? '#a5b6ba' : '#193341',
      act === 2 ? 0.025 : 0.018,
    );
    this.scene.add(
      new T.HemisphereLight(
        dawn ? '#fff1ce' : '#bdc7dd',
        '#4b5043',
        dawn ? 1.35 : act === 2 ? 0.6 : 0.85,
      ),
    );
    const moon = new T.DirectionalLight(
      dawn ? '#ffe2a7' : '#ccd5e7',
      dawn ? 2.5 : act === 2 ? 0.5 : 0.9,
    );
    moon.position.set(-17, 29, -14);
    moon.castShadow = !this.software;
    moon.shadow.mapSize.set(1024, 1024);
    Object.assign(moon.shadow.camera, {
      left: -32,
      right: 32,
      top: 32,
      bottom: -32,
      near: 1,
      far: 90,
    });
    moon.shadow.normalBias = 0.08;
    this.scene.add(moon);
    if (act === 2) this.buildCell();
    else this.buildTown(dawn);
    this.buildObjectives();
    this.flush();
    this.buildParticles();
    const spawn = spawns[act] ?? spawns[0];
    this.camera.position.set(spawn.x, 1.68, spawn.z);
    this.yaw = spawn.yaw;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }

  private mat(color: string, glow = '', finish?: PaintedSurface) {
    const key = color + glow + (finish ?? '');
    if (!this.materials.has(key)) {
      this.materials.set(
        key,
        new T.MeshStandardMaterial({
          color: finish ? '#ffffff' : color,
          ...(finish ? { map: this.texture(finish, color) } : {}),
          roughness: 0.98,
          metalness: 0,
          ...(glow ? { emissive: glow, emissiveIntensity: 1.4 } : {}),
        }),
      );
    }
    return this.materials.get(key)!;
  }

  private texture(finish: PaintedSurface, color: string, seed = 1) {
    const texture = paintTexture(finish, color, seed);
    this.textures.push(texture);
    return texture;
  }

  private geometry(kind: string): T.BufferGeometry {
    if (!this.geometries.has(kind)) {
      let g: T.BufferGeometry;
      if (kind === 'sphere') g = new T.SphereGeometry(1, 12, 8);
      else if (kind === 'cylinder') g = new T.CylinderGeometry(1, 1, 1, 8);
      else if (kind === 'cone') g = new T.ConeGeometry(1, 1, 7);
      else if (kind === 'coat') g = new T.CylinderGeometry(0.74, 1, 1, 10);
      else if (kind === 'roof') {
        const shape = new T.Shape();
        shape.moveTo(-0.5, 0);
        shape.lineTo(0, 0.55);
        shape.lineTo(0.5, 0);
        shape.closePath();
        g = new T.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
        g.translate(0, 0, -0.5);
      } else g = new T.BoxGeometry(1, 1, 1);
      this.geometries.set(kind, g);
    }
    return this.geometries.get(kind)!;
  }

  private add(
    kind: string,
    color: string,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    ry = 0,
    glow = '',
    finish?: PaintedSurface,
  ) {
    const key = `${kind}:${color}:${glow}:${finish ?? ''}`;
    if (!this.batches.has(key))
      this.batches.set(key, {
        geometry: this.geometry(kind),
        material: this.mat(color, glow, finish),
        matrices: [],
      });
    this.dummy.position.set(x, y, z);
    this.dummy.scale.set(sx, sy, sz);
    this.dummy.rotation.set(0, ry, 0);
    this.dummy.updateMatrix();
    this.batches.get(key)!.matrices.push(this.dummy.matrix.clone());
  }

  private box(
    color: string,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    ry = 0,
    glow = '',
    finish?: PaintedSurface,
  ) {
    if (finish === 'brick' || finish === 'stone') {
      const geometry = new T.BoxGeometry(sx, sy, sz);
      const uv = geometry.getAttribute('uv');
      const tile = finish === 'brick' ? [1.6, 1.2] : [4, 2.4];
      const dimensions = [
        [sz, sy],
        [sz, sy],
        [sx, sz],
        [sx, sz],
        [sx, sy],
        [sx, sy],
      ];
      dimensions.forEach(([width, height], face) => {
        for (let vertex = 0; vertex < 4; vertex++) {
          const index = face * 4 + vertex;
          uv.setXY(index, (uv.getX(index) * width) / tile[0], (uv.getY(index) * height) / tile[1]);
        }
      });
      const mesh = new T.Mesh(geometry, this.mat(color, glow, finish));
      mesh.position.set(x, y, z);
      mesh.rotation.y = ry;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      return;
    }
    this.add('box', color, x, y, z, sx, sy, sz, ry, glow, finish);
  }

  private ground(
    finish: PaintedSurface,
    color: string,
    x: number,
    z: number,
    width: number,
    depth: number,
    tile: number,
  ) {
    const map = this.texture(finish, color);
    map.repeat.set(width / tile, depth / tile);
    const material = new T.MeshStandardMaterial({ map, roughness: 1, metalness: 0 });
    const mesh = new T.Mesh(new T.PlaneGeometry(width, depth), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.018, z);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  private segment(
    color: string,
    a: T.Vector3,
    b: T.Vector3,
    radius: number,
    finish?: PaintedSurface,
  ) {
    const key = `limb:${color}:${finish ?? ''}`;
    if (!this.batches.has(key))
      this.batches.set(key, {
        geometry: this.geometry('cylinder'),
        material: this.mat(color, '', finish),
        matrices: [],
      });
    this.dummy.position.copy(a).add(b).multiplyScalar(0.5);
    this.dummy.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    this.dummy.scale.set(radius, a.distanceTo(b), radius);
    this.dummy.updateMatrix();
    this.batches.get(key)!.matrices.push(this.dummy.matrix.clone());
  }

  private flush() {
    for (const batch of this.batches.values()) {
      const mesh = new T.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
      batch.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
    this.batches.clear();
  }

  private window(
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    facing: number,
    shutters = true,
  ) {
    const side = Math.abs(facing) === 1;
    const pane = side ? 0.05 : sx;
    const depth = side ? sx : 0.05;
    this.box('#f4cf91', x, y, z, pane, sy, depth, 0, '#594021');
    const trim = '#dfd4b7';
    for (const dy of [-sy / 2 - 0.045, sy / 2 + 0.045])
      this.box(trim, x, y + dy, z, side ? 0.12 : sx + 0.2, 0.09, side ? sx + 0.2 : 0.12);
    for (const edge of [-sx / 2 - 0.04, sx / 2 + 0.04]) {
      this.box(
        trim,
        x + (side ? 0 : edge),
        y,
        z + (side ? edge : 0),
        side ? 0.11 : 0.075,
        sy,
        side ? 0.075 : 0.11,
      );
      if (shutters) {
        const shift = edge + Math.sign(edge) * 0.24;
        this.box(
          '#52685c',
          x + (side ? 0 : shift),
          y,
          z + (side ? shift : 0),
          side ? 0.12 : 0.37,
          sy + 0.08,
          side ? 0.37 : 0.12,
          0,
          '',
          'wood',
        );
        for (let line = -sy / 2; line < sy / 2; line += 0.15)
          this.box(
            '#344d48',
            x + (side ? 0.07 * facing : shift),
            y + line,
            z + (side ? shift : 0.07),
            side ? 0.025 : 0.31,
            0.02,
            side ? 0.31 : 0.025,
          );
      }
    }
    for (const dy of [-sy / 6, sy / 6])
      this.box(trim, x, y + dy, z, side ? 0.1 : sx, 0.035, side ? sx : 0.1);
    this.box(trim, x, y, z, side ? 0.1 : 0.035, sy, side ? 0.035 : 0.1);
    this.box(
      '#b8aa8c',
      x,
      y - sy / 2 - 0.08,
      z,
      side ? 0.24 : sx + 0.26,
      0.09,
      side ? sx + 0.26 : 0.24,
    );
  }

  private house(
    x: number,
    z: number,
    w: number,
    d: number,
    h: number,
    color: string,
    seed: number,
  ) {
    const side = x < 0 ? 1 : -1;
    const front = x + side * (w / 2 + 0.03);
    const wallFinish: PaintedSurface = seed % 4 === 2 ? 'brick' : 'plaster';
    this.box('#777466', x, 0.19, z, w + 0.25, 0.38, d + 0.25, 0, '', 'stone');
    this.box(
      wallFinish === 'brick' ? '#a87c65' : color,
      x,
      h / 2 + 0.3,
      z,
      w,
      h,
      d,
      0,
      '',
      wallFinish,
    );
    const roofColor = seed % 3 === 0 ? '#655854' : seed % 3 === 1 ? '#4a545d' : '#545d5b';
    this.add('roof', roofColor, x, h + 0.3, z, w + 0.65, w * 0.66, d + 0.65, 0, '', 'slate');
    this.box('#e7d9bb', x, h + 0.33, z, w + 0.75, 0.14, d + 0.75);
    for (const corner of [-d / 2 + 0.07, d / 2 - 0.07])
      this.box('#e7d9bb', front + side * 0.04, h / 2 + 0.32, z + corner, 0.15, h, 0.15);
    if (wallFinish !== 'brick')
      for (let y = 0.6; y < h; y += 0.26) {
        this.box('#a4a38d', front + side * 0.02, y, z, 0.025, 0.018, d - 0.15);
        this.box('#a4a38d', x, y, z + d / 2 + 0.018, w - 0.15, 0.018, 0.025);
      }
    const chimneyX = x + w * (seed % 2 ? -0.22 : 0.24);
    this.box('#916b58', chimneyX, h + 1.6, z - d * 0.18, 0.63, 2.3, 0.68, 0, '', 'brick');
    this.box('#b49a7c', chimneyX, h + 2.8, z - d * 0.18, 0.83, 0.16, 0.87);
    this.box('#323e3f', chimneyX, h + 2.89, z - d * 0.18, 0.5, 0.025, 0.48);
    const doorColor = ['#384d4a', '#6c493d', '#414c60', '#645b40', '#4a5c57'][seed % 5];
    this.box('#e8dec5', front + side * 0.02, 1.43, z, 0.15, 2.34, 1.42);
    this.box(doorColor, front + side * 0.105, 1.35, z, 0.11, 2.1, 1.15, 0, '', 'wood');
    for (const dz of [-0.27, 0.27])
      for (const dy of [0.85, 1.7])
        this.box('#273e3e', front + side * 0.17, dy, z + dz, 0.02, 0.56, 0.39);
    this.add('sphere', '#b6a16c', front + side * 0.2, 1.28, z + 0.4, 0.035, 0.035, 0.035);
    this.box('#b7ad94', front + side * 0.2, 0.25, z, 0.8, 0.2, 1.65, 0, '', 'stone');
    this.box('#a7a38a', front + side * 0.55, 0.13, z, 0.6, 0.14, 1.9, 0, '', 'stone');
    for (const offset of [-d * 0.3, d * 0.3]) {
      this.window(front + side * 0.09, 2.05, z + offset, 0.72, 1.05, side, seed % 3 !== 2);
      if (h > 4.8) this.window(front + side * 0.09, 4.0, z + offset, 0.65, 0.9, side, true);
    }
    for (const offset of [-w * 0.27, w * 0.27])
      this.window(x + offset, 2.1, z + d / 2 + 0.09, 0.72, 1.0, 0, false);
    if (seed % 3 === 0) {
      const awning = new T.Mesh(new T.PlaneGeometry(0.85, 2), this.mat('#8a7054', '', 'cloth'));
      awning.quaternion.setFromUnitVectors(
        new T.Vector3(0, 0, 1),
        new T.Vector3(side * 0.2, 1, 0).normalize(),
      );
      (awning.material as T.MeshStandardMaterial).side = T.DoubleSide;
      awning.position.set(front + side * 0.45, 2.6, z);
      this.scene.add(awning);
      this.segment(
        '#3a4542',
        new T.Vector3(front + side * 0.8, 0.2, z - 0.83),
        new T.Vector3(front + side * 0.8, 2.45, z - 0.83),
        0.035,
      );
      this.segment(
        '#3a4542',
        new T.Vector3(front + side * 0.8, 0.2, z + 0.83),
        new T.Vector3(front + side * 0.8, 2.45, z + 0.83),
        0.035,
      );
    }
  }

  private glow(x: number, y: number, z: number, scale: number, opacity = 0.3) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d')!;
    const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 64);
    gradient.addColorStop(0, `rgba(255,218,150,${opacity})`);
    gradient.addColorStop(0.25, `rgba(239,178,91,${opacity * 0.28})`);
    gradient.addColorStop(1, 'rgba(239,178,91,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    this.textures.push(map);
    const sprite = new T.Sprite(
      new T.SpriteMaterial({
        map,
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    );
    sprite.position.set(x, y, z);
    sprite.scale.setScalar(scale);
    this.scene.add(sprite);
  }

  private lantern(x: number, z: number, tall = true) {
    const y = tall ? 3.2 : 1.45;
    if (tall) {
      this.add('cylinder', '#2d3438', x, 1.45, z, 0.055, 2.9, 0.055);
      this.add('cylinder', '#343c3d', x, 0.13, z, 0.18, 0.26, 0.18);
    }
    this.box('#28363a', x, y - 0.3, z, 0.37, 0.06, 0.37);
    this.box('#28363a', x, y + 0.3, z, 0.37, 0.07, 0.37);
    for (const dx of [-0.15, 0.15])
      for (const dz of [-0.15, 0.15]) this.box('#28363a', x + dx, y, z + dz, 0.028, 0.57, 0.028);
    const glass = new T.Mesh(
      new T.BoxGeometry(0.31, 0.54, 0.31),
      new T.MeshStandardMaterial({
        color: '#f5d79c',
        transparent: true,
        opacity: 0.12,
        roughness: 0.3,
        depthWrite: false,
      }),
    );
    glass.position.set(x, y, z);
    this.scene.add(glass);
    this.add('cone', '#26333a', x, y + 0.45, z, 0.3, 0.25, 0.3);
    this.add('sphere', '#26333a', x, y + 0.61, z, 0.055, 0.07, 0.055);
    const flame = new T.Mesh(this.geometry('sphere'), this.mat('#fff1c9', '#ffd176'));
    flame.position.set(x, y - 0.025, z);
    flame.scale.set(0.065, 0.15, 0.065);
    this.scene.add(flame);
    this.flames.push({ mesh: flame, y, phase: x * 1.5 + z });
    this.glow(x, y, z, 1.5, 0.26);
    if (this.lights.length < (this.software ? 3 : 6)) {
      const light = new T.PointLight('#ffce8a', 7.5, 10, 1.5);
      light.position.set(x, y - 0.1, z);
      this.scene.add(light);
      this.lights.push(light);
    }
    const pool = new T.Mesh(
      new T.CircleGeometry(1.65, 24),
      new T.MeshBasicMaterial({
        color: '#d2a263',
        transparent: true,
        opacity: 0.075,
        depthWrite: false,
      }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, 0.035, z);
    this.scene.add(pool);
  }

  private tree(x: number, z: number, scale: number, index: number) {
    const trunk = '#5a5044';
    this.segment(
      trunk,
      new T.Vector3(x, 0, z),
      new T.Vector3(x - 0.12 * scale, 3.5 * scale, z + 0.17 * scale),
      0.14 * scale,
      'wood',
    );
    const colors = ['#737750', '#9a8051', '#b08b59', '#78866a'];
    for (let branch = 0; branch < 6; branch++) {
      const angle = branch * 2.4 + index;
      const bx = x + Math.cos(angle) * 1.3 * scale,
        bz = z + Math.sin(angle) * 1.3 * scale;
      const by = (2.9 + (branch % 3) * 0.5) * scale;
      this.segment(
        trunk,
        new T.Vector3(x, 2.1 * scale, z),
        new T.Vector3(bx, by, bz),
        0.055 * scale,
      );
      this.add(
        'sphere',
        colors[(index + branch) % 4],
        bx,
        by + 0.6 * scale,
        bz,
        0.95 * scale,
        1.0 * scale,
        0.85 * scale,
      );
    }
  }

  private paper(x: number, y: number, z: number, width = 0.5, rotation = 0, text = 'Concord') {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 320;
    const context = c.getContext('2d')!;
    context.fillStyle = '#e4d8b7';
    context.fillRect(0, 0, 256, 320);
    context.strokeStyle = '#b9ac8c';
    context.lineWidth = 2;
    context.strokeRect(12, 12, 232, 296);
    context.fillStyle = '#4c4a3c';
    context.font = 'italic 21px Georgia';
    context.textAlign = 'center';
    context.fillText(text, 128, 50, 214);
    context.strokeStyle = '#8c8873';
    context.lineWidth = 1.3;
    for (let row = 0; row < 12; row++) {
      context.beginPath();
      context.moveTo(26, 81 + row * 16);
      context.lineTo(220 - (row % 4) * 8, 80 + row * 16);
      context.stroke();
    }
    const map = new T.CanvasTexture(c);
    map.colorSpace = T.SRGBColorSpace;
    this.textures.push(map);
    const mesh = new T.Mesh(
      new T.PlaneGeometry(width, width * 1.25),
      new T.MeshStandardMaterial({ map, roughness: 1, side: T.DoubleSide }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = rotation;
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
  }

  private table(x: number, z: number, rotation = 0) {
    this.box('#7b654c', x, 0.98, z, 1.5, 0.12, 0.82, rotation, '', 'wood');
    this.box('#544b3d', x, 0.79, z, 1.3, 0.19, 0.68, rotation, '', 'wood');
    for (const a of [-0.56, 0.56])
      for (const b of [-0.27, 0.27])
        this.box('#63513d', x + a, 0.46, z + b, 0.085, 0.93, 0.085, rotation, '', 'wood');
    this.paper(x - 0.12, 1.05, z, 0.48, rotation + 0.12);
    this.add('cylinder', '#283f43', x + 0.47, 1.105, z + 0.1, 0.065, 0.12, 0.065);
    this.add('cylinder', '#172c32', x + 0.47, 1.17, z + 0.1, 0.042, 0.035, 0.042);
    this.segment(
      '#e8dfc5',
      new T.Vector3(x + 0.45, 1.18, z + 0.1),
      new T.Vector3(x + 0.64, 1.5, z + 0.12),
      0.012,
    );
    this.box('#6f4539', x + 0.52, 1.06, z - 0.23, 0.27, 0.045, 0.18, -0.1, '', 'cloth');
  }

  private person(x: number, z: number, coat: string, direction: number) {
    const at = (a: number, y: number, b: number) =>
      new T.Vector3(
        x + Math.cos(direction) * a + Math.sin(direction) * b,
        y,
        z - Math.sin(direction) * a + Math.cos(direction) * b,
      );
    const piece = (
      kind: string,
      color: string,
      a: number,
      y: number,
      b: number,
      sx: number,
      sy: number,
      sz: number,
      finish?: PaintedSurface,
    ) => {
      const p = at(a, y, b);
      this.add(kind, color, p.x, p.y, p.z, sx, sy, sz, direction, '', finish);
    };
    piece('coat', coat, 0, 1.01, 0, 0.25, 0.79, 0.19, 'cloth');
    piece('sphere', '#e4d5b8', 0, 1.42, 0.035, 0.1, 0.08, 0.08);
    piece('box', '#d6c4a0', 0, 1.22, 0.176, 0.16, 0.3, 0.025);
    piece('box', '#302e2c', 0, 1.45, 0.16, 0.045, 0.09, 0.035);
    for (let button = 0; button < 4; button++)
      piece('sphere', '#ba9f65', 0.025, 1.31 - button * 0.105, 0.192, 0.014, 0.014, 0.014);
    for (const side of [-1, 1]) {
      this.segment(
        '#434440',
        at(side * 0.115, 0.64, 0),
        at(side * 0.13, 0.13, side * 0.015),
        0.078,
        'cloth',
      );
      piece('sphere', '#2a3031', side * 0.13, 0.09, 0.06, 0.095, 0.09, 0.16);
      this.segment(coat, at(side * 0.21, 1.34, 0), at(side * 0.3, 0.95, 0.05), 0.078, 'cloth');
      this.segment(coat, at(side * 0.3, 0.95, 0.05), at(side * 0.25, 0.77, 0.15), 0.065, 'cloth');
      piece('sphere', '#c29e7d', side * 0.25, 0.75, 0.16, 0.055, 0.075, 0.05);
    }
    piece('sphere', '#b79676', 0, 1.66, 0, 0.155, 0.205, 0.14);
    piece('sphere', '#4a4036', 0, 1.73, -0.045, 0.163, 0.16, 0.13);
    for (const side of [-1, 1]) {
      piece('sphere', '#c6a382', side * 0.15, 1.66, 0, 0.035, 0.055, 0.035);
      piece('sphere', '#333b3a', side * 0.055, 1.69, 0.126, 0.016, 0.014, 0.012);
      piece('box', '#67513e', side * 0.055, 1.722, 0.128, 0.045, 0.01, 0.012);
    }
    piece('sphere', '#b28d6b', 0, 1.635, 0.14, 0.027, 0.047, 0.04);
    piece('box', '#765644', 0, 1.578, 0.127, 0.045, 0.012, 0.015);
    piece('cylinder', '#363c3d', 0, 1.865, -0.005, 0.22, 0.045, 0.21);
    piece('cylinder', '#363c3d', 0, 1.99, -0.005, 0.143, 0.22, 0.14, 'cloth');
    piece('cylinder', '#8e7c5d', 0, 1.92, -0.005, 0.146, 0.034, 0.144);
  }

  private sign(text: string, x: number, y: number, z: number, width = 2.2, rotation = 0) {
    const c = document.createElement('canvas');
    c.width = 768;
    c.height = 192;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#d7c5a0';
    ctx.fillRect(0, 0, 768, 192);
    ctx.strokeStyle = '#72634d';
    ctx.lineWidth = 5;
    ctx.strokeRect(9, 9, 750, 174);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(19, 20, 730, 153);
    for (let line = 0; line < 25; line++) {
      ctx.strokeStyle = `rgba(84,62,39,${0.015 + (line % 3) * 0.01})`;
      ctx.beginPath();
      ctx.moveTo(0, line * 8);
      ctx.lineTo(768, line * 8 + 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#39483f';
    ctx.font = 'small-caps 44px Georgia';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 384, 98, 682);
    for (const px of [35, 733]) {
      ctx.fillStyle = '#6e654e';
      ctx.beginPath();
      ctx.arc(px, 96, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    const map = new T.CanvasTexture(c);
    map.colorSpace = T.SRGBColorSpace;
    map.anisotropy = 4;
    this.textures.push(map);
    const mesh = new T.Mesh(
      new T.PlaneGeometry(width, width / 4),
      new T.MeshStandardMaterial({ map, side: T.DoubleSide, roughness: 1 }),
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotation;
    this.scene.add(mesh);
  }

  private buildTown(dawn: boolean) {
    const sky = new T.Mesh(
      new T.SphereGeometry(115, 24, 16),
      new T.ShaderMaterial({
        uniforms: {
          top: { value: new T.Color(dawn ? '#81969d' : '#101b30') },
          bottom: { value: new T.Color(dawn ? '#e2cda7' : '#505b67') },
        },
        vertexShader:
          'varying vec3 vPosition; void main(){ vPosition=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader:
          'uniform vec3 top; uniform vec3 bottom; varying vec3 vPosition; void main(){ float h=smoothstep(-0.05,0.7,normalize(vPosition).y); gl_FragColor=vec4(mix(bottom,top,h),1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
        side: T.BackSide,
        depthWrite: false,
      }),
    );
    sky.renderOrder = -2;
    this.scene.add(sky);
    this.box('#656c54', 0, -0.23, 0, 100, 0.4, 120);
    this.ground('road', '#ac9d7e', 0, -1, 9.7, 66, 10);
    for (const x of [-5.13, 5.13]) this.box('#a2a18a', x, 0.02, 0, 0.45, 0.11, 65, 0, '', 'stone');
    const colors = ['#d6c9a9', '#ac8a73', '#c7c7b2', '#b9b6a2', '#cac2a7'];
    for (let i = 0; i < 5; i++) {
      this.house(-9.8 - (i % 2) * 0.8, -22 + i * 11, 7.1, 7.1, i % 2 ? 5.5 : 4.5, colors[i], i);
      if (i < 4)
        this.house(10, -23 + i * 11, 7.2, 7.5, 4.7 + (i % 2) * 0.8, colors[(i + 2) % 5], i + 1);
    }
    // The meetinghouse closes the street, a single deliberate landmark rather than a repeated facade.
    this.box('#d5cfb3', 0, 2.8, -30, 7, 5.6, 5.5, 0, '', 'plaster');
    this.add('roof', '#47545a', 0, 5.6, -30, 8, 4.8, 6.4, 0, '', 'slate');
    this.box('#dfd8bf', 0, 7.4, -30, 1.2, 3, 1.2, 0, '', 'plaster');
    this.add('cone', '#455359', 0, 9.5, -30, 1.1, 1.6, 1.1);
    for (const x of [-2.8, -1.8, 1.8, 2.8]) this.box('#eee2c6', x, 2.7, -27.16, 0.17, 5.2, 0.15);
    this.box('#495e56', 0, 1.4, -27.17, 1.4, 2.5, 0.1, 0, '', 'wood');
    this.box('#dfd8bf', 0, 2.8, -27.1, 1.65, 0.13, 0.18);
    this.sign('TOWN HOUSE', 0, 3.6, -27.08, 2.1);
    this.window(-2.2, 2.1, -27.08, 0.7, 1.3, 0, false);
    this.window(2.2, 2.1, -27.08, 0.7, 1.3, 0, false);
    this.sign('PRINTING OFFICE', -6.15, 3.0, -13, 2.6, Math.PI / 2);
    this.sign('COUNTY JAIL', 6.3, 3.15, -19.4, 2.2, -Math.PI / 2);
    this.sign('TOWN TAXES', 6.3, 3.15, -10.8, 2.1, -Math.PI / 2);
    for (const [x, z] of [
      [-4.6, 13],
      [4.7, 1],
      [-4.6, -8],
      [4.7, -17],
      [-4.6, -24],
      [4.8, 20],
    ])
      this.lantern(x, z);
    for (let i = 0; i < 24; i++) {
      const side = i % 2 ? -1 : 1;
      this.tree(
        side * (16.7 + this.random(i + 4) * 13),
        -34 + this.random(i + 18) * 70,
        0.7 + this.random(i + 45) * 0.65,
        i,
      );
    }
    // Gardens sit beyond the road edge; their repeated rails make a coherent boundary.
    for (const side of [-1, 1])
      for (const z of [-5, 6, 17]) {
        const x = side * 6.35;
        for (const offset of [-1.4, -0.7, 0, 0.7, 1.4]) {
          this.box('#b8b293', x, 0.52, z + offset, 0.09, 1.04, 0.14, 0, '', 'wood');
          this.add('cone', '#b8b293', x, 1.08, z + offset, 0.1, 0.12, 0.1);
        }
        for (const y of [0.34, 0.77]) this.box('#b2ac91', x, y, z, 0.08, 0.08, 3.1, 0, '', 'wood');
        for (let flower = 0; flower < 5; flower++) {
          const fz = z - 1.2 + flower * 0.58;
          this.add('sphere', '#66795a', x + side * 0.5, 0.38, fz, 0.3, 0.35, 0.31);
          this.add(
            'sphere',
            flower % 2 ? '#c5ae7d' : '#a7846c',
            x + side * 0.5,
            0.73,
            fz,
            0.09,
            0.08,
            0.09,
          );
        }
      }
    // River, timber bridge and a narrow bank.
    this.box(dawn ? '#839e9b' : '#334f5a', 25, -0.08, 15, 14, 0.12, 110);
    for (let i = 0; i < 22; i++)
      this.box(
        dawn ? '#b1beb0' : '#819895',
        19.2 + this.random(i + 70) * 11,
        0,
        -35 + i * 4,
        1 + this.random(i) * 3,
        0.008,
        0.02,
        this.random(i) * 0.2,
      );
    this.box('#9a8969', 24, 0.6, 18, 18, 0.35, 4.3, 0, '', 'wood');
    for (let i = 0; i < 35; i++) this.box('#6b6651', 15.4 + i * 0.5, 0.8, 18, 0.025, 0.025, 4.2);
    for (const z of [15.9, 20.1]) {
      this.box('#b7a581', 24, 1.65, z, 18, 0.1, 0.13, 0, '', 'wood');
      for (let x = 15.6; x < 33; x += 2.1)
        this.box('#85745b', x, 1.1, z, 0.13, 1.25, 0.13, 0, '', 'wood');
    }
    this.box('#75816a', 10.9, 0.03, 18, 9, 0.15, 5);
    // The noticeboard carries actual sheets, with a pitched wooden cap and iron tacks.
    this.box('#79634a', -3.3, 1.75, 5, 1.5, 1.2, 0.14, 0, '', 'wood');
    for (const x of [-3.9, -2.7]) this.box('#65563f', x, 0.9, 5, 0.11, 1.8, 0.13, 0, '', 'wood');
    this.box('#66533e', -3.3, 2.4, 5, 1.75, 0.09, 0.36);
    const notices = ['TOWN MEETING', 'PUBLIC NOTICE', 'LECTURE'];
    for (let i = 0; i < 3; i++) {
      const sheet = new T.Mesh(new T.PlaneGeometry(0.34, 0.65), this.mat('#e9ddbc', '', 'paper'));
      sheet.position.set(-3.7 + i * 0.39, 1.79 + (i === 1 ? 0.06 : 0), 5.082);
      sheet.rotation.z = (i - 1) * 0.025;
      this.scene.add(sheet);
      this.sign(notices[i], -3.7 + i * 0.39, 1.97, 5.09, 0.29);
      for (let line = 0; line < 5; line++)
        this.box(
          '#a29a7e',
          -3.7 + i * 0.39,
          1.83 - line * 0.065,
          5.094,
          0.23 - (line % 2) * 0.03,
          0.008,
          0.008,
        );
      this.add('sphere', '#756346', -3.7 + i * 0.39, 2.07, 5.09, 0.014, 0.014, 0.012);
    }
    this.person(3.9, -4.4, '#685441', -0.6);
    this.person(4.1, -2.7, '#536b60', -2.1);
    this.table(-4.9, -13);
    // The printer's small hand press has its own silhouette and a sheet under the platen.
    for (const x of [-5.5, -4.3]) this.box('#4b4439', x, 1.54, -13, 0.1, 1.05, 0.12, 0, '', 'wood');
    this.box('#5c4e3c', -4.9, 2.04, -13, 1.4, 0.18, 0.25, 0, '', 'wood');
    this.add('cylinder', '#4d514b', -4.9, 1.83, -13, 0.05, 0.57, 0.05);
    this.box('#4f5145', -4.9, 1.5, -13, 0.94, 0.08, 0.59);
    this.box('#7f684b', -4.9, 2.16, -13, 0.78, 0.055, 0.065, 0.12);
    this.table(3.7, -9.2);
    this.person(5.1, -9.3, '#4f5a68', -0.35);
    this.box('#8b7758', -4.1, 0.34, 8.9, 0.82, 0.68, 0.72, 0, '', 'wood');
    this.box('#7c684e', -4.55, 0.21, 9.46, 0.56, 0.42, 0.53, -0.08, '', 'wood');
    this.box('#775043', -4.1, 0.73, 8.9, 0.48, 0.09, 0.4, 0, '', 'cloth');
    this.box('#d3c5a4', -4.1, 0.73, 8.92, 0.42, 0.05, 0.33);
    if (this.act === 3) this.paper(0.2, 0.05, 10.8, 0.67, 0.17, 'The morning paper');
    // A proper slatted bench by the water, not a featureless block.
    for (const z of [17.82, 18.02, 18.22])
      this.box('#8d7959', 9, 0.55, z, 1.8, 0.07, 0.16, 0, '', 'wood');
    for (const x of [8.35, 9.65]) {
      this.box('#4f5446', x, 0.28, 18, 0.09, 0.55, 0.54);
      this.box('#4f5446', x, 0.88, 17.65, 0.09, 0.8, 0.09);
    }
    for (const y of [0.83, 1.03]) this.box('#8d7959', 9, y, 17.65, 1.8, 0.15, 0.07, 0, '', 'wood');
    if (this.act === 3) this.paper(9, 0.6, 18, 0.4, -0.2, 'A better government');
    this.box('#8e7c5b', -3.2, 0.58, -10, 0.13, 1.16, 0.13, 0, '', 'wood');
    this.box('#6c5b43', -3.2, 1.2, -10, 0.7, 0.37, 0.38, 0, '', 'wood');
    this.add('roof', '#69634d', -3.2, 1.4, -10, 0.8, 0.32, 0.46);
    this.box('#d9ccab', -3.2, 1.21, -9.8, 0.41, 0.15, 0.012);
    // A distant moon/sun, stars and layered hills establish depth beyond the playable street.
    const skyBody = new T.Mesh(
      new T.SphereGeometry(1, 32, 20),
      new T.MeshBasicMaterial({ color: dawn ? '#fff2c4' : '#e9e5cf', fog: false }),
    );
    skyBody.position.set(-13, dawn ? 10 : 24, -63);
    skyBody.scale.setScalar(dawn ? 4.0 : 3.0);
    this.scene.add(skyBody);
    const haloCanvas = document.createElement('canvas');
    haloCanvas.width = 128;
    haloCanvas.height = 128;
    const haloContext = haloCanvas.getContext('2d')!;
    const haloGradient = haloContext.createRadialGradient(64, 64, 0, 64, 64, 64);
    haloGradient.addColorStop(0, dawn ? 'rgba(255,214,143,.26)' : 'rgba(196,224,224,.18)');
    haloGradient.addColorStop(0.4, dawn ? 'rgba(255,214,143,.10)' : 'rgba(196,224,224,.06)');
    haloGradient.addColorStop(1, 'rgba(196,224,224,0)');
    haloContext.fillStyle = haloGradient;
    haloContext.fillRect(0, 0, 128, 128);
    const haloTexture = new T.CanvasTexture(haloCanvas);
    this.textures.push(haloTexture);
    const halo = new T.Sprite(
      new T.SpriteMaterial({
        map: haloTexture,
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
        fog: false,
      }),
    );
    halo.position.copy(skyBody.position);
    halo.scale.setScalar(dawn ? 25 : 19);
    this.scene.add(halo);
    const ridge = [
      [-110, 4],
      [-94, 9],
      [-81, 7],
      [-70, 15],
      [-60, 18],
      [-49, 13],
      [-38, 20],
      [-24, 15],
      [-12, 12],
      [3, 17],
      [17, 22],
      [28, 19],
      [40, 12],
      [55, 15],
      [70, 10],
      [82, 16],
      [96, 11],
      [110, 5],
    ];
    for (let layer = 0; layer < 3; layer++) {
      const shape = new T.Shape();
      shape.moveTo(-115, -20);
      for (const [x, y] of ridge) shape.lineTo(x + layer * 3, y * (0.6 + layer * 0.13) - layer * 3);
      shape.lineTo(115, -20);
      shape.closePath();
      const mesh = new T.Mesh(
        new T.ShapeGeometry(shape),
        new T.MeshBasicMaterial({
          color: dawn
            ? ['#a5aaa0', '#8e9b8e', '#7c8e7e'][layer]
            : ['#394355', '#3d4d58', '#46585d'][layer],
          side: T.DoubleSide,
        }),
      );
      mesh.position.z = -94 + layer * 7;
      this.scene.add(mesh);
    }
    if (!dawn) {
      const positions: number[] = [];
      for (let i = 0; i < 68; i++)
        positions.push(
          (this.random(i * 3 + 100) - 0.5) * 160,
          22 + this.random(i * 3 + 101) * 45,
          -70 + this.random(i * 3 + 102) * 100,
        );
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      this.geometries.set('stars', geometry);
      this.scene.add(
        new T.Points(
          geometry,
          new T.PointsMaterial({ color: '#dce4db', size: 0.13, transparent: true, opacity: 0.65 }),
        ),
      );
    }
  }

  private buildCell() {
    this.box('#766e5c', 0, -0.2, 0, 10, 0.4, 12, 0, '', 'stone');
    this.ground('stone', '#a19c89', 0, 0, 9, 11, 4);
    this.box('#aca88e', -4.5, 2.25, 0, 0.5, 4.5, 12, 0, '', 'stone');
    this.box('#a9a48c', 0, 2.25, -5.5, 10, 4.5, 0.5, 0, '', 'stone');
    this.box('#a5a18b', 4.5, 0.82, 0, 0.5, 1.65, 12, 0, '', 'stone');
    this.box('#a5a18b', 4.5, 4.12, 0, 0.5, 0.8, 12, 0, '', 'stone');
    this.box('#a5a18b', 4.5, 2.65, -4.0, 0.5, 2.0, 3.0, 0, '', 'stone');
    this.box('#a5a18b', 4.5, 2.65, 3.15, 0.5, 2.0, 4.3, 0, '', 'stone');
    this.box('#514f44', 0, 4.55, 0, 9.7, 0.25, 12, 0, '', 'wood');
    for (const z of [-4, -1, 2, 5]) this.box('#4b4438', 0, 4.28, z, 9, 0.28, 0.24, 0, '', 'wood');
    this.box('#20323f', 4.7, 2.7, -0.8, 0.08, 2.2, 3.5, 0, '#1c2936');
    for (const z of [-2.3, -1.7, -1.1, -0.5, 0.1, 0.7])
      this.add('cylinder', '#343f3e', 4.2, 2.7, z, 0.032, 2.1, 0.032);
    for (const y of [1.65, 3.75])
      this.box('#c0b99d', 4.15, y, -0.8, 0.65, 0.16, 3.5, 0, '', 'stone');
    const windowLight = new T.PointLight('#d5dfdd', 4.5, 13, 1.6);
    windowLight.position.set(3.7, 3, -0.8);
    this.scene.add(windowLight);
    const moon = new T.DirectionalLight('#c5d8e2', 0.7);
    moon.position.set(12, 5, -4);
    moon.target.position.set(-3, 0, 1);
    moon.castShadow = !this.software;
    moon.shadow.mapSize.set(512, 512);
    Object.assign(moon.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
    moon.shadow.normalBias = 0.04;
    this.scene.add(moon, moon.target);
    // A thin translucent wash preserves the moonbeam in software renderers too.
    const beamCanvas = document.createElement('canvas');
    beamCanvas.width = 512;
    beamCanvas.height = 256;
    const beamContext = beamCanvas.getContext('2d')!;
    const gradient = beamContext.createLinearGradient(0, 0, 512, 0);
    gradient.addColorStop(0, 'rgba(206,219,215,0)');
    gradient.addColorStop(0.7, 'rgba(206,219,215,.13)');
    gradient.addColorStop(1, 'rgba(206,219,215,.22)');
    beamContext.fillStyle = gradient;
    beamContext.fillRect(0, 0, 512, 256);
    beamContext.globalCompositeOperation = 'destination-out';
    beamContext.fillStyle = '#000';
    for (let line = 0; line < 6; line++) {
      beamContext.beginPath();
      beamContext.moveTo(0, line * 46 - 20);
      beamContext.lineTo(512, line * 46 + 22);
      beamContext.lineTo(512, line * 46 + 28);
      beamContext.lineTo(0, line * 46 - 11);
      beamContext.fill();
    }
    const beamMap = new T.CanvasTexture(beamCanvas);
    this.textures.push(beamMap);
    const beam = new T.Mesh(
      new T.PlaneGeometry(5.8, 3.4),
      new T.MeshBasicMaterial({ map: beamMap, transparent: true, depthWrite: false }),
    );
    beam.rotation.x = -Math.PI / 2;
    beam.rotation.z = 0.12;
    beam.position.set(1.1, 0.026, -0.6);
    this.scene.add(beam);
    this.table(-2.5, -2.8);
    this.box('#74604a', -2.5, 0.53, -1.7, 0.7, 0.13, 0.62, 0, '', 'wood');
    for (const x of [-2.74, -2.26])
      for (const z of [-1.88, -1.52])
        this.box('#62533e', x, 0.27, z, 0.07, 0.54, 0.07, 0, '', 'wood');
    this.add('cylinder', '#c9b58b', -2.96, 1.18, -2.93, 0.04, 0.25, 0.04);
    this.add('sphere', '#ffdf9f', -2.96, 1.35, -2.93, 0.025, 0.06, 0.025, 0, '#ffd391');
    this.glow(-2.96, 1.35, -2.93, 0.55, 0.22);
    // Timber frame, stitched blanket and a softened linen pillow distinguish the bed.
    this.box('#66523c', -3, 0.47, 2.4, 1.5, 0.22, 2.9, 0, '', 'wood');
    for (const x of [-3.65, -2.35])
      for (const z of [1.04, 3.76]) this.box('#594b37', x, 0.36, z, 0.1, 0.72, 0.1, 0, '', 'wood');
    this.box('#b8a581', -3, 0.67, 2.4, 1.37, 0.23, 2.74, 0, '', 'cloth');
    this.box('#687766', -3, 0.81, 2.85, 1.4, 0.055, 1.8, 0, '', 'cloth');
    this.box('#89927a', -3, 0.84, 2.1, 1.41, 0.07, 0.35, 0, '', 'cloth');
    for (const x of [-3.56, -2.44]) this.box('#c1b594', x, 0.848, 2.86, 0.045, 0.008, 1.72);
    this.add('sphere', '#ddd0ae', -3, 0.89, 1.38, 0.57, 0.13, 0.28, 0, '', 'cloth');
    for (let x = -3.8; x < 4.2; x += 0.48)
      this.add('cylinder', '#38413f', x, 2, 5.3, 0.034, 4, 0.034);
    for (const y of [0.45, 2, 3.8]) this.box('#3c4541', 0, y, 5.3, 8.5, 0.075, 0.075);
    this.box('#5d5c49', 0.15, 1.7, 5.18, 0.2, 0.3, 0.07);
    this.add('sphere', '#182a2d', 0.15, 1.72, 5.14, 0.02, 0.03, 0.015);
    this.lantern(-0.5, -4.7, false);
    this.add('sphere', '#a19478', 3.1, 0.29, 3.7, 0.22, 0.28, 0.2);
    this.add('cylinder', '#a19478', 3.1, 0.54, 3.7, 0.09, 0.19, 0.09);
    this.add('cylinder', '#4c574f', 2.78, 0.12, 3.7, 0.08, 0.24, 0.08);
  }

  private buildObjectives() {
    const noteCanvas = document.createElement('canvas');
    noteCanvas.width = 96;
    noteCanvas.height = 128;
    const ctx = noteCanvas.getContext('2d')!;
    ctx.fillStyle = '#ecdfbb';
    ctx.beginPath();
    ctx.moveTo(17, 9);
    ctx.lineTo(65, 9);
    ctx.lineTo(81, 27);
    ctx.lineTo(79, 114);
    ctx.lineTo(16, 116);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#514c3e';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(65, 9);
    ctx.lineTo(64, 28);
    ctx.lineTo(81, 27);
    ctx.stroke();
    ctx.strokeStyle = '#7e7862';
    ctx.lineWidth = 2.3;
    for (let line = 0; line < 5; line++) {
      ctx.beginPath();
      ctx.moveTo(29, 46 + line * 11);
      ctx.lineTo(66 - (line % 2) * 8, 47 + line * 11);
      ctx.stroke();
    }
    const map = new T.CanvasTexture(noteCanvas);
    map.colorSpace = T.SRGBColorSpace;
    this.textures.push(map);
    const heights: Record<string, number> = {
      c01: 2.19,
      c02: 2.25,
      c03: 1.65,
      c04: 1.6,
      c05: 1.3,
      c06: 1.65,
      c07: 1.6,
      c08: 2.4,
      c09: 1.15,
      c10: 0.34,
      c11: 1.2,
      c12: 1.15,
    };
    for (const point of hotspots.filter((p) => p.act === this.act)) {
      const group = new T.Group();
      group.position.set(point.x, heights[point.id] ?? 1.75, point.z);
      const crystal = new T.Mesh(
        new T.PlaneGeometry(0.2, 0.27),
        new T.MeshBasicMaterial({ map, transparent: true, side: T.DoubleSide, depthWrite: false }),
      );
      group.add(crystal);
      this.scene.add(group);
      this.objectives.push({ point, group, crystal });
    }
  }

  private buildParticles() {
    const positions: number[] = [];
    for (let i = 0; i < 35; i++)
      positions.push(
        (this.random(i * 3 + 999) - 0.5) * (this.act === 2 ? 8 : 38),
        this.random(i * 3 + 1000) * 8,
        (this.random(i * 3 + 1001) - 0.5) * (this.act === 2 ? 10 : 55),
      );
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    this.geometries.set('particles', geometry);
    this.particles = new T.Points(
      geometry,
      new T.PointsMaterial({
        color: '#d3bf87',
        size: 0.035,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    );
    this.scene.add(this.particles);
  }

  private random(seed: number) {
    return sceneryRandom(seed);
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width),
      h = Math.max(1, rect.height);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  look(dx: number, dy: number) {
    if (this.getState().paused || this.preview) return;
    this.yaw -= dx * 0.004;
    this.pitch = T.MathUtils.clamp(this.pitch - dy * 0.003, -1.05, 1.05);
  }

  private free(x: number, z: number) {
    return isWalkable(this.act, this.boxes, x, z);
  }

  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    if (document.hidden) {
      this.last = now;
      return;
    }
    // Software renderers need fewer frames; physics always uses elapsed time.
    if (this.software && now - this.last < 32) return;
    const dt = Math.min(0.05, this.last ? (now - this.last) / 1000 : 0.016);
    this.last = now;
    const state = this.getState();
    if (!state.paused) this.time += dt;
    if (this.preview) {
      const motion = state.reduced ? 0 : Math.sin(this.time * 0.035) * 0.16;
      this.camera.position.set(0.9 + motion, 2.35, 16.5);
      this.camera.lookAt(-0.6, 2.35, -12);
    } else {
      if (!state.paused) {
        if (this.keys.has('KeyQ')) this.yaw += dt * 1.25;
        if (this.keys.has('KeyR')) this.yaw -= dt * 1.25;
        if (this.keys.has('PageUp')) this.pitch = Math.min(1.05, this.pitch + dt * 0.8);
        if (this.keys.has('PageDown')) this.pitch = Math.max(-1.05, this.pitch - dt * 0.8);
        let f =
          Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) -
          Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
        let s =
          Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) -
          Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
        const length = Math.hypot(f, s);
        if (length) {
          f /= length;
          s /= length;
        }
        const speed = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 5.6 : 3.5) * dt;
        const dx = (-Math.sin(this.yaw) * f + Math.cos(this.yaw) * s) * speed;
        const dz = (-Math.cos(this.yaw) * f - Math.sin(this.yaw) * s) * speed;
        if (this.free(this.camera.position.x + dx, this.camera.position.z))
          this.camera.position.x += dx;
        if (this.free(this.camera.position.x, this.camera.position.z + dz))
          this.camera.position.z += dz;
        if (length) this.step += dt * 8;
        const bridgeHeight =
          this.act !== 2 &&
          this.camera.position.x > 14.9 &&
          this.camera.position.z > 15.55 &&
          this.camera.position.z < 20.45
            ? 0.8
            : 0;
        this.camera.position.y =
          1.68 + bridgeHeight + (!state.reduced && length ? Math.sin(this.step) * 0.022 : 0);
      }
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
      const p = this.camera.position;
      let closest: Hotspot | null = null,
        distance = INSPECT_DISTANCE;
      for (const point of hotspots.filter(
        (h) => h.act === this.act && !state.collected.includes(h.id),
      )) {
        const d = Math.hypot(p.x - point.x, p.z - point.z);
        if (d < distance) {
          closest = point;
          distance = d;
        }
      }
      this.near = closest;
      if (closest?.id !== this.previousNear) {
        this.previousNear = closest?.id ?? null;
        this.onNear(closest);
      }
      if (now - this.lastReport > 150) {
        this.lastReport = now;
        this.onPosition(p.x, p.z, this.yaw);
      }
    }
    for (const o of this.objectives) {
      o.group.visible = !state.collected.includes(o.point.id) && !this.preview;
      o.crystal.quaternion.copy(this.camera.quaternion);
    }
    if (!state.reduced && !state.paused) {
      for (const flame of this.flames)
        flame.mesh.scale.y = 0.15 + Math.sin(this.time * 5 + flame.phase) * 0.008;
      if (this.particles) this.particles.rotation.y = Math.sin(this.time * 0.025) * 0.02;
    }
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    this.keys.clear();
    const gs = new Set<T.BufferGeometry>(),
      ms = new Set<T.Material>();
    this.scene.traverse((obj) => {
      const mesh = obj as T.Mesh;
      if (mesh.geometry) gs.add(mesh.geometry);
      if (mesh.material)
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) ms.add(m);
    });
    for (const g of gs) g.dispose();
    for (const m of ms) m.dispose();
    for (const t of this.textures) t.dispose();
    this.renderer.dispose();
    // React StrictMode immediately replays effects on the same canvas in development.
    // Forcing asynchronous context loss here would poison that next renderer.
    // Disposing scene resources and the renderer is sufficient; detached canvases are collected.
  }
}
