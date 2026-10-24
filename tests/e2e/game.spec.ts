import { test, expect, type Page } from '@playwright/test';
import { questions } from '../../src/data/questions';
import { multipleChoice } from '../../src/lib/choices';
import { chapters, events } from '../../src/data/chapters';
const saveKey = 'franklin-path-to-print-v1';
const presentedQuestions = new Map(questions.map(multipleChoice).map((q) => [q.prompt, q]));
async function answer(page: Page, correct = true) {
  const prompt = await page.locator('.question-card > h2').innerText();
  const q = presentedQuestions.get(prompt);
  if (!q) throw new Error('No bank entry: ' + prompt);
  const options = await page.locator('.answer-option-text').allTextContents();
  const target = correct ? q.answer : options.find((x) => x !== q.answer)!;
  await page.getByRole('radio').nth(options.indexOf(target)).click();
  await expect(page.locator('.answer-reveal')).toBeVisible();
  await expect(page.getByText('How sure are you?', { exact: true })).toHaveCount(0);
}

test('all sections render, source scans open, mobile layout stays within the viewport', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/#home');
  await expect(page.getByRole('heading', { name: 'FRANKLIN THE PATH TO PRINT' })).toBeVisible();
  await page.screenshot({
    path: 'test-results/home-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  for (const route of [
    'story',
    'quiz',
    'journal',
    'timeline',
    'characters',
    'map',
    'collection',
    'study',
    'settings',
  ]) {
    await page.goto('/#' + route);
    await expect(page.locator('.page-title h1')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('coming soon');
    if (route === 'characters')
      await page.getByRole('checkbox', { name: 'Study all profiles' }).check();
    if (['story', 'quiz', 'characters', 'map'].includes(route))
      await page.screenshot({
        path: 'test-results/' + route + '-desktop.png',
        fullPage: true,
        animations: 'disabled',
      });
  }
  await page.getByRole('button', { name: '27', exact: false }).last().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.source-image')).toHaveJSProperty('naturalWidth', 1800);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    'home',
    'story',
    'quiz',
    'journal',
    'timeline',
    'characters',
    'map',
    'collection',
    'study',
    'settings',
  ]) {
    await page.goto('/#' + route);
    const width = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }));
    expect(width.scroll, route).toBeLessThanOrEqual(width.viewport + 1);
    if (['story', 'quiz', 'map'].includes(route))
      await page.screenshot({
        path: 'test-results/' + route + '-mobile.png',
        fullPage: true,
        animations: 'disabled',
      });
  }
  await page.goto('/#home');
  await page.screenshot({
    path: 'test-results/home-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.goto('/#journal');
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await expect(page.locator('.sidebar')).toHaveClass(/open/);
  await page.getByRole('link', { name: 'Quiz', exact: true }).first().click();
  await expect(page.locator('.sidebar')).not.toHaveClass(/open/);
  expect(errors).toEqual([]);
});

test('final exam scores, persists misses, offers retry, and preserves progress on reload', async ({
  page,
}) => {
  await page.goto('/#exam');
  for (let i = 0; i < 20; i++) {
    await answer(page, i !== 0 && i !== 7);
    await page.locator('.next-answer').click();
  }
  await expect(page.locator('.score-seal')).toContainText('90%');
  await expect(page.locator('.score-seal')).toContainText('18 / 20 correct');
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), saveKey);
  expect(saved.mistakes).toHaveLength(2);
  expect(saved.exams.at(-1).score).toBe(18);
  expect(saved.achievements).toContain('tomorrow');
  await page.screenshot({
    path: 'test-results/exam-results.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Retry missed', exact: true }).click();
  await answer(page);
  await page.locator('.next-answer').click();
  await answer(page);
  await page.locator('.next-answer').click();
  await expect(page.locator('.score-seal')).toContainText('100%');
  await page.goto('/#journal');
  await page.reload();
  const after = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), saveKey);
  expect(after.exams).toHaveLength(2);
  expect(after.xp).toBeGreaterThan(saved.xp);
});

test('all twelve chapters and every scene are reachable through actual recall and trials', async ({
  page,
}) => {
  test.setTimeout(360000);
  await page.goto('/#story');
  for (const chapter of chapters) {
    const scenes = events.filter((e) => e.chapter === chapter.id);
    for (const scene of scenes) {
      await expect(page.locator('.scene-illustration h2')).toHaveText(scene.title);
      await page.getByRole('button', { name: 'Close the page · Recall', exact: true }).click();
      const recallCount = scene.factIds.length > 3 ? 2 : 1;
      for (let i = 0; i < recallCount; i++) {
        await answer(page);
        await page.locator('.next-answer').click();
      }
    }
    await expect(page.locator('.battle-title h1')).toHaveText(chapter.boss);
    for (let i = 0; i < 10; i++) {
      await answer(page);
      await page.locator('.next-answer').click();
    }
    await expect(page.locator('.page-title h1')).toHaveText('Trial overcome');
    await page.getByRole('link', { name: 'Return to story', exact: false }).click();
  }
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), saveKey);
  expect(saved.completedChapters).toHaveLength(12);
  expect(saved.completedEvents).toHaveLength(60);
  expect(saved.unlockedCards).toHaveLength(252);
  expect(saved.achievements).toContain('survivor');
  expect(saved.currentChapter).toBe(12);
  await page.goto('/#story/1');
  await expect(page.locator('.page-title h1')).toHaveText(chapters[0].title);
  await page.goto('/#story/2');
  await expect(page.locator('.page-title h1')).toHaveText(chapters[1].title);
  await page.reload();
  await expect(page.locator('.page-title h1')).toHaveText(chapters[1].title);
});

test('settings reset requires confirmation and cancel preserves the save', async ({ page }) => {
  await page.goto('/#story');
  await page.goto('/#settings');
  const before = await page.evaluate((k) => localStorage.getItem(k), saveKey);
  await page.getByRole('button', { name: 'Reset save', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Keep my progress' }).click();
  expect(await page.evaluate((k) => localStorage.getItem(k), saveKey)).toBe(before);
  await page.getByRole('button', { name: 'Reset save', exact: true }).click();
  await page.getByRole('button', { name: 'Reset Franklin progress' }).click();
  const after = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), saveKey);
  expect(after.xp).toBe(0);
  expect(after.unlockedCards).toHaveLength(0);
  await expect(page.locator('.platform-title')).toBeVisible();
});

test('production assets and hash refresh work under either GitHub Pages repository subpath', async ({
  page,
  request,
}) => {
  const failed: string[] = [];
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(r.url());
  });
  for (const repo of ['dual-credit-ela-iii', 'dual-credit-ela-iii-game']) {
    const base = `http://127.0.0.1:${process.env.ELA_BUILT_PORT ?? '4174'}/${repo}/`;
    await page.goto(base + '#characters');
    await expect(page.locator('.page-title h1')).toHaveText('Characters');
    await page.reload();
    await expect(page.locator('.page-title h1')).toHaveText('Characters');
    await page.goto(base + '#home');
    await expect(page.locator('.platform-title')).toBeVisible();
    await expect(page.locator('.platform-canvas')).toHaveJSProperty('width', 1440);
    expect((await request.get(base + 'source/Franklin-Part-One.pdf')).status()).toBe(200);
    for (let n = 1; n <= 27; n++)
      expect(
        (
          await request.get(base + 'source/franklin-' + String(n).padStart(2, '0') + '.jpg')
        ).status(),
      ).toBe(200);
  }
  expect(failed).toEqual([]);
});
