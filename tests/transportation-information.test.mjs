import test from 'node:test';
import assert from 'node:assert/strict';
import {crowdingForRoute, crowdingLabel, demoCrowdingComparison, transferLabel, transportationInformation, serviceInformationDisclosure} from '../src/services/transportationInformation.ts';
import {routes, rankedRoutes} from '../src/data/routes.ts';
import {routeSummary} from '../src/data/roadRoutes.ts';
import {rankRoadRoutes} from '../src/services/roadRouteRanking.ts';

test('sample crowding is explicitly demo and preserved in persisted-route summaries',()=>{
  for(const route of routes) {
    const info=crowdingForRoute(structuredClone(route));
    assert.equal(info.classification,'demo');
    assert.equal(crowdingLabel(info),`Demo crowding: ${route.crowd}`);
    assert.match(routeSummary(route),/Demo crowding:/);
  }
});
test('missing, invalid and incompatible crowd labels or ranks are unavailable',()=>{
  for(const crowd of [null,undefined,'','Live crowd','Unexpected',23]) assert.equal(crowdingLabel(crowdingForRoute({...routes[0],crowd})),'Crowding unavailable');
  for(const crowdRank of [null,undefined,-1,0,1,1.5,NaN,Infinity,'2']) assert.equal(crowdingLabel(crowdingForRoute({...routes[0],crowdRank})),'Crowding unavailable');
  for(const rank of [-1,0,4,undefined]) assert.equal(crowdingLabel({classification:'demo',rank}),'Crowding unavailable');
});
test('sample mode/time/transfers and missing service fields retain their true classifications',()=>{
  const info=transportationInformation(routes[0]);
  for(const field of ['mode','service','travelTime','transfers','crowding']) assert.equal(info[field].classification,'demo');
  for(const field of ['waitingTime','frequency','stops']) assert.equal(info[field].classification,'unavailable');
  assert.match(serviceInformationDisclosure,/schedules and operating hours: unavailable/);
  assert.match(serviceInformationDisclosure,/No live crowding/);
  assert.equal(transferLabel({...routes[0],transfers:-1}),'Transit transfers unavailable');
  assert.equal(transportationInformation({...routes[0],minutes:NaN}).travelTime.classification,'unavailable');
  assert.doesNotMatch(routeSummary({...routes[0],minutes:NaN}),/NaN/);
});
test('comparisons accept only compatible demo crowding and never claim real conditions',()=>{
  const samples=routes.map(crowdingForRoute);
  assert.equal(demoCrowdingComparison(samples[1],samples),'Lowest demo crowding');
  assert.equal(demoCrowdingComparison(samples[0],samples),null);
  assert.equal(demoCrowdingComparison(samples[1],[samples[1]]),null);
  for(const classification of ['verified','estimated','unknown']) {
    const foreign={...samples[1],classification};
    assert.equal(demoCrowdingComparison(samples[1],[samples[1],foreign]),null);
    assert.equal(crowdingLabel(foreign),'Crowding unavailable');
  }
});
test('invalid demo crowding sorts last; OSRM ordering ignores any crowd data',()=>{
  const original=routes[1].crowdRank;
  try {routes[1].crowdRank=-1;assert.equal(rankedRoutes('Less Crowded').at(-1).id,routes[1].id);}
  finally {routes[1].crowdRank=original;}
  const a={kind:'road',id:'a',durationSeconds:600,distanceMeters:3000,crowdRank:999};
  const b={kind:'road',id:'b',durationSeconds:700,distanceMeters:2000,crowdRank:0};
  assert.deepEqual(rankRoadRoutes([b,a]),[a,b]);
  assert.equal(crowdingLabel(crowdingForRoute(a)),'Crowding unavailable');
  const info=transportationInformation(a);
  assert.equal(info.travelTime.classification,'estimated');
  assert.equal(info.service.classification,'unavailable');
});
