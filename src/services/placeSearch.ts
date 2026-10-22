import type {Coordinate} from '../data/routes';
import {createRequestCancellation, RequestCancelledError} from './requestCancellation.ts';

export type Place = {label: string; point: Coordinate};
// Public Photon service: explicit searches only, modest usage, no availability SLA.
export const PLACE_SEARCH_URL = 'https://photon.komoot.io/api/';
export function parsePlaces(body: unknown): Place[] {
  const features = (body as {features?: unknown[]})?.features;
  if (!Array.isArray(features)) throw new Error('Location search returned an unreadable response. Try again.');
  return features.slice(0, 5).flatMap(feature => {
    const f = feature as {geometry?: {type?: string; coordinates?: unknown[]}; properties?: Record<string, unknown>} | null;
    const xy = f?.geometry?.coordinates;
    if (f?.geometry?.type !== 'Point' || !xy || typeof xy[0] !== 'number' || typeof xy[1] !== 'number' || !Number.isFinite(xy[0]) || !Number.isFinite(xy[1]) || Math.abs(xy[0]) > 180 || Math.abs(xy[1]) > 90) return [];
    const p = f.properties ?? {};
    const label = [...new Set(['name', 'housenumber', 'street', 'district', 'city', 'state', 'country'].map(key => p[key]).filter((part): part is string => typeof part === 'string' && !!part.trim()))].join(', ');
    return label ? [{label, point: {longitude: xy[0], latitude: xy[1]}}] : [];
  });
}
export function createPlaceSearch({fetcher = fetch, now = Date.now, timeoutMs = 12000, intervalMs = 1100}: {fetcher?: typeof fetch; now?: () => number; timeoutMs?: number; intervalMs?: number} = {}) {
  const cache = new Map<string, {places: Place[]; at: number}>();
  let busy = false, next = 0;
  return async (text: string, signal?: AbortSignal): Promise<Place[]> => {
    if (signal?.aborted) throw new RequestCancelledError();
    const query = text.trim();
    if (query.length < 2 || query.length > 240) throw new Error('Enter a place or address between 2 and 240 characters. Include the city for better matches.');
    const key = query.toLowerCase().replace(/\s+/g, ' '), saved = cache.get(key);
    if (saved && now() - saved.at < 300_000) return saved.places;
    if (busy) throw new Error('A location search is already running. Please wait.');
    if (next - now() > intervalMs) throw new Error('Location search is busy. Wait a minute before trying again.');
    busy = true;
    const request = createRequestCancellation(signal);
    try {
      await request.wait(Math.max(0, next - now()));
      next = now() + intervalMs;
      request.startTimeout(timeoutMs);
      const response = await request.run(() => fetcher(`${PLACE_SEARCH_URL}?q=${encodeURIComponent(query)}&limit=5&lang=en`, {signal: request.signal, headers: {Accept: 'application/json'}}));
      if (response.status === 429) {next = now() + 60_000; throw new Error('Location search is busy. Wait a minute before trying again.');}
      if (!response.ok) throw new Error('Location search is unavailable. Try again later or enter latitude, longitude.');
      const places = parsePlaces(await request.run(() => response.json()));
      request.check();
      if (cache.size >= 30) cache.delete(cache.keys().next().value!);
      cache.set(key, {places, at: now()});
      return places;
    } catch (error) {
      if (request.cancelled) throw new RequestCancelledError();
      if (request.signal.aborted) throw new Error('Location search timed out. Check your connection and try again.');
      if (error instanceof TypeError) throw new Error('Could not reach location search. Check your connection or enter latitude, longitude.');
      if (error instanceof SyntaxError) throw new Error('Location search returned an unreadable response. Try again.');
      throw error;
    } finally {request.dispose(); busy = false;}
  };
}
export const searchPlaces = createPlaceSearch();
