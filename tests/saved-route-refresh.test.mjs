import test from 'node:test';
import assert from 'node:assert/strict';
import {createSavedJourneysStore, SAVED_JOURNEYS_KEY, decodeSavedJourneys} from '../src/services/savedJourneys.ts';
import {createSavedRouteRefresher} from '../src/services/savedRouteRefresh.ts';
import {createRoadRouter, parseRoadResponse} from '../src/services/roadRouting.ts';
import {routes} from '../src/data/routes.ts';

const trip = {origin: {latitude: 14.6, longitude: 121.1}, destination: {latitude: 14.5, longitude: 121.2}, originLabel: 'Station', destinationLabel: 'Station'};
const body = {code: 'Ok', routes: [0, 1].map(i => ({distance: 3000 + i * 500, duration: 600 + i * 100,
  geometry: {type: 'LineString', coordinates: [[121.1, 14.6], [121.15, 14.55 + i * 0.01], [121.2, 14.5]]}}))};
const roads = parseRoadResponse(body, trip, 1000);
const newer = (route = roads[0]) => ({...route, id: 'road-new', fetchedAt: 2000, durationSeconds: 800, distanceMeters: 3500});
const deferred = () => {let resolve; const promise = new Promise(done => {resolve = done;}); return {promise, resolve};};
async function fixture() {
  const values = new Map([['pathfinder.journey-history.v1', 'history'], ['pathfinder.restart-recovery.v1', 'recovery']]);
  let fail = false;
  const storage = {getItem: async key => values.get(key) ?? null, setItem: async (key, value) => {if (fail) throw new Error('Full'); values.set(key, value);}};
  const store = createSavedJourneysStore(storage, () => 1500); await store.save(roads[0]);
  const entry = store.getSnapshot().items[0];
  return {store, storage, values, entry, fail: value => {fail = value;}};
}
test('manual refresh uses requested coordinates and bypasses cache; matching geometry updates one stable record', async () => {
  const {store, entry, values, storage} = await fixture(); let args;
  const refresh = createSavedRouteRefresher(store, async (...input) => {args = input; return {cached: false, routes: [newer()]};});
  assert.equal(refresh.getSnapshot().phase, 'idle'); await refresh.start(entry);
  assert.deepEqual(args[0], trip); assert.equal(args[2].forceRefresh, true); assert.equal(args[1].aborted, false);
  assert.equal(refresh.getSnapshot().phase, 'success'); const item = store.getSnapshot().items[0];
  assert.equal(item.id, entry.id); assert.equal(item.savedAt, entry.savedAt); assert.equal(item.route.fetchedAt, 2000);
  assert.equal(item.route.durationSeconds, 800); assert.equal(item.route.distanceMeters, 3500); assert.equal(store.getSnapshot().items.length, 1);
  assert.equal(entry.route.fetchedAt, 1000); // caller/active snapshots unchanged
  assert.equal(values.get('pathfinder.journey-history.v1'), 'history'); assert.equal(values.get('pathfinder.restart-recovery.v1'), 'recovery');
  const restarted = createSavedJourneysStore(storage); await restarted.load(); assert.deepEqual(restarted.getSnapshot().items, [item]);
});
test('alternative matching uses geometry rather than response order or timestamp IDs', async () => {
  const {store, entry} = await fixture();
  const refresh = createSavedRouteRefresher(store, async () => ({cached: false, routes: [newer(roads[1]), {...newer(), id: 'now-second', label: 'Driving route 2'}]}));
  await refresh.start(entry); assert.equal(refresh.getSnapshot().phase, 'success'); assert.equal(store.getSnapshot().items[0].route.id, 'now-second');
});
test('changed geometry/missing alternative keeps old snapshot until explicit replacement, or cancellation', async () => {
  const {store, entry, values} = await fixture(); const before = values.get(SAVED_JOURNEYS_KEY);
  const refresh = createSavedRouteRefresher(store, async () => ({cached: false, routes: [newer(roads[1])]}));
  await refresh.start(entry); assert.equal(refresh.getSnapshot().phase, 'confirm'); assert.equal(values.get(SAVED_JOURNEYS_KEY), before);
  refresh.cancel(); await refresh.confirm('road-new'); assert.equal(values.get(SAVED_JOURNEYS_KEY), before);
  await refresh.start(entry); await refresh.confirm('road-new'); assert.equal(refresh.getSnapshot().phase, 'success');
  assert.deepEqual(store.getSnapshot().items[0].route.coordinates, roads[1].coordinates); assert.equal(store.getSnapshot().items[0].id, entry.id);
});
test('network failure and timeout leave the saved record and persistence intact', async () => {
  for (const fetcher of [async () => {throw new TypeError('Offline');}, () => new Promise(() => {})]) {
    const {store, entry, values} = await fixture(); const before = values.get(SAVED_JOURNEYS_KEY);
    const refresh = createSavedRouteRefresher(store, createRoadRouter({fetcher, timeoutMs: 5})); await refresh.start(entry);
    assert.equal(refresh.getSnapshot().phase, 'error'); assert.match(refresh.getSnapshot().message, /connection|timed out/);
    assert.equal(values.get(SAVED_JOURNEYS_KEY), before); assert.deepEqual(store.getSnapshot().items, [entry]);
  }
});
test('cancel/navigation and newer refresh discard noncooperative late responses', async () => {
  const {store, entry, values} = await fixture(); const waiting = deferred(); let signal;
  const before = values.get(SAVED_JOURNEYS_KEY);
  const refresh = createSavedRouteRefresher(store, async (_, abort) => {signal = abort; return waiting.promise;});
  const request = refresh.start(entry); refresh.cancel(); assert.equal(signal.aborted, true);
  waiting.resolve({cached: false, routes: [newer()]}); await request;
  assert.equal(refresh.getSnapshot().phase, 'cancelled'); assert.equal(values.get(SAVED_JOURNEYS_KEY), before);
  let call = 0; const old = deferred();
  const replacement = createSavedRouteRefresher(store, async () => ++call === 1 ? old.promise : {cached: false, routes: [newer()]});
  const first = replacement.start(entry); await replacement.start(entry); old.resolve({cached: false, routes: [newer(roads[1])]}); await first;
  assert.equal(replacement.getSnapshot().phase, 'success'); assert.equal(store.getSnapshot().items[0].route.id, 'road-new');
});
test('real fetch is aborted on cancellation; failed refresh preserves ordinary search cache and throttle', async () => {
  const {store, entry} = await fixture(); let now = 1000, count = 0, signal;
  const request = createRoadRouter({now: () => now, fetcher: async (_, options) => {
    signal = options.signal; if (++count === 1) return Response.json(body); return new Promise(() => {});
  }});
  await request(trip); const refresh = createSavedRouteRefresher(store, request);
  await refresh.start(entry); assert.match(refresh.getSnapshot().message, /wait/); assert.equal(count, 1);
  now += 5000; const pending = refresh.start(entry); refresh.cancel(); await pending; assert.equal(signal.aborted, true);
  assert.equal((await request(trip)).cached, true); await assert.rejects(request(trip, undefined, {forceRefresh: true}), /wait/);
});
test('forced refresh obtains new data within cache TTL without changing default search caching', async () => {
  let now = 1000, calls = 0;
  const request = createRoadRouter({now: () => now, fetcher: async () => {calls++; return Response.json(body);}});
  await request(trip); now += 5000;
  assert.equal((await request(trip)).cached, true); const refreshed = await request(trip, undefined, {forceRefresh: true});
  assert.equal(refreshed.cached, false); assert.equal(refreshed.routes[0].fetchedAt, now); assert.equal(calls, 2);
});
test('duplicate replacement is rejected without deleting either saved record', async () => {
  const {store, entry, values} = await fixture(); await store.save(roads[1]); const before = values.get(SAVED_JOURNEYS_KEY);
  const refresh = createSavedRouteRefresher(store, async () => ({cached: false, routes: [newer(roads[1])]}));
  await refresh.start(entry); await refresh.confirm('road-new'); assert.equal(refresh.getSnapshot().phase, 'error');
  assert.match(refresh.getSnapshot().message, /already saved/); assert.equal(values.get(SAVED_JOURNEYS_KEY), before); assert.equal(store.getSnapshot().items.length, 2);
});
test('concurrent deletion, replacement and cancellation invalidate old refresh commits', async () => {
  for (const action of ['delete', 'replace', 'cancel']) {
    const {store, entry} = await fixture(); const waiting = deferred();
    const refresh = createSavedRouteRefresher(store, async () => waiting.promise); const pending = refresh.start(entry);
    if (action === 'delete') await store.remove(entry.id);
    if (action === 'replace') await store.replace(entry, {...newer(), fetchedAt: 3000});
    if (action === 'cancel') refresh.cancel();
    waiting.resolve({cached: false, routes: [newer()]}); await pending;
    assert.equal(store.getSnapshot().items.length, action === 'delete' ? 0 : 1);
    if (action === 'replace') assert.equal(store.getSnapshot().items[0].route.fetchedAt, 3000);
    if (action === 'cancel') assert.equal(store.getSnapshot().items[0].route.fetchedAt, 1000);
  }
});
test('queued refresh followed by deletion never resurrects a record', async () => {
  const {store, entry, values} = await fixture(); const update = store.replace(entry, newer()), deletion = store.remove(entry.id);
  await Promise.all([update, deletion]); assert.equal(decodeSavedJourneys(values.get(SAVED_JOURNEYS_KEY)).length, 0);
});
test('cancelling a queued or disk-validation commit preserves data without a misleading storage error', async () => {
  const {store, entry, storage, values} = await fixture(); const before = values.get(SAVED_JOURNEYS_KEY);
  await store.replace(entry, newer(), () => false); assert.equal(store.getSnapshot().error, null);
  const waiting = deferred(), get = storage.getItem;
  storage.getItem = async key => {await waiting.promise; return get(key);};
  let current = true; const updating = store.replace(entry, newer(), () => current);
  await Promise.resolve(); current = false; waiting.resolve(); await updating;
  assert.equal(values.get(SAVED_JOURNEYS_KEY), before); assert.equal(store.getSnapshot().error, null);
});
test('write failures preserve previous snapshot and can be retried', async () => {
  const {store, entry, values, fail} = await fixture(); const before = values.get(SAVED_JOURNEYS_KEY);
  const refresh = createSavedRouteRefresher(store, async () => ({cached: false, routes: [newer()]}));
  fail(true); await refresh.start(entry); assert.equal(refresh.getSnapshot().phase, 'error'); assert.deepEqual(store.getSnapshot().items, [entry]);
  assert.equal(values.get(SAVED_JOURNEYS_KEY), before); fail(false); await refresh.start(entry); assert.equal(refresh.getSnapshot().phase, 'success');
});
test('corruption discovered after a request begins is never overwritten', async () => {
  const {store, entry, values} = await fixture(); values.set(SAVED_JOURNEYS_KEY, '{broken');
  const refresh = createSavedRouteRefresher(store, async () => ({cached: false, routes: [newer()]}));
  await refresh.start(entry); assert.equal(refresh.getSnapshot().phase, 'error'); assert.equal(values.get(SAVED_JOURNEYS_KEY), '{broken');
  assert.deepEqual(store.getSnapshot().items, [entry]); assert.equal(store.getSnapshot().ready, false);
});
test('invalid, empty, cached, or wrong-endpoint responses and transit demos cannot replace saved data', async () => {
  for (const result of [{cached: false, routes: []}, {cached: true, routes: [newer()]},
    {cached: false, routes: [{...newer(), durationSeconds: -1}]},
    {cached: false, routes: [{...newer(), requestedEndpoints: {...roads[0].requestedEndpoints, origin: {latitude: 20, longitude: 120}}}]}]) {
    const {store, entry, values} = await fixture(); const before = values.get(SAVED_JOURNEYS_KEY);
    const refresh = createSavedRouteRefresher(store, async () => result); await refresh.start(entry);
    assert.equal(refresh.getSnapshot().phase, 'error'); assert.equal(values.get(SAVED_JOURNEYS_KEY), before);
  }
  const {store} = await fixture(); let calls = 0;
  const refresh = createSavedRouteRefresher(store, async () => {calls++;}); await refresh.start({id: 'demo', savedAt: 1, route: routes[0]});
  assert.equal(calls, 0); assert.equal(refresh.getSnapshot().phase, 'error');
});
