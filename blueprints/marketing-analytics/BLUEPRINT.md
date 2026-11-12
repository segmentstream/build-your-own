# Marketing analytics

## 1. Purpose

Show a company where its visitors come from, what its advertising costs and which
channels and campaigns produce conversions, from data it collects and owns. One chain
covers web, product and marketing analytics: own tracker → events → sessions → identity
graph → ad costs stitched to sessions → conversions → attribution → reports and metrics,
plus which AI agents and bots read the site. SegmentStream runs this design in production
on its own website and for customers.

## 2. Records (ontology)

Almost everything is computed, so it lives in the warehouse; read-only warehouse-backed
entities with metrics let the app, the agent and MCP clients ask for numbers by name. One
stored entity holds what people decide. IPs, user agents and email hashes stay in Silver.

| Entity | Source | One record is |
| --- | --- | --- |
| `webSession` | `gold/session_report` | One session of one visitor |
| `campaign` | `gold/campaigns` | One ad campaign as its platform currently describes it |
| `adCost` | `gold/ad_cost_daily` | What one ad cost on one day |
| `conversion` | `gold/conversion_report` | One conversion occurrence, counted or not |
| `attributedConversion` | `gold/attribution_report` | The credit one model gave one session for one conversion |
| `agentVisit` | `gold/agent_visits_daily` | Hits by one AI agent or crawler on one page on one day |
| `parityResult` | `gold/parity_daily` | One metric compared with the previous tool for one day |
| `annotation` | stored | A dated note on the reports, written by a person |

### webSession

`source: warehouse("gold/session_report", { key: ["session_id"] })`.

| Property | Type | Meaning |
| --- | --- | --- |
| `sessionId`, `sessionDate` | text, date | The first hit's ID (stable); start day in the reporting time zone. |
| `visitorId`, `personId` | text | The browser's anonymous ID (null when none); its person in the current identity snapshot, not permanent. |
| `startedAt`, `endedAt`, `hits`, `isFirstSession` | timestamp, integer, boolean | First and last hit (UTC), hit count, the person's earliest retained session. |
| `channelGroup`, `source`, `medium`, `utmCampaign` | text | Acquisition, by the rules in 6.6. |
| `clickIdType`, `landingPath`, `referrerHost`, `country` | text | Click ID type (never the value), first page, external referrer, ISO country. |
| `trafficGroup`, `trafficClass` | text | Who made the hits (6.5). |
| `adMatched`, `matchStrategy`, `campaignKey` | boolean, text | Stitching result (6.9); null when unmatched. |

Relationship `campaign` on `campaignKey`. Metrics: `sessions`, `newPeople` (count where
`isFirstSession`), `visitors` and `people` (`m.countDistinct`; non-additive, as described).

### campaign, adCost

`campaign` (key `campaign_key` = `platform:account_id:campaign_id`, latest snapshot):
`platform`, `accountId`, `campaignId`, `name`, `campaignType`, `status`, `channelGroup`.
Names describe, keys identify; others reach `campaign.name` through `campaign`.

