import type {Coordinate} from '../data/routes';
import type {RoadRoute, RoadSnap} from '../data/roadRoutes';

const validPoint = (p: Coordinate) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;
type Request = {origin: Coordinate; destination: Coordinate; originLabel: string; destinationLabel: string};
type Result = {routes: RoadRoute[]; cached: boolean};
type RawRoute = {distance?: unknown; duration?: unknown; geometry?: {type?: unknown; coordinates?: unknown}};
function parseSnap(value: unknown, requested: Coordinate): RoadSnap | null {
  if (!value || typeof value !== 'object') return null;
  const {location, distance} = value as {location?: unknown; distance?: unknown};
  if (!Array.isArray(location) || location.length < 2 || typeof location[0] !== 'number' || typeof location[1] !== 'number' ||
    typeof distance !== 'number' || !Number.isFinite(distance) || distance < 0) return null;
  const snapped = {longitude: location[0], latitude: location[1]};
  return validPoint(snapped) ? {requested: {...requested}, snapped, distanceMeters: distance} : null;
}
export function parseRoadResponse(body: unknown, request: Request, fetchedAt: number): RoadRoute[] {
  const response = body as {code?: string; routes?: RawRoute[]; waypoints?: unknown} | null;
  if (response?.code === 'NoRoute' || response?.code === 'NoSegment') throw new Error('No driving route was found near these coordinates. Try endpoints closer to a road.');
  if (response?.code !== 'Ok' || !Array.isArray(response.routes) || !response.routes.length) throw new Error('The routing server returned no usable routes. Try again later.');
  const waypoints = Array.isArray(response.waypoints) && response.waypoints.length === 2 ? response.waypoints : [];
  const snapping = {origin: parseSnap(waypoints[0], request.origin), destination: parseSnap(waypoints[1], request.destination)};
  return response.routes.slice(0, 3).map((route, index) => {
    if (!route || typeof route !== 'object') throw new Error('The routing server returned an invalid route.');
    const points = route.geometry?.coordinates;
    if (route.geometry?.type !== 'LineString' || !Array.isArray(points) || points.length < 2 || points.length > 100_000 ||
      typeof route.distance !== 'number' || !Number.isFinite(route.distance) || route.distance <= 0 ||
      typeof route.duration !== 'number' || !Number.isFinite(route.duration) || route.duration <= 0) throw new Error('The routing server returned invalid geometry or estimates.');
    const coordinates = points.map((point: unknown) => {
      if (!Array.isArray(point) || point.length < 2 || typeof point[0] !== 'number' || typeof point[1] !== 'number') throw new Error('The routing server returned invalid coordinates.');
      const result = {latitude: point[1], longitude: point[0]};
      if (!validPoint(result)) throw new Error('The routing server returned invalid coordinates.');
      return result;
    });
    return {kind: 'road', id: `road-${fetchedAt}-${index}`, label: `Driving route ${index + 1}`,
      origin: request.originLabel, destination: request.destinationLabel, coordinates,
      distanceMeters: route.distance, durationSeconds: route.duration, fetchedAt, color: '#7ed957', requestedEndpoints: {origin: {...request.origin}, destination: {...request.destination}}, snapping};
  });
}

// Session-only cache avoids persisting private GPS endpoints. No retries, polling or prefetch.
export function createRoadRouter({fetcher = fetch, now = Date.now, timeoutMs = 15000, headers = {}}: {fetcher?: typeof fetch; now?: () => number; timeoutMs?: number; headers?: Record<string, string>} = {}) {
  const cache = new Map<string, {routes: RoadRoute[]; time: number}>();
  let nextRequestAt = 0;
  let inFlight = false;
  return async (request: Request): Promise<Result> => {
    if (!validPoint(request.origin) || !validPoint(request.destination)) throw new Error('Enter valid coordinates.');
    const coordinate = (p: Coordinate) => `${p.longitude.toFixed(6)},${p.latitude.toFixed(6)}`;
    const key = `${coordinate(request.origin)};${coordinate(request.destination)}`;
    if (coordinate(request.origin) === coordinate(request.destination)) throw new Error('Choose different origin and destination points.');
    const stored = cache.get(key);
    if (stored && now() - stored.time < 5 * 60_000) return {cached: true, routes: stored.routes.map(route => ({...route, origin: request.originLabel, destination: request.destinationLabel}))};
    if (inFlight) throw new Error('A route request is already running. Please wait.');
    if (now() < nextRequestAt) throw new Error(`Please wait ${Math.ceil((nextRequestAt - now()) / 1000)} seconds before requesting another route.`);
    nextRequestAt = now() + 5000;
    inFlight = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(`https://router.project-osrm.org/route/v1/driving/${key}?overview=full&geometries=geojson&alternatives=true&steps=false&generate_hints=false&radiuses=1000;1000`, {signal: controller.signal, headers: {Accept: 'application/json', ...headers}});
      if (response.status === 429) {
        const retry = response.headers.get('Retry-After');
        const seconds = retry && /^\d+$/.test(retry) ? Number(retry) : retry ? Math.max(0, (Date.parse(retry) - now()) / 1000) : 60;
        nextRequestAt = now() + Math.max(60, Number.isFinite(seconds) ? seconds : 60) * 1000;
        throw new Error('The demo routing server is busy. Wait at least a minute before trying again.');
      }
      if (!response.ok && response.status !== 400) throw new Error(`Routing service unavailable (${response.status}). Existing routes are kept; try again later.`);
      const routes = parseRoadResponse(await response.json(), request, now());
      if (cache.size >= 10) cache.delete(cache.keys().next().value!);
      cache.set(key, {routes, time: now()});
      return {routes, cached: false};
    } catch (error) {
      if (controller.signal.aborted) throw new Error('Routing timed out. Check your connection and try again.');
      if (error instanceof TypeError) throw new Error('Could not reach the routing server. Check your connection. Previously loaded routes remain available.');
      if (error instanceof SyntaxError) throw new Error('The routing server sent an unreadable response. Try again later.');
      throw error;
    } finally {clearTimeout(timeout); inFlight = false;}
  };
}
