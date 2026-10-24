import test from 'node:test';
import assert from 'node:assert/strict';
import {resetOnboardingForDevelopment} from '../src/services/devOnboardingReset.ts';

const key = 'pathfinder.onboarding.v1';
function fixture() {
  const values = new Map([[key, 'complete'], ['pathfinder.saved-journeys.v1', 'saved routes'], ['pathfinder.journey-history.v1', 'history'], ['pathfinder.appearance', 'light'], ['gps', 'unchanged']]);
  const calls = [];
  const storage = {removeItem: async name => {calls.push(['remove', name]); values.delete(name);}, getItem: async name => {calls.push(['read', name]); return values.get(name) ?? null;}};
  return {values, calls, storage};
}
test('development reset removes only onboarding, verifies deletion, and preserves all other bytes', async () => {
  const {values, calls, storage} = fixture();
  const expected = new Map(values); expected.delete(key);
  await resetOnboardingForDevelopment(storage, true);
  assert.deepEqual(values, expected);
  assert.deepEqual(calls, [['remove', key], ['read', key]]);
});
test('production reset rejects before reading or mutating storage', async () => {
  const {values, calls, storage} = fixture(); const expected = new Map(values);
  await assert.rejects(resetOnboardingForDevelopment(storage, false), /only in development/);
  assert.deepEqual(values, expected); assert.deepEqual(calls, []);
});
test('remove failure is reported and keeps existing preferences', async () => {
  const {values, storage} = fixture();
  await assert.rejects(resetOnboardingForDevelopment({...storage, removeItem: async () => {throw new Error('Storage unavailable');}}, true), /Storage unavailable/);
  assert.equal(values.get(key), 'complete');
});
test('verification read failure or a retained key cannot report success', async () => {
  await assert.rejects(resetOnboardingForDevelopment({removeItem: async () => {}, getItem: async () => 'complete'}, true), /still saved/);
  await assert.rejects(resetOnboardingForDevelopment({removeItem: async () => {}, getItem: async () => {throw new Error('Read failed');}}, true), /Read failed/);
});
test('already missing completion is a verified success', async () => {
  const {values, storage} = fixture(); values.delete(key);
  await resetOnboardingForDevelopment(storage, true); assert.equal(values.has(key), false);
});
