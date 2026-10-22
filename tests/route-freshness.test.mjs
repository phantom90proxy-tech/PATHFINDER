import test from 'node:test';
import assert from 'node:assert/strict';
import {routeAgeMs, routeFreshnessLabel, createFreshnessClock} from '../src/services/routeFreshness.ts';
import {createRoadRouter} from '../src/services/roadRouting.ts';

const start = 1_800_000_000_000;
test('fetched and cached labels use data retrieval time and never claim live conditions', () => {
  assert.match(routeFreshnessLabel(start, false, start), /^Fetched OSRM driving estimates.*less than 1 minute/);
  assert.match(routeFreshnessLabel(start, true, start + 120_000), /^Cached OSRM estimates.*2 minutes ago/);
  assert.match(routeFreshnessLabel(start, false, start + 60_000), /1 minute ago/);
  assert.doesNotMatch(routeFreshnessLabel(start, true, start + 299_999), /Outside/);
  assert.match(routeFreshnessLabel(start, true, start + 300_000), /5 minutes ago.*Outside.*Search again/);
  assert.match(routeFreshnessLabel(start, false, start + 900_000), /15 minutes ago.*Outside/);
});

test('missing, invalid, and future timestamps report unknown age safely', () => {
  for (const value of [undefined, null, '', String(start), NaN, Infinity, -1, 0, start + 1]) {
    assert.equal(routeAgeMs(value, start), null);
    assert.match(routeFreshnessLabel(value, true, start), /Data age unavailable/);
    assert.doesNotMatch(routeFreshnessLabel(value, true, start), /NaN|Infinity|less than/);
  }
  assert.equal(routeAgeMs(start, NaN), null);
});

function fixture(fetchedAt = start) {
  let now = start, timer, updates = [];
  const clock = createFreshnessClock(fetchedAt, () => updates.push(now), {
    now: () => now,
    schedule: (callback, delay) => {timer = {callback, delay}; return timer;},
    cancel: () => {timer = undefined;},
  });
  return {clock, updates, setTime: value => {now = value;}, timer: () => timer};
}

test('visible clock updates at minute boundaries and accounts for delayed callbacks', () => {
  const f = fixture(); f.setTime(start + 20_000); f.clock.setActive(true);
  assert.equal(f.timer().delay, 40_000);
  f.setTime(start + 60_000); f.timer().callback();
  assert.equal(f.updates.at(-1), start + 60_000);
  f.setTime(start + 371_000); f.timer().callback();
  assert.match(routeFreshnessLabel(start, true, f.updates.at(-1)), /6 minutes ago.*Outside/);
  assert.equal(f.timer().delay, 49_000);
  f.clock.dispose();
});

test('background pauses timers; resume immediately recomputes age; disposal ignores late callbacks', () => {
  const f = fixture(); f.clock.setActive(true);
  const stale = f.timer().callback;
  f.clock.setActive(false); assert.equal(f.timer(), undefined);
  f.setTime(start + 1_200_000); stale(); assert.equal(f.updates.length, 1);
  f.clock.setActive(true);
  assert.match(routeFreshnessLabel(start, true, f.updates.at(-1)), /20 minutes ago.*Outside/);
  stale(); assert.equal(f.updates.length, 2);
  const afterResume = f.timer().callback;
  f.clock.dispose(); afterResume(); f.clock.setActive(true);
  assert.equal(f.timer(), undefined); assert.equal(f.updates.length, 2);
});

test('unknown timestamps still have a bounded update cadence', () => {
  const invalid = fixture(NaN); invalid.clock.setActive(true);
  assert.equal(invalid.timer().delay, 60_000); invalid.clock.dispose();
});

test('cache hits retain original fetch time and expire at the existing five-minute boundary', async () => {
  let now = start, calls = 0;
  const request = {origin: {latitude: 14.6, longitude: 121.1}, destination: {latitude: 14.5, longitude: 121.2}, originLabel: 'A', destinationLabel: 'B'};
  const router = createRoadRouter({now: () => now, fetcher: async () => {
    calls++;
    return Response.json({code: 'Ok', routes: [{distance: 2000, duration: 300, geometry: {type: 'LineString', coordinates: [[121.1,14.6],[121.2,14.5]]}}]});
  }});
  const fetched = await router(request); assert.equal(fetched.cached, false);
  now += 120_000;
  const cached = await router(request);
  assert.equal(cached.cached, true); assert.equal(cached.routes[0].fetchedAt, start);
  assert.match(routeFreshnessLabel(cached.routes[0].fetchedAt, true, now), /2 minutes ago/);
  now = start + 300_000;
  const renewed = await router(request);
  assert.equal(renewed.cached, false); assert.equal(renewed.routes[0].fetchedAt, now);
  assert.equal(calls, 2);
});
