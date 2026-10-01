import * as T from 'three';
import { AdventureEngine, obstacles } from './engine';
import type { Chapter } from './data';

/** Original low-poly scenery. Layouts illustrate the narrative; they are not historical surveys. */
export class AdventureWorld {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(73, 1, 0.08, 180);
  private materials = new Map<string, T.MeshStandardMaterial>();
  private geometries: T.BufferGeometry[] = [];
  private textures: T.Texture[] = [];
  private boxGeometry = new T.BoxGeometry(1, 1, 1);
  private sphereGeometry = new T.IcosahedronGeometry(1, 1);
  private cylinderGeometry = new T.CylinderGeometry(1, 1, 1, 8);
  private trees: T.Group[] = [];
  private sheep: T.Group[] = [];
  private objectives: T.Group[] = [];
  private npcs = new Map<number, T.Group>();
  private boats: T.Group[] = [];
  private gulls: T.Group[] = [];
  private hands = new T.Group();
  private bread = new T.Group();
  private chalk = new T.Group();
  private water?: T.ShaderMaterial;
  private port = new T.Group();
  private sun: T.DirectionalLight;
  private observer: ResizeObserver;
  private disposed = false;
  private lastStage = -1;
  private finalScenes = new Map<string, T.Group>();
  private pickups: { stage: number; index: number; group: T.Group }[] = [];
  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly engine: AdventureEngine,
  ) {
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    const gl = this.renderer.getContext();
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const driver = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : '';
    // Software renderers have no GPU. Keep the full world and controls, but reduce fill and shadow work.
    const software = /swiftshader|llvmpipe|software rasterizer/i.test(driver);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, software ? 0.65 : 1.6));
    this.renderer.shadowMap.enabled = !software;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    const id = engine.mission.id;
    const sky = (
      {
        4: '#a5bfbc',
        5: '#a2c4d3',
        6: '#e8c7a4',
        7: '#adccdc',
        8: '#b7b0c7',
        9: '#c7b392',
        10: '#acc4b0',
        11: '#a3c6d5',
        12: '#77839b',
      } as Record<number, string>
    )[id];
    this.scene.background = new T.Color(sky);
    this.scene.fog = new T.Fog(sky, 30, 110);
    this.scene.add(new T.HemisphereLight('#fff0d2', '#4a6560', 2.4));
    this.sun = new T.DirectionalLight('#ffe0ae', 3.2);
    this.sun.position.set(-24, 32, -32);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -35;
    this.sun.shadow.camera.right = 35;
    this.sun.shadow.camera.top = 35;
    this.sun.shadow.camera.bottom = -35;
    this.sun.shadow.normalBias = 0.06;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.build(id);
    this.buildHands();
    this.camera.add(this.hands);
    this.scene.add(this.camera);
    engine.mission.stages.forEach((s, i) => {
      const group = new T.Group();
      group.position.set(s.at[0], 0.06, s.at[1]);
      const ring = new T.Mesh(
        new T.TorusGeometry(0.75, 0.035, 8, 40),
        this.mat('#ffe5aa', '#d09f53'),
      );
      this.geometries.push(ring.geometry);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
      const crystal = new T.Mesh(new T.OctahedronGeometry(0.17), this.mat('#ffe6b8', '#aa7036'));
      this.geometries.push(crystal.geometry);
      crystal.position.y = 2.2;
      group.add(crystal);
      this.scene.add(group);
      this.objectives.push(group);
      s.collect?.points.forEach((point, index) => {
        const item = new T.Group();
        item.position.set(point[0], 0.6, point[1]);
        if (s.collect!.label === 'Oil cargo') {
          this.cylinder(0, 0, 0, 0.38, 0.85, '#755b40', item);
          for (const y of [-0.3, 0.3]) this.cylinder(0, y, 0, 0.395, 0.07, '#a6a290', item);
        } else if (s.collect!.label === 'Wood bundles') {
          for (const x of [-0.18, 0.18]) {
            const wood = this.cylinder(x, 0, 0, 0.15, 1.1, '#9b7a4e', item);
            wood.rotation.z = Math.PI / 2;
          }
        } else if (s.collect!.label === 'Shipyard tools') {
          this.box(0, 0, 0, 0.12, 0.7, 0.12, '#936c41', item);
          this.box(0, 0.32, 0, 0.5, 0.16, 0.18, '#738e96', item);
        } else if (s.collect!.label === 'Horse tracks') {
          this.box(0, -0.52, 0, 0.35, 0.03, 0.4, '#efd6a6', item);
          this.box(0.3, -0.52, 0.5, 0.35, 0.03, 0.4, '#efd6a6', item);
        } else if (s.collect!.label === 'Argument fragments') {
          this.box(0, 0, 0, 0.55, 0.35, 0.06, '#e6d5b5', item);
          this.box(0, 0.02, 0.04, 0.3, 0.025, 0.03, '#596f75', item);
        } else {
          this.sphere(0, 0, 0, 0.35, 0.3, 0.4, '#d4b17e', item);
          this.box(0, -0.23, 0, 0.7, 0.09, 0.7, '#8e6b45', item);
        }
        const glint = this.sphere(0, 1.2, 0, 0.09, 0.15, 0.09, '#ffe3a3', item);
        glint.material = this.mat('#ffe3a3', '#bb8941');
        this.scene.add(item);
        this.pickups.push({ stage: i, index, group: item });
      });
      if (s.object === 'person' || (id === 7 && i === 3)) {
        const character = this.person(i, id);
        character.position.set(s.at[0], 0, s.at[1] - 0.65);
        this.scene.add(character);
        this.npcs.set(i, character);
      } else if (s.object === 'lantern') this.lantern(s.at[0] + 0.9, s.at[1]);
      else if (s.object === 'desk' && id !== 6) {
        this.box(s.at[0] + 0.8, 0.9, s.at[1] - 0.7, 2, 0.15, 1, '#826346');
        this.box(s.at[0] + 0.8, 0.45, s.at[1] - 0.7, 0.15, 0.9, 0.8, '#4b4436');
      }
    });
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
  }
  private mat(color: string, emissive?: string) {
    const key = color + (emissive ?? '');
    if (!this.materials.has(key))
      this.materials.set(
        key,
        new T.MeshStandardMaterial({
          color,
          roughness: 0.9,
          flatShading: true,
          emissive: emissive ?? '#000',
          emissiveIntensity: emissive ? 0.5 : 0,
        }),
      );
    return this.materials.get(key)!;
  }
  private mesh(geometry: T.BufferGeometry, color: string, parent: T.Object3D = this.scene) {
    const mesh = new T.Mesh(geometry, this.mat(color));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  private box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    parent: T.Object3D = this.scene,
  ) {
    const m = this.mesh(this.boxGeometry, color, parent);
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    return m;
  }
  private sphere(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    parent: T.Object3D = this.scene,
  ) {
    const m = this.mesh(this.sphereGeometry, color, parent);
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    return m;
  }
  private cylinder(
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    color: string,
    parent: T.Object3D = this.scene,
  ) {
    const m = this.mesh(this.cylinderGeometry, color, parent);
    m.position.set(x, y, z);
    m.scale.set(r, h, r);
    return m;
  }
  private text(
    text: string,
    x: number,
    y: number,
    z: number,
    width: number,
    color = '#eee1bd',
    parent: T.Object3D = this.scene,
  ) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#283b39';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#b09a70';
    ctx.strokeRect(5, 5, 502, 118);
    ctx.font = 'bold 38px Georgia';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, 256, 66, 470);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    this.textures.push(tex);
    const material = new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide });
    const geo = new T.PlaneGeometry(width, width / 4);
    this.geometries.push(geo);
    const m = new T.Mesh(geo, material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  private tree(x: number, z: number, seed: number) {
    const g = new T.Group();
    g.position.set(x, 0, z);
    const h = 4.5 + (seed % 4);
    this.cylinder(0, h / 2, 0, 0.22, h, '#655b49', g);
    this.sphere(0, h, 0, 2, 2.7, 2.1, seed % 2 ? '#506e58' : '#65836a', g);
    this.sphere(-0.8, h - 0.8, 0.3, 1.6, 2, 1.5, '#435e4b', g);
    this.scene.add(g);
    this.trees.push(g);
  }
  private lantern(x: number, z: number) {
    this.cylinder(x, 1.25, z, 0.055, 2.5, '#49483d');
    this.box(x, 2.3, z, 0.4, 0.6, 0.4, '#3d4842');
    const light = new T.Mesh(this.boxGeometry, this.mat('#f9cd79', '#ffc573'));
    light.position.set(x, 2.3, z + 0.22);
    light.scale.set(0.25, 0.4, 0.04);
    this.scene.add(light);
  }
  private house(
    x: number,
    z: number,
    w: number,
    d: number,
    h: number,
    color: string,
    parent: T.Object3D = this.scene,
  ) {
    this.box(x, h / 2, z, w, h, d, color, parent);
    this.box(x, h + 0.15, z, w + 0.5, 0.35, d + 0.5, '#4b5559', parent);
    const roofGeo = new T.ConeGeometry(1, 1, 4);
    this.geometries.push(roofGeo);
    const roof = this.mesh(roofGeo, '#565951', parent);
    roof.position.set(x, h + 1.2, z);
    roof.scale.set(w * 0.75, 2.1, d * 0.75);
    roof.rotation.y = Math.PI / 4;
    for (let y = 1.8; y < h; y += 2.1)
      for (let a = -w / 2 + 1; a < w / 2; a += 2) {
        this.box(x + a, y, z + d / 2 + 0.02, 0.85, 1.2, 0.06, '#364c53', parent);
        this.box(x + a, y, z + d / 2 + 0.06, 0.05, 1.2, 0.04, '#d6c7a0', parent);
        this.box(x + a, y, z + d / 2 + 0.06, 0.85, 0.05, 0.04, '#d6c7a0', parent);
      }
    this.box(x, 0.95, z + d / 2 + 0.03, 1.1, 1.9, 0.1, '#3b4846', parent);
    this.box(x + w / 3, h + 1.5, z, 0.75, 2, 0.8, '#786e63', parent);
  }
  private fence(
    x: number,
    z: number,
    length: number,
    horizontal = true,
    parent: T.Object3D = this.scene,
  ) {
    for (let i = -length / 2; i <= length / 2; i += 1.5)
      this.box(
        x + (horizontal ? i : 0),
        0.65,
        z + (horizontal ? 0 : i),
        0.13,
        1.3,
        0.13,
        '#82715b',
        parent,
      );
    for (const y of [0.4, 0.95])
      this.box(
        x,
        y,
        z,
        horizontal ? length : 0.09,
        0.1,
        horizontal ? 0.09 : length,
        '#9d8769',
        parent,
      );
  }
  private waterPlane(x: number, z: number, w: number, d: number, y = -0.06) {
    if (!this.water)
      this.water = new T.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          base: { value: new T.Color(this.engine.mission.id === 8 ? '#496477' : '#3d8491') },
        },
        vertexShader:
          'varying vec3 v; void main(){v=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:
          'uniform float time; uniform vec3 base; varying vec3 v; void main(){float a=sin(v.x*2.5+v.y*.5+time)*sin(v.y*1.9-time*.7); float b=pow(max(0.,a),10.); gl_FragColor=vec4(base+vec3(.16,.19,.18)*b,1.);}',
        side: T.DoubleSide,
      });
    const geo = new T.PlaneGeometry(w, d);
    this.geometries.push(geo);
    const mesh = new T.Mesh(geo, this.water);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
  }
  private ship(x: number, z: number, scale: number, parent: T.Object3D = this.scene) {
    const ship = new T.Group();
    ship.position.set(x, 0, z);
    ship.scale.setScalar(scale);
    parent.add(ship);
    this.box(0, -0.6, 0, 7.8, 1.1, 28, '#584d42', ship);
    this.box(0, -0.08, 0, 7.4, 0.15, 28, '#a98b65', ship);
    for (let i = -14; i < 14; i += 0.6) this.box(0, 0.015, i, 7.4, 0.015, 0.035, '#73664f', ship);
    this.fence(-3.9, 0, 28, false, ship);
    this.fence(3.9, 0, 28, false, ship);
    this.cylinder(0, 6, -2, 0.22, 12, '#66523b', ship);
    this.box(0, 10, -2, 9, 0.15, 0.15, '#594f3d', ship);
    const sailGeo = new T.PlaneGeometry(8.2, 6.3, 8, 5);
    const positions = sailGeo.attributes.position;
    for (let i = 0; i < positions.count; i++)
      positions.setZ(i, Math.cos(positions.getX(i) * 0.36) * 0.7);
    sailGeo.computeVertexNormals();
    this.geometries.push(sailGeo);
    const sailMat = new T.MeshStandardMaterial({
      color: '#f0e2bf',
      side: T.DoubleSide,
      roughness: 1,
    });
    const sail = new T.Mesh(sailGeo, sailMat);
    sail.position.set(0, 6.7, -2);
    ship.add(sail);
    if (this.engine.mission.id < 9) this.text('BALTIMORE', 0, 1.4, -12, 2.1, '#fff0c3', ship);
    return ship;
  }
  private person(index: number, chapter: Chapter) {
    const g = new T.Group();
    const sophia = chapter === 6 && index === 0;
    const boy = chapter === 7 && (index === 1 || index === 3);
    const skin =
      chapter === 9 && index === 1
        ? '#d3b495'
        : chapter >= 9 || chapter === 5
          ? '#ac805f'
          : '#d3b495';
    const coat = sophia ? '#728984' : boy ? '#a68a64' : '#526779';
    for (const x of [-0.13, 0.13]) {
      this.box(x, 0.4, 0, 0.18, 0.8, 0.2, '#505651', g);
      this.box(x, 0.07, 0.07, 0.23, 0.14, 0.35, '#413e37', g);
    }
    this.box(0, 1, 0, 0.56, 0.7, 0.3, coat, g);
    this.box(0, 1.23, 0.17, 0.15, 0.3, 0.03, '#e4dbc6', g);
    const head = this.sphere(0, 1.65, 0, 0.24, 0.3, 0.24, skin, g);
    head.geometry = new T.SphereGeometry(1, 16, 12);
    this.geometries.push(head.geometry);
    this.sphere(0, 1.62, 0.23, 0.035, 0.055, 0.05, skin, g);
    this.sphere(0, 1.84, -0.05, 0.26, 0.16, 0.25, '#51433a', g);
    for (const x of [-0.09, 0.09]) this.box(x, 1.7, 0.22, 0.025, 0.025, 0.025, '#302e2b', g);
    this.box(0, 1.53, 0.23, 0.1, 0.025, 0.02, '#725449', g).name = 'mouth';
    for (const x of [-0.36, 0.36]) {
      const arm = this.box(x, 1, 0, 0.17, 0.65, 0.18, coat, g);
      arm.rotation.z = x > 0 ? 0.14 : -0.14;
      this.sphere(x, 0.65, 0.02, 0.1, 0.12, 0.1, skin, g);
    }
    if (sophia) {
      this.sphere(0, 1.73, -0.23, 0.2, 0.23, 0.15, '#51433a', g);
      this.sphere(0, 1.9, -0.05, 0.28, 0.12, 0.23, '#e1d5bb', g);
      this.box(0, 0.55, 0, 0.75, 0.8, 0.5, '#627d78', g);
      this.box(0, 0.73, 0.28, 0.5, 0.85, 0.05, '#d8c9aa', g);
    }
    if (boy) g.scale.setScalar(0.82);
    return g;
  }
  private build(chapter: Chapter) {
    if (chapter >= 9) {
      this.buildFinal();
      return;
    }
    this.scene.add(this.port);
    if (chapter !== 5) {
      this.box(0, -0.3, -6, 90, 0.5, 105, chapter === 7 ? '#b0ab96' : '#73826a');
      this.box(0, -0.01, -6, 8, 0.04, 58, chapter === 7 ? '#baa88b' : '#b4a384');
      for (let z = -30; z < 20; z += 1.4)
        for (let x = -3; x <= 3; x += 1.5) {
          if (chapter === 6 && z > -9 && z < 15) continue;
          const m = this.box(
            x + Math.sin(z) * 0.08,
            0.025,
            z,
            1.35,
            0.025,
            1.18,
            (Math.round(z * 10) + x) % 2 ? '#b7a68a' : '#af9f84',
          );
          m.rotation.y = Math.sin(z * x) * 0.03;
        }
    }
    for (let i = 0; i < 18; i++) {
      const x = Math.sin(i * 23.1) * 75,
        z = -35 - i * 5;
      for (let j = 0; j < 4; j++) {
        const cloud = this.sphere(x + j * 3, 25 + (i % 4), z, 4, 1.3, 2, '#efe9d7');
        cloud.castShadow = false;
      }
    }
    for (let i = 0; i < 6; i++) {
      const gull = new T.Group();
      const a = this.box(-0.25, 0, 0, 0.55, 0.05, 0.16, '#f0ede1', gull);
      a.rotation.z = 0.3;
      const b = this.box(0.25, 0, 0, 0.55, 0.05, 0.16, '#f0ede1', gull);
      b.rotation.z = -0.3;
      gull.position.set(i * 7 - 16, 12 + i, -30);
      this.scene.add(gull);
      this.gulls.push(gull);
    }
    if (chapter === 4 || chapter === 8) {
      for (let i = 0; i < 44; i++)
        this.tree((i % 2 ? 1 : -1) * (15 + ((i * 7) % 19)), 25 - ((i * 13) % 82), i);
      for (let i = 0; i < 60; i++) {
        const x = Math.sin(i * 33) * 16,
          z = Math.cos(i * 13) * 24 - 5;
        if (Math.abs(x) > 4) this.sphere(x, 0.18, z, 0.6, 0.25, 0.6, i % 3 ? '#7c9271' : '#a2a283');
      }
    }
    if (chapter === 4) {
      this.waterPlane(-12.4, -2, 4.5, 75, 0.04);
      for (let i = 0; i < 12; i++) this.box(-12.4, 0.12, -6 + i * 0.32, 5.2, 0.16, 0.29, '#917655');
      this.house(23, -18, 9, 8, 5, '#c7b99c');
      this.fence(8, 7, 9);
      this.fence(-6, 7, 5);
      for (const o of obstacles(chapter))
        this.sphere(o.x, o.h / 2, o.z, o.w / 2, o.h / 2, o.d / 2, '#8a9082');
    }
    if (chapter === 5) {
      this.waterPlane(0, -10, 230, 230, -1);
      this.ship(0, 4, 1);
      this.box(6.5, -0.35, -19, 21, 0.6, 20, '#9c8566', this.port);
      for (let z = -29; z < -9; z += 0.7)
        this.box(6.5, -0.01, z, 21, 0.015, 0.04, '#665f4c', this.port);
      this.box(0, -0.03, -10, 3, 0.12, 4, '#b69a70', this.port);
      this.house(4, -30, 8, 7, 6, '#b3a18d', this.port);
      this.house(18, -28, 8, 8, 8, '#9c8d78', this.port);
      this.text('SMITH’S WHARF', 9, 3.1, -20, 4.3, '#ffedca', this.port);
      this.fence(15, -15, 6, false, this.port);
      this.fence(12, -18, 6, true, this.port);
      for (let i = 0; i < 6; i++)
        this.box(9 + i, 0.015, -12, 0.5, 0.05, 0.35, '#ead09b', this.port);
      this.engine.sheep.forEach(() => {
        const g = new T.Group();
        this.sphere(0, 0.65, 0, 0.48, 0.38, 0.66, '#e7e3cc', g);
        this.sphere(0, 0.74, 0.65, 0.21, 0.23, 0.28, '#58554b', g);
        for (const x of [-0.25, 0.25])
          for (const z of [-0.35, 0.35]) this.box(x, 0.22, z, 0.1, 0.45, 0.1, '#655f51', g);
        this.port.add(g);
        this.sheep.push(g);
      });
      for (const o of obstacles(chapter).slice(1))
        this.box(o.x, o.h / 2, o.z, o.w, o.h, o.d, '#8a6e4e');
      for (let i = 0; i < 4; i++) {
        const boat = this.ship(35 - i * 19, -65 - i * 7, 0.35);
        this.boats.push(boat);
      }
    }
    if (chapter === 6) {
      this.box(0, 4.5, 4, 18, 0.2, 22, '#ad997c');
      for (const z of [-5, 0, 5, 10]) this.box(0, 4.27, z, 18, 0.3, 0.28, '#6f5c46');
      const windowLight = new T.PointLight('#ffe5b4', 35, 17, 1.8);
      windowLight.position.set(-7, 2.7, 4);
      this.scene.add(windowLight);
      this.box(0, -0.01, 4, 18, 0.05, 22, '#b59367');
      for (let x = -9; x < 9; x += 0.65) this.box(x, 0.025, 4, 0.03, 0.01, 22, '#897455');
      for (const o of obstacles(chapter))
        this.box(o.x, o.h / 2, o.z, o.w, o.h, o.d, o.h > 3 ? '#cfc1a2' : '#95704b');
      for (const x of [-8.72, 8.72]) {
        this.box(x, 2.4, 4, 0.05, 2, 3, '#82a9b3');
        this.box(x, 2.4, 4, 0.08, 2, 0.08, '#e1d1b3');
        this.box(x, 2.4, 4, 0.08, 0.09, 3, '#e1d1b3');
      }
      this.box(-5, 0.1, 5, 5, 0.04, 4, '#7b847b');
      this.box(-7, 1.5, 12, 2.5, 3, 0.6, '#735c42');
      for (const y of [0.4, 1.4, 2.4]) this.box(-7, y, 12.34, 2.2, 0.12, 0.08, '#c1aa82');
      for (let i = 0; i < 3; i++) {
        this.box(3 + i, 0.97, -1.1, 0.8, 0.1, 0.8, '#e8d6a8');
        const letter = this.text(['A', 'B', 'C'][i], 3 + i, 1.04, -1.1, 0.7);
        letter.rotation.x = -Math.PI / 2;
      }
      this.house(-14, -20, 8, 8, 8, '#b0947b');
      this.house(17, -24, 8, 8, 7, '#927f6c');
      this.text('PHILPOT STREET', 3, 2.2, -26, 4);
      this.lantern(4, -13);
      this.lantern(-4, -20);
    }
    if (chapter === 7) {
      for (const o of obstacles(chapter)) {
        if (o.h > 3) this.house(o.x, o.z, o.w, o.d, o.h, o.x < 0 ? '#b99f81' : '#a08673');
        else this.box(o.x, o.h / 2, o.z, o.w, o.h, o.d, '#8a7152');
      }
      this.house(16, -24, 6, 7, 8, '#b09d80');
      this.waterPlane(0, -50, 120, 40, -0.5);
      this.ship(-10, -48, 0.5);
      this.ship(17, -45, 0.65);
      this.text('DURGIN & BAILEY', 0, 3, -28, 5);
      this.text('PHILPOT STREET', -8.8, 3, 8, 3.5).rotation.y = Math.PI / 2;
      this.box(-3, 0.8, 9, 1.4, 0.15, 1, '#92724d');
      for (let i = 0; i < 3; i++) this.sphere(-3.4 + i * 0.38, 1, 9, 0.18, 0.13, 0.3, '#d5aa6c');
      for (let i = 0; i < 5; i++) this.box(-2 + i * 1.1, 0.4, -25.5, 0.85, 0.8, 3.5, '#a48b64');
      ['L', 'S', 'L. F.', 'S. A.'].forEach((label, i) => {
        const m = this.text(label, -2 + i * 1.1, 0.82, -24.5, 0.7);
        m.rotation.x = -Math.PI / 2;
      });
      this.lantern(-5, 4);
      this.lantern(5, -7);
      this.fence(11, -15, 7, false);
    }
    if (chapter === 8) {
      this.house(9, 8, 8, 8, 5, '#c4b294');
      this.house(7, -16, 6, 4, 3.4, '#857966');
      this.fence(-6, 5, 8);
      this.fence(-5, 0, 5);
      this.fence(5, 0, 5);
      this.waterPlane(0, -51, 120, 46, -0.1);
      for (let i = 0; i < 3; i++) this.boats.push(this.ship(-16 + i * 16, -44 - i * 10, 0.33));
      this.lantern(6, -12);
      this.text('NORTH ↗', 0, 1.5, -27, 2.6);
      // A simple hearth, without a fabricated deathbed scene or violence.
      this.box(7, 0.12, -13.8, 1, 0.16, 0.5, '#675348');
      const ember = new T.Mesh(this.boxGeometry, this.mat('#d89b57', '#c26c23'));
      ember.scale.set(0.7, 0.08, 0.3);
      ember.position.set(7, 0.23, -13.8);
      this.scene.add(ember);
    }
    // Distant landmarks provide a horizon without blocking the playable route.
    if (chapter !== 5)
      for (let i = 0; i < 7; i++) this.sphere(-52 + i * 19, 1, -75, 17, 9 + (i % 3), 11, '#7f9290');
  }
  private buildFinal() {
    const scenes = [...new Set(this.engine.mission.stages.map((s) => s.scene!))];
    for (const name of scenes) {
      const before = new Set(this.scene.children);
      const urban = ['newyork', 'newbedford', 'shipyard'].includes(name),
        night = name === 'appendix';
      this.box(0, -0.3, -5, 90, 0.5, 105, urban ? '#a2a394' : night ? '#555d6b' : '#7f9473');
      this.box(0, -0.01, -5, 9, 0.05, 58, urban ? '#b9b3a0' : night ? '#81818a' : '#b3a485');
      for (let z = -29; z < 20; z += 1.1)
        this.box(0, 0.025, z, 8, 0.03, 0.06, urban ? '#827f72' : '#aa9677');
      for (const o of obstacles(this.engine.mission.id))
        this.house(o.x, o.z, o.w, o.d, o.h, urban ? '#b39e88' : '#aa9475');
      this.house(-19, -23, 7, 7, 5, urban ? '#998779' : '#bbaa87');
      this.house(20, 9, 7, 8, 7, urban ? '#7d8c8b' : '#a3987f');
      if (!urban && !night) {
        for (let i = 0; i < 14; i++) this.tree((i % 2 ? 1 : -1) * (19 + (i % 5)), 19 - i * 4, i);
      }
      for (const x of [-8, 8]) {
        this.lantern(x, 4);
        this.lantern(x, -15);
      }
      if (['farm', 'kitchen', 'stable'].includes(name)) {
        this.fence(-9, 1, 19, false);
        this.fence(9, -16, 16, false);
        this.house(19, -15, 10, 8, 4, '#927b5a');
        this.box(8, 0.8, 10, 2, 0.15, 2.8, '#b59767');
        for (const x of [7, 9])
          for (const z of [9, 11]) {
            const wheel = this.cylinder(x, 0.55, z, 0.5, 0.16, '#63594a');
            wheel.rotation.z = Math.PI / 2;
          }
        if (name === 'farm')
          for (const x of [6.6, 8.3]) {
            this.sphere(x, 0.85, 6, 0.5, 0.6, 1, '#c0b096');
            this.sphere(x, 1.1, 4.95, 0.35, 0.4, 0.35, '#bba68b');
            for (const xx of [-0.25, 0.25])
              for (const z of [5.5, 6.6]) this.box(x + xx, 0.4, z, 0.13, 0.8, 0.13, '#695c4d');
          }
        if (name === 'kitchen') {
          this.text('ST. MICHAEL’S', 0, 3, -27, 5);
          this.box(0, 0, 8, 16, 0.07, 16, '#a28560');
          this.box(0, 3.6, 8, 16, 0.2, 16, '#8e795e');
          for (const o of obstacles(this.engine.mission.id, 'kitchen').slice(2))
            this.box(o.x, o.h / 2, o.z, o.w, o.h, o.d, '#bdad8e');
          for (const z of [3, 8, 13]) this.box(0, 3.4, z, 16, 0.2, 0.25, '#695c48');
          for (const x of [-7.75, 7.75]) {
            this.box(x, 2.1, 7, 0.05, 1.4, 2, '#b4bcbc');
            this.box(x, 2.1, 7, 0.08, 0.08, 2, '#685f50');
          }
          const hearth = new T.PointLight('#ffe1a5', 20, 16);
          hearth.position.set(-6, 2, 11);
          this.scene.add(hearth);
          this.box(-6, 0.75, 12, 2, 0.12, 1.1, '#866c4e');
          this.box(-6, 0.35, 12, 0.2, 0.7, 0.9, '#6b5e49');
        }
        if (name === 'stable') {
          this.house(0, -30, 14, 8, 4, '#92775a');
          for (const x of [-9, 9]) this.box(x, 2, -23, 0.3, 4, 0.4, '#6a5948');
          this.box(0, 4, -23, 18, 0.3, 0.4, '#6a5948');
        }
      }
      if (['shore', 'shipyard', 'newbedford'].includes(name)) {
        this.waterPlane(0, -58, 170, 55, -0.1);
        this.ship(-15, -45, 0.4);
        this.ship(13, -47, 0.6);
        for (let i = 0; i < 6; i++) {
          this.box(9 + i * 0.8, 0.23, -10, 0.6, 0.46, 3, '#957b58');
          this.cylinder(-7 + i * 0.9, 0.5, -22, 0.35, 1, '#796346');
        }
        if (name === 'shore') {
          this.box(-8, 0.2, -27, 5, 0.3, 1.2, '#755c43');
          this.text('CHESAPEAKE', 0, 2.4, -29, 4.5);
        }
        if (name === 'shipyard') {
          this.text('BALTIMORE', 0, 3, -28, 4.5);
          this.box(-7, 1, -7, 3, 0.15, 1, '#9a7e57');
        }
        if (name === 'newbedford') {
          this.text('NEW BEDFORD', 0, 3, -28, 5);
          this.house(20, -2, 8, 9, 6, '#a9aca0');
        }
      }
      if (name === 'woods') {
        for (let i = 0; i < 12; i++)
          this.tree((i % 2 ? 1 : -1) * (9 + (i % 3) * 2), 12 - i * 3, i + 2);
        this.house(-18, -16, 6, 5, 3, '#8d7556');
      }
      if (name === 'school') {
        this.house(0, -32, 14, 6, 3, '#a49170');
        this.box(0, 2.2, -18, 4, 2, 0.15, '#3e6059');
        this.text('A  B  C', 0, 2.2, -17.88, 3);
        for (const x of [-7, 7])
          for (const z of [-5, -11]) {
            this.box(x, 0.8, z, 3, 0.15, 1, '#9e825e');
            this.box(x, 0.4, z, 0.2, 0.8, 0.8, '#635848');
          }
      }
      if (name === 'jail') {
        this.house(0, -28, 16, 8, 6, '#929e9b');
        for (let x = -5; x <= 5; x += 0.7) this.box(x, 2, -25, 0.06, 4, 0.1, '#3d4e54');
        this.text('EASTON', 0, 4.9, -24.5, 3);
      }
      if (name === 'newyork') {
        this.text('NEW YORK', 0, 3, -28, 4.5);
        for (const z of [12, -14]) {
          this.house(-20, z, 8, 7, 8, '#a79680');
          this.house(20, z, 8, 7, 9, '#8e8b82');
        }
        this.text('RUGGLES', -8, 2.4, -5, 2.5);
      }
      if (name === 'meeting' || name === 'appendix') {
        this.box(0, 0.1, -16, 14, 0.2, 8, '#8a7567');
        this.box(-5, 1, -3, 3, 0.15, 1.1, '#a9895e');
        this.box(-5, 0.5, -3, 0.25, 1, 1, '#735b47');
        for (const x of [-7, 7])
          for (const z of [0, 5, 10]) {
            this.box(x, 0.5, z, 3, 0.12, 1.1, '#8d7560');
            this.box(x, 0.25, z, 0.16, 0.5, 1, '#685844');
          }
        this.text(
          name === 'meeting' ? 'NANTUCKET · 1841' : 'TRUTH · LOVE · JUSTICE',
          0,
          3.6,
          -19,
          7,
        );
        if (night) {
          const light = new T.PointLight('#eec689', 30, 35);
          light.position.set(0, 5, -8);
          this.scene.add(light);
          for (let i = 0; i < 22; i++) {
            const star = this.sphere(
              Math.sin(i * 3) * 30,
              13 + (i % 4),
              -35,
              0.07,
              0.07,
              0.07,
              '#f9e0b3',
            );
            star.material = this.mat('#f9e0b3', '#cba066');
          }
        }
      }
      const group = new T.Group();
      for (const item of [...this.scene.children]) if (!before.has(item)) group.add(item);
      group.visible = false;
      this.scene.add(group);
      this.finalScenes.set(name, group);
    }
  }
  private buildHands() {
    for (const sign of [-1, 1]) {
      const arm = this.box(sign * 0.3, -0.37, -0.52, 0.14, 0.34, 0.18, '#758788', this.hands);
      arm.rotation.x = -0.65;
      arm.rotation.z = sign * 0.18;
      this.sphere(sign * 0.28, -0.24, -0.63, 0.077, 0.11, 0.1, '#9b704e', this.hands);
    }
    this.sphere(0.29, -0.22, -0.72, 0.14, 0.09, 0.21, '#d0a46a', this.bread);
    this.hands.add(this.bread);
    this.box(0.28, -0.18, -0.74, 0.045, 0.045, 0.21, '#e9e2cf', this.chalk);
    this.hands.add(this.chalk);
    this.hands.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.castShadow = false;
        o.receiveShadow = false;
        o.frustumCulled = false;
      }
    });
  }
  private resize() {
    if (this.disposed) return;
    const { width, height } = this.canvas.getBoundingClientRect();
    this.renderer.setSize(Math.max(1, width), Math.max(1, height), false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }
  render(time: number, reduced = false, conversation?: string, speaking = false) {
    if (this.disposed) return;
    const game = this.engine,
      id = game.mission.id;
    if (this.water) this.water.uniforms.time.value = reduced ? 0 : time;
    const bob = !reduced && game.moving ? Math.sin(game.steps) * 0.035 : 0;
    const subject = conversation ? this.npcs.get(game.stage) : undefined;
    const targetPosition = subject
      ? new T.Vector3(subject.position.x + 0.8, 1.55, subject.position.z + 2.7)
      : new T.Vector3(game.position[0], 1.55 + game.y + bob, game.position[1]);
    if (reduced || !subject) this.camera.position.copy(targetPosition);
    else this.camera.position.lerp(targetPosition, 0.09);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(-game.pitch, -game.yaw, 0);
    if (subject) this.camera.lookAt(subject.position.x, 1.25, subject.position.z);
    const fov = subject ? 56 : 73;
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = reduced ? fov : T.MathUtils.lerp(this.camera.fov, fov, 0.12);
      this.camera.updateProjectionMatrix();
    }
    this.hands.visible = !subject;
    this.hands.position.y = -0.13 + (reduced ? 0 : Math.sin(game.steps) * 0.018);
    this.hands.position.z = -0.12;
    this.bread.visible = id === 7 && game.stage === 1;
    this.chalk.visible = id === 7 && game.stage === 3;
    if (this.lastStage !== game.stage) {
      this.lastStage = game.stage;
      this.objectives.forEach((g, i) => (g.visible = i === game.stage));
      this.npcs.forEach((g, i) => (g.visible = i === game.stage));
      if (id === 5) this.port.visible = game.stage >= 2;
      this.finalScenes.forEach((g, key) => (g.visible = key === game.target?.scene));
    }
    this.pickups.forEach((p) => {
      p.group.visible = p.stage === game.stage && !game.collected.includes(p.index);
      if (p.group.visible && !reduced) {
        p.group.rotation.y = time * 0.65;
        p.group.position.y = 0.6 + Math.sin(time * 2 + p.index) * 0.08;
      }
    });
    this.objectives.forEach((g, i) => {
      g.visible = i === game.stage && !conversation;
      if (g.visible) {
        g.children[1].position.y = 2.2 + (reduced ? 0 : Math.sin(time * 2) * 0.15);
        g.children[1].rotation.y = reduced ? 0 : time;
        g.children[0].scale.setScalar(game.ready && game.stage === i ? 1.15 : 1);
      }
    });
    this.npcs.forEach((g) => {
      if (g.visible) {
        g.rotation.y = Math.atan2(game.position[0] - g.position.x, game.position[1] - g.position.z);
        if (subject === g)
          g.rotation.y = Math.atan2(
            this.camera.position.x - g.position.x,
            this.camera.position.z - g.position.z,
          );
        const mouth = g.getObjectByName('mouth');
        if (mouth)
          mouth.scale.y =
            conversation && !conversation.startsWith('Frederick Douglass') && speaking
              ? 0.04 + Math.abs(Math.sin(time * 16)) * 0.075
              : 0.025;
      }
    });
    this.sheep.forEach((g, i) => {
      const s = game.sheep[i];
      g.rotation.y = Math.atan2(game.position[0] - s.at[0], game.position[1] - s.at[1]);
      g.position.set(
        s.at[0],
        !reduced && !s.home && game.stage === 2 ? Math.abs(Math.sin(time * 8 + i)) * 0.04 : 0,
        s.at[1],
      );
    });
    if (!reduced) {
      this.gulls.forEach((g, i) => {
        g.position.x = Math.sin(time * 0.08 + i) * 30;
        g.position.z = -40 + Math.cos(time * 0.08 + i) * 15;
        g.rotation.y = time * 0.08 + i;
      });
      this.boats.forEach((b, i) => {
        b.position.x += Math.sin(i + 0.7) * 0.006;
        if (Math.abs(b.position.x) > 65) b.position.x = -60;
        b.rotation.z = Math.sin(time * 0.7 + i) * 0.016;
      });
    }
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.disposed = true;
    this.observer.disconnect();
    const mats = new Set<T.Material>();
    this.scene.traverse((o) => {
      if (o instanceof T.Mesh)
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m));
    });
    mats.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
    [this.boxGeometry, this.sphereGeometry, this.cylinderGeometry, ...this.geometries].forEach(
      (g) => g.dispose(),
    );
    this.renderer.dispose();
  }
}
