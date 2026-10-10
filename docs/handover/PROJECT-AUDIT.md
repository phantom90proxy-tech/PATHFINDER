# PATHFINDER project audit

Audit date: 2026-10-10. Baseline: `main`, commit `9cec473` (`Initial PATHFINDER project upload`). Remote: `https://github.com/phantom90proxy-tech/PATHFINDER.git`. The working tree was clean before this audit; 115 files were tracked. No fetch, checkout, commit, push, dependency installation, native build or deployment was performed.

## Assessment and evidence boundaries

PATHFINDER is a functioning road-route discovery prototype with a preserved transit demonstration mode. Its empty-start, coordinate/GPS/place search, OSRM results, map selection, comparison and external Google Maps workflows have automated coverage. It is not a live public-transport planner, saved-journey product or in-app navigation engine. Physical Android acceptance is still outstanding.

Only the five files in `docs/handover/` were added to the project. Validation ran from a temporary snapshot of tracked files with the already-installed `node_modules` linked read-only in use; generated exports, screenshots and runner artifacts stayed in that snapshot. No application files or original test/configuration files were edited. A temporary runner configuration used port 8891 because 8790 was already occupied; the SVG test URL was pointed to the same audited export.

Status definitions: **COMPLETE** means implemented and verified within the stated automated scope; it does not certify a physical device. **PARTIAL** means an implemented capability has material gaps. **MISSING** means no implementation was found. **BUG** means a demonstrated or source-confirmed behavior is incorrect. **UNVERIFIED** means device, performance or external acceptance evidence is absent. Counts refer to the numbered audit items below, not a completion percentage. Some requested subfeatures are grouped where they share one implementation.

## Feature audit

