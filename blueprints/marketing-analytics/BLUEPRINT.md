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

Relationship `campaign` on `campaignKey`, declared without `optional` or a delete rule:
relationships of warehouse-backed entities take neither (`check` refuses them), and an
unmatched session's null key simply matches nothing. Metrics: `sessions`, `newPeople`
(count where `isFirstSession`), `visitors` and `people` (`m.countDistinct`; non-additive,
as described).

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
(`purchase`, `lead`, `newsletter_signup`, …), `occurrenceId` (order or submission ID),
`convertedAt`, `conversionDate`, `credit` (1 or 0), `creditReason` (`counted`,
`duplicate`, `person_window`, `invalid_traffic`, `excluded`), `valueMinor`, `currency`,
`visitorId`, `personId`, `trafficGroup`. Zero-credit rows stay visible.

`attributedConversion` (key `allocation_key`, `currency: "currency"`): one row per model,
conversion instance and credited session, plus one `(unattributed)` row per model and
counted conversion without an eligible session: `model`, `conversionName`,
`conversionInstanceId`, `conversionDate`, `sessionId`, `sessionDate`, `channelGroup`,
`source`, `medium`, `campaignKey`, `credit` (weight × conversion credit),
`allocatedValueMinor`, `currency`, `daysToConvert`; relationship `campaign`. Summing across
models double counts, so declare only metrics filtered to one conversion and one model.
Each description names its conversion, model and date basis.

**Metric names follow the declared conversions.** For each conversion `<name>` (plural
`<names>`), declare on `conversion` `<names>` (sum of `credit` where `conversionName` =
`<name>`) and, when it has a value, `<name>Value` (sum of `valueMinor` where
`conversionName` = `<name>` and `credit` = 1, so duplicates never add value); on
`attributedConversion`, per model, `<names>LastClick`, `<names>FirstClick` and
`<name>ValueLastClick`, `<name>ValueFirstClick` (the same filters plus `model`). An online
store starts with `purchase`: `purchases`, `purchaseValue`, `purchasesLastClick`,
`purchaseValueLastClick`. Lead generation starts with `lead`: `leads`, `leadsLastClick`.
A newsletter form is its own conversion, `newsletter_signup`: `newsletterSignups`,
`newsletterSignupsLastClick`.

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
(click) date; reports by conversion date use `attributedConversion` alone. Names follow the
conversion, as above; an online store's defaults:

- `cpaPurchaseLastClick` = `adCost.spend` ÷ `purchasesLastClick`, aligned `adCost.date` ↔
  `sessionDate`, `channelGroup` ↔ `channelGroup`, and `{ adCost: "currency",
  attributedConversion: null }` so a currency filter reaches spend only. For lead
  generation, `cpaLeadLastClick` over `leadsLastClick`.
- `roasPurchaseLastClick` = `purchaseValueLastClick` ÷ `adCost.spend`, aligned on date,
  channel group and currency. Requests filter one currency.
- `conversionRatePurchaseLastClick` = `purchasesLastClick` ÷ `webSession.sessions`,
  aligned on session date and channel group.

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

