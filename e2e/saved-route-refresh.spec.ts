import {test, expect, type Page} from '@playwright/test';
import recorded from './fixtures/osrm-masinag.json';
import {parseRoadResponse} from '../src/services/roadRouting';

const key = 'pathfinder.saved-journeys.v1';
const request = {origin: {latitude: 14.62545, longitude: 121.12115}, destination: {latitude: 14.62141, longitude: 121.16854}, originLabel: 'SM City Masinag', destinationLabel: 'Cogeo Gate 2'};
const oldTime = Date.now() - 86_400_000;
const road = parseRoadResponse(recorded, request, oldTime)[0];
const changedBody = {...recorded, routes: [{...recorded.routes[0], distance: 8400, duration: 1200,
  geometry: {type: 'LineString', coordinates: [[121.12115, 14.62545], [121.143, 14.635], [121.16854, 14.62141]]}}]};
const updatedBody = {...recorded, routes: [{...recorded.routes[0], distance: 8000, duration: 1200}]};
async function items(page: Page) {return page.evaluate(key => JSON.parse(localStorage.getItem(key)!).items, key);}
async function seed(page: Page, routes = [road]) {
  await page.addInitScript(({key, routes, road}) => {
    if (!sessionStorage.getItem('refresh-seeded')) {
      localStorage.setItem(key, JSON.stringify({version: 1, items: routes.map((route, i) => ({id: `saved-${i}`, savedAt: 1000 + i, route}))}));
      localStorage.setItem('pathfinder.journey-history.v1', JSON.stringify({version: 1, items: [{id: 'history-original', selectedAt: Date.now(), route: road}]}));
      localStorage.setItem('pathfinder.restart-recovery.v1', JSON.stringify({version: 1,
        origin: {query: road.origin}, destination: {query: road.destination}, preference: 'Cheapest', searchMode: 'driving', cleared: false, journey: road}));
      sessionStorage.setItem('refresh-seeded', 'yes');
    }
    const fetcher = window.fetch;
    (window as any).refreshAborts = 0;
    window.fetch = (input, options) => {
      if (String(input).includes('router.project-osrm.org')) options?.signal?.addEventListener('abort', () => {(window as any).refreshAborts++;});
      return fetcher(input, options);
    };
  }, {key, routes, road});
}
async function open(page: Page, label = 'Driving route 1') {
  await page.goto('/'); await page.getByRole('button', {name: 'Open menu'}).click();
  await page.getByRole('button', {name: 'Open saved routes'}).click();
  await page.getByRole('button', {name: `Open saved journey SM City Masinag → Cogeo Gate 2 ${label}`, exact: true}).click();
}
test.beforeEach(async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({contentType: 'image/png', path: 'e2e/fixtures/tile.png'}));
});

test('manual refresh updates metrics/time only on demand, bypasses fresh cache, and preserves active/history/recovery', async ({page}) => {
  await seed(page); let calls = 0;
  await page.clock.install();
  await page.route('https://router.project-osrm.org/**', route => {
    calls++; expect(route.request().url()).toContain('121.121150,14.625450;121.168540,14.621410');
    return route.fulfill({json: updatedBody});
  });
  await open(page); expect(calls).toBe(0); const before = (await items(page))[0];
  const independent = await page.evaluate(() => [localStorage.getItem('pathfinder.journey-history.v1'), localStorage.getItem('pathfinder.restart-recovery.v1')]);
  await page.getByRole('button', {name: 'Refresh Route', exact: true}).click();
  await expect(page.getByText(/Saved route updated/)).toBeVisible();
  await expect(page.getByTestId('saved-journey-details')).toContainText('8.0 km');
  const after = (await items(page))[0]; expect(after.id).toBe(before.id); expect(after.savedAt).toBe(before.savedAt);
  expect(after.route.fetchedAt).toBeGreaterThan(before.route.fetchedAt); expect(after.route.durationSeconds).toBe(1200);
  await page.clock.fastForward(5001); await page.getByRole('button', {name: 'Refresh Route', exact: true}).click();
  await expect.poll(() => calls).toBe(2); await expect(page.getByText(/Saved route updated/)).toBeVisible();
  expect(await page.evaluate(() => [localStorage.getItem('pathfinder.journey-history.v1'), localStorage.getItem('pathfinder.restart-recovery.v1')])).toEqual(independent);
  await page.getByRole('button', {name: 'Back to saved routes', exact: true}).click();
  await page.getByRole('button', {name: 'Back to map', exact: true}).click();
  await page.getByRole('button', {name: 'Open menu'}).click(); await page.getByRole('button', {name: 'Route details and alternatives'}).click();
  await expect(page.getByText(/7.3 km/)).toBeVisible();
  await page.reload(); expect((await items(page))[0].route.distanceMeters).toBe(8000);
});

test('changed geometry and missing alternative require explicit confirmation; keeping original changes nothing', async ({page}) => {
  await seed(page); await page.clock.install();
  await page.route('https://router.project-osrm.org/**', route => route.fulfill({json: changedBody}));
  await open(page); const before = await items(page);
  await page.getByRole('button', {name: 'Refresh Route', exact: true}).click();
  await expect(page.getByText(/saved alternative could not be matched/)).toBeVisible(); expect(await items(page)).toEqual(before);
  await page.getByRole('button', {name: 'Keep original saved route'}).click();
  await expect(page.getByText(/Original saved route was kept/)).toBeVisible(); expect(await items(page)).toEqual(before);
  await page.clock.fastForward(5001); await page.getByRole('button', {name: 'Refresh Route', exact: true}).click();
  await page.getByRole('button', {name: 'Confirm replacement with Driving route 1'}).click();
  await expect(page.getByText(/Saved route updated/)).toBeVisible(); const after = await items(page);
  expect(after).toHaveLength(1); expect(after[0].id).toBe(before[0].id); expect(after[0].route.coordinates).not.toEqual(before[0].route.coordinates);
  expect(after[0].route.distanceMeters).toBe(8400);
});

