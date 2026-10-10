import test from 'node:test';
import assert from 'node:assert/strict';
import {createMapSession} from '../src/map/mapSession.ts';
import {createTileFailures} from '../src/map/tileFailures.ts';
import {parseRoadResponse} from '../src/services/roadRouting.ts';
import {snappingNotice} from '../src/data/roadRoutes.ts';

const message = (generation, type, id) => JSON.stringify({generation, type, id});
test('initialization watchdog is bounded; retry retains camera and ignores retired messages', async () => {
  const session = createMapSession(10);
  const first = session.start();
  const camera = {type: 'locate', point: {latitude: 14, longitude: 121}};
  session.queueCamera(camera);
  assert.equal(session.takeCamera(first), null);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(session.snapshot().status, 'failed');
  assert.match(session.snapshot().error, /timed out/);
  assert.equal(session.receive(message(first, 'ready')), null);
  const second = session.start();
  for (const type of ['ready', 'error', 'select']) assert.equal(session.receive(message(first, type, 'road-1')), null);
  session.fail(first, 'stale native callback');
  assert.equal(session.snapshot().status, 'loading');
  session.receive(message(second, 'ready'));
  assert.deepEqual(session.takeCamera(second), camera);
  assert.equal(session.takeCamera(second), null);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(session.snapshot().status, 'ready');
  session.dispose();
});
test('script failures, duplicate ready, malformed messages and disposed sessions cannot select', () => {
  const session = createMapSession();
  const first = session.start();
  session.receive(message(first, 'error'));
  assert.equal(session.snapshot().status, 'failed');
  assert.equal(session.receive(message(first, 'select', 'a')), null);
  const second = session.start();
  assert.equal(session.receive(message(second, 'select', 'a')), null);
  session.receive(message(second, 'ready'));
  assert.equal(session.receive(message(second, 'ready')), null);
  for (const raw of ['{', 'null', '[]', '42', message(second, 'unknown')]) assert.equal(session.receive(raw), null);
  assert.equal(session.receive(message(second, 'select', 'a')).id, 'a');
  session.dispose();
  assert.equal(session.receive(message(second, 'select', 'a')), null);
});
test('mixed tile successes retain other failures; retries are explicit and throttled', () => {
  let now = 100, reloads = [];
  const failures = createTileFailures(() => now);
  failures.fail('a'); failures.fail('a'); failures.fail('b'); failures.loaded('c');
  assert.equal(failures.count(), 2);
  assert.equal(failures.retry(tile => reloads.push(tile)), true);
  assert.deepEqual(reloads, ['a', 'b']);
  assert.equal(failures.count(), 2);
  assert.equal(failures.retry(tile => reloads.push(tile)), false);
  failures.loaded('a'); assert.equal(failures.count(), 1);
  now += 5000; reloads = []; failures.retry(tile => reloads.push(tile));
  assert.deepEqual(reloads, ['b']);
  failures.unloaded('b'); assert.equal(failures.count(), 0);
});
test('waypoints retain lon/lat and distances; significant snapping is informational, never walking directions', () => {
  const request = {origin: {latitude: 14, longitude: 121}, destination: {latitude: 15, longitude: 122}, originLabel: 'A', destinationLabel: 'B'};
  const body = {code: 'Ok', routes: [{distance: 4000, duration: 300, geometry: {type: 'LineString', coordinates: [[121,14], [122,15]]}}],
    waypoints: [{distance: 254, location: [121.002,14.002]}, {distance: 100, location: [122.001,15.001]}]};
  const route = parseRoadResponse(body, request, 1)[0];
  assert.deepEqual(route.snapping.origin.snapped, {longitude:121.002, latitude:14.002});
  assert.deepEqual(route.snapping.origin.requested, request.origin);
  assert.match(snappingNotice(route), /starts about 250 m.*ends about 100 m.*walking connection has not been verified/);
  assert.equal(route.distanceMeters, 4000); assert.equal(route.durationSeconds, 300);
  for (const waypoints of [undefined, [], [null,null], [{distance:Infinity,location:[121,14]}, {distance:-1,location:[122,15]}],
    [{distance:100,location:[0,91]}, {distance:99,location:[122,15]}]]) {
    const valid = parseRoadResponse({...body, waypoints}, request, 1)[0];
    assert.equal(snappingNotice(valid), null);
    assert.deepEqual(valid.coordinates, route.coordinates);
  }
});
