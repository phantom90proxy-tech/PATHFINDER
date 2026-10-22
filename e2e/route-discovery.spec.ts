import {test, expect, type Page} from '@playwright/test';
import recorded from './fixtures/osrm-masinag.json';

test.beforeEach(async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({contentType: 'image/png', path: 'e2e/fixtures/tile.png'}));
});
async function plan(page: Page, driving = false) {
  await page.goto('/');
  await page.getByRole('button', {name: 'Where to? Search routes'}).click();
  await page.getByRole('button', {name: 'Public transport demo', exact: true}).click();
  await page.getByRole('button', {name: 'Choose SM City Masinag - Cogeo Gate 2', exact: true}).click();
  if (driving) await page.getByRole('button', {name: 'Road driving routes'}).click();
}
async function expectNoOuterFrame(page: Page) {
  const surface = page.getByTestId('route-discovery');
  await expect(surface).toHaveCSS('border-top-width', '0px');
  await expect(surface).toHaveCSS('border-top-left-radius', '0px');
  const box = await surface.boundingBox();
  expect(box?.x).toBe(0);
  expect(box?.width).toBe(page.viewportSize()?.width);
}
const alternative = {...recorded.routes[0], distance: 8000, duration: 600,
  geometry: {type: 'LineString', coordinates: [[121.12115,14.62545],[121.143,14.635],[121.16854,14.62141]]}};

