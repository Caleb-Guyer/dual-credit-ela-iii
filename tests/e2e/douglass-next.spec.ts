import { test, expect, type Page } from '@playwright/test';
import { missions, questions, type Point, type Chapter } from '../../src/douglass-next/data';
import { AdventureEngine, distance } from '../../src/douglass-next/engine';
import { freshSave, SAVE_KEY } from '../../src/douglass-next/save';
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
  await page.goto('/#douglass-4-8');
  await expect(page.getByRole('button', { name: 'Play Chapter 4', exact: true })).toBeVisible();
  await observe(page);
}
async function enter(page: Page, chapter: Chapter) {
  await page.getByRole('button', { name: `Play Chapter ${chapter}`, exact: true }).click();
  await page.getByRole('button', { name: `Enter Chapter ${chapter}`, exact: true }).click();
  await expect(page.locator('.dn-canvas')).toBeVisible();
  await expect(page.getByText('3D couldn’t start', { exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.nextTest?.mission.id)).toBe(chapter);
}
async function walk(page: Page, target: Point) {
  const state = await page.evaluate(() => window.nextTest.snapshot());
  const model = new AdventureEngine(state.chapter as Chapter, state.stage);
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
      const dx = destination[0] - p[0],
        dz = destination[1] - p[1];
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
async function answerQuiz(page: Page, missFirst = false) {
  for (let i = 0; i < 5; i++) {
    const prompt = await page.locator('.dn-quiz h1').innerText();
    const q = questions.find((q) => q.prompt === prompt)!;
    const choice = missFirst && i === 0 ? q.choices[(q.answer + 1) % 4] : q.choices[q.answer];
    await page.locator('.dn-quiz .dn-answers button').filter({ hasText: choice }).click();
    await page
      .getByRole('button', { name: i === 4 ? 'See results' : 'Next question', exact: true })
      .click();
  }
}

for (const mission of missions)
  test(`3D Chapter ${mission.id}: all objectives, activity, quiz and checkpoint complete through player input`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await setup(page);
    await enter(page, mission.id);
    await page.screenshot({ path: `docs/screenshots/douglass-${mission.id}-3d.png` });
    for (let stage = 0; stage < 4; stage++) {
      if (mission.stages[stage].herd) {
        await walk(page, [0, -14]);
        await page.keyboard.press('e');
        await walk(page, [12, -15]);
        await page.keyboard.press('e');
        await expect
          .poll(() => page.evaluate(() => window.nextTest.herded), { timeout: 12000 })
          .toBe(3);
      } else await walk(page, mission.stages[stage].at);
      await expect.poll(() => page.evaluate(() => window.nextTest.ready)).toBe(true);
      await finishStory(page, mission.id, stage);
    }
    await answerQuiz(page, mission.id === 4);
    await expect(page.locator('.dn-score')).toHaveText(mission.id === 4 ? '80%' : '100%');
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
    expect(saved.chapters[mission.id].completed).toBe(true);
    expect(saved.chapters[mission.id].best).toBe(mission.id === 4 ? 4 : 5);
    if (mission.id === 4) {
      expect(saved.missed).toHaveLength(1);
      await page.getByRole('button', { name: 'Retry missed (1)', exact: true }).click();
      const prompt = await page.locator('.dn-quiz h1').innerText();
      const q = questions.find((q) => q.prompt === prompt)!;
      await page
        .locator('.dn-quiz .dn-answers button')
        .filter({ hasText: q.choices[q.answer] })
        .click();
      await page.getByRole('button', { name: 'See results', exact: true }).click();
      await expect(page.locator('.dn-score')).toHaveText('100%');
      expect(
        await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).missed, SAVE_KEY),
      ).toEqual([]);
    }
    expect(errors).toEqual([]);
  });

