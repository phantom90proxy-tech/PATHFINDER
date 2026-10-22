import type {Preference} from '../data/routes';
import type {MapRoute} from '../data/roadRoutes';
import type {Place} from './placeSearch';
import {snapshotRoute} from './savedJourneys.ts';

export const RECOVERY_KEY = 'pathfinder.restart-recovery.v1';
type Endpoint = {query: string; place?: Place};
export type RecoveryData = {version: 1; origin: Endpoint; destination: Endpoint;
  preference: Preference; searchMode: 'demo' | 'driving'; cleared: boolean; journey: MapRoute | null};
export const emptyRecovery = (): RecoveryData => ({version: 1, origin: {query: ''}, destination: {query: ''},
  preference: 'Cheapest', searchMode: 'driving', cleared: false, journey: null});

export function validateRecovery(value: unknown): RecoveryData {
  const data = value as RecoveryData;
  if (!data || data.version !== 1 || !['Cheapest', 'Fastest', 'Less Crowded'].includes(data.preference) ||
    !['demo', 'driving'].includes(data.searchMode) || typeof data.cleared !== 'boolean') throw new Error('Unsupported recovery data.');
  const endpoint = (entry: Endpoint): Endpoint => {
    if (!entry || typeof entry.query !== 'string' || entry.query.length > 500) throw new Error('Invalid recovery input.');
    if (!entry.place) return {query: /^current location$/i.test(entry.query.trim()) ? '' : entry.query};
    const {label, point} = entry.place;
    if (typeof label !== 'string' || !label.trim() || label.length > 500 || !point || !Number.isFinite(point.latitude) ||
      !Number.isFinite(point.longitude) || Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180) throw new Error('Invalid recovery endpoint.');
    // A previous GPS position is a fixed endpoint, never a restored live GPS fix.
    const previousGPS = /^current location$/i.test(entry.query.trim());
    return {query: previousGPS ? 'Previous starting point' : entry.query,
      place: {label: previousGPS ? 'Previous starting point' : label, point: {latitude: point.latitude, longitude: point.longitude}}};
  };
  const journey = data.journey === null ? null : snapshotRoute(data.journey);
  if (journey && /^current location$/i.test(journey.origin.trim())) journey.origin = 'Previous starting point';
  if (journey && /^current location$/i.test(journey.destination.trim())) journey.destination = 'Previous destination';
  return {version: 1, origin: endpoint(data.origin), destination: endpoint(data.destination), preference: data.preference,
    searchMode: data.searchMode, cleared: data.cleared, journey};
}
export function decodeRecovery(raw: string | null): RecoveryData {
  if (raw === null) return emptyRecovery();
  if (raw.length > 4_000_000) throw new Error('Recovery data is too large.');
  return validateRecovery(JSON.parse(raw));
}

type Storage = {getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>};
// Hydration blocks edits; serialized writes and a single pending snapshot prevent
// delayed reads/writes from resurrecting discarded data or overwriting newer edits.
export function createRecoveryStore(storage: Storage) {
  let state = {ready: false, error: null as string | null};
  let writable = false, last = '', target = '', pending: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queue = Promise.resolve();
  let loading: Promise<RecoveryData> | undefined;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<typeof state>) => {state = {...state, ...patch}; listeners.forEach(fn => fn());};
  const flush = () => {
    clearTimeout(timer); timer = undefined;
    const value = pending; pending = null;
    if (value === null) return queue;
    target = value;
    queue = queue.then(async () => {
      try {await storage.setItem(RECOVERY_KEY, value); last = value; publish({error: null});}
      catch {if (target === value) target = last; publish({error: 'Restart recovery could not be saved. Storage may be full or unavailable.'});}
    });
    return queue;
  };
  return {
    getSnapshot: () => state,
    subscribe(fn: () => void) {listeners.add(fn); return () => {listeners.delete(fn);};},
    load() {
      loading ??= storage.getItem(RECOVERY_KEY).then(raw => {
        const data = decodeRecovery(raw); last = target = JSON.stringify(data); writable = true; publish({ready: true}); return data;
      }).catch(() => {publish({ready: true, error: 'Restart recovery could not be read. Stored data was left unchanged. Discard it from Menu to start again.'}); return emptyRecovery();});
      return loading;
    },
    update(data: RecoveryData) {
      if (!state.ready || !writable) return;
      let value: string;
      try {value = JSON.stringify(validateRecovery(data)); if (value.length > 4_000_000) throw new Error();}
      catch {publish({error: 'This journey could not be stored for restart recovery.'}); return;}
      if (value === (pending ?? target)) return;
      pending = value; clearTimeout(timer); timer = setTimeout(() => {void flush();}, 350);
    },
    flush,
    async clear() {
      if (!state.ready) throw new Error('Recovery is still loading.');
      clearTimeout(timer); pending = null;
      const value = JSON.stringify(emptyRecovery());
      target = value;
      // Explicit discard may replace a corrupt record, but touches no other key.
      const work = queue.then(() => storage.setItem(RECOVERY_KEY, value));
      queue = work.catch(() => {});
      try {await work; last = value; writable = true; publish({error: null});}
      catch {if (target === value) target = last; publish({error: 'Restart recovery could not be discarded. Please retry.'}); throw new Error('Discard failed.');}
    },
  };
}
