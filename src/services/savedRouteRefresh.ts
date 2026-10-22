import type {RoadRoute} from '../data/roadRoutes';
import type {createRoadRouter} from './roadRouting';
import {createSavedJourneysStore, journeyIdentity, snapshotRoute, type SavedJourney} from './savedJourneys.ts';
import {isRequestCancelled} from './requestCancellation.ts';

type State = {phase: 'idle' | 'loading' | 'confirm' | 'saving' | 'success' | 'error' | 'cancelled'; message: string; candidates: RoadRoute[]};
type Store = ReturnType<typeof createSavedJourneysStore>;
export function createSavedRouteRefresher(store: Store, request: ReturnType<typeof createRoadRouter>) {
  let state: State = {phase: 'idle', message: '', candidates: []};
  let controller: AbortController | null = null, expected: SavedJourney | null = null;
  let generation = 0;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<State>) => {state = {...state, ...patch}; listeners.forEach(fn => fn());};
  const cancel = (message = 'Refresh cancelled. Existing saved details were kept.') => {
    generation++; controller?.abort(); controller = null; expected = null;
    publish({phase: 'cancelled', message, candidates: []});
  };
  const commit = async (route: RoadRoute, entry: SavedJourney, current: () => boolean) => {
    if (!current()) return;
    publish({phase: 'saving', message: 'Saving updated route…', candidates: []});
    try {
      await store.replace(entry, route, current);
      if (current()) {expected = null; publish({phase: 'success', message: 'Saved route updated. OSRM driving estimates are not real-time traffic information.'});}
    } catch (error) {if (current()) publish({phase: 'error', message: error instanceof Error ? error.message : 'Could not save refreshed route. Previous details were kept.'});}
  };
  return {
    getSnapshot: () => state,
    subscribe(fn: () => void) {listeners.add(fn); return () => {listeners.delete(fn);};},
    cancel,
    reset() {cancel(); publish({phase: 'idle', message: ''});},
    check() {
      if (expected && (state.phase === 'loading' || state.phase === 'confirm') &&
        JSON.stringify(store.getSnapshot().items.find(item => item.id === expected!.id)) !== JSON.stringify(expected)) cancel('Saved journey changed or was deleted. Refresh cancelled.');
    },
    async start(entry: SavedJourney) {
      if (state.phase === 'saving') return;
      cancel();
      const token = generation, abort = new AbortController(); controller = abort;
      const current = () => generation === token && !abort.signal.aborted;
      try {
        const saved = snapshotRoute(entry.route);
        if (!('kind' in saved)) throw new Error('Transit demos cannot be refreshed through road routing.');
        expected = {id: entry.id, savedAt: entry.savedAt, route: saved};
        const capture = expected;
        publish({phase: 'loading', message: 'Requesting updated road routes…', candidates: []});
        const result = await request({origin: saved.requestedEndpoints!.origin, destination: saved.requestedEndpoints!.destination,
          originLabel: saved.origin, destinationLabel: saved.destination}, abort.signal, {forceRefresh: true});
        if (!current()) return;
        if (result.cached) throw new Error('The service returned cached details. Previous saved details were kept. Try again later.');
        const candidates = result.routes.map(value => {
          const route = snapshotRoute(value);
          if (!('kind' in route)) throw new Error('Invalid refreshed road route.');
          const same = (a: number, b: number) => a.toFixed(6) === b.toFixed(6);
          for (const endpoint of ['origin', 'destination'] as const) {
            const a = saved.requestedEndpoints![endpoint], b = route.requestedEndpoints![endpoint];
            if (!same(a.latitude, b.latitude) || !same(a.longitude, b.longitude)) throw new Error('The refreshed route has different journey endpoints. Previous details were kept.');
          }
          return route;
        });
        if (!candidates.length) throw new Error('No usable refreshed routes were returned. Previous details were kept.');
        const match = candidates.find(route => journeyIdentity(route) === journeyIdentity(saved));
        if (match) await commit(match, capture, current);
        else publish({phase: 'confirm', candidates, message: 'The saved alternative could not be matched. Its geometry may have changed or it may no longer be available. Your saved route is unchanged. Confirm a replacement below, or keep the original.'});
      } catch (error) {
        if (current()) publish({phase: isRequestCancelled(error) ? 'cancelled' : 'error', candidates: [],
          message: isRequestCancelled(error) ? 'Refresh cancelled. Existing saved details were kept.' : error instanceof Error ? error.message : 'Refresh failed. Existing saved details were kept.'});
      } finally {if (current()) controller = null;}
    },
    async confirm(id: string) {
      const route = state.candidates.find(item => item.id === id), capture = expected, token = generation;
      if (state.phase !== 'confirm' || !route || !capture) return;
      await commit(route, capture, () => generation === token);
    },
  };
}
