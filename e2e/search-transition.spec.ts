import {test, expect} from '@playwright/test';

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`search slides up and back down with motion preference ${reducedMotion}`, async ({page}) => {
    await page.emulateMedia({reducedMotion});
    await page.route('https://tile.openstreetmap.org/**', route => route.abort());
    await page.goto('/');
    await page.getByRole('button', {name: 'Where to? Search routes'}).click();
    const screen = page.locator('.search-slide');
    await expect(screen).toBeVisible();
    const motion = await screen.evaluate(element => {
      const animation = element.getAnimations()[0];
      if (!animation) return null;
      animation.pause();
      animation.currentTime = 0;
      const start = element.getBoundingClientRect().top;
      animation.currentTime = 180;
      const middle = element.getBoundingClientRect().top;
      animation.finish();
      return {start, middle, end: element.getBoundingClientRect().top};
    });
    if (reducedMotion === 'reduce') expect(motion).toBeNull();
    else {
      expect(motion!.start).toBeGreaterThan(motion!.middle);
      expect(motion!.middle).toBeGreaterThan(motion!.end);
      expect(motion!.end).toBeCloseTo(0);
    }
    await expect(page.getByRole('textbox', {name: 'Destination', exact: true})).toBeVisible();
    await page.getByRole('button', {name: 'Back to map'}).click();
    if (reducedMotion === 'no-preference') {
      const exit = await screen.evaluate(element => {
        const animation = element.getAnimations().find(item => item.id === 'search-slide-down')!;
        animation.pause();
        animation.currentTime = 0;
        const start = element.getBoundingClientRect().top;
        animation.currentTime = 180;
        const middle = element.getBoundingClientRect().top;
        animation.finish();
        return {start, middle, end: element.getBoundingClientRect().top};
      });
      expect(exit.start).toBeCloseTo(0);
      expect(exit.middle).toBeGreaterThan(exit.start);
      expect(exit.end).toBeGreaterThan(exit.middle);
    }
    await expect(screen).toHaveCount(0);
    await expect(page.getByRole('button', {name: 'Where to? Search routes'})).toBeVisible();
  });
}
