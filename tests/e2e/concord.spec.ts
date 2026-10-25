import { expect, test, type Page } from '@playwright/test';
import type * as THREE from 'three';
import { debates, evidence, questions, source } from '../../src/concord/data';
import { freshSave, SAVE_KEY, type ConcordSave } from '../../src/concord/save';
import { interactionDefs } from '../../src/concord/interactions';
import { hotspots } from '../../src/concord/navigation';
import {
  conversationActors,
  conversationDialogue,
  conversationHand,
  conversationReply,
} from '../../src/concord/conversation';
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
    // Playwright's controlled clock replaces the resource timing timeline.
    if (!paths.length) paths.push(new URL('/src/concord/scene.ts', location.href).href);
    for (const path of paths) {
      const module = await import(/* @vite-ignore */ path);
      const original = module.ConcordWorld.prototype.drainFootsteps;
      module.ConcordWorld.prototype.drainFootsteps = function () {
        // World samples its sounds each frame, including when paused. Observing that
        // existing call avoids changing the view or waiting for a software-rendered drag.
        if (this.canvas === document.querySelector('.cn-game-shell canvas'))
          window.concordTest = this;
        return original.call(this);
      };
    }
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const world = window.concordTest;
        return (
          !!world &&
          world.canvas.isConnected &&
          world.canvas === document.querySelector('.cn-game-shell canvas') &&
          !world.renderer.getContext().isContextLost()
        );
      }),
    )
    .toBe(true);
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

async function approachSpeaker(page: Page, act: number, touch = false, distance?: number) {
  const actor = conversationActors[act];
  let { x, z } = actor.approach;
  if (distance !== undefined) {
    const dx = x - actor.x,
      dz = z - actor.z,
      length = Math.hypot(dx, dz);
    x = actor.x + (dx / length) * distance;
    z = actor.z + (dz / length) * distance;
  }
  await placePlayer(page, x, z, actor.approach.yaw);
  await expect(page.locator('.cn-talk')).toBeVisible();
  if (touch) await page.locator('.cn-talk').tap();
  else await page.keyboard.press('e');
  await expect(page.locator('.cn-conversation')).toBeVisible();
  await expect(page.locator('.cn-modal-backdrop, .cn-portrait, .cn-debate-victory')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.concordTest.getConversationAnchor().visible))
    .toBe(true);
}

async function revealSpeech(page: Page) {
  const reveal = page.getByRole('button', { name: 'Show whole line', exact: false });
  if (await reveal.isVisible()) await reveal.click();
}

async function expectSpeakerFacingPlayer(page: Page, act: number) {
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const world = window.concordTest;
        const actor = world.scene.children.find((object) => object.userData.actorId === id)!;
        const facing = Math.atan2(
          world.camera.position.x - actor.position.x,
          world.camera.position.z - actor.position.z,
        );
        return Math.abs(
          Math.atan2(Math.sin(actor.rotation.y - facing), Math.cos(actor.rotation.y - facing)),
        );
      }, conversationActors[act].id),
    )
    .toBeLessThan(0.15);
}

async function expectFaceClearOfSpeech(page: Page, act: number) {
  await expectSpeakerFacingPlayer(page, act);
  const face = await page.evaluate((id) => {
    const world = window.concordTest;
    const actor = world.scene.children.find((object) => object.userData.actorId === id)!;
    const head = actor.getObjectByName('Conversation face')!.parent!;
    head.updateWorldMatrix(true, false);
    world.camera.updateMatrixWorld();
    const canvas = world.canvas.getBoundingClientRect();
    const points = [];
    for (const x of [-0.18, 0.18])
      for (const y of [-0.2, 0.23])
        for (const z of [-0.16, 0.18]) {
          const point = head.position
            .clone()
            .set(x, y, z)
            .applyMatrix4(head.matrixWorld)
            .project(world.camera);
          points.push({
            x: canvas.left + (point.x * 0.5 + 0.5) * canvas.width,
            y: canvas.top + (0.5 - point.y * 0.5) * canvas.height,
          });
        }
    return {
      left: Math.min(...points.map((p) => p.x)),
      right: Math.max(...points.map((p) => p.x)),
      top: Math.min(...points.map((p) => p.y)),
      bottom: Math.max(...points.map((p) => p.y)),
    };
  }, conversationActors[act].id);
  const bubble = (await page.locator('.cn-speech').boundingBox())!;
  const overlapWidth = Math.max(
    0,
    Math.min(face.right, bubble.x + bubble.width) - Math.max(face.left, bubble.x),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(face.bottom, bubble.y + bubble.height) - Math.max(face.top, bubble.y),
  );
  expect(
    overlapWidth * overlapHeight,
    'The dialogue must not cover the speaker’s face',
  ).toBeLessThan(4);
}

