import test from 'node:test';
import assert from 'node:assert/strict';
import {createEndpointConfirmations} from '../src/services/endpointConfirmations.ts';
import {createSearchSession} from '../src/services/searchSession.ts';
import {createRoadRouter} from '../src/services/roadRouting.ts';

const north = {label: 'Central Station, North City', point: {latitude: 14.6, longitude: 121.1}};
const south = {label: 'Central Station, South City', point: {latitude: 14.5, longitude: 121.2}};
function confirmedJourney() {
  const state = createEndpointConfirmations();
  for (const endpoint of ['origin', 'destination']) state.edit(endpoint, 'Central Station');
  assert.equal(state.confirm('origin', 'Central Station', north, state.capture()), true);
  assert.equal(state.get('destination', 'Central Station'), undefined);
  assert.equal(state.confirm('destination', 'Central Station', south, state.capture()), true);
  return state;
}

test('identical queries preserve independent labels and coordinates through OSRM', async () => {
  const state = confirmedJourney();
  const origin = state.get('origin', 'Central Station');
  const destination = state.get('destination', 'Central Station');
  let requested;
  const route = createRoadRouter({fetcher: async url => {
    requested = url;
    return Response.json({code: 'Ok', routes: [{distance: 2000, duration: 300,
      geometry: {type: 'LineString', coordinates: [[121.1, 14.6], [121.2, 14.5]]}}]});
  }});
  const {routes: [result]} = await route({origin: origin.point, destination: destination.point,
    originLabel: origin.label, destinationLabel: destination.label});
  assert.match(requested, /121\.100000,14\.600000;121\.200000,14\.500000/);
  assert.equal(result.origin, north.label);
  assert.equal(result.destination, south.label);
  assert.deepEqual(result.requestedEndpoints, {origin: north.point, destination: south.point});
});

for (const endpoint of ['origin', 'destination']) test(`editing ${endpoint} clears only its confirmation, including edit-away-and-back`, () => {
  const state = confirmedJourney();
  const other = endpoint === 'origin' ? 'destination' : 'origin';
  const preserved = state.get(other, 'Central Station');
  const stale = state.capture();
  state.edit(endpoint, 'Different station');
  state.edit(endpoint, 'Central Station');
  assert.equal(state.get(endpoint, 'Central Station'), undefined);
  assert.deepEqual(state.get(other, 'Central Station'), preserved);
  assert.equal(state.confirm(endpoint, 'Central Station', north, stale), false);
});

test('reversing identical-name journeys swaps confirmed places and invalidates old lookups', () => {
  const state = confirmedJourney();
  const stale = state.capture();
  state.swap();
  assert.deepEqual(state.get('origin', 'Central Station'), south);
  assert.deepEqual(state.get('destination', 'Central Station'), north);
  assert.equal(state.confirm('origin', 'Central Station', north, stale), false);
  state.swap();
  assert.deepEqual(state.get('origin', 'Central Station'), north);
  assert.deepEqual(state.get('destination', 'Central Station'), south);
});

test('reversing distinct queries moves query and place together', () => {
  const state = createEndpointConfirmations();
  state.edit('origin', 'North'); state.edit('destination', 'South');
  state.confirm('origin', 'North', north, state.capture());
  state.confirm('destination', 'South', south, state.capture());
  state.swap();
  assert.deepEqual(state.get('origin', 'South'), south);
  assert.deepEqual(state.get('destination', 'North'), north);
  assert.equal(state.get('origin', 'North'), undefined);
});

test('late lookup cannot confirm after another endpoint changes or search exits and reopens', async () => {
  const state = confirmedJourney();
  const session = createSearchSession();
  const inputsCurrent = state.capture(), sessionCurrent = session.capture();
  let resolve;
  const pending = new Promise(r => {resolve = r;});
  const late = pending.then(place => state.confirm('origin', 'Central Station', place,
    () => inputsCurrent() && sessionCurrent()));
  state.edit('destination', 'Other');
  resolve(south);
  assert.equal(await late, false);
  assert.deepEqual(state.get('origin', 'Central Station'), north);
  const current = state.capture(), active = session.capture();
  session.exit(); session.activate();
  assert.equal(state.confirm('origin', 'Central Station', south, () => current() && active()), false);
});

test('swaps notify the confirmation observer after moving endpoint identities, even with identical input strings', () => {
  const observed = [];
  const state = createEndpointConfirmations(() => observed.push({origin: state.get('origin', 'Station'), destination: state.get('destination', 'Station')}));
  state.edit('origin', 'Station'); state.edit('destination', 'Station');
  state.confirm('origin', 'Station', north, state.capture());
  state.confirm('destination', 'Station', south, state.capture());
  observed.length = 0;
  const stale = state.capture();
  state.swap(); state.swap(); state.swap();
  assert.equal(observed.length, 3);
  assert.deepEqual(observed, [{origin: south, destination: north}, {origin: north, destination: south}, {origin: south, destination: north}]);
  assert.equal(stale(), false);
});
