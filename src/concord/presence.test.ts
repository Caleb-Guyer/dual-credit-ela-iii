import { describe, expect, it } from 'vitest';
import {
  advancePresence,
  createPresence,
  samplePresenceGreeting,
  type PresenceInput,
  type PresenceState,
} from './presence';

const visible = { distance: 2.5, facing: 0, focused: true, interacting: false };

function update(state: PresenceState, dt: number, changes: Partial<PresenceInput> = {}) {
  return advancePresence(state, { ...visible, time: state.time + dt, dt, ...changes });
}

describe('Concord social presence', () => {
  it('waits for a deliberate approach, then acknowledges it once', () => {
    let person = update(createPresence(), 0.15);
    expect(person.seen).toBe(true);
    expect(person.greetingAt).toBeNull();
    person = update(person, 0.15);
    expect(person.greetingAt).toBeCloseTo(0.25);
    const greetingAt = person.lastGreetingAt;
    for (let frame = 0; frame < 120; frame++) person = update(person, 1 / 30);
    expect(person.attention).toBeGreaterThan(0.99);
    expect(person.greetingAt).toBeNull();
    expect(person.lastGreetingAt).toBe(greetingAt);
    expect(person.greeted).toBe(true);
  });

  it('does not stare through the back of a head, but hears someone very close', () => {
    const back = update(createPresence(), 1, { facing: Math.PI });
    expect(back.seen).toBe(false);
    expect(back.heard).toBe(false);
    expect(back.attention).toBe(0);
    const footsteps = update(back, 1, { facing: Math.PI, distance: 1.2 });
    expect(footsteps.heard).toBe(true);
    expect(footsteps.attention).toBeGreaterThan(0.2);
    expect(footsteps.attention).toBeLessThan(0.29);
    expect(footsteps.greetingAt).toBeNull();
    expect(update(createPresence(), 1, { focused: false }).engaged).toBe(false);
  });

  it('gives a small look-away some grace, then settles when the player leaves', () => {
    let person = update(createPresence(), 1);
    person = update(person, 0.3, { focused: false });
    expect(person.engaged).toBe(true);
    expect(person.attention).toBeGreaterThan(0.9);
    for (let frame = 0; frame < 90; frame++)
      person = update(person, 1 / 30, { focused: false, distance: 8 });
    expect(person.engaged).toBe(false);
    expect(person.attention).toBeLessThan(0.001);
  });

  it('requires both a real absence and a cooldown before greeting again', () => {
    let person = update(createPresence(), 1);
    const first = person.lastGreetingAt;
    person = update(person, 4, { focused: false, distance: 8 });
    person = update(person, 0.4);
    expect(person.lastGreetingAt).toBe(first);
    // Remaining in view cannot turn a short return into a delayed second wave.
    person = update(person, 20);
    expect(person.lastGreetingAt).toBe(first);
    person = update(person, 3.5, { focused: false, distance: 8 });
    person = update(person, 0.4);
    expect(person.lastGreetingAt).toBeGreaterThan(first + 18);
    expect(person.greetingAt).not.toBeNull();
  });

  it('counts an actual exchange as acknowledgment rather than waving again on exit', () => {
    let person = update(createPresence(), 1, { interacting: true });
    expect(person.greetingAt).toBeNull();
    expect(person.attention).toBeGreaterThan(0.9);
    person = update(person, 0.4);
    expect(person.greetingAt).toBeNull();
    expect(person.lastGreetingAt).toBe(1);
    expect(person.greeted).toBe(true);
  });

  it('uses elapsed time consistently and freezes when paused', () => {
    const samples = [4, 30, 60, 144].map((fps) => {
      let state = createPresence();
      for (let frame = 0; frame < fps; frame++) state = update(state, 1 / fps);
      return state;
    });
    for (const state of samples) {
      expect(state.lastGreetingAt).toBeCloseTo(0.25);
      expect(state.attention).toBeCloseTo(samples[0].attention, 8);
    }
    expect(update(samples[0], 0)).toBe(samples[0]);
  });

  it('finishes a single greeting and removes its motion when reduced motion is chosen', () => {
    const person = update(createPresence(), 0.4);
    const start = person.greetingAt!;
    expect(samplePresenceGreeting(person, start + 0.8, false)).toBeGreaterThan(0.9);
    expect(samplePresenceGreeting(person, start + 0.8, true)).toBe(0);
    expect(samplePresenceGreeting(person, start + 2, false)).toBe(0);
    expect(samplePresenceGreeting(person, start, false)).toBe(0);
    expect(person.engaged).toBe(true);
    expect(person.attention).toBeGreaterThan(0.7);
  });
});
