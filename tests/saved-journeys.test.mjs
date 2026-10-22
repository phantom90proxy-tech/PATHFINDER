import test from 'node:test';
import assert from 'node:assert/strict';
import {createSavedJourneysStore, decodeSavedJourneys, snapshotRoute, journeyIdentity, SAVED_JOURNEYS_KEY} from '../src/services/savedJourneys.ts';
import {routes} from '../src/data/routes.ts';

const road = {kind: 'road', id: 'road-100-0', label: 'Driving route 1', origin: 'Station', destination: 'Station', color: '#7ed957',
  fetchedAt: 100, durationSeconds: 600, distanceMeters: 3000,
  coordinates: [{latitude: 14.6, longitude: 121.1}, {latitude: 14.5, longitude: 121.2}],
  requestedEndpoints: {origin: {latitude: 14.6, longitude: 121.1, accuracy: 5, timestamp: 12}, destination: {latitude: 14.5, longitude: 121.2}}};
function fixture(initial = null) {
  const values = new Map(initial === null ? [] : [[SAVED_JOURNEYS_KEY, initial]]);
  const storage = {getItem: async key => values.get(key) ?? null, setItem: async (key, value) => {values.set(key, value);}};
  return {values, storage, store: createSavedJourneysStore(storage, () => 1000)};
}

test('new storage loads empty; save persists an independent snapshot across store recreation', async () => {
  const {store, storage, values} = fixture(); await store.load();
  assert.deepEqual(store.getSnapshot().items, []);
  const before = JSON.stringify(road);
  assert.equal(await store.save(road), 'saved');
  assert.equal(JSON.stringify(road), before);
  const entry = store.getSnapshot().items[0];
  assert.equal(entry.route.id, road.id); assert.equal(entry.route.origin, 'Station');
  assert.deepEqual(entry.route.coordinates, road.coordinates);
  assert.notEqual(entry.route.coordinates, road.coordinates);
  assert.deepEqual(entry.route.requestedEndpoints.origin, {latitude: 14.6, longitude: 121.1});
  assert.doesNotMatch(values.get(SAVED_JOURNEYS_KEY), /accuracy|timestamp/);
  const restarted = createSavedJourneysStore(storage); await restarted.load();
  assert.deepEqual(restarted.getSnapshot().items, store.getSnapshot().items);
});

test('duplicates use stable endpoint/geometry identity rather than names, fetch IDs or estimates', async () => {
  const {store} = fixture();
  await store.save(road);
  assert.equal(await store.save({...road, id: 'road-999-0', fetchedAt: 999, durationSeconds: 800, origin: 'Renamed'}), 'duplicate');
  const moved = {...road, requestedEndpoints: {...road.requestedEndpoints, origin: {latitude: 14.61, longitude: 121.1}}};
  assert.equal(await store.save(moved), 'saved');
  const alternative = {...road, coordinates: [road.coordinates[0], {latitude: 14.55, longitude: 121.15}, road.coordinates[1]]};
  assert.equal(await store.save(alternative), 'saved');
  assert.equal(store.getSnapshot().items.length, 3);
});

test('demo reversal saves the selected direction without mutating it; services remain distinct', async () => {
  const {store} = fixture(); const before = JSON.stringify(routes);
  await store.save(routes[0], true); await store.save(routes[0]); await store.save(routes[1], true);
  const reversed = store.getSnapshot().items[0].route;
  assert.equal(reversed.origin, routes[0].destination);
  assert.equal(reversed.destination, routes[0].origin);
  assert.deepEqual(reversed.coordinates, [...routes[0].coordinates].reverse());
  assert.equal(reversed.fare, routes[0].fare);
  assert.equal(store.getSnapshot().items.length, 3);
  assert.equal(JSON.stringify(routes), before);
  assert.equal(await store.save(routes[0], true), 'duplicate');
});

test('serialized concurrent saves and deletes preserve unrelated journeys and storage keys', async () => {
  const {store, values, storage} = fixture(); values.set('unrelated', 'keep');
  await Promise.all([store.save(routes[0]), store.save(routes[1]), store.save(routes[0])]);
  const entries = store.getSnapshot().items;
  assert.equal(entries.length, 2); assert.notEqual(entries[0].id, entries[1].id);
  await Promise.all([store.remove(entries[0].id), store.save(routes[2])]);
  assert.deepEqual(store.getSnapshot().items.map(item => item.route.id), ['route-2', 'route-3']);
  const fresh = createSavedJourneysStore(storage); await fresh.load();
  assert.deepEqual(fresh.getSnapshot().items, store.getSnapshot().items);
  assert.equal(values.get('unrelated'), 'keep');
});

test('corrupt, unsupported and invalid persisted data is rejected without overwriting it', async () => {
  for (const raw of ['{bad', 'null', JSON.stringify({version: 2, items: []}), JSON.stringify({version: 1, items: [{}]}),
    JSON.stringify({version: 1, items: [{id: 'x', savedAt: 100, route: {...road, coordinates: [{latitude: 999, longitude: 0}, road.coordinates[1]]}}]})]) {
    const {store, values} = fixture(raw);
    await assert.rejects(store.load(), /could not be read/);
    assert.equal(store.getSnapshot().ready, false);
    assert.deepEqual(store.getSnapshot().items, []);
    await assert.rejects(store.save(road), /could not be read/);
    assert.equal(values.get(SAVED_JOURNEYS_KEY), raw);
  }
});

test('read and write errors are recoverable; failed deletion keeps the displayed and persisted item', async () => {
  const {store, storage, values} = fixture(); const get = storage.getItem, set = storage.setItem;
  storage.getItem = async () => {throw new Error('unavailable');};
  await assert.rejects(store.load(), /could not be read/);
  storage.getItem = get; await store.load(); await store.save(road);
  const before = values.get(SAVED_JOURNEYS_KEY), id = store.getSnapshot().items[0].id;
  storage.setItem = async () => {throw new Error('quota');};
  await assert.rejects(store.remove(id), /Could not update/);
  assert.equal(store.getSnapshot().items.length, 1); assert.equal(values.get(SAVED_JOURNEYS_KEY), before);
  await assert.rejects(store.save(routes[0]), /Could not update/);
  storage.setItem = set; await store.remove(id);
  assert.deepEqual(store.getSnapshot().items, []); assert.equal(store.getSnapshot().error, null);
});

test('snapshot rejects malformed routes and strips unneeded fields; road reversal is not applied twice', () => {
  assert.throws(() => snapshotRoute({...road, distanceMeters: NaN}), /Invalid/);
  assert.throws(() => snapshotRoute({...road, coordinates: []}), /Invalid/);
  assert.deepEqual(snapshotRoute(road, true), snapshotRoute(road));
  assert.equal(journeyIdentity(snapshotRoute(road)), journeyIdentity(snapshotRoute({...road, id: 'new-id'})));
  assert.deepEqual(decodeSavedJourneys(null), []);
  const snapped = snapshotRoute({...road, snapping: {origin: {requested: road.requestedEndpoints.origin, snapped: road.coordinates[0], distanceMeters: 240}, destination: null}});
  assert.equal(snapped.snapping.origin.distanceMeters, 240);
  assert.deepEqual(snapped.snapping.origin.requested, {latitude: 14.6, longitude: 121.1});
});
