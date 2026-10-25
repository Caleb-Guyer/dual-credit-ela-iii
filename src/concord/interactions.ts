/** These short scenes are adaptations. The source passages remain in data.ts. */
export const INTERACTION_DIALOGUE_NOTE = 'Original scene dialogue · based on the reading';

export type InteractionChoice = {
  id: string;
  label: string;
  response: string;
  /** A preview or a question can leave the player on the same step. */
  advance?: boolean;
  cue?: string;
};

export type InteractionStep = {
  kind: 'hold' | 'press' | 'choose';
  prompt: string;
  actionLabel: string;
  duration?: number;
  speaker?: string;
  dialogue?: string;
  posture?: 'stand' | 'sit' | 'window';
  choices?: InteractionChoice[];
};

export type InteractionDef = {
  id: string;
  title: string;
  intro: string;
  steps: InteractionStep[];
  completion: string;
};

export const interactionDefs: Record<string, InteractionDef> = {
  c01: {
    id: 'c01',
    title: 'The noticeboard',
    intro: 'A new notice covers two older sheets. Its loose corner taps against the board.',
    steps: [
      {
        kind: 'hold',
        prompt: 'Ease the bent pin out of the lower corner.',
        actionLabel: 'Pull the pin',
        duration: 1,
      },
      {
        kind: 'press',
        prompt: 'The paper is free. Open the fold to read what lies underneath.',
        actionLabel: 'Unfold the notice',
      },
    ],
    completion: 'The folded sheet opens in your hands. Who gets to decide what is right?',
  },
  c02: {
    id: 'c02',
    title: 'A voice on the common',
    intro: 'A neighbor stops beside the fence, still talking about the vote.',
    steps: [
      {
        kind: 'press',
        prompt: 'Join the conversation.',
        actionLabel: 'Ask about the vote',
        speaker: 'Ruth · a neighbor',
        dialogue: 'A fair count, they said. Most of the town agreed. I suppose that settles it.',
      },
      {
        kind: 'choose',
        prompt: 'Keep the conversation going.',
        actionLabel: 'Reply',
        choices: [
          {
            id: 'numbers',
            label: 'Does having more votes make a decision right?',
            response:
              'The neighbor rubs the fence rail. “It tells us who won. Perhaps that is all.”',
            cue: 'consider',
          },
          {
            id: 'dissent',
            label: 'What can someone do if the town gets it wrong?',
            response:
              '“Speak up, I hope.” The neighbor pauses. “Even when the rest of us are tired of hearing it.”',
            cue: 'consider',
          },
        ],
      },
      {
        kind: 'press',
        prompt:
          'The neighbor makes room beside the fence. Consider the difference between a count and a judgment.',
        actionLabel: 'Consider the argument',
      },
    ],
    completion: 'The count establishes a majority. The passage asks what establishes justice.',
  },
  c03: {
    id: 'c03',
    title: 'At the printing press',
    intro:
      'The printer has inked the type and laid a fresh sheet. One pull will make the impression.',
    steps: [
      {
        kind: 'hold',
        prompt: 'Draw the wooden lever steadily toward you.',
        actionLabel: 'Pull the press lever',
        duration: 1.25,
        speaker: 'Samuel · the printer',
        dialogue: 'A little farther. There—keep the pressure even.',
      },
      {
        kind: 'press',
        prompt: 'Lift the fresh sheet by its dry edge.',
        actionLabel: 'Lift the printed sheet',
        speaker: 'Samuel · the printer',
        dialogue:
          'Mind the ink. A press does only what a hand makes it do. People are another matter.',
      },
    ],
    completion:
      'The impression is clear. Thoreau’s machinery is a metaphor for unthinking service.',
  },
  c04: {
    id: 'c04',
    title: 'The collector’s table',
    intro:
      'Reenact Thoreau’s refusal of the poll tax. This scene follows his decision; it does not score your own political views.',
    steps: [
      {
        kind: 'press',
        prompt: 'Step up to the bill laid on the table.',
        actionLabel: 'Read the bill',
        speaker: 'Mr. Lowell · the collector',
        dialogue: 'The poll tax is still unpaid. Will you settle it today?',
      },
      {
        kind: 'choose',
        prompt: 'The collector waits for your decision.',
        actionLabel: 'Respond to the collector',
        choices: [
          {
            id: 'preview-payment',
            label: 'Set the coin beside the bill',
            response:
              'That would settle the poll tax. Thoreau refused it. The coin remains yours to take back before the collector accepts it.',
            advance: false,
            cue: 'offer-coin',
          },
          {
            id: 'refuse',
            label: 'Keep the coin · refuse the poll tax',
            response:
              'You close your hand. The collector puts down his pen. “Then you must come with me.”',
            cue: 'refuse-tax',
          },
        ],
      },
    ],
    completion: 'The bill remains unpaid. Read why private disapproval is not enough for Thoreau.',
  },
  c05: {
    id: 'c05',
    title: 'The merchant’s ledger',
    intro: 'A ledger lies open on the merchant’s stall. The next page lifts in the wind.',
    steps: [
      {
        kind: 'hold',
        prompt: 'Turn the stiff ledger page, keeping the corner clear of the breeze.',
        actionLabel: 'Turn the ledger page',
        duration: 1.1,
      },
      {
        kind: 'choose',
        prompt: 'Decide what to examine in Thoreau’s refusal.',
        actionLabel: 'Follow the argument',
        speaker: 'Mrs. Bell · the merchant',
        dialogue: 'Are you trying to follow each coin, or asking what your payment agrees to?',
        choices: [
          {
            id: 'trace-coins',
            label: 'Trace exactly where each tax dollar goes',
            response:
              'The ledger cannot prove that. In paragraph 40, Thoreau explicitly declines to trace the course of his dollar. His concern is the effect of his allegiance.',
            advance: false,
            cue: 'study-ledger',
          },
          {
            id: 'allegiance',
            label: 'Ask what support or allegiance he withdraws',
            response:
              'The merchant runs a finger down the margin. “Then the question is what you lend your hand to.”',
            cue: 'close-ledger',
          },
        ],
      },
    ],
    completion:
      'The machine is a metaphor. Read what it means to interrupt your own participation.',
  },
  c06: {
    id: 'c06',
    title: 'The jail threshold',
    intro: 'The jailer waits with a hand on the door. Your refusal has brought you here.',
    steps: [
      {
        kind: 'hold',
        prompt: 'Draw the heavy latch clear. This door leads into the jail.',
        actionLabel: 'Draw the iron latch',
        duration: 1.15,
        speaker: 'Jonas · the jailer',
        dialogue: 'Mind the step. The door catches unless you pull it all the way clear.',
      },
      {
        kind: 'press',
        prompt: 'The latch is clear. Step across the threshold.',
        actionLabel: 'Push the door inward',
      },
    ],
    completion: 'The door gives way. Acting alone does not settle whether an action is right.',
  },
  c07: {
    id: 'c07',
    title: 'The writing desk',
    intro: 'There is a little ink left in the pot. A blank half-sheet rests on the rough desk.',
    steps: [
      {
        kind: 'press',
        prompt: 'Touch the quill to the ink and let the extra drop fall back.',
        actionLabel: 'Dip the quill',
      },
      {
        kind: 'hold',
        prompt: 'Write down the question the cell raises: can doing right put someone in prison?',
        actionLabel: 'Write on the half-sheet',
        duration: 1.35,
      },
    ],
    completion: 'The ink settles into the paper. Read Thoreau’s answer in his own words.',
  },
  c08: {
    id: 'c08',
    title: 'At the barred window',
    intro:
      'A cool strip of air reaches through the window. Outside, the village goes on with its evening.',
    steps: [
      {
        kind: 'press',
        prompt: 'Ease the wooden shutter away from the bars.',
        actionLabel: 'Open the shutter',
        posture: 'window',
      },
      {
        kind: 'hold',
        prompt: 'Listen past the walls for the village bell.',
        actionLabel: 'Listen at the window',
        duration: 1.4,
        posture: 'window',
      },
    ],
    completion:
      'The window holds your body inside. The passage considers what the walls cannot hold.',
  },
  c09: {
    id: 'c09',
    title: 'The cell’s narrow bed',
    intro: 'The straw mattress creaks when you press it. The key has turned in the lock.',
    steps: [
      {
        kind: 'press',
        prompt: 'Sit on the edge of the bed. There is nothing here to force open.',
        actionLabel: 'Sit on the bed',
        posture: 'sit',
      },
      {
        kind: 'choose',
        prompt: 'The locked door proves the state can confine you. What does it leave unresolved?',
        actionLabel: 'Consider the locked door',
        posture: 'sit',
        choices: [
          {
            id: 'strength',
            label: 'Whether strength makes its argument true',
            response: 'The lock stays shut. Its strength has not answered the argument.',
            cue: 'reflect',
          },
          {
            id: 'conscience',
            label: 'Whether force can change someone’s conscience',
            response:
              'You can be made to stay in a room. Believing the state is right is another matter.',
            cue: 'reflect',
          },
        ],
      },
    ],
    completion: 'Read the distinction Thoreau makes between force and moral authority.',
  },
  c10: {
    id: 'c10',
    title: 'The morning newspaper',
    intro: 'A newspaper lies beside the road. Its folded edge is damp with dew.',
    steps: [
      {
        kind: 'hold',
        prompt: 'Separate the damp pages without tearing the corner.',
        actionLabel: 'Unfold the newspaper',
        duration: 1,
      },
      {
        kind: 'press',
        prompt: 'Hold the page flat and read the argument for reform.',
        actionLabel: 'Smooth the page',
      },
    ],
    completion: 'Read the practical demand: a better government now.',
  },
  c11: {
    id: 'c11',
    title: 'The river bench',
    intro: 'The bridge boards knock under passing feet. There is room to sit beside the water.',
    steps: [
      {
        kind: 'press',
        prompt: 'Take the empty place on the bench.',
        actionLabel: 'Sit by the river',
        posture: 'sit',
      },
      {
        kind: 'hold',
        prompt: 'Watch the current beneath the bridge for a moment.',
        actionLabel: 'Watch the water',
        duration: 1.25,
        posture: 'sit',
      },
    ],
    completion: 'Roads, bridges, neighbors: read why Thoreau still accepts communal duties.',
  },
  c12: {
    id: 'c12',
    title: 'A letter on the road home',
    intro: 'A folded letter waits in the roadside box. The flap has been tucked in, not sealed.',
    steps: [
      {
        kind: 'hold',
        prompt: 'Lift the sticking lid and take out the folded letter.',
        actionLabel: 'Open the letterbox',
        duration: 1.05,
      },
      {
        kind: 'press',
        prompt:
          'Open the letter. A neighbor asks what a government must earn from the people it governs.',
        actionLabel: 'Unfold the letter',
      },
    ],
    completion: 'Carry that question home. Read where Thoreau locates a just state’s authority.',
  },
};

