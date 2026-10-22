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

## Saved journeys

Choose **Save journey** in route results or Home's route details, then open
**Menu > Saved routes** to view or delete it. Saved details survive app restarts
and can be viewed without a connection once the app is loaded. This does not
provide offline maps, navigation, or an offline Web app installation. Opening a
saved journey does not change the active trip or request fresh routes.

Only explicitly saved endpoint coordinates, route geometry, and displayed route
details are persisted locally with AsyncStorage (unencrypted); no GPS fix history
is saved. Snapshots may become outdated and are not live traffic or transit data.
Up to 50 journeys and 4 million serialized characters are supported, subject to
device/browser storage limits. Storage errors leave the last successful data
unchanged; unreadable data is not silently overwritten. Browser storage clearing
or app-data removal deletes these local saves. A new native build must include
the added AsyncStorage dependency.

## Journey History

Menu > Journey History shows the last 20 explicitly selected journeys, newest
first. A route-card selection, View selected route on map, or a map/details route
selection records a local snapshot. Merely receiving search results, choosing a
place candidate, GPS updates, failed searches, and viewing history do not record
journeys. Re-selecting the same endpoints and route updates its selection time
and snapshot instead of adding a duplicate. No raw search queries or GPS fix
metadata are stored.

History uses its own AsyncStorage key, independent of Saved routes. Individual
deletion and confirmed Clear History never delete saved routes or change the
active trip. Historical details are previously retrieved estimates and may be
outdated; opening them does not request fresh routes or provide offline maps.
Storage failures retain the last successful history. Unreadable data stays
untouched unless Clear History is explicitly confirmed. No new dependency,
account, backend, or cloud synchronization is used.

## Local storage coordination

Saved Routes and Journey History use separate Web Locks and re-read validated
storage inside each mutation. Storage events and focus/resume reconcile other
tabs without changing the active trip or requesting routes. Web writes require
Web Locks on HTTPS or localhost; unavailable, denied or timed-out coordination
blocks writes with an error while previously stored details remain readable.
Reload all tabs after upgrading: older app versions and external storage writers
do not participate in this cooperative locking protocol.

Android continues to use AsyncStorage with per-key queues shared within the JS
runtime. This does not coordinate independent native processes/runtimes. No
native multi-process safety or physical-device verification is claimed. Restart
Recovery keeps its separate, existing storage behavior and is not cross-tab locked.

## Public service limits and privacy

OSRM is for limited prototype testing, not a production routing guarantee. The
client allows one network request at a time, at least five seconds between
requests, a 15-second timeout, and no automatic retries, polling or GPS-triggered
routing. Up to ten results are cached in memory for five minutes. HTTP 429 honors
Retry-After with a minimum one-minute cooldown. Limits are per app instance; they
do not make large multi-user deployments suitable for the public demo.

Coordinates go directly to OSRM only after Find/Compare; service operators may
log requests. Live GPS fixes and the route request cache are not saved to disk;
explicitly saved or selected journeys persist as described above. Map tile requests expose
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
