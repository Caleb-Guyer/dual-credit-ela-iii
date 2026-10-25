import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { createConversationFace } from './face';

function createRig() {
  const head = new T.Group();
  const materials = new Map<string, T.MeshStandardMaterial>();
  const rig = createConversationFace(head, '#c99d75', '#3b3029', (color) => {
    if (!materials.has(color)) materials.set(color, new T.MeshStandardMaterial({ color }));
    return materials.get(color)!;
  });
  return { head, rig };
}

const neutral = {
  expression: 'neutral' as const,
  openness: 0,
  blink: 1,
  gazeX: 0,
  gazeY: 0,
  intensity: 1,
};

function settle(
  rig: ReturnType<typeof createConversationFace>,
  cue: Parameters<typeof rig.update>[0],
) {
  for (let frame = 0; frame < 90; frame++) rig.update(cue, 1 / 60);
}

describe('Concord articulated faces', () => {
  it('changes real mouth geometry and brows when an argument warms or troubles a speaker', () => {
    const { head, rig } = createRig();
    const mouth = head.getObjectByName('Conversation mouth') as T.Mesh<T.BufferGeometry>;
    const brow = head.getObjectByName('Left eyebrow')!;
    const vertices = () => Array.from(mouth.geometry.getAttribute('position').array);
    settle(rig, { ...neutral, expression: 'warm' });
    const smile = vertices();
    const warmBrow = [brow.position.y, brow.rotation.z];
    settle(rig, { ...neutral, expression: 'doubtful' });
    expect(vertices()).not.toEqual(smile);
    expect([brow.position.y, brow.rotation.z]).not.toEqual(warmBrow);
    expect(head.getObjectByName('Conversation face')?.parent).toBe(head);
  });

  it('moves pupils for a glance and closes eyelids without distorting the whole head', () => {
    const { head, rig } = createRig();
    settle(rig, neutral);
    const pupil = head.getObjectByName('Left pupil')!;
    const eye = head.getObjectByName('Left eye')!;
    const centered = pupil.position.clone();
    settle(rig, { ...neutral, gazeX: 0.8, gazeY: -0.5 });
    expect(pupil.position.distanceTo(centered)).toBeGreaterThan(0.001);
    const open = eye.scale.y;
    settle(rig, { ...neutral, blink: 0 });
    expect(eye.scale.y).toBeLessThan(open * 0.2);
    expect(head.scale.toArray()).toEqual([1, 1, 1]);
    expect(head.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
  });

  it('opens and closes the rendered mouth while leaving its surface finite', () => {
    const { head, rig } = createRig();
    const mouth = head.getObjectByName('Conversation mouth') as T.Mesh<T.BufferGeometry>;
    const positions = () => mouth.geometry.getAttribute('position');
    const mouthHeight = () => {
      const ys = Array.from({ length: positions().count }, (_, index) => positions().getY(index));
      return Math.max(...ys) - Math.min(...ys);
    };
    settle(rig, neutral);
    const resting = mouthHeight();
    settle(rig, { ...neutral, openness: 0.9 });
    expect(mouthHeight()).toBeGreaterThan(resting + 0.008);
    expect(Array.from(positions().array).every(Number.isFinite)).toBe(true);
    settle(rig, neutral);
    expect(mouthHeight()).toBeCloseTo(resting, 4);
  });
});
