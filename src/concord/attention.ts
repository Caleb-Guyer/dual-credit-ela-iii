import type { Collider } from './navigation';

export type AttentionPoint = { id: string; x: number; z: number };
export type AttentionView = { x: number; z: number; yaw: number; pitch?: number };

function behindWall(view: AttentionView, point: AttentionPoint, wall: Collider) {
  let enter = 0,
    leave = 1;
  for (let axis = 0; axis < 2; axis++) {
    const origin = axis === 0 ? view.x : view.z,
      delta = axis === 0 ? point.x - view.x : point.z - view.z,
      center = axis === 0 ? wall.x : wall.z,
      size = axis === 0 ? wall.w : wall.d;
    const min = center - size / 2,
      max = center + size / 2;
    if (Math.abs(delta) < 0.000001) {
      if (origin < min || origin > max) return false;
    } else {
      const a = (min - origin) / delta,
        b = (max - origin) / delta;
      enter = Math.max(enter, Math.min(a, b));
      leave = Math.min(leave, Math.max(a, b));
      if (leave <= enter) return false;
    }
  }
  return leave > 0.02 && enter < 0.98;
}

/** Eye contact has one recipient, with enough tolerance to avoid flickering between neighbors. */
export function selectAttention(
  view: AttentionView,
  people: readonly AttentionPoint[],
  previous: string | null = null,
  walls: readonly Collider[] = [],
): string | null {
  if (Math.abs(view.pitch ?? 0) > 0.7) return null;
  let best: string | null = null,
    bestScore = Infinity,
    previousScore = Infinity;
  for (const point of people) {
    const distance = Math.hypot(point.x - view.x, point.z - view.z);
    const angle = Math.atan2(point.x - view.x, -(point.z - view.z)) + view.yaw;
    const bearing = Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));
    const retained = point.id === previous;
    if (distance > (retained ? 4.7 : 4.2) || bearing > (retained ? 0.9 : 0.6)) continue;
    if (walls.some((wall) => behindWall(view, point, wall))) continue;
    const score = distance * 0.45 + bearing * 2.2;
    if (retained) previousScore = score;
    if (score < bestScore) {
      best = point.id;
      bestScore = score;
    }
  }
  return previousScore <= bestScore + 0.35 && Number.isFinite(previousScore) ? previous : best;
}
