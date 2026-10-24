import { describe, expect, it } from 'vitest';
import {
  clueBearing,
  hotspots,
  INSPECT_DISTANCE,
  isWalkable,
  navigationObstacles,
  nearestClue,
  spawns,
} from './navigation';

describe('Concord exploration routes', () => {
  for (let act = 0; act < 4; act++) {
    it(`all act ${act + 1} evidence is reachable from its spawn without crossing scenery`, () => {
      const boxes = navigationObstacles(act),
        spawn = spawns[act];
      expect(isWalkable(act, boxes, spawn.x, spawn.z)).toBe(true);
      const pending = new Set(hotspots.filter((h) => h.act === act).map((h) => h.id));
      const queue: [number, number][] = [[0, 0]],
        seen = new Set(['0,0']);
      let head = 0;
      while (head < queue.length && pending.size) {
        const [gx, gz] = queue[head++],
          x = spawn.x + gx * 0.5,
          z = spawn.z + gz * 0.5;
        for (const clue of hotspots.filter((h) => h.act === act)) {
          if (Math.hypot(x - clue.x, z - clue.z) < INSPECT_DISTANCE - 0.1) pending.delete(clue.id);
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
      expect([...pending], 'Every clue needs an unobstructed path to inspection range').toEqual([]);
    });
  }
  it('blocks river water and buildings while leaving the bridge open', () => {
    const boxes = navigationObstacles(0);
    expect(isWalkable(0, boxes, 24, 0)).toBe(false);
    expect(isWalkable(0, boxes, 24, 18)).toBe(true);
    expect(isWalkable(0, boxes, 10, -12)).toBe(false);
    expect(isWalkable(0, boxes, 24, 20.1)).toBe(false);
    expect(isWalkable(0, boxes, 100, 0)).toBe(false);
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