test('results, comparison, cached reopening and map share the selected road route', async ({page}) => {
  let calls = 0;
  await page.route('https://router.project-osrm.org/**', route => {calls++; return route.fulfill({json: {...recorded, routes: [recorded.routes[0], alternative]}});});
  await plan(page, true);
  await page.getByRole('button', {name: 'Find Routes', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Route results', exact: true})).toBeVisible();
  await expectNoOuterFrame(page);
  const second = page.getByRole('button', {name: 'Select Driving route 2', exact: true});
  await second.click();
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  await expect(second).toContainText('10 min');
  await expect(second).toContainText('8.0 km');
  await page.getByRole('button', {name: 'Back to Plan your ride', exact: true}).click();
  await page.getByRole('button', {name: 'Compare Routes', exact: true}).click();
  await expectNoOuterFrame(page);
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', {name: 'Back to route results', exact: true}).click();
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', {name: 'Back to Plan your ride', exact: true}).click();
  await page.getByRole('button', {name: 'Compare Routes', exact: true}).click();
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', {name: 'View selected route on map'})).toHaveCount(0);
  await second.click();
  await page.getByRole('button', {name: 'Open menu'}).click();
  await page.getByRole('button', {name: 'Route details and alternatives'}).click();
  await expect(page.getByRole('button', {name: 'Show Driving route 2'})).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', {name: 'Close route details'}).click();
  await page.getByTitle('Driving route 1 · Driving', {exact: true}).click();
  await page.getByRole('button', {name: 'Where to? Search routes'}).click();
  await page.getByRole('button', {name: 'Compare Routes', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Select Driving route 1'})).toHaveAttribute('aria-pressed', 'true');
  expect(calls).toBe(1);
});

test('single route remains usable and has no invented alternatives or transit metrics', async ({page}) => {
  await page.route('https://router.project-osrm.org/**', route => route.fulfill({json: recorded}));
  await plan(page, true);
  await page.getByRole('button', {name: 'Find Routes', exact: true}).click();
  await expect(page.getByText('1 route available', {exact: true})).toBeVisible();
  await expect(page.getByText('No alternatives were returned for this journey.')).toBeVisible();
  await expect(page.getByRole('button', {name: /^Select Driving route/})).toHaveCount(1);
  await expect(page.getByTestId('route-discovery')).not.toContainText('Sample fare');
  await page.screenshot({path: 'test-results/road-results-412.png'});
  await page.getByRole('button', {name: 'Back to Plan your ride', exact: true}).click();
  await page.getByRole('button', {name: 'Compare Routes', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Select Driving route 1'})).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', {name: 'View selected route on map'})).toHaveCount(0);
  await page.getByRole('button', {name: 'Select Driving route 1'}).click();
  await expect(page.locator('.leaflet-overlay-pane path.leaflet-interactive')).toHaveCount(1);
});

test('network retry is explicit and recovers to results', async ({page}) => {
  let calls = 0;
  await page.route('https://router.project-osrm.org/**', route => ++calls === 1 ? route.abort() : route.fulfill({json: recorded}));
  await plan(page, true);
  await page.getByRole('button', {name: 'Find Routes', exact: true}).click();
  await expect(page.getByRole('alert')).toContainText('Check your connection');
  await expectNoOuterFrame(page);
  expect(calls).toBe(1);
  // Preserve the existing router's five-second user-request throttle.
  await page.waitForTimeout(5100);
  expect(calls).toBe(1);
  await page.getByRole('button', {name: 'Retry routes'}).click();
  await expect(page.getByRole('heading', {name: 'Route results', exact: true})).toBeVisible();
  expect(calls).toBe(2);
});

test('modal Back callback cancels loading and ignores a late road response', async ({page}) => {
  let respond = async () => {};
  await page.route('https://router.project-osrm.org/**', route => {respond = () => route.fulfill({json: recorded});});
  await plan(page, true);
  const requested = page.waitForRequest('https://router.project-osrm.org/**');
  await page.getByRole('button', {name: 'Find Routes', exact: true}).click();
  await requested;
  await expect(page.getByRole('status')).toContainText('Finding driving routes');
  await expectNoOuterFrame(page);
  await page.screenshot({path: 'test-results/find-routes-loading.png'});
  // RN Web Escape invokes Modal.onRequestClose, also used by Android hardware Back.
  await page.keyboard.press('Escape');
  await expect(page.locator('.search-slide')).toHaveCount(0);
  await respond();
  await expect(page.getByText('CHOOSE YOUR JOURNEY', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Where to? Search routes'}).click();
  await expect(page.getByRole('heading', {name: 'Plan your ride'})).toBeVisible();
  await expect(page.getByTestId('route-discovery')).toHaveCount(0);
});

for (const width of [320, 412]) for (const scale of [1, 2]) {
  test(`demo comparison wraps and scrolls at ${width}px with ${scale}x text`, async ({page}) => {
    await page.setViewportSize({width, height: width === 412 ? 917 : 640});
    await plan(page);
    await page.getByRole('button', {name: 'Swap origin and destination'}).click();
    await page.getByRole('button', {name: 'Compare Routes', exact: true}).click();
    const modal = page.getByTestId('route-discovery');
    if (scale !== 1) await modal.evaluate((element, factor) => {
      // Browser approximation only; native fontScale/TalkBack require a device.
      const texts = [...element.querySelectorAll<HTMLElement>('*')].filter(node => [...node.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim()));
      const styles = texts.map(node => ({node, size: parseFloat(getComputedStyle(node).fontSize), line: parseFloat(getComputedStyle(node).lineHeight)}));
      styles.forEach(({node, size, line}) => {node.style.fontSize = `${size * factor}px`; if (Number.isFinite(line)) node.style.lineHeight = `${line * factor}px`;});
    }, scale);
    await expect(page.getByTestId('discovery-origin')).toHaveText('Cogeo Gate 2');
    await expect(page.getByTestId('discovery-destination')).toHaveText('SM City Masinag');
    const route = page.getByRole('button', {name: 'Select Route 2', exact: true});
    await expect(page.getByRole('button', {name: 'View selected route on map'})).toHaveCount(0);
    await expect(route).toContainText('Demo fare ₱25');
    await expect(route).toContainText('Less Crowded');
    await expect(route).toContainText('Distance not provided');
    const overflow = await modal.evaluate(element => [...element.querySelectorAll<HTMLElement>('*')].filter(node => node.scrollWidth > node.clientWidth + 2).map(node => node.textContent));
    expect(overflow).toEqual([]);
    await page.screenshot({path: `test-results/comparison-${width}-${scale}x.png`});
    await route.click();
    await expect(page.locator('.search-slide')).toHaveCount(0);
    await page.getByRole('button', {name: 'Where to? Search routes'}).click();
    await page.getByRole('button', {name: 'Compare Routes', exact: true}).click();
    await expect(route).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', {name: 'Back to route results'}).click();
    await expect(page.getByRole('heading', {name: 'Route results', exact: true})).toBeVisible();
    await page.getByRole('button', {name: 'Back to Plan your ride', exact: true}).click();
  await page.getByRole('button', {name: 'Compare Routes', exact: true}).click();
    await expect(route).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', {name: 'Route results', exact: true})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', {name: 'Plan your ride'})).toBeVisible();
  });
}
