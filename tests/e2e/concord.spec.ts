import { expect, test, type Page } from '@playwright/test';
import { debates, evidence, questions, source } from '../../src/concord/data';
import { freshSave, SAVE_KEY, type ConcordSave } from '../../src/concord/save';
import { interactionDefs } from '../../src/concord/interactions';
import { hotspots } from '../../src/concord/navigation';
import type { ConcordWorld } from '../../src/concord/scene';

declare global {
  interface Window {
    concordTest: ConcordWorld;
  }
}

async function setup(page: Page, changes: Partial<ConcordSave> = {}) {
  const save = { ...freshSave(), music: false, reduced: true, ...changes };
  await page.addInitScript(
    ({ key, save }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(save));
    },
    { key: SAVE_KEY, save },
  );
  await page.goto('/#concord');
  await expect(page.getByRole('heading', { name: 'One Night in Concord' })).toBeVisible();
  await expect(page.locator('.cn-title-menu > button')).toHaveCount(3);
  await expect(page.locator('.cn-hero-details, .cn-acts, .cn-study-strip')).toHaveCount(0);
  if ((page.viewportSize()?.width ?? 0) > 600)
    await page.screenshot({ path: 'docs/screenshots/concord-title.png' });
}

async function enter(page: Page) {
  await page.getByRole('button', { name: /^(Begin|Continue)$/ }).click();
  await page.getByRole('button', { name: 'Step into the scene', exact: true }).click();
  await expect(page.locator('.cn-game-shell canvas')).toBeVisible();
  if (await page.locator('.cn-world-fallback').count()) {
    const failure = await page.evaluate(async () => {
      const path = performance
        .getEntriesByType('resource')
        .find((entry) => entry.name.includes('/src/concord/scene.ts'))!.name;
      const module = await import(/* @vite-ignore */ path);
      const canvas = document.createElement('canvas');
      document.body.appendChild(canvas);
      try {
        const world = new module.ConcordWorld(
          canvas,
          0,
          false,
          () => ({ paused: false, reduced: true, collected: [] }),
          () => {},
          () => {},
        );
        world.dispose();
        return 'A fresh standalone world starts; the React view failed.';
      } catch (error) {
        return String(error) + '\n' + (error as Error).stack;
      } finally {
        canvas.remove();
      }
    });
    throw new Error(`The 3D scene did not start: ${failure}`);
  }
  await expect(page.locator('.cn-world-fallback')).toHaveCount(0);
  await expect(page.locator('.cn-objective, .cn-game-bottom, .cn-location-pill')).toHaveCount(0);
  if ((page.viewportSize()?.width ?? 0) > 600 && !(await saved(page)).collected.length)
    await page.screenshot({ path: 'docs/screenshots/concord-world.png' });
}

/** Observe the real world through its development module, without production test globals. */
async function observeWorld(page: Page) {
  await page.evaluate(() => Reflect.deleteProperty(window, 'concordTest'));
  await expect(async () => {
    await page.evaluate(async () => {
      // Include cached module versions if a developer's HMR update landed during a run.
      const paths = [
        ...new Set(
          performance
            .getEntriesByType('resource')
            .filter((entry) => entry.name.includes('/src/concord/scene.ts'))
            .map((entry) => entry.name),
        ),
      ];
      for (const path of paths) {
        const module = await import(/* @vite-ignore */ path);
        const original = module.ConcordWorld.prototype.look;
        module.ConcordWorld.prototype.look = function (...args: number[]) {
          window.concordTest = this;
          original.apply(this, args);
        };
      }
    });
    const canvas = page.locator('.cn-game-shell canvas');
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.55);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.6 + 3, box.y + box.height * 0.55, { steps: 2 });
    await page.mouse.up();
    expect(await page.evaluate(() => !!window.concordTest)).toBe(true);
  }).toPass({ timeout: 10000 });
}

const saved = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)!) as ConcordSave, SAVE_KEY);

