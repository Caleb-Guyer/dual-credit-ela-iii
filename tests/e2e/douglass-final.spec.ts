import { test, expect, type Page } from '@playwright/test';
import { missions, questions, type Point, type Chapter } from '../../src/douglass-final/data';
import { AdventureEngine, distance } from '../../src/douglass-next/engine';
import { freshSave, SAVE_KEY } from '../../src/douglass-final/save';
import manifest from '../../src/douglass-next/voice-manifest.json' with { type: 'json' };

declare global {
  interface Window {
    nextTest: AdventureEngine;
    nextAudio: { playing: string[]; started: number; stops: number };
  }
}

async function observe(page: Page) {
  await page.evaluate(async () => {
    const modulePath = performance
      .getEntriesByType('resource')
      .find((e) => e.name.includes('/src/douglass-next/engine.ts'))!.name;
    const module = await import(/* @vite-ignore */ modulePath);
    const update = module.AdventureEngine.prototype.update;
    module.AdventureEngine.prototype.update = function (...args: unknown[]) {
      update.apply(this, args);
      window.nextTest = this;
    };
  });
}
async function setup(page: Page, voice = false) {
  const save = freshSave();
  save.voice = voice;
  save.music = false;
  save.reduced = true;
  save.autoplay = false;
  await page.addInitScript(
    ({ key, save }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(save));
    },
    { key: SAVE_KEY, save },
  );
  await page.goto('/#douglass-9-end');
  await expect(page.getByRole('button', { name: 'Play Chapter 9', exact: true })).toBeVisible();
  await observe(page);
}
async function enter(page: Page, chapter: Chapter) {
  await page
    .getByRole('button', {
      name: `Play ${chapter === 12 ? 'Appendix' : `Chapter ${chapter}`}`,
      exact: true,
    })
    .click();
  await page
    .getByRole('button', {
      name: `Enter ${chapter === 12 ? 'Appendix' : `Chapter ${chapter}`}`,
      exact: true,
    })
    .click();
  await expect(page.locator('.dn-canvas')).toBeVisible();
  await expect(page.getByText('3D couldn’t start', { exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.nextTest?.mission.id)).toBe(chapter);
}
async function walk(page: Page, target: Point) {
  const state = await page.evaluate(() => window.nextTest.snapshot());
  const model = new AdventureEngine(
    state.chapter as Chapter,
    state.stage,
    missions.find((m) => m.id === state.chapter),
  );
  const start: Point = [Math.round(state.position[0]), Math.round(state.position[1])];
  const queue: Point[] = [start],
    visited = new Map<string, Point | null>([[start.join(','), null]]);
  let goal: Point | undefined;
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (distance(p, target) < 0.75) {
      goal = p;
      break;
    }
    for (const [dx, dz] of [
      [0, -1],
      [1, 0],
      [-1, 0],
      [0, 1],
    ]) {
      const next: Point = [p[0] + dx, p[1] + dz],
        key = next.join(',');
      if (!visited.has(key) && model.canWalk(...next)) {
        visited.set(key, p);
        queue.push(next);
      }
    }
  }
  if (!goal) throw new Error('No test route to ' + target);
  const route: Point[] = [];
  let cursor: Point | null = goal;
  while (cursor) {
    route.unshift(cursor);
    cursor = visited.get(cursor.join(','))!;
  }
  // Keep only corners so keyboard holds resemble a human following the route.
  const corners = route.filter(
    (p, i) =>
      i === route.length - 1 ||
      (i > 0 &&
        (p[0] - route[i - 1][0] !== route[i + 1][0] - p[0] ||
          p[1] - route[i - 1][1] !== route[i + 1][1] - p[1])),
  );
  // All fresh chapters start facing north. Movement is actual keyboard input; no teleport or progress edits.
  for (const destination of corners) {
    let held: string[] = [];
    for (let frame = 0; frame < 450; frame++) {
      const p = await page.evaluate(() => window.nextTest.position);
      const yaw = await page.evaluate(() => window.nextTest.yaw);
      const worldX = destination[0] - p[0],
        worldZ = destination[1] - p[1];
      const dx = worldX * Math.cos(yaw) + worldZ * Math.sin(yaw),
        dz = -worldX * Math.sin(yaw) + worldZ * Math.cos(yaw);
      if (Math.hypot(dx, dz) < 0.35) break;
      const next: string[] = [];
      if (Math.abs(dx) > 0.18) next.push(dx > 0 ? 'd' : 'a');
      if (Math.abs(dz) > 0.18) next.push(dz > 0 ? 's' : 'w');
      for (const key of held) if (!next.includes(key)) await page.keyboard.up(key);
      for (const key of next) if (!held.includes(key)) await page.keyboard.down(key);
      held = next;
      await page.waitForTimeout(45);
      if (frame === 449) throw new Error('Movement stalled at ' + p + ' toward ' + destination);
    }
    for (const key of held) await page.keyboard.up(key);
  }
}
async function finishStory(page: Page, chapter: Chapter, stage: number) {
  const data = missions.find((m) => m.id === chapter)!.stages[stage];
  await page.keyboard.press('e');
  await expect(page.locator('.dn-dialogue')).toBeVisible();
  for (let line = 0; line < data.lines.length; line++) await page.locator('.dn-next').click();
  if (data.rhythm) {
    await expect(page.locator('.dn-rhythm')).toBeVisible();
    // Real timed button presses. Do not mutate timing, progress, or successful hit count.
    for (let hit = 0; hit < 4; hit++) {
      await expect
        .poll(
          async () => {
            const left = await page
              .locator('.dn-beat-track b')
              .evaluate((e) => parseFloat((e as HTMLElement).style.left));
            return left > 61 && left < 73;
          },
          { intervals: [35], timeout: 6000 },
        )
        .toBe(true);
      await page.locator('.dn-rhythm .dn-primary').click();
      await expect(page.locator('.dn-beat-pips')).toHaveAttribute(
        'aria-label',
        `${hit + 1} of 4 successful beats`,
      );
      if (hit < 3) await page.waitForTimeout(900);
    }
    await page.getByRole('button', { name: 'Carry on →', exact: true }).click();
  }
  for (const task of data.task ?? []) {
    await expect(page.locator('.dn-activity h2')).toHaveText(task.instruction);
    await page.locator('.dn-activity .dn-answers button').nth(task.answer).click();
    await page.locator('.dn-activity .dn-primary').click();
  }
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).chapters[window.nextTest.mission.id].stage,
        SAVE_KEY,
      ),
    )
    .toBe(stage + 1);
}
async function answerQuiz(page: Page, missFirst = false, count = 5) {
  for (let i = 0; i < count; i++) {
    const prompt = await page.locator('.dn-quiz h1').innerText();
    const q = questions.find((q) => q.prompt === prompt)!;
    const choice = missFirst && i === 0 ? q.choices[(q.answer + 1) % 4] : q.choices[q.answer];
    await page.locator('.dn-quiz .dn-answers button').filter({ hasText: choice }).click();
    await page
      .getByRole('button', { name: i === count - 1 ? 'See results' : 'Next question', exact: true })
      .click();
  }
}

