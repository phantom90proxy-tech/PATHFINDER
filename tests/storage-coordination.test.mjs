import test from 'node:test';
import assert from 'node:assert/strict';
import {createInProcessStorageCoordination} from '../src/services/storageCoordination.ts';
import {createWebStorageCoordination, storageLockName} from '../src/services/storageCoordination.web.ts';
import {createSavedJourneysStore, SAVED_JOURNEYS_KEY} from '../src/services/savedJourneys.ts';
import {createJourneyHistoryStore, JOURNEY_HISTORY_KEY} from '../src/services/journeyHistory.ts';
import {routes} from '../src/data/routes.ts';

const deferred = () => {let resolve; const promise = new Promise(done => {resolve = done;}); return {promise, resolve};};
const areas = [['saved', createSavedJourneysStore, SAVED_JOURNEYS_KEY, 'save'], ['history', createJourneyHistoryStore, JOURNEY_HISTORY_KEY, 'record']];
function memory() {
  const values = new Map();
  return {values, storage: {getItem: async key => values.get(key) ?? null, setItem: async (key, value) => {values.set(key, value);}}};
}
for (const [name, factory, key, action] of areas) {
  test(`${name}: independent hydrated stores merge concurrent mutations and reject duplicate identities`, async () => {
    const {storage, values} = memory(), coordination = createInProcessStorageCoordination();
    const a = factory(storage, () => 1000, coordination), b = factory(storage, () => 1000, coordination);
    await Promise.all([a.load(), b.load()]);
    await Promise.all([a[action](routes[0]), b[action](routes[1])]);
    assert.deepEqual(JSON.parse(values.get(key)).items.map(x => x.route.id).sort(), ['route-1', 'route-2']);
    await Promise.all([a[action](routes[0]), b[action](routes[0])]); assert.equal(JSON.parse(values.get(key)).items.length, 2);
  });
  test(`${name}: stale mutations do not restore deleted entries or overwrite corrupted records`, async () => {
    const {storage, values} = memory(), a = factory(storage), b = factory(storage);
    await a[action](routes[0]); await b.load(); await a.remove(a.getSnapshot().items[0].id);
    await b[action](routes[1]); assert.deepEqual(JSON.parse(values.get(key)).items.map(x => x.route.id), ['route-2']);
    values.set(key, '{corrupt'); await assert.rejects(b[action](routes[2]), /could not be read/); assert.equal(values.get(key), '{corrupt');
  });
  test(`${name}: missing Web Locks blocks mutations but not reads`, async () => {
    const {storage, values} = memory(), original = factory(storage); await original[action](routes[0]); const before = values.get(key);
    const coordination = createWebStorageCoordination(() => ({navigator: {}}));
    const reader = factory(storage, Date.now, coordination); await reader.load(); assert.equal(reader.getSnapshot().items.length, 1);
    await assert.rejects(reader[action](routes[1]), /coordination is unavailable/); assert.equal(values.get(key), before);
  });
}
test('history clear followed by a stale record keeps only the new explicit selection and respects max 20', async () => {
  const {storage, values} = memory(), a = createJourneyHistoryStore(storage), b = createJourneyHistoryStore(storage);
  await a.record(routes[0]); await b.load(); await a.clear(); await b.record(routes[1]);
  assert.deepEqual(JSON.parse(values.get(JOURNEY_HISTORY_KEY)).items.map(x => x.route.id), ['route-2']);
  await Promise.all(Array.from({length: 24}, (_, i) => (i % 2 ? a : b).record({...routes[0], id: `service-${i}`})));
  assert.equal(JSON.parse(values.get(JOURNEY_HISTORY_KEY)).items.length, 20);
});
test('native coordination serializes each key, releases failures, and leaves different keys independent', async () => {
  const coordination = createInProcessStorageCoordination(), waiting = deferred(), order = [];
  const first = coordination.mutate('saved', async () => {order.push('start'); await waiting.promise; throw new Error('write failure');});
  const rejected = assert.rejects(first, /write failure/);
  const next = coordination.mutate('saved', async () => {order.push('next');});
  await coordination.mutate('history', async () => {order.push('independent');}); assert.deepEqual(order, ['start', 'independent']);
  waiting.resolve(); await Promise.all([rejected, next]); assert.equal(order.at(-1), 'next');
});
test('an older delayed history selection cannot replace a newer selection of the same route', async () => {
  const {storage, values} = memory();
  const newer = createJourneyHistoryStore(storage, () => 2000), older = createJourneyHistoryStore(storage, () => 1000);
  await older.load(); await newer.record(routes[0]); await older.record({...routes[0], minutes: 99});
  const entry = JSON.parse(values.get(JOURNEY_HISTORY_KEY)).items[0];
  assert.equal(entry.selectedAt, 2000); assert.equal(entry.route.minutes, routes[0].minutes);
});
test('web locks cover awaited work and have a timeout only while waiting to acquire', async () => {
  let captured;
  const target = {navigator: {locks: {request: async (name, options, work) => {captured = {name, ...options}; return work();}}}};
  const coordination = createWebStorageCoordination(() => target, 5), waiting = deferred();
  const pending = coordination.mutate('saved', () => waiting.promise); await new Promise(resolve => setTimeout(resolve, 12));
  assert.equal(captured.name, storageLockName('saved')); assert.equal(captured.mode, 'exclusive'); assert.equal(captured.signal.aborted, false);
  waiting.resolve('done'); assert.equal(await pending, 'done');
  let called = false;
  target.navigator.locks.request = (_, {signal}) => new Promise((_, reject) => {signal.addEventListener('abort', () => reject(new Error('aborted')));});
  await assert.rejects(coordination.mutate('saved', async () => {called = true;}), /busy in another tab/); assert.equal(called, false);
});
test('coordination errors fail closed and preserve original work errors once acquired', async () => {
  let called = false;
  const target = {navigator: {locks: {request: async () => {throw new Error('denied');}}}};
  const coordination = createWebStorageCoordination(() => target);
  await assert.rejects(coordination.mutate('saved', async () => {called = true;}), /coordination is unavailable/); assert.equal(called, false);
  target.navigator.locks.request = async (_, options, work) => work();
  await assert.rejects(coordination.mutate('saved', async () => {throw new Error('original storage error');}), /original storage error/);
  assert.equal(await coordination.mutate('saved', async () => 42), 42);
});
test('web subscriptions filter keys and storage area, reconcile on resume, and clean up', () => {
  const target = new EventTarget(), doc = new EventTarget(); doc.visibilityState = 'visible'; target.document = doc; target.localStorage = {};
  const coordination = createWebStorageCoordination(() => target); let events = 0;
  const stop = coordination.subscribe('saved', () => {events++;});
  const event = (key, area = target.localStorage) => {const value = new Event('storage'); Object.assign(value, {key, storageArea: area}); target.dispatchEvent(value);};
  event('history'); event('saved', {}); assert.equal(events, 0); event('saved'); event(null); target.dispatchEvent(new Event('focus')); assert.equal(events, 3);
  doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange')); assert.equal(events, 3);
  doc.visibilityState = 'visible'; doc.dispatchEvent(new Event('visibilitychange')); assert.equal(events, 4);
  stop(); event('saved'); target.dispatchEvent(new Event('pageshow')); assert.equal(events, 4);
});
