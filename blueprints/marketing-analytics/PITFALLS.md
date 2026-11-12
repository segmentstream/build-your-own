# Pitfalls

Mistakes already made building this kind of software on the platform. Each one is easy
to repeat.

## 1. Sessions and costs on different calendars

- **Symptom**: ROAS swings between neighbouring days; late-evening paid sessions never
  match a cost row; daily totals differ from the ad platform's by a constant shift.
- **Cause**: sessions were dated in UTC while the ad accounts report days in their own
  time zone, so same-day stitching compared different days.
- **Instead**: one reporting calendar in the ad accounts' time zone for every daily asset,
  local dates computed in the warehouse with the zone, never in UTC by default.

## 2. Current-state ad reports stored as dated history

- **Symptom**: campaign names and settings jump around in old reports; deleted ads come
  back; a budget "history" that never changes.
- **Cause**: campaigns, ad groups, ads and budgets were loaded into daily partitions
  labelled with the run date, because the query carried a date filter. These reports
  return current state whatever the filter.
- **Instead**: decide the mode from what the provider returns, not from the filter. Load
  current state as SnapshotHistory scoped by account and read the latest successful
  capture per account through the snapshot ledger, empty captures included. Selecting the
  latest non-empty rows resurrects deleted entities.

## 3. Money that quietly becomes a float

- **Symptom**: spend columns turn up as `FLOAT64` in the warehouse; totals differ from
  the platform by fractions that grow with volume.
- **Cause**: an Ibis division (micros to currency, cost spread over rows) compiled to
  floating-point division even inside a decimal cast, and the expression type hid it.
- **Instead**: divide with explicit decimal operands (a typed `SAFE_DIVIDE` on `NUMERIC`
  through an Ibis builtin), keep `decimal(38, 9)` in Silver schemas, round once to
  integer minor units in gold, map those with `p.integer` (never `p.number`), and check
  the physical type of each money column after the first run.

## 4. Costs multiplied by joins

- **Symptom**: spend in reports is higher than in the ad platform, sometimes by a whole
  multiple for some campaigns.
- **Cause**: cost rows were joined to keyword, creative or URL tables with more than one
  row per ad and day.
- **Instead**: aggregate each side to the cost grain before joining, test that spend per
  account and day equals the account total, and compare a week with the platform's own
  report after the first real run.

## 5. Treating a missing zero row as missing data

- **Symptom**: campaigns vanish from day-level reports; a "fix" inserts rows of zeros;
  row counts change when a date column is added to a report query.
- **Cause**: date-segmented ad reports omit rows whose metrics are all zero.
- **Instead**: take the list of campaigns from snapshots, take metrics from the dated
  report, and never fabricate zero rows or treat their absence as a failed extract.

## 6. Manager accounts and accounts nobody listed

- **Symptom**: the cost extract fails with a manager-account error, or silently covers
  accounts nobody meant to include.
- **Cause**: a manager account was queried for metrics, or its child accounts were
  expanded automatically.
- **Instead**: list the accounts that spend explicitly in config, use the manager only
  as the login account, and replace by account scope so an empty account clears only
  itself.

## 7. Backfills that overload a provider connection

- **Symptom**: a long cost backfill fails with proxy-unavailable or rate-limit errors,
  restarts whole days, and takes hours.
- **Cause**: hundreds of daily steps hit one connection at once, and a failure retried a
  whole day's pages.
- **Instead**: put each provider's ingestions in a concurrency pool, backfill in bounded
  date ranges, keep pages small, and retry a page on a transient error before failing
  the step. Know the provider's history limits: Google keeps click-level reports for
  about 90 days, so older sessions can stitch only by UTMs and IDs.

## 8. Reading the capture table like an ordinary table

- **Symptom**: models fail on a missing partition filter, or late browser beacons never
  appear, or one event shows up twice.
- **Cause**: the capture table is partitioned by receipt time and keeps every retry as
  its own capture; the model filtered by event time or by date alone.
- **Instead**: bound every read by receipt time, wider than the event days, then compute
  the reporting date and collapse retries by `event_id`.

## 9. Prefetches and app fetches counted as page views

- **Symptom**: page views and server hits far above real traffic, many with no browser
  page view; sessions with dozens of hits in a second.
- **Cause**: the middleware sent an `http_request` for every request, including router
  prefetches, React Server Component fetches and assets.
- **Instead**: send server events only when `isDocumentRequest` is true and the path is a
  page, and test it against a prefetch, an RSC request and an image request.

## 10. One shared value merging strangers

- **Symptom**: a "person" with thousands of browsers and conversions from every channel.
- **Cause**: an identity key that many visitors share: a test email used by the team, a
  hash of an empty string, a placeholder user ID, a click ID in a link someone posted
  publicly, or a Google aggregate parameter (`gbraid`, `wbraid`) used as a click ID.
- **Instead**: drop placeholder values at extraction, enforce per-key fan-out limits that
  exclude the whole value, keep `gbraid` and `wbraid` out of identity keys, and read the
  identity diagnostics after every policy change.

## 11. An identity key read from the wrong field

- **Symptom**: the identity graph runs green, but coverage for a key is zero and no two
  browsers are ever linked.
- **Cause**: the extractor read a field name the events never contained, so every value
  was null and nothing failed.
- **Instead**: check coverage per key in the diagnostics after the first run; a key with
  zero coverage is a bug, not a quiet week.

## 12. First run of a history-wide model over one day

- **Symptom**: identity, counting or attribution finds almost nothing, or a coverage check
  fails, right after the first deploy.
- **Cause**: global models read all retained partitions, but only today's had been built;
  `AllPartitions` does not build missing days.
- **Instead**: backfill every daily asset over all retained days first, starting earlier
  than the first conversion by the attribution window when history exists, then run the
  global models once.

## 13. Sample rows left behind after switching to real data

- **Symptom**: reports show round invented numbers on old days, or a campaign called
  "Northwind" in production.
- **Cause**: the sample adapter was replaced by the real one, which rebuilt only the days
  of its first run.
- **Instead**: backfill every retained date when switching adapters, and keep the
  `no_sample_rows` check.

## 14. Declaring parity from a tolerance

- **Symptom**: the migration is signed off "within 5%", then a channel turns out to be
  missing, or numbers drift apart a month later.
- **Cause**: totals were compared with a tolerance, across different time zones or
  snapshots taken at different times, and structural differences (session rules, bot
  filtering, consent modeling) were never separated from defects.
- **Instead**: compare the same days, in one time zone, from inputs taken at comparable
  times; give every difference a cause and record it as a `parity_finding` annotation;
  decide deliberately, and in writing, whether to reproduce or fix each quirk of the
  previous tool.

## 15. Columns the warehouse reserves

- **Symptom**: an ingestion fails before loading with an invalid field name, then retries
  the same deterministic error.
- **Cause**: a column named like the warehouse's pseudo-columns, such as `_PARTITIONTIME`
  or anything starting with `_PARTITION`, `_TABLE_` or `_FILE_`.
- **Instead**: never start your own column names with an underscore followed by those
  words; keep extraction metadata as plain names such as `extracted_at`.
