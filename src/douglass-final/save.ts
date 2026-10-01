import { missions, questions, type Chapter } from './data';
import type { Save } from '../douglass-next/save';
export type { Save } from '../douglass-next/save';
export const SAVE_KEY = 'ela-iii-douglass-9-end-v1';
export const freshSave = (): Save => ({
  version: 1,
  chapters: Object.fromEntries(
    missions.map((m) => [m.id, { stage: 0, completed: false, best: 0, attempts: 0 }]),
  ),
  missed: [],
  examScores: [],
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
    const v = JSON.parse(raw ?? 'null');
    if (v?.version !== 1) return fresh;
    for (const m of missions) {
      const p = v.chapters?.[m.id];
      if (!p) continue;
      fresh.chapters[m.id] = {
        stage: Number.isInteger(p.stage) ? Math.max(0, Math.min(m.stages.length, p.stage)) : 0,
        completed: p.completed === true,
        best: Number.isFinite(p.best) ? Math.max(0, Math.min(5, Math.floor(p.best))) : 0,
        attempts: Number.isInteger(p.attempts) ? Math.max(0, p.attempts) : 0,
      };
    }
    fresh.missed = Array.isArray(v.missed)
      ? [...new Set<string>(v.missed.filter((id: unknown) => questions.some((q) => q.id === id)))]
      : [];
    fresh.examScores = Array.isArray(v.examScores)
      ? v.examScores
          .filter((s: unknown) => Number.isInteger(s) && Number(s) >= 0 && Number(s) <= 20)
          .slice(-20)
      : [];
    for (const flag of ['music', 'voice', 'reduced', 'autoplay'] as const)
      if (typeof v[flag] === 'boolean') fresh[flag] = v[flag];
    fresh.sensitivity = Number.isFinite(v.sensitivity)
      ? Math.max(0.4, Math.min(2, v.sensitivity))
      : 1;
  } catch {
    return fresh;
  }
  return fresh;
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
  const p = save.chapters[chapter],
    m = missions.find((m) => m.id === chapter)!;
  return {
    ...save,
    chapters: {
      ...save.chapters,
      [chapter]: {
        ...p,
        stage: m.stages.length,
        completed: true,
        best: Math.max(p.best, correct),
        attempts: p.attempts + 1,
      },
    },
    missed: [...new Set([...save.missed.filter((id) => !seen.includes(id)), ...missed])],
  };
}
