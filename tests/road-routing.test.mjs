import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoadRouter, parseRoadResponse} from '../src/services/roadRouting.ts';
import {resolveEndpoint, routeSummary} from '../src/data/roadRoutes.ts';

const request = {origin: {latitude: 14.62545, longitude: 121.12115}, destination: {latitude: 14.62141, longitude: 121.16854}, originLabel: 'SM City Masinag', destinationLabel: 'Cogeo Gate 2'};
const body = {code: 'Ok', routes: [0, 1].map(index => ({distance: 5400 + index * 1000, duration: 720 + index * 100,
  geometry: {type: 'LineString', coordinates: [[121.12115, 14.62545], [121.14, 14.63 + index * 0.01], [121.16854, 14.62141]]}}))};
const ok = () => new Response(JSON.stringify(body), {status: 200});

test('road response preserves returned geometry and units without fabricated transit metrics', () => {
  const roads = parseRoadResponse(body, request, 123);
  assert.equal(roads.length, 2);
  assert.deepEqual(roads[1].coordinates[1], {latitude: 14.64, longitude: 121.14});
  assert.equal(roads[0].distanceMeters, 5400);
  assert.equal(roads[0].durationSeconds, 720);
  assert.equal(roads[0].fetchedAt, 123);
  assert.match(routeSummary(roads[0]), /5.4 km.*12 min estimated.*Driving/);
  for (const key of ['fare', 'crowd', 'transfers']) assert.equal(key in roads[0], false);
  assert.equal(parseRoadResponse({...body, routes: body.routes.slice(0, 1)}, request, 123).length, 1);
});
test('rejects no-route, malformed geometry, invalid metrics and invalid coordinates', () => {
  for (const code of ['NoRoute', 'NoSegment']) assert.throws(() => parseRoadResponse({code}, request, 1), /No driving route/);
  assert.throws(() => parseRoadResponse({code: 'Ok', routes: []}, request, 1));
  assert.throws(() => parseRoadResponse({code: 'Ok', routes: [null]}, request, 1), /invalid route/);
  for (const patch of [{duration: -1}, {distance: Infinity}, {geometry: {type: 'LineString', coordinates: [[0, 91], [0, 0]]}}, {geometry: {type: 'Polygon', coordinates: []}}]) {
    assert.throws(() => parseRoadResponse({code: 'Ok', routes: [{...body.routes[0], ...patch}]}, request, 1));
  }
});
test('endpoint parsing accepts GPS, known places and lat/lon, but rejects stale GPS and unknown addresses', () => {
  assert.deepEqual(resolveEndpoint('  SM City Masinag ' , null), request.origin);
  assert.deepEqual(resolveEndpoint('14.62141, 121.16854', null), request.destination);
  const gps = {...request.origin, timestamp: 1000, accuracy: 10};
  assert.deepEqual(resolveEndpoint('Current location', gps, 1100), gps);
  assert.throws(() => resolveEndpoint('Current location', gps, 302000), /Refresh/);
  for (const text of ['', 'Quezon City', '91, 1', ', 1', '14, 181', 'NaN, 1']) assert.throws(() => resolveEndpoint(text, null));
});
test('HTTPS driving request uses lon/lat, alternatives and full GeoJSON; identical queries are cached', async () => {
  const calls = []; let time = 1000;
  const route = createRoadRouter({now: () => time, fetcher: async url => {calls.push(url); return ok();}});
  const first = await route(request);
  assert.equal(first.cached, false);
  assert.match(calls[0], /^https:\/\/router.project-osrm.org\/route\/v1\/driving\/121.121150,14.625450;121.168540,14.621410\?/);
  assert.match(calls[0], /overview=full&geometries=geojson&alternatives=true/);
  const cached = await route({...request, originLabel: 'Changed label'});
  assert.equal(cached.cached, true); assert.equal(cached.routes[0].origin, 'Changed label'); assert.equal(calls.length, 1);
  await assert.rejects(route({...request, origin: request.destination, destination: request.origin}), /wait/);
  time += 5000; await route({...request, origin: request.destination, destination: request.origin}); assert.equal(calls.length, 2);
  time += 301000; await route(request); assert.equal(calls.length, 3);
});
test('deduplicates pending requests and never auto-retries offline failures', async () => {
  let finish; let calls = 0;
  const route = createRoadRouter({fetcher: () => {calls++; return new Promise(resolve => {finish = resolve;});}});
  const first = route(request);
  await assert.rejects(route(request), /already running/);
  finish(ok()); await first; assert.equal(calls, 1);
  const offline = createRoadRouter({fetcher: async () => {throw new TypeError('Network error');}});
  await assert.rejects(offline(request), /Check your connection/);
  await assert.rejects(offline(request), /wait/);
});
test('server throttling respects Retry-After and failures preserve cached routes', async () => {
  let time = 1000, status = 200;
  const route = createRoadRouter({now: () => time, fetcher: async () => status === 200 ? ok() : new Response('', {status, headers: {'Retry-After': '120'}})});
  await route(request); time += 5000; status = 429;
  const reversed = {...request, origin: request.destination, destination: request.origin};
  await assert.rejects(route(reversed), /server is busy/);
  time += 61000; await assert.rejects(route(reversed), /wait/);
  assert.equal((await route(request)).cached, true);
  time += 60000; status = 503; await assert.rejects(route(reversed), /503/);
});
test('timeouts abort the request; invalid endpoints do not hit the service', async () => {
  let calls = 0;
  const route = createRoadRouter({timeoutMs: 10, fetcher: (_, {signal}) => {calls++; return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));}});
  await assert.rejects(route({...request, destination: request.origin}), /different/);
  await assert.rejects(route({...request, origin: {latitude: NaN, longitude: 0}}), /valid/);
  assert.equal(calls, 0);
  await assert.rejects(route(request), /timed out/); assert.equal(calls, 1);
});
