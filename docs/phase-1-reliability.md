# Phase 1 reliability changes

Implemented on 2026-10-09. No deployment, cloud build, commit or push was performed.

## Resolved issues

- Expo Router changed from `57.0.0` to `~57.0.25`, installed `57.0.25` using
  `npx expo install expo-router`. Registry resolution succeeded. npm updated the
  lockfile, reporting one changed package and 18 removed packages. No force or
  legacy-peer-deps option was used. `expo install --check` now passes.
- A shared Search session invalidates pending results at visible Back, Android
  hardware Back, navigation removal and focus cleanup, before exit animations.
  Captured generations also reject old results after re-entry.
- One 25-second GPS deadline covers permission, service checks and position.
  The underlying-request lock remains until the provider settles. Late results
  are discarded and late permission completion cannot start position acquisition.
  Permission denial, blocked permission, disabled services and invalid fixes
  produce actionable errors. Permissions remain foreground-only.
- Home shows non-interactive GPS progress after closing its menu, then a brief
  success/failure status. Existing error details are preserved.
- Shared endpoint/title/label helpers keep reversed demo journeys consistent in
  comparison, details and map renderers. Road routes are not reversed twice.
  Sample geometry, fares, duration and crowd information are unchanged.

## Files modified or added

- `package.json`, `package-lock.json`
- `src/services/searchSession.ts`, `src/services/locationAcquisition.ts`
- `src/hooks/useSearchSession.ts`, `src/hooks/useCurrentLocation.ts`
- `src/app/search.tsx`, `src/app/search.web.tsx`
- `src/components/AndroidSearchScreen.tsx`
- `src/components/SearchScreen.tsx`, `src/components/HomeScreen.tsx`
- `src/components/RouteMap.web.tsx`, `src/components/RouteMap.android.tsx`,
  `src/components/RouteMap.native.tsx`, `src/map/nativeLeaflet.ts`
- `src/data/roadRoutes.ts`
- `tests/reliability.test.mjs`, `e2e/reliability.spec.ts`
- `README.md`, `docs/android-verification.md`, this report

## Validation results

- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: passed.
- `node node_modules/eslint/bin/eslint.js src e2e app.config.ts metro.config.js
  playwright.config.ts eslint.config.js scripts --no-cache`: passed.
- `npm test`: 21/21 passed. New coverage includes deadlines at each acquisition
  stage, overlap prevention, retry after settlement, denied permission, disabled
  services, invalid fixes, session invalidation and trip direction.
- `npm run export:web`: passed.
- `npm run test:web`: 20/20 passed, final exit code 0 (28.6 seconds). New browser
  regressions cover responses during visible/history exit animations, reversed
  comparison/details/map labels, and Home GPS progress with map interaction.
- `npm run export:android -- --source-maps`: passed. This is a Hermes export,
  not native APK compilation.
- `node scripts/check-web-map.cjs` and `node scripts/check-android-map.cjs`: passed.
- `npx expo-modules-autolinking react-native-config --platform android`: includes
  WebView and excludes react-native-maps.
- `npx expo install --check`: dependencies are up to date.

The first browser run passed its cases but hung during Windows server teardown.
Its server was stopped; the final run reused a separately managed server and
exited normally. Tests intercept public tile and routing requests with fixtures.

## Remaining risks and Android requirements

- No physical Android test or new APK build was performed. The previous APK
  predates this phase. Use compatible Expo Go or a separately authorized new
  native build to validate current source.
- Verify hardware Back during Find/Compare/GPS, approximate/precise GPS, denied
  permission, disabled services, timeout recovery, background/resume, gestures
  and reversed-trip labels on a phone.
- Expo's one-shot location call cannot cancel an outstanding OS request. If it
  never settles, retries stay blocked to prevent overlap; resolving the OS prompt
  or restarting the app may be necessary.
- Already-sent routing requests may finish and populate the short-lived service
  cache. Exited screens ignore results; exit does not initiate requests.
- npm installation reported 29 audit vulnerabilities (10 moderate, 19 high).
  No force fixes were applied; individual vulnerability assessment is outside
  this phase. Node unit tests retain the existing module-format warning.
- Other inspection findings remain outside Phase 1. No regression was observed
  in executed checks; native device behavior remains unverified.
