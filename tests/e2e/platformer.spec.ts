import { test, expect, type Page } from '@playwright/test';
import type { PlatformGame } from '../../src/game/platformer';
import { freshSave } from '../../src/lib/game';

declare global {
  interface Window {
    platformTestGame: PlatformGame;
    oscillatorCount: number;
  }
}
const saveKey = 'franklin-path-to-print-v1';
async function observeGame(page: Page) {
  // Attach read access in the test browser only; the shipped game has no test shortcuts.
  await page.evaluate(async () => {
    const path = performance
      .getEntriesByType('resource')
      .find((e) => e.name.includes('/src/game/platformer.ts'))!.name;
    const { PlatformGame } = await import(path);
    const stats = PlatformGame.prototype.stats;
    PlatformGame.prototype.stats = function () {
      window.platformTestGame = this;
      return stats.call(this);
    };
  });
}
async function play(page: Page) {
  await page.goto('/#home');
  await observeGame(page);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.platform-shell')).toHaveClass(/is-playing/);
  await expect.poll(() => page.evaluate(() => !!window.platformTestGame)).toBe(true);
}
async function completeCombatLevel(page: Page) {
  return await page.evaluate(
    () =>
      new Promise<{
        finished: boolean;
        x: number;
        y: number;
        deaths: number;
        remaining: { kind: string; x: number; y: number; hp: number }[];
      }>((resolve) => {
        const game = window.platformTestGame,
          start = performance.now();
        function frame() {
          if (game.finished || performance.now() - start > 75000) {
            for (const input of ['left', 'right', 'jump', 'attack', 'dash', 'interact'] as const)
              game.release(input);
            resolve({
              finished: game.finished,
              x: game.player.x,
              y: game.player.y,
              deaths: game.deaths,
              remaining: game.world.enemies
                .filter((e) => e.alive)
                .map(({ kind, x, y, hp }) => ({ kind, x, y, hp })),
            });
            return;
          }
          const p = game.player;
          const center = p.x + p.w / 2;
          // A missed enemy can be behind us. At a closed gate, return for its remaining
          // enemies instead of endlessly pushing right against the gate.
          const gate = game.world.gates.find((g) => !g.open && Math.abs(g.x - center) < 130);
          const target = game.world.enemies
            .filter(
              (e) => e.alive && (Math.abs(e.x + e.w / 2 - center) < 420 || e.zone === gate?.zone),
            )
            .sort((a, b) => Math.abs(a.x + a.w / 2 - center) - Math.abs(b.x + b.w / 2 - center))[0];
          const weapon = game.world.weapon;
          const distance =
            weapon.speed === 0 || weapon.kind === 'hammer' ? weapon.reach * 0.75 : 260;
          const targetDistance = target ? Math.abs(target.x + target.w / 2 - center) : Infinity;
          // Stop on the same floor as the enemy. Merely comparing top coordinates made
          // the axe wait on a raised platform above the guardian, outside its swing.
          const sameLane = !!target && Math.abs(target.y + target.h - (p.y + p.h)) < 48;
          const shouldFight = !!target && targetDistance < distance && sameLane && p.grounded;
          game.press('attack');
          game.release('left');
          game.release('right');
          const direction = target && target.x + target.w / 2 < center ? 'left' : 'right';
          if (!shouldFight || p.facing !== (direction === 'right' ? 1 : -1)) game.press(direction);
          const standing = game.world.platforms.find(
            (s) => Math.abs(s.y - p.y - p.h) < 3 && p.x + p.w > s.x && p.x < s.x + s.w,
          );
          const sign = direction === 'right' ? 1 : -1;
          const edge = standing ? (sign > 0 ? standing.x + standing.w : standing.x) : center;
          const edgeDistance = sign > 0 ? edge - p.x - p.w : p.x - edge;
          const safeFloor = (x: number, below: number) =>
            game.world.platforms.some((s) => x > s.x && x < s.x + s.w && s.y >= below);
          // A high ledge with ground below is a safe drop, not a gap that needs another
          // jump. This lets melee weapons descend to the guardian's floor naturally.
          const gap =
            p.grounded &&
            standing &&
            !shouldFight &&
            edgeDistance < 85 &&
            !safeFloor(edge + sign * 35, standing.y);
          const recoverGap =
            !p.grounded &&
            p.vy > 100 &&
            p.y > 400 &&
            p.jumps < 2 &&
            !safeFloor(center + sign * 25, p.y + p.h);
          const elevatedTarget =
            p.grounded && target && targetDistance < 145 && target.y + target.h < p.y + p.h - 50;
          const dodge = p.grounded && target && target.state === 'windup' && targetDistance < 150;
          if (gap || recoverGap || elevatedTarget || dodge) game.press('jump');
          else if (p.vy >= 0) game.release('jump');
          game.release('dash');
          if (p.x > game.world.exit.x - 50) {
            game.press('right');
            game.press('interact');
          }
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      }),
  );
}

test('keyboard movement, source conversations, audio, pause, and saved checkpoints work', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.oscillatorCount = 0;
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      window.oscillatorCount++;
      return create.call(this);
    };
  });
  await page.goto('/#home');
  expect(await page.evaluate(() => window.oscillatorCount)).toBe(0);
  await observeGame(page);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.oscillatorCount)).toBeGreaterThan(8);
  await expect
    .poll(() =>
      page.evaluate(
        (k) => Object.keys(JSON.parse(localStorage.getItem(k)!).platformer.checkpoints).length,
        saveKey,
      ),
    )
    .toBeGreaterThan(0);
  await page.keyboard.press('e');
  await expect(page.locator('.platform-dialogue')).toBeVisible();
  await expect(page.locator('.platform-dialogue .source-link')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.platform-dialogue')).toHaveCount(0);
  const initial = await page.evaluate(() => ({
    x: window.platformTestGame.player.x,
    y: window.platformTestGame.player.y,
  }));
  await page.keyboard.down('Space');
  await page.waitForTimeout(180);
  expect(await page.evaluate(() => window.platformTestGame.player.y)).toBeLessThan(initial.y - 40);
  await page.keyboard.up('Space');
  await page.keyboard.down('d');
  await page.keyboard.press('Shift');
  await page.waitForTimeout(450);
  await page.keyboard.up('d');
  expect(await page.evaluate(() => window.platformTestGame.player.x)).toBeGreaterThan(
    initial.x + 100,
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Paused', exact: true })).toBeVisible();
  const pausedAt = await page.evaluate(() => window.platformTestGame.elapsed);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.platformTestGame.elapsed)).toBe(pausedAt);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Mute music and effects', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Enable music and effects', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/platformer-desktop.png' });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Enable music and effects', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('combat clears a full level, saves progress and equips the next chapter weapon', async ({
  page,
}) => {
  await play(page);
  // A controller uses only the public button inputs and observes geometry. It does not
  // teleport the player, remove hazards, collect pages directly, or change scores.
  const result = await completeCombatLevel(page);
  expect(result.finished, JSON.stringify(result)).toBe(true);
  await expect(page.locator('.platform-complete')).toBeVisible();
  const resultStats = await page.evaluate(() => ({
    kills: window.platformTestGame.combat.kills,
    gates: window.platformTestGame.world.gates.map((g) => g.open),
  }));
  expect(resultStats.kills).toBeGreaterThanOrEqual(5);
  expect(resultStats.gates).toEqual([true, true]);
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), saveKey);
  expect(saved.platformer.completed).toContain(0);
  expect(saved.platformer.unlocked).toBe(1);
  expect(saved.unlockedCards.length).toBeGreaterThan(5);
  expect(saved.platformer.bestTimes[0]).toBeGreaterThan(5);
  await page.getByRole('button', { name: 'Next chapter', exact: true }).click();
  await expect(page.locator('.hud-chapter')).toHaveText('II');
  await expect(page.locator('.weapon-badge')).toContainText('Woodcutter’s axe');
  await expect(page.locator('.platform-shell')).toHaveClass(/is-playing/);
  await page.reload();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('.hud-chapter')).toHaveText('II');
  await expect(page.locator('.weapon-badge')).toContainText('Woodcutter’s axe');
});

