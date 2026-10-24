import {test, expect} from '@playwright/test';

test.use({storageState: {cookies: [], origins: []}});
test.beforeEach(async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({contentType: 'image/png', path: 'e2e/fixtures/tile.png'}));
});
test('first launch shows all welcome pages and completion is remembered', async ({page}) => {
  await page.goto('/');
  await expect(page.getByTestId('startup-splash')).toBeVisible();
  await expect(page.getByTestId('startup-splash')).toHaveCount(0, {timeout: 10000});
  await expect(page.getByTestId('onboarding')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('pathfinder.onboarding.v1'))).toBeNull();
  await expect.poll(() => page.locator('img[alt="PATHFINDER profile and appearance preview"]').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({path: 'test-results/onboarding-first-412.png'});
  await page.getByRole('button', {name: 'Next onboarding page'}).click();
  await expect(page.getByRole('heading', {name: 'Plan a little. Explore a lot.'})).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('pathfinder.onboarding.v1'))).toBeNull();
  await page.getByRole('button', {name: 'Previous onboarding page'}).click();
  await expect(page.getByRole('heading', {name: 'Your journey. Your way.'})).toBeVisible();
  await page.getByRole('button', {name: 'Onboarding page 3', exact: true}).click();
  await page.getByRole('button', {name: 'Get started', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Where to? Search routes'})).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('pathfinder.onboarding.v1'))).toBe('complete');
  await page.reload();
  await expect(page.getByTestId('startup-splash')).toBeVisible();
  await expect(page.getByTestId('startup-splash')).toHaveCount(0, {timeout: 10000});
  await expect(page.getByRole('button', {name: 'Where to? Search routes'})).toBeVisible();
  await expect(page.getByTestId('onboarding')).toHaveCount(0);
});
test('skip opens home for this session without saving completion', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Skip onboarding', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Where to? Search routes'})).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('pathfinder.onboarding.v1'))).toBeNull();
  await page.reload();
  await expect(page.getByRole('button', {name: 'Skip onboarding', exact: true})).toBeVisible({timeout: 10000});
});

test('captions stay visible after animated page changes', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.goto('/');
  await page.getByRole('button', {name: 'Next onboarding page'}).click();
  await expect(page.getByTestId('onboarding-caption')).toHaveCSS('opacity', '1');
  await expect(page.getByRole('heading', {name: 'Plan a little. Explore a lot.'})).toBeVisible();
  await page.screenshot({path: 'test-results/onboarding-second-animated.png'});
  await page.getByRole('button', {name: 'Next onboarding page'}).click();
  await expect(page.getByTestId('onboarding-caption')).toHaveCSS('opacity', '1');
  await expect(page.getByRole('heading', {name: 'See your route. Find your way.'})).toBeVisible();
});

test('a non-completion preference does not bypass onboarding', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('pathfinder.onboarding.v1', 'false'));
  await page.goto('/');
  await expect(page.getByRole('button', {name: 'Skip onboarding', exact: true})).toBeVisible({timeout: 10000});
  await expect(page.getByRole('button', {name: 'Where to? Search routes'})).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('pathfinder.onboarding.v1'))).toBe('false');
});
