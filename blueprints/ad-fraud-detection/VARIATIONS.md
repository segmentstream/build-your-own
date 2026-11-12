# Ad fraud and bot detection: variations

The default is production as described in BLUEPRINT.md. Options marked **not in
production** are designs SegmentStream has not built or runs only partly; they are sound,
but you build and test them yourself.

## Where server evidence comes from

| Option | What changes | Notes |
| --- | --- | --- |
| Vercel (default when the site runs there) | The tracker's server part as documented; JA4, client hints, location and the IP come from the platform's request headers. | Production. |
| Another edge (Cloudflare Workers, Fastly, a reverse proxy) | A small sender maps that platform's request metadata to the same `payload.visitor` fields. | Fields the platform does not expose stay null, and the rules that need them simply never fire. JA4 is not available everywhere. |
| An origin server behind a CDN | The IP comes only from the CDN's trusted header. | A client-settable `X-Forwarded-For` makes every address rule the attacker's choice. |
| Browser only (no server code) | No `http_request` events; every hit is `client_only`. | Scripts that never run JavaScript become invisible, and the request-header rules never fire. |

## AI agents

| Policy | `ai_assistant` | `autonomous_agent` | Their conversions |
| --- | --- | --- | --- |
| Production (default) | invalid: a fetch while answering someone, not a visit; reported on the agents page | suspicious | autonomous: counted, flagged; assistant fetches: not counted |
| Agents as customers | suspicious | valid | counted |
| Agents as invalid traffic | invalid | invalid | not counted, never sent as conversions |

A business whose buyers choose through assistants may prefer the second; one paying per
click on display networks the third. Change the verdict step (6.6) and the counting
policy (6.8) together, and bump `RULES_VERSION`.

## Your own traffic

- **Constants in pipeline code** (default, production): internal tool user-agent
  prefixes, one reserved `utm_medium` marker, local and preview-deployment hosts, exact
  confirmed test submission IDs, and your own domains for the external-referrer test.
  Reviewed and deployed like rules.
- **Known sources as records** (not in production): a stored `knownSource` entity
  (`kind`: IP network, user-agent token, browser ID, landing host or submission ID;
  `value`; `treatment` `internal` or `tool`, never "human"; `reason`; optional
  `expiresAt`; managed `status`) with `writes: "actions"` and actions `add` (refuses an
  IPv4 network wider than /16 or IPv6 wider than /32, tokens under four characters or
  generic browser tokens such as `Mozilla`, `Chrome`, `Safari`; an active duplicate
  returns unchanged), `update` and `retire`, plus a daily workflow retiring expired
  ones. The pipeline reads active, unexpired rows from the replicated view, so analysts
  add an office network without a deploy. It moves a decision from code into live state,
  so give `add` no non-destructive hint and never grant it to a workflow role or agent
  task.

## Reviewing verdicts

- **No review records** (default, production): reviewers read the proof; a wrong rule
  is fixed in a rules release.
- **Verdict reviews** (not in production): a stored `verdictReview`, one per session
  (`sessionId` unique, `decision` `confirm`, `valid` or `invalid`, `note` required
  unless confirming, the verdict and rules version seen), with actions `review` and
  `withdraw`. `traffic_sessions.effective_verdict` takes the review's `valid` or
  `invalid`, else `verdict`; the computed verdict and reasons never change, so reviews
  become labels for tuning rules. Reports and counting already read `effective_verdict`.

## Verifying declared agents

- **Published IP lists** (default, production): each vendor's own list, refreshed by
  `references`, fresh for 60 days.
- **Web Bot Auth signatures, cryptographically** (not in production): production records
  `Signature-Agent`, `Signature-Input` and whether a `Signature` header was present, and
  treats a recognized signer host as a declaration only. To verify, check the HTTP
  Message Signature at the edge, at request time, against the key directory the
  `Signature-Agent` names, and send the result in the request event's `request` fields;
  then record method `signature_verified` from write-key events only.
- **Reverse DNS** (not in production): some search engines document forward-confirmed
  reverse DNS for their crawlers. It needs a lookup at request time, or an ingestion that
  asks a DNS-over-HTTPS service through a declared public connection, cached by address.

## Network intelligence

- **The 21 public lists** (default, production): crawler lists, five clouds, three hosting
  networks, Private Relay.
- **Tor exit list** (not in production for detection): the public list at
  `https://check.torproject.org/torbulkexitlist` (one IP per line), through a public,
  read-only connection such as `public_tor` with API `exits`:
  `https://check.torproject.org/`. Production declares this feed only for a connection
  acceptance test. Add it as a list of category `tor` and, at most, a weak rule; never
  decisive.
- **More hosting networks**: add autonomous systems to the RIPE-announced connection as
  further APIs, one list each.
- **Licensed VPN and residential-proxy data**: load it as another list through its
  connection; licence terms may limit how long you keep it.

