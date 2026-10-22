import test from 'node:test';
import assert from 'node:assert/strict';
import {rankRoadRoutes, roadRouteComparison} from '../src/services/roadRouteRanking.ts';
const route = (id, durationSeconds, distanceMeters) => ({kind:'road', id, durationSeconds, distanceMeters});
test('fastest and shortest are independent with time and distance differences', () => {
  const a=route('a',600,8000), b=route('b',720,6000), routes=[b,a];
  assert.deepEqual(rankRoadRoutes(routes),[a,b]);
  assert.deepEqual(roadRouteComparison(a,routes),{badges:['Fastest'],differences:['Same estimated time as fastest','2.0 km farther than shortest']});
  assert.deepEqual(roadRouteComparison(b,routes),{badges:['Shortest'],differences:['2.0 min longer than fastest','Same distance as shortest']});
  assert.deepEqual(routes,[b,a]);
});
test('combined winners and ties are all labeled; tie order is distance then stable ID', () => {
  const a=route('a',600,6000), b=route('b',600,6000), c=route('c',600,7000);
  for(const routes of [[c,b,a],[a,c,b],[b,a,c]]) {
    assert.deepEqual(rankRoadRoutes(routes).map(r=>r.id),['a','b','c']);
    assert.deepEqual(roadRouteComparison(b,routes).badges,['Fastest','Shortest']);
  }
});
test('ranking retains selected identity and references across changed estimates', () => {
  const a=route('a',600,6000), b=route('b',700,7000); const selected=b.id;
  assert.equal(rankRoadRoutes([b,a]).find(r=>r.id===selected),b);
  b.durationSeconds=500;
  assert.equal(rankRoadRoutes([a,b])[0],b);
  assert.equal(selected,'b');
});
test('single route, empty results and only one valid metric do not invent winners', () => {
  const a=route('a',600,6000), b=route('b',NaN,undefined);
  assert.deepEqual(rankRoadRoutes([]),[]);
  assert.deepEqual(roadRouteComparison(a,[a]),{badges:[],differences:[]});
  assert.deepEqual(roadRouteComparison(a,[a,b]),{badges:[],differences:[]});
});
test('invalid or missing metrics sort last without producing misleading comparisons', () => {
  for(const value of [undefined,null,NaN,Infinity,-1,0,'600']) {
    const bad=route('bad',value,value), good=route('good',600,6000);
    assert.equal(rankRoadRoutes([bad,good])[0],good);
    assert.deepEqual(roadRouteComparison(bad,[bad,good]),{badges:[],differences:[]});
  }
});
test('small nonzero differences remain visible', () => {
  const a=route('a',600,6000), b=route('b',600.2,6000.2);
  assert.deepEqual(roadRouteComparison(b,[a,b]).differences,['1 sec longer than fastest','1 m farther than shortest']);
});