for (const mission of missions)
  test(`Final act ${mission.label}: movement, collection, timing, story and quiz`, async ({
    page,
  }) => {
    test.setTimeout(300000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await setup(page);
    await enter(page, mission.id);
    await page.screenshot({ path: `docs/screenshots/douglass-final-${mission.id}.png` });
    for (let stage = 0; stage < mission.stages.length; stage++) {
      for (const point of mission.stages[stage].collect?.points ?? []) await walk(page, point);
      await walk(page, mission.stages[stage].at);
      await expect.poll(() => page.evaluate(() => window.nextTest.ready)).toBe(true);
      if (stage === Math.min(3, mission.stages.length - 1))
        await page.screenshot({ path: `docs/screenshots/douglass-final-${mission.id}-later.png` });
      await finishStory(page, mission.id, stage);
    }
    await answerQuiz(page, mission.id === 9);
    await expect(page.locator('.dn-score')).toHaveText(mission.id === 9 ? '80%' : '100%');
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
    expect(saved.chapters[mission.id].completed).toBe(true);
    expect(saved.chapters[mission.id].stage).toBe(mission.stages.length);
    expect(errors).toEqual([]);
    if (mission.id === 9) {
      await page.getByRole('button', { name: 'Retry missed (1)', exact: true }).click();
      await answerQuiz(page, false, 1);
      expect(
        await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).missed, SAVE_KEY),
      ).toEqual([]);
    }
  });