async function placePlayer(page: Page, x: number, z: number, yaw = 0) {
  await page.evaluate(
    ({ x, z, yaw }) => {
      const world = window.concordTest;
      world.keys.clear();
      world.camera.position.set(x, 1.68, z);
      world.yaw = yaw;
      world.pitch = -0.03;
    },
    { x, z, yaw },
  );
  // Let the real renderer synchronize its restored pose before keyboard input starts.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

async function approachObject(page: Page, id: string, touch = false) {
  const target = hotspots.find((point) => point.id === id)!;
  if (id === 'c08') await placePlayer(page, 1.6, target.z, -Math.PI / 2);
  else if (id === 'c09') await placePlayer(page, -1.15, target.z, Math.PI / 2);
  else await placePlayer(page, target.x, target.z + 1.6);
  await expect.poll(() => page.evaluate(() => window.concordTest.near?.id)).toBe(id);
  if ((await saved(page)).collected.includes(id))
    await expect(page.locator('.cn-inspect')).toContainText('Revisit');
  if (touch) await page.locator('.cn-inspect').tap();
  else await page.keyboard.press('e');
  await expect(
    page.getByRole('dialog', { name: interactionDefs[id].title, exact: true }),
  ).toBeVisible();
}

/** Exercise the actual pointer/choice controls; completion alone does not collect a passage. */
async function finishInteraction(page: Page, id: string) {
  const def = interactionDefs[id];
  const region = page.getByRole('dialog', { name: def.title, exact: true });
  const card = evidence.find((item) => item.id === id)!;
  const alreadyCollected = (await saved(page)).collected.includes(id);
  for (let index = 0; index < def.steps.length; index++) {
    const step = def.steps[index];
    await expect(region.locator('.cn-interaction-prompt')).toHaveText(step.prompt);
    if (!alreadyCollected) expect((await saved(page)).collected).not.toContain(id);
    await expect(page.getByRole('dialog', { name: card.title, exact: true })).toHaveCount(0);
    if (step.posture && step.posture !== 'stand') {
      await expect
        .poll(() => page.evaluate(() => window.concordTest.camera.position.y))
        .toBeLessThan(step.posture === 'sit' ? 1.2 : 1.63);
    }
    if (id === 'c11' && index === 1)
      await expect
        .poll(() => page.evaluate(() => -Math.sin(window.concordTest.yaw)))
        .toBeGreaterThan(0.8);
    if (step.kind === 'choose') {
      if (id === 'c04')
        await page.screenshot({ path: 'docs/screenshots/concord-gameplay-collector.png' });
      const coinPose = () =>
        page.evaluate(() =>
          window.concordTest.scene.getObjectByName('tax-coin')!.position.toArray(),
        );
      let offeredCoin: number[] | null = null;
      const preview = step.choices?.find((choice) => choice.advance === false);
      if (preview) {
        const heldCoin = id === 'c04' ? await coinPose() : null;
        await region.getByRole('button', { name: preview.label, exact: false }).click();
        await expect(region.locator('.cn-interaction-response')).toHaveText(preview.response);
        await expect(region.locator('.cn-interaction-prompt')).toHaveText(step.prompt);
        if (!alreadyCollected) expect((await saved(page)).collected).not.toContain(id);
        if (heldCoin) {
          await expect
            .poll(async () => {
              const pose = await coinPose();
              return Math.hypot(...pose.map((value, i) => value - heldCoin[i]));
            })
            .toBeGreaterThan(0.2);
          offeredCoin = await coinPose();
          await page.screenshot({ path: 'docs/screenshots/concord-gameplay-collector-offer.png' });
        }
      }
      const choice = step.choices!.find((item) => item.advance !== false)!;
      await region.getByRole('button', { name: choice.label, exact: false }).click();
      await expect(region.locator('.cn-interaction-response')).toHaveText(choice.response);
      if (offeredCoin) {
        const offer = offeredCoin;
        await expect
          .poll(async () => {
            const pose = await coinPose();
            return Math.hypot(...pose.map((value, i) => value - offer[i]));
          })
          .toBeGreaterThan(0.2);
      }
    } else if (step.kind === 'hold') {
      const action = region.getByRole('button', { name: step.actionLabel, exact: false });
      const box = (await action.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      const capture =
        id === 'c03' ? 'press' : id === 'c08' ? 'window' : id === 'c11' ? 'river' : null;
      if (capture) {
        await expect
          .poll(async () =>
            Number(await region.getByRole('progressbar').getAttribute('aria-valuenow')),
          )
          .toBeGreaterThan(20);
        await page.screenshot({ path: `docs/screenshots/concord-gameplay-${capture}.png` });
      }
      await expect(region).toContainText(def.steps[index + 1]?.prompt ?? def.completion, {
        timeout: (step.duration ?? 1.2) * 1000 + 5000,
      });
      await page.mouse.up();
    } else await region.getByRole('button', { name: step.actionLabel, exact: false }).click();
  }
  await expect(region).toContainText(def.completion);
  if (!alreadyCollected) expect((await saved(page)).collected).not.toContain(id);
  await region.getByRole('button', { name: 'Read Thoreau’s passage', exact: false }).click();
  await expect(region).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: card.title, exact: true })).toBeVisible();
  await expect.poll(async () => (await saved(page)).collected).toContain(id);
}

