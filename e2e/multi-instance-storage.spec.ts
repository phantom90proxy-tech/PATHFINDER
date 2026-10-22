import {test, expect, type Page, type BrowserContext} from '@playwright/test';
import {routes} from '../src/data/routes';
import recorded from './fixtures/osrm-masinag.json';
import {parseRoadResponse} from '../src/services/roadRouting';

const savedKey = 'pathfinder.saved-journeys.v1', historyKey = 'pathfinder.journey-history.v1';
test.use({reducedMotion: 'reduce'});
async function entries(page: Page, key: string) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{"items":[]}').items, key);
}
async function results(page: Page) {
  await page.goto('/search'); await page.getByRole('button', {name: 'Public transport demo', exact: true}).click();
  await page.getByRole('textbox', {name: 'Origin', exact: true}).fill('SM City Masinag');
  await page.getByRole('textbox', {name: 'Destination', exact: true}).fill('Cogeo Gate 2');
  await page.getByRole('button', {name: 'Find Routes', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Route results', exact: true})).toBeVisible();
}
async function tabs(context: BrowserContext) {
  const a = await context.newPage(), b = await context.newPage();
  await Promise.all([results(a), results(b)]); return {a, b};
}
async function select(page: Page, index: number) {await page.getByRole('button', {name: `Select ${routes[index].label}`, exact: true}).click();}
async function save(page: Page) {
  await page.getByRole('button', {name: 'Save selected journey', exact: true}).click();
  await expect(page.getByText(/Journey saved on this device\.|This journey is already saved\./)).toBeVisible();
}
test.beforeEach(async ({context}) => {
  await context.route('https://tile.openstreetmap.org/**', route => route.fulfill({contentType: 'image/png', path: 'e2e/fixtures/tile.png'}));
});

test('two tabs retain different saved journeys instead of overwriting a stale hydrated list', async ({context}) => {
  const {a, b} = await tabs(context); await select(b, 1);
  await Promise.all([save(a), save(b)]);
  await expect.poll(async () => (await entries(a, savedKey)).map((x: any) => x.route.id).sort()).toEqual(['route-1', 'route-2']);
});

test('two tabs retain different explicit history selections', async ({context}) => {
  const {a, b} = await tabs(context);
  await Promise.all([select(a, 0), select(b, 1)]);
  await expect.poll(async () => (await entries(a, historyKey)).map((x: any) => x.route.id).sort()).toEqual(['route-1', 'route-2']);
});

test('duplicate saves and selections in two tabs produce one record per identity', async ({context}) => {
  const {a, b} = await tabs(context);
  await Promise.all([select(a, 0), select(b, 0)]); await Promise.all([save(a), save(b)]);
  expect(await entries(a, savedKey)).toHaveLength(1); expect(await entries(b, historyKey)).toHaveLength(1);
});

test('deletion followed by a stale-tab save never restores the deleted record', async ({context}) => {
  const {a, b} = await tabs(context); await save(a); await select(b, 1);
  await a.goto('/saved'); await a.getByRole('button', {name: /^Delete saved journey /}).click();
  await a.getByRole('button', {name: 'Confirm delete journey', exact: true}).click();
  await expect(a.getByText('No saved journeys yet')).toBeVisible();
  await save(b); expect((await entries(a, savedKey)).map((x: any) => x.route.id)).toEqual(['route-2']);
});

test('confirmed history clear followed by another tab selection does not restore old history or alter saves', async ({context}) => {
  const {a, b} = await tabs(context); await select(a, 0); await save(a); const saved = await entries(a, savedKey);
  await a.goto('/history'); await a.getByRole('button', {name: 'Clear History', exact: true}).click();
  await a.getByRole('button', {name: 'Confirm clear history', exact: true}).click();
  await expect(a.getByText('No journey history yet')).toBeVisible();
  await select(b, 1);
  await expect.poll(async () => (await entries(a, historyKey)).map((x: any) => x.route.id)).toEqual(['route-2']);
  await expect(a.getByTestId('history-entry')).toHaveCount(1); expect(await entries(a, savedKey)).toEqual(saved);
});

test('storage events reconcile an already open list; reload retains authoritative entries', async ({context}) => {
  const a = await context.newPage(), b = await context.newPage();
  await results(a); await b.goto('/saved'); await expect(b.getByText('No saved journeys yet')).toBeVisible();
  await save(a); await expect(b.getByRole('button', {name: /^Open saved journey /})).toHaveCount(1);
  await b.reload(); await expect(b.getByRole('button', {name: /^Open saved journey /})).toHaveCount(1);
  await a.goto('/saved'); await a.getByRole('button', {name: /^Delete saved journey /}).click();
  await a.getByRole('button', {name: 'Confirm delete journey', exact: true}).click();
  await expect(b.getByText('No saved journeys yet')).toBeVisible();
});

test('concurrent selections retain at most 20 history entries in newest-first order', async ({context}) => {
  const initial = Array.from({length: 20}, (_, i) => ({id: `seed-${i}`, selectedAt: Date.now() - (20 - i) * 1000,
    route: {...routes[0], id: `seed-service-${i}`}}));
  await context.addInitScript(({key, items}) => {if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({version: 1, items}));}, {key: historyKey, items: initial});
  const {a, b} = await tabs(context); await Promise.all([select(a, 0), select(b, 1)]);
  await expect.poll(async () => (await entries(a, historyKey)).slice(0, 2).map((x: any) => x.route.id).sort()).toEqual(['route-1', 'route-2']);
  const history = await entries(a, historyKey); expect(history).toHaveLength(20);
  expect(history.slice(0, 2).map((x: any) => x.route.id).sort()).toEqual(['route-1', 'route-2']);
  expect(history.map((x: any) => x.selectedAt)).toEqual(history.map((x: any) => x.selectedAt).sort((a: number, b: number) => b - a));
});

for (const failure of ['missing', 'denied']) test(`coordination ${failure} blocks writes without damaging another tab's records`, async ({context}) => {
  const {a, b} = await tabs(context); await save(a); const before = await entries(a, savedKey);
  await b.evaluate(failure => {Object.defineProperty(navigator, 'locks', {configurable: true,
    value: failure === 'missing' ? undefined : {request: () => Promise.reject(new Error('Denied'))}});}, failure);
  await select(b, 1); await b.getByRole('button', {name: 'Save selected journey', exact: true}).click();
  await expect(b.getByText(/Safe cross-tab storage coordination is unavailable/)).toBeVisible();
  expect(await entries(a, savedKey)).toEqual(before); expect(await entries(b, historyKey)).toEqual([]);
  await b.getByRole('button', {name: 'View selected route on map', exact: true}).click();
  await b.getByRole('button', {name: 'Open menu', exact: true}).click();
  await b.getByRole('button', {name: 'Open journey history', exact: true}).click();
  await expect(b.getByRole('alert')).toContainText('Safe cross-tab storage coordination is unavailable');
});

test('a real held lock blocks saved writes, leaves history independent, and times out safely', async ({context}) => {
  const {a, b} = await tabs(context); await b.clock.install();
  await a.evaluate(key => {
    (window as any).lockHeld = false;
    const held = new Promise<void>(resolve => {(window as any).releaseStorageLock = resolve;});
    (window as any).heldLock = navigator.locks.request(`pathfinder.storage:${key}`, () => {(window as any).lockHeld = true; return held;});
  }, savedKey);
  await expect.poll(() => a.evaluate(() => (window as any).lockHeld)).toBe(true);
  try {
    await b.getByRole('button', {name: 'Save selected journey', exact: true}).click();
    await expect(b.getByRole('button', {name: 'Save selected journey', exact: true})).toBeDisabled();
    expect(await entries(a, savedKey)).toEqual([]);
    await select(a, 1); await expect.poll(async () => (await entries(a, historyKey)).length).toBe(1);
    await b.clock.fastForward(5001); await expect(b.getByText(/Storage is busy in another tab/)).toBeVisible();
    expect(await entries(a, savedKey)).toEqual([]);
  } finally {await a.evaluate(async () => {(window as any).releaseStorageLock(); await (window as any).heldLock;});}
  await save(b); expect(await entries(a, savedKey)).toHaveLength(1);
});

test('corruption introduced by another tab cannot be overwritten by a stale save or history selection', async ({context}) => {
  const {a, b} = await tabs(context);
  await a.evaluate(({saved, history}) => {localStorage.setItem(saved, '{corrupt'); localStorage.setItem(history, '{corrupt');}, {saved: savedKey, history: historyKey});
  await b.getByRole('button', {name: 'Save selected journey', exact: true}).click();
  await expect(b.getByText(/Saved journeys could not be read/)).toBeVisible(); await select(b, 1);
  expect(await a.evaluate(key => localStorage.getItem(key), savedKey)).toBe('{corrupt');
  expect(await a.evaluate(key => localStorage.getItem(key), historyKey)).toBe('{corrupt');
});

test('another tab deleting a journey aborts its pending refresh without resurrection', async ({context}) => {
  const road = parseRoadResponse(recorded, {origin: {latitude: 14.62545, longitude: 121.12115}, destination: {latitude: 14.62141, longitude: 121.16854}, originLabel: 'SM City Masinag', destinationLabel: 'Cogeo Gate 2'}, Date.now() - 60000)[0];
  await context.addInitScript(({key, road}) => {if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({version: 1, items: [{id: 'refresh-entry', savedAt: 1000, route: road}]}));}, {key: savedKey, road});
  let started = false, release!: () => void;
  const waiting = new Promise<void>(resolve => {release = resolve;});
  await context.route('https://router.project-osrm.org/**', async route => {started = true; await waiting; await route.fulfill({json: recorded}).catch(() => {});});
  const a = await context.newPage(), b = await context.newPage();
  await Promise.all([a.goto('/saved'), b.goto('/saved')]);
  await a.getByRole('button', {name: /^Open saved journey /}).click();
  await a.getByRole('button', {name: 'Refresh Route', exact: true}).click(); await expect.poll(() => started).toBe(true);
  try {
    await b.getByRole('button', {name: /^Delete saved journey /}).click();
    await b.getByRole('button', {name: 'Confirm delete journey', exact: true}).click();
    await expect(a.getByText('No saved journeys yet')).toBeVisible(); expect(await entries(a, savedKey)).toEqual([]);
  } finally {release();}
  // Do not rerun the one-time seed script: inspect the surviving tab directly.
  expect(await entries(b, savedKey)).toEqual([]);
});
