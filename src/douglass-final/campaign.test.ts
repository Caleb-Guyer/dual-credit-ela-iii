import { describe, it, expect } from 'vitest';
import {
  missions,
  questions,
  source,
  passage,
  chapterQuestions,
  finalExam,
  type Point,
} from './data';
import { freshSave, parseSave, recordResult, SAVE_KEY } from './save';
import { AdventureEngine, distance } from '../douglass-next/engine';
import { inBeatWindow } from '../douglass-next/Rhythm';
import manifest from '../douglass-next/voice-manifest.json' with { type: 'json' };
import { voiceKey } from '../douglass-next/voice';
describe('The final act: primary text and campaign', () => {
  it('includes every chapter through THE END, including the entire Appendix', () => {
    expect(source.chapters.map((c) => [c.chapter, c.paragraphs.length])).toEqual([
      [9, 6],
      [10, 50],
      [11, 22],
      [12, 12],
    ]);
    expect(passage('12.12')).toBe('THE END');
    expect(passage('12.11')).toContain('April 28, 1845');
    expect(JSON.stringify(source)).not.toContain('\ufffd');
    expect(missions.map((m) => m.stages.length)).toEqual([4, 8, 6, 3]);
    expect(missions[3].label).toBe('Appendix');
  });
  it('has distinct questions and valid source references on all narration and questions', () => {
    expect(questions).toHaveLength(42);
    expect(new Set(questions.map((q) => q.prompt)).size).toBe(42);
    const refs = new Set(source.chapters.flatMap((c) => c.paragraphs.map((p) => p.ref)));
    for (const m of missions)
      for (const s of m.stages) {
        expect(s.lines.length).toBeGreaterThan(0);
        expect(s.scene).toBeTruthy();
        for (const l of s.lines) {
          expect(l.refs.length).toBeGreaterThan(0);
          l.refs.forEach((r) => expect(refs.has(r), r).toBe(true));
          if (l.exact) expect(l.refs.map(passage).join(' ')).toContain(l.text);
        }
      }
    for (const q of questions) {
      expect(new Set(q.choices).size).toBe(4);
      expect(q.choices[q.answer]).toBeTruthy();
      q.refs.forEach((r) => expect(refs.has(r), r).toBe(true));
    }
  });
  it('preserves the withheld escape route and treats the root as a belief', () => {
    expect(missions[2].stages[0].lines[1].text).toContain('do not reveal the route');
    expect(missions[1].stages[2].lines[1].text).toContain('does not prove magic');
    expect(missions[3].stages[0].lines[0].text).toContain('not condemning every religion');
  });
  it('balances the final exam and keeps correct answers when shuffling', () => {
    const exam = finalExam(() => 0.23);
    expect(exam).toHaveLength(20);
    expect(new Set(exam.map((q) => q.id)).size).toBe(20);
    for (const m of missions) {
      expect(exam.filter((q) => q.chapter === m.id)).toHaveLength(5);
      expect(chapterQuestions(m.id)).toHaveLength(5);
    }
    exam.forEach((q) =>
      expect(q.choices[q.answer]).toBe(questions.find((o) => o.id === q.id)!.choices[0]),
    );
  });
  it('ships playable local audio for every new narration, activity and question', () => {
    const clips = manifest as Record<string, { file: string; duration: number }>;
    const check = (text: string, speaker = 'Narrator') => {
      const clip = clips[voiceKey(speaker, text)];
      expect(clip, text).toBeTruthy();
      expect(clip.duration).toBeGreaterThan(0.3);
      expect(clip.file).toBe(voiceKey(speaker, text) + '.mp3');
    };
    missions.forEach((m) =>
      m.stages.forEach((s) => {
        s.lines.forEach((l) => check(l.text, l.speaker));
        s.task?.forEach((t) => {
          check(t.instruction);
          check(t.why);
        });
      }),
    );
    questions.forEach((q) => {
      check(q.prompt);
      check(q.explanation);
    });
  });
});
describe('Play mechanics and progress', () => {
  it('makes every objective and pickup reachable from every saved checkpoint', () => {
    for (const m of missions)
      for (let stage = 0; stage < m.stages.length; stage++) {
        const g = new AdventureEngine(m.id, stage, m),
          start: Point = [Math.round(g.position[0]), Math.round(g.position[1])],
          queue: Point[] = [start],
          seen = new Set([start.join(',')]);
        for (let i = 0; i < queue.length; i++)
          for (const [dx, dz] of [
            [0, 1],
            [0, -1],
            [1, 0],
            [-1, 0],
          ]) {
            const p: Point = [queue[i][0] + dx, queue[i][1] + dz],
              key = p.join(',');
            if (!seen.has(key) && g.canWalk(...p)) {
              seen.add(key);
              queue.push(p);
            }
          }
        for (const target of [m.stages[stage].at, ...(m.stages[stage].collect?.points ?? [])])
          expect(
            queue.some((p) => distance(p, target) < 1),
            `${m.id}.${stage}: ${target}`,
          ).toBe(true);
      }
  });
  it('requires collection through movement, clears per-stage items, and finishes longer chapters', () => {
    const m = missions[1],
      g = new AdventureEngine(10, 0, m);
    g.paused = false;
    g.position = [...g.target.at];
    expect(g.ready).toBe(false);
    for (const target of g.target.collect!.points) {
      for (let i = 0; i < 1000 && distance(g.position, target) > 1; i++) {
        g.face(target);
        g.update(1 / 60, { forward: 1, strafe: 0, turn: 0, sprint: true });
      }
    }
    expect(g.collected).toHaveLength(3);
    g.position = [...g.target.at];
    expect(g.interact()).toBe(true);
    g.completeStage();
    expect(g.collected).toEqual([]);
    for (let i = 1; i < 8; i++) g.completeStage();
    expect(g.stage).toBe(8);
    expect(g.ready).toBe(false);
  });
  it('uses a forgiving timing window with definite misses outside it', () => {
    expect(inBeatWindow(0.53)).toBe(false);
    expect(inBeatWindow(0.54)).toBe(true);
    expect(inBeatWindow(0.7)).toBe(true);
    expect(inBeatWindow(0.88)).toBe(true);
    expect(inBeatWindow(0.89)).toBe(false);
  });
  it('round-trips independent saves, all chapter lengths, missed answers and exam scores', () => {
    expect(SAVE_KEY).toBe('ela-iii-douglass-9-end-v1');
    const s = freshSave();
    s.chapters[10].stage = 7;
    s.examScores = [14, 19];
    s.missed = ['df-9-1'];
    expect(parseSave(JSON.stringify(s))).toEqual(s);
    expect(parseSave('{')).toEqual(freshSave());
    const bad = parseSave(
      JSON.stringify({
        version: 1,
        chapters: { 10: { stage: 90, best: 8, attempts: -1 } },
        examScores: [21, -1, 18, '19'],
        missed: ['df-9-1', 'fake', 'df-9-1'],
      }),
    );
    expect(bad.chapters[10].stage).toBe(8);
    expect(bad.examScores).toEqual([18]);
    expect(bad.missed).toEqual(['df-9-1']);
    const result = recordResult(s, 10, 4, ['df-10-1'], ['df-10-1']);
    expect(result.chapters[10]).toEqual({ stage: 8, best: 4, attempts: 1, completed: true });
    expect(result.chapters[9].completed).toBe(false);
  });
});
