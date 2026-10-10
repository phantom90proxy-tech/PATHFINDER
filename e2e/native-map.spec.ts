import {test, expect} from '@playwright/test';
import {nativeMapHTML} from '../src/map/nativeLeaflet';
import recorded from './fixtures/osrm-masinag.json';

test('Android bundled Leaflet document renders road geometry and bridges selection and GPS', async ({page}) => {
  await page.route('https://tile.openstreetmap.org/**', route => route.abort());
  await page.setContent('<script>window.messages=[];window.ReactNativeWebView={postMessage:m=>window.messages.push(JSON.parse(m))}</script>' + nativeMapHTML());
  const road = {id:'road-1',road:true,label:'Driving route 1',origin:'Masinag',destination:'Cogeo',color:'#7ed957',summary:'7.3 km driving',
    coordinates:recorded.routes[0].geometry.coordinates.map(([longitude,latitude])=>({latitude,longitude}))};
  await page.evaluate(road => {
    (window as any).pathfinder.update({routes:[road],selected:road.id,top:84,bottom:160,reduced:true,location:null,reversed:false});
  }, road);
  await expect(page.getByTitle('Origin: Masinag', {exact:true})).toBeVisible();
  await expect(page.locator('path.leaflet-interactive')).toHaveCount(1);
  expect((await page.locator('path.leaflet-interactive').getAttribute('d'))!.length).toBeGreaterThan(100);
  await page.getByTitle('Driving route 1 · Driving', {exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).messages)).toEqual([{type:'ready',generation:0},{type:'select',id:'road-1',generation:0}]);
  await page.evaluate(road => {
    const location={latitude:14.62545,longitude:121.12115,accuracy:10,timestamp:Date.now()};
    (window as any).pathfinder.update({routes:[road],selected:road.id,top:84,bottom:160,reduced:true,location,reversed:false});
    (window as any).pathfinder.locate(location);
  }, road);
  await expect(page.locator('path[fill="#259cff"]')).toBeVisible();
  await expect(page.getByRole('link',{name:'OpenStreetMap contributors'})).toBeVisible();
  await expect(page.locator('script[src]')).toHaveCount(0);
});
