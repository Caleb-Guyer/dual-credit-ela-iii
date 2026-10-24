import { describe, expect, it } from 'vitest';
import { chooseQuestions, shuffle } from './Study';
import type { Question } from './data';

const pool: Question[] = Array.from({ length: 72 }, (_, index) => ({
  id: `q${String(index + 1).padStart(2, '0')}`,
  topic: `Topic ${index % 6}`,
  prompt: `Question ${index + 1}`,
  options: ['A', 'B', 'C', 'D'],
  answer: index % 4,
  explanation: 'Supporting reasoning.',
  distractors: ['A reason', 'B reason', 'C reason', 'D reason'],
  paragraph: index + 1,
}));

describe('Concord question selection', () => {
  it('builds a complete rehearsal with equal representation and no repeated questions', () => {
    const selected = chooseQuestions(pool, 24, { mastery: {}, missed: [] }, true, () => 0.4);
    expect(selected).toHaveLength(24);
    expect(new Set(selected.map((question) => question.id)).size).toBe(24);
    for (let i = 0; i < 6; i++) {
      expect(selected.filter((question) => question.topic === `Topic ${i}`)).toHaveLength(4);
    }
  });

  it('returns missed and unfamiliar questions before already secure questions', () => {
    const mastery = Object.fromEntries(
      pool.map((question) => [question.id, { seen: 4, correct: 4, streak: 4 }]),
    );
    delete mastery.q03;
    const selected = chooseQuestions(pool, 2, { mastery, missed: ['q02'] }, false, () => 0.4);
    expect(selected.map((question) => question.id)).toEqual(['q02', 'q03']);
  });

  it('handles small and duplicate pools without repeating or changing the source bank', () => {
    const small = [pool[0], pool[0], pool[1]];
    const selected = chooseQuestions(small, 24, { mastery: {}, missed: [] }, true);
    expect(selected).toHaveLength(2);
    expect(small).toEqual([pool[0], pool[0], pool[1]]);
    expect(chooseQuestions([], 24, { mastery: {}, missed: [] }, true)).toEqual([]);
  });

  it('keeps every answer option exactly once when shuffling', () => {
    const options = [0, 1, 2, 3];
    const changed = shuffle(options, () => 0);
    expect(changed).not.toEqual(options);
    expect([...changed].sort()).toEqual(options);
    expect(options).toEqual([0, 1, 2, 3]);
  });
});