async function facePose(page: Page, act: number) {
  return page.evaluate((id) => {
    const actor = window.concordTest.scene.children.find(
      (object) => object.userData.actorId === id,
    )!;
    const face = actor.getObjectByName('Conversation face')!;
    const mouth = face.getObjectByName('Conversation mouth') as THREE.Mesh<THREE.BufferGeometry>;
    return {
      expression: actor.userData.expression as string,
      mouth: Array.from(mouth.geometry.getAttribute('position').array),
      brows: ['Left eyebrow', 'Right eyebrow'].map((name) => {
        const brow = face.getObjectByName(name)!;
        return [brow.position.y, brow.rotation.z];
      }),
      eyes: ['Left eye', 'Right eye'].map((name) => face.getObjectByName(name)!.scale.y),
    };
  }, conversationActors[act].id);
}

async function expectExpression(page: Page, act: number, expression: string) {
  await expect.poll(async () => (await facePose(page, act)).expression).toBe(expression);
  const face = await facePose(page, act);
  expect(face.mouth.every(Number.isFinite)).toBe(true);
  expect(Math.max(...face.mouth) - Math.min(...face.mouth)).toBeGreaterThan(0.04);
  return face;
}

async function chooseReply(page: Page, text: string) {
  await revealSpeech(page);
  await expect(page.locator('.cn-reply')).toHaveCount(3);
  await expect(page.locator('.cn-conversation-quote')).toHaveCount(0);
  await page.locator('.cn-reply').filter({ hasText: text }).click();
  await expect(page.locator('.cn-reply')).toHaveCount(0);
  await expect(page.locator('.cn-conversation-quote')).toBeVisible();
}