`analytics_admin` also answers the members' feedback about the reports:
`defineOntology({ feedback: { builders: ["analytics_admin"] } })`. Without a builder role,
`npm --prefix ontology run check` warns `feedback-unanswerable` on every build.

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
80% of paid-looking sessions matched), `attribution_reconciles` (per model and conversion
instance, `credit` sums to `conversion_credit` in `attribution_report`) and
`no_sample_rows`. A check reads its target table only, which is why
`attribution_report` carries `conversion_credit` and `(unattributed)` rows. One
`no_sample_rows` factory serves `session_report`, `ad_cost_daily` and
`conversion_report`; each call names its input (`inputs={"target": asset}`, see
[pipeline notes](../../docs/pipeline-notes.md#sdk-patterns)). It enforces only once real
adapters are registered: `definitions.py` holds `REAL_ADAPTERS = False` beside the
adapter choice and passes it as `enforce=`; with `False` the check passes and records the
sample row count.

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
- **Code layout.** Shared definitions (calendar, contracts, config, the conversion
  registry, attribution plugins) live in `pipeline/marketing/`, which holds no assets;
  add `marketing` and `marketing.*` (and `checks` if you add it) to the
  `[tool.setuptools.packages.find] include` of `pipeline/pyproject.toml`, which lists only
  `ingestion` and `models`. Assets that exist once per declared conversion, or per
  conversion and model, come from a factory in one file (`models/conversions.py`,
  `models/attribution.py`) instead of one file per asset; the reports that read all of
  them get an explicit signature (sketch, and
  [pipeline notes](../../docs/pipeline-notes.md#sdk-patterns)). Generic Ibis and SDK
  lessons are in the [pipeline notes](../../docs/pipeline-notes.md).

### 6.2 Collection

`events/events.py` declares one stream, `web`: `auth=(auth.WriteKey(),
auth.Origin(<site origins>))`, `protocol.Json(batch=True)` (see `docs/events.md`). The
`events/` component has its own `events/pyproject.toml`, and browser collection needs
`segmentstream-pipeline>=0.1.0a68` there, whatever the pipeline pins. Check the
declaration locally with `segmentstream uv run --directory events python -m
segmentstream.events inspect <file>`. Two parts are switched on per workspace by
SegmentStream, so confirm them before promising them: **browser collection** (origin
admission) and **IP capture**. Without IP capture the collector removes
`payload.visitor.ip`, and agent verification (6.5) stays unknown.

The tracker code lives in the site's own repository, not in the workspace project: the
project deploys only its components (`app/`, `ontology/`, `pipeline/`, `connections/`,
`events/`, `agent/`). Write the site's changes and their tests (invariants 1 and 2) in
the site's repository. When the agent cannot reach it, it writes them into a
`site-integration/` folder in the project, outside every component, for the person to copy.

The site uses `@segmentstream/web-tracker`:

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
  event (`lead_submitted` with its `form`, `signed_up`, `purchase`) with its business ID
  (`submission_id`, `order_id`), `value` as a decimal string (`"120.00"`, never a JSON
  number, which reads as NULL on BigQuery), `currency` and `email_sha256` (SHA-256 hex of
  the trimmed, lowercased address). The site sends them with `requestEvent(request, {
  eventType, anonymousId, sdk, fields })`; `fields` land at the top level of `payload`.
  The tracker has no hashing helper: the site writes its own. A raw email never enters a
  stream.

The write key (`segmentstream events rotate-key web`) lives in the site's server-side
secret store, never in a public environment variable.

### 6.3 Event contract

`silver/web_events`, daily on `event_date`, one row per logical event, key `event_id`:
`event_type`, `event_time` (producer time, else receipt), `event_date` (the reporting day
of `event_time`), `received_at`, `adapter`, `admission` (`origin`, `write_key`),
`anonymous_id`, `user_id`, `email_sha256`, `request_id` (the site's request ID),
`seq`, `navigation_type`, `page_url`, `page_host`, `page_path`, `referrer_url`, six
`utm_*`, `click_id_type` and `click_id` (the first paid catalogue parameter present),
`click_ids` (JSON object of every catalogued parameter present, markers included), `ip`,
`user_agent`, `country`, `client` (JSON browser signals), `request_evidence` (JSON:
the server's `visitor` and `request` snapshots), and the conversion fields as typed
columns: `submission_id`, `order_id`, `form`, `value` (`decimal(38, 9)`) and `currency`
(lowercase). Typed, because their meaning is known (the project's `writing-ingestions`
skill); `client` and `request_evidence` stay JSON because nothing models them here and
the ad-fraud-detection blueprint reads them whole.

**The capture table.** The platform writes the `web` stream to a table in `bronze`, such
as `bronze.events_web_v2`; use the exact name `segmentstream events get web` reports. One
row per accepted submission. Columns the adapter reads: `event_id`, `event_type`,
`event_time` (nullable), `received_at` (UTC), `capture_id` (one per submission, so a retry
has its own), `auth_mode` (`origin` or `write_key`) and `body` (JSON: the submitted event,
its fields under `body.payload`). The table is partitioned by day on `received_at` in UTC
and requires a partition filter. Its `request_id` column is the collector's own request,
never the site's. The collector removes `payload.visitor` from origin submissions (and sets
`untrusted_visitor_context`), and removes `payload.visitor.ip` unless IP capture is on.

Where the contract's columns come from, as `@segmentstream/web-tracker` 0.1 sends them:

| Contract column | From |
| --- | --- |
| `admission` | `auth_mode` |
| `anonymous_id`, `seq` | `body.payload.context.anonymous_id`, `.seq` |
| `request_id` | `body.payload.context.request_id` (page views, from `Server-Timing: ssreq`), else `body.payload.visitor.request_id` (server events) |
| `navigation_type` | `body.payload.client.navigation_type` (`navigate`, `reload`, …; `spa` for in-app navigations) |
| `page_url`, `page_path`, `page_host` | `body.payload.context.page.url`; the path is `.page.path` on page views and the URL's path on server events; the host is the URL's host |
| `referrer_url` | `body.payload.context.page.referrer` (page views), else `body.payload.visitor.referer` without its query |
| six `utm_*`, `click_id`, `click_ids` | `body.payload.context.campaign.<parameter>`; markers that are not campaign keys (`mc_cid`, `irclickid`, …) from `body.payload.context.page.query_params` |
| `user_id`, `email_sha256`, `submission_id`, `order_id`, `form`, `value`, `currency` | `body.payload.<name>` (the site's server events) |
| `ip`, `user_agent`, `country` | `body.payload.visitor.ip`, `.user_agent`, `.country`, only where `auth_mode = 'write_key'` |
| `client` | `body.payload.client` |
| `request_evidence` | `body.payload.visitor` and `body.payload.request` |

- **Real adapter**: a model over the capture table, registered with
  `s.external_table(tier=s.Tier.Bronze, key=<the reported table name>,
  partitioning=s.Partitioning.Unpartitioned)`. Unpartitioned is deliberate: the capture's
  UTC receipt days are not the reporting calendar, so it cannot be a same-day input. The
  model bounds every read by `received_at`, from a day before to two days after the
  assigned days; that filter also satisfies the required partition filter. It keeps
  assigned `event_date`s and the earliest capture per `event_id` (by `received_at`, then
  `capture_id`). Check the column names with `segmentstream events get web` after the
  first deploy, and keep the mapping in one function so a rename is one edit.
- **Sample adapter**: an ingestion of invented Northwind visits: channels, a `gclid` click,
  an AI assistant, a crawler, a bot, leads and purchases. `fixtures/` holds one invented
  day with its expected sessions, stitching, conversions and attribution.

### 6.4 Hits

`silver/hits`, daily, key `hit_id`. A browser `page_view` that opened a document (`seq` 1,
not SPA) pairs one-to-one with the server `http_request` that served it: by equal
`request_id` and path, else, when a request ID is missing, by anonymous ID and path with
the request between 60 seconds before and 5 seconds after the view. Candidates rank by:
an equal request ID before a time match, a request before the view before one after it,
then the smallest gap, then IDs. A view and a request pair only when each is the other's
first candidate, so each pairs at most once. Paired hits take browser fields first and
fill nulls from the server; `ip`, `user_agent` and `country` come from the server
request only. `hit_id` and `hit_time` are the page view's (the request's when
`server_only`); `client_event_id` and `server_event_id` keep both event IDs. `hit_source` is
`matched`, `client_only` (SPA views, blocked server events) or `server_only` (no
JavaScript: crawlers, agents, bots, blockers).

Click IDs and markers come from a reviewed catalogue in code (`ref_click_ids`:
`param_key`, `platform`, `kind`, `identity_key`, precedence), the same catalogue the
ad-fraud-detection blueprint extends. `kind` is `paid` (`gclid`, `gbraid`, `wbraid`,
`dclid`, `fbclid`, `msclkid`, `ttclid`, `li_fat_id`, `twclid`, …), `email` (`mc_cid`,
`mc_eid`, `_hsenc`, `_hsmi`, `vero_id`, with the tool as `platform`) or `affiliate`
(`irclickid`). `gbraid` and `wbraid` mark a Google click but are not unique per click,
so they are never identity keys.

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
list (its `snapshot_date` more than 60 days before the hit's date), an IP the collector did
not keep (IP capture off) or an agent without a published list leaves verification
unknown (null); it never makes a hit a bot.

### 6.6 Sessions and acquisition

`silver/sessions`, daily on `session_date`, key `session_id` (the first hit's ID), with
`silver/session_hits` mapping every hit to its session for other consumers.

1. Order hits by `hit_time`, then `hit_id`, within (`anonymous_id`, reporting day). A hit
   with a null anonymous ID is a session by itself.
2. Signal per hit. With any UTM: source = lowercased `utm_source`, else the click ID's
   platform, else the external referrer, else `(not set)`; medium = lowercased
   `utm_medium`, else `cpc` with a click ID, else `(not set)`. Without UTMs: a paid click
   ID gives its platform and `cpc`; an `email` or `affiliate` marker from `click_ids`
   (6.4) gives its catalogue `platform` (`mailchimp`, `impact`, …) and `email` or
   `affiliate`; a search engine referrer gives the referrer host and `organic`; another
   external referrer gives its host and `referral`; else the hit has no signal. A referrer
   is internal, and no signal, when it is the landing host, a sub- or parent domain of it,
   or on the configured list of the company's domains. The day's first hit without a
   signal is `(direct)` / `(none)`.
3. The signature is source, medium, `utm_campaign`, `utm_id`, `utm_term`, `utm_content`,
   click ID and type and external referrer host, nulls included. A signal replaces the
   whole signature; a hit without one inherits it. The day's first hit starts a session
   and every change of signature starts another, even back to an earlier one. There is
   no inactivity timeout. Acquisition, landing page and country come from the first
   hit; the class from the most telling hit (catalogue and bot classes outrank human).

`channel_group` follows rules in config. The first row whose condition holds wins; source
and medium are the session's lowercased values, and "click platform" is the catalogue
platform of the session's paid click ID.

| # | `channel_group` | Condition |
| --- | --- | --- |
| 1 | `paid_social` | medium in the paid-social list (`paid_social`, `paidsocial`, `social_paid`); or medium in the paid list and (source in the social-source list or click platform in `meta_ads`, `tiktok_ads`, `linkedin_ads`, `x_ads`, `reddit_ads`) |
| 2 | `paid_search` | medium in the paid list (`cpc`, `ppc`, `paid`, `paidsearch`, `paid_search`, `sem`); or click platform in `google_ads`, `microsoft_ads` |
| 3 | `other_paid` | medium in `display`, `video`, `cpm`, `banner`, `retargeting` |
| 4 | `ai_assistant` | source or referrer host on the AI assistant list (`chatgpt.com`, `perplexity.ai`, `claude.ai`, `gemini.google.com`, `copilot.microsoft.com`), or its subdomains |
| 5 | `email` | medium `email`; or source in the email-tool list (`newsletter`, `mailchimp`, `klaviyo`, `brevo`, `hubspot`) |
| 6 | `affiliate` | medium `affiliate` |
| 7 | `organic_social` | medium in `social`, `social-network`, `social_media`; or source on the social-site list (`facebook.com`, `instagram.com`, `t.co`, `x.com`, `linkedin.com`, `reddit.com`, `youtube.com`, `tiktok.com`, and their subdomains) |
| 8 | `organic_search` | medium `organic` |
| 9 | `direct` | source `(direct)` |
| 10 | `referral` | every other session |

The social-source list for row 1 is `facebook`, `fb`, `instagram`, `ig`, `meta`, `tiktok`,
`linkedin`, `x`, `twitter`, `reddit`: so `facebook / cpc` is paid social, not paid search.
Lists are config; changing them rewrites history on the next rebuild.

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
   earliest-seen anonymous ID (propagate the label `<first seen as zero-padded epoch
   seconds>|<anonymous ID>` and keep its minimum). Rows carry `policy_version` (a
   constant in config, raised with every policy change) and `resolution_version`, a
   fingerprint of the whole published mapping: the same mapping gives the same value in
   one warehouse, any change gives another. Compute it in the model as
   `bit_xor(hash(anonymous_id || '=' || person_id))` over all rows, as text with a prefix
   (`r…`); an empty graph has the version `r0`.
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
  account, read as the latest successful capture through the snapshot ledger (below).
  Spend is `cost_micros` ÷ 1,000,000 in decimal. UTMs come from final URLs and tracking
  templates, ValueTrack substituted.
- **Meta** (`MetaAdsConnection`): synchronous ad-level insights one day per request
  (`time_increment=1`, `date_start` = `date_stop`), Historical by account; ads, ad sets and
  creatives as snapshots. UTMs from the creative URL merged with `url_tags`, with
  `{{campaign.id}}`, `{{adset.id}}`, `{{ad.id}}` substituted. Map one click definition
  (link clicks by default) and say which.
- **Sample**: invented Northwind campaigns on two platforms with round daily spend.

`gold/campaigns` (current) and `gold/ad_cost_daily` (adds `campaign_key`,
`channel_group`, `cost_key`, `spend_minor`) feed the entities.

**Reading snapshots.** A SnapshotHistory ingestion such as `bronze/google_ads_campaigns`
keeps every capture: its rows carry `_snapshot_id`, `_snapshot_at` and `_snapshot_date`,
and the SDK-owned ledger `bronze/google_ads_campaigns__snapshots` has one row per
successful capture (`snapshot_id`, `snapshot_at`, `scopes`: a JSON array of the scopes it
covered, such as `[{"account_id": "1234567890"}]`). The SDK has no input selector for
snapshots yet, so `gold/campaigns` declares the ledger as an external table, expands
`scopes`, takes the latest ledger row per account, and keeps the rows of that capture
(sketch). An account whose latest capture was empty then has no campaigns; taking the
latest non-empty rows instead would bring deleted campaigns back (PITFALLS 2).

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
   down to source + medium + campaign, compared lowercased; the session's `source` and
   `medium` stand for `utm_source` and `utm_medium`. A tuple found on two platforms
   matches nothing (`cross_platform_match`).

A session whose click ID matches is matched by `click_id`, even when its UTMs and IDs
would also match (invariant 26). Rank each session's results by blocked first, then
matched, then strategy number, with every flag coalesced to false, since a NULL sorts
last and would let a later strategy win. A paid-looking session (paid medium or any paid
click ID) that matches nothing gets `no_match`. Unexpanded placeholders (`{…}`, `{{…}}`)
never match. Fixed bounds on URL length, tokens
and candidates emit `excessive_matches` and drop that session's ID evidence rather than
truncate. `gold/stitching_diagnostics` has one row per session and code plus a daily
summary per platform (paid-looking sessions, matched share, spend with no matched
session). Stitching never removes a session.

### 6.10 Conversions

Declared in a small registry the project writes (`pipeline/marketing/conversions.py`):
`name` (immutable snake_case), `label`, an `extractor` (Ibis over declared inputs) and a
counting policy.

- Extraction contract: `observation_id` (the source row's own stable ID: the `event_id`
  of a server event, the record ID of a CRM record), `occurrence_id` (business ID,
  required), `converted_at` (UTC), `conversion_date`, `value` (decimal, optional),
  `currency`, `anonymous_id`, `traffic_group`. Identity keys reach the graph through
  `identity_key_observations`, not through this contract.
- `traffic_group` is the group of the visitor's latest session of the same reporting day
  that started at or before `converted_at`; `unverified` when there is none or no
  anonymous ID.
- Counting, per observation in `converted_at`, then `observation_id` order. `bot`,
  `crawler` and `internal` traffic gets `invalid_traffic` and is skipped by the rules
  below; agent-submitted conversions count, flagged by their group.
  - `once_per_occurrence` (default): the first valid observation of a business ID counts;
    later ones get `duplicate`.
  - `occurrence_after_days(n)`: an observation of a business ID counts when it is at
    least n days after the last *counted* observation of that ID, else `duplicate`.
  - `person_window_days(n)` (optional, on top of either): a counted candidate within n
    days after the person's last *counted* conversion of the same name gets
    `person_window`.

  "Last counted" makes the two windowed rules sequential: with n = 30, observations on
  days 0, 20 and 40 count on days 0 and 40, while a `lag()` over the previous
  observation would wrongly suppress day 40. Compute them with `warehouse.iterate`: each
  step decides the earliest undecided observation of every key, and the loop stops when
  none is undecided. `once_per_occurrence` needs only `row_number()`.
- Each generates `silver/conversion_events_<name>` (daily) and `silver/conversions_<name>`
  (global, stored by `conversion_date`) with `credit`, `credit_reason`, the
  `resolution_version` and `policy_version` of the identities it read, and
  `conversion_instance_id` = `<name>|<observation_id>`, such as `purchase|event-7`. Never
  include a row number, a person ID or a rebuild time: an identity merge or an unrelated
  new conversion must not change it (invariant 15).

Defaults: `purchase` for online sales (occurrence `order_id`); `lead` from
`lead_submitted` (occurrence `submission_id`, else `event_id`); a newsletter form is its
own conversion, `newsletter_signup`, from `lead_submitted` with `form` = `newsletter`
(and `lead` then excludes that form, so one submission is never both).

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
   non-negative, summing to 1 (±1e-9) per conversion. The allocation model counts each
   problem with `warehouse.execute(...)` and raises before it returns its expression, so
   a failure keeps the old table.
4. `silver/attribution_<conversion>_<model>` (global, stored by `session_date`): `credit`
   = conversion credit × weight, `allocated_value` = value × weight (decimal: cast the
   weight to `decimal(38, 9)` first; gold rounds it to minor units), model name and
   version, both dates.

Candidates and allocations exist once per conversion and per conversion and model, so
`models/attribution.py` builds them in a factory over the registry and the list of
plugins (sketch). No eligible session means no allocation: the conversion shows as
`(unattributed)`. Counting and attribution use the same identity versions: the candidates
model fails when any counted row carries another `resolution_version` than the current
`silver/identities`.

### 6.12 Reports

Global full rebuilds stored by their main date; joins use complete keys and fail before
replacement on duplicates; distinct counts are computed at query time, never stored.

| Table | Grain | Built from |
| --- | --- | --- |
| `gold/session_report` | session | sessions ⟕ stitched_sessions ⟕ identities, `is_first_session` |
| `gold/ad_cost_daily`, `gold/campaigns` | cost row; campaign | cost_data; latest snapshots |
| `gold/conversion_report` | conversion instance | union of `conversions_<name>`, `value_minor` |
| `gold/attribution_report` | model, conversion, session | allocations ⟕ session dimensions, plus one `(unattributed)` row per model and counted conversion without an allocation (`session_id` null, `credit` = conversion credit); `allocation_key` = `<model>\|<conversion_instance_id>\|<session_id or (unattributed)>`; `conversion_credit` on every row |
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

A member can ask "how many purchases did paid search bring last month under last click,
at what CPA in EUR?" (`purchasesLastClick`, `cpaPurchaseLastClick`; `leadsLastClick` and
`cpaLeadLastClick` for lead generation), "which campaigns had ROAS below 1 last week?"
(`roasPurchaseLastClick` by `campaign.name`), "why did sessions drop on Tuesday?"
(tracking health, annotations, diagnostics, channels against the week before), "which AI
assistants read our pricing page?" (`agentVisit`), "where did this order come from?"
(`conversion` with its `attributedConversion` rows) and "why does our purchase count
differ from Google Analytics?" (`parityResult`, `parity_finding` annotations).

It adds or edits annotations only after the person confirms the text. Its instructions
and entity guides make every number name its conversion, model, date basis and currency,
and forbid adding across models or currencies.

## 9. Build order

Each step names its check and the milestone it needs (M1 local, M2 linked, M3 deployed;
see [testing](../../docs/testing.md)). `segmentstream dev` reads the workspace's live
warehouse, so a page check sees pipeline tables only after they are deployed (with the
person's approval) and their job has run.

1. **Clear the starter and set up tests.** Remove the starter's commerce sample, its
   `Order` entity, its revenue card and README walkthrough, add `marketing` to the
   pipeline's packages ([pipeline notes](../../docs/pipeline-notes.md#the-starter)), and set
   up the pipeline and ontology tests as [testing](../../docs/testing.md) describes. Check
   (M1): validation and an empty test run pass.
2. **Stream and tracker.** `events/events.py` with its own `events/pyproject.toml`; the
   tracker, middleware and server events in the site's repository (6.2). Check (M1):
   `python -m segmentstream.events inspect` and the site's tests for invariants 1 and 2;
   (M3) `segmentstream events verify web` reports `delivered`.
3. **Events, hits, sessions on sample data.** Calendar, both event adapters, `hits`,
   `sessions`, `session_report`. Check (M1): the `fixtures/` day gives the expected
   `sessions`, and tests turn invented visits into the expected channels and classes.
4. **Overview.** `webSession`, `marketing`, the overview page. Check (M1): ontology check,
   app build; (M2/M3) after a deploy and a `web_analytics` run on sample data,
   `segmentstream dev` shows sample sessions by channel.
5. **Conversions and attribution.** The registry's conversions (`purchase`, `lead` or
   `newsletter_signup`), counting, first and last click, `conversion`,
   `attributedConversion`. Check (M1): counting and weight tests pass, and the `fixtures/`
   day gives the expected `conversion_report` and `attribution_report`.
6. **Sample costs and stitching.** Cost contract and sample adapters, `campaigns`,
   `ad_cost_daily`, stitching, `adCost`, `campaign`, CPA and ROAS. Check (M1): the
   `fixtures/` day gives the expected `stitched_sessions`; (M2) the campaigns page shows
   them.
7. **Real cost adapters.** Google Ads and Meta, each a transformation function tested on
   invented report rows at M1. Check (M3): after authorization, run `ad_costs` for a
   week; spend per account and day equals the platform's report.
8. **Identity graph.** Check (M1): identity tests pass; (M2) the quality page shows coverage.
9. **Agents and crawlers.** Check (M1): verified and spoofed fixtures land in the right classes.
10. **Schedules, checks, annotations, agent guides.** Check (M1): the annotation tests on
    the ontology harness; (M3) `segmentstream schedule list` shows the schedules and the
    agent answers a CPA question naming its model.
11. **Migration**, if replacing a tool: parity for at least two full weeks, optional GA4
    history. Check (M3): every `differs` row has a cause.

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
# pipeline/marketing/sql.py: the reporting day of a UTC timestamp. DATE cannot be redefined on
# DuckDB, so use BigQuery's DATETIME(timestamp, time_zone); the test harness defines it on DuckDB.
@ibis.udf.scalar.builtin(name="DATETIME")
def _local_datetime(value: dt.Timestamp(timezone="UTC"), zone: str) -> dt.timestamp: ...

def local_date(value: ir.TimestampValue, zone: str) -> ir.DateValue:
    return _local_datetime(value, zone).date()  # BigQuery: DATE(DATETIME(ts, 'Europe/Berlin'))

# pipeline/models/web_events_tracker.py: the real adapter. Receipt-time window, local dates, retry collapse.
# daily(column) is the project's one helper returning s.Partitioning.Daily(column=..., start_date=..., timezone=REPORTING_TZ).
events_web = s.external_table(  # the table `segmentstream events get web` reports; UTC receipt days, so unpartitioned here
    tier=s.Tier.Bronze, key="events_web_v2", partitioning=s.Partitioning.Unpartitioned,
)

@s.model(tier=s.Tier.Silver, key="web_events", group="web", partitioning=daily("event_date"), schema=WEB_EVENTS_SCHEMA)
def web_events_tracker(context: s.Context, events_web_v2: ir.Table) -> ir.Table:
    days = sorted(date.fromisoformat(key) for key in context.partition_keys)
    rows = events_web_v2.filter(  # also the capture's required partition filter, widened for late beacons
        events_web_v2.received_at >= ibis.timestamp(f"{days[0] - timedelta(days=1)}T00:00:00+00:00"),
        events_web_v2.received_at < ibis.timestamp(f"{days[-1] + timedelta(days=3)}T00:00:00+00:00"),
        events_web_v2.event_id.notnull(),
    )
    rows = rows.mutate(event_date=local_date(ibis.coalesce(rows.event_time, rows.received_at), REPORTING_TZ))
    rows = rows.filter(rows.event_date.isin(days))
    first = ibis.window(group_by="event_id", order_by=["received_at", "capture_id"])
    rows = rows.mutate(_n=ibis.row_number().over(first)).filter(lambda t: t._n == 0).drop("_n")
    return project_web_events(rows, adapter="tracker")

def project_web_events(rows: ir.Table, adapter: str) -> ir.Table:  # abridged: one entry per row of the 6.3 table
    p, write_key = rows.body["payload"], rows.auth_mode == "write_key"
    def text(value):
        return value.unwrap_as("string")  # NULL for JSON numbers on BigQuery: the site sends value as "120.00"
    return rows.select(
        event_id=rows.event_id, event_type=rows.event_type, event_time=ibis.coalesce(rows.event_time, rows.received_at),
        event_date=rows.event_date, received_at=rows.received_at, adapter=ibis.literal(adapter), admission=rows.auth_mode,
        anonymous_id=text(p["context"]["anonymous_id"]),
        request_id=ibis.coalesce(text(p["context"]["request_id"]), text(p["visitor"]["request_id"])),
        ip=ibis.ifelse(write_key, text(p["visitor"]["ip"]), ibis.null("string")),
        value=text(p["value"]).cast("decimal(38, 9)"), currency=text(p["currency"]).lower(),
        # ...
    ).cast(WEB_EVENTS_SCHEMA)

class LastClick:  # pipeline/marketing/attribution.py: one attribution plugin
    name, version = "last_click", "last_click/1"
    def allocate(self, candidates: ir.Table) -> ir.Table:
        order = [candidates.session_start.desc(), candidates.session_date.desc(), candidates.session_id.desc()]
        ranked = candidates.mutate(_n=ibis.row_number().over(group_by="conversion_instance_id", order_by=order))
        return ranked.filter(ranked._n == 0).select("conversion_instance_id", "session_date", "session_id", weight=ibis.literal(1.0))

# pipeline/models/conversions.py: two assets per declared conversion, made by a factory over the registry.
def conversion_assets(conversion: Conversion):
    @s.model(tier=s.Tier.Silver, key=f"conversion_events_{conversion.name}", group="conversions",
             partitioning=daily("conversion_date"), schema=EXTRACTION_SCHEMA)
    def conversion_events(web_events: ir.Table, sessions: ir.Table) -> ir.Table:
        return extract(conversion, web_events, sessions)  # the registry's extractor, plus traffic_group

    @s.model(tier=s.Tier.Silver, key=f"conversions_{conversion.name}", group="conversions",
             partitioning=s.Partitioning.Unpartitioned, storage=s.TableStorage(partition_by_date="conversion_date"),
             schema=COUNTED_SCHEMA, inputs={"events": s.AllPartitions(f"silver/conversion_events_{conversion.name}")})
    def conversions(events: ir.Table, identities: ir.Table) -> ir.Table:
        return count(conversion, events, identities)

    return conversion_events, conversions

CONVERSION_ASSETS = [asset for conversion in CONVERSIONS for asset in conversion_assets(conversion)]
# gold/conversion_report reads every conversions_<name>: one parameter per table, through an explicit
# signature (docs/pipeline-notes.md, "Assets generated from a registry"). Attribution does the same per plugin.

# pipeline/models/campaigns.py: the latest successful capture per account, empty captures included.
campaign_ledger = s.external_table(
    tier=s.Tier.Bronze, key="google_ads_campaigns__snapshots", partitioning=s.Partitioning.Unpartitioned,
)

@ibis.udf.scalar.builtin(name="JSON_QUERY_ARRAY")  # tests: CREATE MACRO json_query_array(j) AS json_extract(j, '$[*]')
def json_query_array(value: dt.JSON) -> dt.Array(dt.JSON): ...

@s.model(tier=s.Tier.Gold, partitioning=s.Partitioning.Unpartitioned, schema=CAMPAIGNS_SCHEMA,
         inputs={"ledger": campaign_ledger})
def campaigns(google_ads_campaigns: ir.Table, ledger: ir.Table) -> ir.Table:
    scoped = ledger.select("snapshot_id", "snapshot_at", scope=json_query_array(ledger.scopes).unnest())
    scoped = scoped.select("snapshot_id", "snapshot_at", account_id=scoped.scope["account_id"].unwrap_as("string"))
    order = [ibis.desc("snapshot_at"), ibis.desc("snapshot_id")]
    latest = scoped.mutate(_n=ibis.row_number().over(group_by="account_id", order_by=order))
    latest = latest.filter(latest._n == 0).select(l_snapshot="snapshot_id", l_account="account_id")
    c = google_ads_campaigns
    rows = c.join(latest, [c._snapshot_id == latest.l_snapshot, c.account_id == latest.l_account])
    return rows.select(campaign_key="google_ads:" + rows.account_id + ":" + rows.campaign_id, ...)  # abridged
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
