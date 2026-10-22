import {test, expect} from '@playwright/test';
import recorded from './fixtures/osrm-masinag.json';

test.beforeEach(async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('https://tile.openstreetmap.org/**',route=>route.fulfill({contentType:'image/png',path:'e2e/fixtures/tile.png'}));
});
test('demo discovery discloses unverified stops, uses sample geometry and never requests road or place data',async ({page})=>{
  let calls=0;
  await page.route(/https:\/\/(router\.project-osrm\.org|photon\.komoot\.io)\//,route=>{calls++;return route.abort();});
  await page.goto('/search');
  await page.getByRole('button',{name:'Public transport demo',exact:true}).click();
  await expect(page.getByText(/Verified transit routes and stops are not available/)).toBeVisible();
  await page.getByRole('textbox',{name:'Origin',exact:true}).fill('SM City Masinag');
  await page.getByRole('textbox',{name:'Destination',exact:true}).fill('Cogeo Gate 2');
  await page.getByRole('button',{name:'Compare Routes',exact:true}).click();
  await expect(page.getByTestId('route-discovery')).toContainText('transfers have not been verified');
  await expect(page.getByTestId('route-discovery')).toContainText('sample transfer');
  await page.getByRole('button',{name:'Select SM City Masinag - Cogeo Gate 2',exact:true}).click();
  await expect(page.getByText('TRANSIT DEMO · NOT LIVE',{exact:true})).toBeVisible();
  await expect(page.locator('.leaflet-overlay-pane path.leaflet-interactive')).toHaveCount(3);
  expect(calls).toBe(0);
});
test('unsupported demo search does not claim missing real service or replace an active road trip',async ({page})=>{
  let calls=0;
  await page.route('https://router.project-osrm.org/**',route=>{calls++;return route.fulfill({json:recorded});});
  await page.goto('/search');
  await page.getByRole('textbox',{name:'Origin',exact:true}).fill('SM City Masinag');
  await page.getByRole('textbox',{name:'Destination',exact:true}).fill('Cogeo Gate 2');
  await page.getByRole('button',{name:'Find Routes',exact:true}).click();
  await page.getByRole('button',{name:'View selected route on map'}).click();
  const persistedJourney=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('pathfinder.restart-recovery.v1')??'{}').journey);
  await expect.poll(async ()=>(await persistedJourney())?.kind).toBe('road');
  const originalJourney=await persistedJourney();
  await page.getByRole('button',{name:'Where to? Search routes'}).click();
  await page.getByRole('button',{name:'Public transport demo',exact:true}).click();
  await page.getByRole('textbox',{name:'Destination',exact:true}).fill('Unknown transit destination');
  await page.getByRole('button',{name:'Find Routes',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('does not mean no public transport operates here');
  await page.getByRole('button',{name:'Edit journey',exact:true}).click();
  await page.getByRole('button',{name:'Back to map',exact:true}).click();
  await expect(page.getByText('DRIVING ESTIMATE · NO LIVE TRAFFIC',{exact:true})).toBeVisible();
  await expect(page.locator('.leaflet-overlay-pane path.leaflet-interactive')).toHaveCount(1);
  await expect.poll(persistedJourney).toEqual(originalJourney);
  await expect(page.getByTitle('Driving route 1 · Driving',{exact:true})).toBeVisible();
  expect(calls).toBe(1);
});
