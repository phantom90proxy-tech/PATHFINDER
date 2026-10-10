import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlaceSearch, parsePlaces} from '../src/services/placeSearch.ts';
import {parseRoadResponse} from '../src/services/roadRouting.ts';
import {googleMapsURL} from '../src/services/googleMaps.ts';

const feature = {geometry: {type: 'Point', coordinates: [120.98, 14.58]}, properties: {name: 'Rizal Park', city: 'Manila', country: 'Philippines'}};
test('Photon validates geometry and retains distinguishable place labels', () => {
  assert.deepEqual(parsePlaces({features: [feature, {...feature, geometry: {type: 'Point', coordinates: [999, 2]}}, null]}), [{label: 'Rizal Park, Manila, Philippines', point: {longitude: 120.98, latitude: 14.58}}]);
  assert.throws(() => parsePlaces({}), /unreadable/);
  assert.deepEqual(parsePlaces({features: []}), []);
});
test('explicit place lookup encodes queries and caches without invented results', async () => {
  const urls = [];
  const search = createPlaceSearch({intervalMs: 0, fetcher: async url => {urls.push(url); return Response.json({features: [feature]});}});
  await assert.rejects(search(''), /Enter a place/);
  const result = await search('Park & café');
  assert.equal(new URL(urls[0]).searchParams.get('q'), 'Park & café');
  assert.deepEqual(await search('Park & café'), result);
  assert.equal(urls.length, 1);
  const empty = createPlaceSearch({fetcher: async () => Response.json({features: []})});
  assert.deepEqual(await empty('Unknown place'), []);
});
test('offline, throttled and timed-out place lookups fail explicitly', async () => {
  await assert.rejects(createPlaceSearch({fetcher: async () => {throw new TypeError('offline');}})('Manila'), /connection/);
  const limited = createPlaceSearch({fetcher: async () => new Response('', {status: 429})});
  await assert.rejects(limited('Manila'), /Wait a minute/);
  await assert.rejects(limited('Quezon'), /Wait a minute/);
  const timeout = createPlaceSearch({timeoutMs: 5, fetcher: async (_, {signal}) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))))});
  await assert.rejects(timeout('Manila'), /timed out/);
});
test('Google directions retain requested endpoints even without OSRM waypoints', () => {
  const request = {origin: {latitude: 14.58, longitude: 120.98}, destination: {latitude: 14.6, longitude: 120.97}, originLabel: 'Park', destinationLabel: 'Fort'};
  const body = {code: 'Ok', routes: [{distance: 3000, duration: 600, geometry: {type: 'LineString', coordinates: [[120.981,14.581],[120.971,14.601]]}}]};
  const [route] = parseRoadResponse(body, request, 1);
  const url = new URL(googleMapsURL(route));
  assert.equal(url.searchParams.get('origin'), '14.58,120.98');
  assert.equal(url.searchParams.get('destination'), '14.6,120.97');
});
