import {test, expect, type Locator} from '@playwright/test';
import {nativeMapHTML} from '../src/map/nativeLeaflet';

async function target(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(48);
  expect(box!.height).toBeGreaterThanOrEqual(48);
}
test.beforeEach(async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({contentType: 'image/png', path: 'e2e/fixtures/tile.png'}));
});
for (const width of [320, 412]) test(`shared Home and modal controls meet 48px at ${width}px`, async ({page}) => {
  await page.setViewportSize({width, height: 917});
  await page.goto('/');
  await target(page.getByRole('button', {name: 'Recenter selected route', exact: true}));
  await page.getByRole('button', {name: 'Open menu', exact: true}).click();
  await target(page.getByRole('button', {name: 'Close panel', exact: true}));
  await page.getByRole('button', {name: 'Route details and alternatives', exact: true}).click();
  await target(page.getByRole('button', {name: 'Close route details', exact: true}));
  await page.getByRole('button', {name: 'Close route details', exact: true}).click();
  await page.getByRole('button', {name: 'Open menu', exact: true}).click();
  await page.getByRole('button', {name: 'Discard restart recovery', exact: true}).click();
  await target(page.getByRole('button', {name: 'Confirm discard recovery', exact: true}));
  await page.getByRole('button', {name: 'Keep recovered journey', exact: true}).click();
  await page.getByRole('button', {name: 'Open menu', exact: true}).click();
  await page.getByRole('button', {name: 'Close panel', exact: true}).click();
  await page.getByRole('button', {name: 'Open profile', exact: true}).click();
  await target(page.getByRole('button', {name: 'Close panel', exact: true}));
});
test('Android Leaflet tile retry has a 48px target and recovers after failure', async ({page}) => {
  await page.setContent(nativeMapHTML());
  await expect(page.locator('img.leaflet-tile-loaded').first()).toBeVisible();
  await page.locator('img.leaflet-tile-loaded').first().evaluate(image => image.dispatchEvent(new Event('error')));
  const retry = page.getByRole('button', {name: 'Retry tiles', exact: true});
  await target(retry);
  await retry.click();
  await expect(page.locator('#retry')).toBeDisabled();
  await expect(page.locator('#error')).not.toBeVisible();
});
