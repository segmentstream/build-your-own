# Changelog

What changed in each blueprint, newest first. An agent updating a project built
from an earlier version reads the entries since the version recorded in the
project's `BLUEPRINTS.md` (see [AGENTS.md](AGENTS.md#updating-a-build)).

Each entry names the blueprint and its new version, what changed, and what a
project built from the previous version should do.

## Foundation: our own companies are companies

The business's own legal entities are modelled once, as foundation companies.
`Company` is any organization, our own included:

- New managed `isOwn` (default false): one of the business's own legal entities,
  with `ownNote`, the reason for its last change. Only the new `company.setOwn`,
  granted to `admin`, sets or clears it, with a required reason. Clearing it is
  refused while a blueprint's record needs the company to be own; each such
  blueprint extends `setOwn`.
- New optional `registeredAddress`. Registered identity (`legalName`,
  `registrationNumber`, `registrationCountry`, `registeredAddress`, `taxId`) lives
  only on `Company`; other blueprints reference the own company and never copy
  these fields into settings, configuration or JSON. A finished fact (an issued
  invoice, a sent envelope) keeps a snapshot of what it printed.
- Job roles hold `company:update` scoped to `{ isOwn: false }`; `admin` holds it
  unscoped, so only an admin edits an own company's identity.
- `company.mergeInto` also refuses when the duplicate is own: a stray copy of our
  company may be merged into it, but our company is never folded away.

A project built on the earlier foundation:

1. Add `isOwn`, `ownNote` and `registeredAddress` to `Company`, and the
   `company.setOwn` action, granted to `admin`.
2. Scope job roles' `company:update` to `{ isOwn: false }` and grant `admin` the
   unscoped `company:update` and `company:setOwn`.
3. Add the `isOwn` check to `company.mergeInto`.
4. An admin marks the business's own companies with `company.setOwn`, creating a
   company first where none exists for an entity. Then follow the Bookkeeping 3.0.0
   and E-signature 2.0.0 entries below, which move their copies onto the company.

## Bookkeeping 3.0.0

A book belongs to one own company, and the seller's identity is read from it.

- `Book` gains `company`: a required relationship to a foundation `Company` with
  `isOwn` true, unique (one book per company), `onDelete: restrict`. `book.open`
  takes it and refuses a company that is not own or already has a book;
  `book.configure` never changes it. The book keeps only accounting settings.
- `issuerName`, `issuerAddress`, `issuerTaxId` and `issuerRegistration` are removed
  from `Book`. Issuing reads the seller through `book.company` and refuses a company
  without a `legalName` or `registeredAddress`.
- `SalesInvoice` gains `sellerName`, `sellerAddress`, `sellerTaxId` and
  `sellerRegistration`, copied at issue like the bill-to details: the seller the
  invoice printed. The print view of an issued invoice reads only its own copies.
- `company.setOwn` refuses to clear `isOwn` on a company with a book.
- New invariants 26 (a book belongs to one own company, and an own company has at
  most one book) and 27 (the seller is read from the book's company, and an issued
  invoice keeps what it printed). New pitfalls 16 to 18. Interview question 1, the
  "Legal entities" and "Invoices" variations, the build order and the seed follow.

A record changes in a way built projects must follow. A project built from 2.0.0:

1. Follow the foundation entry above: add `isOwn` and `registeredAddress` to
   `Company` if missing, and `company.setOwn`.
2. For each book, find or create the company of its legal entity, and have an admin
   mark it own with `company.setOwn`, with a reason.
3. Review each book's `issuer*` values with the finance owner. Where the company
   lacks a value, copy it onto the company through `company.update` as an admin:
   `issuerName` to `legalName`, `issuerAddress` to `registeredAddress`,
   `issuerTaxId` to `taxId`, `issuerRegistration` to `registrationNumber` (and
   `registrationCountry`). Where both hold a value and they differ, the person
   decides which is right; never overwrite silently.
4. Add `Book.company` as an optional relationship and a one-time, keyed action
   that links each book to its company, refusing a company that is not own or
   already has a book. Link every book.
5. Add the `seller*` properties to `SalesInvoice` and fill them at issue. Invoices
   issued before the upgrade keep their stored PDFs and printed copies; where the
   build kept no PDF, a one-time action copies each issued invoice's seller from
   its book's `issuer*` values, before step 6.
6. Make `Book.company` required and unique, remove the `issuer*` properties and the
   one-time actions, and read the seller through `book.company` everywhere it was
   printed.
