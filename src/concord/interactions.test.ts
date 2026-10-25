import { describe, expect, it } from 'vitest';
import { evidence } from './data';
import {
  advanceInteraction,
  interactionDefs,
  startInteraction,
  type InteractionState,
} from './interactions';

function finishHold(state: InteractionState): InteractionState {
  const duration = interactionDefs[state.id].steps[state.step].duration ?? 1.2;
  const held = advanceInteraction(state, { type: 'hold', pressed: true });
  return advanceInteraction(held, { type: 'tick' }, duration + 0.01);
}

describe('Concord physical interactions', () => {
  it('has a short, actionable scene for every source discovery', () => {
    expect(Object.keys(interactionDefs).sort()).toEqual(evidence.map((card) => card.id).sort());
    for (const [id, def] of Object.entries(interactionDefs)) {
      expect(def.id).toBe(id);
      expect(def.steps.length).toBeGreaterThanOrEqual(2);
      expect(def.steps.length).toBeLessThanOrEqual(3);
      for (const step of def.steps) {
        expect(step.prompt.length).toBeGreaterThan(10);
        expect(step.actionLabel.length).toBeGreaterThan(3);
        if (step.kind === 'hold') {
          expect(step.duration).toBeGreaterThanOrEqual(1);
          expect(step.duration).toBeLessThanOrEqual(1.5);
        }
      }
    }
  });

  it('does not unlock a source just by waiting, pressing an unrelated key, or choosing an unknown answer', () => {
    const start = startInteraction('c01');
    expect(advanceInteraction(start, { type: 'tick' }, 600)).toBe(start);
    expect(advanceInteraction(start, { type: 'press' })).toBe(start);
    expect(advanceInteraction(start, { type: 'choose', choiceId: 'anything' })).toBe(start);
    expect(start.complete).toBe(false);
    expect(() => startInteraction('not-a-source')).toThrow(RangeError);
  });

  it('requires an uninterrupted hold and an explicit second action', () => {
    const start = startInteraction('c01');
    const held = advanceInteraction(start, { type: 'hold', pressed: true });
    const halfway = advanceInteraction(held, { type: 'tick' }, 0.5);
    expect(halfway.progress).toBeCloseTo(0.5);
    expect(start.progress).toBe(0);

    const released = advanceInteraction(halfway, { type: 'hold', pressed: false });
    expect(released.progress).toBe(0);
    expect(released.holding).toBe(false);
    expect(advanceInteraction(released, { type: 'tick' }, 30)).toBe(released);

    const unfolded = finishHold(released);
    expect(unfolded.step).toBe(1);
    expect(unfolded.progress).toBe(0);
    expect(unfolded.holding).toBe(false);
    expect(unfolded.complete).toBe(false);
    expect(advanceInteraction(unfolded, { type: 'tick' }, 30)).toBe(unfolded);
    const finished = advanceInteraction(unfolded, { type: 'press' });
    expect(finished.complete).toBe(true);
    expect(finished.step).toBe(1);
    expect(finished.progress).toBe(1);
    expect(advanceInteraction(finished, { type: 'press' })).toBe(finished);
  });

  it('ignores invalid elapsed time without losing a held action', () => {
    const held = advanceInteraction(startInteraction('c03'), { type: 'hold', pressed: true });
    for (const dt of [-1, 0, Number.NaN, Infinity]) {
      expect(advanceInteraction(held, { type: 'tick' }, dt)).toBe(held);
    }
  });

  it('cancels a partial gesture without completing it and can be replayed from the beginning', () => {
    const held = advanceInteraction(startInteraction('c12'), { type: 'hold', pressed: true });
    const partial = advanceInteraction(held, { type: 'tick' }, 0.6);
    const cancelled = advanceInteraction(partial, { type: 'cancel' });
    expect(cancelled).toMatchObject({
      cancelled: true,
      complete: false,
      holding: false,
      progress: 0,
    });
    expect(advanceInteraction(cancelled, { type: 'tick' }, 30)).toBe(cancelled);
    expect(advanceInteraction(cancelled, { type: 'press' })).toBe(cancelled);
    expect(startInteraction('c12')).toMatchObject({
      step: 0,
      progress: 0,
      cancelled: false,
      complete: false,
    });
  });

  it('lets either genuine follow-up question continue the neighbor conversation', () => {
    for (const choiceId of ['numbers', 'dissent']) {
      const begun = advanceInteraction(startInteraction('c02'), { type: 'press' });
      const answered = advanceInteraction(begun, { type: 'choose', choiceId });
      expect(answered.step).toBe(2);
      expect(answered.response).toBeTruthy();
      expect(answered.complete).toBe(false);
      expect(advanceInteraction(answered, { type: 'press' }).complete).toBe(true);
    }
  });

  it('previews payment without recording a paid tax or unlocking the refusal passage', () => {
    const bill = advanceInteraction(startInteraction('c04'), { type: 'press' });
    const preview = advanceInteraction(bill, { type: 'choose', choiceId: 'preview-payment' });
    expect(preview).toMatchObject({ step: 1, complete: false, cue: 'offer-coin' });
    expect(preview.response).toContain('Thoreau refused it');
    expect(advanceInteraction(preview, { type: 'tick' }, 60)).toBe(preview);
    const refusal = advanceInteraction(preview, { type: 'choose', choiceId: 'refuse' });
    expect(refusal).toMatchObject({ complete: true, cue: 'refuse-tax', progress: 1 });
    expect(bill.response).toBeNull();
  });

  it('corrects tracing individual dollars before continuing the ledger argument', () => {
    const ledger = finishHold(startInteraction('c05'));
    const tracing = advanceInteraction(ledger, { type: 'choose', choiceId: 'trace-coins' });
    expect(tracing.step).toBe(1);
    expect(tracing.complete).toBe(false);
    expect(tracing.response).toContain('declines to trace');
    expect(advanceInteraction(tracing, { type: 'choose', choiceId: 'allegiance' }).complete).toBe(
      true,
    );
  });

  it('completes every discovery through physical actions without mutating its definition', () => {
    const definitions = JSON.stringify(interactionDefs);
    for (const id of Object.keys(interactionDefs)) {
      let state = startInteraction(id);
      for (let guard = 0; !state.complete && guard < 5; guard++) {
        const step = interactionDefs[id].steps[state.step];
        if (step.kind === 'hold') state = finishHold(state);
        else if (step.kind === 'press') state = advanceInteraction(state, { type: 'press' });
        else {
          const choice = step.choices?.find((option) => option.advance !== false);
          expect(choice).toBeDefined();
          state = advanceInteraction(state, { type: 'choose', choiceId: choice!.id });
        }
      }
      expect(state.complete, id).toBe(true);
      expect(state.cancelled, id).toBe(false);
      expect(state.id).toBe(id);
    }
    expect(JSON.stringify(interactionDefs)).toBe(definitions);
  });

  it('supplies the window and seated postures for the quiet scenes', () => {
    expect(interactionDefs.c08.steps.every((step) => step.posture === 'window')).toBe(true);
    for (const id of ['c09', 'c11']) {
      expect(interactionDefs[id].steps.every((step) => step.posture === 'sit')).toBe(true);
    }
  });
});
