import type {MapRoute} from '../data/roadRoutes';
import {journeyIdentity, snapshotRoute} from './savedJourneys.ts';
import {storageCoordination, type StorageCoordination} from './storageCoordination.ts';

export const JOURNEY_HISTORY_KEY = 'pathfinder.journey-history.v1';
export const MAX_HISTORY_ITEMS = 20;
const MAX_SIZE = 4_000_000;
export type HistoryJourney = {id: string; selectedAt: number; route: MapRoute};
type Storage = {getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void>};
type Snapshot = {items: HistoryJourney[]; ready: boolean; busy: boolean; error: string | null};

export function decodeJourneyHistory(raw: string | null): HistoryJourney[] {
  if (raw === null) return [];
  if (raw.length > MAX_SIZE) throw new Error('Journey history is too large.');
  const data = JSON.parse(raw) as {version?: unknown; items?: unknown};
  if (!data || data.version !== 1 || !Array.isArray(data.items) || data.items.length > MAX_HISTORY_ITEMS) throw new Error('Unsupported journey history.');
  const ids = new Set<string>(), identities = new Set<string>();
  return data.items.map(value => {
    const entry = value as HistoryJourney;
    if (!entry || typeof entry.id !== 'string' || !entry.id.trim() || entry.id.length > 500 ||
      !Number.isFinite(entry.selectedAt) || entry.selectedAt <= 0 || entry.selectedAt > 8.64e15 || ids.has(entry.id)) throw new Error('Invalid history entry.');
    const route = snapshotRoute(entry.route), identity = journeyIdentity(route);
    if (identities.has(identity)) throw new Error('Duplicate history entry.');
    ids.add(entry.id); identities.add(identity);
    return {id: entry.id, selectedAt: entry.selectedAt, route};
  }).sort((a, b) => b.selectedAt - a.selectedAt);
}

// This store only writes its own key. Call record from explicit selection
// handlers, never from effects, request completion, GPS, or history viewing.
export function createJourneyHistoryStore(storage: Storage, now = Date.now, coordination: StorageCoordination = storageCoordination) {
  let state: Snapshot = {items: [], ready: false, busy: false, error: null};
  let queue = Promise.resolve();
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<Snapshot>) => {state = {...state, ...patch}; listeners.forEach(listener => listener());};
  const read = async () => {
    try {const items = decodeJourneyHistory(await storage.getItem(JOURNEY_HISTORY_KEY)); publish({items, ready: true});}
    catch {publish({ready: false}); throw new Error('Journey history could not be read. Storage may be unavailable or damaged. Existing data has not been changed.');}
  };
  const run = <T>(work: () => Promise<T>, mutation = true): Promise<T> => {
    const pending = queue.then(async () => {
      publish({busy: true, error: null});
      try {return await (mutation ? coordination.mutate(JOURNEY_HISTORY_KEY, work) : work());}
      catch (error) {publish({error: error instanceof Error ? error.message : 'Journey history storage is unavailable.'}); throw error;}
      finally {publish({busy: false});}
    });
    queue = pending.then(() => {}, () => {});
    return pending;
  };
  const write = async (items: HistoryJourney[]) => {
    const serialized = JSON.stringify({version: 1, items});
    if (serialized.length > MAX_SIZE) throw new Error('Journey history is too large to store. Delete older entries and retry.');
    try {await storage.setItem(JOURNEY_HISTORY_KEY, serialized);}
    catch {throw new Error('Could not update journey history. Storage may be full or unavailable. Please retry.');}
    publish({items, ready: true});
  };
  const load = () => run(read, false);
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {listeners.add(listener); return () => {listeners.delete(listener);};},
    load,
    watch: () => coordination.subscribe(JOURNEY_HISTORY_KEY, () => {void load().catch(() => {});}),
    record(value: MapRoute, reversed = false) {
      // Validate and copy before queueing so subsequent selections cannot alter
      // the confirmed endpoints, geometry or estimates in this event.
      try {
        const route = snapshotRoute(value, reversed), identity = journeyIdentity(route), selectedAt = now();
        if (!Number.isFinite(selectedAt) || selectedAt <= 0 || selectedAt > 8.64e15) throw new Error('Selection time is unavailable.');
        return run(async () => {
          await read();
          const previous = state.items.find(item => journeyIdentity(item.route) === identity);
          // A delayed older selection must not roll back a newer tab's timestamp
          // or summary for the same journey.
          if (previous && previous.selectedAt > selectedAt) return;
          let suffix = 0;
          while (state.items.some(item => item.id === `history-${selectedAt}-${suffix}`)) suffix++;
          const entry = {id: previous?.id ?? `history-${selectedAt}-${suffix}`, selectedAt, route};
          const items = [entry, ...state.items.filter(item => item.id !== previous?.id)]
            .sort((a, b) => b.selectedAt - a.selectedAt).slice(0, MAX_HISTORY_ITEMS);
          await write(items);
        });
      } catch (error) {publish({error: 'This journey could not be added to history.'}); return Promise.reject(error);}
    },
    remove(id: string) {
      return run(async () => {
        await read();
        if (state.items.some(item => item.id === id)) await write(state.items.filter(item => item.id !== id));
      });
    },
    // Explicit UI confirmation permits clearing even unreadable history. Never
    // clear AsyncStorage globally or touch the independent saved-journeys key.
    clear: () => run(async () => {
      try {await read();} catch {/* Explicit confirmation permits discarding unreadable history. */}
      await write([]);
    }),
  };
}
