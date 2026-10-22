# Transit data assessment — Phase 3 Task 2

Inspected 2026-10-22. Operating area inferred from the application's existing
SM City Masinag–Cogeo Gate 2 sample corridor (Antipolo, Philippines).

## Current architecture

`data/routes.ts` contains three hand-authored service examples sharing illustrative
geometry. IDs, modes, times, fares, crowd values and transfer counts are samples.
There is no stop model, stop sequence, boarding/alighting evidence, schedule or
transit provider. Journey endpoints are not verified transit stops.

`RoadRoute` is separate from the legacy sample `Route`. OSRM supplies driving
geometry, distance and duration; Photon supplies place search, not transit service.
GPS supplies device position, not transit coverage. Leaflet renders either model;
displayed lines and Google Maps driving handoff do not validate a transit itinerary.
Saved/history/recovery snapshots preserve the existing road/demo distinction.

## Sources evaluated

| Source | Coverage / reliability | License, cost, keys | Integration decision |
| --- | --- | --- | --- |
| [Sakay historical GTFS](https://github.com/sakayph/gtfs) | Manila jeepney, bus and rail; historical routes include Cogeo–Cubao. The published [calendar](https://raw.githubusercontent.com/sakayph/gtfs/master/calendar.txt) ends 2020-06-30. Current corridor operations/stops not verified. | Public raw files need no API key; [DOTC developer agreement](https://raw.githubusercontent.com/sakayph/gtfs/master/LICENSE.md) imposes conditions, rather than an unrestricted open-data license. | Do not ship old feed as current service. Requires validated current feed and license review. |
| [TUMI Manila catalogue](https://hub.tumidata.org/dataset/gtfs-manila) | Lists the same Sakay GitHub source. Catalogue update date does not establish updated service validity. | Catalogue lists Creative Commons Attribution; reconcile with upstream DOTC terms before redistribution. | Not independent proof of current data. |
| [BusMaps corrected Manila feed](https://busmaps.com/en/philippines/LTFRB-Philippines/metro-manila) | Advertises 698 routes, 5,736 stops, October 2026 update and active calendar; also reports stop/shape warnings. Actual Masinag–Cogeo coverage not independently inspected. | Delivery requires a project request and quotation; no verified free downloadable feed, reuse grant or keyless application API established. | Excluded under no-paid-API restriction; no access request made. |
| [OpenStreetMap transit relations](https://wiki.openstreetmap.org/wiki/Tag:route%3Dbus) / [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API) | Can describe mapped stops and route relations, not prove present service, complete stop ordering, schedules or transfers. Local completeness/currentness not established. | [ODbL](https://www.openstreetmap.org/copyright), attribution/share-alike obligations; public Overpass instances have usage/resource constraints, not a production SLA. | Possible future mapped-stop inventory, explicitly distinct from trip planning; requires local validation and bounded queries/caching. No runtime requests added. |
| [Transitous](https://transitous.org/sources/) | Published source list had no Philippines match at inspection. | Public service alone does not establish local coverage or per-feed licensing. | No verified local coverage. |
| [Transitland](https://www.transit.land/documentation/rest-api) | Feed registry/API; current local coverage still requires feed validation. | API key and plan quotas; source-specific data licensing remains relevant. | No configured key or validated free local feed. Not integrated. |
| [OpenTripPlanner](https://docs.opentripplanner.org/en/latest/Basic-Tutorial/) | Routing engine consuming GTFS and OSM; does not supply local transit data itself. | Open-source engine requires graph building/hosting and maintained input feeds. | Hosting conflicts with this task's no-backend scope; does not solve missing data. |

Conclusion: no candidate was verified to satisfy current local coverage, reliable
service/stop evidence, accessible free delivery and usable licensing together.
This is a limited integration assessment, not a claim that no suitable feed exists.

## Implemented fallback

Keep sample discovery and existing journey/map behavior. Show visible demo labeling,
unverified-stop/transfer disclosures, and distinguish unsupported demo searches from
an assertion that there is no real public transport. No speculative provider
interface, stops, schedules, API calls or provider loading states are introduced.

## Gate for a concrete provider integration

- Obtain a maintained, permitted feed/service for the intended operating area;
  verify attribution, redistribution, cost, key exposure, CORS and update policy.
- Validate GTFS agency, routes, stops, trips, stop_times and service calendars
  against the [specification](https://gtfs.org/documentation/schedule/reference/).
  Namespace identities by provider/feed, never display name; reject missing IDs,
  invalid coordinates, broken references, duplicate conflicting records and
  expired/incompatible feeds. Verify actual corridor stop sequences and modes.
- Only display boarding/alighting, geometry and transfers when evidenced by the
  source. Keep scheduled, historical and real-time data explicitly distinct.
- Introduce a source-specific adapter then, with bounded timeout/cancellation,
  unavailable/empty/error states and no fallback from road routing to transit.
- Add real-adapter malformed-data, stop identity, empty coverage, provider error
  and timeout tests. These are not executable provider scenarios in this fallback:
  no adapter or provider requests exist. Existing OSRM/Photon timeout tests remain.
- Preserve current road IDs/ranking and independent storage behavior; define
  versioned snapshot changes before persisting a new verified transit model.

Task 3 can proceed on independent features. Production transit discovery remains
blocked on provider/data verification; no live arrivals, verified fares or crowding
are implemented by this task.
