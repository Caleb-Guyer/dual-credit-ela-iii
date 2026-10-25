import type { CharacterConversation, CharacterRole } from './characters';

export type FaceExpression = 'neutral' | 'curious' | 'thoughtful' | 'warm' | 'doubtful';
type Rotation = [number, number, number];
export type ConversationPerformance = {
  expression: FaceExpression;
  intensity: number;
  openness: number;
  blink: number;
  gazeX: number;
  gazeY: number;
  headPitch: number;
  headYaw: number;
  headRoll: number;
  lean: number;
  shift: number;
  leftArm: Rotation;
  rightArm: Rotation;
  leftForearm: Rotation;
  rightForearm: Rotation;
  gesture: string;
};

const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));
const hash = (n: number) => {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};
const pulse = (time: number, start: number, duration: number) => {
  const progress = (time - start) / duration;
  return progress <= 0 || progress >= 1 ? 0 : Math.sin(progress * Math.PI) ** 2;
};
const ease = (time: number, start: number, end: number) => {
  const progress = clamp((time - start) / (end - start));
  return progress * progress * (3 - 2 * progress);
};

/** Blink gaps vary by person and cycle; a glance never becomes a shared clockwork loop. */
export function characterBlink(time: number, seed: number, reduced: boolean) {
  if (reduced) return 1;
  const cycle = Math.floor(Math.max(0, time + seed * 0.63) / 6.7);
  const local = (Math.max(0, time + seed * 0.63) % 6.7) - (1.1 + hash(seed + cycle) * 3.9);
  const closing = pulse(local, 0, 0.17);
  const second = hash(seed * 3 + cycle) > 0.78 ? pulse(local, 0.25, 0.14) : 0;
  return 1 - Math.max(closing, second) * 0.98;
}

const personalities: Record<CharacterRole, { amplitude: number; pace: number; tilt: number }> = {
  neighbor: { amplitude: 1, pace: 1.02, tilt: 0.035 },
  collector: { amplitude: 0.64, pace: 0.86, tilt: 0.014 },
  jailer: { amplitude: 0.48, pace: 0.8, tilt: 0.02 },
  walker: { amplitude: 0.87, pace: 0.92, tilt: 0.04 },
  printer: { amplitude: 0.82, pace: 1, tilt: 0.025 },
  merchant: { amplitude: 0.74, pace: 0.95, tilt: 0.026 },
};

/**
 * Small authored acting beats, sampled without frame counters or random state.
 * Words shape the jaw; clauses shape the hands; the listener gets space between gestures.
 */