7. Add the tests for invariants 26 and 27, and extend `company.setOwn` and
   `company.mergeInto` as above.

## E-signature 2.0.0

Signing for one of our own companies is a record per company and member, not a
role.

- The `companySignatory` role is removed. A new entity, `CompanySignatory`
  (`company`, an own company; `user`; optional `title`; `status` `active` or
  `revoked`; `reason`), unique on company and member, is written only by
  `company_signatory.grant` and `revoke`, held by `esignAdmin`.
- `EnvelopeRecipient.capacity` value `ourCompany` becomes `ownCompany`, and the
  recipient names the own company in a new relationship, `signsFor`.
  `setRecipients`, `submit` and `sign` check that an `ownCompany` signer is an
  active member with an active signatory record for `signsFor`, which is own.
- `Envelope` gains `ownCompany` (the party on our side, set by `submit` from the
  first signer who signs for one of ours, empty otherwise) and
  `ownCompanyLegalName`; the recipient gains `signsForLegalName`. `submit` copies
  the companies' legal names into them and into the fingerprint, and a returned
  envelope clears them. The certificate and the signature's capacity read the
  snapshots.
- `config.ts` no longer holds the company's legal name: only the brand name for
  emails, the signing page and email text overrides, and never a list of legal
  entities.
- `company.setOwn` refuses to clear `isOwn` while the company has an active
  signatory record or is `ownCompany` of an envelope out for signature.
- Invariant 8 changes meaning: a signer for one of our companies needs an active
  signatory record for that company, not a role. New invariants 20 (signatory
  records change only through admin actions and keep their history) and 21 (an
  envelope keeps the legal name it was submitted with). New pitfalls 16 and 17.
  Interview question 2 and the "Who signs for the company" variations follow.

The role and a select value that built projects check are replaced, so this is a
major version. A project built from 1.1.0:

1. Follow the foundation entry above, and mark the own company (or companies) with
   `company.setOwn`. Move the legal name from `config.ts` onto the company's
   `legalName` if the company lacks it, after review, then remove it from
   `config.ts`.
2. Add `CompanySignatory` with `company_signatory.grant` and `revoke`, and grant
   them to `esignAdmin`. For every member who holds `companySignatory`, an
   `esignAdmin` grants a signatory record for the own company they signed for,
   with a reason such as "held the signatory role before 2.0.0". With several
   entities, one record per entity they could sign for.
3. Add `signsFor`, `signsForLegalName`, `ownCompany` and `ownCompanyLegalName`,
   and `ownCompany` to the capacity options. In drafts, a one-time action sets each
   `ourCompany` recipient to `ownCompany` with its `signsFor`, and sets the
   envelope's `ownCompany`. Keep `ourCompany` as a retired option that no action
   accepts: recipients of envelopes already submitted keep it, unchanged, as
   invariant 2 requires.
4. Change the checks in `setRecipients`, `submit` and `sign` to the signatory
   record, then remove the `companySignatory` role.
5. Existing envelopes keep their stored snapshots: signatures' `capacity`, sealed
   PDFs and certificates already hold the legal name they were signed for. Readers
   (the envelope page, the signing page and the certificate) show
   `ownCompanyLegalName` and `signsForLegalName` when set, and otherwise the
   envelope's stored signature `capacity`; they never fill the gap from the
   company.
6. Update the test for invariant 8 and add the tests for invariants 20 and 21.

## Email marketing 2.1.0

`EmailSender` gains an optional `company`: the own company its emails come from.
When it is set, the footer prints that company's `legalName` and
`registeredAddress`, and `footer` keeps only what else the law asks for, such as a
postal address that differs. `sendTest` and `approve` refuse a sender whose company
is not own or lacks those fields. Interview question 9 and the consent variations
follow.

A project built from 2.0.0 can skip it. To adopt it: follow the foundation entry
above, link each sender to its own company, and remove the legal name and
registered address from its `footer` text.

## CRM 0.3.0

The foundation's `company.mergeInto`, as extended by the CRM, also refuses when
only one of the two companies is own. Own companies are not prospects: company
lists for selling filter `isOwn: false`, and a lead from an own company's domain is
shown as internal.

A project built from 0.2.0: add the `isOwn` check to the merge and the filter to
selling lists after following the foundation entry above.

## Drive 2.0.1

Wording only: the accounting-records variation and pitfall 13 say "two of the
business's own companies" and "one book" instead of "two legal entities" and "one
entity's books". A project built from 2.0.0 has nothing to change.

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
