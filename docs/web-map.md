# Interactive map implementation and validation

Platform resolution:
- RouteMap.web.tsx: existing Leaflet browser map, loaded after mount for SSR safety.
- RouteMap.android.tsx: WebView with locally bundled Leaflet from nativeLeaflet.ts.
- RouteMap.native.tsx: Apple Maps on iOS.
- RouteMap.types.ts: shared route/GPS props and recenter/centerOnLocation handles.

Both Leaflet implementations render actual road response coordinates, tappable
lines and markers, selected/alternative styles, GPS dot and accuracy circle,
attribution above the Home panel, and tile failure feedback. The browser map
refits after Router reveals a previously hidden Home container. Android uses a
JSON bridge for route updates, camera commands and validated selection IDs.

Data is split between local transit samples and RoadRoute. resolveEndpoint accepts
known demo places, explicit latitude/longitude, or a recent permitted GPS fix.
The roadRouting service validates OSRM geometry/metrics and enforces session cache,
throttle, in-flight guard, timeout and server-error handling. No screen triggers
routing on mount, GPS updates, map movement or route selection.

## Automated checks

Validated on 2026-10-09: TypeScript and lint passed, 14 unit tests passed,
16 Playwright tests passed, and Web and Android Hermes exports passed.
Android autolinking output includes react-native-webview and excludes
react-native-maps. Physical Android testing remains separate.

Use `npm run export:web`, `npm run check:web-map`, then `npm run test:web`.
Playwright uses installed Edge and localhost:8790. Tests intercept tile requests
and OSRM requests to avoid automated load on community services.

Coverage includes phone/desktop pan and zoom, marker popups, route selection,
recenter, attribution, endpoint reversal, Search transitions and layout, returned
road geometry and comparison, cache reuse, explicit GPS activation, permission
denial, unavailable routes, offline/server errors, and ignoring a request result
after Back. The native document test executes the actual bundled Leaflet HTML in
Edge to check its bridge, geometry, GPS and locally embedded assets. This does not
replace an Android WebView test.

The recorded OSRM fixture came from one live development request on 2026-10-09:
Masinag to Cogeo, 7,278.5 m, 479.7 seconds, 249 coordinate points, one route.
A second test-only synthetic alternative verifies selection styling; it is not
used by the app. No fabricated alternatives are added to real results.

check-web-map verifies bundle isolation from react-native-maps. The Android check
verifies WebView instead of Google Maps and Android autolinking exclusion.

Actual online tiles, physical GPS, Android permission UI, pinch gestures, Android
HTTP cache/headers and attribution links need the device checks in
[android-verification.md](android-verification.md). Safari and Firefox have not
been validated. Offline rendering depends on already-cached tiles and routes.
