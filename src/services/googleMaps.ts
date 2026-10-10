import type {MapRoute, LocationFix} from '../data/roadRoutes';
import type {Coordinate} from '../data/routes';

function coordinate(point?: Coordinate | null): string | undefined {
  if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180) return;
  return `${point.latitude},${point.longitude}`;
}
function endpoint(label: string, point: Coordinate | undefined, name: string): string {
  const coordinates = coordinate(point);
  if (coordinates) return coordinates;
  const value = label.trim();
  if (!value || /^current location$/i.test(value)) throw new Error(`Choose a valid ${name} before opening Google Maps.`);
  if (/^[-+\d.\s]+,[-+\d.\s]+$/.test(value)) {
    const [latitude, longitude] = value.split(',').map(Number);
    const parsed = coordinate({latitude, longitude});
    if (!parsed) throw new Error(`Choose valid ${name} coordinates before opening Google Maps.`);
    return parsed;
  }
  return value;
}

export function googleMapsURL(route: MapRoute, reversed = false, location: LocationFix | null = null, now = Date.now()): string {
  const road = 'kind' in route && route.kind === 'road';
  const reverse = !road && reversed;
  const first = route.coordinates[0], last = route.coordinates[route.coordinates.length - 1];
  const originLabel = reverse ? route.destination : route.origin;
  const destinationLabel = reverse ? route.origin : route.destination;
  const originPoint = road ? route.requestedEndpoints?.origin ?? route.snapping?.origin?.requested ?? first : reverse ? last : first;
  const destinationPoint = road ? route.requestedEndpoints?.destination ?? route.snapping?.destination?.requested ?? last : reverse ? first : last;
  const destination = endpoint(destinationLabel, destinationPoint, 'destination');
  // Omitting origin is Google's documented device-location fallback. Never send
  // "Current location" as a searchable place name or request another GPS permission.
  const origin = /^current location$/i.test(originLabel.trim())
    ? location && now >= location.timestamp && now - location.timestamp <= 300_000 ? coordinate(location) : undefined
    : endpoint(originLabel, originPoint, 'origin');
  const url = `https://www.google.com/maps/dir/?api=1${origin ? `&origin=${encodeURIComponent(origin)}` : ''}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
  if (url.length > 2048) throw new Error('These locations are too long to open in Google Maps. Use coordinates or shorter place names.');
  return url;
}

export type MapsOpener = {platform: string; openURL: (url: string) => Promise<unknown>; openTab: (url: string) => boolean};
export async function openGoogleMaps(url: string, opener: MapsOpener): Promise<void> {
  if (opener.platform === 'web') {
    // Called synchronously within the press event to preserve popup activation.
    if (!opener.openTab(url)) throw new Error('Google Maps could not open. Allow pop-ups for PATHFINDER and try again.');
    return;
  }
  try {
    // Official HTTPS URL: Android resolves to Maps when available, browser otherwise.
    // Avoid canOpenURL package-visibility queries and custom-scheme-only launches.
    await opener.openURL(url);
  } catch {
    throw new Error('Could not open Google Maps. Make sure Google Maps or a web browser is available, then try again.');
  }
}