## Thresholds and the time-zone map

Production values: 20 browser IDs per IP per day, 60 hits per IP per hour, 300 per day,
3 seconds for a form, 60 days of list freshness, a weak score of 2, 25 points of daily
drift, 5% generic bots. They were set from a few days of observed scanner traffic on one
site and are reviewed after each release. A site with far more traffic behind shared
addresses may need higher per-IP thresholds; a site with very little may lower the
drift alert. Extend the country-to-continent map in `geo_tz_mismatch` for your markets.
Every change bumps `RULES_VERSION`.

## Refresh cadence

| Option | Schedules | When |
| --- | --- | --- |
| Marketing-analytics' defaults (default) | `web_analytics` daily, `references` weekly | Reports read the day before. |
| Production | rebuild hourly at minute 5 UTC; lists daily at 04:00 UTC | Verdicts within the hour; costs a run each hour. |

## Click-time evidence and phantom clicks (not in production)

Production reserves these tables but has not built them; they need an ads connection.

- `bronze/google_ads_click_view`: billed clicks from the Google Ads click view (the
  `google_ads` connection marketing-analytics declares), one day per query, for recent
  days.
- `silver/paid_clicks`, one per click ID: date, platform, click ID type and value,
  matched `session_id`, its verdict, IVT class and reasons, campaign, ad group, keyword,
  network, device, and `phantom` when no hit of any source carried the click ID within
  30 minutes.
- `gold/segment_quality`, per day, platform and campaign: clicks, phantom rate, invalid
  and suspicious share, and the platform's own invalid-click rate.

Match against every hit, server-only included: a blocked tracker is not a phantom. Most
other platforms report clicks only in aggregate; their sessions are judged either way.

## Acting on verdicts

| Option | What it adds | In production |
| --- | --- | --- |
| Report only (default) | Reports, proofs, CSV export | Yes |
| Conversion hygiene | Every conversion feed to an ad platform sends only `counted` conversions | Counting yes; feeds are marketing-analytics' destinations |
| IP exclusion proposals | `gold/ip_exclusion_proposals` (IP, platform, invalid sessions, spend at risk, expiry, state), approved by a person and sent through a connection that admits writes | No: reserved schema only |
| Retract sent conversions | Propose retractions for conversions later judged invalid; a person approves each batch | No |
| Refund claims | Per-click evidence exported from the proof | No |

Never propose shared addresses (Private Relay, carrier NAT, office proxies); give every
exclusion an expiry.

## A decision model for the grey zone (not in production)

Production is rules only. A company may add a scorer for sessions without a decisive
rule: build a request table with an evidence summary and an evidence hash, and no IP,
browser ID, click ID or email; let a decider asset (your own trained score, or a model
called through a connection) answer each hash once; take its answer only for sessions the
rules left `valid` or `suspicious`, and only for the current hash. It never overrides a
hard rule. A general chat model asked per session is the wrong tool: slow, costly, and its
confidence is not calibrated.

## The rule catalogue as a table

- **Mirrored in the app** (default, production): the app keeps a reader-facing copy of
  keys, labels, IVT classes and descriptions, changed with each rules release.
- **Published** (not in production): an ingestion writes `bronze/ref_traffic_rules` from
  the Python catalogue; the app and the agent read labels from it.

## Privacy and jurisdiction

IP addresses and browser IDs are personal data in the EU, the UK and many other places.
Fraud prevention is commonly cited as a legitimate interest, but the tracker, its storage
and retention still need your privacy notice and possibly consent. Ask counsel; do not
decide this in code.

| Option | What changes |
| --- | --- |
| One permission for evidence pages (default, production) | Whoever reads leads or conversions sees raw IPs on Traffic quality and the proof. |
| A separate evidence permission | A `trafficHit` entity over `silver/traffic_hits` (or any marker entity) whose `:read` the evidence pages check; marketing keeps the reports without addresses. |
| Limited retention | Set the stream's `retention_days`; behaviour counts and full rebuilds then see less history. |
| Truncated addresses in exports | The CSV shows /24 (IPv4) or /48 (IPv6) networks; the proof keeps full addresses for analysts. |

## Traffic volume

- **Full rebuild of all history** (default, production).
- **Large sites**: daily-partitioned classification over a recent window, with behaviour
  counts over that window; older days keep their verdicts, and list or rule changes
  reach history only through an explicit backfill.

## Industry

- **Lead generation**: form bots are the main cost; the form profile, `fast_form` and
  `false_positive_guard` matter most.
- **E-commerce**: card testing and checkout abuse are out of scope; use your payment
  provider's fraud tools.
- **Publishers selling inventory**: certified IVT measurement needs accredited vendors;
  this build informs, it does not certify.
- **Mobile apps**: install fraud belongs to a mobile measurement partner.