test('Concord explores real 3D, collects evidence, opens source context and resumes its save', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await setup(page);
  await enter(page);
  await observeWorld(page);
  await expect(page.locator('.cn-tracker')).toHaveCount(0);
  await page.keyboard.press('h');
  await expect(page.locator('.cn-tracker')).toBeVisible();
  await page.getByRole('button', { name: /Hide directions/ }).click();
  await expect(page.locator('.cn-tracker')).toHaveCount(0);
  const start = await page.evaluate(() => window.concordTest.camera.position.toArray());
  await page.keyboard.down('w');
  await expect
    .poll(() => page.evaluate(() => window.concordTest.near?.id), { timeout: 20000 })
    .toBe('c01');
  await page.keyboard.up('w');
  const end = await page.evaluate(() => window.concordTest.camera.position.toArray());
  expect(Math.hypot(end[0] - start[0], end[2] - start[2])).toBeGreaterThan(3);
  await page.keyboard.press('e');
  await finishInteraction(page, 'c01');
  const card = evidence[0];
  await expect(page.getByRole('dialog', { name: card.title, exact: true })).toBeVisible();
  await expect(page.locator('.cn-quotation')).toContainText(card.quote);
  await page.getByRole('button', { name: 'Read the passage', exact: true }).click();
  await expect(page.locator('dialog[open]')).toContainText(
    source.find((p) => p.id === card.paragraph)!.text,
  );
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: card.title, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window.concordTest, 'returnView') === null))
    .toBe(true);
  const beforeNotebook = await page.evaluate(() => ({
    position: window.concordTest.camera.position.toArray(),
    yaw: window.concordTest.yaw,
  }));
  await page.getByRole('button', { name: 'Open evidence journal', exact: true }).click();
  await page.getByRole('button', { name: /Back to game/ }).click();
  await expect(page.locator('.cn-game-shell canvas')).toBeVisible();
  await observeWorld(page);
  const afterNotebook = await page.evaluate(() => ({
    position: window.concordTest.camera.position.toArray(),
    yaw: window.concordTest.yaw,
  }));
  expect(
    Math.hypot(
      afterNotebook.position[0] - beforeNotebook.position[0],
      afterNotebook.position[2] - beforeNotebook.position[2],
    ),
  ).toBeLessThan(0.3);
  expect(Math.abs(afterNotebook.yaw - beforeNotebook.yaw)).toBeLessThan(0.02);
  await expect.poll(async () => (await saved(page)).collected).toContain('c01');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
  expect((await saved(page)).collected).toEqual(['c01']);
  expect(errors).toEqual([]);
});