test('mobile touch controls move Franklin without overflowing or leaving a stuck input', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await play(page);
  const right = await page.getByRole('button', { name: 'Move right', exact: true }).boundingBox();
  const initial = await page.evaluate(() => window.platformTestGame.player.x);
  await page.mouse.move(right!.x + 20, right!.y + 20);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  expect(await page.evaluate(() => window.platformTestGame.player.x)).toBeGreaterThan(initial + 80);
  expect(await page.evaluate(() => window.platformTestGame.controls.right)).toBe(false);
  await page.getByRole('button', { name: 'Attack', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => window.platformTestGame.combat.projectiles.some((s) => !s.enemy)),
    )
    .toBe(true);
  expect(await page.evaluate(() => window.platformTestGame.controls.attack)).toBe(false);
  await page.getByRole('button', { name: 'Jump', exact: true }).click();
  await page.screenshot({ path: 'test-results/platformer-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(844);
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await page.getByRole('button', { name: 'Chapters', exact: true }).click();
  await expect(page.locator('.platform-levels button')).toHaveCount(12);
  await expect(page.locator('.platform-levels button').nth(1)).toBeDisabled();
});

test('axe, returning boomerang and comet staff each complete a real combat level', async ({
  page,
}) => {
  test.setTimeout(300000);
  for (const level of [1, 3, 11]) {
    await page.goto('/#home');
    const save = freshSave();
    save.platformer.level = level;
    save.platformer.unlocked = 11;
    save.platformer.checkpoints[level] = 0;
    await page.evaluate(({ key, save }) => localStorage.setItem(key, JSON.stringify(save)), {
      key: saveKey,
      save,
    });
    await page.reload();
    await observeGame(page);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.platformTestGame?.world.level)).toBe(level);
    const result = await completeCombatLevel(page);
    expect(result.finished, `level ${level + 1}: ${JSON.stringify(result)}`).toBe(true);
    await expect(page.locator('.platform-complete')).toBeVisible();
    expect(
      await page.evaluate(
        () => window.platformTestGame.world.enemies.find((e) => e.kind === 'guardian')!.alive,
      ),
    ).toBe(false);
  }
});