test('3D hub, independent saves, phone controls, source, checkpoint resume and reset confirmation', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page);
  await page.goto('/#course');
  await page
    .getByRole('link', { name: 'Play Frederick Douglass Chapters 4–8', exact: true })
    .click();
  await expect(page.locator('.dn-chapters button')).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await enter(page, 4);
  await walk(page, missions[0].stages[0].at);
  await page.keyboard.press('e');
  await page.getByRole('button', { name: 'Source paraphrase ↗', exact: true }).click();
  await expect(page.locator('.dn-source')).toContainText('Austin Gore');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.locator('.dn-next').click();
  await page.locator('.dn-next').click();
  await page.reload();
  await observe(page);
  await page.getByRole('button', { name: 'Continue Chapter 4', exact: true }).click();
  await page.getByRole('button', { name: 'Resume Chapter 4', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.nextTest.stage)).toBe(1);
  const start = await page.evaluate(() => window.nextTest.position.slice());
  const stick = await page.getByRole('button', { name: 'Movement joystick' }).boundingBox();
  expect(stick).toBeTruthy();
  await page.mouse.move(stick!.x + 50, stick!.y + 50);
  await page.mouse.down();
  await page.mouse.move(stick!.x + 50, stick!.y + 15, { steps: 4 });
  await page.waitForTimeout(650);
  await page.mouse.up();
  const moved = await page.evaluate(() => window.nextTest.position.slice());
  expect(Math.hypot(moved[0] - start[0], moved[1] - start[1])).toBeGreaterThan(0.5);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.nextTest.position)).toEqual(moved);
  await page.screenshot({ path: 'docs/screenshots/douglass-next-phone.png' });
  await page.getByRole('button', { name: 'Pause chapter' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Reset Chapters 4–8 progress' }).click();
  await page.getByRole('button', { name: 'Keep my progress' }).click();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Chapter select', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Continue Chapter 4', exact: true })).toBeVisible();
  await context.close();
});

test('bundled voice plays, replay and mute stop it, and all clips are served under Pages', async ({
  page,
  request,
}) => {
  await page.addInitScript(() => {
    window.nextAudio = { playing: [], started: 0, stops: 0 };
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      window.nextAudio.playing.push(this.src);
      this.addEventListener('playing', () => window.nextAudio.started++, { once: true });
      return original.call(this);
    };
    const pause = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.pause = function () {
      window.nextAudio.stops++;
      return pause.call(this);
    };
  });
  await setup(page, true);
  await enter(page, 4);
  await walk(page, missions[0].stages[0].at);
  await page.keyboard.press('e');
  await expect
    .poll(() =>
      page.evaluate(() => window.nextAudio.playing.filter((x) => x.endsWith('.mp3')).length),
    )
    .toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.nextAudio.started)).toBeGreaterThan(0);
  const stops = await page.evaluate(() => window.nextAudio.stops);
  await page.getByRole('button', { name: 'Mute narration' }).click();
  await expect.poll(() => page.evaluate(() => window.nextAudio.stops)).toBeGreaterThan(stops);
  await page.getByRole('button', { name: 'Replay narration' }).click();
  await expect.poll(() => page.evaluate(() => window.nextAudio.playing.length)).toBeGreaterThan(1);
  const base = 'http://127.0.0.1:4174/dual-credit-ela-iii/';
  for (const clip of Object.values(manifest)) {
    const response = await request.get(base + 'douglass-next/voice/' + clip.file);
    expect(response.status()).toBe(200);
    expect((await response.body()).length).toBeGreaterThan(3000);
  }
  await page.goto(base + '#douglass-4-8');
  await page.reload();
  await expect(page.locator('.dn-chapters button')).toHaveCount(5);
});

test('voice-driven dialogue advances naturally and stops at the next playable objective', async ({
  page,
}) => {
  await setup(page, true);
  await page.getByRole('button', { name: 'Campaign settings' }).click();
  await page.getByLabel('Auto-advance spoken dialogue').check();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await enter(page, 4);
  await walk(page, missions[0].stages[0].at);
  await page.keyboard.press('e');
  await expect(page.locator('.dn-dialogue')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.nextTest.stage), { timeout: 35000 }).toBe(1);
  await expect(page.locator('.dn-dialogue')).toHaveCount(0);
  await expect(page.locator('.dn-objective')).toContainText('Follow the water');
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).chapters[4].stage,
      SAVE_KEY,
    ),
  ).toBe(1);
});
