import {test, expect} from '@playwright/test';

test.beforeEach(async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({contentType: 'image/png', path: 'e2e/fixtures/tile.png'}));
});

test('successful stylesheet loading initializes one map and reuses it across search', async ({page}) => {
  let requests = 0;
  await page.route('**/leaflet/leaflet.css*', route => {requests++; return route.continue();});
  await page.goto('/');
  await expect(page.locator('.leaflet-control-attribution')).toBeVisible();
  await expect(page.locator('#pathfinder-leaflet-styles')).toHaveCount(1);
  await page.getByRole('button', {name: 'Where to? Search routes'}).click();
  await page.getByRole('button', {name: 'Back to map', exact: true}).click();
  await expect(page.locator('.leaflet-control-attribution')).toBeVisible();
  await expect(page.locator('.leaflet-map-pane')).toHaveCount(1);
  expect(requests).toBe(1);
});

test('failed stylesheet is removed and manual retry initializes a working map', async ({page}) => {
  let requests = 0;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/leaflet/leaflet.css*', route => ++requests === 1 ? route.abort() : route.continue());
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Map could not load');
  await expect(page.locator('#pathfinder-leaflet-styles')).toHaveCount(0);
  await page.getByRole('button', {name: 'Retry map', exact: true}).click();
  await expect(page.locator('.leaflet-control-attribution')).toBeVisible();
  await expect(page.getByText('Loading map…', {exact: true})).toHaveCount(0);
  await expect(page.locator('#pathfinder-leaflet-styles')).toHaveCount(1);
  await expect(page.locator('.leaflet-map-pane')).toHaveCount(1);
  expect(requests).toBe(2);
  expect(errors).toEqual([]);
});

test('stalled stylesheet times out; late completion cannot overwrite a successful retry', async ({page}) => {
  let requests = 0;
  let finishOld!: () => Promise<void>;
  await page.route('**/leaflet/leaflet.css*', route => {
    requests++;
    if (requests === 1) {finishOld = () => route.fulfill({contentType: 'text/css', body: ''}); return;}
    return route.continue();
  });
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.getByText('Loading map…', {exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Retry map', exact: true})).toBeVisible({timeout: 15000});
  await expect(page.locator('#pathfinder-leaflet-styles')).toHaveCount(0);
  await page.getByRole('button', {name: 'Retry map', exact: true}).click();
  await expect(page.locator('.leaflet-control-attribution')).toBeVisible();
  await finishOld();
  await expect(page.locator('.leaflet-map-pane')).toHaveCount(1);
  await expect(page.locator('#pathfinder-leaflet-styles')).toHaveCount(1);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('partial initialization failure removes its map before retry', async ({page}) => {
  await page.addInitScript(() => {
    const create = document.createElement.bind(document);
    let failed = false;
    document.createElement = function(name: string, options?: ElementCreationOptions) {
      // Tile-layer creation occurs after L.map() and setView(). Fail just once.
      if (name === 'img' && !failed && document.querySelector('.leaflet-map-pane')) {
        failed = true;
        throw new Error('Simulated interrupted map setup');
      }
      return create(name, options);
    } as typeof document.createElement;
  });
  await page.goto('/');
  await expect(page.getByRole('button', {name: 'Retry map', exact: true})).toBeVisible();
  await expect(page.locator('.leaflet-map-pane')).toHaveCount(0);
  await page.getByRole('button', {name: 'Retry map', exact: true}).click();
  await expect(page.locator('img.leaflet-tile-loaded').first()).toBeVisible();
  await expect(page.locator('.leaflet-map-pane')).toHaveCount(1);
  await expect(page.locator('#pathfinder-leaflet-styles')).toHaveCount(1);
});
