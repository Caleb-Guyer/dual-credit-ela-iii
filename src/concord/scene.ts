import * as T from 'three';
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
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = act === 2 ? 1.5 : 1.3;
    const dawn = act === 3;
    this.scene.background = new T.Color(act === 2 ? '#16252d' : dawn ? '#a5b6ba' : '#132b3a');
    this.scene.fog = new T.FogExp2(
      act === 2 ? '#16252d' : dawn ? '#a5b6ba' : '#193341',
      act === 2 ? 0.025 : 0.018,
    );
    this.scene.add(
      new T.HemisphereLight(dawn ? '#ffe1b5' : '#b7d5ed', '#263d3c', act === 2 ? 1.25 : 1.75),
    );
    const moon = new T.DirectionalLight(dawn ? '#ffcb85' : '#bad8ed', dawn ? 3.2 : 1.8);
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

  private mat(color: string, glow = '') {
    const key = color + glow;
    if (!this.materials.has(key)) {
      this.materials.set(
        key,
        new T.MeshStandardMaterial({
          color,
          roughness: 0.86,
          metalness: 0.04,
          ...(glow ? { emissive: glow, emissiveIntensity: 1.4 } : {}),
        }),
      );
    }
    return this.materials.get(key)!;
  }

  private geometry(kind: string): T.BufferGeometry {
    if (!this.geometries.has(kind)) {
      let g: T.BufferGeometry;
      if (kind === 'sphere') g = new T.IcosahedronGeometry(1, 1);
      else if (kind === 'cylinder') g = new T.CylinderGeometry(1, 1, 1, 8);
      else if (kind === 'cone') g = new T.ConeGeometry(1, 1, 7);
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
  ) {
    const key = `${kind}:${color}:${glow}`;
    if (!this.batches.has(key))
      this.batches.set(key, {
        geometry: this.geometry(kind),
        material: this.mat(color, glow),
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
  ) {
    this.add('box', color, x, y, z, sx, sy, sz, ry, glow);
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

  private window(x: number, y: number, z: number, sx: number, sy: number, facing: number) {
    const side = Math.abs(facing) === 1;
    const depth = side ? 0.09 : sx;
    const width = side ? sx : 0.09;
    this.box('#d2a56c', x, y, z, depth, sy, width, 0, '#8d5a24');
    this.box('#d7c7a5', x, y, z, side ? 0.14 : sx + 0.15, 0.08, side ? sx + 0.15 : 0.14);
    this.box('#b8b9a9', x, y, z, side ? 0.15 : 0.06, sy + 0.08, side ? 0.06 : 0.15);
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
    this.box('#455456', x, 0.17, z, w + 0.35, 0.34, d + 0.35);
    this.box(color, x, h / 2 + 0.3, z, w, h, d);
    for (let y = 0.6; y < h; y += 0.35)
      this.box('#85938b', x, y, z + d / 2 + 0.012, w, 0.025, 0.025);
    this.add('roof', '#293d4b', x, h + 0.3, z, w + 0.65, w * 0.66, d + 0.65);
    this.box('#222f36', x, h + 0.35, z, w + 0.8, 0.13, d + 0.8);
    this.box('#825d4d', x + w * 0.24, h + 1.8, z - d * 0.15, 0.65, 2.4, 0.6);
    this.box('#373b3d', x + w * 0.24, h + 3.05, z - d * 0.15, 0.85, 0.15, 0.8);
    const side = x < 0 ? 1 : -1;
    const front = x + side * (w / 2 + 0.03);
    this.box('#2b373a', front, 1.35, z, 0.12, 2.1, 1.15);
    this.box('#b9b7a0', front + side * 0.02, 0.33, z, 0.65, 0.2, 1.5);
    for (const offset of [-d * 0.3, d * 0.3]) {
      this.window(front + side * 0.03, 2, z + offset, 0.85, 1.1, side);
      if (h > 4.2) this.window(front + side * 0.03, 4.1, z + offset, 0.75, 0.95, side);
    }
    for (const offset of [-w * 0.27, w * 0.27])
      this.window(x + offset, 2.1, z + d / 2 + 0.05, 0.8, 1.0, 0);
    if (seed % 2 === 0) {
      this.box('#4a3f32', front + side * 1, 0.5, z + 1.9, 0.7, 1, 0.7);
      this.add('cylinder', '#80623d', front + side * 1.2, 0.45, z - 1.8, 0.36, 0.9, 0.36);
    }
  }

  private lantern(x: number, z: number, tall = true) {
    const y = tall ? 3.3 : 1.45;
    if (tall) {
      this.box('#26363b', x, 1.5, z, 0.12, 3, 0.12);
      this.box('#1d3038', x, 0.18, z, 0.43, 0.35, 0.43);
    }
    this.box('#203039', x, y, z, 0.42, 0.65, 0.42);
    this.box('#ffdca0', x, y, z, 0.3, 0.45, 0.3, 0, '#ffad4b');
    this.add('cone', '#24333a', x, y + 0.5, z, 0.4, 0.35, 0.4);
    const flame = new T.Mesh(this.geometry('sphere'), this.mat('#fff0b2', '#ffb34b'));
    flame.position.set(x, y, z);
    flame.scale.set(0.11, 0.22, 0.11);
    this.scene.add(flame);
    this.flames.push({ mesh: flame, y, phase: x * 1.5 + z });
    if (this.lights.length < (this.software ? 2 : 5)) {
      const light = new T.PointLight('#ffc77d', 6, 9, 1.6);
      light.position.set(x, y + 0.1, z);
      this.scene.add(light);
      this.lights.push(light);
    }
  }

  private tree(x: number, z: number, scale: number, index: number) {
    this.add('cylinder', '#5c4c3b', x, 1.65 * scale, z, 0.2 * scale, 3.3 * scale, 0.2 * scale);
    const colors = ['#8d643c', '#a47b44', '#687b58', '#b28c51'];
    for (let i = 0; i < 4; i++)
      this.add(
        'sphere',
        colors[(index + i) % 4],
        x + Math.sin(i * 2.3) * scale,
        (3.5 + (i % 2) * 0.7) * scale,
        z + Math.cos(i * 2.3) * scale * 0.8,
        1.5 * scale,
        1.3 * scale,
        1.4 * scale,
      );
  }

  private table(x: number, z: number, rotation = 0) {
    this.box('#70583f', x, 1.0, z, 1.55, 0.13, 0.9, rotation);
    for (const a of [-0.55, 0.55])
      for (const b of [-0.3, 0.3]) this.box('#514b3b', x + a, 0.5, z + b, 0.1, 1, 0.1);
    this.box('#dfcfaa', x, 1.09, z, 0.55, 0.025, 0.42, rotation + 0.15);
    for (let i = 0; i < 4; i++)
      this.box('#7c7966', x, 1.108, z - 0.12 + i * 0.065, 0.33, 0.006, 0.008, rotation);
  }

  private person(x: number, z: number, coat: string, direction: number) {
    this.add('cylinder', coat, x, 0.94, z, 0.25, 0.95, 0.25);
    this.add('sphere', '#b99a79', x, 1.65, z, 0.18, 0.23, 0.18);
    this.add('cylinder', '#28333a', x, 1.86, z, 0.25, 0.08, 0.25);
    this.add('cylinder', '#28333a', x, 1.98, z, 0.16, 0.22, 0.16);
    for (const s of [-1, 1]) {
      this.box('#26343a', x + s * 0.12, 0.3, z, 0.14, 0.6, 0.17);
      this.box(coat, x + s * 0.29, 1.1, z, 0.11, 0.65, 0.15, direction);
    }
  }

  private sign(text: string, x: number, y: number, z: number, width = 2.2, rotation = 0) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#283c40';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#b39d6c';
    ctx.lineWidth = 4;
    ctx.strokeRect(9, 9, 494, 110);
    ctx.fillStyle = '#e1cfaa';
    ctx.font = '30px Georgia';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 65, 470);
    const texture = new T.CanvasTexture(c);
    texture.colorSpace = T.SRGBColorSpace;
    this.textures.push(texture);
    const geometry = new T.PlaneGeometry(width, width / 4);
    this.geometries.set(`sign-${text}`, geometry);
    const material = new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide });
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotation;
    this.scene.add(mesh);
  }

  private buildTown(dawn: boolean) {
    const sky = new T.Mesh(
      new T.SphereGeometry(115, 24, 16),
      new T.ShaderMaterial({
        uniforms: {
          top: { value: new T.Color(dawn ? '#6d929f' : '#081d2e') },
          bottom: { value: new T.Color(dawn ? '#dac5a0' : '#34535b') },
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
    this.box('#3a514c', 0, -0.23, 0, 100, 0.4, 120);
    this.box('#5a6158', 0, -0.01, -1, 9.7, 0.1, 66);
    this.box('#73766a', -5.1, 0.02, 0, 0.55, 0.12, 65);
    this.box('#73766a', 5.1, 0.02, 0, 0.55, 0.12, 65);
    for (let i = 0; i < 180; i++) {
      const r = this.random(i + 41),
        q = this.random(i + 922);
      this.box(
        i % 3 ? '#666d62' : '#77796b',
        (r - 0.5) * 9.3,
        0.05,
        (q - 0.5) * 63,
        0.22 + r * 0.32,
        0.04,
        0.16 + q * 0.2,
        r * 4,
      );
    }
    const colors = ['#647b78', '#8c8c79', '#586e72', '#738383', '#857965'];
    for (let i = 0; i < 5; i++) {
      this.house(-9.8 - (i % 2) * 0.8, -22 + i * 11, 7.1, 7.1, i % 2 ? 5.5 : 4.5, colors[i], i);
      if (i < 4)
        this.house(10, -23 + i * 11, 7.2, 7.5, 4.7 + (i % 2) * 0.8, colors[(i + 2) % 5], i + 1);
    }
    this.sign('CONCORD  ·  MASSACHUSETTS', 0, 4.25, -29.4, 5.2);
    this.box('#38494b', 0, 2.8, -30, 7, 5.6, 5.5);
    this.add('roof', '#243746', 0, 5.6, -30, 8, 4.8, 6.4);
    this.box('#b4b7a3', 0, 7.4, -30, 1.2, 3, 1.2);
    this.add('cone', '#29404d', 0, 9.5, -30, 1.1, 1.6, 1.1);
    this.sign('PRINT & STATIONERY', -6.13, 3.3, -13, 2.6, Math.PI / 2);
    this.sign('COUNTY JAIL', 6.3, 3.25, -19.4, 2.2, -Math.PI / 2);
    this.sign('TAX OFFICE', 6.3, 3.25, -10.8, 2.1, -Math.PI / 2);
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
      const x = side * (16.7 + this.random(i + 4) * 13);
      const z = -34 + this.random(i + 18) * 70;
      this.tree(x, z, 0.7 + this.random(i + 45) * 0.65, i);
    }
    this.box('#31525a', 25, -0.08, 15, 14, 0.12, 110);
    for (let i = 0; i < 22; i++)
      this.box(
        dawn ? '#a2b3a8' : '#6f9394',
        19.2 + this.random(i + 70) * 11,
        0,
        -35 + i * 4,
        1 + this.random(i) * 3,
        0.015,
        0.04,
        this.random(i) * 0.2,
      );
    this.box('#887a5c', 24, 0.6, 18, 18, 0.35, 4.3);
    for (let i = 0; i < 35; i++) this.box('#544e40', 15.4 + i * 0.5, 0.8, 18, 0.06, 0.05, 4.2);
    for (const z of [15.9, 20.1]) {
      this.box('#ac9b77', 24, 1.65, z, 18, 0.12, 0.14);
      for (let x = 15.6; x < 33; x += 2.1) this.box('#716c55', x, 1.1, z, 0.15, 1.25, 0.15);
    }
    this.box('#5e6b5e', 10.9, 0.03, 18, 9, 0.15, 5);
    // River bank is solid except on the bridge.
    this.box('#5c5140', -3.3, 1.75, 5, 1.5, 1.2, 0.14);
    for (const x of [-3.9, -2.7]) this.box('#534f3e', x, 0.9, 5, 0.12, 1.8, 0.14);
    for (let i = 0; i < 3; i++)
      this.box('#d9c9a3', -3.65 + i * 0.35, 1.82, 5.08, 0.28, 0.65, 0.025, 0.03 * i);
    this.person(3.9, -4.4, '#514c43', 0);
    this.person(4.1, -2.7, '#3f5c5d', 0.3);
    this.table(-4.9, -13);
    this.table(3.7, -9.2);
    this.person(5.1, -9.3, '#46565c', 0);
    this.table(-4.1, 8.9);
    this.box('#75624a', -4.1, 1.17, 8.9, 0.48, 0.1, 0.4);
    this.table(0.2, 10.8);
    this.box('#777565', 9, 0.45, 18, 1.8, 0.9, 0.7);
    this.box('#c3b38b', 9, 0.94, 18, 1.4, 0.06, 0.52);
    this.box('#7b7159', -3.2, 0.7, -10, 1.3, 0.14, 0.8);
    this.box('#b3ad8e', -3.2, 0.85, -10, 0.7, 0.1, 0.5);
    // A distant moon/sun, stars and layered hills establish depth beyond the playable street.
    const skyBody = new T.Mesh(
      this.geometry('sphere'),
      new T.MeshBasicMaterial({ color: dawn ? '#fff2c4' : '#e9e5cf' }),
    );
    skyBody.position.set(-25, dawn ? 12 : 31, -63);
    skyBody.scale.setScalar(dawn ? 4.8 : 2.6);
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
      }),
    );
    halo.position.copy(skyBody.position);
    halo.scale.setScalar(dawn ? 25 : 19);
    this.scene.add(halo);
    for (let i = 0; i < 14; i++)
      this.add(
        'sphere',
        '#29464a',
        -70 + i * 10,
        -3,
        -72 - this.random(i) * 6,
        12,
        10 + this.random(i + 19) * 5,
        14,
      );
    if (!dawn) {
      const positions: number[] = [];
      for (let i = 0; i < 170; i++)
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
    this.box('#596365', 0, -0.2, 0, 10, 0.4, 12);
    for (let row = 0; row < 8; row++) {
      for (let i = 0; i < 8; i++) {
        const z = -5.3 + i * 1.5 + (row % 2) * 0.3;
        for (const x of [-4.5, 4.5]) {
          if (x > 0 && row >= 3 && row <= 5 && z > -2.4 && z < 1.1) continue;
          this.box(row % 2 ? '#697777' : '#647274', x, row * 0.56 + 0.25, z, 0.45, 0.53, 1.42);
        }
      }
      for (let i = 0; i < 7; i++)
        this.box('#667577', -4.2 + i * 1.4, row * 0.56 + 0.25, -5.5, 1.34, 0.53, 0.4);
    }
    this.box('#35484c', 0, 4.55, 0, 9.7, 0.25, 12);
    for (const z of [-4, -1, 2, 5]) this.box('#5e5948', 0, 4.25, z, 9, 0.25, 0.22);
    this.box('#314752', 4.6, 2.7, -0.8, 0.08, 1.9, 2.5, 0, '#38505c');
    for (let z = -1.9; z < 0.5; z += 0.4) this.box('#263b44', 4.2, 2.7, z, 0.1, 2, 0.08);
    for (const y of [1.75, 3.65]) this.box('#83918c', 4.15, y, -0.8, 0.55, 0.15, 2.8);
    const windowLight = new T.PointLight('#b3dcf0', 12, 12, 1.6);
    windowLight.position.set(3.7, 3, -0.8);
    this.scene.add(windowLight);
    // Patches of moonlight across the stone floor.
    for (let i = 0; i < 5; i++)
      this.box('#879996', 1.4 + i * 0.44, 0.015, -0.8, 0.22, 0.015, 2.3, -0.3);
    this.table(-2.5, -2.8);
    this.box('#644f37', -2.5, 0.6, -1.7, 0.8, 0.15, 0.75);
    for (const x of [-2.8, -2.2]) this.box('#4d4938', x, 0.3, -1.7, 0.1, 0.6, 0.1);
    this.box('#4c4737', -3, 0.45, 2.4, 1.5, 0.5, 2.9);
    this.box('#a49d7b', -3, 0.75, 2.4, 1.35, 0.25, 2.7);
    this.box('#d0c5a5', -3, 0.93, 1.4, 1.1, 0.15, 0.55);
    this.box('#6a7c74', -3, 0.91, 2.9, 1.37, 0.09, 1.55);
    for (let x = -3.8; x < 4.2; x += 0.45) this.box('#263940', x, 2, 5.3, 0.08, 4, 0.08);
    for (const y of [0.5, 2, 3.8]) this.box('#35474b', 0, y, 5.3, 8.5, 0.12, 0.12);
    this.lantern(-0.5, -4.7, false);
    this.sign('THE STATE CAN CONFINE THE BODY', 0, 3.1, -5.23, 3.3);
    this.add('cylinder', '#5d655d', 3.1, 0.3, 3.7, 0.35, 0.6, 0.35);
  }

  private buildObjectives() {
    for (const point of hotspots.filter((p) => p.act === this.act)) {
      const group = new T.Group();
      group.position.set(point.x, this.act === 2 && point.id === 'c08' ? 2.25 : 1.75, point.z);
      const crystal = new T.Mesh(
        new T.OctahedronGeometry(0.15),
        new T.MeshBasicMaterial({ color: '#ffe1a0' }),
      );
      group.add(crystal);
      const ring = new T.Mesh(
        new T.TorusGeometry(0.3, 0.012, 5, 24),
        new T.MeshBasicMaterial({ color: '#e9bc72', transparent: true, opacity: 0.6 }),
      );
      group.add(ring);
      this.scene.add(group);
      this.objectives.push({ point, group, crystal });
    }
  }

  private buildParticles() {
    const positions: number[] = [];
    for (let i = 0; i < 90; i++)
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
        opacity: 0.5,
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
      const motion = state.reduced ? 0 : Math.sin(this.time * 0.065);
      this.camera.position.set(4 + motion * 2.4, 5.7, 18 + Math.cos(this.time * 0.04) * 1.4);
      this.camera.lookAt(-1, 2.4, -10);
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
      if (!state.reduced && !state.paused) {
        o.crystal.rotation.y = this.time * 0.65;
        o.crystal.position.y = Math.sin(this.time * 1.4) * 0.065;
      }
    }
    if (!state.reduced && !state.paused) {
      for (const flame of this.flames)
        flame.mesh.scale.y = 0.2 + Math.sin(this.time * 7 + flame.phase) * 0.02;
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
