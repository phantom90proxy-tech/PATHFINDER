# Android verification

Phase 2 map changes also postdate the APK below. See
[Phase 2 validation and device checklist](phase-2-map-stability.md).
Web/Android Hermes exports and automated map tests passed; no new APK build or
physical Android test was performed for Phase 2.

Phase 1 changes postdate the APK below. See [Phase 1 validation](phase-1-reliability.md).
No new APK build or physical-device test was performed for Phase 1.

Physical Android testing: **pending**. Browser execution of the native HTML is
not device verification. SDK 57-compatible Expo Go or the EAS preview APK is
required. No Google Maps API key or Google Cloud billing is required.
The installed Android SDK's `adb devices -l` returned no connected devices.

Validation on 2026-10-09: TypeScript and lint passed; 14 unit tests and 16
Playwright tests passed. Web and Android Hermes exports and bundle isolation
checks passed. Android autolinking includes WebView and excludes react-native-maps.

[Final preview APK build](https://expo.dev/accounts/proxywise2/projects/pathfinder/builds/7853b622-79aa-4e21-86f9-74155ac8554c):
**FINISHED successfully** on 2026-10-09. This is a native EAS Android build,
not only a JavaScript export.
[Download the APK](https://expo.dev/artifacts/eas/pT2RDeqHInrzrVYO1uPB5Fu6ABq8AABXOhHZ3op4MK0.apk).
The earlier build was cancelled to include final service attribution and native
request identification changes. The download is an internal preview artifact;
EAS may expire it, after which the documented preview build command recreates it.

## Device checklist

Record device model, Android version, Expo Go/WebView versions and date.

- Launch online: OSM tiles load; no Google renderer or API-key errors.
- Check pan, pinch zoom, route selection, recenter and Search slide-up/down.
- Verify attribution and Fix the map stay above the panel and links open safely.
- Confirm there is no location prompt until a location action is tapped.
- Grant approximate/precise foreground permission and verify blue GPS marker,
  accuracy circle, last-fix time and Locate & recenter on me.
- Deny permission, deny permanently, and turn location services off; verify
  actionable messages and continued map/sample access.
- Find a driving route with known endpoints, then GPS and typed coordinates.
- Select available alternatives in comparison and on map; confirm matching metrics.
- Switch back to transit demo and verify sample fares/crowds remain clearly labeled.
- Disconnect network: loaded routes remain, routing errors are shown, missing tiles
  have feedback. Reconnect and retry explicitly.
- Rapidly tap Find/Compare; only one request runs and throttling applies.
- Background/resume and use Android hardware Back during GPS/routing operations.
- Verify WebView requests identify PATHFINDER/1.0 and honor HTTP tile cache headers
  on revisiting an area; no default no-cache headers or prefetch.
- Test compact display, enlarged fonts, Android safe areas and comparison scrolling.

No claim of live traffic, continuous turn-by-turn navigation, production service
availability, or car routes matching public-transport operations is made.
