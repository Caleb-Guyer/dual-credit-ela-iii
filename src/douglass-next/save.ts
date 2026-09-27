import { missions, questions, type Chapter } from './data';
export const SAVE_KEY = 'ela-iii-douglass-4-8-v1';
export interface Progress {
  stage: number;
  completed: boolean;
  best: number;
  attempts: number;
}
export interface Save {
  version: 1;
  chapters: Record<number, Progress>;
  missed: string[];
  music: boolean;
  voice: boolean;
  reduced: boolean;
  sensitivity: number;
  autoplay: boolean;
}
export const freshSave = (): Save => ({
  version: 1,
  chapters: Object.fromEntries(
    missions.map((m) => [m.id, { stage: 0, completed: false, best: 0, attempts: 0 }]),
  ),
  missed: [],
  music: true,
  voice: true,
  reduced:
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  sensitivity: 1,
  autoplay: true,
});
export function parseSave(raw: string | null): Save {
  const fresh = freshSave();
  try {
    const value = JSON.parse(raw ?? 'null');
    if (value?.version !== 1) return fresh;
    for (const m of missions) {
      const p = value.chapters?.[m.id];
      if (!p) continue;
      fresh.chapters[m.id] = {
        stage: Number.isInteger(p.stage) ? Math.max(0, Math.min(4, p.stage)) : 0,
        completed: p.completed === true,
        best: Number.isFinite(p.best) ? Math.max(0, Math.min(5, Math.floor(p.best))) : 0,
        attempts: Number.isInteger(p.attempts) ? Math.max(0, p.attempts) : 0,
      };
    }
    fresh.missed = Array.isArray(value.missed)
      ? [
          ...new Set<string>(
            value.missed.filter((id: unknown) => questions.some((q) => q.id === id)),
          ),
        ]
      : [];
    for (const flag of ['music', 'voice', 'reduced', 'autoplay'] as const)
      if (typeof value[flag] === 'boolean') fresh[flag] = value[flag];
    fresh.sensitivity = Number.isFinite(value.sensitivity)
      ? Math.max(0.4, Math.min(2, value.sensitivity))
      : 1;
    return fresh;
  } catch {
    return fresh;
  }
}
export function readSave(): Save {
  try {
    return parseSave(localStorage.getItem(SAVE_KEY));
  } catch {
    return freshSave();
  }
}
export function recordResult(
  save: Save,
  chapter: Chapter,
  correct: number,
  seen: string[],
  missed: string[],
): Save {
  const previous = save.chapters[chapter];
  return {
    ...save,
    chapters: {
      ...save.chapters,
      [chapter]: {
        ...previous,
        stage: 4,
        completed: true,
        best: Math.max(previous.best, correct),
        attempts: previous.attempts + 1,
      },
    },
    missed: [...new Set([...save.missed.filter((id) => !seen.includes(id)), ...missed])],
  };
}
