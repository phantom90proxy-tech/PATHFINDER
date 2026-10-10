import test from 'node:test';
import assert from 'node:assert/strict';
import {routes, rankedRoutes, routeCoordinates, matchesDemo} from '../src/data/routes.ts';
import {mapViewport} from '../src/data/mapViewport.ts';

test('selection options remain distinct and retain their matching sample metrics',()=>{
  assert.equal(new Set(routes.map(r=>r.id)).size,3);
  assert.equal(new Set(routes.map(r=>r.color)).size,3);
  assert.deepEqual(routes.map(r=>[r.minutes,r.fare,r.transfers]),[[14,18,1],[20,25,2],[30,35,4]]);
});
test('preferences rank copies without mutating the default route order',()=>{
  assert.equal(rankedRoutes('Cheapest')[0].id,'route-1');
  assert.equal(rankedRoutes('Fastest')[0].id,'route-1');
  assert.equal(rankedRoutes('Less Crowded')[0].id,'route-2');
  assert.equal(routes[0].id,'route-1');
});
test('reversing endpoints never mutates stored route geometry',()=>{
  const route=routes[0], original=structuredClone(route.coordinates);
  const reversed=routeCoordinates(route,true);
  assert.deepEqual(reversed[0],original.at(-1));
  assert.deepEqual(reversed.at(-1),original[0]);
  assert.deepEqual(route.coordinates,original);
  assert.deepEqual(routeCoordinates(route,false),original);
});
test('local endpoint matching accepts both directions and rejects unsupported searches',()=>{
  assert.ok(matchesDemo(' SM City Masinag ','Cogeo Gate 2'));
  assert.ok(matchesDemo('cogeo gate 2','SM CITY MASINAG'));
  assert.ok(!matchesDemo('Your location','Cogeo Gate 2'));
  assert.ok(!matchesDemo('',''));
  assert.ok(!matchesDemo('SM City Masinag','Anonas Station'));
});
test('sample geometry stays within the local corridor and has no large discontinuities',()=>{
  for(const route of routes){
    assert.ok(route.coordinates.length>20);
    for(let i=0;i<route.coordinates.length;i++){
      const p=route.coordinates[i];
      assert.ok(p.latitude>14.60&&p.latitude<14.65);
      assert.ok(p.longitude>121.11&&p.longitude<121.18);
      if(i)assert.ok(Math.hypot(p.latitude-route.coordinates[i-1].latitude,p.longitude-route.coordinates[i-1].longitude)<0.004);
    }
  }
});
test('camera reserves overlay space once and leaves a usable viewport on compact screens',()=>{
  for(const [width,height] of [[412,917],[360,640],[393,780]]){
    const {mapPadding:m,edgePadding:e}=mapViewport(width,height);
    assert.ok(m.bottom+e.bottom>=height*(1-548/917));
    assert.ok(height-m.bottom-e.bottom-e.top>height*0.30);
    assert.ok(width-e.left-e.right>width*0.70);
    assert.ok(Object.values(e).every(Number.isInteger));
  }
});

test('Home overlays leave the route camera above the sheet at phone sizes',()=>{
  for(const [width,height] of [[360,640],[412,917],[393,780]]){
    for(const bottom of [Math.min(286,height*0.45)+24,Math.min(490,height*0.58)+24]){
      const {mapPadding:m,edgePadding:e}=mapViewport(width,height,{top:156,bottom});
      assert.ok(m.bottom>=Math.floor(bottom));
      assert.equal(e.top,156);
      assert.ok(height-m.bottom-e.bottom-e.top>height*0.10);
    }
  }
});
