# Fare information — Phase 3 Task 3

Existing transit fares (PHP 18/25/35) in `data/routes.ts` are hand-authored samples,
not official prices. No fare formula, authoritative source or effective date exists.
Search suggestion rows also contain hard-coded sample prices (including rail/car
examples); these now use the same explicit Demo fare label and peso formatter.
OSRM driving estimates contain no transit fare, fuel, toll or booking price.

## Classification and display

- **Verified fare:** requires authoritative current evidence; not currently supplied.
- **Estimated fare:** requires documented validated calculation rules and assumptions;
  not currently supplied. A sample is never promoted to an estimate.
- **Demo fare:** valid nonnegative finite sample amounts, displayed with ₱ and PHP
  currency semantics. Zero is a zero-valued sample, not a promise of free travel.
- **Unavailable:** road costs, missing, malformed, negative or numerically unsafe
  amounts. No substitution with zero, no invented fuel/toll costs.

Classification is derived at display time for existing road/demo models, including
saved/history/restored snapshots; no persistence schema or identity changes.
Reserved verified/estimated classification names do not enable a provider. Unsupported
classifications display unavailable and cannot be compared by the demo comparator.

Formatting and differences use rounded cent amounts. Only valid PHP demo values are
compared, against the lowest sample amount in the displayed alternatives. Ties are
explicit. Single valid values have no comparative rank. Mixed reliability/currency
groups are not compared. Labels always say demo, never official savings or payment.
The historical `Cheapest` preference key remains for storage compatibility; its UI
is now Demo fare / Sort by lowest demo fare. Invalid sample amounts sort last.

## Authoritative provider requirements

A concrete integration must supply transport mode; stable provider/route/service
identity; fare amount or validated calculation rules; currency and rounding rules;
effective dates/time zone and expiry; source identity/URL, licensing and attribution;
applicable geography, direction, distance/stages, boarding/alighting, transfers,
discount eligibility and exclusions (such as tolls, surcharges or booking fees).
Estimates additionally need reproducible assumptions, formula version and input
validation. Currentness must be checked before displaying Verified fare. Historical
records must retain original provenance/dates and never become live quotes.

No provider interface is introduced without an actual source to integrate. When one
exists, define explicit comparability by currency, validity period, passenger class,
coverage and assumptions; do not mix official and demo prices. Add source validation,
expiry, errors and lifecycle tests before enabling verified/estimated comparisons.