async function usePassage(page: Page, quote: string, maximum = 4, touch = false) {
  const passage = page.locator('.cn-conversation-quote');
  for (let attempt = 0; attempt < maximum; attempt++) {
    if ((await passage.innerText()).includes(quote)) break;
    const before = await passage.innerText();
    const next = page.getByRole('button', { name: 'Next passage', exact: true });
    if (touch) await next.tap();
    else await next.click();
    await expect(passage).not.toHaveText(before);
  }
  await expect(passage).toContainText(quote);
  const use = page.getByRole('button', { name: 'Use this passage', exact: false });
  if (touch) await use.tap();
  else await use.click();
  await revealSpeech(page);
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
      await expect(region).toContainText(def.steps[index + 1]?.prompt ?? def.completion, {
        timeout: (step.duration ?? 1.2) * 1000 + 5000,
      });
      // Capture a stable step boundary. A correct elapsed-time hold can finish between
      // software-rendered frames, so a transient progress value is not observable here.
      if (capture)
        await page.screenshot({ path: `docs/screenshots/concord-gameplay-${capture}.png` });
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

test('a one-second hold follows elapsed time at four frames per second and cancels on blur', async ({
  page,
}) => {
  const initialTime = Date.parse('2026-10-24T12:00:00.000Z');
  await page.clock.install({ time: initialTime });
  await setup(page);
  await enter(page);
  await observeWorld(page);
  await approachObject(page, 'c01');
  const region = page.getByRole('dialog', { name: interactionDefs.c01.title, exact: true });
  const card = evidence.find((item) => item.id === 'c01')!;
  // Jump beyond loading time and pause. Each fastForward fires animation callbacks once,
  // reproducing a slow renderer without tying this regression to the test machine's GPU.
  await page.clock.pauseAt(initialTime + 300_000);
  await page.keyboard.down('e');
  for (let frame = 0; frame < 3; frame++) await page.clock.fastForward(250);
  const partial = Number(await region.getByRole('progressbar').getAttribute('aria-valuenow'));
  expect(partial).toBeGreaterThanOrEqual(65);
  expect(partial).toBeLessThan(90);
  await expect(region.locator('.cn-interaction-prompt')).toHaveText(
    interactionDefs.c01.steps[0].prompt,
  );
  expect((await saved(page)).collected).not.toContain('c01');
  await expect(page.getByRole('dialog', { name: card.title, exact: true })).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.keyboard.up('e');
  await page.clock.fastForward(1500);
  await expect(region.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  await expect(region.locator('.cn-interaction-prompt')).toHaveText(
    interactionDefs.c01.steps[0].prompt,
  );
  expect((await saved(page)).collected).not.toContain('c01');
  await page.keyboard.down('e');
  for (let frame = 0; frame < 5; frame++) await page.clock.fastForward(250);
  await page.keyboard.up('e');
  await expect(region.locator('.cn-interaction-prompt')).toHaveText(
    interactionDefs.c01.steps[1].prompt,
  );
  expect((await saved(page)).collected).not.toContain('c01');
  await page.clock.resume();
  await region.getByRole('button', { name: 'Unfold the notice', exact: false }).click();
  await expect(region).toContainText(interactionDefs.c01.completion);
  expect((await saved(page)).collected).not.toContain('c01');
  await region.getByRole('button', { name: 'Read Thoreau’s passage', exact: false }).click();
  await expect(page.getByRole('dialog', { name: card.title, exact: true })).toBeVisible();
  await expect.poll(async () => (await saved(page)).collected).toContain('c01');
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
      // The controlled four-FPS test covers partial-hold duration and blur release.
      // Here, cancel before beginning the gesture so no transient frame is required.
      await expect(region.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
      await expect(region.locator('.cn-interaction-prompt')).toHaveText(
        interactionDefs.c01.steps[0].prompt,
      );
      await region.getByRole('button', { name: 'Step away', exact: true }).click();
      await expect(region).toHaveCount(0);
      expect((await saved(page)).collected).not.toContain('c01');
      await expect(page.getByRole('dialog', { name: evidence[0].title, exact: true })).toHaveCount(
        0,
      );
      await page.keyboard.press('e');
      await expect(region.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
      await expect(region.locator('.cn-interaction-prompt')).toHaveText(
        interactionDefs.c01.steps[0].prompt,
      );
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

test('all four debates stay with their 3D speakers through replies, evidence, reactions and farewells', async ({
  page,
}) => {
  const errors: string[] = [];
  const renderingWarnings: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (/same key|unique.*key/i.test(message.text())) renderingWarnings.push(message.text());
  });
  await setup(page, { collected: evidence.map((card) => card.id) });
  await enter(page);
  await observeWorld(page);
  await expect(page.getByRole('button', { name: /^Enter the debate/ })).toHaveCount(0);
  await expect(page.locator('.cn-talk')).toHaveCount(0);
  for (let act = 0; act < debates.length; act++) {
    const actor = conversationActors[act];
    const debate = debates[act];
    await approachSpeaker(page, act);
    await revealSpeech(page);
    await expect(page.locator('.cn-reply')).toHaveCount(3);
    await expect(page.locator('.cn-speech')).toContainText(debate.rounds[0].objection);
    await expectSpeakerFacingPlayer(page, act);
    await expect
      .poll(() =>
        page.evaluate((id) => {
          const actor = window.concordTest.scene.children.find(
            (object) => object.userData.actorId === id,
          );
          return actor?.userData.conversationPhase;
        }, actor.id),
      )
      .toBe('listening');
    const listeningFace = await expectExpression(page, act, 'curious');
    expect(listeningFace.eyes.every((eye) => eye > 0.7)).toBe(true);
    const actorFrame = await page.evaluate((id) => {
      const world = window.concordTest;
      const actor = world.scene.children.find((object) => object.userData.actorId === id)!;
      const bearing = Math.atan2(
        world.camera.position.x - actor.position.x,
        world.camera.position.z - actor.position.z,
      );
      return {
        anchor: world.getConversationAnchor(),
        difference: Math.abs(
          Math.atan2(Math.sin(world.yaw - bearing), Math.cos(world.yaw - bearing)),
        ),
      };
    }, actor.id);
    expect(actorFrame.anchor.visible).toBe(true);
    expect(actorFrame.difference).toBeLessThan(0.55);
    const speechBox = (await page.locator('.cn-speech').boundingBox())!;
    expect(speechBox.x).toBeGreaterThanOrEqual(0);
    expect(speechBox.x + speechBox.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    expect(speechBox.y).toBeGreaterThanOrEqual(0);
    if (act === 0) {
      // Walking away returns control to the world and keeps this exchange ready.
      await page.keyboard.down('w');
      await expect(page.locator('.cn-conversation')).toHaveCount(0);
      await page.keyboard.up('w');
      await approachSpeaker(page, act);
      await revealSpeech(page);
      await expect(page.locator('.cn-speech')).toContainText(debate.rounds[0].objection);
      expect((await saved(page)).debates).toEqual([]);
    }
    if (act === 0) await page.screenshot({ path: 'docs/screenshots/concord-conversation.png' });
    if (act === 2)
      await page.screenshot({ path: 'docs/screenshots/concord-conversation-jail.png' });
    for (let index = 0; index < debate.rounds.length; index++) {
      const round = debate.rounds[index];
      const claim = round.claims.find((choice) => choice.correct)!;
      const target = evidence.find((card) => card.id === round.evidenceId)!;
      const response = conversationDialogue[act][index];
      if (act === 0 && index === 0) {
        const wrong = round.claims.find((choice) => !choice.correct)!;
        await chooseReply(page, conversationReply(act, index, round.claims.indexOf(wrong)));
        await usePassage(page, target.quote);
        await expect(page.locator('.cn-speech')).toContainText(response.wrongClaims[0]);
        await expectExpression(page, act, 'doubtful');
        await expect
          .poll(async () => {
            const pose = await facePose(page, act);
            return Math.max(
              ...pose.brows
                .flat()
                .map((value, index) => Math.abs(value - listeningFace.brows.flat()[index])),
            );
          })
          .toBeGreaterThan(0.02);
        const note = page.locator('.cn-conversation details').first();
        await note.locator('summary').click();
        await expect(note).toContainText(wrong.explanation);
        await expect(page.locator('.cn-modal-backdrop')).toHaveCount(0);
        await page.getByRole('button', { name: 'Let me try again', exact: false }).click();
        expect((await saved(page)).debates).not.toContain(0);
      }
      if (act === 1 && index === 0) {
        await chooseReply(page, conversationReply(act, index, round.claims.indexOf(claim)));
        const wrong = conversationHand(act, index).find((card) => card.id !== target.id)!;
        await usePassage(page, wrong.quote);
        await expect(page.locator('.cn-speech')).toContainText(response.wrongEvidence);
        await page.getByRole('button', { name: 'Let me try again', exact: false }).click();
        expect((await saved(page)).debates).not.toContain(1);
      }
      await chooseReply(page, conversationReply(act, index, round.claims.indexOf(claim)));
      await revealSpeech(page);
      await expect(page.locator('.cn-speech')).toContainText(response.request);
      await expectExpression(page, act, 'thoughtful');
      if (act === 0 && index === 1) {
        await page.getByRole('button', { name: 'Next passage', exact: true }).click();
        const beforeLeaving = await page.locator('.cn-conversation-quote').innerText();
        const quotedId = await page.locator('.cn-conversation-quote').getAttribute('data-evidence');
        const quotedCard = evidence.find((card) => card.id === quotedId)!;
        await page.getByRole('button', { name: 'Read in context', exact: true }).click();
        await expect(page.locator('dialog[open]')).toContainText(
          source.find((paragraph) => paragraph.id === quotedCard.paragraph)!.text,
        );
        await expect(page.locator('dialog[open]')).toHaveCSS('pointer-events', 'auto');
        await expect(page.locator('dialog[open]')).toHaveCSS('text-shadow', 'none');
        await expect(
          page.getByRole('link', { name: 'Read the original source', exact: false }),
        ).toHaveCSS('pointer-events', 'auto');
        await page.getByRole('button', { name: 'Close passage', exact: true }).click();
        await expect(page.locator('dialog[open]')).toHaveCount(0);
        await expect(page.locator('.cn-conversation-quote')).toHaveText(beforeLeaving);
        await page.getByRole('button', { name: 'Read in context', exact: true }).click();
        await expect(page.locator('dialog[open]')).toBeVisible();
        await page.keyboard.press('ArrowRight');
        await expect(page.locator('.cn-conversation')).toHaveCount(1);
        await page.keyboard.press('Escape');
        await expect(page.locator('dialog[open]')).toHaveCount(0);
        await expect(page.locator('.cn-conversation-quote')).toHaveText(beforeLeaving);
        await page.getByRole('button', { name: 'Step away', exact: false }).click();
        await expect(page.locator('.cn-conversation')).toHaveCount(0);
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await approachSpeaker(page, act);
        await revealSpeech(page);
        await expect(page.locator('.cn-conversation-quote')).toHaveText(beforeLeaving);
        await expect(page.locator('.cn-reply')).toHaveCount(0);
        expect((await saved(page)).debates).not.toContain(0);
      }
      await usePassage(page, target.quote);
      await expect(page.locator('.cn-speech')).toContainText(response.agree);
      await expectExpression(page, act, 'warm');
      await expect
        .poll(async () => {
          const warm = await facePose(page, act);
          return Math.max(
            ...warm.mouth.map((value, vertex) => Math.abs(value - listeningFace.mouth[vertex])),
          );
        })
        .toBeGreaterThan(0.002);
      await expect(page.locator('.cn-modal-backdrop, .cn-debate-victory')).toHaveCount(0);
      await page.getByRole('button', { name: 'Go on', exact: false }).click();
    }
    await revealSpeech(page);
    await expect(page.locator('.cn-speech')).toContainText(actor.farewell);
    await expect.poll(async () => (await saved(page)).debates).toContain(act);
    await expect(page.locator('.cn-modal-backdrop, .cn-debate-victory')).toHaveCount(0);
    if (act === 0) {
      // A resolved conversation is saved before the player chooses to leave the scene.
      await page.reload();
      await enter(page);
      await observeWorld(page);
      continue;
    }
    if (act === 1) {
      await page.keyboard.press('Escape');
      await expect(page.locator('.cn-conversation')).toHaveCount(0);
      await expect(page.getByRole('dialog', { name: 'Paused', exact: true })).toHaveCount(0);
      await approachSpeaker(page, act);
      await revealSpeech(page);
      await expect(page.locator('.cn-speech')).toContainText(actor.farewell);
    }
    if (act === 2) {
      await page.getByRole('button', { name: 'Stay a little longer', exact: true }).click();
      await page.getByRole('button', { name: 'Open evidence journal', exact: true }).click();
      await page.getByRole('button', { name: /Back to game/ }).click();
      await observeWorld(page);
      await expect(page.locator('.cn-conversation')).toHaveCount(0);
      await expect.poll(async () => (await saved(page)).debates).toContain(act);
    }
    await page
      .getByRole('button', {
        name: act === 3 ? 'Finish the journey' : /^Continue to /,
        exact: false,
      })
      .click();
    if (act < 3) {
      await page.getByRole('button', { name: 'Step into the scene', exact: true }).click();
      await expect(page.locator('.cn-world-fallback')).toHaveCount(0);
      await observeWorld(page);
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

test('a 3D speaker articulates with their face and hands, then listens and considers the notebook', async ({
  page,
}) => {
  await setup(page, { collected: evidence.map((card) => card.id), reduced: false });
  await enter(page);
  await observeWorld(page);
  await approachSpeaker(page, 0);
  const actorId = conversationActors[0].id;
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const actor = window.concordTest.scene.children.find(
          (object) => object.userData.actorId === id,
        )!;
        return actor.userData.speaking;
      }, actorId),
    )
    .toBe(true);
  const deliverySamples = await page.evaluate(async (id) => {
    const actor = window.concordTest.scene.children.find(
      (object) => object.userData.actorId === id,
    )!;
    const mouth = actor.getObjectByName('Conversation mouth') as THREE.Mesh<THREE.BufferGeometry>;
    const left = actor.getObjectByName('Left forearm')!;
    const right = actor.getObjectByName('Right forearm')!;
    const started = performance.now();
    const samples: { mouth: number; left: number; right: number }[] = [];
    return new Promise<typeof samples>((resolve) => {
      function sample(now: number) {
        if (actor.userData.speaking) {
          const positions = mouth.geometry.getAttribute('position');
          const ys = Array.from({ length: positions.count }, (_, index) => positions.getY(index));
          samples.push({
            mouth: Math.max(...ys) - Math.min(...ys),
            left: left.rotation.x,
            right: right.rotation.x,
          });
        }
        if (now - started < 1100) requestAnimationFrame(sample);
        else resolve(samples);
      }
      requestAnimationFrame(sample);
    });
  }, actorId);
  expect(deliverySamples.length).toBeGreaterThan(1);
  const mouthSamples = deliverySamples.map((sample) => sample.mouth);
  expect(Math.max(...mouthSamples) - Math.min(...mouthSamples)).toBeGreaterThan(0.001);
  const armTravel = (arm: 'left' | 'right') => {
    const samples = deliverySamples.map((sample) => sample[arm]);
    return Math.max(...samples) - Math.min(...samples);
  };
  expect(Math.max(armTravel('left'), armTravel('right'))).toBeGreaterThan(0.025);
  await revealSpeech(page);
  await expect(page.locator('.cn-reply')).toHaveCount(3);
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const actor = window.concordTest.scene.children.find(
          (object) => object.userData.actorId === id,
        )!;
        return { speaking: actor.userData.speaking, phase: actor.userData.conversationPhase };
      }, actorId),
    )
    .toEqual({ speaking: false, phase: 'listening' });
  const listeningFace = await expectExpression(page, 0, 'curious');
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Paused', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.locator('.cn-reply')).toHaveCount(3);
  await expect(page.locator('.cn-modal-backdrop')).toHaveCount(0);
  const round = debates[0].rounds[0];
  const claimIndex = round.claims.findIndex((claim) => claim.correct);
  await chooseReply(page, conversationReply(0, 0, claimIndex));
  await revealSpeech(page);
  await expectExpression(page, 0, 'thoughtful');
  await expect
    .poll(async () => {
      const thinking = await facePose(page, 0);
      return Math.max(
        ...thinking.brows
          .flat()
          .map((value, index) => Math.abs(value - listeningFace.brows.flat()[index])),
      );
    })
    .toBeGreaterThan(0.015);
  await usePassage(page, evidence.find((card) => card.id === round.evidenceId)!.quote);
  await expectExpression(page, 0, 'warm');
  const summary = page.locator('.cn-reading-note > summary');
  await summary.focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Step away', exact: false })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(summary).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.cn-conversation')).toHaveCount(1);
  await page.getByRole('button', { name: 'Step away', exact: false }).click();
  await expect(page.locator('.cn-game-shell canvas')).toBeFocused();
  await approachSpeaker(page, 0, false, 1.05);
  await revealSpeech(page);
  await expect(page.locator('.cn-speech')).toContainText(conversationDialogue[0][0].agree);
  await expectFaceClearOfSpeech(page, 0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const actor = window.concordTest.scene.children.find(
          (object) => object.userData.actorId === 'citizen',
        )!;
        return actor.userData.gesture;
      }),
    )
    .toBe('settled');
  await page.screenshot({ path: 'docs/screenshots/concord-conversation-close.png' });
});

