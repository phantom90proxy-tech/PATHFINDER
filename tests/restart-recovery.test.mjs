import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecoveryStore, decodeRecovery, emptyRecovery, RECOVERY_KEY, validateRecovery} from '../src/services/restartRecovery.ts';
import {createEndpointConfirmations} from '../src/services/endpointConfirmations.ts';
import {routes} from '../src/data/routes.ts';
import {snapshotRoute, SAVED_JOURNEYS_KEY} from '../src/services/savedJourneys.ts';
import {JOURNEY_HISTORY_KEY} from '../src/services/journeyHistory.ts';
import {routeFreshnessLabel} from '../src/services/routeFreshness.ts';

const point = {latitude: 14.6, longitude: 121.1};
const data = () => ({...emptyRecovery(), origin: {query: 'Station', place: {label: 'Station', point}},
  destination: {query: 'Station', place: {label: 'Station', point: {latitude: 14.7, longitude: 121.2}}},
  preference: 'Fastest', journey: {kind: 'road', id: 'road-old', label: 'Driving route 1', origin: 'Station', destination: 'Station',
    color: '#7ed957', fetchedAt: 1_800_000_000_000, durationSeconds: 600, distanceMeters: 3000, coordinates: [point, {latitude: 14.7, longitude: 121.2}]}});
function fixture(raw = null) {
  const values = new Map([[SAVED_JOURNEYS_KEY, 'saved'], [JOURNEY_HISTORY_KEY, 'history']]);
  if (raw !== null) values.set(RECOVERY_KEY, raw);
  const storage = {getItem: async key => values.get(key) ?? null, setItem: async (key, value) => {values.set(key, value);}};
  return {storage, values, store: createRecoveryStore(storage)};
}
test('empty cold start has no selected journey and performs no storage writes', async () => {
  const {store, values} = fixture(); assert.equal(store.getSnapshot().ready, false);
  assert.deepEqual(await store.load(), emptyRecovery());
  assert.equal(store.getSnapshot().ready, true); assert.equal(values.has(RECOVERY_KEY), false);
});
test('confirmed endpoints and selected route survive restart with original retrieval time', async () => {
  const {store, storage} = fixture(); await store.load(); store.update(data()); await store.flush();
  const recovered = await createRecoveryStore(storage).load();
  assert.deepEqual(recovered, validateRecovery(data()));
  const confirmations = createEndpointConfirmations();
  for (const endpoint of ['origin', 'destination']) {
    confirmations.edit(endpoint, recovered[endpoint].query);
    confirmations.confirm(endpoint, recovered[endpoint].query, recovered[endpoint].place, () => true);
  }
  assert.notDeepEqual(confirmations.get('origin', 'Station').point, confirmations.get('destination', 'Station').point);
  assert.equal(recovered.journey.fetchedAt, data().journey.fetchedAt);
  assert.match(routeFreshnessLabel(recovered.journey.fetchedAt, true, recovered.journey.fetchedAt + 600_000), /10 min/);
});
test('corrupted, incompatible and invalid records are rejected without overwriting storage', async () => {
  for (const raw of ['{bad', '{"version":2}', JSON.stringify({...data(), origin: {query: 'x', place: {label: 'x', point: {latitude: 200, longitude: 1}}}})]) {
    assert.throws(() => decodeRecovery(raw));
    const {store, values} = fixture(raw); assert.deepEqual(await store.load(), emptyRecovery());
    assert.ok(store.getSnapshot().error); store.update(data()); await store.flush(); assert.equal(values.get(RECOVERY_KEY), raw);
  }
});
test('hydration blocks early edits and shares its read, then newer edits replace old snapshots', async () => {
  let resolve, reads = 0; const writes = [];
  const store = createRecoveryStore({getItem: () => {reads++; return new Promise(done => {resolve = done;});}, setItem: async (_, value) => {writes.push(value);}});
  const loading = store.load(); assert.equal(store.load(), loading);
  store.update({...emptyRecovery(), origin: {query: 'too early'}}); await store.flush(); assert.equal(writes.length, 0);
  resolve(JSON.stringify(data())); assert.equal((await loading).origin.query, 'Station'); assert.equal(reads, 1);
  store.update({...data(), origin: {query: 'first edit'}}); store.update({...data(), origin: {query: 'latest edit'}});
  await store.flush(); assert.equal(writes.length, 1); assert.equal(JSON.parse(writes[0]).origin.query, 'latest edit');
});
test('discard cancels pending writes, persists across restart, and leaves saved routes/history untouched', async () => {
  const {store, storage, values} = fixture(JSON.stringify(data())); await store.load(); store.update({...data(), origin: {query: 'pending'}});
  await store.clear(); await store.flush(); assert.deepEqual(await createRecoveryStore(storage).load(), emptyRecovery());
  assert.equal(values.get(SAVED_JOURNEYS_KEY), 'saved'); assert.equal(values.get(JOURNEY_HISTORY_KEY), 'history');
});
test('explicit discard can recover corrupted storage and later writes work', async () => {
  const {store, storage} = fixture('bad'); await store.load(); await store.clear(); store.update(data()); await store.flush();
  assert.equal(store.getSnapshot().error, null); assert.equal((await createRecoveryStore(storage).load()).journey.id, 'road-old');
});
test('unavailable reads and failed writes/discard surface errors without throwing background promises', async () => {
  const store = createRecoveryStore({getItem: async () => {throw new Error();}, setItem: async () => {throw new Error();}});
  await store.load(); assert.equal(store.getSnapshot().ready, true); assert.ok(store.getSnapshot().error);
  await assert.rejects(store.clear());
  const writing = createRecoveryStore({getItem: async () => null, setItem: async () => {throw new Error();}});
  await writing.load(); writing.update(data()); await writing.flush(); assert.match(writing.getSnapshot().error, /could not be saved/);
});
test('whitelisting excludes transient state, credentials and GPS metadata; old GPS restores as fixed point', () => {
  const source = {...data(), origin: {query: 'Current location', place: {label: 'Current location', point: {...point, accuracy: 3, timestamp: 100}}},
    loading: true, permission: 'granted', token: 'secret', controller: {}, modal: 'results'};
  source.journey.origin = 'Current location';
  const recovered = validateRecovery(source), serialized = JSON.stringify(recovered);
  assert.doesNotMatch(serialized, /accuracy|timestamp|permission|secret|controller|modal|loading|Current location/);
  assert.equal(recovered.origin.query, 'Previous starting point'); assert.equal(recovered.journey.origin, 'Previous starting point');
  assert.deepEqual(recovered.origin.place.point, point); assert.equal(source.origin.query, 'Current location');
  assert.equal(validateRecovery({...emptyRecovery(), origin: {query: 'Current location'}}).origin.query, '');
});
test('reversed demo snapshots preserve chosen direction without changing static routes', async () => {
  const {store, storage} = fixture(); await store.load(); const original = JSON.stringify(routes[0]);
  store.update({...emptyRecovery(), journey: snapshotRoute(routes[0], true)}); await store.flush();
  const restored = (await createRecoveryStore(storage).load()).journey;
  assert.equal(restored.origin, routes[0].destination); assert.deepEqual(restored.coordinates[0], routes[0].coordinates.at(-1));
  assert.equal(JSON.stringify(routes[0]), original);
});
test('unchanged snapshots do not cause excessive writes; lifecycle flush saves latest inputs', async () => {
  let writes = 0;
  const store = createRecoveryStore({getItem: async () => null, setItem: async () => {writes++;}});
  await store.load(); store.update(emptyRecovery()); await store.flush(); assert.equal(writes, 0);
  store.update(data()); await store.flush(); store.update(data()); await store.flush(); assert.equal(writes, 1);
});
test('returning to the initial input during an in-flight write still persists the newest edit', async () => {
  let finish; const writes = [];
  const store = createRecoveryStore({getItem: async () => null, setItem: async (_, value) => {
    writes.push(JSON.parse(value)); if (writes.length === 1) await new Promise(resolve => {finish = resolve;});
  }});
  await store.load(); store.update(data()); const first = store.flush();
  await Promise.resolve(); store.update(emptyRecovery()); const second = store.flush();
  finish(); await Promise.all([first, second]); assert.equal(writes.length, 2); assert.deepEqual(writes.at(-1), emptyRecovery());
});

