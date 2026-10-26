import { describe, expect, it } from 'vitest';
import {
  advanceTownInteraction,
  applyTownInteraction,
  freshTownMemory,
  nearestTownActivity,
  startTownInteraction,
  townActionLabel,
  townActivities,
  townInteractionCompletion,
  townInteractionLabel,
  type TownId,
  type TownInteraction,
  type TownMemory,
} from './exploration';

function finish(id: TownId, memory = freshTownMemory()): TownInteraction {
  const activity = townActivities.find((item) => item.id === id)!;
  const start = startTownInteraction(id, memory);
  if (activity.kind === 'press') return advanceTownInteraction(start, { type: 'press' });
  const held = advanceTownInteraction(start, { type: 'hold', pressed: true });
  return advanceTownInteraction(held, { type: 'tick' }, activity.duration + 0.001);
}

describe('Concord optional town actions', () => {
  it('keeps four nearby, short activities separate from the reading discoveries', () => {
    expect(townActivities.map((activity) => activity.id).sort()).toEqual([
      'bell',
      'gate',
      'pump',
      'shutter',
    ]);
    for (const activity of townActivities) {
      expect(activity.reach).toBeGreaterThan(1.5);
      expect(activity.reach).toBeLessThan(2);
      expect(activity.duration).toBeGreaterThanOrEqual(0.8);
      expect(activity.duration).toBeLessThanOrEqual(1.3);
      expect(activity.title.length).toBeGreaterThan(5);
      expect(nearestTownActivity(0, activity.approach)?.id).toBe(activity.id);
    }
    expect(() => startTownInteraction('c01' as TownId, freshTownMemory())).toThrow(RangeError);
  });

  it('requires reaching and looking at an object in a town act', () => {
    for (const activity of townActivities) {
      for (const act of [0, 1, 3])
        expect(nearestTownActivity(act, activity.approach)?.id).toBe(activity.id);
      const away = { ...activity.approach, yaw: activity.approach.yaw + Math.PI };
      expect(nearestTownActivity(0, away)).toBeNull();
      expect(nearestTownActivity(0, { ...activity.approach, pitch: 1.05 })).toBeNull();
      expect(nearestTownActivity(0, { ...activity.approach, x: activity.x + 2.1 })).toBeNull();
      for (const act of [-1, 2, 4, Number.NaN])
        expect(nearestTownActivity(act, activity.approach)).toBeNull();
      expect(nearestTownActivity(0, { ...activity.approach, yaw: Number.NaN })).toBeNull();
    }
  });

  it('does nothing from waiting or using the wrong kind of input', () => {
    for (const activity of townActivities) {
      const start = startTownInteraction(activity.id, freshTownMemory());
      expect(advanceTownInteraction(start, { type: 'tick' }, 60)).toBe(start);
      const wrong =
        activity.kind === 'hold'
          ? ({ type: 'press' } as const)
          : ({ type: 'hold', pressed: true } as const);
      expect(advanceTownInteraction(start, wrong)).toBe(start);
      expect(start.complete).toBe(false);
      expect(townInteractionCompletion(start)).toBe('');
    }
  });

  it('keeps a close latch reachable without asking the player to look at the ground', () => {
    const atLatch = { x: -5.81, z: 5.5, y: 1.68, yaw: Math.PI / 2, pitch: 0 };
    expect(nearestTownActivity(0, atLatch)?.id).toBe('gate');
    expect(nearestTownActivity(0, { ...atLatch, pitch: 1.05 })).toBeNull();
  });

  it('requires uninterrupted holding and clears partial progress on release or cancellation', () => {
    for (const activity of townActivities.filter((item) => item.kind === 'hold')) {
      const start = startTownInteraction(activity.id, freshTownMemory());
      const held = advanceTownInteraction(start, { type: 'hold', pressed: true });
      const partial = advanceTownInteraction(held, { type: 'tick' }, activity.duration / 2);
      expect(partial.progress).toBeCloseTo(0.5);
      expect(partial.complete).toBe(false);
      expect(start.progress).toBe(0);
      const released = advanceTownInteraction(partial, { type: 'hold', pressed: false });
      expect(released).toMatchObject({ progress: 0, holding: false, complete: false });
      expect(advanceTownInteraction(released, { type: 'tick' }, 60)).toBe(released);
      const cancelled = advanceTownInteraction(partial, { type: 'cancel' });
      expect(cancelled).toMatchObject({
        progress: 0,
        holding: false,
        complete: false,
        cancelled: true,
      });
      expect(advanceTownInteraction(cancelled, { type: 'hold', pressed: true })).toBe(cancelled);
      expect(startTownInteraction(activity.id, freshTownMemory()).cancelled).toBe(false);
    }
  });

  it('uses elapsed time at four, thirty, sixty, and 144 frames per second', () => {
    for (const activity of townActivities.filter((item) => item.kind === 'hold')) {
      for (const fps of [4, 30, 60, 144]) {
        let state = advanceTownInteraction(startTownInteraction(activity.id, freshTownMemory()), {
          type: 'hold',
          pressed: true,
        });
        for (let frame = 0; frame < fps; frame++)
          state = advanceTownInteraction(state, { type: 'tick' }, activity.duration / fps / 2);
        expect(state.progress).toBeCloseTo(0.5, 8);
        expect(state.complete).toBe(false);
        for (const dt of [0, -1, Infinity, Number.NaN])
          expect(advanceTownInteraction(state, { type: 'tick' }, dt)).toBe(state);
        state = advanceTownInteraction(state, { type: 'tick' }, activity.duration * 0.51);
        expect(state).toMatchObject({ progress: 1, complete: true, holding: false });
        expect(advanceTownInteraction(state, { type: 'hold', pressed: true })).toBe(state);
      }
    }
  });

  it('rings the bell with one press and never commits water or bell use to hinge memory', () => {
    const memory = freshTownMemory();
    for (const id of ['bell', 'pump'] as const) {
      const completed = finish(id, memory);
      expect(completed.complete).toBe(true);
      expect(townInteractionCompletion(completed).length).toBeGreaterThan(15);
      expect(applyTownInteraction(memory, completed)).toBe(memory);
    }
    expect(advanceTownInteraction(finish('bell'), { type: 'press' })).toEqual(finish('bell'));
  });

  it('commits gate and shutter changes only after completion and toggles them independently', () => {
    const original = freshTownMemory();
    for (const id of ['gate', 'shutter'] as const) {
      const opening = startTownInteraction(id, original);
      expect(opening.opening).toBe(true);
      expect(townInteractionLabel(opening)).toMatch(/^Open /);
      expect(applyTownInteraction(original, opening)).toBe(original);
      const cancelled = advanceTownInteraction(opening, { type: 'cancel' });
      expect(applyTownInteraction(original, cancelled)).toBe(original);
      const completed = finish(id, original);
      const opened = applyTownInteraction(original, completed);
      expect(opened[id]).toBe(true);
      expect(opened[id === 'gate' ? 'shutter' : 'gate']).toBe(false);
      expect(original).toEqual({ gate: false, shutter: false });
      expect(townActionLabel(id, opened)).toMatch(/^Close /);
      expect(applyTownInteraction(opened, completed)).toBe(opened);
      const closing = finish(id, opened);
      expect(closing.opening).toBe(false);
      expect(townInteractionLabel(closing)).toMatch(/^Close /);
      expect(applyTownInteraction(opened, closing)).toEqual(original);
    }
    const both: TownMemory = { gate: true, shutter: true };
    expect(applyTownInteraction(both, finish('gate', both))).toEqual({
      gate: false,
      shutter: true,
    });
  });
});
