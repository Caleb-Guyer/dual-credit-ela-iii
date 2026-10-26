import { townSites } from './town-layout';

export type TownId = keyof typeof townSites;
export type TownMemory = { gate: boolean; shutter: boolean };
export type TownView = { x: number; z: number; y?: number; yaw: number; pitch?: number };
export type TownActivity = {
  id: TownId;
  title: string;
  label: string;
  x: number;
  z: number;
  height: number;
  reach: number;
  kind: 'hold' | 'press';
  /** Seconds of uninterrupted holding; for a bell this is its short response/cooldown window. */
  duration: number;
  approach: { x: number; z: number; yaw: number };
};

/** Optional pieces of fictional village life, independent of the twelve reading discoveries. */
export const townActivityDefs = {
  pump: {
    id: 'pump',
    title: 'The town pump',
    label: 'Pump water',
    ...townSites.pump,
    reach: 1.85,
    kind: 'hold',
    duration: 1.2,
  },
  bell: {
    id: 'bell',
    title: 'The bookbinder’s shop',
    label: 'Ring shop bell',
    ...townSites.bell,
    reach: 1.85,
    kind: 'press',
    duration: 0.9,
  },
  gate: {
    id: 'gate',
    title: 'The side garden',
    label: 'Open garden gate',
    ...townSites.gate,
    reach: 1.85,
    kind: 'hold',
    duration: 0.85,
  },
  shutter: {
    id: 'shutter',
    title: 'The cooper’s workshop',
    label: 'Open workshop shutters',
    ...townSites.shutter,
    reach: 1.85,
    kind: 'hold',
    duration: 1.05,
  },
} satisfies Record<TownId, TownActivity>;

export const townActivities: readonly TownActivity[] = Object.values(townActivityDefs);

export const freshTownMemory = (): TownMemory => ({ gate: false, shutter: false });

export type TownInteraction = {
  id: TownId;
  progress: number;
  holding: boolean;
  complete: boolean;
  cancelled: boolean;
  /** The intended settled state of a gate or shutter, not its current hinge angle. */
  opening: boolean;
};

export type TownAction =
  { type: 'hold'; pressed: boolean } | { type: 'tick' } | { type: 'press' } | { type: 'cancel' };

export function startTownInteraction(id: TownId, memory: TownMemory): TownInteraction {
  if (!townActivityDefs[id]) throw new RangeError(`Unknown Concord town activity: ${id}`);
  return {
    id,
    progress: 0,
    holding: false,
    complete: false,
    cancelled: false,
    opening: id === 'gate' || id === 'shutter' ? !memory[id] : true,
  };
}

/** No timers or side effects: the world releases holds on blur, pause, or stepping away. */
export function advanceTownInteraction(
  state: TownInteraction,
  action: TownAction,
  dt = 0,
): TownInteraction {
  if (state.complete || state.cancelled) return state;
  if (action.type === 'cancel') return { ...state, progress: 0, holding: false, cancelled: true };
  const activity = townActivityDefs[state.id];
  if (action.type === 'press' && activity.kind === 'press')
    return { ...state, progress: 1, holding: false, complete: true };
  if (action.type === 'hold' && activity.kind === 'hold') {
    if (action.pressed === state.holding && (action.pressed || state.progress === 0)) return state;
    return { ...state, holding: action.pressed, progress: action.pressed ? state.progress : 0 };
  }
  if (action.type !== 'tick' || activity.kind !== 'hold' || !state.holding) return state;
  if (!Number.isFinite(dt) || dt <= 0) return state;
  const progress = Math.min(1, state.progress + dt / activity.duration);
  return progress >= 1
    ? { ...state, progress: 1, holding: false, complete: true }
    : { ...state, progress };
}

/** Only a finished physical action changes a persistent hinge. Reading progress is untouched. */
export function applyTownInteraction(memory: TownMemory, state: TownInteraction): TownMemory {
  if (!state.complete || state.cancelled || (state.id !== 'gate' && state.id !== 'shutter'))
    return memory;
  if (memory[state.id] === state.opening) return memory;
  return { ...memory, [state.id]: state.opening };
}

export function townActionLabel(id: TownId, memory: TownMemory): string {
  if (id === 'gate') return memory.gate ? 'Close garden gate' : 'Open garden gate';
  if (id === 'shutter')
    return memory.shutter ? 'Close workshop shutters' : 'Open workshop shutters';
  return townActivityDefs[id].label;
}

export function townInteractionLabel(state: TownInteraction): string {
  return townActionLabel(state.id, {
    gate: state.id === 'gate' ? !state.opening : false,
    shutter: state.id === 'shutter' ? !state.opening : false,
  });
}

export function townInteractionPrompt(state: TownInteraction): string {
  if (state.id === 'pump') return 'Work the handle steadily to draw water into the trough.';
  if (state.id === 'bell') return 'Give the little brass bell a short pull.';
  if (state.id === 'gate')
    return state.opening
      ? 'Lift the latch and ease the gate into the garden.'
      : 'Bring the gate back gently until the latch catches.';
  return state.opening
    ? 'Unhook the catch and fold back the workshop shutters.'
    : 'Draw the shutters together and settle the catch.';
}

export function townInteractionCompletion(state: TownInteraction): string {
  if (!state.complete) return '';
  if (state.id === 'pump') return 'Water splashes from the spout. The little trough ripples.';
  if (state.id === 'bell') return 'A clear note carries down the street. A curtain stirs inside.';
  if (state.id === 'gate')
    return state.opening
      ? 'The hinge gives. A quiet garden opens beyond the street.'
      : 'The gate settles against its post with a soft wooden click.';
  return state.opening
    ? 'Lamplight catches a workbench, tools, and a barrel still taking shape.'
    : 'The workshop disappears behind the shutters. A thin line of light remains.';
}

/** Optional objects respond to nearby, deliberate attention rather than distant markers. */
export function nearestTownActivity(act: number, view: TownView): TownActivity | null {
  if (!Number.isInteger(act) || act < 0 || act > 3 || act === 2) return null;
  if (![view.x, view.z, view.yaw, view.pitch ?? 0, view.y ?? 1.68].every(Number.isFinite))
    return null;
  let closest: TownActivity | null = null,
    bestScore = Infinity;
  for (const activity of townActivities) {
    const dx = activity.x - view.x,
      dz = activity.z - view.z;
    const distance = Math.hypot(dx, dz);
    if (distance > activity.reach) continue;
    const bearing = Math.atan2(dx, -dz) + view.yaw;
    const horizontal = Math.abs(Math.atan2(Math.sin(bearing), Math.cos(bearing)));
    const vertical = Math.abs(
      Math.atan2(activity.height - (view.y ?? 1.68), Math.max(0.01, distance)) - (view.pitch ?? 0),
    );
    // At arm's reach the object fills more of the view; a latch should not vanish beneath the eye.
    const verticalTolerance = Math.min(1.15, 0.65 + Math.max(0, 0.9 - distance) * 0.8);
    if (horizontal > 0.7 || vertical > verticalTolerance) continue;
    const score = distance + horizontal * 0.45 + vertical * 0.2;
    if (score < bestScore) {
      closest = activity;
      bestScore = score;
    }
  }
  return closest;
}