| ID | Feature/subfeatures | Status | Evidence and limits |
|---|---|---|---|
| A01 | Home map-first design, typography and black/green theme | COMPLETE | `src/components/HomeScreen.tsx:47`, styles at 125; existing compact-layout browser coverage. No redesign. |
| A02 | Map loading and loading feedback | PARTIAL | Web loader `RouteMap.web.tsx:17`, Android watchdog `src/map/mapSession.ts:7`. Errors/retry exist, but no explicit Home progress indicator and no bounded Web stylesheet timeout. |
| A03 | On-demand GPS and foreground permission handling | COMPLETE | `src/hooks/useCurrentLocation.ts:6`, `src/services/locationAcquisition.ts:9`; timeout/denial/off-services/unit tests and Web mocked GPS tests. No startup GPS request. |
| A04 | Pan, zoom, route/marker selection, recenter | COMPLETE | `RouteMap.web.tsx`, `nativeLeaflet.ts`; actual Leaflet browser tests, including Android HTML execution. |
| A05 | Home navigation and profile panel | PARTIAL | `HomeScreen.tsx:64,85,109`; search/menu/details work; profile is a guest placeholder and greeting says “Your Name”. Authentication is not a required fix. |
| A06 | Dark styling consistency | COMPLETE | `app.config.ts:3`; intentionally dark-only. Light mode is not implemented or promised. |
| A07 | Android Home runtime acceptance | UNVERIFIED | Hermes export passes; permission dialogs, native touches, safe areas and startup need a real device. |
| B01 | Empty inputs and required placeholders | COMPLETE | `PrototypeState.tsx:6-15`, `SearchScreen.tsx:131-139`; startup regression verifies no selected trip or markers. |
| B02 | User-defined coordinates and named locations | COMPLETE | `roadRoutes.ts:46`, `SearchScreen.tsx:79-108`; unknown places never receive sample coordinates. |
| B03 | Photon geocoding and result validation | COMPLETE | `src/services/placeSearch.ts:6-49`; mocked browser and pure service coverage. Live availability is not guaranteed. |
| B04 | Independent origin/destination confirmation | BUG | `SearchScreen.tsx:63,92-93,170`; shared query-keyed confirmation conflates two endpoints with identical text. Reproduced with two “Central Station” candidates; see PF-01. |
| B05 | GPS origin and swapping endpoints | COMPLETE | `SearchScreen.tsx:127,143`; tested GPS origin and reversed journeys. Raw queries swap; confirmed choices are not stored as separate endpoint objects. |
| B06 | Input validation and actionable errors | COMPLETE | Blank, invalid coordinates, missing place results and offline tests pass. Error categories/copy remain generic in some cases (PF-08). |
| B07 | Location suggestions | PARTIAL | Road mode offers two known-place shortcuts plus submitted Photon results, not autocomplete. Transit suggestions contain unavailable and duplicated entries. |
| C01 | Find button, loading state and reduced motion | COMPLETE | `SearchScreen.tsx:79-108`, `RouteDiscovery.tsx:61-65`; explicit requests, loading text and animation suppression tested. |
| C02 | OSRM road requests and alternatives | COMPLETE | `roadRouting.ts:16-37,59`; real returned geometry/metrics, up to three alternatives, single-route handling. No live traffic. |
| C03 | Request cancellation | PARTIAL | `searchSession.ts:2-11` ignores late UI updates after Back. HTTP requests are not aborted by leaving Search; only timeout aborts them. |
| C04 | Network, invalid-route, no-route and timeout handling | COMPLETE | `roadRouting.ts:17-29,60-78`; unit/browser cases verify recovery without sample fallback. |
| C05 | Duplicate prevention, cache and throttle | COMPLETE | `roadRouting.ts:41-78`; one in-flight request, 5-second throttle, 5-minute cache, explicit retry only. |
| C06 | No automatic sample-route fallback | COMPLETE | `HomeScreen.tsx:49-50`; startup/error/cancellation regressions preserve empty or previous valid map. |
| D01 | Correct trip labels and result cards | COMPLETE | `SearchScreen.tsx:169`, `RouteDiscovery.tsx:52-88`; canonical confirmed place labels, reversed demo labels and road labels tested. |
| D02 | Duration, distance and driving indicator | COMPLETE | `RouteDiscovery.tsx:81-84`; OSRM seconds/meters converted for display. Car estimates never represented as transit timings. |
| D03 | Fastest road-route identification | PARTIAL | Durations are displayed, but no explicit minimum-duration ranking/badge. Server order is preserved; first route is not claimed to be fastest. |
| D04 | Real cheapest/least-crowded identification | MISSING | No real fares/crowding source. Correctly absent from road cards; do not invent these metrics. |
| D05 | Demo ranking accuracy | COMPLETE | `src/data/routes.ts:33-35`; sorts copies by sample fare, minutes or crowdRank; tests verify sorting and immutability. |
| D06 | Results selection and map synchronization | COMPLETE | `SearchScreen.tsx:70-74,103-106`; selected road/demo state feeds Home, Details and map; regression tests pass. |
| D07 | Cached-result freshness label | BUG | `RouteDiscovery.tsx:74` says “up to 5 minutes old” indefinitely if left open. Cache admission checks age only at request time (`roadRouting.ts:51`). Source-confirmed stale presentation, not wrong geometry. |
| E01 | Compare entry and loading | COMPLETE | Both modes use existing discovery modal, without extra Router screens (`SearchScreen.tsx:156`). |
| E02 | Duration and distance comparison | COMPLETE | Actual available road metrics shown vertically; no fabricated comparison scores or missing distances. |
| E03 | Fastest road comparison calculation | PARTIAL | Manual comparison works; no explicit difference/minimum calculation. Same gap as D03. |
| E04 | Real fare/crowd comparison | MISSING | These quantities do not exist in OSRM data. This is a scope/data limitation, not a hidden live feature. |
| E05 | Demo cheapest/fastest/crowd comparison | COMPLETE | `rankedRoutes` and demo cards use only labeled static values. Demo distance explicitly unavailable. |
| E06 | Single-tap selection, return and selection retention | COMPLETE | `RouteDiscovery.tsx:78`; card selects then returns to map; Back returns to Results. Existing tests cover retained selected state. |
| F01 | Details' selected map/geometry and endpoint markers | COMPLETE | Existing map remains behind modal; `HomeScreen.tsx:91-106`, platform maps preserve selected route. Markers are road-snapped, not verified pedestrian access. |
| F02 | Road information, duration and distance | COMPLETE | `roadRoutes.ts:37-41`, Details rows; fetched time is available. |
| F03 | Fare and crowd information | COMPLETE | Available only as labeled demo values. No road fare/crowd values are invented. |
| F04 | Save Route action | MISSING | No Save button, handler or persistence service in Details (`HomeScreen.tsx:91-106`). |
| F05 | Start Route action | PARTIAL | No separate Start button/active trip state; “Navigate with Google Maps” provides external driving directions. Do not add a duplicate button without a product decision. |
| F06 | Details navigation/closing | COMPLETE | Menu entry, Done and Modal Back handlers exist; browser interaction tests pass. |
| G01 | Save storage and app-restart persistence | MISSING | `PrototypeState.tsx:5-19` is memory-only; no storage dependency/service or saved-route model. |
| G02 | Saved retrieval and deletion | MISSING | Only Home and Search Router screens; no saved-route list or deletion UI. |
| G03 | Saved duplicate prevention and outdated-route handling | MISSING | No saved objects, keying/migrations/refresh policy. Prerequisite: G01. |
| H01 | Google URL, endpoints, GPS and reversal | COMPLETE | `googleMaps.ts:22-38`; encoded official URL, requested coordinates retained, stale GPS-origin omission supported. Unit tests pass. |
| H02 | Web handoff and popup failure | COMPLETE | `GoogleMapsButton.tsx:16-23`; new tab, opener removed, current page retained; browser tests pass. |
| H03 | Android Maps/browser resolution and failure | UNVERIFIED | `googleMaps.ts:47-54` delegates HTTPS to OS; rejection tested through an injected opener, not Android package resolution. |
| H04 | Return-to-app state | PARTIAL | Context persists while process lives; no disk restoration after Android process death. Web preservation tested. |
| H05 | Built-in GPS turn-by-turn navigation | MISSING | One-shot GPS only; OSRM requests `steps=false`. No location watcher, maneuver engine, rerouting or active navigation screen. External directions are the supported approach. |
| I01 | Leaflet/OSM and platform renderer isolation | COMPLETE | Web Leaflet; Android bundled Leaflet/WebView; `.native.tsx` remains iOS Apple Maps. Both isolation scripts pass. |
| I02 | Android HTML initialization/lifecycle protocol | COMPLETE | Generations, watchdog, retry/remount, malformed-message rejection and queued camera tested in pure services/browser HTML. Device behavior separately unverified. |
| I03 | Camera, marker stability and tile retry | COMPLETE | Layer identity, popup preservation, mixed tile failures and explicit retries covered by tests. |
| I04 | Low-end-device performance/large geometry | UNVERIFIED | OSRM permits up to 100,000 points per route and three routes; no native memory/frame-time benchmark. |
| I05 | Real GPS accuracy and Android WebView interactions | UNVERIFIED | Accuracy circle and timestamps exist; field accuracy, stale fixes and WebView resume need real-device evidence. |
| I06 | Web map dependency failure recovery | PARTIAL | Failed stylesheet promise stays rejected until page reload; a stalled stylesheet has no deadline. See PF-09. |
| J01 | Demo routes/fares/crowds and labeling | COMPLETE | Three static services share hand-authored geometry (`routes.ts:8-29`); prominent sample/estimate text in maps, cards and Details. |
| J02 | Other advertised demo journeys | PARTIAL | Only first suggested journey is actionable; all others call unavailable, including repeated Antipolo–Anonas entry (`SearchScreen.tsx:41-48,161`). |
| J03 | Live public transport, fares, crowding and traffic | MISSING | No live transit feed. Traffic is available only externally where Google Maps supplies it. Not recommended as an unapproved provider/backend expansion. |

