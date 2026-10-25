import { describe, expect, it } from 'vitest';
import { isWalkable, navigationObstacles, type Collider } from './navigation';
import {
  createMotion,
  setMotionPose,
  takeMotionSteps,
  terrainHeight,
  updateMotion,
  type MotionInput,
} from './motion';

const options = { act: 0, colliders: [] as Collider[], reduced: false };
const idle = { forward: 0, strafe: 0 };
const forward = { forward: 1, strafe: 0 };
function walk(input: MotionInput, dt: number, seconds = 2) {
  const state = createMotion({ x: 0, z: 10, yaw: 0 });
  for (let time = 0; time < seconds - 1e-8; time += dt) updateMotion(state, input, dt, options);
  return state;
}

describe('Concord walking', () => {
  it('covers the same distance at 120, 60, 30 and 5 frames per second', () => {
    const reference = walk(forward, 1 / 120);
    for (const dt of [1 / 60, 1 / 30, 0.2]) {
      const state = walk(forward, dt);
      expect(state.z).toBeCloseTo(reference.z, 9);
      expect(state.velocityZ).toBeCloseTo(reference.velocityZ, 9);
    }
    expect(reference.speed).toBeCloseTo(3.2, 6);
    expect(walk({ ...forward, sprint: true }, 0.2).speed).toBeCloseTo(5.2, 6);
  });

  it('normalizes diagonals without changing the walk distance', () => {
    const straight = walk(forward, 1 / 60);
    const diagonal = walk({ forward: 1, strafe: 1 }, 1 / 60);
    expect(Math.hypot(diagonal.x, diagonal.z - 10)).toBeCloseTo(10 - straight.z, 8);
    expect(diagonal.speed).toBeCloseTo(straight.speed, 8);
  });

  it('starts promptly, eases to speed and brakes within a short human step', () => {
    const state = createMotion({ x: 0, z: 10, yaw: 0 });
    updateMotion(state, forward, 1 / 60, options);
    expect(state.speed).toBeGreaterThan(0.7);
    expect(state.speed).toBeLessThan(1);
    for (let i = 0; i < 30; i++) updateMotion(state, forward, 1 / 60, options);
    expect(state.speed).toBeGreaterThan(3.19);
    const beforeStop = state.z;
    updateMotion(state, idle, 1 / 60, options);
    expect(state.speed).toBeGreaterThan(0);
    expect(state.speed).toBeLessThan(2.3);
    for (let i = 0; i < 30; i++) updateMotion(state, idle, 1 / 60, options);
    expect(state.speed).toBe(0);
    expect(beforeStop - state.z).toBeLessThan(0.15);
  });

  it('slides along a wall and cannot tunnel through a thin obstacle on a slow frame', () => {
    const colliders = [{ x: 1, z: 0, w: 0.05, d: 20 }];
    const settings = { ...options, colliders };
    const state = createMotion({ x: 0, z: 5, yaw: 0 });
    for (let i = 0; i < 10; i++)
      updateMotion(state, { forward: 1, strafe: 1, sprint: true }, 0.2, settings);
    expect(state.x).toBeLessThanOrEqual(0.655);
    expect(state.x).toBeGreaterThan(0.64);
    expect(state.z).toBeLessThan(-1.8);
    expect(isWalkable(0, colliders, state.x, state.z)).toBe(true);
  });

  it('accelerates keyboard turns while accepting mouse look without extra input lag', () => {
    const state = createMotion({ x: 0, z: 0, yaw: 0 });
    updateMotion(state, { ...idle, turn: 1 }, 1 / 60, options);
    expect(state.yaw).toBeGreaterThan(0);
    expect(state.yaw).toBeLessThan(1.4 / 60);
    const previous = state.yaw;
    state.turnVelocity = 0;
    updateMotion(state, { ...idle, lookX: 0.3, lookY: 0.2 }, 1 / 60, options);
    expect(state.yaw - previous).toBeCloseTo(0.3, 8);
    expect(state.pitch).toBeCloseTo(0.17, 8);
  });

  it('uses distance-based steps and suppresses bob and sway with reduced motion', () => {
    const state = walk(forward, 1 / 60);
    const steps = takeMotionSteps(state);
    expect(steps.length).toBeGreaterThan(6);
    expect(steps.every((step) => step.surface === 'road' && step.speed > 0)).toBe(true);
    expect(takeMotionSteps(state)).toEqual([]);
    expect(Math.abs(state.bob)).toBeLessThanOrEqual(0.014);
    updateMotion(state, forward, 1 / 60, { ...options, reduced: true });
    expect(state.bob).toBe(0);
    expect(state.sway).toBe(0);
    expect(state.eyeHeight).toBe(1.68);
  });

  it('makes the bridge approach continuous and settles into a seated interaction without drift', () => {
    expect(terrainHeight(0, 14.6, 18)).toBe(0);
    expect(terrainHeight(0, 17.5, 18)).toBeCloseTo(0.8);
    expect(terrainHeight(2, 18, 18)).toBe(0);
    expect(terrainHeight(0, 14.9, 18) - terrainHeight(0, 14.89, 18)).toBeLessThan(0.002);
    const state = createMotion({ x: 14.8, z: 18, yaw: 0 });
    updateMotion(state, { forward: 0, strafe: 1 }, 0.2, options);
    const pose = { x: state.x, z: state.z, yaw: state.yaw, pitch: state.pitch };
    for (let i = 0; i < 5; i++) {
      updateMotion(state, { forward: 1, strafe: 1, turn: 1, lookX: 5 }, 0.2, {
        ...options,
        locked: true,
        posture: 'sit',
      });
    }
    expect({ x: state.x, z: state.z, yaw: state.yaw, pitch: state.pitch }).toEqual(pose);
    expect(state.speed).toBe(0);
    expect(state.bodyHeight).toBeCloseTo(1.13, 4);
    expect(state.bob).toBe(0);
    expect(takeMotionSteps(state)).toEqual([]);
    expect(state.eyeHeight).toBeCloseTo(1.13 + terrainHeight(0, state.x, state.z), 4);
  });

  it('crosses the whole bridge onto the far bank and returns smoothly through both landings', () => {
    const settings = { ...options, colliders: navigationObstacles(0), reduced: true };
    const state = createMotion({ x: 14, z: 18, yaw: -Math.PI / 2 });
    let highest = 0;
    let previousHeight = state.eyeHeight;
    const step = (direction: number) => {
      updateMotion(state, { forward: direction, strafe: 0, sprint: true }, 1 / 60, settings);
      expect(isWalkable(0, settings.colliders, state.x, state.z)).toBe(true);
      expect(Math.abs(state.eyeHeight - previousHeight)).toBeLessThan(0.045);
      highest = Math.max(highest, state.groundHeight);
      previousHeight = state.eyeHeight;
    };
    for (let i = 0; i < 600 && state.x < 36.4; i++) step(1);
    expect(state.x).toBeGreaterThanOrEqual(36.4);
    expect(highest).toBeCloseTo(0.8);
    expect(state.eyeHeight).toBeCloseTo(1.68);
    expect(terrainHeight(0, 32.85, 18)).toBeCloseTo(0.8);
    expect(terrainHeight(0, 34.25, 18)).toBeCloseTo(0.4);
    expect(terrainHeight(0, 35.65, 18)).toBe(0);
    for (let i = 0; i < 30; i++) step(0);
    for (let i = 0; i < 600 && state.x > 14.1; i++) step(-1);
    expect(state.x).toBeLessThanOrEqual(14.1);
    expect(state.z).toBeCloseTo(18, 8);
    expect(state.eyeHeight).toBeCloseTo(1.68);
  });

  it('restores poses without carrying momentum or producing invalid camera values', () => {
    const state = walk(forward, 1 / 60);
    setMotionPose(state, { x: 1, z: 2, yaw: 3, pitch: 10 });
    expect(state.speed).toBe(0);
    expect(state.velocityZ).toBe(0);
    expect(state.pitch).toBe(1.05);
    expect(takeMotionSteps(state)).toEqual([]);
    state.x = NaN;
    state.velocityZ = Infinity;
    updateMotion(
      state,
      { forward: NaN, strafe: Infinity, turn: NaN, lookX: Infinity },
      NaN,
      options,
    );
    for (const value of Object.values(state)) {
      if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
    }
    expect(state.distance).toBe(0);
  });
});
