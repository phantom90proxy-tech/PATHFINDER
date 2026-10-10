import {test, expect, type Page} from '@playwright/test';
import {nativeMapHTML} from '../src/map/nativeLeaflet';
import recorded from './fixtures/osrm-masinag.json';

const bridge = '<script>window.messages=[];window.ReactNativeWebView={postMessage:m=>window.messages.push(JSON.parse(m))}</script>';
async function tiles(page: Page) {
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({contentType:'image/png',path:'e2e/fixtures/tile.png'}));
}
test('native script failure is tagged; a fresh document initializes and disposes cleanly', async ({page}) => {
  await tiles(page);
  await page.setContent(bridge + nativeMapHTML(1).replace(/<script data-leaflet>[\s\S]*?<\/script>/, '<script>throw new Error("simulated bundle failure")</script>'));
  await expect.poll(() => page.evaluate(() => (window as any).messages)).toContainEqual({type:'error',generation:1});
  expect(await page.evaluate(() => (window as any).messages.some((m: any) => m.type === 'ready'))).toBe(false);
  await page.setContent(bridge + nativeMapHTML(2));
  await expect.poll(() => page.evaluate(() => (window as any).messages)).toEqual([{type:'ready',generation:2}]);
  await page.evaluate(() => {
    (window as any).pathfinder.dispose();
    (window as any).pathfinder.dispose();
    (window as any).pathfinder.resume();
    (window as any).pathfinderBridge.send({type:'select',id:'old'});
  });
  await expect(page.locator('.leaflet-pane')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).messages)).toEqual([{type:'ready',generation:2}]);
});

test('native selection preserves line and marker identity, popup and GPS layers', async ({page}) => {
  await tiles(page); await page.setContent(bridge + nativeMapHTML(3));
  const roads = [0,1].map(i => ({id:'r'+i,road:true,label:'Route '+i,origin:'A',destination:'B',color:'#7ed957',summary:'Driving estimate',
    coordinates:recorded.routes[0].geometry.coordinates.map(([longitude,latitude]) => ({longitude,latitude:latitude+i*.001}))}));
  await page.evaluate(routes => {
    const w = window as any;
    w.pathfinder.update({routes,selected:'r0',top:84,bottom:160,reduced:true,location:{latitude:14.63,longitude:121.14,accuracy:10,timestamp:1}});
    w.savedNodes = [...document.querySelectorAll('.leaflet-interactive, .leaflet-marker-icon')];
  }, roads);
  await page.getByTitle('Route 1 · Driving', {exact:true}).click();
  await page.evaluate(() => {const w = window as any; w.pathfinder.update({selected:'r1'}); w.pathfinder.update({selected:'r1'}); w.pathfinder.resume();});
  await expect(page.locator('.leaflet-popup')).toContainText('Route 1');
  expect(await page.evaluate(() => (window as any).savedNodes.every((node: Element) => node.isConnected))).toBe(true);
  expect(await page.locator('.leaflet-interactive, .leaflet-marker-icon').count()).toBe(await page.evaluate(() => (window as any).savedNodes.length));
  await expect(page.locator('path[stroke="#7ed957"][stroke-width="6"]')).toHaveCount(1);
  expect(await page.evaluate(() => (window as any).messages)).toEqual([{type:'ready',generation:3},{type:'select',id:'r1',generation:3}]);
});

for (const platform of ['web','native']) {
  test(`${platform} mixed tile loads retain failures and manual retry recovers only failed tiles`, async ({page}) => {
    await tiles(page); await page.emulateMedia({reducedMotion:'reduce'});
    if (platform === 'web') await page.goto('/'); else await page.setContent(bridge + nativeMapHTML());
    await expect(page.locator('img.leaflet-tile-loaded').first()).toBeVisible();
    // Exercise Leaflet's real image event listeners without hitting the public tile server.
    await page.evaluate(() => {
      const images = [...document.querySelectorAll<HTMLImageElement>('img.leaflet-tile-loaded')];
      images[0].dispatchEvent(new Event('error')); images[1].dispatchEvent(new Event('error'));
      images[2].dispatchEvent(new Event('load'));
      (window as any).failedTile = images[0];
      (window as any).retriedTiles = [];
      const observer = new MutationObserver(records => {
        (window as any).retriedTiles.push(...records.filter(record => record.attributeName === 'src').map(record => record.target));
      });
      images.forEach(image => observer.observe(image, {attributes:true,attributeFilter:['src']}));
    });
    await expect(page.getByRole('status')).toContainText('2 map tiles are unavailable');
    await page.evaluate(() => (window as any).failedTile.dispatchEvent(new Event('load')));
    await expect(page.getByRole('status')).toContainText('1 map tile is unavailable');
    await page.getByRole('button', {name:'Retry tiles'}).click();
    await expect(page.getByRole('button', {name:'Retry tiles'})).toBeHidden();
    expect(await page.evaluate(() => (window as any).retriedTiles.length)).toBe(1);
  });
}

test('web selection preserves popup and geometry; snapping notice survives comparison and details', async ({page}) => {
  await tiles(page); await page.emulateMedia({reducedMotion:'reduce'});
  const response = {...recorded,waypoints:[{distance:240,location:[121.12115,14.62545]},{distance:12,location:[121.16854,14.62141]}],
    routes:[recorded.routes[0],{...recorded.routes[0],geometry:{type:'LineString',coordinates:[[121.12115,14.62545],[121.143,14.635],[121.16854,14.62141]]}}]};
  await page.route('https://router.project-osrm.org/**', route => route.fulfill({json:response}));
  await page.goto('/');
  await page.getByRole('button', {name:'Where to? Search routes'}).click();
  await page.getByRole('button', {name:'Road driving routes'}).click();
  await page.getByRole('textbox', {name:'Origin',exact:true}).fill('SM City Masinag');
  await page.getByRole('button', {name:'Set destination Cogeo Gate 2'}).click();
  await page.getByRole('button', {name:'Compare Routes',exact:true}).click();
  await expect(page.getByText(/starts about 240 m.*walking connection has not been verified/)).toBeVisible();
  await page.getByRole('button', {name:'Select Driving route 1'}).click();
  await expect(page.locator('.search-slide')).toHaveCount(0);
  await page.evaluate(() => {(window as any).savedNodes = [...document.querySelectorAll('.leaflet-interactive, .leaflet-marker-icon')];});
  await page.getByTitle('Driving route 2 · Driving', {exact:true}).click();
  await expect(page.locator('.leaflet-popup')).toContainText('Driving route 2');
  expect(await page.evaluate(() => (window as any).savedNodes.every((node: Element) => node.isConnected))).toBe(true);
  await page.getByRole('button', {name:'Open menu'}).click();
  await page.getByRole('button', {name:'Route details and alternatives'}).click();
  await expect(page.getByText(/starts about 240 m.*walking connection has not been verified/)).toBeVisible();
});
