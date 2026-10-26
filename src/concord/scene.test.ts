import { describe, expect, it } from 'vitest';
import {
  clueBearing,
  hotspots,
  INSPECT_DISTANCE,
  isWalkable,
  navigationObstacles,
  nearestClue,
  spawns,
  treePlacement,
  RIVER_BENCH,
  type Collider,
} from './navigation';
import { townGateSweepContains, townSites } from './town-layout';

type RouteTarget = { id: string; x: number; z: number; reach: number };

function unreachableTargets(act: number, boxes: Collider[], targets: RouteTarget[]) {
  const spawn = spawns[act];
  const pending = new Set(targets.map((target) => target.id));
  const queue: [number, number][] = [[0, 0]],
    seen = new Set(['0,0']);
  let head = 0;
  while (head < queue.length && pending.size) {
    const [gx, gz] = queue[head++],
      x = spawn.x + gx * 0.5,
      z = spawn.z + gz * 0.5;
    for (const target of targets) {
      if (Math.hypot(x - target.x, z - target.z) < target.reach) pending.delete(target.id);
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = gx + dx,
        nz = gz + dz,
        key = `${nx},${nz}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (isWalkable(act, boxes, spawn.x + nx * 0.5, spawn.z + nz * 0.5)) queue.push([nx, nz]);
    }
  }
  return [...pending];
}

describe('Concord exploration routes', () => {
  for (let act = 0; act < 4; act++) {
    it(`all act ${act + 1} evidence and town activities are reachable without crossing scenery`, () => {
      const boxes = navigationObstacles(act),
        spawn = spawns[act];
      expect(isWalkable(act, boxes, spawn.x, spawn.z)).toBe(true);
      const targets: RouteTarget[] = hotspots
        .filter((h) => h.act === act)
        .map((point) => ({ ...point, reach: INSPECT_DISTANCE - 0.1 }));
      if (act !== 2) {
        for (const [id, site] of Object.entries(townSites)) {
          expect(isWalkable(act, boxes, site.approach.x, site.approach.z), id).toBe(true);
          targets.push({ id, ...site.approach, reach: 0.45 });
        }
      }
      expect(
        unreachableTargets(act, boxes, targets),
        'Every interaction needs a clear route',
      ).toEqual([]);
    });
  }
  it('opens a continuous garden route while keeping the swinging leaf and fences solid', () => {
    const garden = [{ id: 'garden', x: -10, z: 5.5, reach: 0.5 }];
    for (const act of [0, 1, 3]) {
      const closed = navigationObstacles(act),
        open = navigationObstacles(act, true);
      expect(unreachableTargets(act, closed, garden)).toEqual(['garden']);
      expect(unreachableTargets(act, open, garden)).toEqual([]);
      expect(isWalkable(act, closed, -6.2, 5.5)).toBe(false);
      expect(isWalkable(act, open, -6.2, 5.5)).toBe(true);
      expect(isWalkable(act, open, -7, 4.6)).toBe(false);
      expect(isWalkable(act, open, -10, 3.8)).toBe(false);
      expect(isWalkable(act, open, -13.2, 5.5)).toBe(false);
      expect(isWalkable(act, open, -11.85, 5.5)).toBe(false);
    }
  });
  it('keeps a person clear of the gate’s sweep before closing it', () => {
    expect(townGateSweepContains(-6.6, 5.5)).toBe(true);
    expect(townGateSweepContains(-7, 4.6)).toBe(true);
    expect(townGateSweepContains(-6.2, 4.6)).toBe(true);
    expect(townGateSweepContains(townSites.gate.approach.x, townSites.gate.approach.z)).toBe(false);
    expect(townGateSweepContains(-9, 5.5)).toBe(false);
  });
  it('blocks river water and buildings while leaving the bridge open', () => {
    const boxes = navigationObstacles(0);
    expect(isWalkable(0, boxes, 24, 0)).toBe(false);
    expect(isWalkable(0, boxes, 24, 18)).toBe(true);
    expect(isWalkable(0, boxes, 10, -12)).toBe(false);
    expect(isWalkable(0, boxes, 24, 20.1)).toBe(false);
    expect(isWalkable(0, boxes, 100, 0)).toBe(false);
  });
  it('plants eastern trees on the far bank and keeps the overlook beside the water', () => {
    for (let i = 0; i < 24; i++) {
      const tree = treePlacement(i);
      expect(tree.x < 18 || tree.x > 33, 'No tree can grow in the river channel').toBe(true);
    }
    expect(hotspots.find((point) => point.id === 'c11')).toMatchObject(RIVER_BENCH);
    const boxes = navigationObstacles(3);
    expect(isWalkable(3, boxes, RIVER_BENCH.x, RIVER_BENCH.z + 1.6)).toBe(true);
    expect(isWalkable(3, boxes, 35, 18)).toBe(true);
    expect(isWalkable(3, boxes, 25, 24)).toBe(false);
  });
  it('keeps cell walls and bed solid without trapping the player', () => {
    const boxes = navigationObstacles(2);
    expect(isWalkable(2, boxes, 0, 0)).toBe(true);
    expect(isWalkable(2, boxes, -3, 2.4)).toBe(false);
    expect(isWalkable(2, boxes, 4.4, 0)).toBe(false);
    expect(isWalkable(2, boxes, 0, 6)).toBe(false);
  });
  it('tracks only undiscovered clues in the current act', () => {
    expect(nearestClue(0, [], -3.3, 5)?.point.id).toBe('c01');
    expect(nearestClue(0, ['c01'], -3.3, 5)?.point.id).not.toBe('c01');
    expect(nearestClue(0, ['c01', 'c02', 'c03'], 0, 0)).toBeNull();
    expect(nearestClue(2, [], 0, 0)?.point.act).toBe(2);
  });
  it('compass follows camera rotation and distinguishes left, right, and behind', () => {
    const target = { id: 'test', act: 0, label: 'Test', x: 0, z: -10 };
    expect(clueBearing(0, 0, 0, target)).toBeCloseTo(0);
    expect(clueBearing(0, 0, Math.PI / 2, target)).toBeCloseTo(Math.PI / 2);
    expect(clueBearing(0, 0, 0, { ...target, x: 10, z: 0 })).toBeCloseTo(Math.PI / 2);
    expect(clueBearing(0, 0, 0, { ...target, x: -10, z: 0 })).toBeCloseTo(-Math.PI / 2);
    expect(Math.abs(clueBearing(0, 0, 0, { ...target, z: 10 }))).toBeCloseTo(Math.PI);
  });
});
