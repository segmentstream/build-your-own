# Variations

Where companies legitimately differ. Each variation lists the options, what each one
changes, and the default this blueprint takes.

## Site stack

- **Next.js on Vercel** (default): the browser tracker in a client component, the server
  part in `proxy.ts` (middleware), `Server-Timing` from `x-vercel-id`. Request evidence
  (country, city, JA4) comes from Vercel's headers.
- **Another Node host or framework**: the same package, whose server snapshot reads
  Vercel's headers. Send the request ID your host or your own middleware generates in
  `Server-Timing` and in the event's `request` fields, take the IP only from the host's
  trusted header (a client can set `X-Forwarded-For`), and accept null geo fields where
  the host adds none, or derive country from your CDN's header in your own snapshot with
  the same field names.
- **A non-JavaScript backend or a static site behind a CDN**: the browser tracker only,
  plus a small server or edge function that posts `http_request` and conversion events
  with the write key. Without server events, there is no agent and crawler report.
- **Several sites or brands**: one stream, all origins declared, and the site's host kept
  on every hit so reports can filter; separate streams only when access must differ.
- **Where the site's code lives**: in the site's own repository (default when the agent
  can work there), changed and tested there; otherwise in `site-integration/` in the
  project, outside every deployed component, for the person to copy.

## What is collected

- **Browser and server** (default): page views paired with document requests; the only
  shape that sees crawlers and AI agents.
- **Browser only**: simpler, no write key on the site's server for page views; no agent
  report and weaker bot separation. Conversions still need server events.
- **Server only**: for sites that cannot run scripts; no client signals, so sessions of
  people and bots are harder to tell apart.

## Product analytics in a signed-in app

When the tracked app is the SegmentStream workspace app itself, it holds no keys: declare
a separate origin-only stream, record pages by route pattern (`/orders/[id]`, never path
values) with the member's `user_id` and no anonymous ID, and build a `pageView` entity on
those hits. Conversions then come from ontology records (a lead, a signed contract)
through a conversion extractor over the replicated `ontology.<entity>` view, not from
server events. Default: not built.

## Consent, cookies and retention (country law)

- **Consent-gated cookie** (default): `ss_aid` is set only when the site's consent banner
  allows analytics; without it, hits carry no anonymous ID and each forms its own session.
- **Cookieless**: never set `ss_aid`; reports keep sessions and channels per hit but lose
  returning visitors, journeys and most attribution beyond the landing visit.
- **Exempt audience measurement**: some regulators exempt first-party analytics that meet
  strict conditions from consent. Whether that applies is a legal decision for the
  company, recorded in its privacy policy, not a default here.
- **Retention**: `retention_days` on the stream for raw captures; aggregated tables are
  kept. Never backfill dates whose captures have expired, or they rebuild empty.
- **Erasure requests**: the platform owns the capture tables, pipeline assets never write
  them, and the project's docs describe no deletion of one visitor's captures. Agree with
  SegmentStream how captures are erased before promising it, then rebuild the affected
  dates. Keep the procedure in the project's runbook and run it only with approval.

## Session definition

- **Day boundary and signature change** (default): what SegmentStream runs; stable,
  explainable, exact per day.
- **Plus an inactivity timeout** (for example 30 minutes), closer to Google Analytics:
  add the gap to the session-start rule in step 3 of the session model. Use it when
  parity with GA session counts matters more than stability.

## Refresh

- **Daily partitions, daily schedule** (default): scales to any traffic; reports show
  complete days.
- **Full rebuild, hourly**: every model unpartitioned with physical date storage, rebuilt
  from all retained captures each hour. Simplest, picks up late events and rule changes
  everywhere; SegmentStream's own site runs this way. Fits sites with modest traffic;
  query cost grows with history.
- **Intraday**: keep the daily shape and add an unpartitioned model for today's sessions
  only, rebuilt hourly.

## Identity

- **No keys**: every visitor is a person; valid for content sites without forms.
- **Deterministic only**: `user_id` and `email_sha256`.
- **Plus click IDs** (default): short window, small fan-out.
- **Plus a CRM contact ID**: when the crm blueprint is built, an `identify` with the
  contact's ID, deterministic and exclusive.
