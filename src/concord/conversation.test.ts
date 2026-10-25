import { describe, expect, it } from 'vitest';
import { debates, evidence } from './data';
import { isWalkable, navigationObstacles } from './navigation';
import {
  advanceConversation,
  conversationActors,
  conversationDialogue,
  conversationExplanation,
  conversationHand,
  conversationLine,
  conversationReply,
  startConversation,
  type ConversationState,
} from './conversation';

function respond(state: ConversationState, claim: number, card: string) {
  let next = state.stage === 'opening' ? advanceConversation(state, { type: 'listen' }) : state;
  next = advanceConversation(next, { type: 'claim', index: claim });
  next = advanceConversation(next, { type: 'evidence', id: card });
  return advanceConversation(next, { type: 'submit' });
}

describe('Concord conversations in the village', () => {
  it('gives all 36 canonical choices distinct concise spoken replies without changing their grading', () => {
    const original = structuredClone(debates);
    const spoken: string[] = [];
    for (const debate of debates) {
      for (let roundIndex = 0; roundIndex < debate.rounds.length; roundIndex++) {
        const round = debate.rounds[roundIndex];
        for (let claimIndex = 0; claimIndex < round.claims.length; claimIndex++) {
          const line = conversationReply(debate.id, roundIndex, claimIndex);
          spoken.push(line);
          expect(line.length).toBeGreaterThan(25);
          expect(line.trim().split(/\s+/).length).toBeLessThanOrEqual(22);
          const answer = respond(
            { ...startConversation(debate.id), round: roundIndex },
            claimIndex,
            round.evidenceId,
          );
          expect(answer.result).toBe(round.claims[claimIndex].correct ? 'agree' : 'claim');
          expect(conversationExplanation(answer)).toBe(round.claims[claimIndex].explanation);
        }
      }
    }
    expect(spoken).toHaveLength(36);
    expect(new Set(spoken).size).toBe(36);
    expect(debates).toEqual(original);
  });

  it('keeps correct and mistaken spoken replies aligned when the canonical right answer moves position', () => {
    // The source builder inserts the right claim at positions 0, 1 and 2 across these rounds.
    expect(conversationReply(0, 0, 0)).toBe(
      'I still have to answer for what I do. A law cannot do that for me.',
    );
    expect(conversationReply(0, 1, 1)).toBe(
      'More people can force a decision through. That does not make it just.',
    );
    expect(conversationReply(0, 2, 2)).toBe(
      'If I obey without thinking, I can become a tool for hurting someone.',
    );
    expect(conversationReply(0, 0, 1)).toBe('If I want it strongly enough, that makes it right.');
    expect(conversationReply(0, 0, 2)).toBe('If the law can make us obey, it must be right.');
    expect(conversationReply(0, 1, 0)).toBe('If I am outnumbered, I must be the one who is right.');
    expect(conversationReply(0, 1, 2)).toBe(
      'I would trust the greater number. Votes tell us what is just.',
    );
    expect(conversationReply(0, 2, 0)).toBe(
      'Then we should stop using tools. The press itself is the problem.',
    );
    expect(conversationReply(0, 2, 1)).toBe(
      'As long as I use my intelligence, whatever I do must be right.',
    );
    expect(conversationReply(99, 0, 0)).toBe('');
    expect(conversationReply(0, 99, 0)).toBe('');
    expect(conversationReply(0, 0, -1)).toBe('');
    expect(conversationReply(0, 0, 9)).toBe('');
  });

  it('stages one reachable person per chapter with a legal standing pose facing that person', () => {
    expect(conversationActors).toHaveLength(debates.length);
    expect(new Set(conversationActors.map((actor) => actor.id)).size).toBe(debates.length);
    for (const actor of conversationActors) {
      expect(actor.act).toBeGreaterThanOrEqual(0);
      expect(actor.headHeight).toBeGreaterThan(1.6);
      expect(
        isWalkable(actor.act, navigationObstacles(actor.act), actor.approach.x, actor.approach.z),
      ).toBe(true);
      const targetYaw = Math.atan2(actor.approach.x - actor.x, actor.approach.z - actor.z);
      expect(Math.cos(targetYaw - (actor.approach.yaw ?? targetYaw))).toBeGreaterThan(0.99);
      expect(Math.hypot(actor.approach.x - actor.x, actor.approach.z - actor.z)).toBeLessThan(3.25);
    }
    expect(conversationActors[2].z).toBeGreaterThan(5.3);
    expect(conversationActors[2].approach.z).toBeLessThan(4.8);
  });

  it('uses the existing objections, answer choices, evidence and explanations for every round', () => {
    expect(conversationDialogue).toHaveLength(debates.length);
    for (const debate of debates) {
      expect(conversationDialogue[debate.id]).toHaveLength(debate.rounds.length);
      for (let index = 0; index < debate.rounds.length; index++) {
        const round = debate.rounds[index];
        const state = { ...startConversation(debate.id), round: index };
        expect(conversationLine(state)).toBe(round.objection);
        const hand = conversationHand(debate.id, index);
        expect(hand).toHaveLength(debate.id === 0 ? 3 : 4);
        expect(new Set(hand.map((card) => card.id)).size).toBe(hand.length);
        expect(hand.some((card) => card.id === round.evidenceId)).toBe(true);
        for (const card of hand) {
          expect(evidence).toContain(card);
          expect(evidence.indexOf(card)).toBeLessThan((debate.id + 1) * 3);
        }
        const correct = respond(
          state,
          round.claims.findIndex((claim) => claim.correct),
          round.evidenceId,
        );
        expect(correct.result).toBe('agree');
        expect(conversationExplanation(correct)).toBe(round.explanation);
        expect(conversationLine(correct)).toBe(conversationDialogue[debate.id][index].agree);
      }
    }
  });

  it('cannot skip objections, submit incomplete replies, or select unavailable sources', () => {
    const start = startConversation(0);
    for (const type of ['submit', 'continue', 'finish', 'back'] as const)
      expect(advanceConversation(start, { type })).toBe(start);
    expect(advanceConversation(start, { type: 'claim', index: 0 })).toBe(start);
    const reply = advanceConversation(start, { type: 'listen' });
    expect(advanceConversation(reply, { type: 'claim', index: -1 })).toBe(reply);
    expect(advanceConversation(reply, { type: 'claim', index: 9 })).toBe(reply);
    const selected = advanceConversation(reply, { type: 'claim', index: 0 });
    expect(selected.stage).toBe('evidence');
    expect(advanceConversation(selected, { type: 'submit' })).toBe(selected);
    expect(advanceConversation(selected, { type: 'evidence', id: 'c12' })).toBe(selected);
    expect(advanceConversation(selected, { type: 'evidence', id: 'not-a-source' })).toBe(selected);
    expect(conversationExplanation(selected)).toBeNull();
    expect(() => startConversation(9)).toThrow(RangeError);
    expect(conversationHand(99, 0)).toEqual([]);
  });

  it('answers both mistaken claims with distinct natural responses and the exact reading explanation', () => {
    for (const debate of debates) {
      for (let index = 0; index < debate.rounds.length; index++) {
        const round = debate.rounds[index];
        const wrong = round.claims.flatMap((claim, i) => (claim.correct ? [] : [i]));
        const lines = wrong.map((claim) => {
          const response = respond(
            { ...startConversation(debate.id), round: index },
            claim,
            round.evidenceId,
          );
          expect(response.result).toBe('claim');
          expect(conversationExplanation(response)).toBe(round.claims[claim].explanation);
          const retry = advanceConversation(response, { type: 'continue' });
          expect(retry.stage).toBe('reply');
          expect(retry.round).toBe(index);
          expect(retry.claim).toBeNull();
          expect(retry.evidenceId).toBeNull();
          expect(retry.attempts).toBe(1);
          return conversationLine(response);
        });
        expect(lines[0]).not.toBe(lines[1]);
        for (const line of lines) {
          expect(line.length).toBeGreaterThan(30);
          expect(line).not.toMatch(/incorrect|score|quiz/i);
        }
      }
    }
  });

  it('distinguishes a fitting reply with the wrong passage from a mistaken reply', () => {
    const debate = debates[1];
    const round = debate.rounds[0];
    const card = conversationHand(1, 0).find((item) => item.id !== round.evidenceId)!;
    const response = respond(
      startConversation(1),
      round.claims.findIndex((claim) => claim.correct),
      card.id,
    );
    expect(response.stage).toBe('response');
    expect(response.result).toBe('evidence');
    expect(conversationLine(response)).toBe(conversationDialogue[1][0].wrongEvidence);
    expect(conversationExplanation(response)).toContain('Your reply fits');
    expect(advanceConversation(response, { type: 'submit' })).toBe(response);
    const retry = advanceConversation(response, { type: 'continue' });
    expect(retry.round).toBe(0);
    expect(retry.stage).toBe('reply');
  });

  it('lets the player change a reply without submitting it or increasing attempts', () => {
    const reply = advanceConversation(startConversation(0), { type: 'listen' });
    const selected = advanceConversation(reply, { type: 'claim', index: 0 });
    const quoted = advanceConversation(selected, { type: 'evidence', id: 'c01' });
    const back = advanceConversation(quoted, { type: 'back' });
    expect(back).toMatchObject({ stage: 'reply', claim: null, evidenceId: null, attempts: 0 });
    expect(reply).toMatchObject({ stage: 'reply', claim: null, evidenceId: null, attempts: 0 });
  });

  it('preserves the exact discussion when stepping away and blocks progress until resuming', () => {
    let state = advanceConversation(startConversation(0), { type: 'listen' });
    state = advanceConversation(state, { type: 'claim', index: 1 });
    state = advanceConversation(state, { type: 'evidence', id: 'c01' });
    const away = advanceConversation(state, { type: 'leave' });
    expect(away).toEqual({ ...state, away: true });
    expect(advanceConversation(away, { type: 'submit' })).toBe(away);
    expect(advanceConversation(away, { type: 'continue' })).toBe(away);
    expect(advanceConversation(away, { type: 'listen' })).toBe(away);
    const resumed = advanceConversation(away, { type: 'resume' });
    expect(resumed).toEqual(state);
    const response = advanceConversation(resumed, { type: 'submit' });
    const pausedResponse = advanceConversation(response, { type: 'leave' });
    expect(advanceConversation(pausedResponse, { type: 'resume' })).toEqual(response);
  });

  it('requires all three supported answers, keeps farewell in the scene, and completes idempotently', () => {
    for (const debate of debates) {
      let state = startConversation(debate.id);
      for (let index = 0; index < debate.rounds.length; index++) {
        const round = debate.rounds[index];
        expect(state.round).toBe(index);
        state = respond(
          state,
          round.claims.findIndex((claim) => claim.correct),
          round.evidenceId,
        );
        expect(state.stage).toBe('response');
        const duplicate = advanceConversation(state, { type: 'submit' });
        expect(duplicate).toBe(state);
        state = advanceConversation(state, { type: 'continue' });
        expect(state.stage).toBe(index === 2 ? 'farewell' : 'opening');
      }
      expect(state.attempts).toBe(3);
      expect(conversationLine(state)).toBe(conversationActors[debate.id].farewell);
      expect(advanceConversation(state, { type: 'continue' })).toBe(state);
      const complete = advanceConversation(state, { type: 'finish' });
      expect(complete.stage).toBe('complete');
      expect(advanceConversation(complete, { type: 'finish' })).toBe(complete);
      expect(advanceConversation(complete, { type: 'claim', index: 0 })).toBe(complete);
    }
  });
});
