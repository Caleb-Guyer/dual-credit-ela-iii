import { debates, evidence, type Evidence } from './data';

export type ConversationActorId = 'citizen' | 'collector' | 'jailer' | 'visitor';
export type ConversationActor = {
  id: ConversationActorId;
  act: number;
  name: string;
  role: string;
  x: number;
  z: number;
  headHeight: number;
  approach: { x: number; z: number; yaw?: number };
  introduction: string;
  farewell: string;
};

/** Invented townspeople and dialogue, staged around the essay rather than historical testimony. */
export const conversationActors: ConversationActor[] = [
  {
    id: 'citizen',
    act: 0,
    name: 'Elias',
    role: 'A neighbor on the common',
    x: 4.12,
    z: -3.2,
    headHeight: 1.85,
    approach: { x: 2.3, z: -2.4, yaw: -1.156 },
    introduction: 'You have been reading the notices. Tell me what you make of all this.',
    farewell: 'I still have things to think over. The collector is waiting down the street.',
  },
  {
    id: 'collector',
    act: 1,
    name: 'Mr. Lowell',
    role: 'The tax collector',
    x: 4.85,
    z: -9.8,
    headHeight: 1.85,
    approach: { x: 3.1, z: -7.7, yaw: -0.695 },
    introduction: 'You have made your refusal clear. I would like to understand the reason for it.',
    farewell: 'I understand your distinction. My instructions remain. The jailer is expecting us.',
  },
  {
    id: 'jailer',
    act: 2,
    name: 'Jonas',
    role: 'The jailer, beyond the cell door',
    x: -0.25,
    z: 6.5,
    headHeight: 1.85,
    approach: { x: 0, z: 4.35, yaw: Math.atan2(0.25, -2.15) },
    introduction: 'Still awake? You seem less troubled by the lock than I expected.',
    farewell:
      'The lock has not changed your mind. Someone has paid the tax. You will leave in the morning.',
  },
  {
    id: 'visitor',
    act: 3,
    name: 'The morning reader',
    role: 'A neighbor on the river road',
    x: 2.5,
    z: 11.6,
    headHeight: 1.85,
    approach: { x: 1, z: 13.5, yaw: -0.668 },
    introduction: 'A night in jail, and now the same road home. What should change after this?',
    farewell: 'Then there is work for a neighbor as well as a government. Safe travels home.',
  },
];

type RoundDialogue = {
  agree: string;
  wrongClaims: [string, string];
  wrongEvidence: string;
  request: string;
};