- **Hash**: plain SHA-256 of the normalized email (default) matches the hashes ad
  platforms and CRMs compute; a keyed hash (HMAC with a workspace secret) is safer when
  no outside matching is needed, but then every producer must hold the key.

## Conversion sources

- **Server events from the site** (default): `purchase`, `lead_submitted` (a `lead`, or
  `newsletter_signup` when `form` is `newsletter`), `signed_up`.
- **An order or billing system** (WooCommerce, BigCommerce, Stripe, an ERP): an ingestion of orders through
  its connection; the extractor joins orders to sessions by an anonymous ID or email hash
  the checkout passed along.
- **CRM outcomes** (with the crm blueprint): a qualified lead or won deal read from the
  replicated CRM records becomes an offline conversion, linked by the website submission
  ID or email hash. Declare `crmLead: rel.one(Lead, { on: { occurrenceId: "submissionId" } })`
  on `conversion` so the CRM's lead page includes its conversion and credited sessions.

## Counting

- **Every business ID once** (`once_per_occurrence`, default): every order counts.
- **Again after n days** (`occurrence_after_days(n)`): a subscription renewal or a
  re-submitted form counts again once n days have passed since its last counted one.
- **One per person per window** (`person_window_days(n)`): one lead per person a month.
  Needs the identity graph. Both windowed rules compare with the last *counted*
  observation, so they iterate (BLUEPRINT 6.10).

## Attribution

- **First and last click** (default), both computed, last click shown first.
- **Last non-direct click**: a plugin that drops direct sessions unless no other session
  exists; common when matching older Google Analytics reports.
- **Windows per conversion**: shorter for impulse purchases, longer for B2B leads.
- **Other rule-based models** (linear, position-based) can be written against the same
  plugin contract and must pass the same weight checks.

## Ad platforms

- **Google Ads and Meta** (default).
- **Microsoft Ads, LinkedIn Ads, TikTok Ads, X Ads**: managed connections exist; each
  adapter maps its report to the cost contract, its click ID to the catalogue, and its
  URL tags to UTMs. Some have no click-level report; stitching then relies on UTMs and IDs.
- **Market-specific platforms** (for example a national search engine or marketplace
  ads): a custom connection and an adapter to the same contract.
- **Spend without an API** (sponsorships, influencers, events, affiliates): a Google Sheet
  read through `GoogleSheetsConnection`, one row per date, channel, campaign and amount,
  mapped to the contract with `platform = 'manual'`.

## Currencies

- **Per currency** (default): every money metric is filtered or grouped by currency.
- **Reporting currency**: add a daily FX rate table (from a public central bank feed
  through a declared connection) and converted minor-unit columns in the gold tables, with
  the rate date and source beside each converted value. Never overwrite the original.

## Channel groups

The default rules are the table in BLUEPRINT 6.6, and their lists are config. Companies
add groups (partners, app stores, marketplaces) as new rows, split organic social by
network, or map their own UTM mediums. Changing the rules changes history on the next
rebuild; annotate the change.

## Migration

- **From Google Analytics 4 with a BigQuery export**: the `ga4_history` job maps the
  export into the event contract for dates before the cutover day, with
  `user_pseudo_id` prefixed `ga4:`; GA's key events become conversions with their
  transaction IDs. Set the GA property's time zone equal to the reporting time zone, or
  choose the cutover at a day boundary in both.
- **From a tool without a raw export**: no history import; the parity kit reads the old
  tool's daily export from a sheet while both run.
- **No previous tool**: skip the parity kit.

## Sending data back to ad platforms

Uploading offline conversions or audiences to ad platforms is a destination (see the
project's `docs/destinations.md`). It is not part of the default build, needs its own
approval of what is sent, and must send only what the platform's terms and the
company's consent allow.

## Traffic quality

The basic classes here separate people, agents, crawlers and obvious bots. Paid-traffic
fraud, invalid-click evidence and tuned rules come from the ad-fraud-detection
blueprint, which judges the same hits and sessions in its own `silver/traffic_sessions`;
counting, attribution and `session_report` then read its verdicts.
