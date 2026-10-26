import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { PaintedSurface } from './paint';
import type { Collider } from './navigation';
import { townGate, townGateCollider, townSites } from './town-layout';

export type TownInteractionId = keyof typeof townSites;
export type TownInteractionPose = { id: TownInteractionId; progress: number; open?: boolean };
export type TownOpen = { gate: boolean; shutter: boolean };
export type TownBuilder = {
  scene: T.Scene;
  boxes: Collider[];
  textures: T.Texture[];
  mat: (color: string, glow?: string, finish?: PaintedSurface) => T.MeshStandardMaterial;
  add: (
    kind: string,
    color: string,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    ry?: number,
    glow?: string,
    finish?: PaintedSurface,
  ) => void;
  box: (
    color: string,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    ry?: number,
    glow?: string,
    finish?: PaintedSurface,
  ) => void;
  prop: (
    parent: T.Object3D,
    kind: string,
    color: string,
    position: [number, number, number],
    scale: [number, number, number],
    finish?: PaintedSurface,
  ) => T.Mesh;
  segment: (
    color: string,
    a: T.Vector3,
    b: T.Vector3,
    radius: number,
    finish?: PaintedSurface,
  ) => void;
  window: (
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    facing: number,
    shutters?: boolean,
  ) => void;
  sign: (
    text: string,
    x: number,
    y: number,
    z: number,
    width?: number,
    rotation?: number,
  ) => T.Mesh;
  ground: (
    finish: PaintedSurface,
    color: string,
    x: number,
    z: number,
    width: number,
    depth: number,
    tile: number,
    elevation?: number,
  ) => void;
};

type House = { x: number; z: number; w: number; d: number; h: number; color: string; seed: number };

/** Moving assemblies retain pivots but their small static parts share a draw call. */
function bake(group: T.Group) {
  const batches = new Map<T.Material, T.Mesh[]>();
  for (const child of group.children) {
    if (!(child instanceof T.Mesh) || Array.isArray(child.material)) continue;
    const parts = batches.get(child.material) ?? [];
    parts.push(child);
    batches.set(child.material, parts);
  }
  for (const [material, parts] of batches) {
    if (parts.length < 2) continue;
    const copies = parts.map((part) => {
      part.updateMatrix();
      return part.geometry.clone().applyMatrix4(part.matrix);
    });
    const geometry = mergeGeometries(copies);
    copies.forEach((copy) => copy.dispose());
    if (!geometry) continue;
    const mesh = new T.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    group.remove(...parts);
    group.add(mesh);
  }
}

/** Original trade fronts and a small lived-in neighborhood, not a historical survey. */
export class TownLife {
  private gate = new T.Group();
  private shutter = new T.Group();
  private shutterRight = new T.Group();
  private pump = new T.Group();
  private bell = new T.Group();
  private curtain?: T.Group;
  private water!: T.Mesh;
  private ripples!: T.Mesh;
  private cloth: { group: T.Group; phase: number }[] = [];
  private signs: { group: T.Group; phase: number }[] = [];
  private chimneys: { x: number; y: number; z: number }[] = [];
  private smoke?: T.Points;
  private smokeOrigins: number[] = [];
  private gateBox?: Collider;
  private active: (TownInteractionPose & { from: number; triggered: boolean }) | null = null;
  private open: TownOpen = { gate: false, shutter: false };
  private gateAmount = 0;
  private shutterAmount = 0;
  private bellAt = -100;
  private waterUntil = -100;
  private time = 0;

  constructor(
    private a: TownBuilder,
    private dawn: boolean,
  ) {
    this.gateBox = a.boxes.find((box) => (box as Collider & { id?: string }).id === 'town-gate');
    this.buildLane();
    this.buildGarden();
    this.buildPump();
    this.buildBell();
    this.buildWorkshop();
  }

