import { isWalkable, type Collider } from './navigation';

export type MotionPose = { x: number; z: number; yaw: number; pitch?: number };
export type MotionPosture = 'stand' | 'sit' | 'window';
export type MotionStep = { surface: 'road' | 'wood' | 'stone'; speed: number };
export type MotionInput = {
  /** Forward/right movement and counterclockwise/upward keyboard rotation, from -1 to 1. */
  forward: number;
  strafe: number;
  sprint?: boolean;
  turn?: number;
  tilt?: number;
  /** Optional immediate look deltas in radians, applied once per update, not per substep. */
  lookX?: number;
  lookY?: number;
};
export type MotionOptions = {
  act: number;
  colliders: Collider[];
  reduced: boolean;
  /** Freeze player input immediately; posture can still settle while inspecting something. */
  locked?: boolean;
  posture?: MotionPosture;
};
export type MotionState = {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  velocityX: number;
  velocityZ: number;
  turnVelocity: number;
  tiltVelocity: number;
  /** Absolute camera height, including ground, posture and optional footsteps. */
  eyeHeight: number;
  groundHeight: number;
  /** Very small shoulder roll in radians. Zero with reduced motion. */
  sway: number;
  bob: number;
  speed: number;
  /** Distance actually travelled during the most recent update. */
  distance: number;
  stride: number;
  bodyHeight: number;
  bobWeight: number;
  act: number;
  steps: MotionStep[];
};

const WALK_SPEED = 3.2;
const RUN_SPEED = 5.2;
const STANDING_HEIGHT = 1.68;
const MAX_STEP = 1 / 120;
const PITCH_LIMIT = 1.05;
const finite = (value: number | undefined, fallback = 0) =>
  Number.isFinite(value) ? (value as number) : fallback;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const axis = (value: number | undefined) => clamp(finite(value), -1, 1);
const smoothstep = (value: number) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

/** Both 2.8m approaches meet the banks smoothly instead of jumping 80cm onto the deck. */
export function terrainHeight(act: number, x: number, z: number): number {
  if (act === 2 || !Number.isFinite(x) || !Number.isFinite(z)) return 0;
  const westRise = smoothstep((x - 14.65) / 2.8);
  const eastFall = smoothstep((35.65 - x) / 2.8);
  // The bridge rails prevent access to the edges; tapering also makes restored poses safe.
  const edge = Math.min(smoothstep((z - 15.55) / 0.7), smoothstep((20.45 - z) / 0.7));
  return 0.8 * westRise * eastFall * edge;
}

export function createMotion(pose: MotionPose): MotionState {
  const state: MotionState = {
    x: 0,
    z: 0,
    yaw: 0,
    pitch: -0.03,
    velocityX: 0,
    velocityZ: 0,
    turnVelocity: 0,
    tiltVelocity: 0,
    eyeHeight: STANDING_HEIGHT,
    groundHeight: 0,
    sway: 0,
    bob: 0,
    speed: 0,
    distance: 0,
    stride: 0,
    bodyHeight: STANDING_HEIGHT,
    bobWeight: 0,
    act: 0,
    steps: [],
  };
  return setMotionPose(state, pose);
}

/** Mutates and returns state. Use when restoring a notebook pose or changing the scene. */
export function setMotionPose(state: MotionState, pose: MotionPose): MotionState {
  state.x = finite(pose.x);
  state.z = finite(pose.z);
  state.yaw = finite(pose.yaw);
  state.pitch = clamp(finite(pose.pitch, -0.03), -PITCH_LIMIT, PITCH_LIMIT);
  state.velocityX = state.velocityZ = state.turnVelocity = state.tiltVelocity = 0;
  state.speed = state.distance = state.stride = state.bobWeight = state.bob = state.sway = 0;
  state.bodyHeight = STANDING_HEIGHT;
  state.groundHeight = terrainHeight(state.act, state.x, state.z);
  state.eyeHeight = state.bodyHeight + state.groundHeight;
  state.steps.length = 0;
  return state;
}

/** Drains real, distance-based footfalls. Standing still or pushing a wall makes no steps. */
export function takeMotionSteps(state: MotionState): MotionStep[] {
  return state.steps.splice(0);
}

/** Exact integral of exponential acceleration: position does not depend on frame length. */
function accelerate(velocity: number, target: number, response: number, dt: number) {
  const decay = Math.exp(-response * dt);
  return {
    velocity: target + (velocity - target) * decay,
    distance: target * dt + ((velocity - target) * (1 - decay)) / response,
  };
}

/** Move to the last clear point, then let the other axis slide along the obstruction. */
function moveAxis(state: MotionState, options: MotionOptions, delta: number, which: 'x' | 'z') {
  if (!delta) return;
  const start = state[which];
  const free = (position: number) =>
    isWalkable(
      options.act,
      options.colliders,
      which === 'x' ? position : state.x,
      which === 'z' ? position : state.z,
    );
  if (free(start + delta)) {
    state[which] += delta;
    return;
  }
  if (free(start)) {
    let low = 0;
    let high = 1;
    for (let i = 0; i < 12; i++) {
      const mid = (low + high) / 2;
      if (free(start + delta * mid)) low = mid;
      else high = mid;
    }
    state[which] += delta * low;
  }
  if (which === 'x') state.velocityX = 0;
  else state.velocityZ = 0;
}

