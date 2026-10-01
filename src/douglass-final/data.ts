import content from './content.json' with { type: 'json' };
import source from './source.json' with { type: 'json' };
import type { Chapter, Mission, Question, Ref } from '../douglass-next/data';
export type { Chapter, Mission, Question, Ref, Point } from '../douglass-next/data';
export const missions = content.missions as unknown as Mission[];
export const questions = content.questions as Question[];
export { source };
export const passage = (ref: Ref) =>
  source.chapters.flatMap((c) => c.paragraphs).find((p) => p.ref === ref)?.text ?? '';
export function shuffleQuestions(pool: Question[], random = Math.random): Question[] {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.map((q) => {
    const options = q.choices.map((text, i) => ({ text, correct: i === q.answer }));
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return {
      ...q,
      choices: options.map((o) => o.text),
      answer: options.findIndex((o) => o.correct),
    };
  });
}
export const chapterQuestions = (chapter: Chapter, random = Math.random) =>
  shuffleQuestions(
    questions.filter((q) => q.chapter === chapter),
    random,
  ).slice(0, 5);
/** Balanced main-idea exam: five questions from each of the four sections. */
export const finalExam = (random = Math.random) =>
  shuffleQuestions(
    missions.flatMap((m) => chapterQuestions(m.id, random)),
    random,
  );