  house({ x, z, w, d, h, color, seed }: House) {
    const a = this.a,
      side = x < 0 ? 1 : -1;
    const front = x + side * (w / 2 + 0.03);
    const west = x < 0;
    const cooper = west && seed === 0;
    const printer = west && seed === 1;
    const binder = west && seed === 2;
    const merchant = west && seed === 3;
    const jail = !west && seed === 1;
    const taxes = !west && seed === 2;
    const tailor = !west && seed === 4;
    const brick = binder || taxes;
    const wall = brick ? '#a87c65' : color;
    const finish: PaintedSurface = brick ? 'brick' : 'plaster';
    const trim = '#e7d9bb';
    a.box('#777466', x, 0.19, z, w + 0.25, 0.38, d + 0.25, 0, '', 'stone');
    if (cooper) {
      // Leave a real, eight-tenths-deep opening for the workshop's shutter and workbench.
      const reveal = 0.8,
        opening = 1.9;
      a.box(wall, x - (side * reveal) / 2, h / 2 + 0.3, z, w - reveal, h, d, 0, '', finish);
      const panel = (d - opening) / 2;
      for (const dz of [-1, 1])
        a.box(
          wall,
          front - (side * reveal) / 2,
          h / 2 + 0.3,
          z + dz * (opening / 2 + panel / 2),
          reveal,
          h,
          panel,
          0,
          '',
          finish,
        );
      a.box(wall, front - (side * reveal) / 2, 0.65, z, reveal, 0.7, opening, 0, '', finish);
      a.box(
        wall,
        front - (side * reveal) / 2,
        (h + 2.6) / 2,
        z,
        reveal,
        h - 2,
        opening,
        0,
        '',
        finish,
      );
    } else a.box(wall, x, h / 2 + 0.3, z, w, h, d, 0, '', finish);

    const roof = cooper ? '#655854' : jail ? '#4a545d' : '#545d5b';
    a.add(
      'roof',
      roof,
      x,
      h + 0.3,
      z,
      w + 0.65,
      w * (cooper ? 0.5 : 0.66),
      d + 0.65,
      0,
      '',
      'slate',
    );
    a.box(trim, x, h + 0.33, z, w + 0.75, 0.14, d + 0.75);
    for (const offset of [-d / 2 + 0.07, d / 2 - 0.07])
      a.box(trim, front + side * 0.04, h / 2 + 0.32, z + offset, 0.15, h, 0.15);
    if (!brick) {
      for (let y = 0.6; y < h; y += 0.29) {
        // The cooper's opening interrupts its boards instead of painting lines across glass.
        if (cooper && y > 1 && y < 2.3) {
          for (const dz of [-1, 1])
            a.box('#a4a38d', front + side * 0.02, y, z + dz * 2.25, 0.025, 0.016, 2.5);
        } else a.box('#a4a38d', front + side * 0.02, y, z, 0.025, 0.016, d - 0.15);
        a.box('#a4a38d', x, y, z + d / 2 + 0.018, w - 0.15, 0.016, 0.025);
      }
    }
    const chimneyX = x + w * (west ? -0.22 : 0.24);
    const chimneyZ = z - d * (cooper ? 0.3 : 0.18);
    a.box('#916b58', chimneyX, h + 1.6, chimneyZ, 0.63, 2.3, 0.68, 0, '', 'brick');
    a.box('#b49a7c', chimneyX, h + 2.8, chimneyZ, 0.83, 0.16, 0.87);
    a.box('#323e3f', chimneyX, h + 2.89, chimneyZ, 0.5, 0.025, 0.48);
    if (printer || merchant || tailor)
      this.chimneys.push({ x: chimneyX, y: h + 2.93, z: chimneyZ });

    const doorZ = z + (cooper ? 2.65 : printer ? 0.65 : binder ? 0.9 : tailor ? -0.5 : 0);
    const door = ['#384d4a', '#6c493d', '#414c60', '#645b40', '#4a5c57'][seed % 5];
    a.box(trim, front + side * 0.025, 1.43, doorZ, 0.16, 2.34, 1.42);
    a.box(door, front + side * 0.11, 1.35, doorZ, 0.11, 2.1, 1.15, 0, '', 'wood');
    for (const dz of [-0.27, 0.27])
      for (const dy of [0.85, 1.7])
        a.box(jail ? '#3d4848' : '#273e3e', front + side * 0.17, dy, doorZ + dz, 0.02, 0.56, 0.39);
    a.add('sphere', '#b6a16c', front + side * 0.2, 1.28, doorZ + 0.4, 0.035, 0.035, 0.035);
    a.box('#b7ad94', front + side * 0.2, 0.25, doorZ, 0.8, 0.2, 1.65, 0, '', 'stone');
    a.box('#a7a38a', front + side * 0.55, 0.13, doorZ, 0.6, 0.14, 1.9, 0, '', 'stone');

    if (taxes || jail) {
      for (const dz of [-0.91, 0.91]) {
        a.box(trim, front + side * 0.14, 1.65, doorZ + dz, 0.22, 2.75, 0.17);
        a.box('#b7ad94', front + side * 0.17, 0.34, doorZ + dz, 0.33, 0.14, 0.32);
      }
      a.box(trim, front + side * 0.17, 3.05, doorZ, 0.31, 0.19, 2.18);
    } else {
      // Wall brackets, rather than poles in the footway, carry these shallow porch roofs.
      a.box(
        '#7b6a52',
        front + side * 0.37,
        2.68,
        doorZ,
        0.92,
        0.1,
        printer ? 2.3 : 1.7,
        0,
        '',
        'wood',
      );
      for (const dz of [-0.67, 0.67])
        a.segment(
          '#6e614b',
          new T.Vector3(front + side * 0.04, 2.15, doorZ + dz),
          new T.Vector3(front + side * 0.64, 2.64, doorZ + dz),
          0.035,
          'wood',
        );
    }

    if (!cooper) {
      for (const offset of [-d * 0.3, d * 0.3]) {
        if (printer || merchant || binder || tailor)
          this.bay(
            front,
            z + offset,
            1.85,
            side,
            printer ? 'print' : binder ? 'books' : tailor ? 'cloth' : 'jars',
            binder,
          );
        else {
          a.window(front + side * 0.09, 2.05, z + offset, 0.72, 1.05, side, !jail);
          if (jail)
            for (const bar of [-0.24, 0, 0.24])
              a.box('#35413d', front + side * 0.16, 2.05, z + offset + bar, 0.05, 1.12, 0.035);
        }
      }
    }
    if (h > 4.8) {
      for (const offset of [-d * 0.29, d * 0.29])
        a.window(front + side * 0.09, 4, z + offset, 0.65, 0.9, side, !taxes);
      if (printer || tailor) {
        a.box('#ccc1a5', front + side * 0.1, h + 0.78, z - 0.15, 0.18, 1.15, 1.3, 0, '', 'plaster');
        a.box('#4a545d', front + side * 0.22, h + 1.38, z - 0.15, 0.7, 0.13, 1.6, 0, '', 'slate');
        a.window(front + side * 0.23, h + 0.78, z - 0.15, 0.58, 0.73, side, false);
      }
    }
    for (const offset of [-w * 0.27, w * 0.27])
      a.window(x + offset, 2.1, z + d / 2 + 0.09, 0.72, 1, 0, !jail && seed % 2 === 0);

    const title = cooper
      ? 'COOPER · REPAIRS'
      : printer
        ? 'TYPE · PAPER · PRINT'
        : binder
          ? 'BOOKBINDING'
          : merchant
            ? 'BELL’S STORE'
            : tailor
              ? 'MENDING & CLOTH'
              : '';
    if (title) {
      a.sign(
        title,
        front + side * 0.16,
        printer ? 3.05 : 3.15,
        z + (cooper ? 0 : -0.25),
        cooper ? 2.6 : 2.4,
        (side * Math.PI) / 2,
      );
      if (binder || tailor)
        this.tradeSign(front, z - 2.9, side, binder ? 'BINDERY' : 'MENDING', seed);
    }
    if (merchant || tailor) this.awning(front, z, side, merchant ? '#8f7962' : '#667c76');
    if (west && seed === 4) {
      for (const dz of [-1.1, 1.2]) {
        a.add('cylinder', '#997857', front + 0.31, 0.23, z + dz, 0.22, 0.46, 0.22);
        a.add('sphere', '#758563', front + 0.31, 0.59, z + dz, 0.26, 0.29, 0.25);
      }
    }
    // Each doorstep has its own worn crossing through the verge, without narrowing the road.
    const count = printer ? 5 : 4;
    for (let step = 0; step < count; step++) {
      const t = step / (count - 1);
      a.add(
        'sphere',
        step % 3 ? '#aaa68b' : '#979b83',
        front + side * (0.65 + t * Math.max(0.4, Math.abs(front) - 5.35)),
        0.035,
        doorZ + Math.sin(step * 1.8 + seed) * 0.04,
        0.25,
        0.045,
        0.46,
        seed * 0.03,
      );
    }
  }

