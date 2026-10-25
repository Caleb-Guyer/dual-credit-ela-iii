import * as T from 'three';
import { paintTexture, type PaintedSurface } from './paint';
import { Townsperson, jointBetween, type CharacterRole } from './characters';
import {
  createMotion,
  setMotionPose,
  takeMotionSteps,
  terrainHeight,
  updateMotion,
} from './motion';
import {
  hotspots,
  spawns,
  navigationObstacles,
  sceneryRandom,
  treePlacement,
  RIVER_BENCH,
  INSPECT_DISTANCE,
  type Hotspot,
  type Collider,
} from './navigation';
export { hotspots, type Hotspot } from './navigation';

type State = {
  paused: boolean;
  reduced: boolean;
  collected: string[];
  movementLocked?: boolean;
  posture?: 'stand' | 'sit' | 'window';
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
  private motion = createMotion({ x: 0, z: 0, yaw: 0 });
  private software = false;
  private dummy = new T.Object3D();
  private textures: T.Texture[] = [];
  private people: Townsperson[] = [];
  private characterColliders = new Map<Townsperson, Collider>();
  private interactions = new Map<
    string,
    (progress: number, step: number, active: boolean, collected: boolean) => void
  >();
  private interaction: { id: string; progress: number; step: number; cue: string | null } | null =
    null;
  private frameDt = 1 / 60;
  private interactionStarted = 0;
  private previousActionStep: number | null = null;
  private shownProgress = 0;
  private beforeInteraction: { yaw: number; pitch: number } | null = null;
  private returnView: { yaw: number; pitch: number } | null = null;
  private waterLines: T.Mesh[] = [];
  private waterMap?: T.Texture;
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
    setMotionPose(this.motion, spawn);
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
    return mesh;
  }

  private table(x: number, z: number, rotation = 0, writing = false) {
    this.box('#7b654c', x, 0.98, z, 1.5, 0.12, 0.82, rotation, '', 'wood');
    this.box('#544b3d', x, 0.79, z, 1.3, 0.19, 0.68, rotation, '', 'wood');
    for (const a of [-0.56, 0.56])
      for (const b of [-0.27, 0.27])
        this.box('#63513d', x + a, 0.46, z + b, 0.085, 0.93, 0.085, rotation, '', 'wood');
    const page = this.paper(x - 0.12, 1.05, z, 0.48, rotation + 0.12);
    this.add('cylinder', '#283f43', x + 0.47, 1.105, z + 0.1, 0.065, 0.12, 0.065);
    this.add('cylinder', '#172c32', x + 0.47, 1.17, z + 0.1, 0.042, 0.035, 0.042);
    if (writing) this.writingQuill(x, z, page);
    else
      this.segment(
        '#e8dfc5',
        new T.Vector3(x + 0.45, 1.18, z + 0.1),
        new T.Vector3(x + 0.64, 1.5, z + 0.12),
        0.012,
      );
    this.box('#6f4539', x + 0.52, 1.06, z - 0.23, 0.27, 0.045, 0.18, -0.1, '', 'cloth');
    return page;
  }

  private person(
    name: string,
    role: CharacterRole,
    x: number,
    z: number,
    coat: string,
    direction: number,
    seed: number,
    bonnet = false,
  ) {
    const person = new Townsperson(
      {
        name,
        role,
        x,
        z,
        coat,
        yaw: direction,
        seed,
        bonnet,
        skin: ['#b99575', '#c4a17d', '#9f785d', '#d1b08b'][seed % 4],
        hair: ['#514536', '#554c40', '#827867', '#6a5946'][seed % 4],
      },
      (color, cloth) => this.mat(color, '', cloth ? 'cloth' : undefined),
    );
    this.scene.add(person.group);
    this.people.push(person);
    const collider = { x, z, w: 0.18, d: 0.18 };
    this.boxes.push(collider);
    this.characterColliders.set(person, collider);
    return person;
  }

  private prop(
    parent: T.Object3D,
    kind: string,
    color: string,
    position: [number, number, number],
    scale: [number, number, number],
    finish?: PaintedSurface,
  ) {
    const mesh = new T.Mesh(this.geometry(kind), this.mat(color, '', finish));
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private writingQuill(x: number, z: number, page: T.Mesh) {
    const quill = new T.Group();
    quill.position.set(x + 0.47, 1.2, z + 0.1);
    quill.add(
      jointBetween(new T.Vector3(), new T.Vector3(0.2, 0.38, 0.02), 0.008, this.mat('#d3c6a4')),
    );
    const feather = this.prop(quill, 'sphere', '#e2d8ba', [0.15, 0.28, 0.02], [0.035, 0.16, 0.013]);
    feather.rotation.z = -0.48;
    this.scene.add(quill);
    const rest = quill.position.clone();
    const ink = new T.Group();
    ink.position.set(x - 0.12, 1.057, z);
    for (let row = 0; row < 4; row++)
      this.prop(
        ink,
        'box',
        '#3c4841',
        [-0.06 + (row % 2) * 0.015, 0, -0.17 + row * 0.09],
        [0.2 - (row % 2) * 0.04, 0.001, 0.007],
      );
    this.scene.add(ink);
    this.interactions.set('c07', (p, step, active, collected) => {
      const t = T.MathUtils.smoothstep(p, 0, 1);
      quill.position.copy(rest);
      quill.rotation.set(0, 0, 0);
      ink.visible = active ? step > 0 && p > 0.2 : collected;
      ink.scale.x = active && step > 0 ? Math.max(0.01, p) : 1;
      if (!active) return;
      if (step === 0) quill.position.y -= Math.sin(p * Math.PI) * 0.13;
      else {
        quill.position.lerp(
          new T.Vector3(x - 0.21 + t * 0.2, 1.06, z - 0.15 + t * 0.3),
          Math.min(1, t * 4),
        );
        quill.position.x += Math.sin(p * 55) * 0.013;
        quill.rotation.z = -0.42;
      }
      page.rotation.z = 0.12;
    });
  }

  setInteraction(id: string, progress: number, step: number, cue: string | null = null) {
    if (!this.interaction) {
      this.beforeInteraction = { yaw: this.yaw, pitch: this.pitch };
      this.returnView = null;
    }
    if (this.interaction?.id !== id || this.interaction.step !== step) {
      this.previousActionStep =
        this.interaction?.id === id &&
        this.interaction.step === 0 &&
        ['c02', 'c04', 'c07', 'c08', 'c11'].includes(id)
          ? 0
          : null;
      this.interactionStarted = this.time;
      this.shownProgress = 0;
    }
    this.interaction = { id, progress: T.MathUtils.clamp(progress, 0, 1), step, cue };
  }

  clearInteraction() {
    this.interaction = null;
    this.previousActionStep = null;
    this.shownProgress = 0;
    this.returnView = this.beforeInteraction;
    this.beforeInteraction = null;
  }

  drainFootsteps() {
    return takeMotionSteps(this.motion);
  }

  private ledger() {
    this.box('#775043', -4.1, 0.73, 8.9, 0.68, 0.08, 0.49, 0, '', 'cloth');
    this.box('#c8b894', -4.1, 0.78, 8.9, 0.62, 0.035, 0.43);
    this.paper(-4.26, 0.801, 8.9, 0.25, 0, 'Accounts');
    const leaf = new T.Group();
    leaf.position.set(-4.1, 0.804, 8.9);
    leaf.add(this.paper(0.15, 0, 0, 0.27, 0, 'Due / paid'));
    this.scene.add(leaf);
    this.interactions.set('c05', (p, step, active, collected) => {
      const turn = active ? (step > 0 ? 1 : T.MathUtils.smoothstep(p, 0, 1)) : collected ? 1 : 0;
      leaf.rotation.z = turn * Math.PI * 0.92;
      leaf.position.y = 0.804 + Math.sin(turn * Math.PI) * 0.025;
    });
    // The merchant's scales and parcels make this a working stall with a reason to stop.
    this.box('#8d795a', -4.88, 0.35, 8.26, 0.58, 0.7, 0.63, 0, '', 'wood');
    for (const z of [8.05, 8.45]) this.box('#65553f', -4.88, 0.7, z, 0.6, 0.03, 0.03);
    this.box('#c2b493', -4.88, 0.8, 8.26, 0.32, 0.2, 0.29, -0.08, '', 'paper');
    this.box('#726549', -4.88, 0.91, 8.26, 0.018, 0.02, 0.3);
  }

  private jailDoor() {
    const x = 4.4,
      z = -20.05;
    for (const side of [-1, 1])
      this.box('#777764', x + side * 1.1, 1.38, z, 0.25, 2.76, 0.35, 0, '', 'stone');
    this.box('#aaa38a', x, 2.82, z, 2.5, 0.23, 0.43, 0, '', 'stone');
    this.box('#8f8c75', x, 0.08, z + 0.1, 2.5, 0.16, 0.7, 0, '', 'stone');
    const gate = new T.Group();
    gate.position.set(x - 0.95, 0.15, z);
    this.prop(gate, 'box', '#485048', [0.95, 0.1, 0], [1.9, 0.14, 0.1]);
    this.prop(gate, 'box', '#485048', [0.95, 2.41, 0], [1.9, 0.14, 0.1]);
    for (let bar = 0; bar < 7; bar++)
      this.prop(gate, 'cylinder', '#3d4842', [0.1 + bar * 0.28, 1.25, 0], [0.025, 2.3, 0.025]);
    this.prop(gate, 'box', '#485048', [0.95, 1.16, 0], [1.9, 0.07, 0.09]);
    const latch = this.prop(gate, 'box', '#aa9670', [1.67, 1.16, 0.08], [0.36, 0.065, 0.06]);
    this.prop(gate, 'box', '#535a4d', [1.75, 1.16, 0.035], [0.21, 0.27, 0.06]);
    this.scene.add(gate);
    this.interactions.set('c06', (p, step, active, collected) => {
      gate.rotation.y = collected ? -0.68 : 0;
      latch.position.x = 1.67;
      if (active) {
        latch.position.x -= step > 0 ? 0.2 : p * 0.2;
        gate.rotation.y =
          step === 0
            ? Math.sin(p * Math.PI * 9) * 0.012 * p
            : -T.MathUtils.smoothstep(p, 0, 1) * 0.68;
      }
    });
    this.boxes.push({ x, z, w: 2.5, d: 0.28 });
  }

  private morningPaper() {
    const paper = new T.Group();
    paper.position.set(0.2, 0.055, 10.8);
    const left = this.paper(-0.17, 0, 0, 0.33, 0, 'The Concord paper');
    const right = new T.Group();
    right.add(this.paper(0.17, 0.003, 0, 0.33, 0, 'This morning'));
    paper.add(left, right);
    this.scene.add(paper);
    this.interactions.set('c10', (p, step, active, collected) => {
      const unfold = active ? (step > 0 ? 1 : T.MathUtils.smoothstep(p, 0, 1)) : 0;
      right.rotation.z = (1 - unfold) * -Math.PI * 0.91;
      paper.position.y =
        0.055 + (active ? (step > 0 ? 0.8 : T.MathUtils.smoothstep(p, 0, 0.4) * 0.8) : 0);
      paper.rotation.x = active ? -0.2 : 0;
      paper.rotation.y = active ? -0.15 : 0.17;
      paper.visible = !collected || active;
    });
  }

  private letterbox() {
    this.box('#6c5b43', -3.2, 1.2, -10, 0.7, 0.37, 0.38, 0, '', 'wood');
    this.box('#303e37', -3.2, 1.395, -10, 0.58, 0.02, 0.29);
    this.box('#d9ccab', -3.2, 1.21, -9.799, 0.41, 0.15, 0.012);
    this.sign('POST', -3.2, 1.23, -9.789, 0.3);
    const lid = new T.Group();
    lid.position.set(-3.2, 1.4, -10.2);
    this.prop(lid, 'box', '#827052', [0, 0.03, 0.2], [0.78, 0.08, 0.48], 'wood');
    this.prop(lid, 'sphere', '#c2aa73', [0, 0.07, 0.39], [0.035, 0.03, 0.025]);
    this.scene.add(lid);
    const letter = this.paper(-3.2, 1.4, -10, 0.34, 0, 'To a fellow citizen');
    this.interactions.set('c12', (p, step, active, collected) => {
      const open = active ? (step > 0 ? 1 : T.MathUtils.smoothstep(p, 0, 1)) : collected ? 1 : 0;
      lid.rotation.x = -open * 1.35;
      letter.position.set(-3.2, 1.4, -10);
      letter.rotation.x = -Math.PI / 2;
      letter.visible = active && step > 0;
      if (active && step > 0) {
        letter.position.y += p * 0.6;
        letter.position.z += p * 0.45;
        letter.rotation.x += p * 0.9;
      }
    });
  }

  private workingYards() {
    // Drying sheets, type trays and an ink roller explain the printer's trade at a glance.
    this.box('#66543e', -5.7, 0.56, -14.35, 1.03, 1.12, 0.47, 0, '', 'wood');
    for (const z of [-14.52, -14.18]) {
      this.box('#8f7958', -5.7, 1.15, z, 1.08, 0.065, 0.07, 0, '', 'wood');
      for (let type = 0; type < 7; type++)
        this.box(
          type % 3 === 0 ? '#424b43' : '#63695b',
          -6.1 + type * 0.13,
          1.18,
          z,
          0.08,
          0.065,
          0.09,
        );
    }
    this.segment(
      '#a99c7b',
      new T.Vector3(-6.03, 2.5, -14.4),
      new T.Vector3(-6.03, 2.5, -11.6),
      0.009,
    );
    for (const z of [-13.9, -13.1, -12.3]) {
      const sheet = this.paper(-6.03, 2.16, z, 0.42, 0.02, 'Concord');
      sheet.rotation.set(0, Math.PI / 2, 0.025);
      this.box('#7a6547', -6.03, 2.46, z, 0.06, 0.11, 0.035);
    }
    // Split logs, a rain barrel and a crooked trellis belong to particular households.
    for (let row = 0; row < 3; row++)
      for (let log = 0; log < 4 - row; log++) {
        const piece = this.prop(
          this.scene,
          'cylinder',
          log % 2 ? '#7b6647' : '#8c7351',
          [-5.7, 0.11 + row * 0.19, 1.45 + log * 0.2 + row * 0.09],
          [0.105, 0.7, 0.105],
          'wood',
        );
        piece.rotation.z = Math.PI / 2;
        const end = this.prop(
          this.scene,
          'cylinder',
          '#b19a70',
          [-5.34, 0.11 + row * 0.19, 1.45 + log * 0.2 + row * 0.09],
          [0.086, 0.014, 0.086],
        );
        end.rotation.z = Math.PI / 2;
      }
    this.add('cylinder', '#7e6b4d', -5.9, 0.52, -1.55, 0.36, 0.98, 0.36, 0, '', 'wood');
    for (const y of [0.15, 0.54, 0.91])
      this.add('cylinder', '#4f5a4e', -5.9, y, -1.55, 0.37, 0.045, 0.37);
    this.add('cylinder', '#3a4d44', -5.9, 1.025, -1.55, 0.28, 0.012, 0.28);
    this.segment('#7c7358', new T.Vector3(-6.1, 0.1, 11.8), new T.Vector3(-6.02, 2.7, 11.7), 0.032);
    this.segment('#7c7358', new T.Vector3(-6.1, 0.1, 13.8), new T.Vector3(-6.02, 2.7, 13.9), 0.032);
    for (const y of [0.65, 1.25, 1.85, 2.45]) this.box('#958767', -6.04, y, 12.8, 0.04, 0.035, 2.3);
    for (let vine = 0; vine < 8; vine++) {
      const y = 0.3 + vine * 0.27;
      const z = 12.8 + Math.sin(vine * 1.7) * 0.75;
      this.add('sphere', vine % 2 ? '#72855d' : '#83946b', -5.97, y, z, 0.09, 0.12, 0.2);
    }
    // One parked handcart gives the lane an irregular, lived-in edge.
    const cart = new T.Group();
    cart.position.set(5.7, 0, 4.7);
    cart.rotation.y = -0.16;
    this.prop(cart, 'box', '#8c7754', [0, 0.6, 0], [1.07, 0.12, 1.25], 'wood');
    for (const side of [-1, 1]) {
      for (const y of [0.73, 0.96])
        this.prop(cart, 'box', '#a18b65', [side * 0.56, y, 0], [0.08, 0.16, 1.32], 'wood');
      this.prop(cart, 'box', '#7d6b4c', [side * 0.36, 0.48, 1.02], [0.075, 0.075, 1.15], 'wood');
      const wheel = this.prop(
        cart,
        'cylinder',
        '#514d3c',
        [side * 0.71, 0.37, -0.09],
        [0.34, 0.075, 0.34],
      );
      wheel.rotation.z = Math.PI / 2;
      const hub = this.prop(
        cart,
        'cylinder',
        '#a38c62',
        [side * 0.765, 0.37, -0.09],
        [0.075, 0.1, 0.075],
      );
      hub.rotation.z = Math.PI / 2;
      for (let spoke = 0; spoke < 4; spoke++) {
        const angle = (spoke * Math.PI) / 4;
        const strut = this.prop(
          cart,
          'box',
          '#a38c62',
          [side * 0.758, 0.37, -0.09],
          [0.02, 0.59, 0.028],
        );
        strut.rotation.x = angle;
      }
    }
    for (const z of [-0.61, 0.61])
      this.prop(cart, 'box', '#8d7958', [0, 0.85, z], [1.15, 0.4, 0.08], 'wood');
    this.prop(cart, 'sphere', '#a89c7d', [-0.16, 0.86, -0.12], [0.29, 0.25, 0.36], 'cloth');
    this.prop(cart, 'sphere', '#978b6f', [0.22, 0.83, 0.21], [0.25, 0.21, 0.28], 'cloth');
    this.scene.add(cart);
    this.boxes.push(
      { x: 5.7, z: 4.7, w: 1.3, d: 1.5 },
      { x: -5.7, z: 1.9, w: 0.8, d: 1.1 },
      { x: -5.9, z: -1.55, w: 0.65, d: 0.65 },
      { x: -3.3, z: 5, w: 1.5, d: 0.15 },
      { x: -4.9, z: -13, w: 1.5, d: 0.82 },
      { x: 3.7, z: -9.2, w: 1.5, d: 0.82 },
      { x: -4.1, z: 8.9, w: 0.82, d: 0.72 },
      { ...RIVER_BENCH, w: 0.64, d: 1.8 },
      { x: -3.2, z: -10, w: 0.7, d: 0.38 },
    );
  }

  private riverbank(dawn: boolean) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = dawn ? '#3b7882' : '#214c61';
    ctx.fillRect(0, 0, 512, 512);
    for (let ripple = 0; ripple < 240; ripple++) {
      const x = this.random(ripple + 1700) * 512;
      const y = this.random(ripple + 2000) * 512;
      const length = 18 + this.random(ripple + 2400) * 130;
      ctx.strokeStyle = ripple % 3 ? 'rgba(164,211,204,.32)' : 'rgba(13,54,72,.35)';
      ctx.lineWidth = ripple % 4 === 0 ? 2 : 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x - 3, y + length * 0.3, x + 3, y + length * 0.6, x, y + length);
      ctx.stroke();
    }
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.repeat.set(3, 18);
    map.anisotropy = 4;
    this.textures.push(map);
    this.waterMap = map;
    const surface = new T.Mesh(
      new T.PlaneGeometry(14, 110),
      new T.MeshStandardMaterial({
        map,
        roughness: 0.42,
        metalness: 0.06,
        emissive: '#123c49',
        emissiveIntensity: 0.12,
      }),
    );
    surface.rotation.x = -Math.PI / 2;
    surface.position.set(25, -0.012, 15);
    this.scene.add(surface);

    // The far shore undulates instead of ending the water in a ruler-straight strip.
    const vertices: number[] = [],
      indices: number[] = [];
    for (let row = 0; row <= 38; row++) {
      const z = -42 + row * 3;
      const edge = 32.1 + Math.sin(z * 0.23) * 0.38 + Math.sin(z * 0.71) * 0.13;
      vertices.push(edge, 0.055, z, 49, 0.04, z);
      if (row < 38) {
        const a = row * 2;
        indices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
      }
    }
    const shoreGeometry = new T.BufferGeometry();
    shoreGeometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    shoreGeometry.setIndex(indices);
    shoreGeometry.computeVertexNormals();
    const shore = new T.Mesh(shoreGeometry, this.mat(dawn ? '#758463' : '#3f5748'));
    shore.receiveShadow = true;
    this.scene.add(shore);

    for (let i = 0; i < 42; i++) {
      const z = -35 + i * 2.6 + Math.sin(i * 1.9) * 0.62;
      if (z > 14.8 && z < 21.2) continue;
      if (i % 5 === 4) continue;
      const x = 17.85 + Math.sin(i * 2.1) * 0.23;
      this.add(
        'sphere',
        i % 3 ? '#778274' : '#929582',
        x,
        0.025,
        z,
        0.28 + this.random(i) * 0.24,
        0.12 + this.random(i + 80) * 0.11,
        0.42,
      );
      this.add(
        'sphere',
        '#677e6a',
        32.1 + Math.sin(z * 0.23) * 0.38,
        0.025,
        z + 0.7,
        0.3,
        0.14,
        0.5,
      );
      if (i % 2 === 0)
        for (let stem = 0; stem < 3; stem++) {
          const rx = x - 0.24 - stem * 0.09,
            rz = z + stem * 0.18;
          const height = 0.55 + this.random(i + stem + 400) * 0.36;
          this.add('cylinder', '#6f8051', rx, height / 2, rz, 0.012, height, 0.012);
          this.add('sphere', '#726146', rx, height, rz, 0.027, 0.11, 0.027);
          this.segment(
            '#83905a',
            new T.Vector3(rx, 0.17, rz),
            new T.Vector3(rx - 0.17, height * 0.7, rz + 0.08),
            0.013,
          );
        }
    }
    // Worn stones lead off the lane to the seat, without making another paved street.
    for (let i = 0; i < 7; i++)
      this.add(
        'sphere',
        '#92967c',
        8.5 + i * 0.79,
        0.02,
        21.7 + Math.sin(i * 0.8) * 0.14,
        0.35,
        0.035,
        0.26,
      );
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
      const tree = treePlacement(i);
      this.tree(tree.x, tree.z, tree.scale, i);
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
    this.riverbank(dawn);
    for (let i = 0; i < 22; i++) {
      const line = this.prop(
        this.scene,
        'box',
        dawn ? '#b1beb0' : '#819895',
        [19.2 + this.random(i + 70) * 11, 0, -35 + i * 4],
        [1 + this.random(i) * 3, 0.008, 0.025],
      );
      line.rotation.y = this.random(i) * 0.2;
      this.waterLines.push(line);
    }
    // Each plank follows the physical approach: the bridge rises under your feet.
    for (let i = 0; i < 43; i++) {
      const x = 14.65 + i * 0.5;
      const y = terrainHeight(this.act, x, 18);
      const plank = this.prop(
        this.scene,
        'box',
        i % 4 === 0 ? '#aa9774' : '#9a8969',
        [x, y - 0.09, 18],
        [0.49, 0.18, 4.3],
        'wood',
      );
      plank.rotation.z = Math.atan2(
        terrainHeight(this.act, x + 0.25, 18) - terrainHeight(this.act, x - 0.25, 18),
        0.5,
      );
    }
    for (const z of [15.9, 20.1]) {
      for (let x = 15; x < 35.7; x += 1.5) {
        const y = terrainHeight(this.act, x, 18);
        this.box('#85745b', x, y + 0.55, z, 0.13, 1.25, 0.13, 0, '', 'wood');
        const rail = this.prop(
          this.scene,
          'box',
          '#b7a581',
          [x + 0.75, y + 1.05, z],
          [1.52, 0.1, 0.13],
          'wood',
        );
        rail.rotation.z = Math.atan2(terrainHeight(this.act, x + 1.5, 18) - y, 1.5);
      }
    }
    this.box('#75816a', 10.9, 0.03, 18, 9, 0.15, 5);
    // The noticeboard carries actual sheets, with a pitched wooden cap and iron tacks.
    this.box('#79634a', -3.3, 1.75, 5, 1.5, 1.2, 0.14, 0, '', 'wood');
    for (const x of [-3.9, -2.7]) this.box('#65563f', x, 0.9, 5, 0.11, 1.8, 0.13, 0, '', 'wood');
    this.box('#66533e', -3.3, 2.4, 5, 1.75, 0.09, 0.36);
    const notices = ['TOWN MEETING', 'PUBLIC NOTICE', 'LECTURE'];
    for (let i = 0; i < 3; i++) {
      if (i === 1) continue;
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
    const noticePivot = new T.Group();
    noticePivot.position.set(-3.31, 2.13, 5.105);
    const notice = this.paper(0, -0.31, 0, 0.45, 0, 'PUBLIC NOTICE');
    notice.rotation.x = 0;
    noticePivot.add(notice);
    this.scene.add(noticePivot);
    this.interactions.set('c01', (p, step, active, collected) => {
      noticePivot.position.set(-3.31, 2.13, 5.105);
      noticePivot.rotation.set(0, 0, 0);
      notice.visible = !collected || active;
      if (active) {
        noticePivot.rotation.x = step === 0 ? -Math.sin(p * Math.PI) * 0.3 : -0.4;
        noticePivot.rotation.z = step === 0 ? Math.sin(p * Math.PI) * -0.08 : -0.06;
        if (step > 0) {
          noticePivot.position.z += T.MathUtils.smoothstep(p, 0, 1) * 0.5;
          noticePivot.position.y += T.MathUtils.smoothstep(p, 0, 1) * 0.2;
        }
      }
    });
    this.person('Ruth, a neighbor', 'neighbor', 3.95, -4.75, '#78604a', -0.1, 2, true);
    this.person('Elias, a neighbor', 'neighbor', 4.12, -3.2, '#536b60', -2.85, 1);
    this.person('Samuel, the printer', 'printer', -5.65, -13.2, '#6b7564', 0.8, 0);
    const printPage = this.table(-4.9, -13);
    // The printer's small hand press has its own silhouette and a sheet under the platen.
    for (const x of [-5.5, -4.3]) this.box('#4b4439', x, 1.54, -13, 0.1, 1.05, 0.12, 0, '', 'wood');
    this.box('#5c4e3c', -4.9, 2.04, -13, 1.4, 0.18, 0.25, 0, '', 'wood');
    const screw = this.prop(
      this.scene,
      'cylinder',
      '#4d514b',
      [-4.9, 1.83, -13],
      [0.05, 0.57, 0.05],
    );
    for (let ring = 0; ring < 7; ring++)
      this.add('cylinder', '#788073', -4.9, 1.62 + ring * 0.055, -13, 0.065, 0.013, 0.065);
    const platen = this.prop(this.scene, 'box', '#4f5145', [-4.9, 1.5, -13], [0.94, 0.08, 0.59]);
    const lever = new T.Group();
    lever.position.set(-4.9, 2.16, -13);
    this.prop(lever, 'box', '#7f684b', [0.24, 0, 0], [1.2, 0.065, 0.07], 'wood');
    this.prop(lever, 'sphere', '#554936', [0.84, 0, 0], [0.07, 0.07, 0.07]);
    this.scene.add(lever);
    this.interactions.set('c03', (p, step, active, collected) => {
      const cycle = active && step === 0 ? Math.sin(p * Math.PI) : 0;
      lever.rotation.y = cycle * 1.7;
      screw.position.y = 1.83 - cycle * 0.27;
      platen.position.y = 1.5 - cycle * 0.27;
      printPage.position.set(-5.02, 1.05, -13);
      printPage.rotation.x = -Math.PI / 2;
      if (active && step > 0) {
        printPage.position.y += T.MathUtils.smoothstep(p, 0, 1) * 0.55;
        printPage.position.z += p * 0.3;
        printPage.rotation.x += p * 0.8;
      }
      printPage.visible = !collected || active;
    });
    const taxBill = this.table(3.7, -9.2);
    this.person('Mr. Lowell, the collector', 'collector', 4.85, -9.8, '#4f5a68', -0.65, 3);
    this.person('Mrs. Bell, the merchant', 'merchant', -5.05, 8.75, '#795a48', 0.9, 2);
    this.person('Jonas, the jailer', 'jailer', 5.15, -20.3, '#6a6c5d', -0.6, 1);
    const taxCoin = this.prop(
      this.scene,
      'cylinder',
      '#b39b65',
      [3.95, 1.055, -9.43],
      [0.09, 0.018, 0.09],
    );
    taxCoin.name = 'tax-coin';
    this.prop(taxCoin, 'cylinder', '#d5bd82', [0, 0.58, 0], [0.72, 0.11, 0.72]);
    this.interactions.set('c04', (p, step, active, collected) => {
      const target = new T.Vector3(3.95, 1.055, -9.43);
      let rotation = 0;
      taxBill.position.y = 1.05;
      if (active) {
        if (step === 0) taxBill.position.y += Math.sin(p * Math.PI) * 0.1;
        else {
          const cue = this.interaction?.cue;
          if (cue === 'offer-coin') target.set(3.95, 1.065, -9.08);
          else {
            const reach = cue === 'refuse-tax' ? 0.6 : 0.92;
            target.set(
              this.camera.position.x - Math.sin(this.yaw) * reach,
              this.camera.position.y - (cue === 'refuse-tax' ? 0.35 : 0.48),
              this.camera.position.z - Math.cos(this.yaw) * reach,
            );
            rotation = cue === 'refuse-tax' ? 0.8 : 0.3;
          }
        }
      }
      taxCoin.position.lerp(target, 1 - Math.exp(-this.frameDt * 8));
      taxCoin.rotation.z = T.MathUtils.damp(taxCoin.rotation.z, rotation, 8, this.frameDt);
      taxCoin.visible = active || !collected;
    });
    this.box('#8b7758', -4.1, 0.34, 8.9, 0.82, 0.68, 0.72, 0, '', 'wood');
    this.box('#7c684e', -4.55, 0.21, 9.46, 0.56, 0.42, 0.53, -0.08, '', 'wood');
    this.ledger();
    this.jailDoor();
    if (this.act === 3) {
      this.morningPaper();
      this.person('A morning reader', 'walker', 2.5, 11.6, '#7d7157', 0, 4);
    }
    // A proper slatted bench by the water, not a featureless block.
    const { x: bx, z: bz } = RIVER_BENCH;
    for (const offset of [-0.18, 0.02, 0.22])
      this.box('#8d7959', bx + offset, 0.55, bz, 0.16, 0.07, 1.8, 0, '', 'wood');
    for (const offset of [-0.65, 0.65]) {
      this.box('#4f5446', bx, 0.28, bz + offset, 0.54, 0.55, 0.09);
      this.box('#4f5446', bx - 0.35, 0.88, bz + offset, 0.09, 0.8, 0.09);
    }
    for (const y of [0.83, 1.03])
      this.box('#8d7959', bx - 0.35, y, bz, 0.07, 0.15, 1.8, 0, '', 'wood');
    if (this.act === 3) {
      const benchPage = this.paper(bx, 0.6, bz, 0.4, -0.2, 'Road and bridge');
      this.interactions.set('c11', (p, step, active, collected) => {
        benchPage.rotation.x =
          -Math.PI / 2 + (active && step > 0 ? Math.sin(p * Math.PI) * 0.22 : 0);
        benchPage.position.y = 0.6 + (active ? Math.sin(p * Math.PI) * 0.06 : 0);
        benchPage.visible = !collected || active;
      });
    }
    this.box('#8e7c5b', -3.2, 0.58, -10, 0.13, 1.16, 0.13, 0, '', 'wood');
    this.letterbox();
    this.workingYards();
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
    // A real fragment of the village lies beyond the opening, at a believable distance.
    this.box('#58695c', 13, -0.12, 0, 18, 0.18, 23);
    this.box('#6c7569', 13, 1.45, -1.3, 4.1, 2.9, 3.8, 0, '', 'plaster');
    this.add('roof', '#2e4144', 13, 2.9, -1.3, 4.8, 2.7, 4.5, 0, '', 'slate');
    this.box('#706757', 13.3, 4.1, -1.3, 0.43, 1.6, 0.47, 0, '', 'brick');
    this.box('#8c8065', 13.3, 4.93, -1.3, 0.57, 0.13, 0.6);
    this.box('#e2c48d', 10.935, 1.85, -0.9, 0.018, 0.77, 0.7, 0, '#70542c');
    this.box('#514f3e', 10.91, 1.85, -0.9, 0.025, 0.035, 0.72);
    this.box('#514f3e', 10.91, 1.85, -0.9, 0.025, 0.8, 0.035);
    this.tree(11.2, 3.6, 0.72, 2);
    for (const z of [-2.3, -1.7, -1.1, -0.5, 0.1, 0.7])
      this.add('cylinder', '#343f3e', 4.2, 2.7, z, 0.032, 2.1, 0.032);
    for (const y of [1.65, 3.75])
      this.box('#c0b99d', 4.15, y, -0.8, 0.65, 0.16, 3.5, 0, '', 'stone');
    const windowLight = new T.PointLight('#d5dfdd', 4.5, 13, 1.6);
    windowLight.position.set(3.7, 3, -0.8);
    this.scene.add(windowLight);
    const shutter = new T.Group();
    shutter.position.set(4.13, 2.7, -2.32);
    this.prop(shutter, 'box', '#5d6654', [0, 0, 0.7], [0.075, 1.9, 1.4], 'wood');
    for (const y of [-0.61, 0.61])
      this.prop(shutter, 'box', '#3e4c44', [-0.055, y, 0.7], [0.055, 0.12, 1.48]);
    const shutterLatch = this.prop(
      shutter,
      'box',
      '#b3a071',
      [-0.07, -0.2, 1.24],
      [0.045, 0.06, 0.26],
    );
    this.scene.add(shutter);
    this.interactions.set('c08', (p, step, active, collected) => {
      const open = active ? (step > 0 ? 1 : T.MathUtils.smoothstep(p, 0, 1)) : collected ? 1 : 0;
      shutter.rotation.y = -0.35 - open * 1.12;
      shutterLatch.rotation.x = active && step === 0 ? -Math.sin(p * Math.PI) * 0.65 : 0;
      windowLight.intensity = 3.4 + open * 2.5;
    });
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
    this.table(-2.5, -2.8, 0, true);
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
    const blanket = this.prop(
      this.scene,
      'box',
      '#687766',
      [-3, 0.81, 2.85],
      [1.4, 0.055, 1.8],
      'cloth',
    );
    this.box('#89927a', -3, 0.84, 2.1, 1.41, 0.07, 0.35, 0, '', 'cloth');
    for (const x of [-3.56, -2.44]) this.box('#c1b594', x, 0.848, 2.86, 0.045, 0.008, 1.72);
    this.add('sphere', '#ddd0ae', -3, 0.89, 1.38, 0.57, 0.13, 0.28, 0, '', 'cloth');
    this.interactions.set('c09', (p, step, active) => {
      const sit = active ? (step > 0 ? 1 : T.MathUtils.smoothstep(p, 0, 1)) : 0;
      blanket.position.y = 0.81 - sit * 0.025;
      blanket.scale.y = 0.055 - sit * 0.012;
    });
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
    this.returnView = null;
    this.yaw -= dx * 0.004;
    this.pitch = T.MathUtils.clamp(this.pitch - dy * 0.003, -1.05, 1.05);
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
    const dt = Math.min(0.2, this.last ? (now - this.last) / 1000 : 0.016);
    this.last = now;
    const state = this.getState();
    this.frameDt = state.paused ? 0 : dt;
    if (!state.paused) this.time += dt;
    if (this.preview) {
      const motion = state.reduced ? 0 : Math.sin(this.time * 0.035) * 0.16;
      this.camera.position.set(0.9 + motion, 2.35, 16.5);
      this.camera.lookAt(-0.6, 2.35, -12);
    } else {
      if (!state.paused) {
        // World may restore an exact pose when returning from the notebook.
        if (
          Math.hypot(
            this.motion.x - this.camera.position.x,
            this.motion.z - this.camera.position.z,
          ) > 0.001
        )
          setMotionPose(this.motion, {
            x: this.camera.position.x,
            z: this.camera.position.z,
            yaw: this.yaw,
            pitch: this.pitch,
          });
        this.motion.yaw = this.yaw;
        this.motion.pitch = this.pitch;
        if (this.returnView && !this.interaction) {
          if (['KeyQ', 'KeyR', 'PageUp', 'PageDown'].some((key) => this.keys.has(key)))
            this.returnView = null;
          else {
            const angle = Math.atan2(
              Math.sin(this.returnView.yaw - this.motion.yaw),
              Math.cos(this.returnView.yaw - this.motion.yaw),
            );
            this.motion.yaw += angle * (1 - Math.exp(-dt * 5));
            this.motion.pitch = T.MathUtils.damp(this.motion.pitch, this.returnView.pitch, 5, dt);
            if (Math.abs(angle) + Math.abs(this.returnView.pitch - this.motion.pitch) < 0.005)
              this.returnView = null;
          }
        }
        if (this.interaction && state.movementLocked) {
          const point = hotspots.find((candidate) => candidate.id === this.interaction?.id);
          const target =
            point && this.interaction.id === 'c11' && this.interaction.step >= 1
              ? { ...point, x: 24, z: 25 }
              : point;
          if (target) {
            const targetYaw = Math.atan2(
              this.camera.position.x - target.x,
              this.camera.position.z - target.z,
            );
            const angle = Math.atan2(
              Math.sin(targetYaw - this.motion.yaw),
              Math.cos(targetYaw - this.motion.yaw),
            );
            this.motion.yaw += angle * (1 - Math.exp(-dt * 4.2));
            const heights: Record<string, number> = {
              c01: 1.9,
              c02: 1.65,
              c03: 1.6,
              c04: 1.2,
              c05: 0.85,
              c06: 1.4,
              c07: 1.17,
              c08: 2.65,
              c09: 0.86,
              c10: 0.85,
              c11: this.interaction.step >= 1 ? -0.05 : 0.7,
              c12: 1.55,
            };
            // Put the hands/face in the upper third, above the conversation card.
            const targetPitch =
              Math.atan2(
                (heights[target.id] ?? 1.4) - this.motion.eyeHeight,
                Math.max(
                  0.8,
                  Math.hypot(this.camera.position.x - target.x, this.camera.position.z - target.z),
                ),
              ) - (this.interaction.id === 'c11' && this.interaction.step >= 1 ? 0 : 0.23);
            this.motion.pitch +=
              (T.MathUtils.clamp(targetPitch, -1.05, 1.05) - this.motion.pitch) *
              (1 - Math.exp(-dt * 3.5));
          }
        }
        updateMotion(
          this.motion,
          {
            forward:
              Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) -
              Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')),
            strafe:
              Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) -
              Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')),
            sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
            turn: Number(this.keys.has('KeyQ')) - Number(this.keys.has('KeyR')),
            tilt: Number(this.keys.has('PageUp')) - Number(this.keys.has('PageDown')),
          },
          dt,
          {
            act: this.act,
            colliders: this.boxes,
            reduced: state.reduced,
            locked: state.movementLocked,
            posture: state.posture,
          },
        );
        this.yaw = this.motion.yaw;
        this.pitch = this.motion.pitch;
        this.camera.position.set(this.motion.x, this.motion.eyeHeight, this.motion.z);
        this.camera.rotation.z = this.motion.sway;
      }
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
      const p = this.camera.position;
      let closest: Hotspot | null = null,
        distance = Infinity;
      for (const point of hotspots.filter((h) => h.act === this.act)) {
        const d = Math.hypot(p.x - point.x, p.z - point.z);
        if (d >= INSPECT_DISTANCE) continue;
        const score = d + (state.collected.includes(point.id) ? 0.15 : 0);
        if (score < distance) {
          closest = point;
          distance = score;
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
      o.group.visible = !state.collected.includes(o.point.id) && !this.preview && !this.interaction;
      o.crystal.quaternion.copy(this.camera.quaternion);
    }
    if (this.interaction)
      this.shownProgress = T.MathUtils.damp(this.shownProgress, this.interaction.progress, 14, dt);
    for (const person of this.people) {
      person.update(
        this.time,
        state.paused ? 0 : dt,
        this.camera.position,
        state.reduced,
        this.interaction?.id,
        this.shownProgress,
      );
      const collider = this.characterColliders.get(person)!;
      collider.x = person.group.position.x;
      collider.z = person.group.position.z;
    }
    for (const [id, pose] of this.interactions) {
      const active = this.interaction?.id === id;
      const transition =
        active && this.previousActionStep !== null && this.time - this.interactionStarted < 0.45;
      pose(
        active
          ? transition
            ? T.MathUtils.smoothstep(this.time - this.interactionStarted, 0, 0.45)
            : this.shownProgress
          : 0,
        active ? (transition ? this.previousActionStep! : this.interaction!.step) : 0,
        active,
        state.collected.includes(id),
      );
    }
    if (!state.reduced && !state.paused) {
      for (const flame of this.flames)
        flame.mesh.scale.y = 0.15 + Math.sin(this.time * 5 + flame.phase) * 0.008;
      if (this.particles) this.particles.rotation.y = Math.sin(this.time * 0.025) * 0.02;
      this.waterLines.forEach((line, index) => {
        line.position.x += Math.sin(this.time * 0.6 + index) * dt * 0.025;
        line.scale.x =
          (1 + this.random(index) * 3) * (1 + Math.sin(this.time * 0.8 + index) * 0.08);
      });
      if (this.waterMap) this.waterMap.offset.y += dt * 0.008;
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
    // The next renderer may reuse this canvas during StrictMode or a chapter change.
    // Reset pixel-unpack flags before its placeholder array textures are initialized.
    this.renderer.resetState();
    this.renderer.dispose();
    // React StrictMode immediately replays effects on the same canvas in development.
    // Forcing asynchronous context loss here would poison that next renderer.
    // Disposing scene resources and the renderer is sufficient; detached canvases are collected.
  }
}
