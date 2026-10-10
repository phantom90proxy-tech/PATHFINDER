Google Maps navigation integration — 10 October 2026

The feature opens official Google Maps directions URLs. It does not call Google Cloud, install a Maps SDK, use an API key, enable billing, or add a backend or dependency. Google's [Maps URLs documentation](https://developers.google.com/maps/documentation/urls/get-started) documents the keyless URL format and Android app/browser fallback.

Files changed for this feature:

- `src/services/googleMaps.ts`: pure endpoint validation/URL construction and testable opening behavior.
- `src/components/GoogleMapsButton.tsx`: shared action, navigation/external icons, explanatory text, and recoverable inline errors.
- `src/components/RouteDiscovery.tsx`: one action beside the selected route's map action in Results only.
- `src/components/HomeScreen.tsx`: import and one action inside the existing Route Details modal. Home's map, sheet, styles, and controls are unchanged.
- `tests/google-maps.test.mjs`: seven focused unit tests.
- `e2e/google-maps.spec.ts`: two browser tests.
- `docs/google-maps-navigation.md`: this report.

The existing workspace contains other uncommitted changes; the list above is limited to this feature. Search, Plan Your Ride, route comparison logic, selection state, OSRM, GPS permissions, Leaflet, WebView, and all map renderers were left unchanged.

URL behavior:

- Uses `https://www.google.com/maps/dir/?api=1`, encoded `origin`/`destination`, and `travelmode=driving`.
- Uses the selected route, not form fields from a different trip or a fixed destination.
- Prefers validated requested road endpoints from OSRM snapping metadata, otherwise route endpoint coordinates. Place names are encoded when coordinates are unavailable.
- Reverses both endpoints for reversed demo trips. Road routes already contain their travel direction and are not reversed again.
- A Current location origin uses an existing valid GPS fix no older than five minutes. If absent, stale, future-dated, or invalid, origin is omitted so Google Maps can determine device location or ask the user. This is the intentional exception to including origin; no extra PATHFINDER GPS request or permission is made.
- Missing endpoints without usable coordinates, invalid numeric coordinates, and URLs longer than Google's documented 2,048-character limit show an error.
- No alternative-route identifiers, waypoints, OSRM geometry, transit fares, or invented traffic values are sent. The explanatory text says Google may calculate a different driving route and the user may need to tap Start.

Android behavior:

`expo-linking.openURL` opens the official HTTPS URL. Per Google's documented universal URL behavior, Maps handles it when installed and active; otherwise the device opens a browser. This fallback is delegated to Android's URL resolver, not a custom package intent or a second Google API. User defaults/app-link settings may affect which application handles the link. If no handler opens it, the rejected promise becomes a helpful inline message; selection is not changed. No package-visibility queries or native configuration changes are required.

Web behavior:

The press synchronously opens a separate blank tab, clears its opener reference, then navigates it to the validated Google Maps URL. PATHFINDER's page and selected route remain in place. A blocked popup or failed assignment shows recovery text. A successful handoff cannot guarantee that the external page loads or has live traffic available.

Validation:

- `npm.cmd run typecheck`: passed.
- `npx.cmd eslint src e2e/google-maps.spec.ts`: passed.
- `npm.cmd test`: 32 unit tests passed, including seven new tests.
- `npm.cmd run test:web`: 36 browser tests passed, including two new tests.
- `npm.cmd run export:web`: passed.
- `npm.cmd run export:android -- --source-maps`: passed, Hermes output generated.
- `npm.cmd run check:web-map` and `node scripts/check-android-map.cjs`: passed.

Unit coverage checks URL encoding, actual endpoints, requested-vs-snapped road coordinates, GPS freshness/default origin, reversed trips, missing/invalid destinations, Android URL handoff/rejection, Web popup failure, and unchanged input route data. Android handlers are mocked: these tests verify application behavior, not a real installed Maps/browser resolution.

Browser coverage opens intercepted external tabs from Results and Details, checks reversed coordinates, driving mode and opener isolation, verifies persistent selection, and exercises a blocked popup. Existing regressions also cover map geometry, route selection, cancellation, enlarged text, and compact layouts. Google and tile responses are local fixtures; live traffic accuracy and Google navigation were not automated.

Physical Android checks remain required: with Maps installed/enabled, tap the action and verify endpoints and driving mode; disable/uninstall Maps and verify browser fallback; test unavailable handlers, return-to-app selection, fresh/stale GPS origins, reversed trips, large text, and TalkBack. Confirm that tapping Start inside Google Maps works where supported. The app retains in-memory state when returning while its process remains alive; process-death persistence is not added by this feature.

No EAS build, deployment, commit, or push was performed.