  private bay(
    front: number,
    z: number,
    y: number,
    side: number,
    trade: 'print' | 'books' | 'cloth' | 'jars',
    curtain: boolean,
  ) {
    const a = this.a;
    const part = (
      kind: string,
      color: string,
      px: number,
      py: number,
      pz: number,
      sx: number,
      sy: number,
      sz: number,
      finish?: PaintedSurface,
    ) =>
      a.add(
        kind,
        color,
        front + side * pz,
        y + py,
        z - side * px,
        sx,
        sy,
        sz,
        (side * Math.PI) / 2,
        '',
        finish,
      );
    // Window reveals, shelves and goods join the town's static batches, rather than each
    // shop buying a new collection of draw calls. Local +z faces the street.
    part('box', '#675741', 0, 0, 0.045, 1.22, 1.14, 0.055, 'wood');
    for (const x of [-0.65, 0.65]) part('box', '#dfd4b7', x, 0, 0.19, 0.09, 1.32, 0.35);
    for (const yy of [-0.62, 0.62]) part('box', '#dfd4b7', 0, yy, 0.2, 1.4, 0.09, 0.36);
    part('box', '#b8aa8c', 0, -0.48, 0.22, 1.23, 0.055, 0.28, 'wood');
    for (let i = 0; i < 4; i++) {
      const x = -0.43 + i * 0.29;
      if (trade === 'books' || trade === 'print') {
        part(
          'box',
          i % 2 ? '#8b6350' : '#a69b77',
          x,
          -0.21,
          0.21,
          0.18,
          0.48 + (i % 2) * 0.08,
          0.16,
          trade === 'print' ? 'paper' : 'cloth',
        );
        part('box', '#d6c8a5', x - 0.045, -0.19, 0.305, 0.018, 0.29, 0.008);
      } else if (trade === 'jars') {
        part(
          'cylinder',
          i % 2 ? '#9f8f65' : '#a97c61',
          x,
          -0.28,
          0.2,
          0.095,
          0.37 - (i % 2) * 0.07,
          0.095,
        );
        part('cylinder', '#d5c9ab', x, -0.08, 0.2, 0.1, 0.035, 0.1);
      } else
        part(
          'box',
          i % 2 ? '#a38c76' : '#72877d',
          x,
          -0.31 + (i % 2) * 0.09,
          0.21,
          0.26,
          0.17,
          0.22,
          'cloth',
        );
    }
    part('box', '#d1b778', 0.42, 0.38, 0.13, 0.13, 0.16, 0.12);
    const pane = new T.Mesh(
      new T.PlaneGeometry(1.21, 1.14),
      new T.MeshStandardMaterial({
        color: '#b9d2c2',
        transparent: true,
        opacity: 0.075,
        roughness: 0.55,
        depthWrite: false,
        side: T.DoubleSide,
      }),
    );
    pane.name = `${trade} shop window glass`;
    pane.position.set(front + side * 0.37, y, z);
    pane.rotation.y = (side * Math.PI) / 2;
    a.scene.add(pane);
    for (const x of [-0.21, 0.21]) part('box', '#dfd4b7', x, 0, 0.38, 0.035, 1.17, 0.04);
    part('box', '#dfd4b7', 0, 0.12, 0.38, 1.23, 0.035, 0.04);
    if (curtain && z > 0) {
      const cloth = new T.Group();
      cloth.name = 'Town shop curtain';
      cloth.position.set(front + side * 0.27, y + 0.49, z + side * 0.47);
      cloth.rotation.y = (side * Math.PI) / 2;
      a.prop(cloth, 'box', '#b5a788', [0, -0.3, 0], [0.22, 0.62, 0.018], 'cloth');
      a.prop(cloth, 'box', '#9d9278', [0.06, -0.3, 0.014], [0.04, 0.6, 0.025], 'cloth');
      bake(cloth);
      a.scene.add(cloth);
      this.curtain = cloth;
    }
  }

