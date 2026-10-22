import React, {forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState} from 'react';
import type * as Leaflet from 'leaflet';
import {isRoadRoute, routeSummary, routeLabel, tripEndpoints} from '../data/roadRoutes';
import {mapViewport} from '../data/mapViewport';
import {createTileFailures} from '../map/tileFailures';
import {acquireLeafletStyles} from '../map/leafletStyles';
import type {MapHandle, RouteMapProps} from './RouteMap.types';
import './RouteMap.web.css';

export type {MapHandle, RouteMapProps} from './RouteMap.types';
type Runtime = {
  L: typeof Leaflet; map: Leaflet.Map;
  lines: Map<string, Leaflet.Polyline>;
  origin: Leaflet.Marker; destination: Leaflet.Marker; routeLayers: Leaflet.LayerGroup;
  retryTiles: () => boolean;
};
function popup(title: string, description: string) {
  const element = document.createElement('div');
  const heading = document.createElement('strong');
  heading.textContent = title;
  const detail = document.createElement('p');
  detail.textContent = description;
  element.append(heading, detail);
  return element;
}

export const RouteMap = forwardRef<MapHandle, RouteMapProps>(function RouteMap(
  {route, routes, location, reversed, onSelect, width, height, overlays, reducedMotion = false}, ref,
) {
  const container = useRef<HTMLDivElement>(null);
  const select = useRef(onSelect);
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [tileError, setTileError] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {select.current = onSelect;}, [onSelect]);
  useEffect(() => {
    let cancelled = false;
    let instance: Leaflet.Map | undefined;
    const failures = createTileFailures<HTMLImageElement>();
    const styles = acquireLeafletStyles();
    // Leaflet evaluates window/document: load only after mounting, never in SSR.
    Promise.all([import('leaflet'), styles.promise]).then(([L]) => {
      if (cancelled || !container.current) return;
      const map = L.map(container.current, {
        zoomControl: false, attributionControl: true, zoomSnap: 0.25,
        scrollWheelZoom: true, dragging: true, touchZoom: true,
      });
      instance = map;
      map.setView([14.6234, 121.1448], 13);
      map.attributionControl.setPrefix(false);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, keepBuffer: 0, updateWhenIdle: true,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · <a href="https://www.openstreetmap.org/fixthemap">Fix the map</a>',
      }).on('tileerror', event => {if (!cancelled) {failures.fail(event.tile as HTMLImageElement); setTileError(failures.count());}})
        .on('tileload tileunload', event => {if (!cancelled) {failures.loaded((event as Leaflet.TileEvent).tile as HTMLImageElement); setTileError(failures.count());}}).addTo(map);
      const marker = (point: {latitude: number; longitude: number}, color: string, title: string) => {
        const element = document.createElement('span');
        element.className = 'pathfinder-map-pin';
        element.style.backgroundColor = color;
        return L.marker([point.latitude, point.longitude], {
          title, alt: title, keyboard: true,
          icon: L.divIcon({html: element, className: 'pathfinder-map-marker', iconSize: [24, 32], iconAnchor: [12, 32], popupAnchor: [0, -30]}),
        });
      };
      const lines = new Map<string, Leaflet.Polyline>();
      const origin = marker({latitude: 14.62545, longitude: 121.12115}, '#1d9ee3', 'Route origin');
      const destination = marker({latitude: 14.62141, longitude: 121.16854}, '#7ed957', 'Route destination');
      const routeLayers = L.layerGroup().addTo(map);
      setRuntime({L, map, lines, origin, destination, routeLayers, retryTiles: () => failures.retry(tile => {
        if (tile.isConnected) tile.src = tile.src;
        else failures.unloaded(tile);
      })});
    }).catch(() => {
      if (cancelled) return;
      cancelled = true;
      instance?.remove(); instance = undefined;
      styles.release(); failures.clear();
      setTileError(0); setError(true);
    });
    return () => {cancelled = true; styles.release(); instance?.remove(); failures.clear(); clearTimeout(retryTimer.current);};
  }, [attempt]);

  useEffect(() => {
    if (!runtime || !route || !isRoadRoute(route)) return;
    const credit = 'Routing: <a href="https://project-osrm.org">OSRM</a>';
    runtime.map.attributionControl.addAttribution(credit);
    return () => {runtime.map.attributionControl.removeAttribution(credit);};
  }, [runtime, route]);

  const fit = useCallback(() => {
    if (!runtime || !route) return;
    const bounds = runtime.map.getContainer().getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const {edgePadding: e, mapPadding: m} = mapViewport(width, height, overlays);
    runtime.map.stop();
    runtime.map.flyToBounds(runtime.L.latLngBounds(route.coordinates.map(p => [p.latitude, p.longitude])), {
      paddingTopLeft: [e.left, e.top], paddingBottomRight: [e.right, e.bottom + m.bottom],
      duration: reducedMotion ? 0 : 0.6, animate: !reducedMotion, maxZoom: 16,
    });
  }, [runtime, route, width, height, overlays, reducedMotion]);
  useImperativeHandle(ref, () => ({recenter: fit, centerOnLocation: point => {
    runtime?.map.flyTo([point.latitude, point.longitude], 16, {animate: !reducedMotion, duration: 0.6});
  }}), [fit, runtime, reducedMotion]);
  useEffect(() => {
    if (!runtime) return;
    runtime.routeLayers.clearLayers(); runtime.lines.clear();
    routes.forEach((r, index) => {
      const road = isRoadRoute(r);
      const line = runtime.L.polyline(r.coordinates.map(p => [p.latitude, p.longitude]), {color: r.color, weight: 5}).addTo(runtime.routeLayers);
      line.on('click', () => select.current(r.id));
      runtime.lines.set(r.id, line);
      const point = r.coordinates[Math.min(r.coordinates.length - 1, road ? Math.floor(r.coordinates.length * (0.35 + index * 0.15)) : 8 + index * 5)];
      const title = routeLabel(r, reversed) + (road ? ' · Driving' : ' · Sample');
      const icon = runtime.L.divIcon({html: '<span class="pathfinder-map-pin" style="background:' + r.color + '"></span>', className: 'pathfinder-map-marker', iconSize: [24,32], iconAnchor: [12,32], popupAnchor: [0,-30]});
      runtime.L.marker([point.latitude, point.longitude], {icon, title, alt: title}).addTo(runtime.routeLayers)
        .bindPopup(popup(title, routeSummary(r)), {autoPan: false, maxWidth: 240}).on('click', () => select.current(r.id));
    });
  }, [runtime, routes, reversed]);
  useEffect(() => {
    if (!runtime || !location) return;
    const group = runtime.L.layerGroup().addTo(runtime.map);
    if (location.accuracy !== null) runtime.L.circle([location.latitude, location.longitude], {radius: location.accuracy, color: '#53b8ff', weight: 1, fillOpacity: 0.08, interactive: false}).addTo(group);
    runtime.L.circleMarker([location.latitude, location.longitude], {radius: 8, color: '#fff', weight: 2, fillColor: '#259cff', fillOpacity: 1}).addTo(group)
      .bindPopup(popup('Your GPS position', 'Last fix: ' + new Date(location.timestamp).toLocaleTimeString() + (location.accuracy === null ? '' : ' · accuracy ±' + Math.round(location.accuracy) + ' m')));
    return () => {group.remove();};
  }, [runtime, location]);
  useEffect(() => {
    if (!runtime) return;
    // Router can retain Home with display:none while Search is active. Refit
    // after it becomes visible rather than fitting into a zero-sized map.
    const observer = new ResizeObserver(entries => {
      if (!entries[0]?.contentRect.width || !entries[0]?.contentRect.height) {
        runtime.map.stop();
        return;
      }
      runtime.map.invalidateSize({pan: false});
      fit();
    });
    observer.observe(runtime.map.getContainer());
    return () => observer.disconnect();
  }, [runtime, fit]);
  useEffect(() => {
    if (!runtime) return;
    if (!route) {runtime.origin.remove(); runtime.destination.remove(); return;}
    runtime.origin.addTo(runtime.map); runtime.destination.addTo(runtime.map);
    [...routes.filter(r => r.id !== route.id), route].forEach((r, index) => {
      const line = runtime.lines.get(r.id);
      if (!line) return;
      const selected = r.id === route.id;
      line.setStyle(isRoadRoute(r) ? {weight: selected ? 6 : 5, color: selected ? '#7ed957' : '#8b9690', opacity: selected ? 1 : 0.55} : {weight: selected ? 5 : index === 0 ? 13 : 9, opacity: selected ? 1 : 0.65});
      line.bringToFront();
    });
    const points = reversed && !isRoadRoute(route) ? [...route.coordinates].reverse() : route.coordinates;
    const endpoints = tripEndpoints(route, reversed);
    const popupOptions: Leaflet.PopupOptions = {
      maxWidth: Math.min(240, width - 40), autoPan: true,
      autoPanPaddingTopLeft: [16, overlays?.top ?? height * 0.16],
      autoPanPaddingBottomRight: [16, (overlays?.bottom ?? height * 0.405) + 16],
    };
    runtime.origin.setLatLng([points[0].latitude, points[0].longitude])
      .bindPopup(popup(`Origin: ${endpoints.origin}`, isRoadRoute(route) ? 'Road-snapped origin. Driving estimate, not transit directions.' : 'Demo starting point. Not your GPS location.'), popupOptions);
    const last = points[points.length - 1];
    runtime.destination.setLatLng([last.latitude, last.longitude])
      .bindPopup(popup(`Destination: ${endpoints.destination}`, isRoadRoute(route) ? 'Road-snapped driving destination. No live traffic.' : 'Demo destination — tap a route to compare.'), popupOptions);
    const bounds = runtime.map.getContainer().getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    runtime.map.invalidateSize({pan: false});
    const frame = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(frame);
  }, [runtime, route, routes, reversed, fit, width, height, overlays]);

  return <div className="pathfinder-browser-map" data-testid="interactive-map"
    style={{position: 'absolute', inset: 0, isolation: 'isolate', zIndex: 0,
      '--map-panel-padding': `${mapViewport(width, height, overlays).mapPadding.bottom}px`} as React.CSSProperties}>
    <div ref={container} aria-label="Interactive route map" style={{width: '100%', height: '100%'}} />
    {tileError > 0 && <div role="status" className="pathfinder-map-error">{tileError} map {tileError === 1 ? 'tile is' : 'tiles are'} unavailable. Loaded routes remain usable.
      <button disabled={retrying} onClick={() => {
        if (!runtime?.retryTiles()) return;
        setRetrying(true);
        retryTimer.current = setTimeout(() => setRetrying(false), 5000);
      }}>Retry tiles</button>
    </div>}
    {!runtime && !error && <div role="status" className="pathfinder-map-error">Loading map…</div>}
    {error && <div role="alert" className="pathfinder-map-error">Map could not load.
      <button onClick={() => {setError(false); setRuntime(null); setTileError(0); setRetrying(false); setAttempt(value => value + 1);}}>Retry map</button>
    </div>}
  </div>;
});
