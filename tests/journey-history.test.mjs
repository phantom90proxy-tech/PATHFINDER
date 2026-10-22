import test from 'node:test';
import assert from 'node:assert/strict';
import {createJourneyHistoryStore, decodeJourneyHistory, JOURNEY_HISTORY_KEY} from '../src/services/journeyHistory.ts';
import {createSavedJourneysStore, SAVED_JOURNEYS_KEY} from '../src/services/savedJourneys.ts';
import {routes} from '../src/data/routes.ts';

const start = 1_800_000_000_000;
const road = {kind: 'road', id: 'road-100-0', label: 'Driving route 1', origin: 'Station', destination: 'Station', color: '#7ed957',
  fetchedAt: start - 60_000, durationSeconds: 600, distanceMeters: 3000,
  coordinates: [{latitude: 14.6, longitude: 121.1}, {latitude: 14.5, longitude: 121.2}],
  requestedEndpoints: {origin: {latitude: 14.6, longitude: 121.1, accuracy: 7, timestamp: 123}, destination: {latitude: 14.5, longitude: 121.2}}};
function fixture(raw = null) {
  let now = start;
  const values = new Map(raw === null ? [] : [[JOURNEY_HISTORY_KEY, raw]]);
  const storage = {getItem: async key => values.get(key) ?? null, setItem: async (key, value) => {values.set(key, value);}};
  return {values, storage, store: createJourneyHistoryStore(storage, () => now), setTime: value => {now = value;}};
}

test('history starts empty and records only explicit calls, with independent sanitized snapshots', async () => {
  const {store, values} = fixture(); await store.load();
  assert.deepEqual(store.getSnapshot().items, []); assert.equal(values.has(JOURNEY_HISTORY_KEY), false);
  const before = JSON.stringify(road);
  await store.record(road);
  const entry = store.getSnapshot().items[0];
  assert.equal(entry.selectedAt, start); assert.equal(entry.route.id, road.id);
  assert.equal(entry.route.fetchedAt, road.fetchedAt);
  assert.deepEqual(entry.route.requestedEndpoints.origin, {latitude: 14.6, longitude: 121.1});
  assert.notEqual(entry.route.coordinates, road.coordinates);
  assert.equal(JSON.stringify(road), before);
  assert.doesNotMatch(values.get(JOURNEY_HISTORY_KEY), /accuracy|timestamp/);
  await assert.rejects(store.record({...road, coordinates: []}), /Invalid/);
  assert.equal(store.getSnapshot().items.length, 1);
});

test('same endpoint/path identity updates the selection time and summary without duplicates', async () => {
  const {store, setTime} = fixture();
  await store.record(road); const originalId = store.getSnapshot().items[0].id;
  setTime(start + 1000); await store.record(routes[0]);
  setTime(start + 2000);
  await store.record({...road, id: 'road-new-fetch-0', durationSeconds: 800, fetchedAt: start, origin: 'Renamed station'});
  const items = store.getSnapshot().items;
  assert.equal(items.length, 2); assert.equal(items[0].id, originalId);
  assert.equal(items[0].selectedAt, start + 2000); assert.equal(items[0].route.durationSeconds, 800);
  assert.equal(items[0].route.fetchedAt, start); assert.equal(items[0].route.origin, 'Renamed station');
  await store.record({...road, requestedEndpoints: {...road.requestedEndpoints, origin: {latitude: 14.61, longitude: 121.1}}});
  assert.equal(store.getSnapshot().items.length, 3); // Identical names, different coordinates.
});

test('history is newest first, retains at most 20 entries, and persists order after restart', async () => {
  const {store, storage, setTime} = fixture();
  for (let i = 0; i < 25; i++) {
    setTime(start + i * 1000);
    await store.record({...routes[0], id: `service-${i}`});
  }
  const items = store.getSnapshot().items;
  assert.equal(items.length, 20);
  assert.deepEqual(items.map(item => item.route.id), Array.from({length: 20}, (_, i) => `service-${24 - i}`));
  const restarted = createJourneyHistoryStore(storage); await restarted.load();
  assert.deepEqual(restarted.getSnapshot().items, items);
});

test('equal-time selections are newest first; reversal and services sharing geometry stay distinct', async () => {
  const {store} = fixture(); const before = JSON.stringify(routes);
  await Promise.all([store.record(routes[0]), store.record(routes[0], true), store.record(routes[1])]);
  const items = store.getSnapshot().items;
  assert.equal(items.length, 3);
  assert.equal(items[0].route.id, routes[1].id);
  assert.equal(items[1].route.origin, routes[0].destination);
  assert.deepEqual(items[1].route.coordinates, [...routes[0].coordinates].reverse());
  assert.equal(JSON.stringify(routes), before);
});

