import {test, expect, type Page} from '@playwright/test';
import recorded from './fixtures/osrm-masinag.json';

async function setup(page: Page) {
  await page.emulateMedia({reducedMotion: 'reduce'});
  // Never automate requests to the community tile service.
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({contentType: 'image/png', path: 'e2e/fixtures/tile.png'}));
}
async function roadSearch(page: Page) {
  await page.getByRole('button', {name: 'Where to? Search routes'}).click();
  await page.getByRole('button', {name: 'Road driving routes'}).click();
  await page.getByRole('textbox', {name: 'Origin', exact: true}).fill('SM City Masinag');
  await page.getByRole('button', {name: 'Set destination Cogeo Gate 2'}).click();
}
async function details(page: Page) {
  await page.getByRole('button', {name: 'Open menu'}).click();
  await page.getByRole('button', {name: 'Route details and alternatives'}).click();
}

test('explicit road requests render returned geometry, alternatives, selection, metrics and cached comparisons', async ({page}) => {
  await setup(page);
  let calls = 0;
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  // Second route is a synthetic test-only alternative, not a claim about OSRM's live result.
  const second = {...recorded.routes[0], distance: 8000, duration: 600, geometry: {type: 'LineString', coordinates: [[121.12115,14.62545],[121.143,14.635],[121.16854,14.62141]]}};
  await page.route('https://router.project-osrm.org/**', route => {calls++; return route.fulfill({json: {...recorded, routes: [recorded.routes[0], second]}});});
  await page.goto('/'); await roadSearch(page); expect(calls).toBe(0);
  await page.getByRole('button', {name: 'Compare Routes', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Compare routes', exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Select Driving route 1'})).toContainText('7.3 km');
  await page.getByRole('button', {name: 'Select Driving route 1'}).click();
  await expect(page.locator('.search-slide')).toHaveCount(0);
  const lines = page.locator('.leaflet-overlay-pane path.leaflet-interactive');
  await expect(lines).toHaveCount(2);
  const primary = page.locator('.leaflet-overlay-pane path[stroke="#7ed957"]');
  await expect(primary).toHaveAttribute('stroke-width', '6');
  const alternative = page.locator('.leaflet-overlay-pane path[stroke="#8b9690"]');
  await expect(alternative).toHaveAttribute('stroke-opacity', '0.55');
  const originalShape = await primary.getAttribute('d');
  await alternative.dispatchEvent('click');
  await expect(primary).not.toHaveAttribute('d', originalShape!);
  await details(page);
  await expect(page.getByRole('button', {name: 'Show Driving route 2'})).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', {name: 'Show Driving route 2'})).toContainText('8.0 km');
  await page.getByRole('button', {name: 'Close route details'}).click();
  await page.getByRole('button', {name: 'Recenter selected route'}).click();
  expect(calls).toBe(1);
  await roadSearch(page);
  await page.getByRole('button', {name: 'Compare Routes', exact: true}).click();
  await expect(page.getByText(/Cached OSRM estimates/)).toBeVisible(); expect(calls).toBe(1);
  await page.getByRole('button', {name: 'Back to route results'}).click();
  await page.getByRole('button', {name: 'Back to Plan your ride'}).click();
  await page.getByRole('button', {name: 'Back to map'}).click();
  await details(page); await page.getByRole('button', {name: 'Show transit demo routes'}).click();
  await expect(page.locator('.leaflet-overlay-pane path.leaflet-interactive')).toHaveCount(3);
  await expect(page.getByText('TRANSIT DEMO · NOT LIVE')).toBeVisible();
  expect(errors).toEqual([]);
});