## Validation performed in this audit

| Check | Result | Scope |
|---|---|---|
| TypeScript `npm run typecheck` | PASS | Current tracked snapshot, installed dependencies. |
| `npx --no-install eslint src --no-cache` | PASS | Source-focused. |
| `npm run lint -- --no-cache` | PASS | Existing Expo lint script. |
| `npm test` | PASS: 36 tests | Routing, geometry, selection, GPS deadlines, map session, Photon, Google URL/opener. |
| Playwright | 42 test cases passed; runner teardown status recorded below | Edge, exported Web, synthetic network responses and native Leaflet HTML; not native-device tests. |
| Web export with source maps | PASS | 876 modules; entry about 1.3 MB plus lazy Leaflet about 150 KB, uncompressed export reporting. |
| Android Hermes export with source maps | PASS | 1,408 modules; HBC about 2.6 MB. No Gradle compilation or APK installation. |
| Web and Android map isolation | PASS | Web: 882 source entries without native maps; Android Leaflet/WebView and Android autolinking exclusion verified by scripts. |
| `expo install --check` | PASS | “Dependencies are up to date”; initial sandbox network failure retried with permission. |
| `npm ls --depth=0` | PASS | No missing top-level dependencies reported. |
| `npm audit --json` | FAIL / advisory findings | 29 affected packages: 19 high, 10 moderate, 0 critical. Four underlying advisories; not 29 independent vulnerabilities. |
| Expo config introspection | PASS | Identifies package and generated permissions; not a final merged APK manifest. |
| Additional ambiguous-endpoint probe | CONFIRMED BUG | Both inputs “Central Station”; choose North City; destination chooser absent, one lookup, zero road requests, “Choose different origin and destination points.” |
| Physical Android, current APK installation, live journey driving | NOT RUN | No APK generated. No claim of native runtime acceptance. |

