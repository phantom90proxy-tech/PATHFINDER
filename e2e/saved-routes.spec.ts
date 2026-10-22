import {test, expect, type Page} from '@playwright/test';
import recorded from './fixtures/osrm-masinag.json';

const key = 'pathfinder.saved-journeys.v1';
test.beforeEach(async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({contentType: 'image/png', path: 'e2e/fixtures/tile.png'}));
});
async function saved(page: Page) {
  await page.getByRole('button', {name: 'Open menu'}).click();
  await page.getByRole('button', {name: 'Open saved routes'}).click();
}
async function find(page: Page) {
  await page.getByRole('button', {name: 'Where to? Search routes'}).click();
  await page.getByRole('textbox', {name: 'Origin', exact: true}).fill('SM City Masinag');
  await page.getByRole('textbox', {name: 'Destination', exact: true}).fill('Cogeo Gate 2');
  await page.getByRole('button', {name: 'Find Routes', exact: true}).click();
}

test('save, deduplicate, restart, view offline and confirm deletion without changing the active trip', async ({page, context}) => {
  let roads = 0;
  await page.route('https://router.project-osrm.org/**', route => {roads++; return route.fulfill({json: recorded});});
  await page.goto('/'); await saved(page);
  await expect(page.getByText('No saved journeys yet')).toBeVisible();
  await page.getByRole('button', {name: 'Back to map', exact: true}).click();
  await find(page);
  await page.getByRole('button', {name: 'Save selected journey'}).click();
  await expect(page.getByText('Journey saved on this device.', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Save selected journey'}).click();
  await expect(page.getByText('This journey is already saved.')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Select Driving route 1'})).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', {name: 'View selected route on map'}).click();
  await saved(page);
  await expect(page.getByRole('button', {name: /^Open saved journey /})).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('button', {name: /^Open saved journey /})).toHaveCount(1);
  await context.setOffline(true);
  await page.getByRole('button', {name: /^Open saved journey /}).click();
  const details = page.getByTestId('saved-journey-details');
  await expect(details).toContainText('7.3 km');
  await expect(page.getByText(/Maps and navigation still require their own connectivity/)).toBeVisible();
  expect(roads).toBe(1);
  await page.getByRole('button', {name: 'Delete saved journey', exact: true}).click();
  await page.getByRole('button', {name: 'Cancel deletion'}).click();
  await expect(details).toBeVisible();
  await page.getByRole('button', {name: 'Delete saved journey', exact: true}).click();
  await page.getByRole('button', {name: 'Confirm delete journey'}).click();
  await expect(page.getByText('No saved journeys yet')).toBeVisible();
  await context.setOffline(false); await page.reload();
  await expect(page.getByText('No saved journeys yet')).toBeVisible();
});

test('saving alternatives and deleting one preserves the other and the active selection', async ({page}) => {
  await page.route('https://router.project-osrm.org/**', route => route.fulfill({json: {...recorded, routes: [recorded.routes[0],
    {...recorded.routes[0], geometry: {type: 'LineString', coordinates: [[121.12115,14.62545],[121.143,14.635],[121.16854,14.62141]]}},
  ]}}));
  await page.goto('/'); await find(page);
  await page.getByRole('button', {name: 'Save selected journey'}).click();
  await expect(page.getByText('Journey saved on this device.', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Select Driving route 2'}).click();
  await page.getByRole('button', {name: 'Save selected journey'}).click();
  await expect(page.getByText('Journey saved on this device.', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'View selected route on map'}).click();
  await saved(page);
  await expect(page.getByRole('button', {name: /^Open saved journey /})).toHaveCount(2);
  await page.getByRole('button', {name: /^Delete saved journey .*Driving route 1$/}).click();
  await page.getByRole('button', {name: 'Confirm delete journey'}).click();
  await expect(page.getByRole('button', {name: /^Open saved journey /})).toHaveCount(1);
  await page.getByRole('button', {name: 'Back to map', exact: true}).click();
  await page.getByRole('button', {name: 'Open menu'}).click();
  await page.getByRole('button', {name: 'Route details and alternatives'}).click();
  await expect(page.getByRole('button', {name: 'Show Driving route 2'})).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', {name: 'Save selected journey'}).click();
  await expect(page.getByText('This journey is already saved.')).toBeVisible();
});

test('corrupt local data shows recovery feedback and is not overwritten', async ({page}) => {
  await page.goto('/');
  await page.evaluate(key => localStorage.setItem(key, '{broken'), key);
  await page.reload(); await saved(page);
  await expect(page.getByRole('alert')).toContainText('Saved journeys could not be read');
  await page.getByRole('button', {name: 'Retry saved storage'}).click();
  await expect(page.getByRole('alert')).toContainText('Existing data has not been changed');
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe('{broken');
});

test('unavailable storage fails gracefully and can be retried', async ({page}) => {
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) {if (key === 'pathfinder.saved-journeys.v1') throw new Error('Unavailable'); return get.call(this, key);};
    (window as any).restoreSavedStorage = () => {Storage.prototype.getItem = get;};
  });
  await page.goto('/'); await saved(page);
  await expect(page.getByRole('alert')).toContainText('could not be read');
  await page.evaluate(() => (window as any).restoreSavedStorage());
  await page.getByRole('button', {name: 'Retry saved storage'}).click();
  await expect(page.getByText('No saved journeys yet')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
