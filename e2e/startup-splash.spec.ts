import {test, expect} from '@playwright/test';

test.beforeEach(async ({page}) => {
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({contentType: 'image/png', path: 'e2e/fixtures/tile.png'}));
});
test('cold launch animates then releases home without replaying on navigation or resume', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'no-preference'});
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
  await page.goto('/');
  const splash = page.getByTestId('startup-splash');
  await expect(splash).toBeVisible();
  const startedAt = Date.now();
  await expect(splash.locator('path').first()).toHaveAttribute('stroke-dashoffset', '0', {timeout: 6000});
  await expect(splash).toHaveCount(0, {timeout: 8000});
  expect(Date.now() - startedAt).toBeGreaterThan(4700);
  expect(Date.now() - startedAt).toBeLessThan(7500);
  await page.getByRole('button', {name: 'Open menu', exact: true}).click();
  await page.getByRole('button', {name: 'About PATHFINDER', exact: true}).click();
  await expect(splash).toHaveCount(0);
  await page.getByRole('button', {name: 'Back to home', exact: true}).click();
  await page.evaluate(() => {document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pageshow'));});
  await expect(page.getByRole('button', {name: 'Where to? Search routes'})).toBeVisible();
  await expect(splash).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('reduced motion releases the first-launch onboarding', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('pathfinder.onboarding.v1'));
  await page.reload();
  await expect(page.getByTestId('startup-splash')).toHaveCount(0, {timeout: 8000});
  await expect(page.getByRole('button', {name: 'Skip onboarding', exact: true})).toBeVisible();
});

test('storage initialization failure does not trap startup', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.addInitScript(() => {
    const original = Storage.prototype.getItem;
    let blocked = true;
    window.addEventListener('startup-test-retry', () => {blocked = false;});
    Storage.prototype.getItem = function(key: string) {
      if (blocked && key.startsWith('pathfinder')) throw new Error('Storage unavailable for startup test');
      return original.call(this, key);
    };
  });
  await page.goto('/');
  await expect(page.getByTestId('startup-splash')).toHaveCount(0, {timeout: 8000});
  await expect(page.getByRole('button', {name: 'Retry startup', exact: true})).toBeVisible({timeout: 10000});
  await expect(page.getByRole('button', {name: 'Skip onboarding', exact: true})).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event('startup-test-retry')));
  await page.getByRole('button', {name: 'Retry startup', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Where to? Search routes'})).toBeVisible();
  await expect(page.getByTestId('onboarding')).toHaveCount(0);
});

test('slow initialization shows loading and waits for readiness', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  let release = () => {};
  const fontsReady = new Promise<void>(resolve => {release = resolve;});
  await page.route('**/*.ttf', async route => {await fontsReady; await route.continue();});
  try {
    await page.goto('/', {waitUntil: 'domcontentloaded'});
    await expect(page.getByTestId('startup-loading')).toBeVisible({timeout: 14000});
    await expect(page.getByTestId('startup-splash')).toBeVisible();
    await expect(page.getByRole('button', {name: 'Where to? Search routes'})).toHaveCount(0);
    release();
    await expect(page.getByTestId('startup-splash')).toHaveCount(0, {timeout: 8000});
    await expect(page.getByRole('button', {name: 'Where to? Search routes'})).toBeVisible();
  } finally {release();}
});
