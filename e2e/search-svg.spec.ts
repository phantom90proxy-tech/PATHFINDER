import {test, expect} from '@playwright/test';

// Run against Metro as well as the export: React's invalid-prop warning is dev-only.
test.use({baseURL: process.env.PATHFINDER_SVG_TEST_URL ?? 'http://127.0.0.1:8790'});

test('search and discovery SVGs render without invalid accessibility DOM props', async ({page}) => {
  const errors: string[] = [];
  page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
  page.on('pageerror', error => errors.push(error.stack ?? error.message));
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({contentType: 'image/png', path: 'e2e/fixtures/tile.png'}));
  await page.goto('/');
  await page.getByRole('button', {name: 'Where to? Search routes'}).click();
  await expect(page.getByRole('heading', {name: 'Plan your ride'})).toBeVisible();
  const icons = page.locator('.search-slide svg');
  expect(await icons.count()).toBeGreaterThan(10);
  const accessibility = await icons.evaluateAll(nodes => nodes.map(node => ({hidden: node.getAttribute('aria-hidden'), tabIndex: node.getAttribute('tabindex'), accessible: node.hasAttribute('accessible')})));
  // React Native Web translates focusable={false} into tabIndex=-1.
  expect(accessibility.every(props => props.hidden === 'true' && props.tabIndex === '-1' && !props.accessible)).toBe(true);
  // Exercise the fragment's two circles, rectangles, and all icon path shapes.
  expect(await icons.locator('circle').count()).toBeGreaterThanOrEqual(3);
  expect(await icons.locator('rect').count()).toBeGreaterThan(0);
  const pathLengths = await icons.locator('path').evaluateAll(paths => paths.map(path => (path as SVGPathElement).getTotalLength()));
  expect(pathLengths.every(length => Number.isFinite(length) && length > 0)).toBe(true);
  await page.getByRole('button', {name: 'Public transport demo', exact: true}).click();
  await page.getByRole('button', {name: 'Choose SM City Masinag - Cogeo Gate 2', exact: true}).click();
  await page.getByRole('button', {name: 'Find Routes', exact: true}).click();
  for (const icon of await page.getByTestId('route-discovery').locator('svg').all()) {
    await expect(icon).toHaveAttribute('aria-hidden', 'true');
    await expect(icon).not.toHaveAttribute('accessible');
  }
  expect(errors).toEqual([]);
});