/** Responses are original scene dialogue. Quotations still come only from the source bank. */
export const conversationDialogue: RoundDialogue[][] = [
  [
    {
      agree: 'Then a law would not excuse me from answering for what I do. I see the distinction.',
      wrongClaims: [
        'But wanting something is not the same as knowing it is right. What would make it a matter of conscience?',
        'That returns us to the law’s strength. Does being able to enforce a command make the command just?',
      ],
      wrongEvidence:
        'I hear your reply, but those words do not yet show why conscience should come first. Is there another passage?',
      request: 'What does Thoreau say about that responsibility?',
    },
    {
      agree: 'More hands can carry a vote. They cannot, by themselves, settle what is right.',
      wrongClaims: [
        'Would being outnumbered make every mistaken person right? We still need a reason beyond the count.',
        'That is what I began by assuming. How does a larger number establish justice?',
      ],
      wrongEvidence:
        'That passage raises another question. Show me where he separates the strength of a majority from its judgment.',
      request: 'Can you show me where the count and the moral question part company?',
    },
    {
      agree:
        'A person can keep the machinery running and never ask what it is doing. That is the danger you mean.',
      wrongClaims: [
        'Surely he is not asking the printer to throw away the press. What is the machine standing for?',
        'A clever person can still serve a wrong purpose. Where does judgment enter your account?',
      ],
      wrongEvidence:
        'I need the words about people serving without judgment. This passage does not quite meet that concern.',
      request: 'Which words explain the machinery you are speaking of?',
    },
  ],
  [
    {
      agree:
        'You are distinguishing your own participation from the impossible task of repairing every wrong. I understand that much.',
      wrongClaims: [
        'Then no one would ever have to withdraw support. Does being unable to do everything excuse doing this?',
        'Must every other duty disappear? I thought your argument concerned the support you yourself lend.',
      ],
      wrongEvidence:
        'That does not yet answer the limit of your responsibility. Show me what he asks of a person who cannot remedy everything.',
      request: 'Put his words beside your refusal. What is the duty you mean?',
    },
    {
      agree:
        'Not every inconvenience, then. You draw the line where your service makes you an agent of harm.',
      wrongClaims: [
        'An inconvenience is a broad excuse. Is that really the threshold he sets?',
        'A machine may run efficiently and still do harm. Why should keeping it running settle the matter?',
      ],
      wrongEvidence:
        'I am asking about the point where friction becomes participation in injustice. Which passage draws that line?',
      request:
        'Where does he draw the line between ordinary friction and a wrong you must interrupt?',
    },
    {
      agree:
        'You would act without waiting for the count, while still having to show that the action is right.',
      wrongClaims: [
        'Your ballot is still one ballot. I do not think the phrase changes the arithmetic.',
        'Defeating your neighbors would not prove the principle. What is the action supposed to answer to?',
      ],
      wrongEvidence:
        'That is not yet the argument about acting alone. Show me the passage about a person who does right.',
      request: 'What would you say to a person waiting for everyone else to agree?',
    },
  ],
  [
    {
      agree:
        'A locked door tells us that punishment has been imposed. It does not tell us whether the government was just to impose it.',
      wrongClaims: [
        'Every prisoner? That would claim more than the argument establishes. What condition are you leaving out?',
        'Comfort would be a poor measure here. Can a person do right and still suffer for it?',
      ],
      wrongEvidence:
        'Those words do not settle the justice of the imprisonment. Is there a passage that speaks directly to it?',
      request: 'What does he say about the place of a just person under an unjust government?',
    },
    {
      agree:
        'I can keep a body in this room. That is not the same as bringing its thoughts into agreement with me.',
      wrongClaims: [
        'The door is locked. Your answer must account for that fact rather than wish it away.',
        'If thought needed official approval, the lock would already have won the argument. Is that his position?',
      ],
      wrongEvidence:
        'I hear an answer about conscience, but not the words that explain the limits of these walls. Look once more.',
      request: 'Which words speak to what these walls can and cannot contain?',
    },
    {
      agree:
        'The State has the stronger hand. You are asking whether it has supplied the stronger reason.',
      wrongClaims: [
        'It plainly can hurt people. Why distinguish force from judgment if force had no consequences?',
        'That treats strength and right as the same thing again. Can you separate them?',
      ],
      wrongEvidence:
        'I am asking whether force supplies reason or honesty. Can you put the passage about that distinction before me?',
      request: 'What remains to be proved after the State has shown its strength?',
    },
  ],
  [
    {
      agree: 'A better government now, then, while keeping a more demanding possibility in view.',
      wrongClaims: [
        'Does the opening erase his later qualifications? Let us hold both parts of the essay together.',
        'Would that leave no work to do today? He does make a demand for the present.',
      ],
      wrongEvidence:
        'That is not the practical demand I was asking about. What does he ask for now?',
      request: 'Show me how his immediate demand differs from the opening ideal.',
    },
    {
      agree:
        'So the road and the school are not abandoned. Being a neighbor and giving unquestioning allegiance are different duties.',
      wrongClaims: [
        'I remember him making an exception for the highway tax. Does your answer leave room for that?',
        'Must caring for neighbors require approval of every state action? That is the distinction we need to examine.',
      ],
      wrongEvidence:
        'Those words do not yet show which duties he keeps. Where does he speak of the road or education?',
      request: 'What in the essay shows that he still accepts duties to other people?',
    },
    {
      agree:
        'The authority begins with people who remain worthy of respect. It is something a just state must earn and acknowledge.',
      wrongClaims: [
        'Force can obtain obedience. We have just seen why that is not enough to establish justice.',
        'Would an inherited arrangement be beyond improvement? He ends by asking what further step might be possible.',
      ],
      wrongEvidence:
        'I want to know where legitimate authority comes from. Can you show me his closing words on consent and the individual?',
      request: 'Which closing words would you carry into that better government?',
    },
  ],
];

type ReplyLines = { right: string; wrong: [string, string] };

