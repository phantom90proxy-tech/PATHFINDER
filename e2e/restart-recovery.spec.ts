import {test, expect, type Page} from '@playwright/test';
import recorded from './fixtures/osrm-masinag.json';
import {routes} from '../src/data/routes';

const key = 'pathfinder.restart-recovery.v1';
const origin = {latitude: 14.62545, longitude: 121.12115}, destination = {latitude: 14.62141, longitude: 121.16854};
const recovery = () => ({version: 1, origin: {query: 'Station', place: {label: 'Station north', point: origin}},
  destination: {query: 'Station', place: {label: 'Station south', point: destination}}, preference: 'Fastest', searchMode: 'driving', cleared: false,
  journey: {kind: 'road', id: 'old-route', label: 'Driving route 1', origin: 'Station north', destination: 'Station south',
    coordinates: [origin, destination], requestedEndpoints: {origin, destination}, color: '#7ed957', fetchedAt: Date.now() - 86_400_000,
    durationSeconds: 600, distanceMeters: 3000}});
async function seed(page: Page, data: unknown) {
  await page.addInitScript(({key, raw}) => {if (!sessionStorage.getItem('recovery-seeded')) {
    localStorage.setItem(key, raw); sessionStorage.setItem('recovery-seeded', 'yes');
  }}, {key, raw: typeof data === 'string' ? data : JSON.stringify(data)});
}
async function menu(page: Page) {await page.getByRole('button', {name: 'Open menu', exact: true}).click();}
async function search(page: Page) {await page.getByRole('button', {name: 'Where to? Search routes'}).click();}
async function stored(page: Page) {return page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), key);}
test.beforeEach(async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({contentType: 'image/png', path: 'e2e/fixtures/tile.png'}));
});

test('cold start restores old route, original time and endpoints without Photon, OSRM or GPS', async ({page}) => {
  const data = recovery(); await seed(page, data);
  let requests = 0;
  await page.route(/https:\/\/(photon\.komoot\.io|router\.project-osrm\.org)\//, route => {requests++; return route.abort();});
  await page.addInitScript(() => {navigator.geolocation.getCurrentPosition = () => {throw new Error('Unexpected GPS request');};});
  await page.goto('/'); await expect(page.getByText(/Restored journey — previously retrieved/)).toBeVisible();
  await menu(page); await page.getByRole('button', {name: 'Route details and alternatives'}).click();
  await expect(page.getByRole('button', {name: 'Show Driving route 1'})).toBeVisible();
  await expect(page.getByText(/OSRM driving estimate from/)).toContainText('No live traffic');
  await page.getByRole('button', {name: 'Close route details'}).click();
  await search(page); await expect(page.getByRole('textbox', {name: 'Origin', exact: true})).toHaveValue('Station');
  await expect(page.getByRole('textbox', {name: 'Destination', exact: true})).toHaveValue('Station');
  expect((await stored(page)).journey.fetchedAt).toBe(data.journey.fetchedAt); expect(requests).toBe(0);
  await page.evaluate(() => {document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('pageshow'));});
  expect(requests).toBe(0); expect((await stored(page)).journey.fetchedAt).toBe(data.journey.fetchedAt);
});

