import type { Collider } from './navigation';

/** Fictional neighborhood places, laid out around the existing reading route. */
export const townSites = {
  pump: {
    x: -3.7,
    z: 16.5,
    height: 1.05,
    approach: { x: -2.3, z: 16.5, yaw: Math.PI / 2 },
  },
  bell: {
    x: -6,
    z: 0.9,
    height: 1.45,
    approach: { x: -4.55, z: 0.9, yaw: Math.PI / 2 },
  },
  gate: {
    x: -6.2,
    z: 5.5,
    height: 1.05,
    approach: { x: -4.7, z: 5.5, yaw: Math.PI / 2 },
  },
  shutter: {
    x: -6.1,
    z: -22,
    height: 1.65,
    approach: { x: -4.55, z: -22, yaw: Math.PI / 2 },
  },
} as const;

/** The moving garden gate has its own collider in the renderer. */
export const townColliders: readonly Collider[] = [
  { x: -3.58, z: 16.5, w: 1.22, d: 0.96 },
  { x: -13.2, z: 5.5, w: 0.14, d: 3.55 },
  { x: -9.7, z: 3.8, w: 7.15, d: 0.14 },
  { x: -9.7, z: 7.2, w: 7.15, d: 0.14 },
  { x: -6.2, z: 4.2, w: 0.14, d: 0.8 },
  { x: -6.2, z: 6.8, w: 0.14, d: 0.8 },
  { x: -11.85, z: 5.5, w: 0.62, d: 1.55 },
  // Projecting shop windows sit in front of the original building footprints.
  { x: -6.83, z: -13.13, w: 0.43, d: 1.4 },
  { x: -6.83, z: -8.87, w: 0.43, d: 1.4 },
  { x: -6.03, z: -2.13, w: 0.43, d: 1.4 },
  { x: -6.03, z: 2.13, w: 0.43, d: 1.4 },
  { x: -6.83, z: 8.87, w: 0.43, d: 1.4 },
  { x: -6.83, z: 13.13, w: 0.43, d: 1.4 },
  { x: 6.17, z: 7.75, w: 0.43, d: 1.4 },
  { x: 6.17, z: 12.25, w: 0.43, d: 1.4 },
];

export const townGate = { x: -6.2, hingeZ: 4.6, width: 1.8, thickness: 0.14 } as const;

/** The leaf swings into the garden; an open gate remains a solid object beside the path. */
export function townGateCollider(open: number | boolean = false): Collider & { id: 'town-gate' } {
  const fraction = typeof open === 'boolean' ? Number(open) : Math.max(0, Math.min(1, open));
  const angle = (fraction * -Math.PI) / 2;
  const s = Math.sin(angle),
    c = Math.cos(angle);
  return {
    id: 'town-gate',
    x: townGate.x + (s * townGate.width) / 2,
    z: townGate.hingeZ + (c * townGate.width) / 2,
    w: Math.abs(s) * townGate.width + Math.abs(c) * townGate.thickness,
    d: Math.abs(c) * townGate.width + Math.abs(s) * townGate.thickness,
  };
}

/** Leave the hinge's swept quarter-circle clear before moving a solid leaf through it. */
export function townGateSweepContains(x: number, z: number, padding = 0.36) {
  for (let sample = 0; sample <= 8; sample++) {
    const leaf = townGateCollider(sample / 8);
    if (Math.abs(x - leaf.x) < leaf.w / 2 + padding && Math.abs(z - leaf.z) < leaf.d / 2 + padding)
      return true;
  }
  return false;
}
