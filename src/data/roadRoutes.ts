import type {Coordinate, Route} from './routes';
import {fareForRoute, fareLabel} from '../services/fareInformation.ts';
import {crowdingForRoute, crowdingLabel, transportationInformation} from '../services/transportationInformation.ts';

export type LocationFix = Coordinate & {accuracy: number | null; timestamp: number};
export type RoadSnap = {requested: Coordinate; snapped: Coordinate; distanceMeters: number};
export type RoadRoute = {
  kind: 'road'; id: string; label: string; origin: string; destination: string;
  coordinates: Coordinate[]; distanceMeters: number; durationSeconds: number;
  fetchedAt: number; color: string;
  requestedEndpoints?: {origin: Coordinate; destination: Coordinate};
  snapping?: {origin: RoadSnap | null; destination: RoadSnap | null};
};
export type MapRoute = Route | RoadRoute;
// Informational threshold for the demo, not a verified pedestrian connection.
export function snappingNotice(route: MapRoute): string | null {
  if (!isRoadRoute(route) || !route.snapping) return null;
  const parts = (['origin', 'destination'] as const).flatMap(endpoint => {
    const snap = route.snapping?.[endpoint];
    return snap && snap.distanceMeters >= 100
      ? [`${endpoint === 'origin' ? 'starts' : 'ends'} about ${Math.round(snap.distanceMeters / 10) * 10} m from your chosen ${endpoint}`] : [];
  });
  return parts.length ? `The driving route ${parts.join(' and ')}. A walking connection has not been verified.` : null;
}
export function isRoadRoute(route: MapRoute): route is RoadRoute {return 'kind' in route && route.kind === 'road';}
export function tripEndpoints(route: MapRoute, reversed = false) {
  return reversed && !isRoadRoute(route)
    ? {origin: route.destination, destination: route.origin}
    : {origin: route.origin, destination: route.destination};
}
export function tripTitle(route: MapRoute, reversed = false) {
  const {origin, destination} = tripEndpoints(route, reversed);
  return `${origin} → ${destination}`;
}
export function routeLabel(route: MapRoute, reversed = false) {
  const endpoints = tripEndpoints(route, reversed);
  return route.label === `${route.origin} - ${route.destination}`
    ? `${endpoints.origin} - ${endpoints.destination}` : route.label;
}
export function routeSummary(route: MapRoute) {
  const info = transportationInformation(route);
  return isRoadRoute(route)
    ? `${(route.distanceMeters / 1000).toFixed(1)} km · ${Math.max(1, Math.round(route.durationSeconds / 60))} min estimated · Driving · Fare unavailable · Crowding unavailable`
    : `${info.mode.label} · ${fareLabel(fareForRoute(route))} · ${info.travelTime.classification === 'demo' ? `Demo travel time: ${route.minutes} min` : info.travelTime.label} · ${crowdingLabel(crowdingForRoute(route))}`;
}
export function validCoordinate(point: Coordinate) {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;
}
export function resolveEndpoint(text: string, location: LocationFix | null, now = Date.now()): Coordinate {
  const name = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (name === 'current location') {
    if (!location || !validCoordinate(location) || !Number.isFinite(location.timestamp) || now < location.timestamp || now - location.timestamp > 5 * 60_000) throw new Error('Refresh your GPS position with Use my location before routing.');
    return location;
  }
  if (name === 'sm city masinag') return {latitude: 14.62545, longitude: 121.12115};
  if (name === 'cogeo gate 2') return {latitude: 14.62141, longitude: 121.16854};
  const parts = name.split(',');
  if (parts.length === 2 && parts.every(part => /^[-+]?\d+(\.\d+)?$/.test(part.trim()))) {
    const point = {latitude: Number(parts[0]), longitude: Number(parts[1])};
    if (validCoordinate(point)) return point;
  }
  throw new Error('Enter valid latitude, longitude or search for a place name.');
}