for (const exit of ['cancel', 'details back', 'navigation back']) test(`pending refresh aborts on ${exit}, and a late result cannot update saved data`, async ({page}) => {
  await seed(page); let release!: () => void, started = false;
  const wait = new Promise<void>(resolve => {release = resolve;});
  await page.route('https://router.project-osrm.org/**', async route => {started = true; await wait; await route.fulfill({json: updatedBody}).catch(() => {});});
  await open(page); const before = await items(page);
  await page.getByRole('button', {name: 'Refresh Route', exact: true}).click(); await expect.poll(() => started).toBe(true);
  await expect(page.getByText('Requesting updated road routes…', {exact: true})).toBeVisible();
  if (exit === 'cancel') await page.getByRole('button', {name: 'Cancel refresh'}).click();
  else if (exit === 'details back') await page.getByRole('button', {name: 'Back to saved routes', exact: true}).click();
  else await page.goBack();
  await expect.poll(() => page.evaluate(() => (window as any).refreshAborts)).toBe(1); release();
  expect(await items(page)).toEqual(before);
  if (exit === 'cancel') await expect(page.getByText(/Refresh cancelled. Existing saved details/)).toBeVisible();
});

test('timeout and network failure preserve the original saved snapshot', async ({page}) => {
  await seed(page); await page.clock.install(); let release!: () => void, started = false;
  const wait = new Promise<void>(resolve => {release = resolve;});
  await page.route('https://router.project-osrm.org/**', async route => {started = true; await wait; await route.abort().catch(() => {});});
  await open(page); const before = await items(page);
  await page.getByRole('button', {name: 'Refresh Route', exact: true}).click(); await expect.poll(() => started).toBe(true);
  await page.clock.fastForward(15001); await expect(page.getByRole('alert')).toContainText('timed out'); release(); expect(await items(page)).toEqual(before);
  await page.unroute('https://router.project-osrm.org/**');
  await page.route('https://router.project-osrm.org/**', route => route.abort());
  await page.getByRole('button', {name: 'Refresh Route', exact: true}).click();
  await expect(page.getByRole('alert')).toContainText('connection'); expect(await items(page)).toEqual(before);
});

test('replacement cannot duplicate another saved route', async ({page}) => {
  const alternative = parseRoadResponse(changedBody, request, oldTime)[0];
  await seed(page, [road, {...alternative, label: 'Driving route 2'}]);
  await page.route('https://router.project-osrm.org/**', route => route.fulfill({json: changedBody}));
  await open(page); const before = await items(page); await page.getByRole('button', {name: 'Refresh Route', exact: true}).click();
  await page.getByRole('button', {name: 'Confirm replacement with Driving route 1'}).click();
  await expect(page.getByText(/This updated route is already saved/).first()).toBeVisible(); expect(await items(page)).toEqual(before);
});

test('deleting while refresh is pending cancels it and cannot recreate the deleted journey', async ({page}) => {
  await seed(page); let release!: () => void, started = false;
  const wait = new Promise<void>(resolve => {release = resolve;});
  await page.route('https://router.project-osrm.org/**', async route => {started = true; await wait; await route.fulfill({json: updatedBody}).catch(() => {});});
  await open(page); await page.getByRole('button', {name: 'Refresh Route', exact: true}).click(); await expect.poll(() => started).toBe(true);
  await page.getByRole('button', {name: 'Delete saved journey', exact: true}).click();
  await page.getByRole('button', {name: 'Confirm delete journey'}).click(); await expect(page.getByText('No saved journeys yet')).toBeVisible();
  release(); expect(await items(page)).toEqual([]); await page.reload(); await expect(page.getByText('No saved journeys yet')).toBeVisible();
});

test('storage write failure preserves the prior snapshot; corrupted storage is never overwritten', async ({page}) => {
  await seed(page); await page.clock.install();
  await page.route('https://router.project-osrm.org/**', route => route.fulfill({json: updatedBody}));
  await open(page); const before = await items(page);
  await page.evaluate(key => {
    const setter = Storage.prototype.setItem;
    Storage.prototype.setItem = function(name, value) {if (name === key) throw new Error('Full'); return setter.call(this, name, value);};
    (window as any).restoreWrites = () => {Storage.prototype.setItem = setter;};
  }, key);
  await page.getByRole('button', {name: 'Refresh Route', exact: true}).click();
  await expect(page.getByText(/Could not update saved journeys/).first()).toBeVisible(); expect(await items(page)).toEqual(before);
  await expect(page.getByTestId('saved-journey-details')).toContainText('7.3 km');
  await page.evaluate(key => {(window as any).restoreWrites(); localStorage.setItem(key, '{damaged');}, key);
  await page.clock.fastForward(5001); await page.getByRole('button', {name: 'Refresh Route', exact: true}).click();
  await expect(page.getByText(/Saved journeys could not be read/).first()).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe('{damaged');
});