export function sampleConversationPerformance(
  role: CharacterRole,
  seed: number,
  conversation: CharacterConversation,
  reduced: boolean,
): ConversationPerformance {
  const { phase, beat, speaking } = conversation;
  const t = Math.max(0, conversation.elapsed);
  const personality = personalities[role];
  const strength = personality.amplitude;
  const phaseSeed = seed * 0.71 + beat * 1.37;
  const result: ConversationPerformance = {
    expression:
      phase === 'agree' || phase === 'farewell'
        ? 'warm'
        : phase === 'disagree'
          ? 'doubtful'
          : phase === 'considering'
            ? 'thoughtful'
            : 'curious',
    intensity: phase === 'listening' ? 0.52 : phase === 'considering' ? 0.72 : 0.85,
    openness: 0,
    blink: characterBlink(t, seed + beat * 0.2, reduced),
    gazeX: 0,
    gazeY: 0.08,
    headPitch: -0.025,
    headYaw: 0,
    headRoll: (role === 'collector' ? -0.4 : 1) * personality.tilt,
    lean: 0,
    shift: 0,
    leftArm: [-0.16, 0.04, 0.1],
    rightArm: [-0.2, -0.04, -0.1],
    leftForearm: [-0.35, 0, 0],
    rightForearm: [-0.4, 0, 0],
    gesture: 'rest',
  };

  if (role === 'collector') {
    result.leftArm = [-0.27, 0.04, 0.12];
    result.leftForearm = [-0.8, 0.08, 0];
  }
  if (!reduced) {
    // Most of a listening turn is stillness, with one acknowledgment and a brief glance.
    const glanceCycle = Math.floor(t / 8.9);
    const glance = pulse(t % 8.9, 2.6 + hash(phaseSeed + glanceCycle) * 2.1, 1.2);
    const acknowledgment = pulse(t, 0.5 + hash(phaseSeed + 1) * 0.4, 0.85);
    result.gazeX = (hash(phaseSeed + glanceCycle + 2) > 0.5 ? 1 : -1) * glance * 0.22;
    result.gazeY -= glance * 0.22;
    result.headPitch += acknowledgment * 0.025;
    result.headRoll += Math.sin(t * 0.63 + phaseSeed) * 0.009;
    result.shift = Math.sin(t * 0.43 + phaseSeed) * 0.004;
  }

  if (speaking) {
    const text = conversation.text ?? '';
    const count = clamp(Math.floor(conversation.revealed ?? t * 38), 0, text.length || Infinity);
    const letter = text[Math.max(0, count - 1)]?.toLowerCase() ?? 'a';
    const punctuation = /[.,!?;:—]/.test(letter);
    const vowel = /[aeiouy]/.test(letter);
    const jaw = vowel ? 0.55 : /\s/.test(letter) ? 0.1 : 0.28;
    result.openness = reduced || punctuation ? 0 : clamp(jaw + Math.sin(t * 17 + phaseSeed) * 0.16);
    const cycle = reduced ? 0 : Math.floor((t * personality.pace) / 3.3);
    const local = (t * personality.pace) % 3.3;
    const gesture = reduced ? 0.38 : pulse(local, 0.35, 1.75);
    const accent = reduced ? 0 : pulse(local, 1.1, 0.56) * 0.2;
    const hand = (Math.floor(hash(phaseSeed + cycle) * 10) + beat) % 3;
    const amount = gesture * strength;
    const leading = hand === 1 ? result.leftArm : result.rightArm;
    const forearm = hand === 1 ? result.leftForearm : result.rightForearm;
    const side = hand === 1 ? 1 : -1;
    leading[0] -= amount * (0.47 + accent);
    leading[1] = side * amount * 0.16;
    leading[2] += side * amount * 0.29;
    forearm[0] -= amount * 0.76;
    forearm[1] = side * amount * 0.35;
    forearm[2] = side * amount * 0.17;
    if (hand === 2 && role !== 'collector' && role !== 'jailer') {
      result.leftArm[0] -= amount * 0.28;
      result.leftArm[2] += amount * 0.2;
      result.leftForearm[0] -= amount * 0.43;
      result.leftForearm[1] = amount * 0.25;
    }
    result.gesture = amount > 0.07 ? (hand === 2 ? 'open-hands' : 'offer') : 'rest';
    result.headPitch -= amount * 0.035;
    result.headRoll += side * amount * 0.02;
    result.lean = amount * 0.018;
    if (!reduced && punctuation) result.openness = 0;
  }

  if (phase === 'considering' && !speaking) {
    result.gesture = role === 'collector' || role === 'jailer' ? 'weighing' : 'reflect';
    result.gazeY = -0.35;
    result.headPitch = 0.045;
    result.headRoll = -personality.tilt * 0.8;
    result.rightArm = [-0.74, -0.08, -0.23];
    result.rightForearm = [-1.55, 0.18, -0.12];
    result.leftForearm = [-0.72, 0.07, 0];
    result.lean = 0.012;
    // Read alongside the player, then meet their eyes again without staring at the paper forever.
    const returnLook = reduced ? 0 : ease(t, 2.2, 3.8);
    const glanceCycle = Math.floor(t / 9.3);
    const lookBack = reduced ? 0 : pulse(t % 9.3, 5.3 + hash(phaseSeed + glanceCycle) * 1.4, 1.7);
    result.gazeY += returnLook * 0.39 - lookBack * 0.28;
    result.headPitch -= returnLook * 0.035 - lookBack * 0.02;
  } else if (phase === 'agree') {
    const nod = reduced ? 0 : pulse(t, 0.12, 0.62) * 0.095 - pulse(t, 0.74, 0.6) * 0.025;
    result.headPitch += nod;
    result.headRoll *= 0.5;
    result.lean += 0.012;
    if (!speaking) {
      result.rightArm = [-0.26, -0.03, -0.18];
      result.rightForearm = [-0.55, -0.14, -0.04];
    }
    result.gesture = t < 1.4 && !reduced ? 'nod' : speaking ? result.gesture : 'settled';
  } else if (phase === 'disagree') {
    const shake = reduced ? 0 : pulse(t, 0.15, 0.48) * 0.095 - pulse(t, 0.63, 0.62) * 0.085;
    result.headYaw += shake;
    result.headRoll = -personality.tilt;
    result.lean -= 0.007;
    // An open palm offers a correction; nobody scolds the player with an accusing finger.
    if (!speaking) {
      result.leftArm = [-0.32, 0.12, 0.22];
      result.leftForearm = [-0.65, 0.3, 0.07];
    }
    result.gesture = t < 1.3 && !reduced ? 'gentle-shake' : speaking ? result.gesture : 'invite';
  } else if (phase === 'farewell') {
    const wave = reduced ? 0.38 : pulse(t, 0.15, 2.1);
    result.rightArm = [-0.2 - wave * 0.65, -0.03, -0.1 - wave * 0.34];
    result.rightForearm = [
      -0.4 - wave * 0.9,
      -wave * 0.15,
      reduced ? -0.08 : Math.sin(t * 7.5) * wave * 0.14,
    ];
    result.headPitch += reduced ? 0.025 : pulse(t, 0.35, 0.85) * 0.05;
    result.gesture =
      wave > 0.04
        ? role === 'collector' || role === 'jailer'
          ? 'acknowledge'
          : 'farewell'
        : 'settled';
  }

  return result;
}
