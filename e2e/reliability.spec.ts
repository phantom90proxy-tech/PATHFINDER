import {test, expect} from '@playwright/test';
import recorded from './fixtures/osrm-masinag.json';

test.beforeEach(async ({page}) => {
  await page.route('https://tile.openstreetmap.org/**', route=>route.abort());
});
for (const exit of ['visible','history'] as const) {
  test(`late road result during ${exit} exit cannot select a route`, async ({page}) => {
    await page.emulateMedia({reducedMotion:'no-preference'});
    let respond=async()=>{};
    await page.route('https://router.project-osrm.org/**',route=>{respond=()=>route.fulfill({json:recorded});});
    await page.goto('/');
    await page.getByRole('button',{name:'Where to? Search routes'}).click();
    await page.getByRole('button',{name:'Road driving routes'}).click();
    await page.getByRole('textbox',{name:'Origin',exact:true}).fill('SM City Masinag');
    await page.getByRole('button',{name:'Set destination Cogeo Gate 2'}).click();
    const requested=page.waitForRequest('https://router.project-osrm.org/**');
    await page.getByRole('button',{name:'Find Routes',exact:true}).click(); await requested;
    if(exit==='history')await page.evaluate(()=>history.back());
    else await page.getByRole('button',{name:'Back to map'}).click();
    await expect.poll(()=>page.locator('.search-slide').evaluate(el=>el.getAnimations().some(a=>a.id==='search-slide-down'))).toBe(true);
    await page.locator('.search-slide').evaluate(el=>el.getAnimations().forEach(a=>a.pause()));
    await respond();
    await expect(page.getByText('CHOOSE YOUR JOURNEY')).toBeAttached();
    await page.locator('.search-slide').evaluate(el=>el.getAnimations().forEach(a=>a.finish()));
    await expect(page.locator('.search-slide')).toHaveCount(0);
    await expect(page.getByText('CHOOSE YOUR JOURNEY')).toBeVisible();
  });
}
test('reversed demo trip agrees in comparison, details and map',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/'); await page.getByRole('button',{name:'Where to? Search routes'}).click();
  await page.getByRole('button', {name: 'Public transport demo', exact: true}).click();  await page.getByRole('button',{name:'Choose SM City Masinag - Cogeo Gate 2',exact:true}).click();
  await page.getByRole('button',{name:'Swap origin and destination'}).click();
  await page.getByRole('button',{name:'Compare Routes',exact:true}).click();
  await expect(page.getByTestId('discovery-origin')).toHaveText('Cogeo Gate 2');
  await expect(page.getByTestId('discovery-destination')).toHaveText('SM City Masinag');
  await page.getByRole('button',{name:'Select Cogeo Gate 2 - SM City Masinag',exact:true}).click();
  await page.getByRole('button',{name:'Open menu'}).click();
  await page.getByRole('button',{name:'Route details and alternatives'}).click();
  await expect(page.getByText('Cogeo Gate 2 → SM City Masinag',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close route details'}).click();
  await page.getByTitle('Route origin',{exact:true}).click();
  await expect(page.locator('.leaflet-popup')).toContainText('Origin: Cogeo Gate 2');
});
test('Home exposes GPS progress after menu closes and reports completion',async({page})=>{
  await page.addInitScript(()=>{
    navigator.permissions.query=async()=>({state:'granted'}) as PermissionStatus;
    navigator.geolocation.getCurrentPosition=(success)=>{
      (window as any).finishGPS=()=>success({coords:{latitude:14.62545,longitude:121.12115,accuracy:12},timestamp:Date.now()} as GeolocationPosition);
    };
  });
  await page.goto('/'); await page.getByRole('button',{name:'Open menu'}).click();
  await page.getByRole('button',{name:'Use my location on map'}).click();
  await expect(page.getByText('Getting your location…',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Close panel'})).toBeHidden();
  await page.getByRole('button',{name:'Recenter selected route'}).click();
  await expect.poll(()=>page.evaluate(()=>typeof (window as any).finishGPS)).toBe('function');
  await page.evaluate(()=>(window as any).finishGPS());
  await expect(page.getByText('Location updated',{exact:true})).toBeVisible();
  await expect(page.locator('path[fill="#259cff"]')).toBeVisible();
});
