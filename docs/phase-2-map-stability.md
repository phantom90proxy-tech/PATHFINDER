# Phase 2 — map stability and performance

Implemented 2026-10-09. No dependencies, navigation flows, transit samples,
providers or app configuration changed. No EAS build, deployment, commit or push.

## Files changed

- `src/components/RouteMap.android.tsx`: watchdog integration, generation checks,
  pending camera intent, incremental bridge updates and resume handling.
- `src/map/mapSession.ts` (new): 15-second initialization deadline, failure/retry
  lifecycle and stale-message rejection.
- `src/map/nativeLeaflet.ts`: tagged bootstrap errors, stable route/GPS layers,
  per-tile recovery and document cleanup.
- `src/map/tileFailures.ts` (new): per-image tracking and retry cooldown.
- `src/components/RouteMap.web.tsx` and `RouteMap.web.css`: tile recovery controls.
- `src/services/roadRouting.ts` and `src/data/roadRoutes.ts`: validated optional
  OSRM waypoint metadata and shared snapping notice.
- `src/components/HomeScreen.tsx` and `SearchScreen.tsx`: informational text in
  existing details/comparison dialogs; no screen redesign.
- `tests/map-stability.test.mjs` (new), `e2e/map-stability.spec.ts` (new),
  `e2e/native-map.spec.ts`: regression coverage and tagged bridge expectations.
- This report and `docs/android-verification.md`.

Generated Web/Android export artifacts were refreshed for validation.

## Fixes and performance

Android waits at most 15 seconds for Leaflet readiness. Script errors, load
failures and renderer loss expose Retry map. Each restart has a new generation;
retired documents/native callbacks cannot revive or select a route. Duplicate
ready messages are ignored. Camera requests before initialization survive retry;
the latest wins, after initial geometry/fit, and is discarded on unmount.

Android selection sends state without resending geometry. Polylines, route and
endpoint markers, popups and unchanged GPS layers survive selection; only styles,
stacking and the existing selected-route fit change. Genuine data/direction
changes can rebuild layers. Web already separated geometry from selection;
regressions now protect this behavior. Tests verify node identity/count, not a
measured device CPU or memory improvement.

Tile failures are tracked by image identity. Success clears only that image;
unloaded tiles leave the failure set. Manual retry reassigns only failed tile URLs
with a five-second cooldown. No automatic retries, full redraws, cache-busting or
no-cache headers were added. Attribution, HTTP caching and Android's PATHFINDER
user-agent suffix remain intact.

Valid OSRM waypoint distances and lon/lat positions are retained in the existing
session-only cache. At 100 m or more, details/comparison explain the endpoint
offset, rounded to 10 m, explicitly stating that a walking connection has not
been verified. Missing/malformed metadata does not discard valid driving geometry
or estimates. No road route is converted into transit directions.

Android resume invalidates map size without polling, requests or forced redraws.
AppState subscriptions and watchdogs are removed on unmount. Document disposal
removes Leaflet, retry timers and bridge/error listeners; WebView destruction
destroys its document context. Background initialization may expire and require
manual retry when returning.

## Actual validation

| Command | Result |
| --- | --- |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | PASS |
| `node node_modules/eslint/bin/eslint.js src e2e app.config.ts metro.config.js playwright.config.ts eslint.config.js scripts --no-cache` | PASS, no warnings |
| `npm.cmd test` | PASS, 25 unit tests |
| `npm.cmd run test:web` | PASS, 25 Playwright tests in headless Edge |
| `npm.cmd run test:web -- e2e/map-stability.spec.ts` | PASS, 5 focused tests after strengthening assertions |
| `npm.cmd run export:web` | PASS |
| `npm.cmd run export:android -- --source-maps` | PASS, Hermes bytecode export |
| `npm.cmd run check:web-map` | PASS, no native map modules in Web |
| `node scripts/check-android-map.cjs` | PASS, Leaflet/WebView; Google map module excluded |

An initial TypeScript run caught a Leaflet multi-event typing error, corrected
before the passing checks. No tests failed. Existing Node module-type inference
and environment color warnings remain; no configuration was changed to hide them.

New regressions cover initialization timeout/retry, pending camera retention,
script failures, stale/duplicate/malformed messages, selection before ready/after
disposal, mixed tile outcomes, retry cooldown and single-image recovery, significant
and invalid snapping metadata, cleanup/resume, stable map elements and popups,
GPS layer persistence and selection bridge message count. Existing navigation,
GPS, routing errors, comparisons, map gestures and responsive tests pass.

All browser tests mock tiles/OSRM; they do not load-test public services. They
execute the actual Android Leaflet HTML in a browser, not Android WebView itself.

## Limitations and Android requirements

No physical Android testing or new APK build was performed. Hermes export is not
installation or native integration verification. The older preview APK predates
these changes. No regressions were observed in automated checks; device-specific
behavior remains unverified. Phase 3 was not started.

Physical-device checklist using current source/build:

1. Cold launch, interrupted initialization, timeout, renderer termination and
   repeated retry; ensure retired documents cannot affect selection.
2. GPS/recenter before readiness and after retry; verify final camera intent.
3. Repeated alternative selection, persistent popups, pinch/pan gestures and
   large-route responsiveness/memory use.
4. Partial/offline tiles, reconnect/manual retry and actual WebView HTTP caching
   and user-agent behavior without bypassing normal cache headers.
5. Search/Home navigation, hardware Back, background/resume, screen lock and size
   restoration. Check foreground GPS grant/denial and disabled location services.
6. Endpoints at least 100 m off-road: notices, correct order and unchanged driving
   metrics in comparison/details.

No snapping notice is not evidence that an endpoint lies on a road. A walking
connection is never verified. OSRM remains a limited development demo without an
availability guarantee. Tile recovery depends on the network/service and normal
cache expiry; Android behavior still requires the checks above.

References: [Expo SDK 57 WebView](https://docs.expo.dev/versions/v57.0.0/sdk/webview/),
[React Native 0.86 AppState](https://reactnative.dev/docs/0.86/appstate),
[OSRM waypoints](https://project-osrm.org/docs/v5.24.0/api/#waypoint-object),
[OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/).
