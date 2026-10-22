# Crowding and transportation information — Phase 3 Task 4

## Evidence and classifications

| Information | Existing evidence | Classification |
| --- | --- | --- |
| Transit crowd labels/ranks | Three hand-authored samples, no observations | Demo when recognized label/rank agree; otherwise unavailable |
| Transit service names, modes, travel time, transfer counts | Hand-authored examples, no operator verification | Demo for valid fields |
| Suggestion modes/times/prices | UI examples, including unsupported destinations | Demo, not verified service coverage |
| Road duration/distance and driving profile | Existing OSRM driving request/model | Estimated road information, no live traffic or transit inference |
| Road alternative labels | Application-generated labels | Not operator service identities; transit service unavailable |
| Stops, boarding/alighting, waiting time, frequency, schedules, operating hours | No provider or validated calculation | Unavailable |
| Live crowding, vehicle occupancy, transport conditions | No provider or validated method | Unavailable |

Verified requires current reliable provider evidence. Estimated requires a documented,
validated method. Neither classification is assigned to sample crowding or transit
service data. Fare classifications and existing transit disclosures remain separate.

Crowding is displayed as text, never color alone, with accessibility hints on route
selection controls. Invalid/missing/unknown levels or inconsistent ranks display
Crowding unavailable. Only compatible demo levels may participate in the explicitly
labeled demo comparison. Mixed reliability is rejected, and missing values are never
treated as uncrowded. OSRM ranking continues to use duration/distance independently.
The existing Less Crowded storage preference key is retained; its UI is Demo crowding.

Shared summaries apply the labels to maps, saved/history lists and restored details.
Transfers in stored details are labeled sample, not validated connections. No storage
keys, schemas, snapshot data, identities or mutation behavior changed. Viewing prior
records does not turn them into current observations or cause a provider request.

No new provider or interface is introduced. A future provider must establish service
identity, geographic coverage, licensing, observation time/expiry, source, measurement
method and uncertainty before enabling verified/estimated occupancy, waiting-time or
frequency features. Historical observations must keep their original provenance and
time; schedules must not be represented as actual arrivals. Native screen-reader and
physical-device verification remain separate release checks.
