import { describe, expect, it } from 'vitest';
import { speechCountAt, speechSchedule } from './speech';

describe('conversation delivery', () => {
  it('holds on punctuation before the next word, so the face can take a breath', () => {
    const schedule = speechSchedule('Yes, I see. Why?');
    const comma = schedule[3];
    expect(speechCountAt(schedule, comma + 0.1)).toBe(4);
    expect(schedule[4] - comma).toBeCloseTo(0.14 + 1 / 42);
    expect(schedule[11] - schedule[10]).toBeCloseTo(0.25 + 1 / 42);
  });

  it('takes one breath after a punctuation cluster and never pauses for an apostrophe', () => {
    const schedule = speechSchedule("Well... I can't.");
    expect(schedule[5] - schedule[4]).toBeCloseTo(1 / 42);
    expect(schedule[6] - schedule[5]).toBeCloseTo(1 / 42);
    expect(schedule[7] - schedule[6]).toBeCloseTo(0.25 + 1 / 42);
    const contraction = speechSchedule("can't");
    expect(contraction.at(-1)).toBeCloseTo(5 / 42);
  });

  it('samples elapsed time without accumulating different results across frame rates', () => {
    const schedule = speechSchedule('A law cannot answer for me. I still must think.');
    for (const fps of [15, 30, 60, 144]) {
      let elapsed = 0;
      for (let frame = 0; frame < fps * 2; frame++) elapsed += 1 / fps;
      expect(speechCountAt(schedule, elapsed)).toBe(speechCountAt(schedule, 2));
    }
    expect(speechCountAt([], 5)).toBe(0);
    expect(speechCountAt(schedule, -1)).toBe(0);
    expect(speechCountAt(schedule, Infinity)).toBe(schedule.length);
  });
});