/**
 * Mutates and returns state, in metres/radians/seconds. Forward is camera -Z, right is +X.
 * Elapsed time is accepted through 0.2s and collision-swept in at most 1/120s intervals.
 * Paused callers should skip this function; locked callers still ease to their posture.
 */
export function updateMotion(
  state: MotionState,
  input: MotionInput,
  elapsed: number,
  options: MotionOptions,
): MotionState {
  // Keep a bad input event or restored value from poisoning the camera's matrices.
  state.x = finite(state.x);
  state.z = finite(state.z);
  state.yaw = finite(state.yaw);
  state.pitch = clamp(finite(state.pitch, -0.03), -PITCH_LIMIT, PITCH_LIMIT);
  state.velocityX = finite(state.velocityX);
  state.velocityZ = finite(state.velocityZ);
  state.turnVelocity = finite(state.turnVelocity);
  state.tiltVelocity = finite(state.tiltVelocity);
  state.bodyHeight = finite(state.bodyHeight, STANDING_HEIGHT);
  state.stride = finite(state.stride);
  state.bobWeight = finite(state.bobWeight);
  state.act = options.act;
  state.distance = 0;
  const dt = clamp(finite(elapsed), 0, 0.2);
  let forward = options.locked ? 0 : axis(input.forward);
  let strafe = options.locked ? 0 : axis(input.strafe);
  const magnitude = Math.hypot(forward, strafe);
  if (magnitude > 1) {
    forward /= magnitude;
    strafe /= magnitude;
  }
  const moving = forward !== 0 || strafe !== 0;
  const speed = input.sprint ? RUN_SPEED : WALK_SPEED;
  if (options.locked) {
    state.velocityX = state.velocityZ = state.turnVelocity = state.tiltVelocity = 0;
    state.steps.length = 0;
  } else {
    state.yaw += finite(input.lookX);
    state.pitch = clamp(state.pitch + finite(input.lookY), -PITCH_LIMIT, PITCH_LIMIT);
  }
  const turn = options.locked ? 0 : axis(input.turn) * 1.4;
  const tilt = options.locked ? 0 : axis(input.tilt) * 0.8;
  const bodyHeight = options.posture === 'sit' ? 1.13 : options.posture === 'window' ? 1.58 : 1.68;
  const count = Math.max(1, Math.ceil(dt / MAX_STEP));
  const step = dt / count;
  for (let i = 0; i < count; i++) {
    const rotation = accelerate(state.turnVelocity, turn, 14, step);
    const elevation = accelerate(state.tiltVelocity, tilt, 14, step);
    const heading = state.yaw + rotation.distance / 2;
    state.yaw += rotation.distance;
    state.pitch = clamp(state.pitch + elevation.distance, -PITCH_LIMIT, PITCH_LIMIT);
    state.turnVelocity = rotation.velocity;
    state.tiltVelocity = elevation.velocity;
    const targetX = (-Math.sin(heading) * forward + Math.cos(heading) * strafe) * speed;
    const targetZ = (-Math.cos(heading) * forward - Math.sin(heading) * strafe) * speed;
    const response = moving ? 16 : 22;
    const x = accelerate(state.velocityX, targetX, response, step);
    const z = accelerate(state.velocityZ, targetZ, response, step);
    state.velocityX = x.velocity;
    state.velocityZ = z.velocity;
    const beforeX = state.x;
    const beforeZ = state.z;
    moveAxis(state, options, x.distance, 'x');
    moveAxis(state, options, z.distance, 'z');
    const distance = Math.hypot(state.x - beforeX, state.z - beforeZ);
    state.distance += distance;
    const actualSpeed = step ? distance / step : 0;
    const strideLength = input.sprint ? 0.98 : 0.78;
    const previousStride = Math.floor(state.stride);
    state.stride += distance / strideLength;
    if (Math.floor(state.stride) > previousStride && actualSpeed > 0.3) {
      state.steps.push({
        surface:
          options.act === 2
            ? 'stone'
            : terrainHeight(options.act, state.x, state.z) > 0.08
              ? 'wood'
              : 'road',
        speed: actualSpeed,
      });
      if (state.steps.length > 16) state.steps.shift();
    }
    state.bodyHeight += (bodyHeight - state.bodyHeight) * (1 - Math.exp(-12 * step));
    state.bobWeight +=
      (clamp(actualSpeed / speed, 0, 1) - state.bobWeight) * (1 - Math.exp(-18 * step));
  }
  state.speed = Math.hypot(state.velocityX, state.velocityZ);
  if (state.speed < 0.001) state.velocityX = state.velocityZ = state.speed = 0;
  state.groundHeight = terrainHeight(options.act, state.x, state.z);
  const bobEnabled = !options.reduced && !options.locked && bodyHeight === STANDING_HEIGHT;
  state.bob = bobEnabled ? Math.sin(state.stride * Math.PI * 2) * 0.014 * state.bobWeight : 0;
  state.sway = bobEnabled ? Math.sin(state.stride * Math.PI) * 0.0025 * state.bobWeight : 0;
  state.eyeHeight = state.groundHeight + state.bodyHeight + state.bob;
  return state;
}