  private tradeSign(front: number, z: number, side: number, title: string, seed: number) {
    const a = this.a;
    a.segment(
      '#3d4943',
      new T.Vector3(front + side * 0.05, 3.74, z),
      new T.Vector3(front + side * 0.87, 3.74, z),
      0.025,
    );
    const pivot = new T.Group();
    pivot.position.set(front + side * 0.67, 3.52, z);
    pivot.rotation.y = (side * Math.PI) / 2;
    const board = a.sign(title, 0, -0.24, 0, 1.2, 0);
    pivot.add(board);
    for (const x of [-0.43, 0.43])
      a.prop(pivot, 'cylinder', '#4d5549', [x, -0.055, 0], [0.012, 0.33, 0.012]);
    a.scene.add(pivot);
    this.signs.push({ group: pivot, phase: seed });
  }

  private awning(front: number, z: number, side: number, color: string) {
    const a = this.a;
    const canopy = new T.Group();
    canopy.position.set(front + side * 0.06, 2.74, z);
    canopy.rotation.y = (side * Math.PI) / 2;
    for (let stripe = 0; stripe < 7; stripe++) {
      const material = a.mat(stripe % 2 ? '#c8b894' : color, '', 'cloth');
      const panel = new T.Mesh(new T.PlaneGeometry(0.37, 1.02), material);
      material.side = T.DoubleSide;
      panel.position.set(-1.11 + stripe * 0.37, -0.14, 0.5);
      panel.rotation.x = -Math.PI / 2 + 0.25;
      canopy.add(panel);
      a.prop(
        canopy,
        'box',
        stripe % 2 ? '#c8b894' : color,
        [-1.11 + stripe * 0.37, -0.31, 0.98],
        [0.37, 0.18, 0.025],
        'cloth',
      );
    }
    bake(canopy);
    a.scene.add(canopy);
    this.cloth.push({ group: canopy, phase: z });
  }

