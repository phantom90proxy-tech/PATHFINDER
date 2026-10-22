import test from 'node:test';
import assert from 'node:assert/strict';
import {transitAvailability} from '../src/data/transitAvailability.ts';
import {routes, matchesDemo} from '../src/data/routes.ts';
import {parseRoadResponse} from '../src/services/roadRouting.ts';

test('unavailable provider is disclosed without claiming public transport does not operate', () => {
  assert.equal(transitAvailability.status, 'unavailable');
  assert.match(transitAvailability.demoDisclosure, /Sample.*Stops.*transfers have not been verified/);
  assert.match(transitAvailability.unsupportedJourney, /does not mean no public transport operates/);
  for (const [a,b] of [['',''],['Unknown','Cogeo Gate 2'],['Station','Station']]) assert.equal(matchesDemo(a,b),false);
});
test('sample route identities and geometry do not invent stop identities or provider evidence', () => {
  assert.equal(new Set(routes.map(route=>route.id)).size,routes.length);
  for (const route of routes) {
    assert.ok(route.coordinates.every(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)));
    assert.equal('stops' in route,false);
    assert.equal('provider' in route,false);
    assert.equal('kind' in route,false);
  }
});
test('sample transit records and malformed responses cannot be accepted as road provider data', () => {
  const request={origin:{latitude:14.62,longitude:121.12},destination:{latitude:14.62,longitude:121.16},originLabel:'A',destinationLabel:'B'};
  for (const value of [null,{}, {code:'Ok',routes:[]}, {code:'Ok',routes:[routes[0]]}]) assert.throws(()=>parseRoadResponse(value,request,Date.now()));
});
