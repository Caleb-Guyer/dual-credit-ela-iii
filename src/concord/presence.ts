export type CharacterAttention = {
  /** The world chooses one nearby person the player is actually looking at. */
  focused: boolean;
  familiar?: boolean;
};

export type PresenceState = {
  time: number;
  attention: number;
  engaged: boolean;
  seen: boolean;
  heard: boolean;
  focusTime: number;
  awayTime: number;
  greeted: boolean;
  greetingAt: number | null;
  lastGreetingAt: number;
};

export type PresenceInput = {
  /** Simulation time at the end of this update; paused updates have dt zero. */
  time: number;
  dt: number;
  distance: number;
  /** The angle from the person's ordinary working direction to the player, in radians. */
  facing: number;
  focused: boolean;
  interacting: boolean;
};

export const PRESENCE = {
  distance: 4.2,
  peripheralAngle: 1.75,
  hearingDistance: 1.6,
  greetingDelay: 0.25,
  greetingDuration: 1.6,
  attentionGrace: 0.8,
  rearmAbsence: 3,
  greetingCooldown: 18,
} as const;

export function createPresence(time = 0): PresenceState {
  return {
    time,
    attention: 0,
    engaged: false,
    seen: false,
    heard: false,
    focusTime: 0,
    awayTime: 0,
    greeted: false,
    greetingAt: null,
    lastGreetingAt: time - PRESENCE.greetingCooldown,
  };
}

/** A greeting is earned by an approach, never by another rendering frame. */
export function advancePresence(state: PresenceState, input: PresenceInput): PresenceState {
  const dt = Number.isFinite(input.dt) ? Math.max(0, input.dt) : 0;
  if (dt === 0) return state;
  const time = Number.isFinite(input.time) ? Math.max(state.time, input.time) : state.time + dt;
  const angle = Math.atan2(Math.sin(input.facing), Math.cos(input.facing));
  const seen =
    input.focused &&
    input.distance < PRESENCE.distance &&
    Math.abs(angle) < PRESENCE.peripheralAngle;
  // Footsteps very close behind earn a small glance, not eyes in the back of a head.
  const heard = input.focused && !seen && input.distance < PRESENCE.hearingDistance;
  const noticed = seen || heard;
  const focusTime = seen && !input.interacting ? state.focusTime + dt : 0;
  const awayTime = noticed || input.interacting ? 0 : state.awayTime + dt;
  const engaged =
    noticed || input.interacting || (state.engaged && awayTime < PRESENCE.attentionGrace);
  const target = input.interacting ? 1 : seen ? 1 : heard ? 0.28 : engaged ? state.attention : 0;
  const decayTime =
    Math.max(0, awayTime - PRESENCE.attentionGrace) -
    Math.max(0, state.awayTime - PRESENCE.attentionGrace);
  const attention =
    noticed || input.interacting
      ? target + (state.attention - target) * Math.exp(-dt * 4.3)
      : state.attention * Math.exp(-Math.max(0, decayTime) * 4.3);
  let greeted = state.greeted;
  let greetingAt = state.greetingAt;
  let lastGreetingAt = state.lastGreetingAt;
  if (input.interacting) {
    // A conversation already is an acknowledgment. Do not greet again when it closes.
    greeted = true;
    greetingAt = null;
    lastGreetingAt = time;
  } else {
    if (awayTime >= PRESENCE.rearmAbsence && time - lastGreetingAt >= PRESENCE.greetingCooldown)
      greeted = false;
    if (
      seen &&
      !greeted &&
      focusTime >= PRESENCE.greetingDelay &&
      time - lastGreetingAt >= PRESENCE.greetingCooldown
    ) {
      // Preserve the threshold's exact time even when a slow frame crossed it.
      greetingAt = Math.max(state.time, time - (focusTime - PRESENCE.greetingDelay));
      lastGreetingAt = greetingAt;
      greeted = true;
    }
    if (greetingAt !== null && time - greetingAt >= PRESENCE.greetingDuration) greetingAt = null;
  }
  return {
    time,
    attention,
    engaged,
    seen,
    heard,
    focusTime,
    awayTime,
    greeted,
    greetingAt,
    lastGreetingAt,
  };
}

/** One quiet nod/open hand, with an eased beginning and end. */
export function samplePresenceGreeting(state: PresenceState, time: number, reduced: boolean) {
  if (reduced || state.greetingAt === null) return 0;
  const elapsed = (time - state.greetingAt) / PRESENCE.greetingDuration;
  return elapsed <= 0 || elapsed >= 1 ? 0 : Math.sin(elapsed * Math.PI) ** 2;
}