export type InteractionState = {
  id: string;
  /** Zero-based; a completed scene stays on its final step. */
  step: number;
  progress: number;
  holding: boolean;
  complete: boolean;
  cancelled: boolean;
  response: string | null;
  cue: string | null;
};

export type InteractionAction =
  | { type: 'hold'; pressed: boolean }
  | { type: 'tick' }
  | { type: 'press' }
  | { type: 'choose'; choiceId: string }
  | { type: 'cancel' };

export function startInteraction(id: string): InteractionState {
  if (!interactionDefs[id]) throw new RangeError(`Unknown Concord interaction: ${id}`);
  return {
    id,
    step: 0,
    progress: 0,
    holding: false,
    complete: false,
    cancelled: false,
    response: null,
    cue: null,
  };
}

function nextStep(state: InteractionState): InteractionState {
  const complete = state.step === interactionDefs[state.id].steps.length - 1;
  return {
    ...state,
    step: complete ? state.step : state.step + 1,
    progress: complete ? 1 : 0,
    holding: false,
    complete,
  };
}

/** No wall clock or side effects: a caller unlocks the source only after complete becomes true. */
export function advanceInteraction(
  state: InteractionState,
  action: InteractionAction,
  dt = 0,
): InteractionState {
  if (state.complete || state.cancelled) return state;
  if (action.type === 'cancel') {
    return { ...state, cancelled: true, holding: false, progress: 0 };
  }

  const step = interactionDefs[state.id]?.steps[state.step];
  if (!step) return state;

  if (action.type === 'hold' && step.kind === 'hold') {
    return {
      ...state,
      holding: action.pressed,
      progress: action.pressed ? state.progress : 0,
    };
  }
  if (action.type === 'tick' && step.kind === 'hold' && state.holding) {
    if (!Number.isFinite(dt) || dt <= 0) return state;
    const progress = Math.min(1, state.progress + dt / (step.duration ?? 1.2));
    return progress >= 1 ? nextStep({ ...state, progress }) : { ...state, progress };
  }
  if (action.type === 'press' && step.kind === 'press') return nextStep(state);
  if (action.type === 'choose' && step.kind === 'choose') {
    const choice = step.choices?.find((option) => option.id === action.choiceId);
    if (!choice) return state;
    const answered = { ...state, response: choice.response, cue: choice.cue ?? null };
    return choice.advance === false ? answered : nextStep(answered);
  }
  return state;
}
