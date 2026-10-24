import { describe, expect, it } from 'vitest';
import { debates, evidence, passage, questions, source, topics } from './data';

describe('Concord primary-text integrity', () => {
  it('bundles the complete argument, prison narrative, verse, and closing vision', () => {
    expect(source).toHaveLength(51);
    expect(source.map((p) => p.id)).toEqual(Array.from({ length: 51 }, (_, i) => i + 1));
    expect(source[0].text).toMatch(/^I heartily accept the motto/);
    expect(source.at(-1)?.text).toMatch(/but not yet anywhere seen\.$/);
    expect(source.reduce((sum, p) => sum + p.text.split(/\s+/).length, 0)).toBeGreaterThan(9000);
    expect(passage(5)).toContain('Not a drum was heard');
    expect(passage(7)).toContain('too high-born');
    expect(passage(13)).toContain('A drab of state');
    expect(passage(45)).toContain('our country as our parents');
    expect(passage(48)).toContain('These extracts have been inserted since the Lecture was read');
    expect(passage(51)).toContain('sanction and consent of the governed');
    expect(JSON.stringify(source)).not.toContain('\ufffd');
    expect(passage(0)).toBe('');
    expect(passage(52)).toBe('');
  });

  it('quotes every discoverable card exactly from its cited paragraph', () => {
    expect(evidence).toHaveLength(12);
    expect(evidence.map((card) => card.id)).toEqual(
      Array.from({ length: 12 }, (_, i) => `c${String(i + 1).padStart(2, '0')}`),
    );
    expect(new Set(evidence.map((card) => card.quote)).size).toBe(12);
    for (const card of evidence) {
      expect(passage(card.paragraph), card.id).toContain(card.quote);
      expect(card.quote.length, card.id).toBeGreaterThan(30);
      expect(card.meaning.length, card.id).toBeGreaterThan(80);
      expect(topics, card.id).toContain(card.topic);
    }
  });
});

describe('Concord reading-check coverage and explanations', () => {
  it('provides 72 distinct questions balanced across eight topics', () => {
    expect(questions).toHaveLength(72);
    expect(topics).toHaveLength(8);
    expect(new Set(topics).size).toBe(8);
    expect(new Set(questions.map((q) => q.id)).size).toBe(72);
    expect(new Set(questions.map((q) => q.prompt)).size).toBe(72);
    for (const topic of topics) {
      expect(
        questions.filter((q) => q.topic === topic),
        topic,
      ).toHaveLength(9);
    }
    expect(new Set(questions.map((q) => q.paragraph)).size).toBeGreaterThan(25);
    for (const card of evidence) {
      expect(
        questions.some((q) => q.paragraph === card.paragraph),
        card.title,
      ).toBe(true);
    }
  });

  it('keeps four distinct options, correct answers, and option-specific feedback aligned', () => {
    for (const q of questions) {
      expect(q.id).toMatch(/^q\d{3}$/);
      expect(q.options, q.id).toHaveLength(4);
      expect(new Set(q.options).size, q.id).toBe(4);
      expect(Number.isInteger(q.answer), q.id).toBe(true);
      expect(q.answer, q.id).toBeGreaterThanOrEqual(0);
      expect(q.answer, q.id).toBeLessThan(4);
      expect(q.distractors, q.id).toHaveLength(4);
      expect(q.distractors[q.answer], q.id).toBe(q.explanation);
      expect(q.explanation.length, q.id).toBeGreaterThan(90);
      for (let i = 0; i < 4; i++) {
        expect(q.options[i].trim().length, `${q.id} option ${i}`).toBeGreaterThan(3);
        expect(q.distractors[i].trim().length, `${q.id} feedback ${i}`).toBeGreaterThan(25);
        if (i !== q.answer) expect(q.distractors[i], q.id).not.toBe(q.explanation);
      }
      expect(passage(q.paragraph).length, q.id).toBeGreaterThan(30);
      expect(topics, q.id).toContain(q.topic);
    }
    for (let answer = 0; answer < 4; answer++) {
      expect(questions.filter((q) => q.answer === answer)).toHaveLength(18);
    }
  });

  it('preserves distinctions that are easily lost in a simplified adaptation', () => {
    const answerTo = (fragment: string) => {
      const q = questions.find((item) => item.prompt.includes(fragment));
      expect(q, fragment).toBeTruthy();
      return q!.options[q!.answer];
    };
    expect(answerTo('ask for immediately')).toBe('A better government.');
    expect(answerTo('report not paying for six years')).toBe('The poll tax.');
    expect(answerTo('never declined to pay')).toBe('The highway tax.');
    expect(answerTo('How long does he say')).toBe('One night.');
    expect(answerTo('Why is Thoreau released')).toBe('Someone else pays the tax.');
    expect(answerTo('distinction should a careful reader')).toContain('denies the accusation');
    expect(answerTo('trace his particular dollar')).toContain('effects of his allegiance');
    expect(answerTo('guard against')).toContain('Obstinacy');
    expect(answerTo('view democracy')).toContain('further improvement');
  });
});

describe('Concord strategic debate curriculum', () => {
  it('pairs each act with three unique evidence cards and one defensible claim per round', () => {
    expect(debates.map((debate) => debate.id)).toEqual([0, 1, 2, 3]);
    expect(new Set(debates.map((debate) => debate.title)).size).toBe(4);
    const used: string[] = [];
    for (const debate of debates) {
      expect(debate.rounds).toHaveLength(3);
      const expected = evidence.slice(debate.id * 3, debate.id * 3 + 3).map((card) => card.id);
      expect(debate.rounds.map((round) => round.evidenceId).sort()).toEqual(expected.sort());
      for (const round of debate.rounds) {
        used.push(round.evidenceId);
        expect(round.claims).toHaveLength(3);
        expect(new Set(round.claims.map((claim) => claim.text)).size).toBe(3);
        expect(round.claims.filter((claim) => claim.correct)).toHaveLength(1);
        expect(round.objection.length).toBeGreaterThan(30);
        expect(round.explanation.length).toBeGreaterThan(80);
        for (const claim of round.claims) expect(claim.explanation.length).toBeGreaterThan(30);
        expect(round.claims.find((claim) => claim.correct)?.explanation).toBe(round.explanation);
      }
    }
    expect(new Set(used).size).toBe(12);
    expect(used).toHaveLength(12);
  });

  it('identifies dramatic speakers as adaptations instead of historical transcripts', () => {
    expect(debates[0].role).toContain('fictional');
    expect(debates[1].intro).toContain('rather than reenacting a documented conversation');
    expect(debates[2].intro).toContain('invented dramatic device');
    expect(debates[3].role).toContain('fictional');
  });
});
