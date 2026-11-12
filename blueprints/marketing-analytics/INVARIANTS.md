# Invariants

Each rule holds in every version. Write each test with invented data (Northwind visitors,
`example.com` pages, documentation IP ranges) as [testing](../../docs/testing.md)
describes, and name it after its rule: `marketing-analytics 3. a retried event counts
once` (in pytest, `test_marketing_analytics_03_retried_event_counts_once`).

- **Pipeline rules** run at M1 on DuckDB with the kernel harness,
  [`kernel/pipeline/tests/warehouse_harness.py`](../../kernel/pipeline/tests/warehouse_harness.py):
  call each model through its declaration (`model.function(...)`) on tables from
  `table(con, rows, schema)`, pass `warehouse` where a model runs
  `warehouse.iterate` or `warehouse.execute`, and compile it with `bigquery_sql` too.
  A model that calls `JSON_QUERY_ARRAY` needs its DuckDB macro in that test
  ([pipeline notes](../../docs/pipeline-notes.md#ibis-that-runs-on-bigquery-and-duckdb)).
- **Ontology rules** run at M1 on the ontology harness; metric queries run at M2.
- **Site rules** (1 and 2) are tested in the site's repository, or in
  `site-integration/` when the agent wrote the site's code there (BLUEPRINT 6.2).
- [`fixtures/`](fixtures/) is one invented day with its expected sessions, stitching,
  conversions and attribution. Run it as one more test; it covers parts of 6, 8, 14, 18,
  22 and 26 together.

Where part of a rule can only be checked at M2 or later, the rule says so; test the rest
at M1.

## Collection

1. **The browser never holds the stream's write key.**
   - Why: a key in the browser lets anyone forge server evidence and conversions.
   - Test: build the site and search the client bundle and every `NEXT_PUBLIC_*` variable
     for the write key's variable name and value; expect no match. Expect the browser
     tracker's options to carry no key (`createBrowserTracker` takes none). Where the
     site cannot be built here, check every client module (`"use client"`) for the key's
     variable name and for an `Authorization` header, and that the module reading the key
     imports `server-only`.

2. **No raw email address enters an event stream.**
   - Why: identity uses a hash; a raw address in the warehouse is personal data nobody
     asked for.
   - Test: the site's server helper given `" Ada@example.com "` sends
     `email_sha256 = sha256("ada@example.com")` and no field containing `@`.

3. **A retried event counts once.**
   - Why: lost acknowledgements make senders retry with the same `event_id`.
   - Test: two captures with one `event_id` received a minute apart yield one row in
     `web_events`, carrying the earlier capture's `received_at`. Build the captures as rows
     of the capture table (`event_id`, `event_type`, `event_time`, `received_at`,
     `capture_id`, `auth_mode`, `body` as JSON) and run the real adapter on them.

4. **Request evidence comes only from write-key captures.**
   - Why: browser-admitted events can claim any IP or user agent.
   - Test: an origin-admitted `page_view` whose body carries `payload.visitor.ip` yields a
     `web_events` row whose `ip` is null, and a hit whose `ip` is null unless a paired
     server request supplies one. (The collector also drops that `visitor` object; the
     adapter must not rely on it.)

## Hits and sessions

5. **Each server request pairs with at most one page view, and each page view with at
   most one request.**
   - Why: double pairing duplicates hits and miscounts pages without JavaScript.
   - Test: two page views with the same path and anonymous ID within one second and one
     server request produce one `matched` hit and one `client_only` hit.

6. **Every hit belongs to exactly one session, and no session crosses a reporting day.**
   - Why: daily tables are replaced per day; a session spanning midnight would be
     counted twice or lost.
   - Test: hits at 23:59 and 00:01 reporting time for one visitor, same signature, give
     two sessions on two dates; the sum of `hits` over sessions equals the hit count.

7. **A null anonymous ID never merges hits.**
   - Why: grouping nulls turns every cookieless visitor into one giant session.
   - Test: three hits without anonymous ID produce three sessions.

8. **A session starts exactly when the acquisition signature changes.**
   - Why: this is the session definition every report and parity explanation relies on.
   - Test: visitor hits: newsletter UTM, internal page, direct page an hour later, a
     `gclid` landing, then the newsletter UTM again → three sessions: newsletter,
     paid search, newsletter.

9. **An internal referrer is never an acquisition signal.**
   - Why: navigation between the company's own domains would otherwise split sessions
     and steal credit.
   - Test: a hit from `www.example.com` with referrer `blog.example.com` inherits the
     previous signature; a first hit of the day with that referrer is `(direct)`.

10. **AI fetches count only when the vendor's published IP list verifies them.**
    - Why: user agents are free text; spoofed crawlers would inflate the agent report.
    - Test: a hit with an assistant's user agent from an IP outside a fresh vendor list
      (snapshot within 60 days before the hit's date) is classed `spoofed` and not
      counted in `verifiedFetches`; with a stale list, or with no IP (IP capture off), it
      keeps its declared class with verification unknown, is not counted, and is never
      `bot`.

## Identity

11. **A key value shared by more visitors than its limit links no one.**
    - Why: a shared value (a test account, a public link with a click ID) would merge
      strangers.
    - Test: one `gclid` on six anonymous IDs with a limit of five produces no link; on
      five it links them.

12. **A component never holds two values of an exclusive key.**
    - Why: two signed-in users must never become one person through a weak bridge.
    - Test: A (`user_id` u1) –click– B –click– C (`user_id` u2) leaves A and C in
      different persons.

13. **Probabilistic keys link only within their window.**
    - Why: a click ID seen again weeks later is more likely a shared URL than one person.
    - Test: one `gclid` seen on two visitors three days apart with a one-day window gives
      no link; on the same day it gives one.

## Conversions and attribution

14. **A business occurrence counts at most once under its policy, and suppressed rows stay
    visible with zero credit and a reason.**
    - Why: duplicates inflate conversions; hiding them makes the count unexplainable.
    - Test: the same `submission_id` twice yields one row with credit 1 and one with
      credit 0 and `duplicate`. With `occurrence_after_days(30)`, observations of one ID
      on days 0, 20 and 40 count on days 0 and 40.

15. **Conversion instance IDs do not change when unrelated data changes.**
    - Why: attribution rows, journeys and links refer to them.
    - Test: rebuild after adding a later, unrelated conversion and after an identity
      merge; existing `conversion_instance_id` values (`<name>|<observation_id>`) are
      unchanged.

16. **Per model and conversion, weights are finite, non-negative and sum to one, or
    nothing is published.**
    - Why: a bad plugin would silently create or lose conversions.
    - Test (M1): the allocation model, given a plugin returning weights 0.6 and 0.6 for
      one conversion, raises before it returns a table; so does a plugin returning a pair
      that is not a candidate, and one returning a NaN or negative weight. A valid plugin
      returns a table. (M2) A run with the failing plugin fails, and the published table
      keeps its previous rows.

17. **Only sessions of the same person, from human, agent or unverified traffic, inside
    the window and not after the conversion, are candidates.**
    - Why: crediting bots, other people or later visits is wrong attribution.
    - Test: for a conversion at day 0 with a 90-day window: sessions at day −90 and day 0
      are candidates; day −91, day +1, a bot session and another person's session are not.

18. **Attributed credit never exceeds counted credit, and the difference is reported as
    unattributed.**
    - Why: reports must reconcile with the conversion totals.
    - Test: with one counted conversion that has no eligible session (no anonymous ID),
      per model `sum(credit)` in `attribution_report`, `(unattributed)` rows included,
      equals `sum(credit)` in `conversion_report` for the same conversion and dates, and
      the conversion has one `(unattributed)` row per model.

## Costs and stitching

19. **Every cost adapter writes the identical contract; money is never a float.**
    - Why: a drifting adapter drops columns or turns money into floats.
    - Test: the import-time assertion fails when a fixture adapter adds a column or
      declares `spend` as `float64`; `cost_data`'s `spend` compiles to BigQuery `NUMERIC`
      and its SQL has no `FLOAT64`; gold money columns are `INT64` minor units beside a
      lowercase currency (`12.345` USD becomes `1234`, `100` JPY stays `100`, `0.125`
      EUR becomes `12`).

20. **Spend per account and day in `cost_data` equals the platform's account total.**
    - Why: joining costs to keywords, creatives or URLs multiplies rows.
    - Test (M1): for each real adapter, run its transformation on invented report rows in
      which one ad has two keyword rows and two creatives; the ad keeps its spend once,
      and the account-day sum equals the fixture's account total. For the sample
      adapters, `ad_cost_daily` per account and day equals the invented totals, and so
      does `stitching_diagnostics` when two sessions match the same ad. (M3) After the
      first real run, a week of spend per account and day equals the platform's own
      report.

21. **Stitching matches only same-date cost rows, never by name, and a key found on two
    platforms matches nothing.**
    - Why: names are reused and change; cross-platform keys are ambiguous.
    - Test: a session whose UTM campaign equals a campaign name on another day, or a UTM
      tuple present on both platforms, is unmatched with a diagnostic.

22. **Stitching and identity never remove a session or a conversion.**
    - Why: unmatched data is still data; dropping it hides tracking problems.
    - Test: `session_report` and `stitched_sessions` have exactly as many rows as
      `sessions`; `conversion_report` as many as the union of counted conversion tables.

## Reporting

23. **Numbers are never added across currencies, attribution models or distinct counts.**
    - Why: those sums are meaningless and look plausible.
    - Test (M1): no gold table stores a distinct count (`visitors`, `people`, `users`);
      in the manifest (`npx segmentstream-ontology check --manifest`), every metric with
      unit `currency` belongs to an entity whose source declares `currency`, every metric
      on `attributedConversion` filters both `model` and `conversionName`, and `visitors`
      and `people` are `countDistinct`. On `session_report` rows, the distinct visitors of
      two days with one returning visitor are fewer than the sum of each day's.
      (M2) A metric query for `adCost.spend` without a currency filter or grouping is
      refused, and `webSession.visitors` for those two days is 1, not 2.

24. **One source per day: imported history and tracker data never both count for a date.**
    - Why: overlap doubles sessions and conversions around the cutover.
    - Test: with cutover day D, GA4 rows dated D and tracker rows dated D−1 are excluded
      from `hits`. Only for builds with the `ga4_history` import (VARIATIONS.md,
      "Migration"); otherwise record it as not applicable.

25. **No sample row survives once real adapters are registered.**
    - Why: invented rows mixed into real reports are invisible and wrong.
    - The check enforces only once real adapters are registered: `definitions.py` holds
      `REAL_ADAPTERS` beside the adapter choice and passes it to the `no_sample_rows`
      factory as `enforce=`. With sample adapters, every row is a sample row and the
      check passes, recording the count.
    - Test (M1): with `enforce=True`, the check's function fails on a table with one
      `adapter = 'sample'` row and passes on one without; with `enforce=False` it passes
      on both. (M3) After switching to real adapters and backfilling every retained date,
      the deployed check passes.

## Stitching precedence

26. **A session with a matching click ID is matched by `click_id` first.**
    - Why: the click ID names the exact ad group and ad; a later strategy would credit a
      coarser or wrong ad. A NULL flag in the ranking silently lets a later strategy win.
    - Test: a session with `gclid` in `click_view` and UTMs whose tuple and `utm_id` also
      match a cost row of that day is matched with `match_strategy = 'click_id'` and the
      click view's ad group and ad. A `gclid` with two ad identities in `click_view` gives
      `conflicting_click_id`, and no other strategy matches that session.