test('Final exam balances four sections, scores and persists without falsely completing story', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: 'Final challenge · 20 questions', exact: true }).click();
  await answerQuiz(page, true, 20);
  await expect(page.locator('.dn-score')).toHaveText('95%');
  await expect(page.locator('.dn-kicker')).toContainText('FINAL CHALLENGE COMPLETE');
  const s = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
  expect(s.examScores).toEqual([19]);
  expect(s.missed).toHaveLength(1);
  expect(Object.values(s.chapters).every((p: any) => !p.completed)).toBe(true);
  await page.getByRole('button', { name: 'Chapter select', exact: true }).click();
  await page.reload();
  await expect(page.getByText('Best final: 95%', { exact: true })).toBeVisible();
});
test('New final route works under Pages; voices, source, phone control, saved checkpoint and reset are functional', async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.nextAudio = { playing: [], started: 0, stops: 0 };
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      window.nextAudio.playing.push(this.src);
      this.addEventListener('playing', () => window.nextAudio.started++, { once: true });
      return original.call(this);
    };
  });
  await setup(page, true);
  await page.goto('/#course');
  await page
    .getByRole('link', { name: 'Play Frederick Douglass Chapters 9–end', exact: true })
    .click();
  await expect(page.locator('.dn-chapters button')).toHaveCount(4);
  await page.getByRole('button', { name: 'Read the complete text ↗', exact: true }).click();
  await expect(page.locator('.dn-source')).toContainText('THE END');
  await expect(page.locator('.dn-source')).toContainText('April 28, 1845');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await enter(page, 12);
  const before = await page.evaluate(() => window.nextTest.position.slice());
  const stick = (await page.getByRole('button', { name: 'Movement joystick' }).boundingBox())!;
  await page.mouse.move(stick.x + 50, stick.y + 50);
  await page.mouse.down();
  await page.mouse.move(stick.x + 50, stick.y + 10);
  await page.waitForTimeout(600);
  await page.mouse.up();
  expect(distance(before, await page.evaluate(() => window.nextTest.position))).toBeGreaterThan(
    0.5,
  );
  await walk(page, missions[3].stages[0].at);
  let played = 0;
  page.on('response', (r) => {
    if (r.url().endsWith('.mp3') && [200, 206].includes(r.status())) played++;
  });
  await page.keyboard.press('e');
  await expect(page.locator('.dn-dialogue')).toBeVisible();
  await expect.poll(() => played).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.nextAudio.started)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Mute narration' }).click();
  await page.getByRole('button', { name: 'Source paraphrase ↗', exact: true }).click();
  await expect(page.locator('.dn-source')).toContainText('Christianity of Christ');
  await expect(page.locator('.dn-source h2')).not.toContainText('Chapter 12');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  for (let i = 0; i < 2; i++) await page.locator('.dn-next').click();
  const task = missions[3].stages[0].task![0];
  await page.locator('.dn-activity .dn-answers button').nth(task.answer).click();
  await page.locator('.dn-activity .dn-primary').click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Continue Appendix', exact: true })).toBeVisible();
  await observe(page);
  await page.getByRole('button', { name: 'Continue Appendix', exact: true }).click();
  await page.getByRole('button', { name: 'Resume Appendix', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.nextTest.stage)).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/screenshots/douglass-final-phone.png' });
  await page.getByRole('button', { name: 'Pause chapter' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Reset Chapters 9–end progress' }).click();
  await page.getByRole('button', { name: 'Keep my progress' }).click();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Chapter select', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Continue Appendix', exact: true })).toBeVisible();
  const base = 'http://127.0.0.1:4174/dual-credit-ela-iii/';
  for (const m of missions)
    for (const s of m.stages)
      for (const l of s.lines) {
        let hash = 2166136261;
        for (const char of l.speaker + '|' + l.text) {
          hash ^= char.charCodeAt(0);
          hash = Math.imul(hash, 16777619);
        }
        const clip = (manifest as Record<string, { file: string }>)[(hash >>> 0).toString(16)];
        const response = await request.get(base + 'douglass-next/voice/' + clip.file);
        expect(response.status()).toBe(200);
      }
  await page.goto(base + '#douglass-9-end');
  await page.reload();
  await expect(page.locator('.dn-chapters button')).toHaveCount(4);
  await context.close();
});
