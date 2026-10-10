import {test, expect} from '@playwright/test';

for (const width of [320, 412, 1024]) {
  test(`search controls and layout at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 850});
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.route('https://tile.openstreetmap.org/**', route => route.abort());
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await page.getByRole('button', {name: 'Where to? Search routes'}).click();
    await expect(page.getByText('Plan your ride', {exact: true})).toBeVisible();
    await page.getByRole('button', {name: 'Find Routes', exact: true}).click();
    await expect(page.getByRole('heading', {name: 'Routes unavailable', exact: true})).toBeVisible();
    await page.getByRole('button', {name: 'Edit journey'}).click();
    await page.getByRole('button', {name: 'Public transport demo'}).click();
    await page.getByRole('button', {name: 'Clear All', exact: true}).click();
    await expect(page.getByText('A fresh start')).toBeVisible();
    await page.getByRole('button', {name: 'Restore suggestions'}).click();
    await page.getByRole('button', {name: 'Public transport demo', exact: true}).click();
    await page.getByRole('button', {name: 'Choose SM City Masinag - Cogeo Gate 2', exact: true}).click();
    await expect(page.getByRole('textbox', {name: 'Destination', exact: true})).toHaveValue('Cogeo Gate 2');
    await page.getByRole('button', {name: 'Swap origin and destination'}).click();
    await expect(page.getByRole('textbox', {name: 'Origin', exact: true})).toHaveValue('Cogeo Gate 2');
    await page.getByRole('button', {name: 'Sort by Less Crowded'}).click();
    await expect(page.getByRole('button', {name: 'Sort by Less Crowded'})).toHaveAttribute('aria-pressed', 'true');
    for (const label of ['Find Routes', 'Compare Routes', 'Swap origin and destination']) {
      const box = await page.getByRole('button', {name: label, exact: true}).boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.height).toBeGreaterThanOrEqual(48);
    }
    await page.getByRole('button', {name: 'Back to map'}).focus();
    await page.screenshot({path: `test-results/search-${width}.png`});
    await page.getByRole('button', {name: 'Compare Routes', exact: true}).click();
    await expect(page.getByText('Best for less crowded')).toBeVisible();
    await page.getByRole('button', {name: 'Select Route 2', exact: true}).click();
    await expect(page.locator('.search-slide')).toHaveCount(0);
    await expect(page.getByRole('button', {name: 'Where to? Search routes'})).toBeVisible();
    expect(errors).toEqual([]);
  });
}
