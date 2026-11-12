# Ad fraud and bot detection: variations

## Keeping your rules private

Publishing detection logic helps evaders. The example rules in this blueprint
are public and well known, so serious bots already pass them. Your edge comes
from what you add on your own traffic: thresholds, extra consistency checks
(TLS fingerprint against browser family, fetch metadata against browser
version, form timing, time zone against country), the agent catalogue you
curate, and your decider.

- **Default:** the workspace repository stays private; thresholds live in the
  models' `s.Config`, set in the job's `config`, not in prose; the Rules page
  and the proof are visible to members only.
- **Never:** publish tuned rules or thresholds on a website, in a public
  repository, in a support article, or in a response the visitor can see. Do
  not tell a blocked or flagged visitor which rule fired.

## Where server evidence comes from

| Option | What changes | Notes |
| --- | --- | --- |
| Vercel (default when the site runs there) | The tracker's server part as documented; JA4, client hints and location come from the platform's request headers. | |
| Another edge (Cloudflare Workers, Fastly, a reverse proxy) | A small sender maps that platform's request metadata to the same `payload.visitor` fields. | Fields the platform does not expose stay null. JA4 is not available everywhere. |
| An origin server behind a CDN | The IP comes only from the CDN's trusted header, never from a header the client can set. | A spoofable `X-Forwarded-For` turns every rule about addresses into the attacker's choice. |
| Browser only (no server code) | No `http_request` events; hits are all client-only. | Scripts that never run JavaScript become invisible: harmless for analytics, but phantom clicks then need click reports. |

## Click-time evidence

- **None** (default without an ads connection): clicks are seen only through
  click IDs on sessions.
- **Click-level reports** (default with Google Ads): billed clicks matched to
  sessions; phantom clicks counted. Most other platforms report clicks only in
  aggregate; check before promising phantom-click reports for them. Their
  sessions are judged either way.
- **A click-time ping**: platforms that support parallel tracking call a
  tracking URL from the browser at click time. A small endpoint records that
  request's evidence (IP, user agent, TLS) into the stream, so phantom clicks
  get an address. Needs its own route on the site, sending with the write key,
  and a consent review.

## The decision step