test('phone conversations keep the actor visible and support touch replies and notebook quotations', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await setup(page, { collected: evidence.map((card) => card.id) });
  await enter(page);
  await observeWorld(page);
  await approachSpeaker(page, 0, true, 1.05);
  await revealSpeech(page);
  await expect(page.locator('.cn-reply')).toHaveCount(3);
  await expectSpeakerFacingPlayer(page, 0);
  await expectFaceClearOfSpeech(page, 0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const speechBox = (await page.locator('.cn-speech').boundingBox())!;
  expect(speechBox.x).toBeGreaterThanOrEqual(0);
  expect(speechBox.x + speechBox.width).toBeLessThanOrEqual(391);
  expect(speechBox.y).toBeGreaterThanOrEqual(0);
  expect(speechBox.y + speechBox.height).toBeLessThan(844);
  await page.screenshot({ path: 'docs/screenshots/concord-conversation-phone.png' });
  const round = debates[0].rounds[0];
  const reply = round.claims.find((choice) => choice.correct)!;
  const target = evidence.find((card) => card.id === round.evidenceId)!;
  await page
    .locator('.cn-reply')
    .filter({ hasText: conversationReply(0, 0, round.claims.indexOf(reply)) })
    .tap();
  await revealSpeech(page);
  await expect(page.locator('.cn-conversation-quote')).toContainText(target.quote);
  await page.getByRole('button', { name: 'Next passage', exact: true }).tap();
  await expect(page.locator('.cn-conversation-quote')).not.toContainText(target.quote);
  await page.getByRole('button', { name: 'Previous passage', exact: true }).tap();
  await expect(page.locator('.cn-conversation-quote')).toContainText(target.quote);
  await expectFaceClearOfSpeech(page, 0);
  await page.screenshot({ path: 'docs/screenshots/concord-conversation-phone-notebook.png' });
  await page.getByRole('button', { name: 'Use this passage', exact: false }).tap();
  await revealSpeech(page);
  await expect(page.locator('.cn-speech')).toContainText(conversationDialogue[0][0].agree);
  await page.getByRole('button', { name: 'Step away', exact: false }).tap();
  await expect(page.locator('.cn-conversation')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await saved(page)).debates).toEqual([]);
  await approachSpeaker(page, 0, true, 1.05);
  await revealSpeech(page);
  await page.getByRole('button', { name: 'Go on', exact: false }).tap();
  for (let index = 1; index < debates[0].rounds.length; index++) {
    const round = debates[0].rounds[index];
    await revealSpeech(page);
    await expect(page.locator('.cn-reply')).toHaveCount(3);
    const claimIndex = round.claims.findIndex((claim) => claim.correct);
    await page
      .locator('.cn-reply')
      .filter({ hasText: conversationReply(0, index, claimIndex) })
      .tap();
    await revealSpeech(page);
    await usePassage(page, evidence.find((card) => card.id === round.evidenceId)!.quote, 4, true);
    await page.getByRole('button', { name: 'Go on', exact: false }).tap();
  }
  await revealSpeech(page);
  await expect.poll(async () => (await saved(page)).debates).toEqual([0]);
  await page.getByRole('button', { name: 'Stay a little longer', exact: true }).tap();
  await expect(page.locator('.cn-conversation')).toHaveCount(0);
  await expect(page.locator('.cn-talk')).toBeVisible();
  await expect(page.locator('.cn-ready-action')).toBeVisible();
  const talkBox = (await page.locator('.cn-talk').boundingBox())!;
  const continueBox = (await page.locator('.cn-ready-action').boundingBox())!;
  const overlapWidth = Math.max(
    0,
    Math.min(talkBox.x + talkBox.width, continueBox.x + continueBox.width) -
      Math.max(talkBox.x, continueBox.x),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(talkBox.y + talkBox.height, continueBox.y + continueBox.height) -
      Math.max(talkBox.y, continueBox.y),
  );
  expect(
    overlapWidth * overlapHeight,
    'Continuing the journey must not cover the nearby talk prompt',
  ).toBe(0);
  await page.screenshot({ path: 'docs/screenshots/concord-conversation-phone-complete.png' });
  await context.close();
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
