import {test, expect, type Page} from '@playwright/test';

const locations = {
  Park: {label: 'Rizal Park', city: 'Manila', point: [120.98,14.58]},
  Fort: {label: 'Fort Santiago', city: 'Manila', point: [120.97,14.6]},
};
test.beforeEach(async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({contentType: 'image/png', path: 'e2e/fixtures/tile.png'}));
});
async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', {name: 'Where to? Search routes'}).click();
}

for (const textScale of [1, 2]) test(`place attribution and Unicode labels remain readable at ${textScale}x text size`, async ({page}) => {
  await page.setViewportSize({width: 360, height: 740});
  const attribution = 'Location search: Photon · © OpenStreetMap contributors.';
  const place = 'Café Peñafrancia – 東京, Antipolo';
  await page.route('https://photon.komoot.io/**', route => route.fulfill({json: {features: [
    {geometry: {type: 'Point', coordinates: [121.1, 14.6]}, properties: {name: 'Café Peñafrancia – 東京', city: 'Antipolo'}},
  ]}}));
  await page.route('https://router.project-osrm.org/**', route => route.fulfill({json: {code: 'Ok', routes: [
    {distance: 2000, duration: 300, geometry: {type: 'LineString', coordinates: [[121.1, 14.6], [121.2, 14.5]]}},
  ]}}));
  await start(page);
  await expect(page.getByText(attribution, {exact: false})).toBeVisible();
  await page.getByRole('textbox', {name: 'Origin', exact: true}).fill('Café Peñafrancia – 東京');
  await page.getByRole('textbox', {name: 'Destination', exact: true}).fill('14.5,121.2');
  await page.getByRole('button', {name: 'Find Routes', exact: true}).click();
  const credit = page.getByText(attribution, {exact: true});
  if (textScale === 2) await credit.evaluate(element => {
    const style = getComputedStyle(element);
    element.style.fontSize = `${parseFloat(style.fontSize) * 2}px`;
    element.style.lineHeight = `${parseFloat(style.lineHeight) * 2}px`;
  });
  await credit.scrollIntoViewIfNeeded();
  await expect(credit).toBeVisible();
  await expect(credit).toHaveText(attribution);
  const layout = await credit.evaluate(element => ({
    width: element.getBoundingClientRect().width, viewport: window.innerWidth,
    clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
    clientHeight: element.clientHeight, scrollHeight: element.scrollHeight,
  }));
  expect(layout.width).toBeLessThanOrEqual(layout.viewport);
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
  expect(layout.scrollHeight).toBeLessThanOrEqual(layout.clientHeight + 1);
  await page.getByRole('button', {name: place, exact: true}).click();
  await expect(page.getByTestId('discovery-origin')).toHaveText(place);
});
test('startup has empty inputs, no route layers, no navigation trip and required validation', async ({page}) => {
  let requests = 0;
  await page.route(/photon\.komoot|router\.project-osrm/, route => {requests++; return route.abort();});
  await page.goto('/');
  await expect(page.getByTestId('interactive-map')).toBeVisible();
  await expect(page.locator('.leaflet-marker-icon, .leaflet-overlay-pane path')).toHaveCount(0);
  await page.getByRole('button', {name: 'Open menu'}).click();
  await page.getByRole('button', {name: 'Route details and alternatives'}).click();
  await expect(page.getByText('Search for a journey to see route details.')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Navigate with Google Maps'})).toHaveCount(0);
  await page.getByRole('button', {name: 'Close route details'}).click();
  await page.getByRole('button', {name: 'Where to? Search routes'}).click();
  await expect(page.getByPlaceholder('Where are you starting?')).toHaveValue('');
  await expect(page.getByPlaceholder('Where do you want to go?')).toHaveValue('');
  await expect(page.getByRole('button', {name: 'Road driving routes'})).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', {name: 'Find Routes', exact: true}).click();
  await expect(page.getByRole('alert')).toContainText('Enter both');
  expect(requests).toBe(0);
});
test('confirmed arbitrary places drive results, comparison, Google Maps and reversed trips', async ({page, context}) => {
  const requested: string[] = [];
  await page.route('https://photon.komoot.io/**', route => {
    const place = locations[new URL(route.request().url()).searchParams.get('q') as keyof typeof locations];
    return route.fulfill({json: {features: place ? [{geometry: {type: 'Point', coordinates: place.point}, properties: {name: place.label, city: place.city}}] : []}});
  });
  await page.route('https://router.project-osrm.org/**', route => {
    requested.push(route.request().url());
    const coords = new URL(route.request().url()).pathname.split('/').pop()!.split(';').map(pair => pair.split(',').map(Number));
    return route.fulfill({json: {code: 'Ok', routes: [{distance: 3000, duration: 600, geometry: {type: 'LineString', coordinates: coords}}]}});
  });
  await context.route('https://www.google.com/maps/**', route => route.fulfill({body: 'External directions'}));
  await start(page);
  await page.getByRole('textbox', {name: 'Origin', exact: true}).fill('Park');
  await page.getByRole('textbox', {name: 'Destination', exact: true}).fill('Fort');
  expect(requested).toHaveLength(0);
  await page.getByRole('button', {name: 'Find Routes', exact: true}).click();
  await page.getByRole('button', {name: 'Rizal Park, Manila', exact: true}).click();
  await page.getByRole('button', {name: 'Fort Santiago, Manila', exact: true}).click();
  await expect(page.getByTestId('discovery-origin')).toHaveText('Rizal Park, Manila');
  await expect(page.getByTestId('discovery-destination')).toHaveText('Fort Santiago, Manila');
  expect(requested[0]).toContain('120.980000,14.580000;120.970000,14.600000');
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', {name: 'Navigate with Google Maps'}).click();
  const tab = await popup; await tab.waitForURL('https://www.google.com/maps/**');
  const url = new URL(tab.url());
  expect(url.searchParams.get('origin')).toBe('14.58,120.98');
  expect(url.searchParams.get('destination')).toBe('14.6,120.97');
  await tab.close();
  await page.getByRole('button', {name: 'Back to Plan your ride'}).click();
  await page.getByRole('button', {name: 'Compare Routes', exact: true}).click();
  await page.getByRole('button', {name: 'Select Driving route 1'}).click();
  await page.getByRole('button', {name: 'Open menu'}).click();
  await page.getByRole('button', {name: 'Route details and alternatives'}).click();
  await expect(page.getByText('Rizal Park, Manila → Fort Santiago, Manila', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Close route details'}).click();
  await page.getByRole('button', {name: 'Where to? Search routes'}).click();
  await page.getByRole('button', {name: 'Swap origin and destination'}).click();
  // Preserve OSRM's existing request throttle.
  await page.waitForTimeout(5100);
  await page.getByRole('button', {name: 'Find Routes', exact: true}).click();
  await expect(page.getByTestId('discovery-origin')).toHaveText('Fort Santiago, Manila');
  expect(requested[1]).toContain('120.970000,14.600000;120.980000,14.580000');
});

test('identical place queries are confirmed independently and survive reversal', async ({page}) => {
  const requested: string[] = [];
  await page.route('https://photon.komoot.io/**', route => route.fulfill({json: {features: [
    {geometry: {type: 'Point', coordinates: [121.1, 14.6]}, properties: {name: 'Central Station', city: 'North City'}},
    {geometry: {type: 'Point', coordinates: [121.2, 14.5]}, properties: {name: 'Central Station', city: 'South City'}},
  ]}}));
  await page.route('https://router.project-osrm.org/**', route => {
    requested.push(route.request().url());
    const coordinates = new URL(route.request().url()).pathname.split('/').pop()!.split(';').map(pair => pair.split(',').map(Number));
    return route.fulfill({json: {code: 'Ok', routes: [{distance: 2000, duration: 300, geometry: {type: 'LineString', coordinates}}]}});
  });
  await start(page);
  await page.getByRole('textbox', {name: 'Origin', exact: true}).fill('Central Station');
  await page.getByRole('textbox', {name: 'Destination', exact: true}).fill('Central Station');
  await page.getByRole('button', {name: 'Find Routes', exact: true}).click();
  await expect(page.getByText('Choose your origin.', {exact: false})).toBeVisible();
  await page.getByRole('button', {name: 'Central Station, North City', exact: true}).click();
  await expect(page.getByText('Choose your destination.', {exact: false})).toBeVisible();
  expect(requested).toHaveLength(0);
  await page.getByRole('button', {name: 'Central Station, South City', exact: true}).click();
  await expect(page.getByTestId('discovery-origin')).toHaveText('Central Station, North City');
  await expect(page.getByTestId('discovery-destination')).toHaveText('Central Station, South City');
  expect(requested[0]).toContain('121.100000,14.600000;121.200000,14.500000');
  await page.getByRole('button', {name: 'Back to Plan your ride'}).click();
  await page.getByRole('button', {name: 'Swap origin and destination'}).click();
  await page.waitForTimeout(5100);
  await page.getByRole('button', {name: 'Compare Routes', exact: true}).click();
  await expect(page.getByTestId('discovery-origin')).toHaveText('Central Station, South City');
  await expect(page.getByTestId('discovery-destination')).toHaveText('Central Station, North City');
  expect(requested[1]).toContain('121.200000,14.500000;121.100000,14.600000');
});
for (const failure of ['empty', 'offline', 'invalid coordinates']) test(`location ${failure} never falls back to sample routes`, async ({page}) => {
  let roads = 0, lookups = 0;
  await page.route('https://router.project-osrm.org/**', route => {roads++; return route.abort();});
  await page.route('https://photon.komoot.io/**', route => {lookups++; return failure === 'offline' ? route.abort() : route.fulfill({json: {features: []}});});
  await start(page);
  await page.getByRole('textbox', {name: 'Origin', exact: true}).fill(failure === 'invalid coordinates' ? '999, 999' : 'Unknown place');
  await page.getByRole('textbox', {name: 'Destination', exact: true}).fill('14.6,120.97');
  await page.getByRole('button', {name: 'Find Routes', exact: true}).click();
  await expect(page.getByRole('alert')).toContainText(failure === 'offline' ? 'connection' : failure === 'empty' ? 'No locations found' : 'valid latitude');
  expect(roads).toBe(0);
  expect(lookups).toBe(failure === 'invalid coordinates' ? 0 : 1);
});
test('Back during geocoding ignores a late response and leaves the map unselected', async ({page}) => {
  let respond = async () => {};
  await page.route('https://photon.komoot.io/**', route => {respond = () => route.fulfill({json: {features: []}});});
  await start(page);
  await page.getByRole('textbox', {name: 'Origin', exact: true}).fill('Manila');
  await page.getByRole('textbox', {name: 'Destination', exact: true}).fill('Quezon City');
  const request = page.waitForRequest('https://photon.komoot.io/**');
  await page.getByRole('button', {name: 'Find Routes', exact: true}).click(); await request;
  await page.keyboard.press('Escape'); await respond();
  await expect(page.locator('.search-slide')).toHaveCount(0);
  await expect(page.getByText('CHOOSE YOUR JOURNEY')).toBeVisible();
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(0);
});