/** Spoken adaptations of the canonical claims; grading continues to use data.ts. */
const playerReplies: ReplyLines[][] = [
  [
    {
      right: 'I still have to answer for what I do. A law cannot do that for me.',
      wrong: [
        'If I want it strongly enough, that makes it right.',
        'If the law can make us obey, it must be right.',
      ],
    },
    {
      right: 'More people can force a decision through. That does not make it just.',
      wrong: [
        'If I am outnumbered, I must be the one who is right.',
        'I would trust the greater number. Votes tell us what is just.',
      ],
    },
    {
      right: 'If I obey without thinking, I can become a tool for hurting someone.',
      wrong: [
        'Then we should stop using tools. The press itself is the problem.',
        'As long as I use my intelligence, whatever I do must be right.',
      ],
    },
  ],
  [
    {
      right: 'I cannot put every wrong right. I can stop helping to carry this one out.',
      wrong: [
        'If I cannot fix everything, I cannot be blamed for helping with any of it.',
        'I must give up every other duty until I have ended every injustice.',
      ],
    },
    {
      right:
        'I can bear an inconvenience. I cannot lend my hand when it makes me wrong another person.',
      wrong: [
        'If a law inconveniences me, that is enough reason to break it.',
        'I would keep the system running, whatever it does. Order matters most.',
      ],
    },
    {
      right: 'I need a reason to do right, not a crowd to give me permission.',
      wrong: [
        'My ballot ought to count for more than all the others put together.',
        'I would rather defeat my neighbors than ask whether I am right.',
      ],
    },
  ],
  [
    {
      right:
        'A government can lock me up unjustly. Its punishment does not prove that I was wrong.',
      wrong: [
        'If someone is in prison, that alone proves they must be innocent.',
        'I would judge my choice by how comfortable it leaves me.',
      ],
    },
    {
      right: 'You can keep me in this room. You cannot make these walls contain my thoughts.',
      wrong: [
        'Then the door cannot really be locked. I must be free to walk out.',
        'My thoughts only matter if the State approves of them.',
      ],
    },
    {
      right: 'You have the stronger hand. That does not mean you have the better reason.',
      wrong: [
        'No government can actually hurt anyone. Its force is only an appearance.',
        'If the State is stronger, then its argument must be right.',
      ],
    },
  ],
  [
    {
      right:
        'I want a better government now. The larger ideal depends on people being ready for it.',
      wrong: [
        'I would take the opening alone and set aside every qualification that follows.',
        'Nothing can improve until every government has disappeared.',
      ],
    },
    {
      right:
        'I can help maintain the road and the school without approving everything the State does.',
      wrong: [
        'I would refuse the highway tax too, along with every other payment.',
        'To be a good neighbor, I must support every action of the State.',
      ],
    },
    {
      right: 'Its authority should come from people whose consent and independence it respects.',
      wrong: [
        'From force. If it can overpower us, that is authority enough.',
        'From the old arrangement. No later generation should be allowed to reconsider it.',
      ],
    },
  ],
];

export function conversationReply(
  debateId: number,
  roundIndex: number,
  claimIndex: number,
): string {
  const round = debates[debateId]?.rounds[roundIndex];
  const claim = round?.claims[claimIndex];
  const lines = playerReplies[debateId]?.[roundIndex];
  if (!round || !claim || !lines) return '';
  if (claim.correct) return lines.right;
  return lines.wrong[round.claims.filter((choice) => !choice.correct).indexOf(claim)] ?? '';
}

export type ConversationStage =
  'opening' | 'reply' | 'evidence' | 'response' | 'farewell' | 'complete';
export type ConversationResult = 'agree' | 'claim' | 'evidence';
export type ConversationState = {
  debateId: number;
  round: number;
  stage: ConversationStage;
  claim: number | null;
  evidenceId: string | null;
  result: ConversationResult | null;
  attempts: number;
  away: boolean;
};
export type ConversationAction =
  | { type: 'listen' }
  | { type: 'claim'; index: number }
  | { type: 'evidence'; id: string }
  | { type: 'submit' }
  | { type: 'back' }
  | { type: 'continue' }
  | { type: 'finish' }
  | { type: 'leave' }
  | { type: 'resume' };

