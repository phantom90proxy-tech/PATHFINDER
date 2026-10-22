import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlaceSearch} from '../src/services/placeSearch.ts';
import {createRoadRouter} from '../src/services/roadRouting.ts';
import {createSearchSession} from '../src/services/searchSession.ts';
import {isRequestCancelled} from '../src/services/requestCancellation.ts';

const trip = {origin: {latitude: 14.6, longitude: 121.1}, destination: {latitude: 14.5, longitude: 121.2}, originLabel: 'North', destinationLabel: 'South'};
const roadBody = {code: 'Ok', routes: [{distance: 2000, duration: 300, geometry: {type: 'LineString', coordinates: [[121.1, 14.6], [121.2, 14.5]]}}]};
const placeBody = {features: [{geometry: {type: 'Point', coordinates: [121.1, 14.6]}, properties: {name: 'North'}}]};
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const deferred = () => {let resolve; const promise = new Promise(r => {resolve = r;}); return {promise, resolve};};

for (const service of ['Photon', 'OSRM']) {
  function setup(fetcher, timeoutMs = 1000) {
    let now = 1000;
    const call = service === 'Photon'
      ? createPlaceSearch({fetcher, timeoutMs, intervalMs: 0, now: () => now})
      : createRoadRouter({fetcher, timeoutMs, now: () => now});
    return {call: signal => call(service === 'Photon' ? 'North' : trip, signal), advance: () => {now += 6000;}};
  }
  const body = service === 'Photon' ? placeBody : roadBody;

  test(`${service}: exit aborts fetch, releases lock, preserves throttle, and does not cache late success`, async () => {
    const pending = deferred(); let signal, calls = 0;
    const api = setup(async (_, options) => {calls++; signal = options.signal; return calls === 1 ? pending.promise : Response.json(body);});
    const session = createSearchSession();
    const first = api.call(session.beginRequest());
    await tick();
    const rejected = assert.rejects(first, isRequestCancelled);
    session.exit(); await rejected;
    assert.equal(signal.aborted, true);
    pending.resolve(Response.json(body)); await tick();
    if (service === 'OSRM') await assert.rejects(api.call(), /wait/);
    api.advance(); await api.call();
    assert.equal(calls, 2);
    await api.call(); assert.equal(calls, 2); // Successful results still cache.
  });

  test(`${service}: rejected concurrent caller cannot cancel the accepted consumer`, async () => {
    const pending = deferred(); let acceptedSignal;
    const api = setup((_, {signal}) => {acceptedSignal = signal; return pending.promise;});
    const owner = new AbortController(), other = new AbortController();
    const first = api.call(owner.signal); await tick();
    await assert.rejects(api.call(other.signal), /already running/);
    other.abort(); assert.equal(acceptedSignal.aborted, false);
    pending.resolve(Response.json(body)); await first;
  });

  test(`${service}: cancellation during body parsing discards results`, async () => {
    const pending = deferred(); let parsing = false, calls = 0;
    const api = setup(async () => {
      calls++;
      return calls === 1 ? {ok: true, status: 200, json: () => {parsing = true; return pending.promise;}} : Response.json(body);
    });
    const controller = new AbortController();
    const first = api.call(controller.signal); await tick();
    assert.equal(parsing, true);
    const rejected = assert.rejects(first, isRequestCancelled);
    controller.abort(); await rejected;
    pending.resolve(body); await tick(); api.advance(); await api.call();
    assert.equal(calls, 2);
  });

  test(`${service}: timeout remains a timeout, even if fetch ignores AbortSignal`, async () => {
    const api = setup(() => new Promise(() => {}), 5);
    await assert.rejects(api.call(), error => /timed out/.test(error.message) && !isRequestCancelled(error));
  });

  test(`${service}: pre-aborted consumer does not start a request`, async () => {
    let calls = 0;
    const api = setup(async () => {calls++; return Response.json(body);});
    const controller = new AbortController(); controller.abort();
    await assert.rejects(api.call(controller.signal), isRequestCancelled);
    assert.equal(calls, 0);
  });
}

test('Photon: cancelling throttle wait prevents a request and releases the lock', async () => {
  let calls = 0;
  const search = createPlaceSearch({intervalMs: 1000, fetcher: async () => {calls++; return Response.json(placeBody);}});
  await search('North');
  const controller = new AbortController();
  const waiting = search('South', controller.signal);
  const rejected = assert.rejects(waiting, isRequestCancelled);
  controller.abort(); await rejected;
  assert.equal(calls, 1);
  assert.equal((await search('North')).length, 1);
});

test('rapid replacement and navigation invalidate only their own search requests', () => {
  const first = createSearchSession(), other = createSearchSession();
  const old = first.beginRequest(), unrelated = other.beginRequest();
  const latest = first.beginRequest();
  assert.equal(old.aborted, true); assert.equal(latest.aborted, false);
  assert.equal(unrelated.aborted, false);
  first.exit(); assert.equal(latest.aborted, true);
  first.activate(); const reopened = first.beginRequest();
  assert.equal(reopened.aborted, false); assert.equal(old.aborted, true);
  first.cancelRequest(); assert.equal(reopened.aborted, true);
  assert.equal(unrelated.aborted, false); other.exit();
});