test('GPS is requested only on activation, supplies origin, marker and recentering without routing', async ({page, context}) => {
  await setup(page);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude: 14.62545, longitude: 121.12115, accuracy: 12});
  let calls = 0;
  await page.route('https://router.project-osrm.org/**', route => {calls++; return route.fulfill({json: recorded});});
  await page.addInitScript(() => {
    const get = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    (window as unknown as {gpsCalls: number}).gpsCalls = 0;
    navigator.geolocation.getCurrentPosition = (...args) => { (window as unknown as {gpsCalls: number}).gpsCalls++; get(...args); };
  });
  await page.goto('/'); await roadSearch(page);
  expect(await page.evaluate(() => (window as unknown as {gpsCalls: number}).gpsCalls)).toBe(0);
  await page.getByRole('button', {name: 'Use my location as origin'}).click();
  await expect(page.getByRole('textbox', {name: 'Origin', exact: true})).toHaveValue('Current location');
  expect(calls).toBe(0);
  await page.getByRole('button', {name: 'Find Routes', exact: true}).click();
  await page.getByRole('button', {name: 'View selected route on map'}).click();
  await expect(page.locator('.search-slide')).toHaveCount(0);
  await expect(page.locator('path[fill="#259cff"]')).toHaveCount(1);
  await page.getByRole('button', {name: 'Open menu'}).click();
  await page.getByRole('button', {name: 'Use my location on map'}).click();
  await expect(page.locator('path[fill="#259cff"]')).toBeVisible(); expect(calls).toBe(1);
});

test('GPS denial is actionable and does not prevent manual road routing', async ({page}) => {
  await setup(page);
  await page.addInitScript(() => {
    navigator.permissions.query = async () => ({state: 'denied'}) as PermissionStatus;
  });
  await page.route('https://router.project-osrm.org/**', route => route.fulfill({json: recorded}));
  await page.goto('/'); await roadSearch(page);
  await page.getByRole('button', {name: 'Use my location as origin'}).click();
  await expect(page.getByText(/Location permission was denied/)).toBeVisible();
  await page.getByRole('button', {name: 'Find Routes', exact: true}).click();
  await page.getByRole('button', {name: 'View selected route on map'}).click();
  await expect(page.locator('.search-slide')).toHaveCount(0);
  await expect(page.locator('.leaflet-overlay-pane path.leaflet-interactive')).toHaveCount(1);
});

for (const failure of ['offline', 'no-route', 'server'] as const) {
  test(`routing ${failure} preserves the map and explains recovery`, async ({page}) => {
    await setup(page);
    await page.route('https://router.project-osrm.org/**', route => failure === 'offline' ? route.abort() : route.fulfill(failure === 'no-route' ? {status: 400, json: {code: 'NoRoute'}} : {status: 503, body: 'Unavailable'}));
    await page.goto('/'); await roadSearch(page);
    await page.getByRole('button', {name: 'Find Routes', exact: true}).click();
    await expect(page.getByRole('heading', {name: failure === 'no-route' ? 'No routes found' : 'Routes unavailable', exact: true})).toBeVisible();
    await expect(page.getByText(failure === 'offline' ? /Could not reach/ : failure === 'no-route' ? /No driving route/ : /503/)).toBeVisible();
    await page.getByRole('button', {name: 'Edit journey'}).click();
    await page.getByRole('button', {name: 'Back to map'}).click();
    await expect(page.locator('.leaflet-overlay-pane path.leaflet-interactive')).toHaveCount(0);
  });
}

test('a response arriving after leaving search cannot navigate or replace the map', async ({page}) => {
  await setup(page);
  let respond: () => Promise<void> = async () => {};
  await page.route('https://router.project-osrm.org/**', route => {respond = () => route.fulfill({json: recorded});});
  await page.goto('/'); await roadSearch(page);
  const requested = page.waitForRequest('https://router.project-osrm.org/**');
  await page.getByRole('button', {name: 'Find Routes', exact: true}).click(); await requested;
  await page.getByRole('button', {name: 'Back to map'}).click();
  await respond();
  await expect(page.locator('.search-slide')).toHaveCount(0);
  await expect(page.getByText('CHOOSE YOUR JOURNEY')).toBeVisible();
});