  private buildLane() {
    const a = this.a;
    // Setts were repaired a few at a time. They share a palette, not an exact ruler-straight edge.
    for (const side of [-1, 1])
      for (let i = 0; i < 39; i++) {
        const z = -29 + i * 1.5;
        if (z > 16.5 && z < 20.3 && side > 0) continue;
        a.add(
          'box',
          i % 7 === 0 ? '#91957d' : i % 3 ? '#a2a18a' : '#b1aa8d',
          side * (5.13 + Math.sin(i * 1.7) * 0.045),
          0.025 + (i % 5 === 0 ? 0.015 : 0),
          z,
          0.43,
          0.11,
          1.43,
          Math.sin(i * 2.3) * 0.014,
          '',
          'stone',
        );
      }
    for (const [x, z, width, depth] of [
      [-3.7, 16.5, 1.55, 1.6],
      [-5.55, 5.5, 2.2, 1.6],
      [7.4, 17.95, 4.8, 1.45],
    ]) {
      a.ground('stone', '#a59e83', x, z, width, depth, 3.4, 0.027);
    }
    // A short dry gutter and grate explain the edge of the lane without cluttering its center.
    for (const z of [-18, -4.6, 9.6]) {
      a.box('#827d68', 4.83, 0.02, z, 0.22, 0.025, 3.3);
      for (let slot = 0; slot < 6; slot++)
        a.box('#536156', 4.83, 0.035, z - 0.3 + slot * 0.12, 0.21, 0.02, 0.035);
    }
    const post = [7.4, 0, 16.5] as const;
    a.box('#76634a', post[0], 1.15, post[2], 0.14, 2.3, 0.14, 0, '', 'wood');
    a.sign('BRIDGE  →', 7.4, 2.12, 16.59, 1.8, 0);
    a.sign('TOWN HOUSE  ↑', 7.4, 1.63, 16.59, 1.8, 0);
  }

  private buildGarden() {
    const a = this.a;
    a.ground('road', '#8d8d6c', -9.7, 5.5, 7, 3.4, 5, 0.025);
    const fence = (x: number, z: number, length: number, alongX = false) => {
      const posts = Math.max(2, Math.round(length / 0.65));
      for (let i = 0; i <= posts; i++) {
        const offset = (i / posts - 0.5) * length;
        a.box(
          '#9e9d80',
          x + (alongX ? offset : 0),
          0.51,
          z + (alongX ? 0 : offset),
          0.08,
          1.02,
          0.08,
          0,
          '',
          'wood',
        );
      }
      for (const y of [0.28, 0.76])
        a.box(
          '#8d9279',
          x,
          y,
          z,
          alongX ? length : 0.075,
          0.065,
          alongX ? 0.075 : length,
          0,
          '',
          'wood',
        );
    };
    fence(-13.2, 5.5, 3.5);
    fence(-9.7, 3.8, 7);
    fence(-9.7, 7.2, 7);
    fence(-6.2, 4.2, 0.8);
    fence(-6.2, 6.8, 0.8);
    this.gate.name = 'Town garden gate';
    this.gate.userData.townFeature = 'gate';
    this.gate.position.set(townGate.x, 0, townGate.hingeZ);
    for (let plank = 0; plank < 8; plank++)
      a.prop(
        this.gate,
        'box',
        plank % 3 ? '#a7a284' : '#96987b',
        [0, 0.55, 0.1 + plank * 0.23],
        [0.09, 0.95 + (plank % 3) * 0.025, 0.15],
        'wood',
      );
    for (const y of [0.3, 0.79])
      a.prop(this.gate, 'box', '#7c856f', [0.02, y, 0.9], [0.11, 0.075, 1.8], 'wood');
    const brace = a.prop(
      this.gate,
      'box',
      '#7c856f',
      [-0.02, 0.53, 0.9],
      [0.09, 0.075, 1.85],
      'wood',
    );
    brace.rotation.x = -0.28;
    a.prop(this.gate, 'box', '#454f43', [0.075, 0.76, 1.61], [0.09, 0.06, 0.27]);
    bake(this.gate);
    a.scene.add(this.gate);
    for (let i = 0; i < 9; i++)
      a.add(
        'sphere',
        i % 2 ? '#aaa68b' : '#979b83',
        -6.35 - i * 0.58,
        0.035,
        5.5 + Math.sin(i * 0.7) * 0.1,
        0.3,
        0.045,
        0.28,
        i * 0.04,
      );
    for (const z of [4.25, 6.75]) {
      a.box('#6c7054', -9.7, 0.06, z, 3.7, 0.08, 0.46);
      for (let plant = 0; plant < 9; plant++) {
        a.add(
          'sphere',
          plant % 3 ? '#7c8a61' : '#8f9566',
          -11.25 + plant * 0.38,
          0.24,
          z,
          0.18,
          0.23 + (plant % 2) * 0.04,
          0.18,
        );
        if (plant % 3 === 0)
          a.add('sphere', '#bcac7a', -11.25 + plant * 0.38, 0.47, z, 0.05, 0.06, 0.05);
      }
    }
    for (const offset of [-0.19, 0, 0.19])
      a.box('#8d7959', -11.85 + offset, 0.47, 5.5, 0.15, 0.07, 1.55, 0, '', 'wood');
    for (const z of [4.91, 6.09]) {
      a.box('#535b49', -11.85, 0.24, z, 0.54, 0.48, 0.09);
      a.box('#535b49', -12.15, 0.74, z, 0.08, 0.76, 0.08);
    }
    for (const y of [0.72, 0.93]) a.box('#8d7959', -12.15, y, 5.5, 0.07, 0.13, 1.54, 0, '', 'wood');
    a.add('cylinder', '#a88c66', -12.65, 0.22, 6.55, 0.19, 0.43, 0.19);
    a.segment(
      '#a88c66',
      new T.Vector3(-12.65, 0.23, 6.55),
      new T.Vector3(-12.35, 0.36, 6.55),
      0.04,
    );
    a.sign('GARDEN', -6.1, 1.28, 6.82, 0.65, Math.PI / 2);
  }

