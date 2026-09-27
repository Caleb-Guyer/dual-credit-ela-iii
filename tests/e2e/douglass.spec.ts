import { test, expect, type Page } from '@playwright/test';
import {
  CampaignEngine,
  estateMap,
  finalSite,
  testimonySites,
  platforms,
  riverRings,
  riverRocks,
} from '../../src/douglass/engine';
import { questions } from '../../src/douglass/data';
import { freshDouglassSave, SAVE_KEY } from '../../src/douglass/save';
declare global {
  interface Window {
    douglassTestGame: CampaignEngine;
    douglassVoiceTest: { lines: string[]; cancellations: number; gains: number[] };
  }
}

test('Douglass dialogue speaks, reveals, replays, lowers music and saves its voice preference', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.douglassVoiceTest = { lines: [], cancellations: 0, gains: [] };
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => [],
        resume: () => {},
        cancel: () => window.douglassVoiceTest.cancellations++,
        speak: (line: SpeechSynthesisUtterance) => {
          window.douglassVoiceTest.lines.push(line.text);
          queueMicrotask(() =>
            line.onstart?.call(line, new Event('start') as SpeechSynthesisEvent),
          );
        },
      },
    });
    const original = AudioParam.prototype.setTargetAtTime;
    AudioParam.prototype.setTargetAtTime = function (value, start, constant) {
      window.douglassVoiceTest.gains.push(value);
      return original.call(this, value, start, constant);
    };
  });
  await page.goto('/#douglass');
  await observe(page);
  await page.getByRole('button', { name: 'Begin campaign', exact: true }).click();
  await page.getByRole('button', { name: 'Enter the story', exact: true }).click();
  await playUntilStory(page);
  await expect(page.locator('.d-dialogue')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.douglassVoiceTest.lines.length))
    .toBeGreaterThan(0);
  const initialCalls = await page.evaluate(() => window.douglassVoiceTest.lines.length);
  const firstLine = await page.evaluate(() => window.douglassVoiceTest.lines.at(-1));
  expect(await page.locator('.d-letter.shown').count()).toBeLessThan(
    await page.locator('.d-letter').count(),
  );
  await expect
    .poll(() => page.evaluate(() => window.douglassVoiceTest.gains.includes(0.018)))
    .toBe(true);
  await page.getByRole('button', { name: 'Reveal full line', exact: true }).click();
  await expect(page.locator('.d-letter.shown')).toHaveCount(
    await page.locator('.d-letter').count(),
  );
  await page.getByRole('button', { name: 'Replay dialogue' }).click();
  await expect
    .poll(() => page.evaluate(() => window.douglassVoiceTest.lines.length))
    .toBe(initialCalls + 1);
  await page.getByRole('button', { name: 'Next line', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.douglassVoiceTest.lines.at(-1)))
    .not.toBe(firstLine);
  await expect(page.locator('.d-speaker')).toContainText('2 / 2');
  await page.getByRole('button', { name: 'Mute dialogue' }).click();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).voice, SAVE_KEY)).toBe(
    false,
  );
  await expect.poll(() => page.evaluate(() => window.douglassVoiceTest.gains.at(-1))).toBe(0.025);
  await page.goto('/#course');
  expect(await page.evaluate(() => window.douglassVoiceTest.cancellations)).toBeGreaterThan(0);
});
async function observe(page: Page) {
  await page.evaluate(async () => {
    const path = performance
      .getEntriesByType('resource')
      .find((e) => e.name.includes('/src/douglass/engine.ts'))!.name;
    const module = await import(path);
    const stats = module.CampaignEngine.prototype.stats;
    module.CampaignEngine.prototype.stats = function () {
      window.douglassTestGame = this;
      return stats.call(this);
    };
  });
}
async function quietSave(page: Page) {
  await page.addInitScript(
    ({ key, save }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(save));
    },
    {
      key: SAVE_KEY,
      save: { ...freshDouglassSave(), music: false, voice: false, reducedMotion: true },
    },
  );
}
async function nextStory(page: Page) {
  while (await page.locator('.d-dialogue').isVisible()) {
    const button = page.locator('.d-next-line');
    await button.click();
    await page.waitForTimeout(60);
  }
}
async function playUntilStory(page: Page) {
  return page.evaluate(
    ({ grid, sites, exit, floors, rings, rocks }) =>
      new Promise<{ finished: boolean; found: number; resets: number; position: unknown }>(
        (resolve) => {
          const started = performance.now(),
            g = window.douglassTestGame;
          function pathTo(tx: number, ty: number) {
            const start = [Math.floor(g.eye.x), Math.floor(g.eye.y)],
              goal = [Math.floor(tx), Math.floor(ty)];
            if (start[0] === goal[0] && start[1] === goal[1]) return { x: tx, y: ty };
            const queue = [start],
              previous = new Map<string, number[] | null>([[start.join(','), null]]);
            while (queue.length) {
              const cell = queue.shift()!;
              if (cell[0] === goal[0] && cell[1] === goal[1]) break;
              for (const [dx, dy] of [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
              ]) {
                const next = [cell[0] + dx, cell[1] + dy],
                  key = next.join(',');
                if (!previous.has(key) && grid[next[1]]?.[next[0]] === '0') {
                  previous.set(key, cell);
                  queue.push(next);
                }
              }
            }
            let point = goal,
              prior = previous.get(point.join(','));
            while (prior && prior.join(',') !== start.join(',')) {
              point = prior;
              prior = previous.get(point.join(','));
            }
            return { x: point[0] + 0.5, y: point[1] + 0.5 };
          }
          function frame() {
            if (g.pending || g.finished || performance.now() - started > 65000) {
              g.clearInput();
              resolve({
                finished: g.finished,
                found: g.found,
                resets: g.resets,
                position: g.chapter === 1 ? g.player : g.chapter === 2 ? g.boat : g.eye,
              });
              return;
            }
            if (g.paused) {
              requestAnimationFrame(frame);
              return;
            }
            g.release('left');
            g.release('right');
            g.release('jump');
            g.release('dash');
            g.release('forward');
            g.release('turnLeft');
            g.release('turnRight');
            g.release('interact');
            if (g.chapter === 1) {
              const p = g.player;
              g.press('right');
              const standing = floors.find(
                (s) => Math.abs(s.y - p.y - p.h) < 3 && p.x + p.w > s.x && p.x < s.x + s.w,
              );
              if (p.grounded && standing && standing.x + standing.w - p.x < 110) g.press('jump');
              else if (!p.grounded && p.vy > 70 && p.jumps < 2 && p.y > 320) g.press('jump');
            } else if (g.chapter === 2) {
              const rock = rocks.find((r) => r.z > g.boat.z && r.z - g.boat.z < 25),
                ring = rings.find((r) => r.z > g.boat.z + 2);
              let target = ring?.x ?? 0;
              if (rock && Math.abs(target - rock.x) < 0.4) target = rock.x > 0 ? -0.65 : 0.65;
              const diff = target - g.boat.x;
              if (Math.abs(diff) > 0.03) g.press(diff > 0 ? 'right' : 'left');
              if (g.surge > 0.12) g.press('dash');
            } else {
              const target = sites[g.found] ?? exit,
                dist = Math.hypot(g.eye.x - target.x, g.eye.y - target.y);
              if (dist < 1.15 && g.found < 4) g.press('interact');
              const next = pathTo(target.x, target.y),
                angle = Math.atan2(next.y - g.eye.y, next.x - g.eye.x),
                error = Math.atan2(Math.sin(angle - g.eye.angle), Math.cos(angle - g.eye.angle));
              if (Math.abs(error) > 0.045) g.press(error > 0 ? 'turnRight' : 'turnLeft');
              if (Math.abs(error) < 0.14) {
                g.press('forward');
                g.press('dash');
              }
            }
            requestAnimationFrame(frame);
          }
          requestAnimationFrame(frame);
        },
      ),
    {
      grid: estateMap,
      sites: testimonySites,
      exit: finalSite,
      floors: platforms,
      rings: riverRings,
      rocks: riverRocks,
    },
  );
}

