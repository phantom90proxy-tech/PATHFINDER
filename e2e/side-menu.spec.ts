import {test, expect} from '@playwright/test';

test('menu opens against the left edge and dismisses outside', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({contentType: 'image/png', path: 'e2e/fixtures/tile.png'}));
  await page.goto('/');
  await page.getByRole('button', {name: 'Open menu', exact: true}).click();
  const drawer = page.getByTestId('side-menu');
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText('PATHFINDER', {exact: true})).toBeVisible();
  await expect(drawer.getByRole('button', {name: 'Close panel', exact: true})).toHaveCount(0);
  const bounds = await drawer.boundingBox();
  expect(bounds!.x).toBe(0);
  expect(bounds!.height).toBe(page.viewportSize()!.height);
  expect(bounds!.width).toBeLessThan(page.viewportSize()!.width);
  await page.screenshot({path: 'test-results/side-menu-412.png'});
  await page.mouse.click(page.viewportSize()!.width - 10, 200);
  await expect(drawer).not.toBeVisible();
  await page.getByRole('button', {name: 'Open menu', exact: true}).click();
  await page.getByRole('button', {name: 'Open saved routes', exact: true}).click();
  await expect(page).toHaveURL(/\/saved$/);
});
