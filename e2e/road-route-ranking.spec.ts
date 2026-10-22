import {test, expect} from '@playwright/test';
import recorded from './fixtures/osrm-masinag.json';

test.beforeEach(async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('https://tile.openstreetmap.org/**', route=>route.fulfill({contentType:'image/png',path:'e2e/fixtures/tile.png'}));
});
for (const mode of ['separate','combined','ties','single'] as const) test(`road ranking: ${mode}, stable selection and map highlighting`, async ({page}) => {
  const base=recorded.routes[0];
  const routes=mode==='single' ? [{...base,duration:600,distance:6000}] : [
    {...base,duration:mode==='ties'?600:720,distance:6000},
    {...base,duration:600,distance:mode==='combined'?5000:mode==='ties'?6000:8000,
      geometry:{type:'LineString',coordinates:[[121.12115,14.62545],[121.143,14.635],[121.16854,14.62141]]}}
  ];
  let calls=0;
  await page.route('https://router.project-osrm.org/**',route=>{calls++;return route.fulfill({json:{...recorded,routes}});});
  await page.goto('/');
  await page.getByRole('button',{name:'Where to? Search routes'}).click();
  await page.getByRole('textbox',{name:'Origin',exact:true}).fill('SM City Masinag');
  await page.getByRole('textbox',{name:'Destination',exact:true}).fill('Cogeo Gate 2');
  await page.getByRole('button',{name:'Find Routes',exact:true}).click();
  const cards=page.getByRole('button',{name:/^Select Driving route/});
  const first=page.getByRole('button',{name:'Select Driving route 1',exact:true});
  const second=page.getByRole('button',{name:'Select Driving route 2',exact:true});
  if(mode==='single') {
    await expect(cards).toHaveCount(1);
    await expect(first).not.toContainText('Fastest');
    await expect(first).not.toContainText('Shortest');
  } else {
    await expect(cards.first()).toHaveAccessibleName(mode==='ties'?'Select Driving route 1':'Select Driving route 2');
    await expect(second).toContainText('Fastest');
    await expect(mode==='combined'?second:first).toContainText('Shortest');
    if(mode==='separate') {
      await expect(first).toContainText('2.0 min longer than fastest');
      await expect(second).toContainText('2.0 km farther than shortest');
    }
    await first.click();
    await page.getByRole('button',{name:'Back to Plan your ride',exact:true}).click();
    await page.getByRole('button',{name:'Compare Routes',exact:true}).click();
    await expect(first).toHaveAttribute('aria-pressed','true');
    await expect(cards.first()).toHaveAccessibleName(mode==='ties'?'Select Driving route 1':'Select Driving route 2');
  }
  await first.click();
  if(mode==='single') await page.getByRole('button',{name:'View selected route on map'}).click();
  await expect(page.locator('.leaflet-overlay-pane path.leaflet-interactive[stroke-width="6"]')).toHaveCount(1);
  await page.getByRole('button',{name:'Open menu'}).click();
  await page.getByRole('button',{name:'Route details and alternatives'}).click();
  await expect(page.getByRole('button',{name:'Show Driving route 1',exact:true})).toHaveAttribute('aria-pressed','true');
  expect(calls).toBe(1);
});

for (const value of [null, 0, -1]) test('invalid OSRM estimates are rejected safely: ' + value, async ({page}) => {
  await page.route('https://router.project-osrm.org/**',route=>route.fulfill({json:{...recorded,routes:[{...recorded.routes[0],duration:value}]}}));
  await page.goto('/');
  await page.getByRole('button',{name:'Where to? Search routes'}).click();
  await page.getByRole('textbox',{name:'Origin',exact:true}).fill('SM City Masinag');
  await page.getByRole('textbox',{name:'Destination',exact:true}).fill('Cogeo Gate 2');
  await page.getByRole('button',{name:'Find Routes',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('invalid geometry or estimates');
  await expect(page.getByRole('button',{name:/^Select Driving route/})).toHaveCount(0);
});