`adCost` (key `cost_key`, `currency: "currency"`): `date` (the ad account's day),
`platform`, `accountId`, `campaignKey`, `adGroupId`, `adId`, `channelGroup`, `currency`,
`spendMinor`, `impressionCount`, `clickCount`. Metrics: `spend` (currency),
`impressions`, `clicks`, `cpc` and `cpm` (currency), `ctr` (ratio). Each platform counts
clicks its own way; the description names the click each adapter maps.

### conversion, attributedConversion

`conversion` (key `conversion_instance_id`, `currency: "currency"`): `conversionName`
(`lead`, `purchase`, …), `occurrenceId` (submission or order ID), `convertedAt`,
`conversionDate`, `credit` (1 or 0), `creditReason` (`counted`, `duplicate`,
`person_window`, `invalid_traffic`, `excluded`), `valueMinor`, `currency`, `visitorId`,
`personId`, `trafficGroup`. Zero-credit rows stay visible. Metrics are filtered per
conversion: `leads` (sum of `credit` where `conversionName` = `lead`), `purchaseValue`.

`attributedConversion` (key `allocation_key`, `currency: "currency"`): one row per model,
conversion instance and credited session: `model`, `conversionName`,
`conversionInstanceId`, `conversionDate`, `sessionId`, `sessionDate`, `channelGroup`,
`source`, `medium`, `campaignKey`, `credit` (weight × conversion credit),
`allocatedValueMinor`, `currency`, `daysToConvert`; relationship `campaign`. Summing across
models double counts, so declare only filtered metrics per reported conversion and model,
such as `leadsLastClick` (sum of `credit` where `conversionName` = `lead` and `model` =
`last_click`). Each description names its model and date basis.

### agentVisit, parityResult

`agentVisit` (key `visit_key`): `date`, `landingPath`, `trafficClass`, `agentKey`,
`agentName`, `vendor`, `identityVerified`; metrics `hits` and `verifiedFetches` (hits by
assistants whose vendor IP was verified). A fetch is a page request, not a citation.
`parityResult` (key `parity_key`): `date`, `metric`, `breakdown`, `breakdownValue`,
`referenceValue`, `ourValue`, `difference`, `relativeDifference`, `status` (`match`,
`explained`, `differs`, `reference_missing`, `ours_missing`); metric `rows`.

### annotation (stored)

A dated note on the reports, written by a person: `title` (≤ 200), `body` (optional),
`kind` (`note`, `campaign`, `site_change`, `tracking_issue`, `parity_finding`),
`startsOn` and optional `endsOn` (reporting-time-zone dates; no end means one day),
`scope` (optional channel group, platform or campaign key; empty means the whole site) and
`author` (a member, set from the caller). `writes: "actions"`, indexed on `startsOn`,
replicated to the warehouse, where the parity kit reads it.

### Metrics of the model

In `defineOntology({ metrics })`, one per reported conversion and model, so every caller
gets the same division (see `docs/ontology-metrics.md`). Their date basis is the session
(click) date; reports by conversion date use `attributedConversion` alone.

- `cpaLeadLastClick` = `adCost.spend` ÷ `leadsLastClick`, aligned `adCost.date` ↔
  `sessionDate`, `channelGroup` ↔ `channelGroup`, and `{ adCost: "currency",
  attributedConversion: null }` so a currency filter reaches spend only.
- `roasPurchaseLastClick` = `purchaseValueLastClick` ÷ `adCost.spend`, aligned on date,
  channel group and currency. Requests filter one currency.
- `conversionRateLeadLastClick` = `leadsLastClick` ÷ `webSession.sessions`, aligned on
  session date and channel group.

Money metrics sum integer minor units. `unit: "currency"` makes a request filter or group by
currency, but the platform does not know a currency's exponent and returns the sum as it is,
a decimal string. Each money metric's description says "minor units", and the app and the
agent's instructions divide by the currency's factor (100 for EUR, 1 for JPY) before showing
an amount. Ratios of two money metrics in one currency need no conversion.

## 3. Actions

Only annotations change through actions; tracking, conversions, channels, attribution
and identity policy are code.

| Action | Who | Checks | Changes |
| --- | --- | --- | --- |
| `annotation.add` | `marketing`; the agent with confirmation | `endsOn` not before `startsOn`; at most 366 days; `scope` empty or `^[a-z0-9_:.-]+$` | Creates it, `author` = caller |
| `annotation.edit` | the author; `analytics_admin` | the same | Updates the given fields |
| `annotation.remove` | the author; `analytics_admin` | a `parity_finding` older than 30 days needs `analytics_admin` | Deletes it |

## 4. Roles

- `marketing`: `web_session:read`, `campaign:read`, `ad_cost:read`, `conversion:read`,
  `attributed_conversion:read`, `agent_visit:read`, `parity_result:read`,
  `annotation:read`, `annotation:add`, and `annotation:edit` / `annotation:remove` scoped
  to `{ author: me }` with `readsAll: true`.
- `analytics_admin`: owns the setup; `marketing` plus unscoped edit and remove.
- `member`: the starter grants `*:read`; narrow it to leave analytics out unless the
  company decides everyone may see it. Conversion rows carry pseudonymous person IDs.

A metric query needs `<entity>:read` on every entity it reads, model-metric inputs
included, so grant analytics reads together. The agent acts with the member's
permissions and asks before writing. No workflow role or API key gets `annotation:remove`.

## 5. Workflows

All recurring work produces warehouse tables, so it runs as pipeline jobs scheduled with
`s.schedule` (see `docs/jobs.md`). There is no ontology workflow by default.

| Schedule | Job | When (reporting time zone) | What it rebuilds |
| --- | --- | --- | --- |
| `ad_costs_daily` | `ad_costs` | daily, early morning, `s.LatestPartitions(7)` | Costs for the last 7 days, campaign snapshots, cost reports |
| `web_analytics_daily` | `web_analytics` | an hour later, `s.LatestPartitions(3)` | Events to stitching for 3 days, then identity, conversions, attribution, reports |
| `references_weekly` | `references` | weekly | Agent catalogue and vendor IP lists |
| none | `parity`, `ga4_history` | by hand, with dates | Parity comparison; GA4 history import (VARIATIONS.md) |

`ad_costs` selects cost ingestions (one concurrency pool per connection), snapshots and
cost models; `web_analytics` selects `web_events` through stitching, then identity,
conversions, attribution and reports. Daily assets replace exactly their dates, empty
included; global assets their whole table; ingestions replace by account; snapshots add
one observation per run. Reruns give the same tables; older fixes need a dated `job run`.

Non-blocking `s.asset_check`s on global tables: `tracking_volume` (a day below half the
trailing 28-day median of page views), `pairing_rate` (a third below its trailing
median), `cost_freshness` (an account without yesterday), `stitching_coverage` (under
80% of paid-looking sessions matched), `attribution_reconciles`, `no_sample_rows`.

## 6. Data flow (pipeline)

### 6.1 Conventions

- **One reporting calendar**: every daily asset uses the same `s.Partitioning.Daily(...)`
  start and time zone, the ad accounts' time zone. Sessions never cross a reporting day.
- **Two shapes.** Facts of one day are daily. Results that depend on all history
  (identity, counted conversions, attribution, first-session flags, reports) are
  unpartitioned full rebuilds reading `s.AllPartitions(...)`, stored with
  `storage=s.TableStorage(partition_by_date=...)` so report queries prune by date.
- **Adapters.** Every source has a `sample` adapter (invented, deterministic rows yielded
  in code, as the starter's `raw_orders` does) and a `real` one. Both declare the same asset
  `key=` and tier and write one contract with an `adapter` column; `definitions.py`
  registers one. Switching to `real` means a deploy and a backfill of every retained date.
- **Money**, as in the foundation: gold tables and entities carry integer minor units
  (`*_minor`, `p.integer`, never `p.number`) with a lowercase ISO 4217 `currency`; Silver
  computes in `decimal(38, 9)` and rounds once, half to even, at the gold grain. Never a
  float, never converted. **Provider IDs are strings** scoped by platform and account.

### 6.2 Collection

`events/events.py` declares one stream, `web`: `auth=(auth.WriteKey(),
auth.Origin(<site origins>))`, `protocol.Json(batch=True)` (see `docs/events.md`). The
site uses `@segmentstream/web-tracker`:

- **Anonymous ID.** The site's server sets a first-party cookie `ss_aid` (random UUID) on
  document navigations when it is missing and consent allows: `Secure`, `SameSite=Lax`,
  on the registrable domain, long-lived, and not `HttpOnly`, since the browser tracker
  reads it. The tracker never sets it.
- **Browser page views.** The site calls `pageView()` of a `createBrowserTracker` after
  each navigation; views are origin-admitted, with no key in the browser. `flush()` runs on
  an interval and `flush(true)` (a beacon) when the page is hidden.
- **Server document requests.** Middleware sends one `http_request` per document load
  (`isDocumentRequest` skips prefetches, RSC fetches and assets) with the write key, off
  the response path, and adds `Server-Timing: ssreq;desc="<request id>"` so the page view
  names its request. The collector keeps request evidence (IP, country, user agent,
  client hints, fetch metadata, signature headers) only from write-key senders.
- **Identity and conversions, server side only.** After a sign-in: `identify` with
  `user_id` and `email_sha256`. After a form, signup or order succeeds: the conversion
  event (`lead_submitted`, `signed_up`, `purchase`) with its business ID (`submission_id`,
  `order_id`), value, currency and `email_sha256` (SHA-256 hex of the trimmed, lowercased
  address). A raw email never enters a stream.

The write key (`segmentstream events rotate-key web`) lives in the site's server-side
secret store, never in a public environment variable.

### 6.3 Event contract

`silver/web_events`, daily on `event_date`, one row per logical event, key `event_id`:
`event_type`, `event_time` (producer time, else receipt), `event_date`, `received_at`,
`adapter`, `admission` (`origin`, `write_key`), `anonymous_id`, `user_id`,
`email_sha256`, `request_id`, `seq`, `navigation_type`, page URL, host and path,
`referrer_url`, six `utm_*`, `click_ids`, `ip`, `user_agent`, `country`, `client` (JSON
browser signals), `request_evidence` (JSON headers), `properties` (JSON: `submission_id`,
`order_id`, `value`, `currency`, `form`).

- **Real adapter**: a model over the capture table (`s.external_table`, named as
  `segmentstream events get web` reports). It reads receipt times from a day before to
  two days after the assigned days, keeps assigned `event_date`s, and keeps the earliest
  capture per `event_id` (by `received_at`, then `capture_id`).
- **Sample adapter**: an ingestion of invented Northwind visits: channels, a `gclid` click,
  an AI assistant, a crawler, a bot, leads and purchases.

### 6.4 Hits

`silver/hits`, daily, key `hit_id`. A browser `page_view` that opened a document (`seq` 1,
not SPA) pairs one-to-one with the server `http_request` that served it: by equal
`request_id` and path, else, when a request ID is missing, by anonymous ID and path with
the request shortly before the view (about a minute before to a few seconds after). Each
request pairs once; the closest earlier wins. Paired hits take browser fields first and
fill nulls from the server. `hit_source` is `matched`, `client_only` (SPA views, blocked
server events) or `server_only` (no JavaScript: crawlers, agents, bots, blockers).

Click IDs come from a reviewed catalogue in code (`ref_click_ids`: `gclid`, `dclid`,
`fbclid`, `msclkid`, `ttclid`, `li_fat_id`, `twclid`, …) with platform and paid flag.
`gbraid` and `wbraid` mark a Google click but are not unique per click.

### 6.5 Traffic classes

Each hit gets a `traffic_class` and `traffic_group` before sessions are built; the
ad-fraud-detection blueprint adds full invalid-traffic rules on the same columns.
`crawler` (`ai_search`, `ai_training`, `search_crawler`, `link_preview`, `tool`) and
`agent` (`ai_assistant`, `autonomous_agent`, acting for a person) come from the agent
catalogue; `bot` (`script`, `spoofed`) from automation flags, headless browsers or a
catalogue claim whose vendor IP check failed; `internal` from staff rules in config;
`human` and `unverified` are browser user agents with and without a JavaScript page view.
With ad-fraud-detection installed, attribution and `session_report` read class, group and
`effective_verdict` from its `silver/traffic_sessions` instead, and counting reads each
conversion's `counted` from its `silver/conversion_verdicts`: invalid sessions are no
candidates and uncounted conversions get `invalid_traffic`.

The catalogue (`ref_agents`: key, user-agent token, vendor, class, IP list key, docs URL)
is reviewed code. The `references` job fetches vendor IP lists through declared
connections and replaces `ref_ip_ranges` (`list_key`, `cidr`, `snapshot_date`) only
after a complete, valid download.
`identity_verified` is true only when the IP is in the vendor's list. A missing or stale
list (older than 60 days) leaves verification unknown; it never makes a hit a bot.

### 6.6 Sessions and acquisition

`silver/sessions`, daily on `session_date`, key `session_id` (the first hit's ID), with
`silver/session_hits` mapping every hit to its session for other consumers.

1. Order hits by `hit_time`, then `hit_id`, within (`anonymous_id`, reporting day). A hit
   with a null anonymous ID is a session by itself.
2. Signal per hit. With any UTM: source = lowercased `utm_source`, else the click ID's
   platform, else the external referrer, else `(not set)`; medium = lowercased
   `utm_medium`, else `cpc` with a click ID, else `(not set)`. Without UTMs: a paid click
   ID gives its platform and `cpc`; an email or affiliate marker gives that tool and
   `email` or `affiliate`; a search engine referrer gives `organic`; another external
   referrer gives its host and `referral`; else `(direct)` / `(none)`. A referrer is
   internal, and no signal, when it is the landing host, a sub- or parent domain of it,
   or on the configured list of the company's domains.
3. The signature is source, medium, `utm_campaign`, `utm_id`, `utm_term`, `utm_content`,
   click ID and type and external referrer host, nulls included. A signal replaces the
   whole signature; a hit without one inherits it. The day's first hit starts a session
   and every change of signature starts another, even back to an earlier one. There is
   no inactivity timeout. Acquisition, landing page and country come from the first
   hit; the class from the most telling hit (catalogue and bot classes outrank human).

`channel_group` follows rules in config, in order: paid search, paid social, other paid
(display, video, cpm, retargeting), `ai_assistant` (referrers such as chatgpt.com,
perplexity.ai, claude.ai, gemini.google.com), email, affiliate, organic social, organic
search, direct, referral.

### 6.7 Identity graph

Nodes are anonymous IDs. `silver/identity_key_observations` (daily): one row per date,
anonymous ID, key name and value, with first and last seen times. Values are trimmed and
kept as received; click IDs are prefixed with their type (`gclid:…`). Placeholders
(empty, `null`, `undefined`, the SHA-256 of an empty string) are dropped.

| Key | Tier | Window | Max visitors per value | Exclusive |
| --- | --- | --- | --- | --- |
| `user_id` | deterministic | retained history | 50 | yes |
| `email_sha256` | deterministic | retained history | 50 | no |
| click IDs (`gclid`, `fbclid`, `msclkid`, …) | probabilistic | 1 day | 5 | no |

1. `silver/identity_links` (global): pairs sharing a value. A value on more visitors than
   its limit links nothing, never a truncated subset. Spans link only when they overlap
   or their gap fits the window. A pair is vetoed when both sides know a deterministic
   key and their value sets differ.
2. `silver/identities` (global): components by label propagation with
   `warehouse.iterate` (no convergence in 1,000 iterations fails the run). A component
   with two values of an exclusive key is rejected. A node takes its all-evidence
   component if conflict-free and at most 50 nodes, else its deterministic component if
   conflict-free and at most 100, else itself. The person ID is the component's
   earliest-seen anonymous ID; rows carry `resolution_version` and `policy_version`.
3. `gold/identity_diagnostics`: overused values, vetoes, rejected components, coverage
   per key over all nodes. An empty graph is valid: each visitor is a person.

Person IDs change as components merge or split; never store them in records elsewhere.

### 6.8 Ad costs

Each adapter writes `silver/cost_<platform>`; `silver/cost_data` is their union, daily on
`date`, one row per date, platform, account, campaign, ad group and ad: IDs and names,
`campaign_type`, `currency`, `spend` (decimal), `impressions`, `clicks` (int64), the six
`utm_*` of the ad's landing URL, `landing_url`, `adapter`, `extracted_at`. The union
asserts at import that each adapter's schema equals the contract.

- **Google Ads** (`GoogleAdsConnection`): Historical ingestions, `replace_by` account,
  partitioned on the report's own `segments.date`, for ad, campaign and Performance Max
  asset-group metrics; `click_view` maps `gclid` to ad group (about 90 days kept, one day
  per query). Campaigns, ad groups, ads and budgets are current state: SnapshotHistory per
  account, read as the latest successful capture. Spend is `cost_micros` ÷ 1,000,000 in
  decimal. UTMs come from final URLs and tracking templates, ValueTrack substituted.
- **Meta** (`MetaAdsConnection`): synchronous ad-level insights one day per request
  (`time_increment=1`, `date_start` = `date_stop`), Historical by account; ads, ad sets and
  creatives as snapshots. UTMs from the creative URL merged with `url_tags`, with
  `{{campaign.id}}`, `{{adset.id}}`, `{{ad.id}}` substituted. Map one click definition
  (link clicks by default) and say which.
- **Sample**: invented Northwind campaigns on two platforms with round daily spend.

`gold/campaigns` (current) and `gold/ad_cost_daily` (adds `campaign_key`,
`channel_group`, `cost_key`, `spend_minor`) feed the entities.

### 6.9 Stitching

`silver/stitched_sessions`, daily on `session_date`, ties a session to cost rows of the
same date (no lookback) by the first strategy that applies:

1. **Click ID**: the `gclid` is in `click_view` → that ad group and ad. Two ad identities
   for one click is `conflicting_click_id` and blocks every other strategy.
2. **Ad ID evidence**: an ad, ad group or campaign ID appears as whole tokens in a UTM
   value, split on whitespace and tag punctuation (`_ - . , | / + :`); IDs shorter than a
   configured minimum are not searched; IDs at two levels must agree on the hierarchy;
   ties are `ambiguous_id_match`.
3. **`utm_id`** equal to a campaign ID.
4. **UTM tuples**, most specific first, from source + medium + campaign + term + content
   down to source + medium + campaign. A tuple found on two platforms matches nothing.

Unexpanded placeholders (`{…}`, `{{…}}`) never match. Fixed bounds on URL length, tokens
and candidates emit `excessive_matches` and drop that session's ID evidence rather than
truncate. `gold/stitching_diagnostics` has one row per session and code plus a daily
summary per platform (paid-looking sessions, matched share, spend with no matched
session). Stitching never removes a session.

### 6.10 Conversions

Declared in a small registry the project writes (`pipeline/marketing/conversions.py`):
`name` (immutable snake_case), `label`, an `extractor` (Ibis over declared inputs) and a
counting policy.

- Extraction contract: `occurrence_id` (business ID, required), `converted_at` (UTC),
  `conversion_date`, `value` (decimal, optional), `currency`, `anonymous_id`,
  `identity_keys` (name and value pairs), `traffic_group`.
- Counting: `once_per_occurrence` (default; later observations of a business ID get
  `duplicate`), `occurrence_after_days(n)`, optional `person_window_days(n)` (within n
  days of the person's previous counted one: `person_window`). `bot`, `crawler` and
  `internal` traffic gets `invalid_traffic`; agent-submitted conversions count, flagged.
- Each generates `silver/conversion_events_<name>` (daily) and `silver/conversions_<name>`
  (global) with `conversion_instance_id` (a deterministic encoding of definition,
  occurrence, time and identity references; never a row number or graph ID), `credit`,
  `credit_reason` and the identity versions used.

Defaults: `lead` from `lead_submitted` (occurrence `submission_id`, else `event_id`) and,
for online sales, `purchase` (occurrence `order_id`).

### 6.11 Attribution

Plugins (`first_click`, `last_click` included) have a non-blank `version` and
`allocate(candidates)` returning `conversion_instance_id`, `session_date`, `session_id`, `weight`.

1. `silver/attribution_candidates_<conversion>` (global): each conversion with positive
   credit and each session of the same person (visitor when the graph is empty) with
   `0 ≤ converted_at − session start ≤ window` (default 90 days, ends included), from
   `human`, `agent` and `unverified` sessions, direct ones included.
2. First click takes the earliest by session start, date and ID; last click the latest in
   the reverse order. Each model reads only its own window.
3. Before publication: no invented, duplicate or null pairs; weights finite,
   non-negative, summing to 1 (±1e-9) per conversion. A failure keeps the old table.
4. `silver/attribution_<conversion>_<model>` (global, stored by `session_date`): `credit`
   = conversion credit × weight, `allocated_value` = value × weight (decimal; gold
   rounds it to minor units), model name and version, both dates.

No eligible session means no allocation: the conversion shows as `(unattributed)`.
Counting and attribution use the same identity versions or the run fails.

### 6.12 Reports

Global full rebuilds stored by their main date; joins use complete keys and fail before
replacement on duplicates; distinct counts are computed at query time, never stored.

| Table | Grain | Built from |
| --- | --- | --- |
| `gold/session_report` | session | sessions ⟕ stitched_sessions ⟕ identities, `is_first_session` |
| `gold/ad_cost_daily`, `gold/campaigns` | cost row; campaign | cost_data; latest snapshots |
| `gold/conversion_report` | conversion instance | union of `conversions_<name>` |
| `gold/attribution_report` | model, conversion, session | allocations ⟕ session dimensions |
| `gold/agent_visits_daily` | date, page, class, agent, verified | hits in `crawler` and `agent` |
| `gold/tracking_health` | date, event type | counts, pairing rate, null-ID share |

### 6.13 Parity kit

For the weeks the previous tool still runs. `bronze/parity_reference` (contract): `date`,
`metric` (`sessions`, `users`, `conversions:<name>`, `spend:<platform>`), `breakdown`
(`total`, `channel_group`, `source_medium`, `campaign`), `breakdown_value`, `value`,
`reference_system`, `adapter`. Adapters: `sample`; `ga4_export` (GA's definitions over a
GA4 BigQuery export); `sheet` (the previous tool's daily export in a Google Sheet,
through `GoogleSheetsConnection`); platform account totals for spend.

`gold/parity_daily` sets our value beside each reference row with difference, relative
difference and status. `explained` means a `tracking_issue` or `parity_finding`
annotation covers the date and scope (from the replicated `ontology.annotation`). A
tolerance in config only sorts rows. `PARITY.md` in the project lists the expected
structural differences (session rules, bot filtering, consent modeling, ad blockers).

Procedure: pick a window both systems fully cover, in one time zone; compare daily totals,
then channels, campaigns and rows; record each cause as a `parity_finding` annotation.

## 7. Screens (app)

Pages check the read permissions of what they show, take a date range (default: the last
28 complete days), and read numbers with `queryMetrics`, diagnostics with bound SQL.

1. **Overview** (`/analytics`): sessions, people, conversions, value, spend, CPA, ROAS; a
   daily trend with annotation markers (add one from a day); a channel table drilling to
   source / medium and campaign. Switches: model, date basis (session or conversion
   date), traffic (people, or people and agents). Every number names model and basis.
2. **Campaigns**: per platform, account, campaign and ad group: spend, impressions,
   clicks, CTR, CPC, matched sessions, conversions, CPA, ROAS, share of clicks matched to
   a session. One currency at a time.
3. **Conversions**: recent conversions with credit, reason, first- and last-click channel
   and days to convert; each opens its journey (the person's sessions in the window, the
   one each model credited, the key names that linked them).
4. **AI agents and crawlers**: verified assistant fetches, crawler hits by class and
   vendor, pages agents read most, spoofed claims, human sessions from AI assistants.
5. **Data quality**: tracking health, stitching diagnostics, identity coverage and
   conflicts, cost freshness, failing checks, annotations.
6. **Parity** (while the kit has data): daily comparison with status filters and the
   annotations that explain differences.
7. **Setup** (read-only): conversion declarations, counting, windows, channel rules and
   identity policy as deployed, the stream endpoint, each connection's status.

## 8. The company agent

A member can ask "how many leads did paid search bring last month under last click, at
what CPA in USD?" (`leadsLastClick`, `cpaLeadLastClick`), "which campaigns had ROAS below
1 last week?" (`roasPurchaseLastClick` by `campaign.name`), "why did sessions drop on
Tuesday?" (tracking health, annotations, diagnostics, channels against the week before),
"which AI assistants read our pricing page?" (`agentVisit`), "where did this order come
from?" (`conversion` with its `attributedConversion` rows) and "why does our lead count
differ from Google Analytics?" (`parityResult`, `parity_finding` annotations).

It adds or edits annotations only after the person confirms the text. Its instructions
and entity guides make every number name its conversion, model, date basis and currency,
and forbid adding across models or currencies.

## 9. Build order

`segmentstream dev` reads the workspace's live warehouse, so a page check sees pipeline
tables only after they are deployed (with the person's approval) and their job has run.

1. **Stream and tracker.** `events/events.py`, deploy, tracker in the site's browser
   code and middleware. Check: `segmentstream events verify web` reports `delivered`.
2. **Events, hits, sessions on sample data.** Calendar, both event adapters, `hits`,
   `sessions`, `session_report`. Check: tests turn invented visits into the expected
   sessions, channels and classes.
3. **Overview.** `webSession`, `marketing`, the overview page. Check: after a deploy and a
   `web_analytics` run on sample data, `segmentstream dev` shows sample sessions by channel.
4. **Conversions and attribution.** `lead` (and `purchase`), counting, first and last
   click, `conversion`, `attributedConversion`. Check: counting and weight tests pass.
5. **Sample costs and stitching.** Cost contract and sample adapter, `campaigns`,
   `ad_cost_daily`, stitching, `adCost`, `campaign`, CPA and ROAS. Check: the campaigns
   page shows them.
6. **Real cost adapters.** Google Ads and Meta. After deploy and authorization, run
   `ad_costs` for a week. Check: spend per account and day equals the platform's report.
7. **Identity graph.** Check: identity tests pass; the quality page shows coverage.
8. **Agents and crawlers.** Check: verified and spoofed fixtures land in the right classes.
9. **Schedules, checks, annotations, agent guides.** Check: `segmentstream schedule list`
   shows the schedules; the agent answers a CPA question naming its model.
10. **Migration**, if replacing a tool: parity for at least two full weeks, optional GA4
    history. Check: every `differs` row has a cause.

## 10. Sketch

Invented names and data; the full API is in your project's `docs/` and `.agents/skills/`.

```ts
// The site's Next.js proxy (middleware). consentAllows is the site's own consent check.
export function proxy(request: NextRequest, event: NextFetchEvent) {
  const response = NextResponse.next();
  if (!isDocumentRequest(request)) return response; // helpers from @segmentstream/web-tracker/server
  const navigating = request.headers.get("sec-fetch-mode") === "navigate";
  const existing = requestAnonymousId(request);
  const anonymousId = existing ?? (navigating && consentAllows(request) ? crypto.randomUUID() : null);
  if (anonymousId && !existing) response.cookies.set("ss_aid", anonymousId, { path: "/", domain: "example.com", maxAge: 15_552_000, secure: true, sameSite: "lax" });
  const requestId = request.headers.get("x-vercel-id");
  if (requestId) response.headers.append("Server-Timing", `ssreq;desc="${requestId.replace(/["\\]/g, "\\$&")}"`);
  event.waitUntil(sendEvents([requestEvent(request, {
    eventType: "http_request", anonymousId, page: true, sdk: { name: "northwind-site", version: "1" },
    fields: { request: { method: request.method, host: request.headers.get("host"), path: request.nextUrl.pathname } },
  })], { endpoint: process.env.WEB_EVENTS_ENDPOINT!, writeKey: process.env.WEB_EVENTS_WRITE_KEY! }));
  return response;
}
```

```python
# pipeline/models/web_events.py: receipt-time window, local dates, retry collapse.
# daily(column) is the project's one helper returning s.Partitioning.Daily(column=..., start_date=..., timezone=REPORTING_TZ).
events_web = s.external_table(tier=s.Tier.Bronze, key="events_web", partitioning=s.Partitioning.Unpartitioned)

@ibis.udf.scalar.builtin(name="DATE")  # BigQuery's DATE(timestamp, time_zone); types are instances: dt.timestamp, dt.date
def local_date(value: dt.timestamp, zone: str) -> dt.date: ...

@s.model(tier=s.Tier.Silver, group="web", partitioning=daily("event_date"), schema=WEB_EVENTS_SCHEMA)
def web_events(context: s.Context, events_web: ir.Table) -> ir.Table:
    days = sorted(date.fromisoformat(key) for key in context.partition_keys)
    rows = events_web.filter(  # the capture's receipt-time partition filter, widened for late beacons
        events_web.received_at >= ibis.timestamp(f"{days[0] - timedelta(days=1)}T00:00:00+00:00"),
        events_web.received_at < ibis.timestamp(f"{days[-1] + timedelta(days=3)}T00:00:00+00:00"),
        events_web.event_id.notnull(),
    )
    rows = rows.mutate(event_date=local_date(ibis.coalesce(rows.event_time, rows.received_at), REPORTING_TZ))
    rows = rows.filter(rows.event_date.isin(days))
    first = ibis.window(group_by="event_id", order_by=["received_at", "capture_id"])
    rows = rows.mutate(_n=ibis.row_number().over(first)).filter(lambda t: t._n == 0).drop("_n")
    return project_web_events(rows, adapter="tracker")

class LastClick:  # pipeline/marketing/attribution.py: one attribution plugin
    version = "last_click/1"
    def allocate(self, candidates: ir.Table) -> ir.Table:
        order = [candidates.session_start.desc(), candidates.session_date.desc(), candidates.session_id.desc()]
        ranked = candidates.mutate(_n=ibis.row_number().over(group_by="conversion_instance_id", order_by=order))
        return ranked.filter(ranked._n == 0).select("conversion_instance_id", "session_date", "session_id", weight=ibis.literal(1.0))
```

```ts
// ontology/ad-cost.ts (abridged): warehouse-backed, with currency metrics.
export const AdCost = entity("adCost", {
  id: "ent_ad_cost", label: "Ad cost", plural: "Ad costs", title: "campaignKey",
  description: "What one ad cost on one day, as its platform reported it, in the ad account's currency and time zone.",
  source: warehouse("gold/ad_cost_daily", { key: ["cost_key"], currency: "currency" }),
  properties: {
    date: p.date({ column: "date", description: "The ad account's reporting day." }),
    channelGroup: p.text({ column: "channel_group", description: "The paid channel of the campaign." }),
    currency: p.text({ column: "currency", description: "Lowercase ISO 4217 code of the ad account." }),
    spendMinor: p.integer({ column: "spend_minor", description: "Spend in minor units of currency (cents)." }),
  },
  metrics: { spend: m.sum("spendMinor", { unit: "currency", description: "Ad spend in minor units. Filter or group by currency." }) },
});

// ontology/index.ts: a model metric whose date, channel and currency filters reach both inputs.
metrics: {
  roasPurchaseLastClick: m.divide(m.ref("attributedConversion.purchaseValueLastClick"), m.ref("adCost.spend"), {
    align: [
      { attributedConversion: "sessionDate", adCost: "date" },
      { attributedConversion: "channelGroup", adCost: "channelGroup" },
      { attributedConversion: "currency", adCost: "currency" },
    ],
    unit: "ratio",
    description: "Purchase value credited by last click to a day's sessions, over that day's spend. One currency.",
  }),
},

// ontology/annotation.ts (abridged: title, kind, body and scope omitted) and ontology/roles.ts.
export const Annotation = entity("annotation", {
  id: "ent_annotation", label: "Annotation", plural: "Annotations", title: "title",
  description: "A dated note on the analytics reports: a launch, a site change, a tracking outage or a parity finding.",
  properties: {
    startsOn: p.date({ description: "First day concerned, in the reporting time zone." }),
    endsOn: p.date({ optional: true, description: "Last day concerned; empty means one day." }),
  },
  relationships: { author: rel.one(User, { inverse: "annotations", onDelete: "restrict", phrase: ["is written by", "wrote"], description: "Who wrote it." }) },
  indexes: [["startsOn"]],
  writes: "actions",
}).actions((self) => ({
  add: action({
    description: "Add a dated note. Refused when it ends before it starts or spans more than 366 days.",
    input: Schema.Struct({ startsOn: self.properties.startsOn, endsOn: self.properties.endsOn }),
    writes: [self],
    handler: ({ input, principal }) =>
      Effect.gen(function* () {
        const ends = input.endsOn ?? input.startsOn; // dates are YYYY-MM-DD strings
        if (ends < input.startsOn || Date.parse(ends) - Date.parse(input.startsOn) > 366 * 86_400_000) {
          return yield* new ActionRejected({ message: "An annotation ends on or after its start, within 366 days." });
        }
        const annotation = yield* self.create({ ...input, author: principal.id });
        return { annotationId: annotation.id };
      }),
  }),
}));

export const marketing = role("marketing", {
  description: "Reads the analytics reports and keeps their annotations.",
  permissions: [
    "web_session:read", "campaign:read", "ad_cost:read", "conversion:read", "attributed_conversion:read",
    "agent_visit:read", "parity_result:read", "annotation:read", "annotation:add",
    { permission: "annotation:edit", where: { author: me }, readsAll: true },
    { permission: "annotation:remove", where: { author: me }, readsAll: true },
  ],
});
```
