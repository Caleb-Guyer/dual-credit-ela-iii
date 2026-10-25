export type Hotspot = { id: string; act: number; label: string; x: number; z: number };
export const RIVER_BENCH = { x: 14, z: 22.4 } as const;
export const hotspots: Hotspot[] = [
  { id: 'c01', act: 0, label: 'The town noticeboard', x: -3.3, z: 5 },
  { id: 'c02', act: 0, label: 'The meeting on the common', x: 3.4, z: -4 },
  { id: 'c03', act: 0, label: 'A page at the print shop', x: -4.9, z: -13 },
  { id: 'c04', act: 1, label: 'The tax collector’s table', x: 3.7, z: -9.2 },
  { id: 'c05', act: 1, label: 'The merchant’s ledger', x: -4.1, z: 8.9 },
  { id: 'c06', act: 1, label: 'The jail threshold', x: 3.8, z: -19.3 },
  { id: 'c07', act: 2, label: 'The writing desk', x: -2.5, z: -2.8 },
  { id: 'c08', act: 2, label: 'The barred window', x: 3.2, z: -0.8 },
  { id: 'c09', act: 2, label: 'The cell’s narrow bed', x: -2.8, z: 2.8 },
  { id: 'c10', act: 3, label: 'The morning newspaper', x: 0.2, z: 10.8 },
  { id: 'c11', act: 3, label: 'The river overlook', ...RIVER_BENCH },
  { id: 'c12', act: 3, label: 'The road back to town', x: -3.2, z: -10 },
];

export const spawns = [
  { x: 0, z: 12.2, yaw: 0.36 },
  { x: 0, z: -3.6, yaw: -0.4 },
  { x: 0, z: 3.7, yaw: 0.25 },
  { x: 0, z: 16.5, yaw: 0 },
];
export type Collider = { x: number; z: number; w: number; d: number };
export const INSPECT_DISTANCE = 3.25;

export function sceneryRandom(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** The river channel stays clear; the eastern trees grow on the far bank. */
export function treePlacement(index: number) {
  const east = index % 2 === 0;
  const z = -34 + sceneryRandom(index + 18) * 70;
  const x = east ? 34.5 + sceneryRandom(index + 4) * 12 : -(16.7 + sceneryRandom(index + 4) * 13);
  return {
    x: east && Math.abs(z - 18) < 4.5 ? Math.max(40, x) : x,
    z,
    scale: 0.7 + sceneryRandom(index + 45) * 0.65,
  };
}

/** The renderer and collision checks share this layout, so no GPU is needed to audit routes. */
export function navigationObstacles(act: number): Collider[] {
  if (act === 2)
    return [
      { x: -4.5, z: 0, w: 0.5, d: 12 },
      { x: 4.5, z: 0, w: 0.5, d: 12 },
      { x: 0, z: -5.5, w: 10, d: 0.5 },
      { x: 0, z: 5.5, w: 10, d: 0.5 },
      { x: -3, z: 2.4, w: 1.5, d: 2.9 },
      { x: -2.5, z: -2.8, w: 1.6, d: 0.95 },
    ];
  const boxes: Collider[] = [
    { x: 0, z: -30, w: 7, d: 5.5 },
    { x: 25.5, z: 15.9, w: 21, d: 0.16 },
    { x: 25.5, z: 20.1, w: 21, d: 0.16 },
    { x: 25, z: -16, w: 14, d: 63 },
    { x: 25, z: 38, w: 14, d: 35 },
  ];
  for (let i = 0; i < 5; i++) {
    boxes.push({ x: -9.8 - (i % 2) * 0.8, z: -22 + i * 11, w: 7.3, d: 7.3 });
    if (i < 4) boxes.push({ x: 10, z: -23 + i * 11, w: 7.4, d: 7.7 });
  }
  for (let i = 0; i < 24; i++) {
    const { x, z, scale } = treePlacement(i);
    boxes.push({
      x,
      z,
      w: 0.6 * scale,
      d: 0.6 * scale,
    });
  }
  return boxes;
}

export function isWalkable(act: number, boxes: Collider[], x: number, z: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  if (act === 2 && (x < -3.95 || x > 3.95 || z < -4.95 || z > 4.8)) return false;
  if (act !== 2 && (x < -19 || x > 38 || z < -27 || z > 29)) return false;
  return !boxes.some(
    (b) => Math.abs(x - b.x) < b.w / 2 + 0.32 && Math.abs(z - b.z) < b.d / 2 + 0.32,
  );
}

export function nearestClue(act: number, collected: string[], x: number, z: number) {
  let nearest: Hotspot | null = null,
    distance = Infinity;
  for (const point of hotspots) {
    if (point.act !== act || collected.includes(point.id)) continue;
    const d = Math.hypot(point.x - x, point.z - z);
    if (d < distance) {
      nearest = point;
      distance = d;
    }
  }
  return nearest ? { point: nearest, distance } : null;
}

/** Clockwise radians relative to the camera: zero ahead, positive right, pi behind. */
export function clueBearing(x: number, z: number, yaw: number, target: Hotspot): number {
  const a = Math.atan2(target.x - x, -(target.z - z)) + yaw;
  return Math.atan2(Math.sin(a), Math.cos(a));
}
