import test from 'node:test';
import assert from 'node:assert/strict';
import {fareForRoute, fareLabel, formatPeso, demoFareDifference} from '../src/services/fareInformation.ts';
import {routes, rankedRoutes} from '../src/data/routes.ts';
import {routeSummary} from '../src/data/roadRoutes.ts';
const demo=amount=>({classification:'demo',amount,currency:'PHP'});

test('existing fares remain demo PHP, including old snapshots; road costs remain unavailable',()=>{
  for(const route of routes) {
    assert.deepEqual(fareForRoute(route),demo(route.fare));
    assert.match(routeSummary(route),/Demo fare ₱/);
    assert.equal(fareForRoute({...route,fareClassification:'verified'}).classification,'demo');
  }
  const road={kind:'road',fare:18,distanceMeters:1000,durationSeconds:600};
  assert.equal(fareLabel(fareForRoute(road)),'Fare unavailable');
  assert.match(routeSummary(road),/Fare unavailable/);
});
test('peso formatting uses cents consistently without inventing a free fare',()=>{
  assert.equal(formatPeso(18),'₱18');
  assert.equal(formatPeso(25.5),'₱25.50');
  assert.equal(formatPeso(1234.56),'₱1,234.56');
  assert.equal(fareLabel(demo(0)),'Demo fare ₱0');
});
test('missing, invalid, negative and unsafe values are unavailable, never zero or NaN',()=>{
  for(const fare of [undefined,null,NaN,Infinity,-1,'18',Number.MAX_VALUE]) {
    assert.equal(formatPeso(fare),null);
    assert.equal(fareLabel(fareForRoute({...routes[0],fare})),'Fare unavailable');
    assert.equal(demoFareDifference(demo(fare),[demo(18),demo(25)]),null);
  }
});
test('demo differences and equal fares use cent arithmetic; a single valid fare has no ranking',()=>{
  assert.equal(demoFareDifference(demo(25),[demo(18),demo(25)]),'₱7 more than lowest demo fare');
  assert.equal(demoFareDifference(demo(18),[demo(18),demo(25)]),'Lowest demo fare');
  assert.equal(demoFareDifference(demo(18),[demo(18),demo(18)]),'Equal lowest demo fare');
  assert.equal(demoFareDifference(demo(.3),[demo(.1),demo(.3)]),'₱0.20 more than lowest demo fare');
  assert.equal(demoFareDifference(demo(18),[demo(18),{classification:'unavailable'}]),null);
});
test('mixed classifications and currencies never receive equivalent price rankings',()=>{
  for(const classification of ['verified','estimated','unexpected']) {
    const foreign={classification,amount:10,currency:'PHP'};
    assert.equal(demoFareDifference(demo(18),[demo(18),foreign]),null);
    assert.equal(fareLabel(foreign),'Fare unavailable');
  }
  assert.equal(demoFareDifference(demo(18),[demo(18),{...demo(5),currency:'USD'}]),null);
});
test('sample fare ranking puts invalid amounts last and preserves original data',()=>{
  const original=routes[0].fare;
  try {
    routes[0].fare=-1;
    assert.equal(rankedRoutes('Cheapest').at(-1).id,routes[0].id);
  } finally {routes[0].fare=original;}
  assert.equal(rankedRoutes('Cheapest')[0].id,'route-1');
});
