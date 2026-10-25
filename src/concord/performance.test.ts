import { describe, expect, it } from 'vitest';
import { sampleConversationPerformance } from './performance';
import type { CharacterConversation, CharacterRole } from './characters';

const roles: CharacterRole[] = ['neighbor', 'collector', 'jailer', 'walker'];
const delivery: CharacterConversation = {
  phase: 'speaking',
  beat: 0,
  speaking: true,
  elapsed: 0.6,
  text: 'A law cannot answer for me. What do you think?',
  revealed: 12,
};

describe('Concord conversation acting', () => {
  it('reproduces the same delivery without random changes between rendered frames', () => {
    for (const role of roles) {
      const cue = sampleConversationPerformance(role, 2.7, delivery, false);
      expect(sampleConversationPerformance(role, 2.7, delivery, false)).toEqual(cue);
      // Rendering skipped frames must not alter a later performance sample.
      for (const elapsed of [0.05, 0.1, 0.2, 0.35, 0.55])
        sampleConversationPerformance(role, 2.7, { ...delivery, elapsed }, false);
      expect(sampleConversationPerformance(role, 2.7, delivery, false)).toEqual(cue);
    }
  });

  it('closes the mouth whenever the character has yielded the conversation', () => {
    for (const role of roles)
      for (const phase of ['listening', 'considering', 'agree', 'disagree', 'farewell'] as const)
        for (const elapsed of [0, 0.2, 1, 7]) {
          const cue = sampleConversationPerformance(
            role,
            1.3,
            { ...delivery, phase, speaking: false, elapsed },
            false,
          );
          expect(cue.openness, `${role} ${phase} must not silently flap its mouth`).toBe(0);
        }
  });

  it('keeps a meaningful expression for thought, disagreement, and agreement', () => {
    for (const role of roles) {
      const sample = (phase: CharacterConversation['phase']) =>
        sampleConversationPerformance(role, 2, { ...delivery, phase, speaking: false }, false);
      expect(sample('considering').expression).toBe('thoughtful');
      expect(sample('disagree').expression).toBe('doubtful');
      expect(sample('agree').expression).toBe('warm');
      expect(sample('farewell').expression).toBe('warm');
    }
  });

  it('gives the four speakers distinct physical deliveries of the same line', () => {
    const poses = roles.map((role) => sampleConversationPerformance(role, 2, delivery, false));
    expect(
      new Set(
        poses.map((pose) =>
          JSON.stringify([
            pose.leftArm,
            pose.rightArm,
            pose.leftForearm,
            pose.rightForearm,
            pose.lean,
          ]),
        ),
      ).size,
    ).toBe(roles.length);
  });

  it('rests the hands between phrases and closes the mouth at punctuation', () => {
    const sample = (elapsed: number, revealed: number) =>
      sampleConversationPerformance(
        'neighbor',
        2,
        {
          ...delivery,
          text: 'A.',
          elapsed,
          revealed,
        },
        false,
      );
    expect(sample(0.1, 1).gesture).toBe('rest');
    expect(sample(1.2, 1).gesture).not.toBe('rest');
    expect(sample(3, 1).gesture).toBe('rest');
    expect(sample(0.6, 1).openness).toBeGreaterThan(0.2);
    expect(sample(0.6, 2).openness).toBe(0);
  });

  it('acknowledges an answer once instead of endlessly nodding or shaking', () => {
    const sample = (phase: 'agree' | 'disagree', elapsed: number) =>
      sampleConversationPerformance(
        'neighbor',
        2,
        { ...delivery, phase, speaking: false, elapsed },
        false,
      );
    expect(sample('agree', 0.4).gesture).toBe('nod');
    expect(Math.abs(sample('agree', 0.4).headPitch - sample('agree', 4).headPitch)).toBeGreaterThan(
      0.05,
    );
    expect(sample('agree', 4).headPitch).toBeCloseTo(sample('agree', 12).headPitch, 6);
    expect(sample('disagree', 0.4).gesture).toBe('gentle-shake');
    expect(Math.abs(sample('disagree', 0.4).headYaw)).toBeGreaterThan(0.05);
    expect(sample('disagree', 4).headYaw).toBe(0);
    expect(sample('disagree', 12).headYaw).toBe(0);
    expect(sample('agree', 4).gesture).toBe('settled');
    expect(sample('disagree', 4).gesture).toBe('invite');
  });

  it('reduced motion preserves expressions without speech, blink, or gesture oscillation', () => {
    for (const role of roles)
      for (const phase of [
        'speaking',
        'listening',
        'considering',
        'agree',
        'disagree',
        'farewell',
      ] as const) {
        const cue = sampleConversationPerformance(
          role,
          2,
          { ...delivery, phase, elapsed: 0 },
          true,
        );
        expect(cue.openness).toBe(0);
        expect(cue.blink).toBe(1);
        for (const elapsed of [0.13, 0.9, 3, 18])
          expect(
            sampleConversationPerformance(role, 2, { ...delivery, phase, elapsed }, true),
          ).toEqual(cue);
      }
  });
});