Warnings: Node emits `MODULE_TYPELESS_PACKAGE_JSON` for direct `.ts` unit imports; tools emit `NO_COLOR`/`FORCE_COLOR` notices. Neither failed functional checks. Do not blindly add `type: module`: existing Metro/ESLint and `.cjs` conventions must be checked first. A first browser invocation refused occupied port 8790; the isolated 8891 run avoids accidentally testing an old server.

## External services

| Service | Purpose/location | Keys/billing | Controls, errors and outage behavior | Policy/reliability |
|---|---|---|---|---|
| Photon public API | Names to confirmed coordinates; `placeSearch.ts:5-49`, `SearchScreen.tsx:79-108` | None | Submission only, five candidates, one in flight, starts >=1.1 s apart, 12 s fetch timeout, 30-query/5-minute memory cache including empty results, fixed 60 s HTTP 429 backoff. Error or coordinate input fallback offered; no invented route. | Reasonable public use only, no availability guarantee. Per-device limits do not ensure aggregate capacity. Query text and IP reach operator. [Policy](https://github.com/komoot/photon#demo-server). |
| OSRM public demo | Driving geometry/distance/time; `roadRouting.ts:41-78`, `roadRoutingClient.ts:5` | None | One in flight; 5 s between starts; 15 s timeout; 10-entry/5-minute memory cache; 429 Retry-After/minimum 60 s; no automatic retry. Failure keeps previous valid map. No route near endpoints may fail within 1,000 m snap radiuses. | Public demo, no traffic/transit/fare/crowd guarantees. Coordinates and IP sent on user request. Current endpoint is `router.project-osrm.org`; avoid treating another operator's limits as a contractual SLA. [OSRM policy index](https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy). |
| OSM raster tiles | Map background; `RouteMap.web.tsx:63`, `nativeLeaflet.ts:30` | None | Browser/WebView HTTP caching; no offline packs or bulk download. Mixed failures tracked independently; explicit throttled retry; geometry can remain usable without tiles. | Attribution and identifying native WebView UA present. Verify actual device headers/cache. No SLA; no prefetch/bulk scraping. [Tile policy](https://operations.osmfoundation.org/policies/tiles/). |
| Google Maps URLs | External driving directions; `googleMaps.ts`, `GoogleMapsButton.tsx` | No Cloud key or billing integration | `api=1`, encoded origin/destination, `travelmode=driving`; Android HTTPS OS resolution, Web tab; errors visible. Stale/missing current GPS origin omitted so Google may determine location. No automatic Start claim, no route-alternative ID. | Google chooses its own route and available traffic estimates. OS defaults may choose browser even when Maps is installed. [Official URLs guide](https://developers.google.com/maps/documentation/urls/get-started). |
| Expo Location | One-shot device coordinates; `useCurrentLocation.ts:6-12`, `locationAcquisition.ts:9-38` | No app API key/billing | User-initiated foreground permission, services check, Balanced accuracy, 25 s UI deadline across operations. Underlying call cannot be cancelled; lock persists until it settles. Failure permits manual search. | Accuracy and completion depend on device/OS. No background or continuous tracking. [SDK 57 Location](https://docs.expo.dev/versions/v57.0.0/sdk/location/). |

## Architecture, dependencies and code quality

Two conceptual Router destinations: `/` and `/search`. `search.android.tsx` exports the custom native transition; `search.web.tsx` owns browser entry/exit animation; fallback `search.tsx` handles other native platforms. Find/Results/Compare/Confirm are phases of one `RouteDiscovery` modal, not duplicate screens. Details/Menu/Profile are Home modals.

`PrototypeState` holds input strings, demo selection/direction/preference, mode, road selection/list and GPS entirely in React context. `SearchScreen` separately holds phase, request guards, local road choices and a query-keyed confirmation map. This split preserves displayed results but causes PF-01 and repeated confirmation on Search remount. Typed endpoint state would be safer than label-keyed storage.

Installed main versions: Expo 57.0.27; React Native 0.86.3; React/DOM 19.2.3; Router 57.0.25; TypeScript 6.0.3; Leaflet 1.9.4; WebView 13.16.1; SVG 15.15.4; React Native Web 0.21.3; screens 4.26.2; safe-area-context 5.7.0; Playwright 1.64.0. The SDK 57/RN 0.86/React 19.2 family is supported by the [versioned SDK reference](https://docs.expo.dev/versions/v57.0.0/), and the installed compatibility check passes.

No broken source imports or TODO/FIXME/HACK markers were found in authored source (vendored Leaflet excluded). Placeholders exist without TODO tags. `src/assets.ts:1-15` has no consumers found in application code; it retains Figma assets for reference. `react-native-maps` is intentionally used by the iOS fallback, not simply unused. No authored imports were found for `expo-status-bar`, Reanimated, gesture-handler or worklets; some may satisfy navigation/toolchain requirements, so verify dependency graphs before removal. `expo-constants` and `expo-asset` may be needed by packages/plugins despite no direct UI import.

Three separate inline icon maps/Button styles and repeated color/font constants exist in Home, Search and Discovery. Scope styling is intentional to protect approved screens, but future changes should avoid palette drift. Do not begin the handover with a broad refactor. `routeCoordinates` is test-used but not map-used; geometry reversal is duplicated across map platforms. Android Leaflet JS/CSS and Web assets are vendored separately; upgrades require synchronized regeneration and license retention.

No persistent storage, backend, auth flow, saved-route screen, navigation watcher or database was found. No engine/package-manager pin or CI workflow is tracked. Existing README and Android artifact documentation are historical and partly stale; do not use them as proof of current APK contents.

## Security review

Pattern-based inspection of authored source/config/example environment files found no hardcoded credential or private-key matches. EAS owner/project UUID/package ID are identifiers, not secrets. This is not a complete Git-history or secret-scanner audit. Runtime service URLs are HTTPS. Endpoint labels go through React text or DOM `textContent`; external parameters use encoding. Android bridge selection checks generation and known route IDs, and WebView navigation is allowlisted despite `originWhitelist=['*']`. Web GPS in the embedded document is disabled.

`npm audit` identifies these installed roots:

| Package / lockfile anchor | Finding | Assessment |
|---|---|---|
| `braces` 3.0.3, `package-lock.json:4026` | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), nested-pattern DoS | High registry severity; primarily inspect Metro/build-tool input exposure. |
| `decode-uri-component` 0.2.2, `package-lock.json:4691` | [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr), malformed-encoding DoS | Moderate; URL parsing dependency requires runtime/deep-link reachability review. |
| `node-forge` 1.4.0, `package-lock.json:9062` | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), signature verification issue | High; inspect Expo tooling/signing usage, not an established PATHFINDER exploit. |
| `uuid` 7.0.3, `package-lock.json:11790` | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq), buffer bounds | Moderate; xcode/config-plugin chain. No application call demonstrated. |

Registry suggestions include Expo 44.0.6 and older RN-related versions. These are not an acceptable automatic fix for SDK 57. PF-02 requires dependency-path triage and an SDK-compatible remediation/acceptance decision. No exploit attempts or package changes were made.

Race defenses are present for route/geocoder responses, GPS deadlines, Web exit animations and stale WebView generations. Leaving Search suppresses state changes but does not abort the request, so it may still consume resources/cache a result. GPS can remain locked indefinitely if its OS promise never settles. These are documented limitations, not demonstrated memory leaks. Large route payloads require device profiling.

## UI/UX review

Existing black/green palette, Inter typography, rounded cards and scoped styles remain coherent. Results prioritize duration, selected cards include a check and accessible selected state, and demo metrics are separated from road estimates. Buttons generally have 48–54 unit minimum heights. Search and discovery scroll; safe-area wrappers and reduced-motion hooks exist. Review of the 320 px/2x browser comparison screenshot showed wrapping and scrollable content; this is a CSS approximation, not Android font scaling or TalkBack acceptance.

Gaps: fixed-height Home sheet/title truncation needs enlarged-text device review; Details/Profile/Menu overlays lack a demonstrated focus-restoration test; map pins are small targets; no live contrast audit; place candidates can have identical labels without a coordinate disambiguator; confirmation repeats when Search is remounted; no Web stylesheet timeout; Home has a placeholder greeting; generic “Finding driving routes” also covers geocoding. These do not justify redesigning approved screens. Improve behavior and accessibility within existing styling.

## Android readiness

App `PATHFINDER`, package `com.pathfinder.prototype`, version `1.0.0`, portrait/dark, URL scheme `pathfinder`. EAS owner `proxywise2`, project `19e182a0-9950-41af-87f3-1fc50d50b83d`; `preview` is internal distribution with `android.buildType='apk'`. No explicit custom icon/adaptive icon or Android versionCode is configured. No local `android/` or `ios/` directories are tracked; use CNG/config plugins, not manual native edits.

Location plugin explicitly disables background location and foreground service. Introspection includes INTERNET, foreground coarse/fine location, VIBRATE, SYSTEM_ALERT_WINDOW, and READ/WRITE_EXTERNAL_STORAGE limited to SDK <=32. Those additional permissions are generated defaults/dependencies, not evidence the app requests them at runtime; review the final merged manifest before release and remove unnecessary permissions through supported config. No background location permission appeared in introspection.

No source/export blocker to preparing an internal test APK was found. That is a **conditional test-readiness assessment**, not installation/startup certification. Remaining gates: PF-01, advisory triage, actual signed build for this commit and physical-device checklist. Prior APK links in historical documents cannot certify the current user-defined search code. Android Maps fallback, permission UX, process death, System WebView versions, gesture Back and low-end memory remain unverified. No APK was generated during this audit.

Read [MISSING-FEATURES.md](MISSING-FEATURES.md), [DEVELOPMENT-ROADMAP.md](DEVELOPMENT-ROADMAP.md), [DEVELOPER-HANDOVER.md](DEVELOPER-HANDOVER.md) and [ANDROID-TESTING-CHECKLIST.md](ANDROID-TESTING-CHECKLIST.md) for action items.
