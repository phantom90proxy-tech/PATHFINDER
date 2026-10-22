import type {RoadRoute} from '../data/roadRoutes';

export const validEstimate = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const estimate = (value: unknown) => validEstimate(value) ? value : Infinity;

// Sort a copy: selection, geometry, IDs and the original OSRM response stay intact.
export function rankRoadRoutes<T extends RoadRoute>(routes: readonly T[]): T[] {
  return [...routes].sort((a, b) => {
    for (const key of ['durationSeconds', 'distanceMeters'] as const) {
      const left = estimate(a[key]), right = estimate(b[key]);
      if (left !== right) return left < right ? -1 : 1;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function roadRouteComparison(route: RoadRoute, routes: readonly RoadRoute[]) {
  const durations = routes.map(item => item.durationSeconds).filter(validEstimate);
  const distances = routes.map(item => item.distanceMeters).filter(validEstimate);
  const fastest = durations.length > 1 && validEstimate(route.durationSeconds) ? Math.min(...durations) : null;
  const shortest = distances.length > 1 && validEstimate(route.distanceMeters) ? Math.min(...distances) : null;
  const badges = [fastest !== null && fastest === route.durationSeconds ? 'Fastest' : '', shortest !== null && shortest === route.distanceMeters ? 'Shortest' : ''].filter(Boolean);
  const differences: string[] = [];
  if (fastest !== null) {
    const seconds = route.durationSeconds - fastest;
    differences.push(seconds === 0 ? 'Same estimated time as fastest' : `${seconds < 60 ? `${Math.ceil(seconds)} sec` : `${(seconds / 60).toFixed(1)} min`} longer than fastest`);
  }
  if (shortest !== null) {
    const meters = route.distanceMeters - shortest;
    differences.push(meters === 0 ? 'Same distance as shortest' : `${meters < 1000 ? `${Math.ceil(meters)} m` : `${(meters / 1000).toFixed(1)} km`} farther than shortest`);
  }
  return {badges, differences};
}