test('individual deletion and clearing history never modify saves; deleting saves never modifies history', async () => {
  const {store, storage, values} = fixture();
  const saved = createSavedJourneysStore(storage, () => start);
  await saved.save(road); await store.record(road); await store.record(routes[0]);
  const saveData = values.get(SAVED_JOURNEYS_KEY);
  await store.remove(store.getSnapshot().items[0].id);
  assert.equal(store.getSnapshot().items.length, 1); assert.equal(values.get(SAVED_JOURNEYS_KEY), saveData);
  const historyData = values.get(JOURNEY_HISTORY_KEY);
  await saved.remove(saved.getSnapshot().items[0].id);
  assert.equal(values.get(JOURNEY_HISTORY_KEY), historyData);
  await saved.save(routes[1]); const remainingSaved = values.get(SAVED_JOURNEYS_KEY);
  await store.clear(); assert.deepEqual(store.getSnapshot().items, []);
  assert.equal(values.get(SAVED_JOURNEYS_KEY), remainingSaved);
  const restarted = createJourneyHistoryStore(storage); await restarted.load();
  assert.deepEqual(restarted.getSnapshot().items, []);
});

test('malformed, unsupported and invalid history is not overwritten by recording; explicit clear recovers', async () => {
  for (const raw of ['{broken', 'null', JSON.stringify({version: 2, items: []}), JSON.stringify({version: 1, items: [{}]}),
    JSON.stringify({version: 1, items: [{id: 'x', selectedAt: Infinity, route: road}]}),
    JSON.stringify({version: 1, items: Array.from({length: 21}, (_, i) => ({id: String(i), selectedAt: start, route: road}))})]) {
    const {store, values} = fixture(raw);
    await assert.rejects(store.load(), /could not be read/);
    await assert.rejects(store.record(road), /could not be read/);
    assert.equal(values.get(JOURNEY_HISTORY_KEY), raw); assert.equal(store.getSnapshot().ready, false);
    await store.clear(); assert.equal(store.getSnapshot().ready, true);
    assert.deepEqual(decodeJourneyHistory(values.get(JOURNEY_HISTORY_KEY)), []);
  }
});

test('storage failures preserve the last good history and queued operations can recover', async () => {
  const {store, storage, values} = fixture();
  const get = storage.getItem, set = storage.setItem;
  storage.getItem = async () => {throw new Error('unavailable');};
  await assert.rejects(store.load(), /could not be read/);
  storage.getItem = get; await store.load(); await store.record(road);
  const before = values.get(JOURNEY_HISTORY_KEY), id = store.getSnapshot().items[0].id;
  storage.setItem = async () => {throw new Error('quota');};
  for (const action of [() => store.record(routes[0]), () => store.remove(id), () => store.clear()]) {
    await assert.rejects(action(), /Could not update/);
    assert.equal(values.get(JOURNEY_HISTORY_KEY), before); assert.equal(store.getSnapshot().items.length, 1);
  }
  storage.setItem = set; await store.record(routes[0]);
  assert.equal(store.getSnapshot().items.length, 2); assert.equal(store.getSnapshot().error, null);
});

test('reading history normalizes newest-first order without mutating its persisted data', () => {
  const raw = JSON.stringify({version: 1, items: [
    {id: 'old', selectedAt: start, route: routes[0]}, {id: 'new', selectedAt: start + 1000, route: routes[1]},
  ]});
  assert.deepEqual(decodeJourneyHistory(raw).map(item => item.id), ['new', 'old']);
  assert.equal(JSON.parse(raw).items[0].id, 'old');
  assert.deepEqual(decodeJourneyHistory(null), []);
});

test('a failed reload retains the last good view but blocks overwriting newly corrupted storage', async () => {
  const {store, values} = fixture(); await store.record(road);
  values.set(JOURNEY_HISTORY_KEY, '{corrupt');
  await assert.rejects(store.load(), /could not be read/);
  assert.equal(store.getSnapshot().items.length, 1);
  assert.equal(store.getSnapshot().ready, false);
  await assert.rejects(store.record(routes[0]), /could not be read/);
  assert.equal(values.get(JOURNEY_HISTORY_KEY), '{corrupt');
});
