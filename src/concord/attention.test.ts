import { describe, expect, it } from 'vitest';
import { selectAttention } from './attention';

const view = { x: 0, z: 0, yaw: 0, pitch: 0 };

describe('Concord eye contact', () => {
  it('addresses one nearby person in view rather than everyone within earshot', () => {
    const people = [
      { id: 'left', x: -1, z: -3 },
      { id: 'ahead', x: 0, z: -3 },
      { id: 'behind', x: 0, z: 2 },
    ];
    expect(selectAttention(view, people)).toBe('ahead');
    expect(selectAttention({ ...view, yaw: Math.PI }, people)).toBe('behind');
    expect(selectAttention(view, [{ id: 'side', x: 3, z: 0 }])).toBeNull();
    expect(selectAttention(view, [{ id: 'far', x: 0, z: -5 }])).toBeNull();
    expect(selectAttention({ ...view, pitch: 0.9 }, people)).toBeNull();
  });

  it('keeps a conversation partner through a small gaze change, but lets you address another', () => {
    const neighbors = [
      { id: 'left', x: -0.12, z: -3 },
      { id: 'right', x: 0.12, z: -3 },
    ];
    expect(selectAttention({ ...view, yaw: 0.02 }, neighbors)).toBe('left');
    expect(selectAttention({ ...view, yaw: 0.02 }, neighbors, 'right')).toBe('right');
    expect(
      selectAttention(
        { ...view, yaw: 0.3 },
        [
          { id: 'left', x: -1, z: -2 },
          { id: 'right', x: 1, z: -2 },
        ],
        'right',
      ),
    ).toBe('left');
    expect(selectAttention(view, [{ id: 'right', x: 0, z: -4.5 }], 'right')).toBe('right');
    expect(selectAttention(view, [{ id: 'right', x: 0, z: -4.8 }], 'right')).toBeNull();
  });

  it('cannot make eye contact through a building or keep a hidden previous target', () => {
    const person = [{ id: 'neighbor', x: 0, z: -3 }];
    const wall = { x: 0, z: -1.5, w: 1, d: 0.4 };
    expect(selectAttention(view, person, null, [wall])).toBeNull();
    expect(selectAttention(view, person, 'neighbor', [wall])).toBeNull();
    expect(selectAttention(view, person, null, [{ ...wall, x: 2 }])).toBe('neighbor');
    expect(selectAttention(view, person, null, [{ ...wall, z: -5 }])).toBe('neighbor');
    expect(selectAttention(view, person, 'somebody who left')).toBe('neighbor');
  });
});