| Option | What it is | When |
| --- | --- | --- |
| `rules` (default) | The SQL decider in BLUEPRINT.md: decisive rules, then identity. | Always first; stays in place for decisive cases. |
| Your own score | A model trained on reviewed sessions and outcomes, applied in SQL or loaded by an ingestion. | Once you have a few hundred reviews and outcome-labelled sessions. |
| A decision model service | An ingestion sends evidence summaries through a connection and stores a verdict with a probability per question (kind of visitor, strength of automation evidence, consistency of the browser's description). | When the grey zone is large and you want calibrated probabilities from day one. Calibrate against outcomes. |
| A vendor or CDN bot score | Ingested as another decider's answer, or as a context finding. | When you already pay for one. |

A general chat model, asked per session, is the wrong tool: slow, costly at
volume, and its "90% sure" is not a calibrated number. Whatever the decider,
it never sees identifiers (invariant 14) and never overrides a decisive rule
(invariant 13).

## AI agents

| Policy | Verdict for `agent` | Outcomes |
| --- | --- | --- |
| Separate group (default) | suspicious | counted, flagged |
| Treat as customers | valid | counted |
| Treat as invalid traffic | invalid | not counted, never sent as conversions |

A business that sells to people choosing through assistants may prefer the
second; a business paying per click on display networks may prefer the third.

## Verifying declared agents

- **Published IP lists** (default): the vendor's own list, refreshed by the
  `references` job.
- **Reverse DNS**: some search engines document forward-confirmed reverse DNS
  for their crawlers. It needs a lookup at request time, or an ingestion that
  asks a DNS-over-HTTPS service through a declared public connection (workspace
  code sends no direct third-party requests); cache results by address.
- **Web Bot Auth signatures**: an agent signs its requests (HTTP Message
  Signatures with a `Signature-Agent` key directory). Verifying the signature
  cryptographically belongs at the edge, at request time, where the covered
  request components exist. Send the result with the server event, in the
  `request` fields of `requestEvent` (which builds `payload.visitor` itself
  and would overwrite a `visitor` field); the pipeline then records method
  `signature_verified`, from write-key captures only. Without it, a signer
  host is only a declaration.

## Network intelligence

- **Public lists** (default): vendor crawler lists, cloud and hosting ranges,
  Private Relay egress.
- **Tor exit list**: public; a context finding, never decisive.
- **Licensed VPN and residential-proxy data**: the one part of network
  intelligence worth paying for; load it as another `ref_ip_ranges` list
  through its connection. Licence terms may forbid storing it beyond a period.
- **Carrier ranges**: where you can identify mobile carrier NAT ranges, mark
  them shared so they never become exclusion candidates.

## Acting on verdicts

| Option | What it adds | Default |
| --- | --- | --- |
| Report only | Reports, proofs, CSV exports for manual exclusions. | Yes |
| Conversion hygiene | The `effective_verdict` filter on every conversion feed. | Yes, whenever a feed exists |
| Retract sent conversions | A workflow proposes retractions for conversions later judged invalid; a person approves each batch. | No |
| Address and placement exclusions | A stored `exclusion` entity (target, platform, evidence, expiry; `propose`, `approve`, `apply`, `expire`), an `after(approve)` workflow sending it through a connection marked `delivers: true`, and an expiry sweep. Never for shared addresses; always with an expiry; within each platform's limit on excluded addresses per campaign. | No |
| Refund claims | Per-click evidence exported from the proof for the platform's invalid-click investigation. | No |

Check what your ads connection admits in your project's `docs/connections.md`
before building a sending workflow. Where it cannot write the change, export
for manual upload and report the gap as a need, not a workaround.

## Privacy and jurisdiction

IP addresses and browser IDs are personal data in the EU and UK, and in many
other places. Fraud prevention is commonly cited as a legitimate interest
under the GDPR, but the tracker, its storage and the retention period still
need your privacy notice and, for client-side storage, possibly consent. Ask
counsel; do not decide this in code.

| Option | What changes |
| --- | --- |
| Keep raw IPs as long as events (default) | Full rebuilds keep working over all history. |
| Limited retention | Set the stream's `retention_days` and expire raw IPs in the silver tables that copy them; make classification models daily-partitioned so expired days keep their last verdicts instead of disappearing from a full rebuild. |
| Truncated addresses in reports | Exclusion candidates and exports show /24 (IPv4) or /48 (IPv6) networks; the proof keeps full addresses for analysts. |

## Traffic volume

- **Small and medium sites** (default): full rebuild on every refresh.
- **Large sites**: daily-partitioned classification over a recent window
  (for example the last 7 days, `s.LatestPartitions(7)`), with behaviour
  counts computed over that window; older days keep their verdicts. Lists and
  rule changes then reach history only through an explicit backfill.

## Lead forms and the CRM

- **Default:** form submissions are judged with the form profile; leads from
  invalid sessions stay in the CRM, flagged through the session's verdict.
- **With the crm blueprint:** the lead stores the session ID it came from (an
  identity reference, set at submission) and relates to Traffic session on
  it. Never copy the verdict into a lead property: it changes on rebuild.

## Industry

- **Lead generation**: bots that fill forms are the main cost; form timing
  and outcome checks matter most.
- **E-commerce**: card testing and checkout abuse are out of scope; route
  them to your payment provider's fraud tools.
- **Publishers selling inventory**: certified IVT measurement for advertisers
  needs accredited vendors; this build informs, it does not certify.
- **Mobile apps**: install and attribution fraud belongs to a mobile
  measurement partner, not to website verdicts.
