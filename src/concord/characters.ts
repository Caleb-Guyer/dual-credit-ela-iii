import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createConversationFace } from './face';
import {
  advancePresence,
  createPresence,
  samplePresenceGreeting,
  type CharacterAttention,
} from './presence';
export type { CharacterAttention } from './presence';
import {
  characterBlink,
  sampleConversationPerformance,
  type ConversationPerformance,
} from './performance';

export type CharacterRole = 'neighbor' | 'printer' | 'collector' | 'merchant' | 'jailer' | 'walker';
export type ConversationPhase =
  'speaking' | 'listening' | 'considering' | 'agree' | 'disagree' | 'farewell';
export type CharacterConversation = {
  phase: ConversationPhase;
  beat: number;
  speaking: boolean;
  elapsed: number;
  text?: string;
  revealed?: number;
};
type Material = (color: string, cloth?: boolean) => T.MeshStandardMaterial;
type CharacterOptions = {
  name: string;
  role: CharacterRole;
  coat: string;
  skin: string;
  hair: string;
  x: number;
  z: number;
  yaw: number;
  seed: number;
  bonnet?: boolean;
};

const sphere = new T.SphereGeometry(1, 12, 9);
const box = new T.BoxGeometry(1, 1, 1);
const cylinder = new T.CylinderGeometry(1, 1, 1, 12);
const coatShape = new T.CylinderGeometry(0.78, 1, 1, 12);
const up = new T.Vector3(0, 1, 0);

/** Bake only a pivot's static parts; the pivot and blinking eyes keep their own transforms. */
function mergeStaticParts(pivot: T.Group, animated: Set<T.Mesh>) {
  const batches = new Map<string, T.Mesh[]>();
  for (const child of pivot.children) {
    if (!(child instanceof T.Mesh) || animated.has(child) || Array.isArray(child.material))
      continue;
    const key = [
      child.material.uuid,
      child.castShadow,
      child.receiveShadow,
      child.visible,
      child.frustumCulled,
      child.renderOrder,
      child.layers.mask,
    ].join('/');
    const batch = batches.get(key);
    if (batch) batch.push(child);
    else batches.set(key, [child]);
  }
  for (const parts of batches.values()) {
    if (parts.length < 2) continue;
    const geometries = parts.map((part) => {
      part.updateMatrix();
      return part.geometry.clone().applyMatrix4(part.matrix);
    });
    const geometry = mergeGeometries(geometries);
    for (const temporary of geometries) temporary.dispose();
    if (!geometry) continue;
    const first = parts[0];
    const merged = new T.Mesh(geometry, first.material);
    merged.name = 'Static character parts';
    merged.castShadow = first.castShadow;
    merged.receiveShadow = first.receiveShadow;
    merged.visible = first.visible;
    merged.frustumCulled = first.frustumCulled;
    merged.renderOrder = first.renderOrder;
    merged.layers.mask = first.layers.mask;
    pivot.remove(...parts);
    pivot.add(merged);
  }
}

/** Small articulated figures, staged as fictional townspeople rather than historical portraits. */
export class Townsperson {
  readonly group = new T.Group();
  readonly body = new T.Group();
  readonly head = new T.Group();
  readonly leftArm = new T.Group();
  readonly rightArm = new T.Group();
  readonly leftForearm = new T.Group();
  readonly rightForearm = new T.Group();
  readonly leftLeg = new T.Group();
  readonly rightLeg = new T.Group();
  private face!: ReturnType<typeof createConversationFace>;
  private baseYaw: number;
  private headYaw = 0;
  private attention = 0;
  private presence = createPresence();
  private walkTime = 0;
  private walkStride = 0;
  private walkWeight = 0;
  private conversationWeight = 0;
  private lastPerformance: ConversationPerformance | null = null;
  private settledRotations = new Map<T.Object3D, T.Quaternion>();

