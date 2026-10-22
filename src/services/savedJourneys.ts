import type {Coordinate, Route} from '../data/routes';
import type {MapRoute, RoadRoute, RoadSnap} from '../data/roadRoutes';
import {storageCoordination, type StorageCoordination} from './storageCoordination.ts';

export const SAVED_JOURNEYS_KEY = 'pathfinder.saved-journeys.v1';
const MAX_ITEMS = 50;
const MAX_SIZE = 4_000_000;
export type SavedJourney = {id: string; savedAt: number; route: MapRoute};
type Storage = {getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void>};
type Snapshot = {items: SavedJourney[]; ready: boolean; busy: boolean; error: string | null};
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && value.length <= 500;
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
function point(value: unknown): Coordinate {
  const p = value as Coordinate | null;
  if (!p || !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude) || Math.abs(p.latitude) > 90 || Math.abs(p.longitude) > 180) throw new Error('Invalid journey coordinates.');
  return {latitude: p.latitude, longitude: p.longitude};
}

// Whitelist persisted fields: never include GPS fix metadata or search history.
export function snapshotRoute(value: unknown, reversed = false): MapRoute {
  const r = value as (RoadRoute & Route) | null;
  if (!r || ![r.id, r.label, r.origin, r.destination].every(text) || !Array.isArray(r.coordinates) || r.coordinates.length < 2 || r.coordinates.length > 100_000) throw new Error('Invalid saved journey.');
  const road = r.kind === 'road';
  if ('kind' in r && !road) throw new Error('Unsupported saved journey.');
  const reverse = !road && reversed;
  const coordinates = r.coordinates.map(point);
  if (reverse) coordinates.reverse();
  const origin = reverse ? r.destination : r.origin, destination = reverse ? r.origin : r.destination;
  const common = {id: r.id, label: reverse && r.label === `${r.origin} - ${r.destination}` ? `${origin} - ${destination}` : r.label,
    origin, destination, coordinates, color: /^#[0-9a-f]{6}$/i.test(r.color) ? r.color : '#7ed957'};
  if (road) {
    if (!positive(r.durationSeconds) || !positive(r.distanceMeters) || !positive(r.fetchedAt)) throw new Error('Invalid driving estimates.');
    const snap = (value: RoadSnap | null | undefined): RoadSnap | null => {
      if (value == null) return null;
      if (!nonnegative(value.distanceMeters)) throw new Error('Invalid road access estimate.');
      return {requested: point(value.requested), snapped: point(value.snapped), distanceMeters: value.distanceMeters};
    };
    return {...common, kind: 'road', durationSeconds: r.durationSeconds, distanceMeters: r.distanceMeters, fetchedAt: r.fetchedAt,
      ...(r.snapping ? {snapping: {origin: snap(r.snapping.origin), destination: snap(r.snapping.destination)}} : {}),
      requestedEndpoints: {origin: point(r.requestedEndpoints?.origin ?? r.snapping?.origin?.requested ?? coordinates[0]), destination: point(r.requestedEndpoints?.destination ?? r.snapping?.destination?.requested ?? coordinates[coordinates.length - 1])}};
  }
  if (!positive(r.minutes) || ![r.fare, r.transfers, r.crowdRank].every(nonnegative) || !text(r.transport) || !text(r.crowd)) throw new Error('Invalid demo estimates.');
  return {...common, minutes: r.minutes, fare: r.fare, transfers: r.transfers, crowdRank: r.crowdRank, transport: r.transport, crowd: r.crowd};
}

// Server road IDs contain fetch timestamps. Compare endpoint positions and full
// geometry instead; demo service IDs distinguish services sharing one corridor.
export function journeyIdentity(route: MapRoute): string {
  const road = 'kind' in route;
  const endpoints = road ? route.requestedEndpoints : undefined;
  const coordinate = (p: Coordinate) => [p.latitude.toFixed(6), p.longitude.toFixed(6)];
  return JSON.stringify([road ? 'road' : route.id,
    coordinate(endpoints?.origin ?? route.coordinates[0]), coordinate(endpoints?.destination ?? route.coordinates[route.coordinates.length - 1]),
    route.coordinates.map(coordinate)]);
}

export function decodeSavedJourneys(raw: string | null): SavedJourney[] {
  if (raw === null) return [];
  if (raw.length > MAX_SIZE) throw new Error('Saved journey storage is too large.');
  const data = JSON.parse(raw) as {version?: unknown; items?: unknown};
  if (!data || data.version !== 1 || !Array.isArray(data.items) || data.items.length > MAX_ITEMS) throw new Error('Unsupported saved journey data.');
  const ids = new Set<string>(), identities = new Set<string>();
  return data.items.map(value => {
    const entry = value as SavedJourney;
    if (!entry || !text(entry.id) || !positive(entry.savedAt) || ids.has(entry.id)) throw new Error('Invalid saved journey entry.');
    const route = snapshotRoute(entry.route), identity = journeyIdentity(route);
    if (identities.has(identity)) throw new Error('Duplicate saved journey entry.');
    ids.add(entry.id); identities.add(identity);
    return {id: entry.id, savedAt: entry.savedAt, route};
  });
}

export function createSavedJourneysStore(storage: Storage, now = Date.now, coordination: StorageCoordination = storageCoordination) {
  let state: Snapshot = {items: [], ready: false, busy: false, error: null};
  let queue = Promise.resolve();
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<Snapshot>) => {state = {...state, ...patch}; listeners.forEach(listener => listener());};
  const read = async () => {
    try {const items = decodeSavedJourneys(await storage.getItem(SAVED_JOURNEYS_KEY)); publish({items, ready: true});}
    catch {publish({ready: false}); throw new Error('Saved journeys could not be read. Storage may be unavailable or damaged. Existing data has not been changed.');}
  };
  const run = <T>(work: () => Promise<T>, mutation = true): Promise<T> => {
    const pending = queue.then(async () => {
      publish({busy: true, error: null});
      try {return await (mutation ? coordination.mutate(SAVED_JOURNEYS_KEY, work) : work());}
      catch (error) {publish({error: error instanceof Error ? error.message : 'Saved journey storage is unavailable.'}); throw error;}
      finally {publish({busy: false});}
    });
    queue = pending.then(() => {}, () => {});
    return pending;
  };
  const write = async (items: SavedJourney[]) => {
    const serialized = JSON.stringify({version: 1, items});
    if (serialized.length > MAX_SIZE) throw new Error('Saved journeys are too large. Delete a journey before saving more.');
    try {await storage.setItem(SAVED_JOURNEYS_KEY, serialized);}
    catch {throw new Error('Could not update saved journeys. Storage may be full or unavailable. Please retry.');}
    publish({items});
  };
  const load = () => run(read, false);
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {listeners.add(listener); return () => {listeners.delete(listener);};},
    load,
    watch: () => coordination.subscribe(SAVED_JOURNEYS_KEY, () => {void load().catch(() => {});}),
    replace(expected: SavedJourney, value: MapRoute, isCurrent: () => boolean = () => true) {
      const route = snapshotRoute(value), previous = JSON.stringify(expected);
      return run(async () => {
        if (!isCurrent()) return;
        // Revalidate disk inside the same mutation queue; never repair corrupt data
        // implicitly or resurrect a record deleted while the network was pending.
        await read();
        if (!isCurrent()) return;
        const existing = state.items.find(item => item.id === expected.id);
        if (!existing || JSON.stringify(existing) !== previous) throw new Error('Saved journey changed or was deleted. Refresh again from its current details.');
        if (state.items.some(item => item.id !== expected.id && journeyIdentity(item.route) === journeyIdentity(route))) throw new Error('This updated route is already saved as another journey. Existing saved journeys were kept.');
        await write(state.items.map(item => item.id === expected.id ? {...item, route} : item));
      });
    },
    save(value: MapRoute, reversed = false) {
      // Capture before queueing, without mutating the current active route.
      const route = snapshotRoute(value, reversed);
      const identity = journeyIdentity(route);
      return run(async () => {
        await read();
        const existing = state.items.find(item => journeyIdentity(item.route) === identity);
        if (existing) return 'duplicate' as const;
        if (state.items.length >= MAX_ITEMS) throw new Error('You can save up to 50 journeys. Delete one before saving more.');
        const savedAt = now();
        let suffix = 0;
        while (state.items.some(item => item.id === `saved-${savedAt}-${suffix}`)) suffix++;
        await write([...state.items, {id: `saved-${savedAt}-${suffix}`, savedAt, route}]);
        return 'saved' as const;
      });
    },
    remove(id: string) {
      return run(async () => {
        await read();
        if (!state.items.some(item => item.id === id)) return;
        await write(state.items.filter(item => item.id !== id));
      });
    },
  };
}
