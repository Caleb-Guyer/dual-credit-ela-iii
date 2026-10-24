import { describe, expect, it } from 'vitest';
import { freshSave, parseSave, SAVE_KEY } from './save';

describe('Concord device-local progress', () => {
  it('recovers from corrupt storage and keeps a separate campaign key', () => {
    expect(SAVE_KEY).toBe('ela-iii-concord-v1');
    expect(parseSave('broken')).toEqual(freshSave());
    expect(parseSave('{"version":9}')).toEqual(freshSave());
  });
  it('preserves valid reading history independently of game completion', () => {
    const save = freshSave();
    save.collected = ['c01', 'c04'];
    save.mastery.q001 = { seen: 4, correct: 3, streak: 2 };
    save.missed = ['q002'];
    save.exams = [{ score: 22, total: 24, date: '2026-10-24T19:00:00Z' }];
    expect(parseSave(JSON.stringify(save))).toEqual(save);
    expect(save.debates).toEqual([]);
  });
  it('sanitizes impossible progress and rejects completion without all debates', () => {
    const parsed = parseSave(
      JSON.stringify({
        version: 1,
        act: 99,
        collected: ['c01', 'c01', 'c13', 7],
        debates: [0, 0, 8],
        completed: true,
        mastery: { q001: { seen: 2, correct: 30, streak: 30 }, bad: { seen: 1 } },
        missed: ['q001', 'q001', 'invalid'],
        exams: [{ score: 25, total: 24, date: 'bad' }],
      }),
    );
    expect(parsed.act).toBe(3);
    expect(parsed.collected).toEqual(['c01']);
    expect(parsed.debates).toEqual([0]);
    expect(parsed.completed).toBe(false);
    expect(parsed.mastery).toEqual({ q001: { seen: 2, correct: 2, streak: 2 } });
    expect(parsed.missed).toEqual(['q001']);
    expect(parsed.exams).toEqual([]);
  });
});