test('swap snapshots queue behind pending writes and restart restores the final direction', async () => {
  const initial = validateRecovery(data()); let persisted = JSON.stringify(initial), finish;
  const writes = [];
  const storage = {getItem: async () => persisted, setItem: async (_, value) => {
    writes.push(value); if (writes.length === 1) await new Promise(resolve => {finish = resolve;}); persisted = value;
  }};
  const store = createRecoveryStore(storage); await store.load();
  const swapped = {...initial, origin: initial.destination, destination: initial.origin};
  store.update(swapped); const first = store.flush(); await Promise.resolve();
  store.update(initial); void store.flush();
  store.update(swapped); const latest = store.flush();
  assert.deepEqual((await createRecoveryStore(storage).load()).origin, initial.origin); // Only completed writes survive a restart.
  finish(); await Promise.all([first, latest]);
  const restored = await createRecoveryStore(storage).load();
  assert.deepEqual(restored.origin, swapped.origin); assert.deepEqual(restored.destination, swapped.destination);
  assert.deepEqual(restored.journey, initial.journey); assert.equal(writes.length, 3);
});

test('swapping indistinguishable endpoints causes no redundant recovery writes', async () => {
  const initial = {...emptyRecovery(), origin: {query: 'Station', place: {label: 'Station', point}}, destination: {query: 'Station', place: {label: 'Station', point}}};
  let writes = 0;
  const store = createRecoveryStore({getItem: async () => JSON.stringify(initial), setItem: async () => {writes++;}});
  await store.load();
  const state = createEndpointConfirmations(() => {
    store.update({...initial, origin: {query: 'Station', place: state.get('origin', 'Station')}, destination: {query: 'Station', place: state.get('destination', 'Station')}});
  });
  for (const endpoint of ['origin', 'destination']) {state.edit(endpoint, 'Station'); state.confirm(endpoint, 'Station', initial[endpoint].place, () => true);}
  await store.flush(); writes = 0;
  state.swap(); state.swap(); await store.flush(); assert.equal(writes, 0);
});
