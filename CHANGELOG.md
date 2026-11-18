# Changelog

What changed in each blueprint, newest first. An agent updating a project built
from an earlier version reads the entries since the version recorded in the
project's `BLUEPRINTS.md` (see [AGENTS.md](AGENTS.md#updating-a-build)).

Each entry names the blueprint and its new version, what changed, and what a
project built from the previous version should do.

## Foundation: every stored record reaches the warehouse

Replication to the warehouse is always on. The platform is removing exclusions of
entities, fields and relationships, and pausing replication, so the convention
"Private entities stay out of the warehouse" is replaced by "Every stored record
reaches the warehouse". Warehouse SQL applies no ontology permission, so a design
grants warehouse access only to people who may read every record, shows records on
screens through the ontology, stores a token only as its hash, and keeps data that
must not reach the warehouse out of stored entities. The entries below apply this to
each blueprint that excluded records.

A project built on the earlier foundation:

1. Has nothing to undo in code: exclusions were a workspace setting. Once the
   platform removes them, expect the excluded entities and fields in the warehouse.
2. Keeps warehouse access to people who may read every record.
3. Moves any screen that shows warehouse SQL over records some of its users may not
   read to finds, actions or metric queries.
4. Stores the SHA-256 hash of any stored token instead of the token, as the email
   marketing entry describes.

## CRM 0.2.0

Lead `name`, `message`, `answers` and `attribution`, and Activity `body`, are no
longer excluded from replication. "What stays out of the warehouse" becomes "What
reaches the warehouse": every CRM field does, so warehouse access goes only to people
who may read every lead and activity, and screens read them through the ontology.
The "Private by team" variation says that warehouse readers still read every team's
records.

A project built from 0.1.0 has nothing to undo. Once the platform removes
exclusions, expect those fields in the warehouse, and check who can query it.

## Email marketing 2.0.0

An unsubscribe token is stored only as its hash, and every unsubscribe link of every
delivered email works (new invariant 25).

- `EmailMessage.unsubscribeToken` is replaced by a new entity, `UnsubscribeKey`: the
  SHA-256 hex of one token (`tokenHash`, unique) and its `message`. A message has a
  key for every token it was sent with. `plan` no longer makes tokens.
- `sendCampaign` draws a random seed for the run in its first step and gives each
  message the HMAC-SHA256 of its id under the seed as its token. For each message it
  first records the token's hash with the new action `emailMessage.issueToken`
  (granted to `campaignSender` only), then calls `send` with the token.
- `send` refuses a malformed token or one whose hash is not a key of the message,
  renders the token into the link, and posts with
  `Idempotency-Key: campaign-message-<id>-<first 12 hex characters of the token's hash>`.
  A retried page within a run repeats the same request; a run the clock resumes
  sends a new one.
- `unsubscribe` hashes the token it is given and finds the key, then its message.
- Invariant 14 now says what a resumed run may do: when the provider accepted an
  email and recording it failed, the resumed run sends the message again with a new
  token, and both links work. A duplicate is preferred to a link that unsubscribes
  nobody (PITFALLS 4 and the new 15).
- Replication excludes nothing: addresses, consent records and messages reach the
  warehouse, and warehouse access goes only to people who may read all of them.
- Invariant 18's test uses the token the message was sent with. The double opt-in
  variation records its confirmation token's hash before the email is sent and
  stores no token; the large-list variation issues keys before a batch.

A token kept beside its hash would still reach every replicated row, so the field
is removed, not kept. A project built from 1.0.0:

1. Add `UnsubscribeKey` (written only by actions), `emailMessage.issueToken`, and
   `email_message:issueToken` in `campaignSender`. Make `unsubscribe` find the key by
   the token's hash, falling back to `unsubscribeToken` until step 3. Change `send`
   and `sendCampaign` as in the sketch, stop `plan` from making tokens, and deploy.
2. Run a one-time workflow that pages through messages with an `unsubscribeToken`
   and, through an action, adds a key with the token's SHA-256 hex unless that key
   exists, then clears the token, so links in emails already sent keep working. It
   never replaces or removes a key: a message sent after step 1 already has the key
   of the token it was sent with.
3. Remove the fallback and the `unsubscribeToken` property. Wherever a test runs
   `send`, issue the token's key first and pass the token. Update the test for
   invariant 14 and add the test for invariant 25.

Do it soon: once the platform removes exclusions, every value still stored
replicates, the tokens included. Clearing a token does not remove it from the
message's history or from rows already replicated.

## Bookkeeping 2.0.0

Restricted documents are no longer excluded from replication. Invariant 25 no
longer tests that `restricted_document` is absent from replication, and its reason
says the warehouse is outside the rule: whoever can query it reads every finance
record. The design, interview question 11, the payroll variation and pitfall 13 keep
a restricted file's contents out of every field, since only the file's bytes stay in
file storage, and grant warehouse access only to people who may read every finance
record.

A project built from 1.0.0:

1. Remove the replication check from the test for invariant 25; it fails once the
   platform removes exclusions.
2. Expect restricted documents' titles and fields, not their files, in the
   warehouse. Check that none copies a file's contents, and who can query the
   warehouse.

## Company agent 0.2.0

Questions and routine runs are no longer excluded from replication. Invariant 20 is
retired. Section 6 says that whoever can query the warehouse reads every question,
answer and routine message, and that a question never asks for a password, a
sign-in code or a card number. Build order step 6 no longer excludes them.

A project built from 0.1.0:

1. Delete the test for invariant 20.
2. Grant warehouse access only to people who may read every question and routine
   message, finance ones included.
3. Say in `question.raise`'s description that a question never asks for a
   password, a sign-in code or a card number.

## Drive 2.0.0

Drive entities are no longer excluded from replication: every Drive record reaches
the warehouse, where neither `accessOf` nor the fence applies. Invariant 21 is
retired, and the new invariant 22 says the app never reads Drive records with
warehouse SQL. Section 6 says who may query the warehouse, that link tokens stay
hashed, and that content which must not reach warehouse readers is uploaded as a
file under a title that says nothing private. Build order step 1, pitfall 14,
interview question 3, the README and the Search and Reporting variations follow.

A project built from 1.0.0:

1. Delete the test for invariant 21. Add the test for invariant 22, and move any
   screen that reads Drive through `segmentstream.warehouse` to actions and fenced
   finds.
2. Once the platform removes exclusions, expect every Drive entity in the
   warehouse. Grant warehouse access only to people who may open every document,
   every confidential class included.
3. With full-text search, extract no text in a class whose content must not reach
   warehouse readers.

## E-signature 1.1.0

Recipients, signatures and events are no longer excluded from replication. Section 6
says they reach the warehouse with their emails, IP addresses, field values and
drawn signatures, that warehouse access goes only to people who may read every
envelope, and that nothing replicated lets a reader sign. Build order step 3 tells
the person instead of excluding them.

A project built from 1.0.0 has nothing to undo. Once the platform removes
exclusions, expect those three entities in the warehouse, and check who can query
it.

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
  (BLUEPRINT 10, PITFALLS 21), and invariant 27 tests it.

A project built from 1.0.0:

1. Update `@segmentstream/web-tracker` to 0.2.
2. Read `ss_aid` in the middleware only with consent, as in the sketch, and pass `consent`
   to `requestEvent`.
3. Give the browser tracker `consent` and `withoutConsent`, call `consentChanged()` from
   the banner, and store `tracker.anonymousId()` in `ss_aid` on Accept.
4. Add `consent` to `web_events` and `webSession`, and the consent share to the data
   quality page.
5. Add the test for the new invariant 27: without consent, the site keeps no anonymous
   ID.

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
