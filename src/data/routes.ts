import {validFareAmount} from '../services/fareInformation.ts';
import {crowdingForRoute} from '../services/transportationInformation.ts';
export type Coordinate = { latitude: number; longitude: number };
export type Route = {
  id: string; label: string; origin: string; destination: string;
  minutes: number; fare: number; transfers: number; transport: string;
  crowd: string; crowdRank: number; color: string; coordinates: Coordinate[];
};

// Hand-authored demonstration geometry approximating the Marcos Highway corridor.
// Not surveyed, road-snapped, live, or suitable for navigation. No routing service.
const highway: Coordinate[] = [
  [14.62545,121.12115], [14.62534,121.12203], [14.62516,121.12327],
  [14.62496,121.12454], [14.62470,121.12615], [14.62437,121.12822],
  [14.62412,121.13013], [14.62384,121.13211], [14.62360,121.13410],
  [14.62334,121.13611], [14.62307,121.13814], [14.62280,121.14021],
  [14.62255,121.14215], [14.62230,121.14413], [14.62207,121.14616],
  [14.62181,121.14818], [14.62157,121.15021], [14.62139,121.15220],
  [14.62128,121.15422], [14.62122,121.15619], [14.62121,121.15821],
  [14.62123,121.16018], [14.62126,121.16218], [14.62131,121.16419],
  [14.62136,121.16618], [14.62141,121.16854],
].map(([latitude, longitude]) => ({latitude, longitude}));

// The three service examples share this road corridor. Do not invent road detours
// just to separate the lines; nested line widths keep all three colors visible.
export const routes: Route[] = [
  {id:'route-1', label:'SM City Masinag - Cogeo Gate 2', origin:'SM City Masinag', destination:'Cogeo Gate 2', minutes:14, fare:18, transfers:1, transport:'Bus', crowd:'Moderate Crowd', crowdRank:2, color:'#7ed957', coordinates:highway},
  {id:'route-2', label:'Route 2', origin:'SM City Masinag', destination:'Cogeo Gate 2', minutes:20, fare:25, transfers:2, transport:'Bus + Jeep', crowd:'Less Crowded', crowdRank:1, color:'#1d9ee3', coordinates:highway},
  {id:'route-3', label:'Route 3', origin:'SM City Masinag', destination:'Cogeo Gate 2', minutes:30, fare:35, transfers:4, transport:'Bus + Jeep', crowd:'Crowded', crowdRank:3, color:'#eac220', coordinates:highway},
];

export type Preference = 'Cheapest' | 'Fastest' | 'Less Crowded';
export function rankedRoutes(preference: Preference): Route[] {
  const field = preference === 'Cheapest' ? 'fare' : preference === 'Fastest' ? 'minutes' : 'crowdRank';
  return [...routes].sort((a,b) => {
    const value = (route: Route) => field === 'crowdRank' ? crowdingForRoute(route).rank ?? Infinity : field === 'fare' && !validFareAmount(route.fare) ? Infinity : route[field];
    const left = value(a), right = value(b);
    return left === right ? 0 : left < right ? -1 : 1;
  });
}
export function routeCoordinates(route: Route, reversed: boolean): Coordinate[] {
  return reversed ? [...route.coordinates].reverse() : route.coordinates;
}
export function matchesDemo(origin: string, destination: string): boolean {
  const clean = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');
  const a = clean(origin), b = clean(destination);
  return (a === 'sm city masinag' && b === 'cogeo gate 2') || (b === 'sm city masinag' && a === 'cogeo gate 2');
}