test('restored identical-name endpoints route without reconfirmation and later edits replace recovered inputs', async ({page}) => {
  await seed(page, recovery()); let photon = 0, roads = 0;
  await page.route('https://photon.komoot.io/**', route => {photon++; return route.abort();});
  await page.route('https://router.project-osrm.org/**', route => {roads++; return route.fulfill({json: recorded});});
  await page.goto('/'); await search(page); await page.getByRole('button', {name: 'Find Routes', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Route results', exact: true})).toBeVisible(); expect(roads).toBe(1); expect(photon).toBe(0);
  await page.getByRole('button', {name: 'Back to Plan your ride'}).click();
  await page.getByRole('textbox', {name: 'Origin', exact: true}).fill('Edited input');
  await expect.poll(async () => (await stored(page)).origin.query).toBe('Edited input');
  await page.reload(); await expect(page.getByRole('textbox', {name: 'Origin', exact: true})).toHaveValue('Edited input');
  expect((await stored(page)).origin.place).toBeUndefined(); expect((await stored(page)).destination.place.point).toEqual(destination);
});

test('only explicit selection survives restart; saving and history remain independent when recovery is discarded', async ({page}) => {
  await page.route('https://router.project-osrm.org/**', route => route.fulfill({json: recorded}));
  await page.goto('/'); await search(page);
  await page.getByRole('textbox', {name: 'Origin', exact: true}).fill('SM City Masinag');
  await page.getByRole('textbox', {name: 'Destination', exact: true}).fill('Cogeo Gate 2');
  await page.getByRole('button', {name: 'Find Routes', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Route results', exact: true})).toBeVisible();
  await expect.poll(async () => (await stored(page))?.origin.place?.point).toBeTruthy(); expect((await stored(page)).journey).toBeNull();
  await page.getByRole('button', {name: 'Select Driving route 1'}).click();
  await page.getByRole('button', {name: 'Save selected journey'}).click();
  await expect(page.getByText('Journey saved on this device.', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'View selected route on map'}).click();
  await expect.poll(async () => (await stored(page)).journey?.label).toBe('Driving route 1');
  await page.reload(); await expect(page.getByText(/Restored journey — previously retrieved/)).toBeVisible();
  const others = await page.evaluate(() => [localStorage.getItem('pathfinder.saved-journeys.v1'), localStorage.getItem('pathfinder.journey-history.v1')]);
  await menu(page); await page.getByRole('button', {name: 'Discard restart recovery', exact: true}).click();
  await page.getByRole('button', {name: 'Keep recovered journey'}).click(); await expect(page.getByText(/Restored journey — previously retrieved/)).toBeVisible();
  await menu(page); await page.getByRole('button', {name: 'Discard restart recovery', exact: true}).click();
  await page.getByRole('button', {name: 'Confirm discard recovery'}).click();
  await expect(page.getByText('CHOOSE YOUR JOURNEY', {exact: true})).toBeVisible(); await page.reload();
  await expect(page.getByText('CHOOSE YOUR JOURNEY', {exact: true})).toBeVisible();
  expect(await page.evaluate(() => [localStorage.getItem('pathfinder.saved-journeys.v1'), localStorage.getItem('pathfinder.journey-history.v1')])).toEqual(others);
  await search(page); await expect(page.getByRole('textbox', {name: 'Origin', exact: true})).toHaveValue('');
});

test('corrupt and incompatible storage leave application usable and require explicit discard', async ({page}) => {
  await seed(page, '{"version":999}'); await page.goto('/');
  await expect(page.getByText(/Restart recovery could not be read/)).toBeVisible();
  await search(page); await page.getByRole('textbox', {name: 'Origin', exact: true}).fill('New input');
  await page.getByRole('button', {name: 'Back to map', exact: true}).click();
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe('{"version":999}');
  await menu(page); await page.getByRole('button', {name: 'Discard restart recovery', exact: true}).click();
  await page.getByRole('button', {name: 'Confirm discard recovery'}).click();
  await expect(page.getByText(/Restart recovery could not be read/)).toHaveCount(0);
  await expect.poll(async () => (await stored(page)).version).toBe(1);
});

test('empty startup restores draft text and existing preferences without launching a search', async ({page}) => {
  await page.goto('/'); await search(page); await page.getByRole('button', {name: 'Public transport demo'}).click();
  await page.getByRole('button', {name: 'Sort by Fastest', exact: true}).click();
  await page.getByRole('textbox', {name: 'Origin', exact: true}).fill('Draft only');
  await expect.poll(async () => (await stored(page))?.origin.query).toBe('Draft only'); await page.reload();
  await expect(page.getByRole('textbox', {name: 'Origin', exact: true})).toHaveValue('Draft only');
  await expect(page.getByRole('button', {name: 'Public transport demo'})).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', {name: 'Sort by Fastest', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', {name: 'Route results', exact: true})).toHaveCount(0); expect((await stored(page)).journey).toBeNull();
});

test('previous GPS origin restores as a fixed endpoint and does not request a fresh fix', async ({page}) => {
  const data = recovery(); data.origin.query = 'Current location'; data.origin.place.label = 'Current location'; data.journey.origin = 'Current location';
  await seed(page, data); let requests = 0;
  await page.route('https://router.project-osrm.org/**', route => {requests++; return route.fulfill({json: recorded});});
  await page.addInitScript(() => {navigator.geolocation.getCurrentPosition = () => {throw new Error('Unexpected GPS request');};});
  await page.goto('/'); await search(page);
  await expect(page.getByRole('textbox', {name: 'Origin', exact: true})).toHaveValue('Previous starting point');
  expect(requests).toBe(0); await page.getByRole('button', {name: 'Find Routes', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Route results', exact: true})).toBeVisible(); expect(requests).toBe(1);
});

test('reversed demo restores its original summary and direction without reversing twice', async ({page}) => {
  const route = routes[0];
  await seed(page, {...recovery(), searchMode: 'demo', journey: {...route, origin: route.destination, destination: route.origin,
    label: `${route.destination} - ${route.origin}`, coordinates: [...route.coordinates].reverse()}});
  await page.goto('/'); await expect(page.getByText(/Restored journey — previously retrieved/)).toBeVisible();
  await menu(page); await page.getByRole('button', {name: 'Route details and alternatives'}).click();
  await expect(page.getByRole('button', {name: `Show ${route.destination} - ${route.origin}`})).toBeVisible();
  await expect(page.getByText(/Public-transport demo data/)).toBeVisible();
  await page.getByRole('button', {name: `Show ${route.destination} - ${route.origin}`}).click();
  await expect.poll(async () => (await stored(page)).journey.origin).toBe(route.destination);
});

test('identical-name swap survives restart without another persistence-triggering action or automatic requests', async ({page}) => {
  const data = recovery(); await seed(page, data); let photon = 0, osrm = 0, requested = '';
  await page.addInitScript(() => {
    (window as any).swapGPSCalls = 0;
    navigator.geolocation.getCurrentPosition = () => {(window as any).swapGPSCalls++;};
  });
  await page.route('https://photon.komoot.io/**', route => {photon++; return route.abort();});
  await page.route('https://router.project-osrm.org/**', route => {osrm++; requested = route.request().url(); return route.fulfill({json: recorded});});
  await page.goto('/search'); await page.getByRole('button', {name: 'Swap origin and destination', exact: true}).click();
  await expect.poll(async () => (await stored(page)).origin.place).toEqual(data.destination.place);
  await page.reload(); await expect(page.getByRole('textbox', {name: 'Origin', exact: true})).toHaveValue('Station');
  const restored = await stored(page);
  expect(restored.origin).toEqual(data.destination); expect(restored.destination).toEqual(data.origin);
  expect(restored.journey).toEqual(data.journey); expect(osrm).toBe(0); expect(photon).toBe(0);
  expect(await page.evaluate(() => (window as any).swapGPSCalls)).toBe(0);
  await page.getByRole('button', {name: 'Find Routes', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Route results', exact: true})).toBeVisible();
  expect(requested).toContain('121.168540,14.621410;121.121150,14.625450'); expect(photon).toBe(0);
});

for (const identical of [true, false]) test(`repeated ${identical ? 'identical-name' : 'different-name'} swaps restore the final labels and coordinates`, async ({page}) => {
  const data = recovery();
  if (!identical) {data.origin.query = 'North'; data.destination.query = 'South';}
  await seed(page, data);
  await page.goto('/search');
  for (let count = 1; count <= 3; count++) {
    await page.getByRole('button', {name: 'Swap origin and destination', exact: true}).click();
    await expect.poll(async () => (await stored(page)).origin).toEqual(count % 2 ? data.destination : data.origin);
  }
  await page.reload(); await expect(page.getByRole('textbox', {name: 'Origin', exact: true})).toHaveValue(data.destination.query);
  await expect(page.getByRole('textbox', {name: 'Destination', exact: true})).toHaveValue(data.origin.query);
  expect((await stored(page)).origin.place).toEqual(data.destination.place); expect((await stored(page)).destination.place).toEqual(data.origin.place);
});

for (const endpoint of ['origin', 'destination'] as const) test(`swap followed by rapid ${endpoint} edits preserves the other swapped confirmation after restart`, async ({page}) => {
  const data = recovery(); await seed(page, data); await page.goto('/search');
  await page.getByRole('button', {name: 'Swap origin and destination', exact: true}).click();
  const field = page.getByRole('textbox', {name: endpoint === 'origin' ? 'Origin' : 'Destination', exact: true});
  await field.fill('First draft'); await field.fill('Final draft');
  await expect.poll(async () => (await stored(page))[endpoint].query).toBe('Final draft');
  await page.reload(); await expect(page.getByRole('textbox', {name: endpoint === 'origin' ? 'Origin' : 'Destination', exact: true})).toHaveValue('Final draft');
  const restored = await stored(page), other = endpoint === 'origin' ? 'destination' : 'origin';
  expect(restored[endpoint].place).toBeUndefined(); expect(restored[other]).toEqual(data[endpoint]);
  expect(restored.journey).toEqual(data.journey);
});
