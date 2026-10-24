import {test, expect} from '@playwright/test';

test('production profile never exposes onboarding reset', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({contentType: 'image/png', path: 'e2e/fixtures/tile.png'}));
  await page.goto('/');
  await page.getByRole('button', {name: 'Open profile', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Reset Onboarding (DEV)', exact: true})).toHaveCount(0);
  await expect(page.getByText('DEVELOPMENT', {exact: true})).toHaveCount(0);
});