  constructor(
    readonly options: CharacterOptions,
    material: Material,
  ) {
    const { coat, skin, hair, role, bonnet = false } = options;
    this.group.name = options.name;
    this.group.userData = { character: options.name, role };
    this.head.name = 'Character head';
    this.leftArm.name = 'Left arm';
    this.rightArm.name = 'Right arm';
    this.leftForearm.name = 'Left forearm';
    this.rightForearm.name = 'Right forearm';
    this.group.position.set(options.x, 0, options.z);
    this.group.rotation.y = this.baseYaw = options.yaw;
    this.group.add(this.body);
    const mesh = (
      parent: T.Object3D,
      geometry: T.BufferGeometry,
      color: string,
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
      cloth = false,
    ) => {
      const part = new T.Mesh(geometry, material(color, cloth));
      part.position.set(x, y, z);
      part.scale.set(sx, sy, sz);
      part.castShadow = part.receiveShadow = true;
      parent.add(part);
      return part;
    };
    const oval = (
      parent: T.Object3D,
      color: string,
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
      cloth = false,
    ) => mesh(parent, sphere, color, x, y, z, sx, sy, sz, cloth);
    const block = (
      parent: T.Object3D,
      color: string,
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
      cloth = false,
    ) => mesh(parent, box, color, x, y, z, sx, sy, sz, cloth);

    // Overlapping sleeves and cuffs hide the pivots while retaining a readable silhouette.
    mesh(this.body, coatShape, coat, 0, 1.03, 0, 0.25, 0.76, 0.2, true);
    oval(this.body, coat, 0, 1.3, 0, 0.245, 0.13, 0.18, true);
    block(this.body, '#d8ceb2', 0, 1.24, 0.185, 0.14, 0.31, 0.025, true);
    for (const side of [-1, 1]) {
      const lapel = block(this.body, coat, side * 0.095, 1.28, 0.193, 0.09, 0.24, 0.025, true);
      lapel.rotation.z = side * 0.24;
    }
    block(this.body, '#514036', 0, 1.39, 0.19, 0.08, 0.06, 0.035);
    for (let button = 0; button < 4; button++)
      oval(this.body, '#b8a37a', 0.025, 1.23 - button * 0.105, 0.205, 0.013, 0.014, 0.01);

    [this.leftArm, this.rightArm].forEach((arm, index) => {
      const side = index === 0 ? -1 : 1;
      arm.position.set(side * 0.225, 1.31, 0);
      this.body.add(arm);
      oval(arm, coat, 0, -0.15, 0, 0.085, 0.21, 0.087, true);
      const forearm = index === 0 ? this.leftForearm : this.rightForearm;
      forearm.position.set(0, -0.31, 0);
      arm.add(forearm);
      oval(forearm, coat, 0, -0.105, 0, 0.069, 0.16, 0.072, true);
      block(forearm, '#c9c2a9', 0, -0.22, 0, 0.105, 0.045, 0.11, true);
      oval(forearm, skin, 0, -0.285, 0.006, 0.054, 0.074, 0.045);
      // A simple thumb is enough to read an open hand at first-person distance.
      oval(forearm, skin, -side * 0.046, -0.268, 0.02, 0.023, 0.038, 0.025);
    });
    [this.leftLeg, this.rightLeg].forEach((leg, index) => {
      leg.position.set(index === 0 ? -0.115 : 0.115, 0.66, 0);
      this.body.add(leg);
      oval(leg, '#42463f', 0, -0.255, 0, 0.075, 0.29, 0.078, true);
      oval(leg, '#293332', 0, -0.57, 0.065, 0.092, 0.085, 0.16);
      block(leg, '#484238', 0, -0.625, 0.055, 0.16, 0.045, 0.23);
    });

    this.head.position.set(0, 1.61, 0);
    this.body.add(this.head);
    mesh(this.body, cylinder, skin, 0, 1.46, 0, 0.071, 0.16, 0.075);
    oval(this.head, skin, 0, 0.025, 0, 0.155, 0.205, 0.142);
    oval(this.head, hair, 0, 0.09, -0.043, 0.16, 0.155, 0.133);
    // Cheeks, asymmetric hair part, and a slight nose keep faces from reading as blank pegs.
    oval(this.head, skin, -0.068, -0.03, 0.092, 0.052, 0.055, 0.039);
    oval(this.head, skin, 0.066, -0.03, 0.092, 0.05, 0.052, 0.038);
    const fringe = oval(this.head, hair, -0.067, 0.13, 0.075, 0.1, 0.075, 0.067);
    fringe.rotation.z = -0.25;
    for (const side of [-1, 1])
      oval(this.head, skin, side * 0.15, 0.01, -0.005, 0.033, 0.052, 0.035);
    oval(this.head, skin, 0, 0.009, 0.143, 0.025, 0.046, 0.037);
    this.face = createConversationFace(this.head, skin, hair, material);

    if (bonnet) {
      oval(this.head, '#b6ad8e', 0, 0.11, -0.085, 0.19, 0.183, 0.14, true);
      const rim = mesh(this.head, cylinder, '#e0d4b4', 0, 0.075, -0.026, 0.203, 0.035, 0.2, true);
      rim.rotation.x = 0.24;
      const shawl = oval(this.body, '#8b7058', 0, 1.29, -0.02, 0.285, 0.13, 0.22, true);
      shawl.rotation.z = 0.02;
      block(this.body, '#ac9b7b', 0, 0.99, 0.217, 0.32, 0.54, 0.027, true);
    } else if (role === 'printer') {
      oval(this.head, '#616d60', 0, 0.225, -0.02, 0.19, 0.07, 0.16, true);
      block(this.body, '#b5ab8f', 0, 1.005, 0.21, 0.33, 0.57, 0.03, true);
      block(this.body, '#514f43', -0.04, 0.96, 0.232, 0.13, 0.022, 0.006);
      block(this.body, '#514f43', 0.08, 0.83, 0.232, 0.09, 0.031, 0.006);
    } else {
      mesh(this.head, cylinder, '#38413f', 0, 0.234, -0.01, 0.218, 0.038, 0.2);
      mesh(
        this.head,
        cylinder,
        role === 'jailer' ? '#5f5946' : '#38413f',
        0,
        0.332,
        -0.01,
        0.139,
        0.18,
        0.132,
        true,
      );
      mesh(this.head, cylinder, '#928267', 0, 0.272, -0.01, 0.142, 0.027, 0.135);
    }
    if (role === 'collector' || role === 'merchant') {
      for (const side of [-1, 1]) {
        const ring = new T.Mesh(new T.TorusGeometry(0.034, 0.004, 4, 12), material('#5a5140'));
        ring.position.set(side * 0.052, 0.054, 0.145);
        this.head.add(ring);
      }
      block(this.head, '#5a5140', 0, 0.054, 0.145, 0.035, 0.006, 0.009);
    }
    if (role === 'jailer') {
      mesh(this.body, cylinder, '#b6a16c', 0.2, 0.86, 0.13, 0.033, 0.01, 0.033).rotation.x =
        Math.PI / 2;
      block(this.body, '#b6a16c', 0.2, 0.82, 0.13, 0.018, 0.07, 0.02);
    }
    const animated = new Set(this.face.animated);
    for (const pivot of [
      this.body,
      this.head,
      this.leftArm,
      this.rightArm,
      this.leftForearm,
      this.rightForearm,
      this.leftLeg,
      this.rightLeg,
    ]) {
      mergeStaticParts(pivot, animated);
      this.settledRotations.set(pivot, pivot.quaternion.clone());
    }
  }

