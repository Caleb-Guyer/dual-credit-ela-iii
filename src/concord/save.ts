export const SAVE_KEY = 'ela-iii-concord-v1';
export type ConcordSave = {
  version: 1;
  act: number;
  collected: string[];
  debates: number[];
  completed: boolean;
  mastery: Record<string, { seen: number; correct: number; streak: number }>;
  missed: string[];
  exams: { score: number; total: number; date: string }[];
  music: boolean;
  reduced: boolean;
};
export const freshSave = (): ConcordSave => ({
  version: 1,
  act: 0,
  collected: [],
  debates: [],
  completed: false,
  mastery: {},
  missed: [],
  exams: [],
  music: false,
  reduced:
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
});
const integer = (value: unknown, max: number) =>
  typeof value === 'number' && Number.isInteger(value) ? Math.min(max, Math.max(0, value)) : 0;
export function parseSave(raw: string | null): ConcordSave {
  const save = freshSave();
  try {
    const v = JSON.parse(raw ?? 'null');
    if (v?.version !== 1) return save;
    save.act = integer(v.act, 3);
    save.collected = Array.isArray(v.collected)
      ? [
          ...new Set<string>(
            v.collected.filter(
              (id: unknown) => typeof id === 'string' && /^c(0[1-9]|1[0-2])$/.test(id),
            ),
          ),
        ]
      : [];
    save.debates = Array.isArray(v.debates)
      ? [
          ...new Set<number>(
            v.debates.filter(
              (id: unknown) => Number.isInteger(id) && Number(id) >= 0 && Number(id) <= 3,
            ),
          ),
        ]
      : [];
    save.completed = v.completed === true && save.debates.length === 4;
    if (v.mastery && typeof v.mastery === 'object') {
      for (const [id, value] of Object.entries(v.mastery)) {
        if (!/^q\d{2,3}$/.test(id) || !value || typeof value !== 'object') continue;
        const m = value as Record<string, unknown>;
        const seen = integer(m.seen, 100000);
        save.mastery[id] = {
          seen,
          correct: Math.min(seen, integer(m.correct, 100000)),
          streak: Math.min(seen, integer(m.streak, 100000)),
        };
      }
    }
    save.missed = Array.isArray(v.missed)
      ? [
          ...new Set<string>(
            v.missed.filter((id: unknown) => typeof id === 'string' && /^q\d{2,3}$/.test(id)),
          ),
        ]
      : [];
    save.exams = Array.isArray(v.exams)
      ? v.exams
          .filter((e: unknown) => {
            const exam = e as { score?: number; total?: number; date?: string } | null;
            return (
              exam &&
              Number.isInteger(exam.score) &&
              Number.isInteger(exam.total) &&
              Number(exam.total) > 0 &&
              Number(exam.score) >= 0 &&
              Number(exam.score) <= Number(exam.total) &&
              typeof exam.date === 'string' &&
              !Number.isNaN(Date.parse(exam.date))
            );
          })
          .slice(-20)
      : [];
    if (typeof v.music === 'boolean') save.music = v.music;
    if (typeof v.reduced === 'boolean') save.reduced = v.reduced;
  } catch {
    /* A corrupt or unavailable save starts a new journey safely. */
  }
  return save;
}
export function readSave(): ConcordSave {
  try {
    return parseSave(localStorage.getItem(SAVE_KEY));
  } catch {
    return freshSave();
  }
}
