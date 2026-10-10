# PATHFINDER

Expo SDK 57 + TypeScript + Expo Router, with the existing black-and-green UI.
Web uses Leaflet; Android uses locally bundled Leaflet in react-native-webview.
Both use OpenStreetMap tiles without API keys or Google Cloud billing. The old
Android renderer used PROVIDER_GOOGLE and needed a Google Maps key for standalone
builds. It has been replaced with the approved WebView alternative and
react-native-maps is excluded from Android autolinking. iOS retains Apple Maps.

## Run

Use Node 24 and npm. No .env values are required.

```powershell
npm install
npm start
npm run web
```

Open with an Expo Go version supporting SDK 57, or install the preview APK.
Browser GPS requires HTTPS or localhost. expo-location and react-native-webview
were installed using Expo's SDK-compatible installer. Native configuration is in
app.config.ts; do not manually create android/ or ios/ directories.

## Try GPS and driving routes

1. Home > Menu > Locate & recenter on me requests foreground location permission
   and shows the latest GPS fix. Nothing requests location on app launch.
2. Where to? > Road driving. Enter SM City Masinag, Cogeo Gate 2, or latitude,
   longitude. Use my location supplies a fresh GPS origin. Arbitrary address
   geocoding is not implemented.
3. Find Routes or Compare Routes explicitly calls OSRM's public driving demo.
   Full returned road geometry, distance, estimated duration and available
   alternatives populate the map and comparison. A single returned route stays
   a single route. Tap a line or marker to select it; alternatives are subdued.
4. Home > Menu > Route details and alternatives shows route choices and metrics.
   Recenter selected route fits the route; the menu GPS action recenters on you.
5. Transit demo preserves the original sample services, fares and crowds. These
   are labeled demo, not live, and never inferred from car routing.

GPS is a one-shot foreground fix, not continuous navigation. Fix time and accuracy
are available in route details. A GPS route origin older than five minutes must
be refreshed. No background location is configured. Permission denial, disabled
location services, timeouts, offline routing, no routes and server errors have
user feedback. Failed requests preserve previously loaded routes.

## Public service limits and privacy

OSRM is for limited prototype testing, not a production routing guarantee. The
client allows one network request at a time, at least five seconds between
requests, a 15-second timeout, and no automatic retries, polling or GPS-triggered
routing. Up to ten results are cached in memory for five minutes. HTTP 429 honors
Retry-After with a minimum one-minute cooldown. Limits are per app instance; they
do not make large multi-user deployments suitable for the public demo.

Coordinates go directly to OSRM only after Find/Compare; service operators may
log requests. GPS and route cache are not saved to disk. Map tile requests expose
the viewed area to OSM. Driving estimates include no live traffic, crowding,
transit service, fares or validated jeepney/bus directions.

Tiles use the standard HTTPS URL, visible OSM attribution and a Fix the map link.
Normal browser/WebView HTTP caching is enabled; no cache-bypass headers, offline
downloads, bulk prefetch or tile scraping are implemented. Native WebView and
routing requests identify PATHFINDER. Browser referrers are preserved. Cached
tiles may remain offline; complete offline maps are not promised. Leaflet JS/CSS
is bundled locally on Android, with its license in src/map/LEAFLET-LICENSE.

Policies: [OSM tiles](https://operations.osmfoundation.org/policies/tiles/),
[OSRM demo](https://routing.openstreetmap.de/about.html),
[OSRM policy index](https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy).

## Validation and builds

```powershell
npm run typecheck
npm run lint
npm test
npm run export:web
npm run check:web-map
npm run test:web
npm run export:android -- --source-maps
node scripts/check-android-map.cjs
npx eas-cli@latest build --platform android --profile preview
```

EAS preview creates an installable APK. A Hermes export checks JS bundling, not
native compilation. The app is linked to @proxywise2/pathfinder. See
[Android validation](docs/android-verification.md) for build and device status,
and [map validation](docs/web-map.md) for browser test scope.

Regenerate Android's bundled Leaflet after upgrading Leaflet with
`node scripts/bundle-leaflet.cjs`; refresh public/leaflet web assets as well.

Phase 1 updated expo-router from 57.0.0 to the SDK-recommended ~57.0.25
(installed 57.0.25). Registry resolution succeeded and `expo install --check`
now passes. See [Phase 1 validation](docs/phase-1-reliability.md).
