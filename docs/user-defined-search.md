# User-defined journeys

PATHFINDER starts with empty origin/destination inputs, road search enabled, and no selected route or endpoint markers. The existing Home and Plan Your Ride styles are retained. Transit samples remain available through the explicit Transit demo mode and are never a fallback for a failed road search.

## Place search

Find Routes and Compare Routes validate both inputs. GPS, valid latitude/longitude pairs and the two existing known-place shortcuts resolve locally. Other place names use `https://photon.komoot.io/api/`, returning up to five candidates. Users confirm each place's address before OSRM receives coordinates. No coordinates are guessed; unknown places, malformed responses, network failures and invalid coordinates show an error. Search is submission-driven, with no keystroke requests or background polling.

Photon requires no API key, account or billing. The public server permits reasonable use but can throttle or ban heavy usage and provides no uptime guarantee: https://github.com/komoot/photon#demo-server
API format: https://github.com/komoot/photon/blob/master/docs/api-v1.md

The client limits requests to one in flight, spaces starts by at least 1.1 seconds, caches up to 30 queries for five minutes in memory, times requests out after 12 seconds and backs off for one minute after HTTP 429. No automatic retries. This is appropriate for modest testing usage; it is not a guaranteed high-volume production service. Coverage and address accuracy depend on OpenStreetMap. Include city/country to improve matches. Confirmation is required even for one result because a matching name may identify the wrong place. Attribution and query/coordinate sharing information appear in the search UI.

Search-session guards ignore responses after Back or navigation away. The last valid map journey survives a failed subsequent search. No new GPS permissions, routing provider, backend or dependency was introduced.

## Google Maps

Road routes retain requested endpoint coordinates independently of OSRM's snapped geometry and optional waypoints. The existing free Google Maps URL uses those coordinates; GPS-origin behavior is retained. Results and Details show navigation only with a valid selected trip. Google may calculate a different road route.

## Files

- `src/PrototypeState.tsx`: empty selection and default road mode.
- `src/components/HomeScreen.tsx`: empty-trip content; no sample fallback.
- `src/components/SearchScreen.tsx`: requested placeholders, geocoding and confirmation flow.
- `src/components/RouteDiscovery.tsx`: location confirmation using existing modal/card styles.
- `src/components/RouteMap.types.ts`, `RouteMap.web.tsx`, `RouteMap.android.tsx`, `RouteMap.native.tsx`: nullable selection and empty map support; map infrastructure retained.
- `src/data/roadRoutes.ts`: GPS validation and requested endpoint type.
- `src/services/placeSearch.ts`: Photon adapter, validation/cache/request controls.
- `src/services/roadRouting.ts`: retain requested coordinates, without changing routing algorithms.
- `src/services/googleMaps.ts`: prefer requested endpoints.
- `tests/place-search.test.mjs`, `e2e/user-search.spec.ts`: new regression coverage.
- Existing browser specs `google-maps`, `map-interactions`, `reliability`, `road-map`, `route-discovery`, `search-design`, `search-svg`: explicitly choose demo data when needed and assert empty startup after cancellation.

## Validation and device limits

Passed: TypeScript (`npm run typecheck`), source ESLint (`npx eslint src`), 36 Node unit tests, 42 Playwright browser tests, Web export, Android Hermes export, and Web/Android map-isolation checks. An initial TypeScript run overlapped Web export and saw a disappearing generated file; the sequential rerun passed. Old browser tests were updated to opt into demo data instead of expecting it on launch.

Automated coverage uses mocked Photon and OSRM responses to avoid loading public services. A separate single live Photon lookup returned HTTP 200, valid place coordinates, and `Access-Control-Allow-Origin: *`.

Physical Android testing remains required for network access to Photon, GPS acquisition, hardware Back during location lookup/confirmation/routing, TalkBack and enlarged text, WebView resume, and external Google Maps/browser return. Browser execution of the Android Leaflet document and Hermes export do not replace device testing. No APK or EAS build was generated for this change.