test('walking accelerates, brakes, crosses the bridge to both banks and slides along its railing', async ({
  page,
}) => {
  await setup(page);
  await enter(page);
  await observeWorld(page);
  await placePlayer(page, 0, 12);
  // Observe the integrated controller through the existing development-only world harness.
  // No production test globals or synthetic physics calls are introduced.
  const firstStep = page.evaluate(async () => {
    const world = window.concordTest;
    const start = world.camera.position.z;
    return new Promise<number>((resolve) => {
      function sample() {
        if (world.camera.position.z !== start) resolve(Reflect.get(world, 'motion').speed);
        else requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
  });
  await page.keyboard.down('w');
  const firstSpeed = await firstStep;
  expect(firstSpeed).toBeGreaterThan(0);
  expect(firstSpeed).toBeLessThan(3.1);
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window.concordTest, 'motion').speed))
    .toBeGreaterThan(3.1);
  await page.keyboard.down('Shift');
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window.concordTest, 'motion').speed))
    .toBeGreaterThan(5);
  await page.keyboard.up('w');
  await page.keyboard.up('Shift');
  const release = await page.evaluate(() => window.concordTest.camera.position.z);
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window.concordTest, 'motion').speed))
    .toBe(0);
  const stop = await page.evaluate(() => window.concordTest.camera.position.z);
  expect(release - stop).toBeLessThan(0.25);
  await placePlayer(page, 20, 18);
  await page.keyboard.down('Shift');
  await page.keyboard.down('w');
  await expect
    .poll(() => page.evaluate(() => window.concordTest.camera.position.z))
    .toBeLessThan(16.36);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.concordTest.camera.position.z)).toBeGreaterThanOrEqual(
    16.3,
  );
  await page.keyboard.down('d');
  await expect
    .poll(() => page.evaluate(() => window.concordTest.camera.position.x))
    .toBeGreaterThan(21);
  expect(await page.evaluate(() => window.concordTest.camera.position.z)).toBeGreaterThanOrEqual(
    16.3,
  );
  await page.keyboard.up('w');
  await page.keyboard.up('d');
  await page.keyboard.up('Shift');
  // Start at the west approach, then traverse the entire deck using normal controls.
  await placePlayer(page, 14, 18, -Math.PI / 2);
  await page.keyboard.down('Shift');
  await page.keyboard.down('w');
  await expect
    .poll(() => page.evaluate(() => window.concordTest.camera.position.x), { timeout: 15000 })
    .toBeGreaterThan(36.3);
  await page.keyboard.up('w');
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window.concordTest, 'motion').speed))
    .toBe(0);
  const farBank = await page.evaluate(() => window.concordTest.camera.position.toArray());
  expect(farBank[0]).toBeLessThanOrEqual(38);
  expect(farBank[1]).toBeCloseTo(1.68, 2);
  expect(farBank[2]).toBeCloseTo(18, 2);
  // Walk backward along the same route, proving the far bank is an actual landing.
  await page.keyboard.down('s');
  await expect
    .poll(() => page.evaluate(() => window.concordTest.camera.position.x), { timeout: 15000 })
    .toBeLessThan(14.1);
  await page.keyboard.up('s');
  await page.keyboard.up('Shift');
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window.concordTest, 'motion').speed))
    .toBe(0);
  const westBank = await page.evaluate(() => window.concordTest.camera.position.toArray());
  expect(westBank[1]).toBeCloseTo(1.68, 2);
  expect(westBank[2]).toBeCloseTo(18, 2);
});

