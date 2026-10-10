import test from 'node:test';
import assert from 'node:assert/strict';
import {googleMapsURL, openGoogleMaps} from '../src/services/googleMaps.ts';
import {routes} from '../src/data/routes.ts';

const query = (...args) => new URL(googleMapsURL(...args)).searchParams;
test('selected endpoints, reversal and route state are preserved', () => {
  const before = JSON.stringify(routes);
  const q = query(routes[0]);
  assert.equal(q.get('api'), '1'); assert.equal(q.get('travelmode'), 'driving');
  assert.equal(q.get('origin'), '14.62545,121.12115');
  assert.equal(q.get('destination'), '14.62141,121.16854');
  assert.equal(query(routes[0], true).get('origin'), q.get('destination'));
  assert.equal(query(routes[0], true).get('destination'), q.get('origin'));
  assert.equal(JSON.stringify(routes), before);
});
test('road requested endpoints win over snapped geometry and are not reversed twice', () => {
  const road = {...routes[0], kind: 'road', id: 'osrm-alternative-private', snapping: {origin: {requested: {latitude: 12, longitude: 120}}, destination: {requested: {latitude: 13, longitude: 121}}}};
  assert.equal(query(road, true).get('origin'), '12,120');
  assert.equal(query(road, true).get('destination'), '13,121');
  assert.equal(googleMapsURL(road).includes(road.id), false);
});
test('place names encode reserved and Unicode characters without parameter injection', () => {
  const route = {...routes[0], coordinates: [], origin: 'A & B / café', destination: 'C? #north=1'};
  assert.equal(query(route).get('origin'), route.origin);
  assert.equal(query(route).get('destination'), route.destination);
  assert.equal([...query(route).keys()].length, 4);
});
test('current GPS uses only a fresh valid fix; otherwise Google resolves device origin', () => {
  const route = {...routes[0], origin: 'Current location'};
  const fix = {latitude: 15, longitude: 122, timestamp: 1000, accuracy: 10};
  assert.equal(query(route, false, fix, 2000).get('origin'), '15,122');
  for (const location of [null, {...fix, timestamp: -400000}, {...fix, latitude: NaN}, {...fix, timestamp: 3000}]) assert.equal(query(route, false, location, 2000).has('origin'), false);
  assert.ok(query(route, false, null, 2000).get('destination'));
});
test('missing endpoints, invalid coordinates and overlong URLs fail helpfully', () => {
  const base = {...routes[0], coordinates: []};
  assert.throws(() => googleMapsURL({...base, destination: ''}), /destination/);
  assert.throws(() => googleMapsURL({...base, origin: ''}), /origin/);
  assert.throws(() => googleMapsURL({...base, destination: '91,180'}), /coordinates/);
  assert.throws(() => googleMapsURL({...base, destination: 'x'.repeat(2048)}), /too long/);
});
test('Android delegates the same HTTPS URL to OS app/browser resolution and handles rejection', async () => {
  const url = googleMapsURL(routes[0]);
  for (const installed of ['Maps', 'browser']) {
    const calls = [];
    await openGoogleMaps(url, {platform: 'android', openURL: async value => {calls.push([installed, value]);}, openTab: () => {throw new Error('Web only');}});
    assert.deepEqual(calls, [[installed, url]]);
  }
  await assert.rejects(openGoogleMaps(url, {platform: 'android', openURL: async () => {throw new Error('No handler');}, openTab: () => false}), /web browser is available/);
});
test('Web opens a separate tab synchronously and reports blocked popups without navigating current page', async () => {
  let called = false;
  const url = googleMapsURL(routes[0]);
  const ports = {platform: 'web', openURL: async () => {throw new Error('Must not replace PATHFINDER');}, openTab: value => {called = true; assert.equal(value, url); return true;}};
  const result = openGoogleMaps(url, ports); assert.equal(called, true); await result;
  await assert.rejects(openGoogleMaps(url, {...ports, openTab: () => false}), /Allow pop-ups/);
});