export function startConversation(debateId: number): ConversationState {
  if (!debates[debateId] || debates[debateId].id !== debateId)
    throw new RangeError(`Unknown Concord conversation: ${debateId}`);
  return {
    debateId,
    round: 0,
    stage: 'opening',
    claim: null,
    evidenceId: null,
    result: null,
    attempts: 0,
    away: false,
  };
}

/** A small, deterministic notebook hand drawn only from the chapters already reached. */
export function conversationHand(debateId: number, roundIndex: number): Evidence[] {
  const round = debates[debateId]?.rounds[roundIndex];
  if (!round) return [];
  const target = evidence.find((card) => card.id === round.evidenceId)!;
  const others = evidence.slice(0, (debateId + 1) * 3).filter((card) => card.id !== target.id);
  return [
    target,
    ...[...others.slice(roundIndex), ...others.slice(0, roundIndex)].slice(0, 3),
  ].sort((a, b) => a.id.localeCompare(b.id));
}

/** All transitions are immutable; leaving the scene preserves the exact discussion for resuming. */
export function advanceConversation(
  state: ConversationState,
  action: ConversationAction,
): ConversationState {
  if (action.type === 'leave') return state.away ? state : { ...state, away: true };
  if (action.type === 'resume') return state.away ? { ...state, away: false } : state;
  if (state.away || state.stage === 'complete') return state;
  const debate = debates[state.debateId];
  const round = debate?.rounds[state.round];
  if (!round) return state;
  if (action.type === 'listen' && state.stage === 'opening') return { ...state, stage: 'reply' };
  if (action.type === 'claim' && state.stage === 'reply' && round.claims[action.index])
    return {
      ...state,
      stage: 'evidence',
      claim: action.index,
      evidenceId: null,
      result: null,
    };
  if (
    action.type === 'evidence' &&
    state.stage === 'evidence' &&
    conversationHand(state.debateId, state.round).some((card) => card.id === action.id)
  )
    return { ...state, evidenceId: action.id };
  if (action.type === 'back' && state.stage === 'evidence')
    return { ...state, stage: 'reply', claim: null, evidenceId: null, result: null };
  if (
    action.type === 'submit' &&
    state.stage === 'evidence' &&
    state.claim !== null &&
    state.evidenceId !== null
  )
    return {
      ...state,
      stage: 'response',
      result: !round.claims[state.claim].correct
        ? 'claim'
        : state.evidenceId === round.evidenceId
          ? 'agree'
          : 'evidence',
      attempts: state.attempts + 1,
    };
  if (action.type === 'continue' && state.stage === 'response') {
    if (state.result === 'agree' && state.round === debate.rounds.length - 1)
      return { ...state, stage: 'farewell' };
    return {
      ...state,
      round: state.result === 'agree' ? state.round + 1 : state.round,
      stage: state.result === 'agree' ? 'opening' : 'reply',
      claim: null,
      evidenceId: null,
      result: null,
    };
  }
  if (action.type === 'finish' && state.stage === 'farewell')
    return { ...state, stage: 'complete' };
  return state;
}

export function conversationLine(state: ConversationState): string {
  const round = debates[state.debateId]?.rounds[state.round];
  const dialogue = conversationDialogue[state.debateId]?.[state.round];
  if (!round || !dialogue) return '';
  if (state.stage === 'farewell' || state.stage === 'complete')
    return conversationActors[state.debateId].farewell;
  if (state.stage === 'evidence') return dialogue.request;
  if (state.stage !== 'response') return round.objection;
  if (state.result === 'agree') return dialogue.agree;
  if (state.result === 'evidence') return dialogue.wrongEvidence;
  const wrongIndex = round.claims
    .filter((claim) => !claim.correct)
    .indexOf(round.claims[state.claim!]);
  return dialogue.wrongClaims[Math.max(0, wrongIndex)];
}

/** The explanation remains available without replacing the character's conversational response. */
export function conversationExplanation(state: ConversationState): string | null {
  if (state.stage !== 'response') return null;
  const round = debates[state.debateId]?.rounds[state.round];
  if (!round) return null;
  if (state.result === 'agree') return round.explanation;
  if (state.result === 'claim' && state.claim !== null)
    return round.claims[state.claim].explanation;
  return 'Your reply fits Thoreau’s position, but this passage does not support it. Look for the words that answer this particular objection.';
}