test('course hub launches either game and preserves independent progress', async ({ page }) => {
  await quietSave(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Choose your story.' })).toBeVisible();
  await page.getByRole('link', { name: 'Play Benjamin Franklin' }).click();
  await expect(page.locator('.platform-title')).toBeVisible();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.weapon-badge')).toContainText('Bow');
  const franklin = await page.evaluate(() => localStorage.getItem('franklin-path-to-print-v1'));
  await page.goto('/#course');
  await page.getByRole('link', { name: 'Play Frederick Douglass', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Begin campaign', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('franklin-path-to-print-v1'))).toBe(
    franklin,
  );
  await page.reload();
  await expect(page.locator('.d-menu')).toBeVisible();
  await page.goto('/#unknown');
  await expect(page.locator('.course-hub')).toBeVisible();
});

test('all three mission genres complete through real controls and lead to a scored final challenge', async ({
  page,
}) => {
  test.setTimeout(300000);
  await quietSave(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/#douglass');
  await observe(page);
  await page.getByRole('button', { name: 'Begin campaign', exact: true }).click();
  for (let chapter = 1; chapter <= 3; chapter++) {
    await page.getByRole('button', { name: 'Enter the story', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.douglassTestGame?.chapter)).toBe(chapter);
    await page.screenshot({ path: `test-results/douglass-mission-${chapter}.png` });
    for (let node = 0; node < 4; node++) {
      const result = await playUntilStory(page);
      expect(result.finished, JSON.stringify(result)).toBe(false);
      expect(result.found, JSON.stringify(result)).toBe(node);
      await expect(page.locator('.d-dialogue')).toBeVisible();
      await nextStory(page);
      await expect.poll(() => page.evaluate(() => window.douglassTestGame.found)).toBe(node + 1);
    }
    const result = await playUntilStory(page);
    expect(result.finished, JSON.stringify(result)).toBe(true);
    await expect(page.locator('.d-debrief')).toBeVisible();
    expect(result.resets).toBeLessThan(5);
    await page.locator('.d-debrief .d-primary').click();
  }
  await expect(page.locator('.d-quiz')).toBeVisible();
  const prompts = new Set<string>();
  for (let i = 0; i < 20; i++) {
    const prompt = await page.locator('.d-question h1').innerText(),
      q = questions.find((q) => q.prompt === prompt)!;
    expect(q).toBeTruthy();
    prompts.add(prompt);
    const choice = i === 0 ? (q.answer + 1) % 4 : q.answer;
    await page.keyboard.press(String(choice + 1));
    await expect(page.locator('.d-answer-feedback')).toBeVisible();
    await page.locator('.d-answer-feedback .d-primary').click();
  }
  expect(prompts.size).toBe(20);
  await expect(page.locator('.d-grade')).toContainText('95%');
  await expect(page.locator('.d-missed article')).toHaveCount(1);
  await page.getByRole('button', { name: 'Retry missed' }).click();
  // Read the newly selected retry normally; answer identity remains in the source bank.
  const retryPrompt = await page.locator('.d-question h1').innerText(),
    retry = questions.find((q) => q.prompt === retryPrompt)!;
  await page.keyboard.press(String(retry.answer + 1));
  await page.locator('.d-answer-feedback .d-primary').click();
  await expect(page.locator('.d-grade')).toContainText('100%');
  const save = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
  expect(save.completed).toEqual([1, 2, 3]);
  expect(save.memories).toHaveLength(12);
  expect(save.missed).toEqual([]);
  expect(save.exams).toHaveLength(2);
  expect(errors).toEqual([]);
});

test('phone controls, source reading, checkpoint reload, pause and settings work', async ({
  page,
}) => {
  await quietSave(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Play Frederick Douglass', exact: true }).click();
  await observe(page);
  await page.getByRole('button', { name: 'Begin campaign', exact: true }).click();
  await page.getByRole('button', { name: 'Enter the story', exact: true }).click();
  const right = page.getByRole('button', { name: 'Move right', exact: true });
  const box = (await right.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(450);
  await page.mouse.up();
  expect(await page.evaluate(() => window.douglassTestGame.player.x)).toBeGreaterThan(150);
  expect(await page.evaluate(() => window.douglassTestGame.controls.right)).toBe(false);
  await playUntilStory(page);
  await page.getByRole('button', { name: /Source paraphrase/ }).click();
  await expect(page.getByRole('dialog', { name: 'From the Narrative' })).toBeVisible();
  await expect(page.locator('.d-source-modal')).toContainText('Tuckahoe');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await nextStory(page);
  await page.getByRole('button', { name: 'Pause mission' }).click();
  const position = await page.evaluate(() => window.douglassTestGame.player.x);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.douglassTestGame.player.x)).toBe(position);
  await page.reload();
  await observe(page);
  await page.getByRole('button', { name: 'Continue campaign', exact: true }).click();
  await page.getByRole('button', { name: 'Resume at checkpoint', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.douglassTestGame.found)).toBe(1);
  await expect(page.getByRole('button', { name: 'Jump', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/#course');
  await page.getByRole('link', { name: 'Play Frederick Douglass', exact: true }).click();
  await page.getByRole('button', { name: 'Campaign settings' }).click();
  await page.getByRole('checkbox', { name: /Relaxed challenge/ }).check();
  await page.getByRole('button', { name: 'Reset Douglass progress' }).click();
  await page.getByRole('button', { name: 'Keep my progress' }).click();
  await expect(page.getByRole('checkbox', { name: /Relaxed challenge/ })).toBeChecked();
});

test('hub and Douglass campaign refresh at the deployed repository subpath', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const base = 'http://127.0.0.1:4174/dual-credit-ela-iii/';
  await page.goto(base);
  await expect(page.locator('.course-hub')).toBeVisible();
  await page.getByRole('link', { name: 'Play Frederick Douglass', exact: true }).click();
  await page.reload();
  await expect(page.locator('.d-menu')).toBeVisible();
  await page.getByRole('button', { name: 'Begin campaign', exact: true }).click();
  await page.getByRole('button', { name: 'Enter the story', exact: true }).click();
  await expect(page.locator('.d-canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
