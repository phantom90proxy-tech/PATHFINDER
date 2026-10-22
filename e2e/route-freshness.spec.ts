import {test, expect} from '@playwright/test';
import recorded from './fixtures/osrm-masinag.json';

test('fresh and cached results age while visible, resume accurately, and refresh only on request', async ({page}) => {
  let calls = 0;
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({contentType: 'image/png', path: 'e2e/fixtures/tile.png'}));
  await page.route('https://router.project-osrm.org/**', route => {calls++; return route.fulfill({json: recorded});});
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', {name: 'Where to? Search routes'}).click();
  await page.getByRole('textbox', {name: 'Origin', exact: true}).fill('SM City Masinag');
  await page.getByRole('textbox', {name: 'Destination', exact: true}).fill('Cogeo Gate 2');
  await page.getByRole('button', {name: 'Find Routes', exact: true}).click();
  const freshness = page.getByTestId('route-freshness');
  await expect(freshness).toContainText('Fetched OSRM driving estimates. Data retrieved less than 1 minute ago.');
  await expect(freshness).toContainText('No live traffic, fares or crowd data.');
  await page.clock.fastForward(120_000);
  await expect(freshness).toContainText('2 minutes ago');
  await page.getByRole('button', {name: 'Back to Plan your ride'}).click();
  await page.getByRole('button', {name: 'Compare Routes', exact: true}).click();
  await expect(freshness).toContainText('Cached OSRM estimates. Data retrieved 2 minutes ago.');
  expect(calls).toBe(1);
  // Simulate tab visibility and a wall-clock jump without executing timers.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {configurable: true, value: 'hidden'});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.setSystemTime(new Date(Date.now() + 600_000));
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {configurable: true, value: 'visible'});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(freshness).toContainText('Outside the 5-minute cache window. Search again to refresh.');
  await expect(freshness).not.toContainText('2 minutes ago');
  expect(calls).toBe(1);
  await page.getByRole('button', {name: 'Back to route results'}).click();
  await page.getByRole('button', {name: 'Back to Plan your ride'}).click();
  await page.getByRole('button', {name: 'Find Routes', exact: true}).click();
  await expect(freshness).toContainText('Fetched OSRM driving estimates. Data retrieved less than 1 minute ago.');
  await expect(freshness).not.toContainText('Outside');
  expect(calls).toBe(2);
});
