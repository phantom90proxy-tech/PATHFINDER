import {test, expect} from '@playwright/test';
import recorded from './fixtures/osrm-masinag.json';

test.beforeEach(async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({contentType: 'image/png', path: 'e2e/fixtures/tile.png'}));
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    (window as any).cancelledSearchRequests = [];
    window.fetch = (input, options) => {
      const url = String(input);
      if (/photon\.komoot|router\.project-osrm/.test(url)) {
        options?.signal?.addEventListener('abort', () => (window as any).cancelledSearchRequests.push(url), {once: true});
      }
      return original(input, options);
    };
  });
});

for (const service of ['Photon', 'OSRM']) for (const exit of ['visible', 'history']) {
  test(`${service} fetch aborts on ${exit} exit and a reopened search still works`, async ({page}) => {
    let release = async () => {};
    let requests = 0;
    const pattern = service === 'Photon' ? 'https://photon.komoot.io/**' : 'https://router.project-osrm.org/**';
    await page.route(pattern, route => {
      requests++;
      const finish = () => route.fulfill({json: service === 'Photon' ? {features: [
        {geometry: {type: 'Point', coordinates: [121.12115, 14.62545]}, properties: {name: 'Chosen station'}},
      ]} : recorded});
      if (requests === 1) {release = finish; return;}
      return finish();
    });
    if (service === 'Photon') await page.route('https://router.project-osrm.org/**', route => route.fulfill({json: recorded}));
    await page.goto('/');
    await page.getByRole('button', {name: 'Where to? Search routes'}).click();
    await page.getByRole('textbox', {name: 'Origin', exact: true}).fill(service === 'Photon' ? 'Station' : 'SM City Masinag');
    await page.getByRole('textbox', {name: 'Destination', exact: true}).fill('Cogeo Gate 2');
    const started = page.waitForRequest(pattern);
    await page.getByRole('button', {name: 'Find Routes', exact: true}).click(); await started;
    if (exit === 'history') await page.evaluate(() => history.back());
    else await page.getByRole('button', {name: 'Back to map', exact: true}).click();
    await expect.poll(() => page.evaluate(() => (window as any).cancelledSearchRequests.length)).toBe(1);
    await expect(page.locator('.search-slide')).toHaveCount(0);
    await expect(page.getByText('CHOOSE YOUR JOURNEY')).toBeVisible();
    await release(); // A late server response cannot restore the cancelled trip.
    await page.getByRole('button', {name: 'Where to? Search routes'}).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    // Browser history can restore a fresh document; supply inputs explicitly.
    await page.getByRole('textbox', {name: 'Origin', exact: true}).fill(service === 'Photon' ? 'Station' : 'SM City Masinag');
    await page.getByRole('textbox', {name: 'Destination', exact: true}).fill('Cogeo Gate 2');
    if (service === 'OSRM') await page.waitForTimeout(5100); // Keep the existing throttle.
    await page.getByRole('button', {name: 'Find Routes', exact: true}).click();
    if (service === 'Photon') await page.getByRole('button', {name: 'Chosen station', exact: true}).click();
    await expect(page.getByText('Route results', {exact: true})).toBeVisible();
    expect(requests).toBe(2);
  });
}