  private buildPump() {
    const a = this.a,
      { x, z } = townSites.pump;
    a.add('cylinder', '#8d917b', x, 0.12, z, 0.48, 0.23, 0.48);
    a.add('cylinder', '#536a5b', x, 0.71, z, 0.14, 1.13, 0.14);
    a.add('cylinder', '#71816a', x, 1.26, z, 0.21, 0.11, 0.21);
    a.box('#526658', x + 0.25, 0.87, z, 0.45, 0.12, 0.13);
    a.add('cylinder', '#526658', x + 0.45, 0.79, z, 0.07, 0.19, 0.07);
    this.pump.name = 'Town pump lever';
    this.pump.userData.townFeature = 'pump';
    this.pump.position.set(x - 0.03, 1.2, z);
    const handle = a.prop(this.pump, 'box', '#3e5146', [-0.32, -0.08, 0], [0.75, 0.065, 0.07]);
    handle.rotation.z = 0.24;
    a.prop(this.pump, 'sphere', '#79644c', [-0.69, -0.18, 0], [0.095, 0.065, 0.075], 'wood');
    a.prop(this.pump, 'cylinder', '#9c9a76', [0, 0, 0], [0.1, 0.075, 0.1]).rotation.x = Math.PI / 2;
    bake(this.pump);
    a.scene.add(this.pump);
    a.add('cylinder', '#7c6d52', x + 0.45, 0.22, z, 0.26, 0.44, 0.26, 0, '', 'wood');
    for (const y of [0.07, 0.35]) a.add('cylinder', '#565d4c', x + 0.45, y, z, 0.27, 0.035, 0.27);
    a.add('cylinder', '#48685e', x + 0.45, 0.445, z, 0.22, 0.012, 0.22);
    this.water = new T.Mesh(
      new T.CylinderGeometry(0.014, 0.025, 0.4, 7),
      new T.MeshStandardMaterial({
        color: '#a6c6b6',
        transparent: true,
        opacity: 0.62,
        roughness: 0.28,
      }),
    );
    this.water.name = 'Town pump water';
    this.water.position.set(x + 0.45, 0.61, z);
    this.water.visible = false;
    a.scene.add(this.water);
    this.ripples = new T.Mesh(
      new T.TorusGeometry(0.1, 0.006, 3, 18),
      new T.MeshBasicMaterial({
        color: '#becfc0',
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    this.ripples.rotation.x = -Math.PI / 2;
    this.ripples.position.set(x + 0.45, 0.46, z);
    this.ripples.visible = false;
    a.scene.add(this.ripples);
  }

  private buildBell() {
    const a = this.a,
      { x, z } = townSites.bell;
    a.segment('#4e5849', new T.Vector3(x - 0.17, 2.36, z), new T.Vector3(x + 0.32, 2.36, z), 0.027);
    a.box('#79634a', x - 0.17, 2.15, z, 0.09, 0.53, 0.19, 0, '', 'wood');
    this.bell.name = 'Town shop bell';
    this.bell.userData.townFeature = 'bell';
    this.bell.position.set(x + 0.25, 2.29, z);
    a.prop(this.bell, 'cone', '#b69b65', [0, -0.13, 0], [0.15, 0.24, 0.15]);
    a.prop(this.bell, 'cylinder', '#c8ae75', [0, -0.25, 0], [0.16, 0.025, 0.16]);
    a.prop(this.bell, 'sphere', '#725f42', [0, -0.24, 0], [0.035, 0.055, 0.035]);
    a.prop(this.bell, 'cylinder', '#ac9e7d', [0, -0.69, 0], [0.008, 1.03, 0.008]);
    a.prop(this.bell, 'sphere', '#8a7254', [0, -1.21, 0], [0.042, 0.063, 0.042], 'wood');
    bake(this.bell);
    a.scene.add(this.bell);
  }

  private buildWorkshop() {
    const a = this.a,
      { z } = townSites.shutter;
    const interior = new T.Group();
    interior.name = 'Town workshop interior';
    interior.position.set(-6.25, 1.65, z);
    interior.rotation.y = Math.PI / 2;
    a.scene.add(interior);
    a.prop(interior, 'box', '#776449', [0, 0, -0.77], [1.88, 1.28, 0.05], 'wood');
    for (const x of [-0.95, 0.95])
      a.prop(interior, 'box', '#8b7959', [x, 0, -0.4], [0.055, 1.3, 0.8], 'wood');
    a.prop(interior, 'box', '#8b7959', [0, -0.62, -0.4], [1.95, 0.08, 0.83], 'wood');
    const bench = new T.Group();
    bench.name = 'Cooper workbench';
    bench.position.set(0, -0.43, -0.44);
    interior.add(bench);
    a.prop(bench, 'box', '#aa8b5d', [0, 0, 0], [1.69, 0.11, 0.61], 'wood');
    for (const x of [-0.66, 0.66])
      a.prop(bench, 'box', '#7a6547', [x, -0.18, 0], [0.09, 0.36, 0.45], 'wood');
    for (let stave = 0; stave < 6; stave++) {
      const angle = (stave / 6) * Math.PI;
      const piece = a.prop(
        bench,
        'box',
        stave % 2 ? '#b69765' : '#a88b5e',
        [0.24 + Math.cos(angle) * 0.19, 0.29, -0.04 + Math.sin(angle) * 0.16],
        [0.1, 0.51, 0.04],
        'wood',
      );
      piece.rotation.y = -angle;
    }
    const hoop = a.prop(bench, 'cylinder', '#605f4b', [0.24, 0.12, -0.04], [0.22, 0.025, 0.22]);
    const inside = a.prop(
      bench,
      'cylinder',
      '#9c8358',
      [0.24, 0.135, -0.04],
      [0.185, 0.028, 0.185],
    );
    hoop.name = 'Barrel hoop';
    inside.name = 'Barrel base';
    a.prop(bench, 'box', '#71634b', [-0.52, 0.07, 0.04], [0.32, 0.06, 0.07], 'wood');
    a.prop(bench, 'box', '#394a42', [-0.41, 0.12, 0.04], [0.13, 0.13, 0.1]);
    bake(bench);
    for (const x of [-0.65, -0.27, 0.58]) {
      a.prop(interior, 'box', '#a79a75', [x, 0.26, -0.72], [0.055, 0.34, 0.06], 'wood');
      a.prop(interior, 'box', '#434e43', [x, 0.43, -0.69], [0.18, 0.08, 0.07]);
    }
    const lamp = new T.Mesh(new T.SphereGeometry(0.07, 8, 6), a.mat('#f3d392', '#a66d32'));
    lamp.position.set(0.64, -0.08, -0.59);
    interior.add(lamp);
    a.prop(interior, 'cylinder', '#8f7958', [0.64, -0.19, -0.59], [0.12, 0.045, 0.12]);
    a.prop(interior, 'cylinder', '#cbb98a', [0.64, -0.13, -0.59], [0.035, 0.11, 0.035]);
    bake(interior);
    for (const edge of [-0.99, 0.99]) a.box('#e7d9bb', -6.16, 1.65, z + edge, 0.18, 1.42, 0.11);
    for (const y of [0.97, 2.34]) a.box('#e7d9bb', -6.16, y, z, 0.2, 0.12, 2.08);
    for (const [leaf, sign] of [
      [this.shutter, 1],
      [this.shutterRight, -1],
    ] as const) {
      leaf.name = sign > 0 ? 'Town workshop shutter' : 'Town workshop shutter right';
      leaf.userData.townFeature = 'shutter';
      leaf.position.set(-6.11, 1.65, z - sign * 0.94);
      for (let plank = 0; plank < 5; plank++)
        a.prop(
          leaf,
          'box',
          plank % 2 ? '#5f705c' : '#53665a',
          [0, 0, sign * (0.095 + plank * 0.188)],
          [0.07, 1.27, 0.178],
          'wood',
        );
      for (const y of [-0.41, 0.41])
        a.prop(leaf, 'box', '#3c5148', [0.045, y, sign * 0.47], [0.04, 0.065, 0.92]);
      a.prop(leaf, 'box', '#a69b77', [0.07, -0.04, sign * 0.84], [0.045, 0.16, 0.045]);
      bake(leaf);
      a.scene.add(leaf);
    }
  }

  finish() {
    const positions: number[] = [];
    for (let chimney = 0; chimney < this.chimneys.length; chimney++)
      for (let puff = 0; puff < 5; puff++) {
        const source = this.chimneys[chimney];
        positions.push(source.x, source.y + puff * 0.5, source.z);
        this.smokeOrigins.push(chimney, puff);
      }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const context = canvas.getContext('2d')!;
    const gradient = context.createRadialGradient(32, 32, 1, 32, 32, 31);
    gradient.addColorStop(0, 'rgba(185,179,154,.35)');
    gradient.addColorStop(0.5, 'rgba(176,174,155,.15)');
    gradient.addColorStop(1, 'rgba(176,174,155,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    const texture = new T.CanvasTexture(canvas);
    this.a.textures.push(texture);
    this.smoke = new T.Points(
      geometry,
      new T.PointsMaterial({
        map: texture,
        color: this.dawn ? '#c4c1ad' : '#8b9993',
        size: 1.5,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      }),
    );
    this.smoke.name = 'Chimney breath';
    this.a.scene.add(this.smoke);
  }

  setInteraction(pose: TownInteractionPose) {
    const progress = T.MathUtils.clamp(pose.progress, 0, 1);
    if (this.active?.id !== pose.id)
      this.active = {
        ...pose,
        progress,
        from:
          pose.id === 'gate'
            ? Number(this.open.gate)
            : pose.id === 'shutter'
              ? Number(this.open.shutter)
              : 0,
        triggered: false,
      };
    else Object.assign(this.active, pose, { progress });
    if (progress >= 1 && !this.active.triggered) {
      this.active.triggered = true;
      if (pose.id === 'gate' || pose.id === 'shutter') this.open[pose.id] = pose.open ?? true;
      if (pose.id === 'bell') this.bellAt = this.time;
      if (pose.id === 'pump') this.waterUntil = this.time + 1;
    }
    this.applyInteraction();
  }

  clearInteraction() {
    this.active = null;
  }

  setOpen(open: TownOpen) {
    this.open = { ...open };
    if (!this.active) {
      this.gateAmount = Number(open.gate);
      this.shutterAmount = Number(open.shutter);
      this.applyLeaves();
    }
  }

  private applyInteraction() {
    if (!this.active) return;
    const { id, progress, from } = this.active;
    const end = Number(this.active.open ?? true);
    if (id === 'gate')
      this.gateAmount = T.MathUtils.lerp(from, end, T.MathUtils.smoothstep(progress, 0.08, 1));
    if (id === 'shutter')
      this.shutterAmount = T.MathUtils.lerp(from, end, T.MathUtils.smoothstep(progress, 0.06, 1));
    this.applyLeaves();
  }

  private applyLeaves() {
    this.gate.rotation.y = (-this.gateAmount * Math.PI) / 2;
    this.shutter.rotation.y = this.shutterAmount * Math.PI;
    this.shutterRight.rotation.y = -this.shutterAmount * Math.PI;
    this.gate.userData.open = this.open.gate;
    this.gate.userData.progress = this.gateAmount;
    this.shutter.userData.open = this.open.shutter;
    this.shutter.userData.progress = this.shutterAmount;
    if (this.gateBox) Object.assign(this.gateBox, townGateCollider(this.gateAmount));
  }

  update(time: number, dt: number, reduced: boolean) {
    this.time = time;
    if (!this.active) {
      this.gateAmount = T.MathUtils.damp(this.gateAmount, Number(this.open.gate), 14, dt);
      this.shutterAmount = T.MathUtils.damp(this.shutterAmount, Number(this.open.shutter), 14, dt);
    }
    this.applyLeaves();
    const pumping = this.active?.id === 'pump' ? this.active.progress : 0;
    const pumpingNow = pumping > 0 && pumping < 1;
    this.pump.rotation.z = pumpingNow
      ? Math.sin(pumping * Math.PI * 5) * 0.44 - 0.12
      : T.MathUtils.damp(this.pump.rotation.z, 0, 12, dt);
    this.pump.userData.progress = pumping;
    const flowing = (pumpingNow && pumping > 0.16) || time < this.waterUntil;
    this.water.visible = flowing;
    this.ripples.visible = flowing;
    if (flowing) {
      this.water.scale.y = reduced ? 1 : 0.92 + Math.sin(time * 17) * 0.08;
      const ripple = reduced ? 0.7 : (time * 2.2) % 1;
      this.ripples.scale.setScalar(0.45 + ripple * 1.45);
      (this.ripples.material as T.MeshBasicMaterial).opacity = (1 - ripple) * 0.5;
    }
    const ringTime = Math.max(0, time - this.bellAt);
    const ringing = ringTime < 1.4;
    this.bell.rotation.z =
      ringing && !reduced ? Math.sin(ringTime * 13 + 0.2) * Math.exp(-ringTime * 2.4) * 0.35 : 0;
    this.bell.userData.progress = ringing ? Math.exp(-ringTime * 2.4) : 0;
    if (this.curtain)
      this.curtain.rotation.z =
        ringing && !reduced ? Math.sin(ringTime * 6) * Math.exp(-ringTime * 1.4) * 0.13 : 0;
    for (const { group, phase } of this.signs)
      group.rotation.x = reduced ? 0 : Math.sin(time * 0.8 + phase) * 0.018;
    for (const { group, phase } of this.cloth)
      group.rotation.x = reduced ? 0 : Math.sin(time * 1.1 + phase) * 0.012;
    if (this.smoke) {
      const points = this.smoke.geometry.getAttribute('position') as T.BufferAttribute;
      for (let point = 0; point < points.count; point++) {
        const chimney = this.smokeOrigins[point * 2],
          puff = this.smokeOrigins[point * 2 + 1];
        const origin = this.chimneys[chimney];
        const rise = reduced ? puff * 0.46 : (puff * 0.52 + time * 0.23) % 2.6;
        points.setXYZ(
          point,
          origin.x + rise * 0.15 + Math.sin(rise * 2 + chimney) * 0.06,
          origin.y + rise,
          origin.z + rise * 0.09,
        );
      }
      points.needsUpdate = true;
    }
  }
}