for (const target of hotspots) {
  test(`${target.id}: ${interactionDefs[target.id].title} requires its physical actions before the passage`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await setup(page, { act: target.act });
    await enter(page);
    await observeWorld(page);
    await approachObject(page, target.id);
    if (target.id === 'c01') {
      const region = page.getByRole('dialog', { name: interactionDefs.c01.title, exact: true });
      const position = await page.evaluate(() => window.concordTest.camera.position.toArray());
      await page.keyboard.down('w');
      await page.waitForTimeout(300);
      await page.keyboard.up('w');
      const locked = await page.evaluate(() => window.concordTest.camera.position.toArray());
      expect(Math.hypot(locked[0] - position[0], locked[2] - position[2])).toBeLessThan(0.001);
      const action = region.getByRole('button', { name: 'Pull the pin', exact: false });
      const box = (await action.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await expect(region.getByRole('progressbar')).toHaveAttribute(
        'aria-valuenow',
        /^(?:[1-9]|[1-8]\d)$/,
      );
      await page.mouse.up();
      await expect(region.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
      await expect(region.locator('.cn-interaction-prompt')).toHaveText(
        interactionDefs.c01.steps[0].prompt,
      );
      await region.getByRole('button', { name: 'Step away', exact: true }).click();
      await expect(region).toHaveCount(0);
      expect((await saved(page)).collected).not.toContain('c01');
      await page.keyboard.press('e');
      await expect(region.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    }
    await finishInteraction(page, target.id);
    await expect(page.locator('.cn-quotation')).toContainText(
      evidence.find((item) => item.id === target.id)!.quote,
    );
    await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
    await expect(page.locator('.cn-interaction')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('a returning reader can replay a collected scene without changing reading history', async ({
  page,
}) => {
  await setup(page, {
    collected: evidence.map((card) => card.id),
    mastery: { q01: { seen: 3, correct: 2, streak: 1 } },
    missed: ['q02'],
    exams: [{ score: 23, total: 24, date: '2026-10-24T12:00:00.000Z' }],
  });
  await enter(page);
  await observeWorld(page);
  const before = await saved(page);
  await approachObject(page, 'c01');
  await finishInteraction(page, 'c01');
  await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
  expect(await saved(page)).toEqual(before);
  expect(new Set((await saved(page)).collected).size).toBe(12);
});

test('all four conversations require a reply followed by supporting evidence', async ({ page }) => {
  const errors: string[] = [];
  const renderingWarnings: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (/same key|unique.*key/i.test(message.text())) renderingWarnings.push(message.text());
  });
  await setup(page, { collected: evidence.map((card) => card.id) });
  await enter(page);
  async function reply(text: string) {
    await expect(page.locator('.cn-evidence-hand')).toHaveCount(0);
    const next = page.getByRole('button', { name: 'Choose a supporting passage', exact: true });
    await expect(next).toBeDisabled();
    await page.locator('.cn-claim').filter({ hasText: text }).click();
    await next.click();
    await expect(page.locator('.cn-claim-grid')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Commit argument', exact: true })).toBeDisabled();
  }
  for (let act = 0; act < debates.length; act++) {
    await page.getByRole('button', { name: /^Enter the debate/ }).click();
    const debate = debates[act];
    await expect(page.getByRole('dialog', { name: debate.title, exact: true })).toBeVisible();
    if (act === 0) await page.screenshot({ path: 'docs/screenshots/concord-debate.png' });
    for (let index = 0; index < debate.rounds.length; index++) {
      const round = debate.rounds[index];
      const claim = round.claims.find((choice) => choice.correct)!;
      const target = evidence.find((card) => card.id === round.evidenceId)!;
      if (act === 0 && index === 0) {
        const wrong = round.claims.find((choice) => !choice.correct)!;
        await reply(wrong.text);
        await page.locator('.cn-evidence-card').filter({ hasText: target.quote }).click();
        await page.getByRole('button', { name: 'Commit argument', exact: true }).click();
        await expect(page.locator('.cn-feedback')).toContainText(wrong.explanation);
        await page.getByRole('button', { name: 'Revise your argument', exact: true }).click();
      }
      if (act === 1 && index === 0) {
        await reply(claim.text);
        await page
          .locator('.cn-evidence-card')
          .filter({ hasNotText: target.quote })
          .first()
          .click();
        await page.getByRole('button', { name: 'Commit argument', exact: true }).click();
        await expect(page.locator('.cn-feedback')).toContainText('Your reply fits Thoreau');
        await page.getByRole('button', { name: 'Revise your argument', exact: true }).click();
      }
      await reply(claim.text);
      await page.locator('.cn-evidence-card').filter({ hasText: target.quote }).click();
      await page.getByRole('button', { name: 'Commit argument', exact: true }).click();
      await expect(page.locator('.cn-feedback')).toContainText(round.explanation);
      await page
        .getByRole('button', {
          name: index === 2 ? 'Finish the debate' : 'Next objection',
          exact: true,
        })
        .click();
    }
    await expect(page.locator('.cn-debate-victory')).toContainText(
      'You have answered all three objections',
    );
    await expect.poll(async () => (await saved(page)).debates).toContain(act);
    if (act === 0) {
      await page.reload();
      await enter(page);
      continue;
    }
    if (act === 1) await page.keyboard.press('Escape');
    else await page.getByRole('button', { name: 'Continue the night', exact: true }).click();
    const completion = page.getByRole('dialog', { name: 'Act complete', exact: true });
    await expect(completion).toBeVisible();
    if (act === 1) {
      await completion
        .getByRole('button', { name: 'Practice before moving on', exact: true })
        .click();
      await page.getByRole('button', { name: /Back to game/ }).click();
      await page
        .locator('.cn-ready-action')
        .getByRole('button', { name: /^Continue to / })
        .click();
    } else if (act === 2) {
      await completion.getByRole('button', { name: 'Close Act complete', exact: true }).click();
      await page
        .locator('.cn-ready-action')
        .getByRole('button', { name: /^Continue to / })
        .click();
    } else {
      await completion.getByRole('button', { name: 'See your journey', exact: false }).click();
    }
    if (act < 3) {
      await page.getByRole('button', { name: 'Step into the scene', exact: true }).click();
      await expect(page.locator('.cn-world-fallback')).toHaveCount(0);
      if (act === 1) await page.screenshot({ path: 'docs/screenshots/concord-jail.png' });
      if (act === 2) await page.screenshot({ path: 'docs/screenshots/concord-dawn.png' });
    }
  }
  await expect(
    page.getByRole('dialog', { name: 'Your night in Concord', exact: true }),
  ).toBeVisible();
  const progress = await saved(page);
  expect(progress.completed).toBe(true);
  expect(progress.debates).toEqual([0, 1, 2, 3]);
  expect(errors).toEqual([]);
  expect(renderingWarnings).toEqual([]);
});

test('24-question rehearsal withholds answers, explains all choices, saves mastery and clears missed review', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: 'Reading practice', exact: true }).click();
  await expect(page.locator('.cn-study-stats, .cn-practice-grid, .cn-practice-card')).toHaveCount(
    0,
  );
  await expect(page.locator('.cn-practice-choice')).toHaveCount(2);
  const headingContrast = await page.locator('.cn-study-intro h1').evaluate((heading) => {
    const luminance = (color: string) => {
      const channels = color
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number)
        .map((value) => {
          const channel = value / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const ink = luminance(getComputedStyle(heading).color);
    const paper = luminance(getComputedStyle(heading.closest('.cn-study-page')!).backgroundColor);
    return (Math.max(ink, paper) + 0.05) / (Math.min(ink, paper) + 0.05);
  });
  expect(headingContrast).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: 'docs/screenshots/concord-study.png' });
  await page.getByRole('button', { name: 'Rehearse the quiz', exact: true }).click();
  let firstMissed = '';
  const asked: string[] = [];
  for (let i = 0; i < 24; i++) {
    const prompt = await page.locator('.cn-question-session h1').innerText();
    const question = questions.find((item) => item.prompt === prompt)!;
    expect(question).toBeTruthy();
    asked.push(question.id);
    const selected = i === 0 ? (question.answer + 1) % question.options.length : question.answer;
    if (i === 0) firstMissed = question.id;
    await page
      .locator('.cn-quiz-option')
      .filter({ has: page.getByText(question.options[selected], { exact: true }) })
      .click();
    if (i === 0) await page.keyboard.press('1');
    await expect(page.locator('.cn-answer-feedback')).toContainText('Answer recorded');
    await expect(page.locator('.cn-explanation')).toHaveCount(0);
    await page
      .getByRole('button', { name: i === 23 ? 'See my report' : 'Next question', exact: false })
      .click();
  }
  expect(new Set(asked).size).toBe(24);
  await expect(page.locator('.cn-score-ring')).toContainText('96');
  await expect(page.locator('.cn-result-list > details')).toHaveCount(24);
  await page.locator('.cn-result-list > details').first().locator(':scope > summary').click();
  const missed = questions.find((item) => item.id === firstMissed)!;
  await expect(page.locator('.cn-result-list > details').first()).toContainText(missed.explanation);
  await page
    .locator('.cn-result-list > details')
    .first()
    .locator('.cn-answer-reasons > summary')
    .click();
  await expect(
    page.locator('.cn-result-list > details').first().locator('.cn-answer-reasons > div'),
  ).toHaveCount(4);
  await expect(
    page.locator('.cn-result-list > details').first().locator('.cn-answer-reasons > div').last(),
  ).toBeVisible();
  await page
    .getByRole('button', { name: /Read in context/ })
    .first()
    .click();
  await expect(page.locator('dialog[open]')).toContainText('The essay');
  await page.getByRole('button', { name: 'Close passage', exact: true }).click();
  let progress = await saved(page);
  expect(Object.keys(progress.mastery)).toHaveLength(24);
  expect(progress.mastery[firstMissed].seen).toBe(1);
  expect(progress.missed).toEqual([firstMissed]);
  expect(progress.exams).toHaveLength(1);
  expect(progress.exams[0]).toMatchObject({ score: 23, total: 24 });
  await page.reload();
  await page.getByRole('button', { name: 'Reading practice', exact: true }).click();
  await page.locator('.cn-progress-details > summary').click();
  await expect(page.locator('.cn-progress-details')).toContainText('Best rehearsal: 96%');
  await page.getByRole('button', { name: 'Review missed questions', exact: false }).click();
  await expect(page.locator('.cn-question-session h1')).toHaveText(missed.prompt);
  await page
    .locator('.cn-quiz-option')
    .filter({ has: page.getByText(missed.options[missed.answer], { exact: true }) })
    .click();
  await expect(page.locator('.cn-explanation')).toContainText(missed.explanation);
  await page.getByRole('button', { name: 'See my report', exact: false }).click();
  progress = await saved(page);
  expect(progress.missed).toEqual([]);
  expect(progress.mastery[firstMissed]).toMatchObject({ seen: 2, correct: 1, streak: 1 });
  await page.getByRole('button', { name: 'New session', exact: false }).click();
  await expect(page.locator('.cn-question-meta')).toContainText('Practice');
});

test('full essay search, paragraph navigation and empty journal remain useful without story locks', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: 'Reading practice', exact: true }).click();
  await page.getByRole('button', { name: 'The essay', exact: true }).click();
  await expect(page.locator('.cn-source-text > p')).toHaveCount(source.length);
  const search = page.getByRole('textbox', { name: 'Search the essay', exact: true });
  await search.fill('Mexico');
  await expect(page.locator('.cn-source-text > p')).toHaveCount(
    source.filter((p) => p.text.toLowerCase().includes('mexico')).length,
  );
  await search.fill('not-a-word-in-this-essay-xyz');
  await expect(
    page.getByRole('heading', { name: 'No matching passage.', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Show the full essay', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Paragraph', exact: true }).fill('24');
  await page.getByRole('button', { name: 'Go', exact: true }).click();
  await expect(page.locator('.cn-source-text p.highlighted')).toContainText(
    source.find((p) => p.id === 24)!.text,
  );
  await page.getByRole('button', { name: 'Collected passages', exact: true }).click();
  await expect(page.getByText(/Nothing collected yet/)).toBeVisible();
  await page.getByRole('button', { name: 'Browse all passages', exact: true }).click();
  await expect(page.locator('.cn-journal-card')).toHaveCount(12);
  await page
    .locator('.cn-journal-card')
    .first()
    .getByRole('button', { name: /Read paragraph/ })
    .click();
  await expect(page.locator('dialog[open]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});

test('phone layouts fit and touch movement stops when released', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await setup(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/screenshots/concord-phone-title.png' });
  await page.getByRole('button', { name: 'Reading practice', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: /Back to game/ }).click();
  await enter(page);
  await page.screenshot({ path: 'docs/screenshots/concord-phone.png' });
  await observeWorld(page);
  const start = await page.evaluate(() => window.concordTest.camera.position.toArray());
  const forward = (await page
    .getByRole('button', { name: 'Walk forward', exact: true })
    .boundingBox())!;
  await page.mouse.move(forward.x + forward.width / 2, forward.y + forward.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(900);
  await page.mouse.up();
  const moved = await page.evaluate(() => window.concordTest.camera.position.toArray());
  expect(Math.hypot(moved[0] - start[0], moved[2] - start[2])).toBeGreaterThan(0.5);
  await page.waitForTimeout(300);
  const stopped = await page.evaluate(() => window.concordTest.camera.position.toArray());
  expect(Math.hypot(stopped[0] - moved[0], stopped[2] - moved[2])).toBeLessThan(0.2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await approachObject(page, 'c01', true);
  await page.screenshot({ path: 'docs/screenshots/concord-phone-encounter.png' });
  await page.getByRole('button', { name: 'Step away', exact: true }).tap();
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Paused', exact: true })).toBeVisible();
  await context.close();
});

test('built GitHub Pages campaign loads directly, refreshes, links from the hub and preserves settings', async ({
  page,
}) => {
  const base = `http://127.0.0.1:${process.env.ELA_BUILT_PORT ?? '4174'}/dual-credit-ela-iii/`;
  const failed: string[] = [];
  const errors: string[] = [];
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
  });
  page.on('requestfailed', (request) => failed.push(request.url()));
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(
    ({ key, save }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(save));
    },
    { key: SAVE_KEY, save: { ...freshSave(), collected: ['c01'], reduced: true, music: false } },
  );
  await page.goto(base + '#concord');
  await expect(page.getByRole('heading', { name: 'One Night in Concord' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'One Night in Concord' })).toBeVisible();
  const settings = page.getByRole('button', { name: 'Options', exact: true });
  await settings.click();
  const dialog = page.getByRole('dialog', { name: 'Options', exact: true });
  await dialog.getByRole('checkbox', { name: /Night ambience/ }).check();
  await dialog.getByRole('checkbox', { name: /Reduced motion/ }).uncheck();
  await dialog.getByRole('button', { name: 'Reset Concord progress', exact: false }).click();
  await dialog.getByRole('button', { name: 'Keep my progress', exact: true }).click();
  await dialog.getByRole('button', { name: 'Close Options', exact: true }).click();
  await expect(settings).toBeFocused();
  await expect.poll(async () => (await saved(page)).music).toBe(true);
  expect((await saved(page)).reduced).toBe(false);
  expect((await saved(page)).collected).toEqual(['c01']);
  await page.getByRole('button', { name: 'Reading practice', exact: true }).click();
  await page.getByRole('button', { name: 'The essay', exact: true }).click();
  await expect(page.locator('.cn-source-text > p')).toHaveCount(source.length);
  await page.getByRole('textbox', { name: 'Search the essay', exact: true }).fill('conscience');
  await expect(page.locator('.cn-source-text > p')).toHaveCount(
    source.filter((paragraph) => paragraph.text.toLowerCase().includes('conscience')).length,
  );
  await page.goto(base + '#course');
  const card = page.getByRole('link', { name: 'Play Henry David Thoreau', exact: true });
  await expect(card).toHaveAttribute('href', '#concord');
  await card.click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Step into the scene', exact: true }).click();
  await expect(page.locator('.cn-game-shell canvas')).toBeVisible();
  await expect(page.locator('.cn-world-fallback')).toHaveCount(0);
  expect(
    await page.locator('.cn-game-shell canvas').evaluate((canvas) => {
      const gl = (canvas as HTMLCanvasElement).getContext('webgl2');
      return !!gl && !gl.isContextLost() && !!gl.getParameter(gl.VERSION);
    }),
  ).toBe(true);
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});
