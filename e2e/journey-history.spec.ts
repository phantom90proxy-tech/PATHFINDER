import {test, expect, type Page} from '@playwright/test';
import recorded from './fixtures/osrm-masinag.json';
import {routes} from '../src/data/routes';

const historyKey = 'pathfinder.journey-history.v1', savedKey = 'pathfinder.saved-journeys.v1';
async function entries(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{"items":[]}').items, historyKey);
}
async function history(page: Page) {
  await page.getByRole('button', {name: 'Open menu'}).click();
  await page.getByRole('button', {name: 'Open journey history'}).click();
}
async function find(page: Page) {
  await page.getByRole('button', {name: 'Where to? Search routes'}).click();
  await page.getByRole('textbox', {name: 'Origin', exact: true}).fill('SM City Masinag');
  await page.getByRole('textbox', {name: 'Destination', exact: true}).fill('Cogeo Gate 2');
  await page.getByRole('button', {name: 'Find Routes', exact: true}).click();
}
test.beforeEach(async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({contentType: 'image/png', path: 'e2e/fixtures/tile.png'}));
});

test('empty history excludes GPS alone, incomplete searches and unconfirmed places', async ({page}) => {
  await page.addInitScript(() => {
    navigator.permissions.query = async () => ({state: 'granted'}) as PermissionStatus;
    navigator.geolocation.getCurrentPosition = success => success({coords: {latitude: 14.62545, longitude: 121.12115, accuracy: 10}, timestamp: Date.now()} as GeolocationPosition);
  });
  await page.route('https://photon.komoot.io/**', route => route.fulfill({json: {features: [
    {geometry: {type: 'Point', coordinates: [121.1, 14.6]}, properties: {name: 'Candidate station'}},
  ]}}));
  let roads = 0;
  await page.route('https://router.project-osrm.org/**', route => {roads++; return route.abort();});
  await page.goto('/'); await history(page);
  await expect(page.getByText('No journey history yet')).toBeVisible();
  await page.getByRole('button', {name: 'Back to map', exact: true}).click();
  await page.getByRole('button', {name: 'Open menu'}).click();
  await page.getByRole('button', {name: 'Use my location on map'}).click();
  await expect(page.getByText('Location updated', {exact: true})).toBeVisible();
  expect(await entries(page)).toHaveLength(0);
  await page.getByRole('button', {name: 'Where to? Search routes'}).click();
  await page.getByRole('button', {name: 'Find Routes', exact: true}).click();
  await expect(page.getByRole('alert')).toContainText('Enter both');
  await page.getByRole('button', {name: 'Edit journey', exact: true}).click();
  await page.getByRole('textbox', {name: 'Origin', exact: true}).fill('Unconfirmed station');
  await page.getByRole('textbox', {name: 'Destination', exact: true}).fill('Cogeo Gate 2');
  await page.getByRole('button', {name: 'Find Routes', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Candidate station', exact: true})).toBeVisible();
  expect(await entries(page)).toHaveLength(0); expect(roads).toBe(0);
  await page.getByRole('button', {name: 'Back to Plan your ride'}).click();
  await page.getByRole('button', {name: 'Back to map', exact: true}).click();
  await history(page); await expect(page.getByText('No journey history yet')).toBeVisible();
});

test('failed route requests and unselected successful results do not create history', async ({page}) => {
  await page.route('https://router.project-osrm.org/**', route => route.fulfill({status: 503, body: 'Unavailable'}));
  await page.goto('/'); await find(page);
  await expect(page.getByRole('alert')).toContainText('503');
  expect(await entries(page)).toHaveLength(0);
  await page.getByRole('button', {name: 'Back to Plan your ride'}).click();
  await page.getByRole('button', {name: 'Back to map', exact: true}).click();
  await page.reload();
  await page.route('https://router.project-osrm.org/**', route => route.fulfill({json: recorded}));
  await find(page);
  await expect(page.getByRole('heading', {name: 'Route results', exact: true})).toBeVisible();
  expect(await entries(page)).toHaveLength(0);
});

test('confirmed routes deduplicate, persist, retain active selection when viewed, and stay independent of saves', async ({page}) => {
  let requests = 0;
  await page.route('https://router.project-osrm.org/**', route => {requests++; return route.fulfill({json: {...recorded, routes: [recorded.routes[0],
    {...recorded.routes[0], geometry: {type: 'LineString', coordinates: [[121.12115,14.62545],[121.143,14.635],[121.16854,14.62141]]}},
  ]}});});
  await page.goto('/'); await find(page);
  await page.getByRole('button', {name: 'Select Driving route 2'}).click();
  await expect.poll(async () => (await entries(page)).map((item: any) => item.route.label)).toEqual(['Driving route 2']);
  await page.getByRole('button', {name: 'Select Driving route 1'}).click();
  await expect.poll(async () => (await entries(page)).map((item: any) => item.route.label)).toEqual(['Driving route 1', 'Driving route 2']);
  const previousTime = (await entries(page))[0].selectedAt;
  await page.getByRole('button', {name: 'Save selected journey'}).click();
  await expect(page.getByText('Journey saved on this device.', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'View selected route on map'}).click();
  await expect.poll(async () => (await entries(page))[0].selectedAt).toBeGreaterThanOrEqual(previousTime);
  const beforeView = await entries(page);
  await history(page);
  await expect(page.getByTestId('history-entry')).toHaveCount(2);
  await expect(page.getByTestId('history-entry').first()).toContainText('Driving route 1');
  await page.getByRole('button', {name: /^Open history journey .*Driving route 2$/}).click();
  await expect(page.getByTestId('history-journey-details')).toContainText('Driving route 2');
  await expect(page.getByText(/Previously retrieved information/)).toBeVisible();
  expect(await entries(page)).toEqual(beforeView); expect(requests).toBe(1);
  await page.getByRole('button', {name: 'Back to journey history'}).click();
  await page.getByRole('button', {name: 'Back to map', exact: true}).click();
  await page.getByRole('button', {name: 'Open menu'}).click();
  await page.getByRole('button', {name: 'Route details and alternatives'}).click();
  await expect(page.getByRole('button', {name: 'Show Driving route 1'})).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', {name: 'Close route details'}).click();
  await page.getByRole('button', {name: 'Open menu'}).click();
  await page.getByRole('button', {name: 'Open saved routes'}).click();
  await page.getByRole('button', {name: /^Delete saved journey /}).click();
  await page.getByRole('button', {name: 'Confirm delete journey'}).click();
  await expect(page.getByText('No saved journeys yet')).toBeVisible();
  expect(await entries(page)).toEqual(beforeView);
  await page.getByRole('button', {name: 'Back to map', exact: true}).click();
  await page.getByRole('button', {name: 'Open menu'}).click();
  await page.getByRole('button', {name: 'Route details and alternatives'}).click();
  await page.getByRole('button', {name: 'Save selected journey'}).click();
  await expect(page.getByText('Journey saved on this device.', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Close route details'}).click();
  const savedData = await page.evaluate(key => localStorage.getItem(key), savedKey);
  await history(page); await page.reload();
  await expect(page.getByTestId('history-entry')).toHaveCount(2);
  await page.getByRole('button', {name: /^Delete history journey .*Driving route 2$/}).click();
  await page.getByRole('button', {name: 'Confirm delete history journey'}).click();
  await expect(page.getByTestId('history-entry')).toHaveCount(1);
  await page.getByRole('button', {name: 'Clear History', exact: true}).click();
  await page.getByRole('button', {name: 'Cancel history deletion'}).click();
  await expect(page.getByTestId('history-entry')).toHaveCount(1);
  await page.getByRole('button', {name: 'Clear History', exact: true}).click();
  await page.getByRole('button', {name: 'Confirm clear history'}).click();
  await expect(page.getByText('No journey history yet')).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), savedKey)).toBe(savedData);
  await page.reload(); await expect(page.getByText('No journey history yet')).toBeVisible();
});

test('recording a new confirmed route evicts only the oldest of 20 history entries', async ({page}) => {
  await page.route('https://router.project-osrm.org/**', route => route.fulfill({json: recorded}));
  await page.goto('/');
  const now = Date.now();
  await page.evaluate(({key, route, now}) => localStorage.setItem(key, JSON.stringify({version: 1, items: Array.from({length: 20}, (_, i) => ({
    id: `old-${i}`, selectedAt: now - (i + 1) * 1000, route: {...route, id: `service-${i}`, origin: `Past ${i}`},
  }))})), {key: historyKey, route: routes[0], now});
  await page.reload(); await find(page);
  await page.getByRole('button', {name: 'View selected route on map'}).click();
  await history(page);
  await expect(page.getByTestId('history-entry')).toHaveCount(20);
  await expect(page.getByTestId('history-entry').first()).toContainText('Driving route 1');
  const items = await entries(page);
  expect(items.some((item: any) => item.route.origin === 'Past 19')).toBe(false);
  expect(items.at(-1).route.origin).toBe('Past 18');
});

test('corrupt history is preserved until confirmed clearing, without altering saved routes', async ({page}) => {
  await page.goto('/');
  await page.evaluate(({historyKey, savedKey, route}) => {
    localStorage.setItem(historyKey, '{broken');
    localStorage.setItem(savedKey, JSON.stringify({version: 1, items: [{id: 'saved-fixture', savedAt: Date.now(), route}]}));
  }, {historyKey, savedKey, route: routes[0]});
  await page.reload(); await history(page);
  await expect(page.getByRole('alert')).toContainText('Journey history could not be read');
  await page.getByRole('button', {name: 'Retry history storage'}).click();
  await expect(page.getByRole('alert')).toContainText('Existing data has not been changed');
  expect(await page.evaluate(key => localStorage.getItem(key), historyKey)).toBe('{broken');
  const saved = await page.evaluate(key => localStorage.getItem(key), savedKey);
  await page.getByRole('button', {name: 'Clear History', exact: true}).click();
  await page.getByRole('button', {name: 'Cancel history deletion'}).click();
  expect(await page.evaluate(key => localStorage.getItem(key), historyKey)).toBe('{broken');
  await page.getByRole('button', {name: 'Clear History', exact: true}).click();
  await page.getByRole('button', {name: 'Confirm clear history'}).click();
  await expect(page.getByText('No journey history yet')).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), savedKey)).toBe(saved);
});

test('history write failure does not block route selection; retry can record the active route', async ({page}) => {
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {if (key === 'pathfinder.journey-history.v1') throw new Error('Quota'); return set.call(this, key, value);};
    (window as any).restoreHistoryStorage = () => {Storage.prototype.setItem = set;};
  });
  await page.route('https://router.project-osrm.org/**', route => route.fulfill({json: recorded}));
  await page.goto('/'); await find(page);
  await page.getByRole('button', {name: 'View selected route on map'}).click();
  await history(page);
  await expect(page.getByRole('alert')).toContainText('Could not update journey history');
  expect(await entries(page)).toHaveLength(0);
  await page.evaluate(() => (window as any).restoreHistoryStorage());
  await page.getByRole('button', {name: 'Back to map', exact: true}).click();
  await page.getByRole('button', {name: 'Open menu'}).click();
  await page.getByRole('button', {name: 'Route details and alternatives'}).click();
  await page.getByRole('button', {name: 'Show Driving route 1'}).click();
  await page.getByRole('button', {name: 'Close route details'}).click();
  await history(page); await expect(page.getByTestId('history-entry')).toHaveCount(1);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
