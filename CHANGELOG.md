# Changelog

What changed in each blueprint, newest first. An agent updating a project built
from an earlier version reads the entries since the version recorded in the
project's `BLUEPRINTS.md` (see [AGENTS.md](AGENTS.md#updating-a-build)).

Each entry names the blueprint and its new version, what changed, and what a
project built from the previous version should do.

## Marketing analytics 1.1.0

Collection follows the visitor's consent with `@segmentstream/web-tracker` 0.2.

- The browser tracker gets the banner's choice (`consent`) and `withoutConsent`. By
  default, views before consent arrive at once with an ID for that page load only and no
  cookie, and on Accept a first visit keeps that ID, so its landing view and campaign stay
  with the visitor. `withoutConsent: "nothing"` holds views until Accept instead
  (VARIATIONS, "Consent, cookies and retention").
- A site with no server code can let the tracker write `ss_aid`
  (`cookie: { writer: "tracker" }`).
- `silver/web_events` and `webSession` gain `consent`. Visitors and people count a visitor
  without consent once per page load, so the data quality page shows the share of
  sessions with consent (PITFALLS 23).
- The middleware sketch read an existing `ss_aid` without checking consent. It now reads,
  creates and renews the cookie only with consent and removes it on a refusal
  (BLUEPRINT 10, PITFALLS 21).

A project built from 1.0.0:

1. Update `@segmentstream/web-tracker` to 0.2.
2. Read `ss_aid` in the middleware only with consent, as in the sketch, and pass `consent`
   to `requestEvent`.
3. Give the browser tracker `consent` and `withoutConsent`, call `consentChanged()` from
   the banner, and store `tracker.anonymousId()` in `ss_aid` on Accept.
4. Add `consent` to `web_events` and `webSession`, and the consent share to the data
   quality page.

Changing consent or cookie behavior on a live site needs the person's approval
(INTERVIEW, "Decisions that need a person every time").

## Initial release

| Blueprint | Version |
| --- | --- |
| [Marketing analytics](blueprints/marketing-analytics/) | 1.0.0 |
| [CRM](blueprints/crm/) | 0.1.0 |
| [Email marketing](blueprints/email-marketing/) | 1.0.0 |
| [Bookkeeping](blueprints/bookkeeping/) | 1.0.0 |
| [Ad fraud detection](blueprints/ad-fraud-detection/) | 1.0.0 |
| [Company agent](blueprints/company-agent/) | 0.1.0 |
| [Drive](blueprints/drive/) | 1.0.0 |
| [E-signature](blueprints/e-signature/) | 1.0.0 |

The CRM and marketing analytics blueprints were built end to end by a coding
agent from these files before release, to milestone M1 with every invariant
tested, and corrected where the agent stumbled. Their `testedWith` records the
SDK versions of those builds. The test harnesses in [`kernel/`](kernel/), the
shared [pipeline notes](docs/pipeline-notes.md) and the marketing analytics
worked example in `fixtures/` came out of those builds.
