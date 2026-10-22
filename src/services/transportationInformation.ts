import type {MapRoute} from '../data/roadRoutes';

export type InformationClassification = 'verified' | 'estimated' | 'demo' | 'unavailable';
export type CrowdingInformation = {classification: InformationClassification; label?: string; rank?: number};
const levels = ['Less Crowded', 'Moderate Crowd', 'Crowded'];
export const serviceInformationDisclosure = 'Waiting time, service frequency, schedules and operating hours: unavailable. No live crowding or transportation conditions are provided.';
export function crowdingForRoute(route: MapRoute): CrowdingInformation {
  if ('kind' in route || typeof route.crowd !== 'string') return {classification: 'unavailable'};
  const rank = levels.indexOf(route.crowd) + 1;
  return rank > 0 && route.crowdRank === rank ? {classification: 'demo', label: route.crowd, rank} : {classification: 'unavailable'};
}
const validDemo = (value: CrowdingInformation) => value.classification === 'demo' && Number.isInteger(value.rank) && value.rank! >= 1 && value.rank! <= levels.length && levels[value.rank! - 1] === value.label;
export function crowdingLabel(value: CrowdingInformation): string {
  return validDemo(value) ? `Demo crowding: ${value.label}` : 'Crowding unavailable';
}
export function demoCrowdingComparison(value: CrowdingInformation, alternatives: readonly CrowdingInformation[]): string | null {
  if (!validDemo(value) || alternatives.some(item => item.classification !== 'unavailable' && !validDemo(item))) return null;
  const comparable = alternatives.filter(validDemo);
  return comparable.length > 1 && value.rank === Math.min(...comparable.map(item => item.rank!)) ? 'Lowest demo crowding' : null;
}
export function transferLabel(route: MapRoute): string {
  if ('kind' in route || !Number.isSafeInteger(route.transfers) || route.transfers < 0) return 'Transit transfers unavailable';
  return `Demo transfers: ${route.transfers} sample ${route.transfers === 1 ? 'transfer' : 'transfers'}`;
}
export function transportationInformation(route: MapRoute) {
  const road = 'kind' in route;
  const duration = road ? route.durationSeconds : route.minutes;
  const validDuration = typeof duration === 'number' && Number.isFinite(duration) && duration > 0;
  const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0 && value.length <= 500;
  return {
    crowding: crowdingForRoute(route),
    travelTime: {classification: validDuration ? road ? 'estimated' : 'demo' : 'unavailable', label: validDuration ? road ? 'Estimated driving time (OSRM)' : 'Demo travel time' : 'Travel time unavailable'},
    mode: {classification: road ? 'estimated' : text(route.transport) ? 'demo' : 'unavailable', label: road ? 'Driving profile (OSRM)' : text(route.transport) ? `Demo mode: ${route.transport}` : 'Transport mode unavailable'},
    service: {classification: !road && text(route.label) ? 'demo' : 'unavailable', label: !road && text(route.label) ? `Demo service: ${route.label}` : 'Transit service unavailable'},
    transfers: {classification: !road && Number.isSafeInteger(route.transfers) && route.transfers >= 0 ? 'demo' : 'unavailable', label: transferLabel(route)},
    waitingTime: {classification: 'unavailable', label: 'Waiting time unavailable'},
    frequency: {classification: 'unavailable', label: 'Service frequency unavailable'},
    stops: {classification: 'unavailable', label: 'Verified stops unavailable'},
  } as const;
}
