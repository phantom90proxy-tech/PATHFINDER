import type {Coordinate} from '../data/routes';
import type {LocationFix, MapRoute} from '../data/roadRoutes';
export type MapHandle = {recenter: () => void; centerOnLocation: (point: Coordinate) => void};
export type RouteMapProps = {
  route: MapRoute | null; routes: MapRoute[]; location?: LocationFix | null; reversed: boolean; onSelect: (id: string) => void;
  width: number; height: number;
  overlays?: {top: number; bottom: number};
  reducedMotion?: boolean;
};
