import { describe, it, expect } from 'vitest';
import { chapterQuestions, missions, passage, questions, source, type Point } from './data';
import { AdventureEngine, distance, obstacles } from './engine';
import { freshSave, parseSave, recordResult } from './save';
import voiceManifest from './voice-manifest.json' with { type: 'json' };
import { voiceKey } from './voice';

describe('Chapters IV–VIII content', () => {
  it('bundles all five complete chapters with valid references on every line and question', () => {
    expect(source.chapters.map((c) => c.chapter)).toEqual([4, 5, 6, 7, 8]);
    expect(source.chapters.map((c) => c.paragraphs.length)).toEqual([10, 12, 4, 8, 11]);
    expect(JSON.stringify(source)).not.toContain('\ufffd');
    expect(missions).toHaveLength(5);
    expect(questions).toHaveLength(30);
    expect(new Set(questions.map((q) => q.prompt)).size).toBe(30);
    for (const mission of missions) {
      expect(mission.stages).toHaveLength(4);
      for (const stage of mission.stages)
        for (const line of stage.lines) {
          expect(line.text.length).toBeLessThan(215);
          expect(line.refs.length).toBeGreaterThan(0);
          line.refs.forEach((ref) => expect(passage(ref), ref).toBeTruthy());
          if (line.exact) expect(line.refs.map(passage).join(' ')).toContain(line.text);
        }
    }
    for (const q of questions) {
      expect(new Set(q.choices).size).toBe(4);
      expect(q.choices[q.answer]).toBeTruthy();
      q.refs.forEach((ref) => expect(passage(ref), ref).toBeTruthy());
    }
  });
  it('has a pre-rendered voice clip for every story line, activity and challenge', () => {
    const clips = voiceManifest as Record<
      string,
      { file: string; duration: number; voice: string }
    >;
    const check = (text: string, speaker = 'Narrator') => {
      const key = voiceKey(speaker, text);
      expect(clips[key], text).toBeTruthy();
      expect(clips[key].duration).toBeGreaterThan(0.3);
      expect(clips[key].file).toBe(key + '.mp3');
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
  it('builds shuffled chapter-specific challenges and preserves the correct answers', () => {
    for (const mission of missions) {
      const pool = chapterQuestions(mission.id, () => 0.21);
      expect(pool).toHaveLength(5);
      expect(new Set(pool.map((q) => q.id)).size).toBe(5);
      for (const question of pool) {
        expect(question.chapter).toBe(mission.id);
        const original = questions.find((q) => q.id === question.id)!;
        expect(question.choices[question.answer]).toBe(original.choices[original.answer]);
      }
    }
  });
  it('preserves the account’s uncertainty and ends before the escape', () => {
    expect(missions[4].stages[2].lines[1].text).toContain(
      'not an account of my visiting her deathbed',
    );
    expect(missions[4].stages[3].task![0].why).toContain('not an escape');
    expect(passage('8.6')).toContain('If my poor old grandmother now lives');
    expect(passage('8.11')).toContain('north-easterly');
  });
});

describe('3D movement and chapter mechanics', () => {
  it('has a reachable approach to all twenty objectives and every checkpoint', () => {
    for (const mission of missions)
      for (let stage = 0; stage < 4; stage++) {
        const game = new AdventureEngine(mission.id, stage);
        const start: Point = [Math.round(game.position[0]), Math.round(game.position[1])];
        const queue: Point[] = [start],
          visited = new Set([start.join(',')]);
        let reached = false;
        for (let i = 0; i < queue.length; i++) {
          const p = queue[i];
          if (distance(p, game.target!.at) < 2) {
            reached = true;
            break;
          }
          for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const next: Point = [p[0] + dx, p[1] + dz],
              key = next.join(',');
            if (!visited.has(key) && game.canWalk(...next)) {
              visited.add(key);
              queue.push(next);
            }
          }
        }
        expect(reached, `${mission.id}.${stage}`).toBe(true);
      }
  });
  it('collides with walls, clamps time, jumps and freezes when paused', () => {
    const game = new AdventureEngine(6);
    game.paused = false;
    const wall = obstacles(6)[0];
    expect(game.canWalk(wall.x, wall.z)).toBe(false);
    expect(game.canWalk(100, 100)).toBe(false);
    game.jump();
    game.update(1, { forward: 1, strafe: 0, turn: 0, sprint: true });
    expect(game.y).toBeGreaterThan(0);
    expect(game.elapsed).toBe(0.04);
    const before = game.snapshot();
    game.paused = true;
    game.update(1, { forward: 1, strafe: 0, turn: 1, sprint: true });
    expect(game.snapshot()).toEqual(before);
  });
  it('keeps the ship bounded until arrival and requires actual sheep delivery', () => {
    const ship = new AdventureEngine(5);
    expect(ship.canWalk(10, -15)).toBe(false);
    const game = new AdventureEngine(5, 2);
    game.paused = false;
    expect(game.canWalk(10, -15)).toBe(true);
    expect(game.interact()).toBe(false);
    expect(game.whistle).toBe(4);
    const travel = (target: Point) => {
      for (let i = 0; i < 3000 && distance(game.position, target) > 0.2; i++) {
        game.face(target);
        game.update(1 / 60, { forward: 1, strafe: 0, turn: 0, sprint: false });
        if (i % 120 === 0) game.interact();
      }
    };
    travel([0, -14]);
    travel([12, -15]);
    for (let i = 0; i < 300; i++)
      game.update(1 / 60, { forward: 0, strafe: 0, turn: 0, sprint: false });
    expect(game.herded).toBe(3);
    expect(game.ready).toBe(true);
    expect(game.interact()).toBe(true);
    expect(game.stage).toBe(2);
    game.completeStage();
    expect(game.stage).toBe(3);
  });
});

describe('independent progress and results', () => {
  it('recovers corrupted saves and clamps invalid checkpoint and preference values', () => {
    expect(parseSave('{broken')).toEqual(freshSave());
    const s = parseSave(
      JSON.stringify({
        version: 1,
        chapters: { 4: { stage: 99, best: 90, attempts: -1, completed: true } },
        missed: ['dn-4-1', 'dn-4-1', 'missing'],
        sensitivity: 9,
      }),
    );
    expect(s.chapters[4]).toEqual({ stage: 4, completed: true, best: 5, attempts: 0 });
    expect(s.missed).toEqual(['dn-4-1']);
    expect(s.sensitivity).toBe(2);
  });
  it('records one completed chapter, preserves other progress and clears corrected mistakes', () => {
    const s = freshSave();
    s.chapters[7].stage = 2;
    s.missed = ['dn-4-1', 'dn-7-1'];
    const next = recordResult(s, 4, 4, ['dn-4-1', 'dn-4-2'], ['dn-4-2']);
    expect(next.chapters[4]).toEqual({ stage: 4, completed: true, best: 4, attempts: 1 });
    expect(next.chapters[7].stage).toBe(2);
    expect(next.missed).toEqual(['dn-7-1', 'dn-4-2']);
    expect(s.chapters[4].completed).toBe(false);
  });
});