  update(
    time: number,
    dt: number,
    player: T.Vector3,
    reduced: boolean,
    action?: string,
    progress = 0,
    conversation?: CharacterConversation,
    social?: CharacterAttention,
  ) {
    const { role, seed } = this.options;
    let dx = player.x - this.group.position.x;
    let dz = player.z - this.group.position.z;
    let distance = Math.hypot(dx, dz);
    const reacting =
      !!conversation ||
      (action === 'c02' && role === 'neighbor' && this.options.bonnet) ||
      (action === 'c03' && role === 'printer') ||
      (action === 'c04' && role === 'collector') ||
      (action === 'c05' && role === 'merchant') ||
      (action === 'c06' && role === 'jailer') ||
      (action === 'c10' && role === 'walker');
    let workYaw =
      this.baseYaw + (role === 'walker' && Math.cos(this.walkTime * 0.32) < 0 ? Math.PI : 0);
    const facing = Math.atan2(dx, dz) - workYaw;
    this.presence = advancePresence(this.presence, {
      time,
      dt,
      distance,
      facing,
      focused: social?.focused ?? false,
      interacting: reacting,
    });
    this.attention = this.presence.attention;
    const greeting = samplePresenceGreeting(this.presence, time, reduced);
    if (role === 'walker') {
      // A passer-by pauses for an approach, then continues rather than freezing nearby forever.
      const lingering = this.presence.focusTime > 6 && distance > 2.5;
      const walking =
        !reduced && !reacting && distance > 1.25 && (!this.presence.engaged || lingering);
      this.walkWeight = T.MathUtils.damp(this.walkWeight, walking ? 1 : 0, 5, dt);
      const stride = reacting || reduced || distance <= 1.25 ? 0 : this.walkWeight;
      this.walkTime += dt * stride;
      this.walkStride += dt * stride * 2.3;
      this.group.position.z = this.options.z + Math.sin(this.walkTime * 0.32) * 1.3;
      workYaw = this.baseYaw + (Math.cos(this.walkTime * 0.32) < 0 ? Math.PI : 0);
      dx = player.x - this.group.position.x;
      dz = player.z - this.group.position.z;
      distance = Math.hypot(dx, dz);
    }
    this.conversationWeight = T.MathUtils.damp(
      this.conversationWeight,
      conversation ? 1 : 0,
      5,
      dt,
    );
    const workAngle = Math.atan2(
      Math.sin(Math.atan2(dx, dz) - workYaw),
      Math.cos(Math.atan2(dx, dz) - workYaw),
    );
    const politeTurn =
      T.MathUtils.clamp(workAngle, -0.65, 0.65) * this.attention * (this.presence.heard ? 0.35 : 1);
    const bodyFacing = conversation ? Math.atan2(dx, dz) : workYaw + politeTurn;
    const turn = Math.atan2(
      Math.sin(bodyFacing - this.group.rotation.y),
      Math.cos(bodyFacing - this.group.rotation.y),
    );
    this.group.rotation.y += turn * (1 - Math.exp(-dt * 4.5));
    const angle = Math.atan2(dx, dz) - this.group.rotation.y;
    const playerAngle = Math.atan2(Math.sin(angle), Math.cos(angle));
    const targetYaw = T.MathUtils.clamp(playerAngle, -0.65, 0.65);
    this.headYaw = T.MathUtils.damp(this.headYaw, targetYaw * this.attention, 4.5, dt);
    const breathe = reduced ? 0 : Math.sin(time * 1.65 + seed) * 0.008;
    this.body.position.y = breathe;
    this.body.rotation.z = reduced ? 0 : Math.sin(time * 0.65 + seed) * 0.009;
    const readingWork = role === 'printer' || role === 'collector' || role === 'merchant';
    this.head.rotation.set(
      (reduced ? 0 : Math.sin(time * 0.85 + seed) * 0.018) -
        this.attention * 0.025 +
        (readingWork ? (1 - this.attention) * 0.08 : 0),
      this.headYaw,
      reacting && role === 'collector' ? Math.sin(progress * Math.PI * 2) * 0.065 : 0,
    );
    this.head.rotation.x += greeting * (role === 'collector' || role === 'jailer' ? 0.028 : 0.055);
    const speaking = !!conversation?.speaking;
    this.group.userData.conversationPhase = conversation?.phase ?? null;
    this.group.userData.speaking = speaking;
    if (conversation)
      this.lastPerformance = sampleConversationPerformance(role, seed, conversation, reduced);
    const performance = this.lastPerformance;

    this.leftArm.rotation.set(0.08, 0, 0.12);
    this.rightArm.rotation.set(-0.06, 0, -0.1);
    this.leftForearm.rotation.set(-0.22, 0, 0);
    this.rightForearm.rotation.set(-0.22, 0, 0);
    this.leftLeg.rotation.x = this.rightLeg.rotation.x = 0;
    if (role === 'neighbor') {
      const speak = reacting ? 1 : 0;
      this.rightArm.rotation.x = -0.2 - speak * 0.57;
      this.rightArm.rotation.z = -0.12 - speak * 0.37;
      this.rightForearm.rotation.x =
        -0.4 - speak * 0.4 - (reduced ? 0 : Math.sin(time * 2.1 + seed) * 0.13) * speak;
      this.leftForearm.rotation.x = -0.35 - speak * 0.2;
    } else if (role === 'printer') {
      const press = reacting
        ? Math.sin(progress * Math.PI)
        : reduced
          ? 0
          : (Math.sin(time * 0.65) + 1) * 0.25;
      this.rightArm.rotation.x = -0.48 - press * 0.58;
      this.rightForearm.rotation.x = -0.6 + press * 0.25;
      this.leftArm.rotation.x = -0.45;
      this.leftForearm.rotation.x = -0.65;
    } else if (role === 'collector') {
      this.leftArm.rotation.x = -0.5;
      this.leftForearm.rotation.x = -1.15;
      this.rightArm.rotation.x = reacting ? -0.75 + progress * 0.43 : -0.15;
      this.rightArm.rotation.z = reacting ? -0.42 : -0.08;
      this.rightForearm.rotation.x = reacting ? -0.5 - Math.sin(progress * Math.PI) * 0.45 : -0.35;
    } else if (role === 'merchant') {
      this.leftArm.rotation.x = -0.7;
      this.leftForearm.rotation.x = -0.8;
      this.rightArm.rotation.x = reacting ? -1.0 : -0.5;
      this.rightForearm.rotation.x = reacting ? -0.4 - Math.sin(progress * Math.PI) * 0.5 : -0.75;
    } else if (role === 'jailer') {
      this.leftForearm.rotation.x = -1.25;
      this.rightArm.rotation.x = reacting ? -0.68 : -0.1;
      this.rightForearm.rotation.x = reacting ? -0.8 : -0.28;
    } else if (role === 'walker' && !reduced && !reacting) {
      const stride = Math.sin(this.walkStride + seed) * this.walkWeight;
      this.leftLeg.rotation.x = stride * 0.18;
      this.rightLeg.rotation.x = -stride * 0.18;
      this.leftArm.rotation.x = -stride * 0.1;
      this.rightArm.rotation.x = stride * 0.1;
    }
    if (!reacting && greeting > 0) {
      if (role === 'neighbor' || role === 'walker' || role === 'merchant') {
        const welcome = greeting * (role === 'walker' ? 0.85 : role === 'merchant' ? 0.45 : 0.7);
        this.rightArm.rotation.x -= welcome * 0.45;
        this.rightArm.rotation.z -= welcome * 0.22;
        this.rightForearm.rotation.x -= welcome * 0.6;
        this.rightForearm.rotation.y -= welcome * 0.2;
      } else if (role === 'collector') {
        this.rightForearm.rotation.y -= greeting * 0.12;
      }
    }
    const weight = this.conversationWeight;
    if (performance && weight > 0.001) {
      for (const [joint, target] of [
        [this.leftArm, performance.leftArm],
        [this.rightArm, performance.rightArm],
        [this.leftForearm, performance.leftForearm],
        [this.rightForearm, performance.rightForearm],
      ] as const) {
        joint.rotation.x += (target[0] - joint.rotation.x) * weight;
        joint.rotation.y += (target[1] - joint.rotation.y) * weight;
        joint.rotation.z += (target[2] - joint.rotation.z) * weight;
      }
      this.head.rotation.x += performance.headPitch * weight;
      this.head.rotation.y += performance.headYaw * weight;
      this.head.rotation.z += performance.headRoll * weight;
    }
    this.body.position.x = T.MathUtils.damp(
      this.body.position.x,
      (performance?.shift ?? 0) * weight,
      5,
      dt,
    );
    const close = !reacting ? T.MathUtils.smoothstep(1.05 - distance, 0, 0.6) * this.attention : 0;
    this.body.rotation.x =
      (performance?.lean ?? 0) * weight + (greeting * 0.009 - close * 0.025) * (1 - weight);
    const greetingWarmth =
      this.presence.engaged && (social?.familiar || (greeting > 0.1 && role === 'walker'));
    this.face.update(
      {
        expression:
          performance && weight > 0.04
            ? performance.expression
            : greetingWarmth
              ? 'warm'
              : this.attention > 0.03
                ? 'curious'
                : 'neutral',
        intensity:
          performance && weight > 0.04
            ? performance.intensity * weight
            : this.attention * (greetingWarmth ? 0.48 : 0.38),
        openness: conversation && performance ? performance.openness : 0,
        blink: characterBlink(time, seed, reduced),
        gazeX:
          conversation && performance
            ? performance.gazeX
            : T.MathUtils.clamp((playerAngle - this.headYaw) * 0.4, -0.35, 0.35) * this.attention,
        gazeY: conversation && performance ? performance.gazeY : this.attention * 0.04,
      },
      dt,
    );
    const faceState = this.head.getObjectByName('Conversation face')?.userData;
    this.group.userData.expression = faceState?.expression ?? 'neutral';
    this.group.userData.gesture =
      conversation && performance ? performance.gesture : greeting > 0.02 ? 'acknowledge' : 'rest';
    this.group.userData.focused = social?.focused ?? false;
    this.group.userData.socialAttention = this.attention;
    this.group.userData.noticing = this.presence.engaged;
    this.group.userData.greeting = greeting;
    this.group.userData.presence = conversation
      ? 'talking'
      : greeting > 0.02
        ? 'greeting'
        : this.presence.engaged
          ? 'attending'
          : this.attention > 0.025 || weight > 0.025
            ? 'settling'
            : 'working';
    this.group.userData.mouthOpenness = faceState?.openness ?? 0;
    this.group.userData.gazeX = faceState?.gazeX ?? 0;
    this.group.userData.gazeY = faceState?.gazeY ?? 0;
    // Attention comes from a small upper-body turn, never an abrupt whole-person spin.
    this.body.rotation.y = this.headYaw * 0.16;
    // Damping the whole articulated pose lets a hand finish its movement when a reply arrives.
    // It also eases back to the person's work instead of snapping into the old idle animation.
    for (const [joint, settled] of this.settledRotations) {
      settled.slerp(joint.quaternion, 1 - Math.exp(-dt * 10));
      joint.quaternion.copy(settled);
    }
  }
}

/** A thin cylinder with a precise axis is useful for animated handles and quills. */
export function jointBetween(a: T.Vector3, b: T.Vector3, radius: number, material: T.Material) {
  const mesh = new T.Mesh(cylinder, material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
  mesh.scale.set(radius, a.distanceTo(b), radius);
  mesh.castShadow = true;
  return mesh;
}
