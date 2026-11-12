# E-signature: design

## 1. Purpose

E-signature lets a company send documents for signature and keep proof of what
was signed, by whom and when. An envelope freezes exact PDF versions from the
drive, sends them to recipients in signing order, records every view and act as
evidence, and, after the last signature, seals each document into one PDF with a
certificate of completion and an RFC 3161 timestamp, stored as a new immutable
version. SegmentStream sends its own contracts, order forms and offers with this
design.

## 2. Records (ontology)

```text
Document (drive) ──< DocumentVersion (drive)
    │                     ▲            ▲
    │           sourceVersion      sealedVersion
    │                     │            │
    └──< EnvelopeDocument ┴────────────┘   frozen PDF, fields, seal
              │
Envelope ─────┼──< EnvelopeRecipient ──> User (member they sign in as)
  │  │        │          │          └──> Contact (foundation), optional
  │  │        │          └──< EnvelopeSignature   one per recipient, immutable
  │  │        └──< EnvelopeEvent                   the audit trail, append-only
  │  └──< EnvelopeApproval ──> EnvelopeApprovalRule (by name, at submit)
  └──> User (sender), Company (foundation), Deal (crm), all optional but sender
```

Every entity declares `writes: "actions"` except `EnvelopeApprovalRule`, which
admins edit with its generated writes. No action updates or deletes an
`EnvelopeSignature` or an `EnvelopeEvent`; only drafts are ever deleted
(`discardDraft`, `removeDocument`).

### What this blueprint needs from drive

Drive owns documents and their immutable versions. This blueprint reads:

- `document`: `title`, `format`, `type`, `lock`, `trashedAt`, `legalHold`, and
  for a file document its `file` and `sha256`.
- `document_version`: `number`, `purpose`, `sha256`, `fileRevision` (a file
  version: which revision of `document.file` it is), and `pdf`, `pdfSha256`,
  `printStatus` (an online version's PDF, printed by drive on the server).

The bytes an envelope signs are a file document's `file` at its latest
version's `fileRevision`, which must be `application/pdf`, or an online
document's latest version's `pdf`, which must be printed and match the live
revision ("save a version first"). E-signature never prints.

It adds to drive's selects, and writes them only from its own actions:

| Drive property | Values added | Meaning |
| --- | --- | --- |
| `document.lock` | `signing`, `signed` | `signing` while an envelope holding the document awaits approval or is out; `signed` once sealed. Drive already refuses content edits, new versions and trash unless the lock is `none` (trash also allows `final`), and `reopen` refuses a lock another blueprint set. `submit` keeps the lock it replaced on the item, and `void`, `decline`, `expire` and `returnForChanges` restore it. |
| `document_version.purpose` | `signed` | The sealed version `seal` creates: the sealed PDF in its `pdf`, with `pdfSha256` and `sha256` equal to `sealedSha256`. Drive also reserves `signing`; this design does not need it, because the envelope keeps its own frozen copy. |

If your drive build names these differently, map the names; keep the rules.

### Envelope

One sending of one to ten PDFs to one to twenty recipients.

| Property | Type | Meaning | Set by |
| --- | --- | --- | --- |
| `title` | text, max 300 | What is sent, as recipients see it. Defaults to the documents' titles joined. | `createDraft`, `updateDraft` |
| `status` | select | `draft`, `awaitingApproval`, `sent`, `sealing` (everyone acted, sealed PDFs being made), `completed`, `declined`, `voided`, `expired`. The last four are final. | Actions only |
| `message` | text, max 2000, optional | The sender's note, shown in emails and on the signing page. | `createDraft`, `updateDraft` |
| `dueAt` | timestamp, optional | Signing closes then. `sign` refuses after it even before `expire` runs. Defaults at submit to now plus the configured days. | `updateDraft`, `submit` |
| `remindEveryDays` | integer 1 to 30, optional | Remind whoever's turn it is after this many days without an act. Empty: no reminders. | `updateDraft` |
| `valueMinor`, `valueCurrency` | integer (minor units), text (ISO 4217, lowercase), optional | What the documents commit to, for approval rules: `12000.00 EUR` is `1200000` with `eur`, as the foundation stores money. | `updateDraft`, or copied from a deal |
| `fingerprint` | text, 64 hex, optional | SHA-256 over the frozen content: each document's hash and field layer, each recipient's email, kind, order, party and capacity, the message and the due date, in canonical JSON. Approvals bind to it. | `submit` |
| `submittedAt`, `sentAt`, `completedAt`, `endedAt` | timestamp, optional | When each happened, server time. | Actions |
| `endReason` | text, max 1000, optional | The void reason, the decline reason, or that it expired. | `void`, `decline`, `expire` |

Relationships: `sender` (User, required, the member who created it),
`company` (foundation Company, optional), `deal` (CRM Deal, optional, only when
the CRM is built). Index `[status, createdAt]`.

### EnvelopeDocument

One document of an envelope: the envelope's own frozen copy of the PDF, the
fields placed on it, and, at the end, its seal.

| Property | Type | Meaning | Set by |
| --- | --- | --- | --- |
| `position` | integer | Order in the envelope. | `addDocument` |
| `title` | text, max 300 | The document's title when added. | `addDocument` |
| `frozenPdf` | blob, `application/pdf`, max 25 MB | The exact PDF recipients see and sign, copied from the drive version. Never replaced. | `addDocument` |
| `sha256` | text, 64 hex | SHA-256 of `frozenPdf`, computed from the bytes when copied. | `addDocument` |
| `pageCount`, `pageSizes` | integer, json | Pages, and each page's width and height in PDF points. Placement and stamping use them. | `addDocument` |
| `fields` | json | The field layer; see "Fields" below. | `placeFields` |
| `sealIntent` | text (a UUID) | Create intent for the drive version the seal adds, so a retried seal targets the same new record. | `addDocument` |
| `priorLock` | text, optional | The drive lock the document had before `submit` set `signing` (`none` or `final`), restored when the envelope ends unsigned. | `submit` |
| `sealedPdf` | blob, `application/pdf`, optional | The sealed PDF. | `seal` |
| `sealedSha256` | text, 64 hex, optional, indexed | SHA-256 of `sealedPdf`. The verify page looks it up. | `seal` |
| `timestampToken` | text, optional | The RFC 3161 token, base64 DER, exactly as embedded. | `seal` |
| `timestampedAt` | timestamp, optional | The time the timestamp authority certified (`genTime`). | `seal` |

Relationships: `envelope` (cascade; only drafts are ever deleted), `document`
(drive, restrict), `sourceVersion` (drive version copied), `sealedVersion`
(drive version the seal created, optional).

### Fields

`EnvelopeDocument.fields` is a list of
`{ key, kind, party, page, x, y, width, height, required, label }`. `page`
counts from 0; `x`, `y`, `width`, `height` are fractions of the page from its
top-left corner, so they survive any page size. `party` names whose field it
is, such as `customer` or `company`; a signer is assigned a party. Keys are
unique within the envelope. Kinds: `signature` and `initials` (from the
signature the signer adopts, typed in a script font or drawn), `dateSigned`
(the UTC date at signing, set by the server), `fullName` (the typed name),
`text` (typed, max 500) and `checkbox`. `required` defaults to true for
`signature` and false otherwise.

### EnvelopeRecipient

A person the envelope goes to. Private: kept out of the warehouse.

| Property | Type | Meaning | Set by |
| --- | --- | --- | --- |
| `name` | text, max 200 | Full name as the sender gave it. | `setRecipients` |
| `email` | email | Lowercased. The address they sign in with. Unique within the envelope. | `setRecipients` |
| `kind` | select: `signer`, `approver`, `viewer` | Signers fill their party's fields and sign. Approvers approve or decline in their turn without fields. Viewers read the documents and get the sealed copy. | `setRecipients` |
| `order` | integer 1 to 20 | Signers and approvers act in ascending order; equal numbers act in parallel. Viewers ignore it. | `setRecipients` |
| `party` | text, max 60, optional | Signers only: the party whose fields they fill. | `setRecipients` |
| `capacity` | select: `personal`, `ourCompany`, `otherCompany` | Whom they sign for. `ourCompany` requires an active member holding `companySignatory`. | `setRecipients` |
| `organizationName`, `jobTitle` | text, optional | Printed with the signature: "for Northwind Ltd, Director". For `ourCompany` the name comes from configuration. | `setRecipients` |
| `status` | select: `waiting`, `notified`, `viewed`, `signed`, `approved`, `declined` | Where they are. | Actions |
| `notifiedAt`, `viewedAt`, `actedAt` | timestamp, optional | First notice, first open, the act. | Actions |
| `declineReason` | text, max 2000, optional | Their reason. | `decline` |

Relationships: `envelope` (cascade), `user` (User, set at submit, inverse
`envelopeRecipients`; scopes depend on this name), `contact` (foundation
Contact, optional: linked when a contact with that email exists; never created
here). Indexes `[envelope, order]`, `[email]`.

### EnvelopeSignature

The evidence of one recipient's act, a signature or an approval. Written once
and never changed. Private.

| Property | Type | Meaning |
| --- | --- | --- |
| `key` | text, unique | The recipient's id. A second act for the same recipient fails on it. |
| `kind` | select: `signature`, `approval` | What they did. |
| `typedName` | text | The name they typed. |
| `email` | email | The address their sign-in proved. |
| `capacity` | text | As printed, such as "for Northwind Ltd, Director". |
| `values` | json | Their field values by key, as stamped. |
| `drawing` | text, max 20000, optional | A drawn signature as SVG path data only (commands and numbers) in a 300 by 100 box. |
| `documents` | json | `[{ item, sha256 }]` for every document: the hashes the page showed, equal to the frozen ones. |
| `consentVersion`, `consentText` | integer, text | The consent to sign electronically they accepted, word for word. |
| `verification` | text | How identity was checked: "Signed in with a link or code sent to grace@example.com". |
| `ip`, `userAgent` | text | Read by the app's server from the request. |
| `signedAt` | timestamp | Server time. |

Relationships: `envelope` (restrict), `recipient` (restrict).

### EnvelopeEvent

The audit trail: one row per thing that happened, written in the same
transaction as the change, or by `recordView` for an open. Private.

| Property | Type | Meaning |
| --- | --- | --- |
| `kind` | select | `submitted`, `approvalRequested`, `approvalGranted`, `returnedForChanges`, `sent`, `notified`, `reminded`, `viewed`, `signed`, `approved`, `declined`, `voided`, `expired`, `documentSealed`, `completed`. |
| `at` | timestamp | Server time. |
| `ip`, `userAgent` | text, optional | For acts by a person through the app. |
| `detail` | json, optional | What the kind needs: the email address notified, the hashes, the reason, the fingerprint, the timestamp time. |

Relationships: `envelope` (restrict), `actor` (User, optional: member, workflow
or nobody), `recipient` (optional), `item` (EnvelopeDocument, optional).

### EnvelopeApprovalRule

When an envelope needs internal approval before it goes out. Edited by admins.

| Property | Type | Meaning |
| --- | --- | --- |
| `name` | text, max 200 | What it is: "Contracts above 50,000". |
| `approverRole` | select | One of the approver roles declared in code, such as `contractApprover`. |
| `documentType` | text, optional | Applies when any document's drive type has this key. |
| `minimumMinor`, `currency` | integer (minor units), text (ISO 4217, lowercase), optional | Applies when the envelope's value is at least this. Fails closed: a missing value or another currency also applies. |
| `active` | boolean, default true | |

A rule applies when every condition it names holds; a rule with none applies to
every envelope.

### EnvelopeApproval

One request for internal approval, per approver role, per submit.

| Property | Type | Meaning |
| --- | --- | --- |
| `approverRole` | text | Holders of this role decide. |
| `rules` | json | The names of the rules that asked. |
| `fingerprint` | text, 64 hex | The envelope's fingerprint at submit: what is approved. |
| `status` | select: `pending`, `granted`, `returned`, `superseded` | `superseded` when the envelope went back to draft. |
| `note` | text, optional | The approver's comment; required to return. |
| `decidedAt` | timestamp, optional | |

Relationships: `envelope` (cascade), `decidedBy` (User, optional).

### In code, not in records

`ontology/esign/config.ts` holds what the company decides once and reviews as
code: the consent wording and its version (raise the version when a word
changes), the company's legal name for `ourCompany` signers, limits (20
recipients, 10 documents, 25 MB and 200 pages per PDF), defaults (due in 30
days, reminders every 3 days), the date format, and the list of approver roles.
The emails are the workspace's own templates in `defineOntology({ emails })`:
`signatureRequest`, `envelopeShared`, `signatureReminder`, `approvalRequest`,
`envelopeCompleted` and `envelopeEnded`. Every template sets `replyTo`.

## 3. Actions

### Preparing (sender, draft only)

| Action | Input | Checks | Changes |
| --- | --- | --- | --- |
| `envelope.createDraft` | title?, message?, company?, deal? | none beyond permission | A `draft` with the caller as sender. Drafts have history but no events; the audit trail starts at `submit`. |
| `envelope.updateDraft` | envelope, title?, message?, dueAt?, remindEveryDays?, value? | Draft; the caller is its sender; dueAt in the future. | The fields. |
| `envelope.addDocument` | envelope, document; call options carry an idempotency key and a create intent | Draft and sender. In `prepare`: the caller may read the drive document; its lock is `none` or `final`; its latest version has signable PDF bytes (above); the PDF opens, is not password-protected, carries no digital signature (new pages would break it), fits the size and page limits. The document is not out in another envelope, nor already in this one. | Copies the bytes into a new `EnvelopeDocument.frozenPdf` with their SHA-256, page count and sizes; links `sourceVersion`; stores `sealIntent`. |
| `envelope.removeDocument` | envelope, item | Draft and sender. | Deletes the item and its fields. |
| `envelope.setRecipients` | envelope, recipients[] | Draft and sender; 1 to 20; valid, distinct emails; at least one signer; `party` only on signers; `ourCompany` only for active members holding `companySignatory`. | Replaces the list. Links `contact` by email when one exists. |
| `envelope.placeFields` | envelope, item, fields[] | Draft and sender; kinds known; keys unique in the envelope; page within `pageCount`; rectangle inside the page. | Replaces the item's field layer. |
| `envelope.discardDraft` | envelope | Draft never submitted, and sender. A draft that was returned from approval has events: void it instead. | Deletes the envelope, its items and recipients. Destructive. |

### Sending and internal approval

| Action | Who | Checks | Changes |
| --- | --- | --- | --- |
| `envelope.submit` | Sender | Draft. At least one document. Each item's `sourceVersion` is still the drive document's latest version; the document is not trashed and its lock is `none` or `final`. Every field's party has exactly one signer; every signer has a party with at least one `signature` field; approvers and viewers have none. `ourCompany` signers still hold the role. `dueAt` in the future. Refuses a deactivated member among recipients: an administrator decides whether they come back. | Sets `fingerprint`, `submittedAt`, `dueAt`. If an active rule applies: status `awaitingApproval`, one `EnvelopeApproval` per approver role, drive locks `signing`, `approvalRequest` emails to the role's active holders (at most 50), events. Otherwise runs **the send** below. Answers `{ envelope, status, url }`. Irreversible: it emails outside people. |
| `envelope_approval.grant` | Holder of `approverRole` | Pending; envelope `awaitingApproval`; its fingerprint unchanged; the caller is not the envelope's sender (see VARIATIONS.md). | `granted`, `decidedBy`, event `approvalGranted`. When no approval is pending, runs **the send** in the same transaction. |
| `envelope_approval.returnForChanges` | Holder of `approverRole` | Pending; note required. | This approval `returned`, the envelope's other pending approvals `superseded`, envelope back to `draft` (fingerprint cleared), drive locks restored, sender emailed, event. |
| `envelope.void` | Sender, `esignAdmin` | Status `awaitingApproval` or `sent`, or a draft returned from approval; reason required. | `voided`, `endedAt`, `endReason`; drive locks restored; `envelopeEnded` to the sender and to recipients already notified; event. Signatures stay. Destructive, irreversible. |
| `envelope.resend` | Sender | `sent`; at most once an hour per recipient. | New sign-in link to the recipients whose turn it is; events `notified`. |

**The send** (one function, called by `submit` and by the last `grant`): for each
recipient, find the member with that email; if none, `User.invite({ email,
name })` with no roles, which emails nothing. Link `recipient.user`. Set the
lowest order's signers and approvers, and every viewer, to `notified`; send each
a sign-in link (`User.sendSignInLink` with `signatureRequest` or
`envelopeShared`, `returnTo: /sign/<envelope>`); the rest stay `waiting`. Status
`sent`, `sentAt`; drive locks `signing`; events `sent` and one
`notified` per email. Sign-in links are sent after the commit and never if the
action rolls back. Every action that runs the send, the hand-over or another
email (`submit`, `grant`, `returnForChanges`, `void`, `resend`, `sign`,
`approve`, `decline`, `complete`, `remind`, `expire`) lists `User` in its
`writes`: the runtime counts `User.invite` and `User.sendSignInLink` as writes
of the built-in user and refuses them when `writes` leaves `User` out.

**The hand-over** (called by `sign` and `approve`, under the envelope's row
lock): when no signer or approver at the lowest unfinished order is left, set the
next order's recipients to `notified` and send their links; when nobody is left,
set the envelope to `sealing`. The `sealEnvelope` workflow takes it from there.

### The recipient (signing page)

These run as the signed-in recipient. Their permissions are scoped to envelopes
sent to the caller, but a scope bounds only writes of the envelope itself, so
each handler first finds the caller's own row (`user = principal.id`) and
refuses otherwise.

| Action | Checks | Changes |
| --- | --- | --- |
| `envelope.signingPage` (read-only, `prepare` only) | The caller is a recipient, the sender, an admin, or a pending approver. A recipient not yet notified sees only whose turn it is; a voided envelope shows outside recipients only that it was withdrawn. | Nothing. Answers the envelope, the caller's row, each item (id, title, sha256, page sizes, the caller's own fields to fill, others' fields as read-only values), co-recipients' names, kinds, orders and statuses (no emails, IPs or browsers), the consent text and version, and, once completed, the sealed items. |
| `envelope.recordView` | Caller is a recipient; `ip` and `userAgent` from the app server. | First open: `viewedAt`, status `viewed` if `notified`. Every open: event `viewed`. |
| `envelope.sign` | Caller is a signer of the envelope; envelope `sent`; before `dueAt`; their turn; consent given for the current version; typed name of at least two characters; every document hash equals the frozen one; required fields of their party filled; drawing is path data only. A repeat with the same hashes returns the first signature; anything else after signing is refused. | `EnvelopeSignature` (kind `signature`), recipient `signed`, event `signed`, then the hand-over. Irreversible. |
| `envelope.approve` | As `sign`, for an approver, without fields. | `EnvelopeSignature` (kind `approval`), recipient `approved`, event, hand-over. |
| `envelope.decline` | Caller is a notified signer or approver who has not acted; envelope `sent`; reason required. | Recipient `declined`, envelope `declined` with the reason, drive locks restored, `envelopeEnded` to the sender and other notified recipients, event. |

### Run by workflows

| Action | Checks | Changes |
| --- | --- | --- |
| `envelope_document.seal` | Envelope `sealing`; already sealed: returns the seal. `frozenPdf` hashes to `sha256`. Every signer and approver has a signature row. | See "How a document is sealed". Stores `sealedPdf`, `sealedSha256`, token, `timestampedAt`; creates the drive version (`sealedVersion`); event `documentSealed` with both hashes. |
| `envelope.complete` | Status `sealing` and every item sealed; already completed: no-op. | `completed`, `completedAt`; drive locks `signed`; `envelopeCompleted` to every recipient and the sender; event. |
| `envelope.remind` | `sent`; reminders on; the recipient's last notice is at least `remindEveryDays` old. | `signatureReminder` with a fresh link; event `reminded`. |
| `envelope.expire` | `sent` or `awaitingApproval`; `dueAt` passed. | `expired`; drive locks restored; `envelopeEnded` to sender and notified recipients; event. |
| `envelope.pendingWork` (read-only) | | The newest 50 each of: `sealing` envelopes quiet for 10 minutes, overdue envelopes, envelopes with reminders due. |

### Reading

`envelope_document.verify` (read-only, team roles): given a SHA-256, finds the
item whose `sealedSha256` or `sha256` matches and answers the envelope's title,
status, completion time, signers' names and the timestamp time.

Every refusal says the rule that failed and how to proceed, in words an agent
can relay: "Grace Sample has no signature field. Give her a party and place a
signature field for it."

## 4. Roles

| Role | Held by | Permissions |
| --- | --- | --- |
| `member` (built-in) | Every signed-in person, outside recipients included | Scoped to envelopes sent to the caller (`id in me.envelopeRecipients.envelope`): `envelope:read`, `recordView`, `sign`, `approve`, `decline`; `envelope_document:read` on those envelopes' items. Unscoped: `envelope:signingPage`, a read-only action that cannot carry a scope; its `prepare` checks the caller. Nothing else. |
| `sender` | People who send documents | `envelope:read` and every preparing action, `submit`, `void`, `resend`, scoped `{ sender: me }`; reads of items, recipients, signatures, events and approvals of their own envelopes; `envelope_document:verify`; `envelope_approval_rule:read`. Drive read access to what they send comes from drive's roles. |
| `companySignatory` | Members who may sign for the company | The recipient grants above and `envelope_document:verify`. `submit` and `sign` check that an `ourCompany` signer holds it. |
| `contractApprover` (one per approver role) | Managers, finance, legal | `envelope_approval:read`, `grant`, `returnForChanges`; `envelope:read` and `envelope_document:read` where the envelope is `awaitingApproval`; `envelope_approval_rule:read`. |
| `esignAdmin` | Whoever owns signing | Unscoped reads of every e-signature entity; `envelope:void`; `envelope_approval_rule:create`, `update`, `delete`; `envelope_document:verify`. |
| `esignWorker` | The two workflows | Unscoped reads; `envelope_document:seal`, `envelope:complete`, `remind`, `expire`, `pendingWork`. Keep workflow roles unscoped: a scoped grant there draws `check`'s `workflow_role_scoped` warning, and `me` is the workflow's own user. |

Because `member` reaches outside recipients, it must grant nothing else. Move
whatever every employee reads (the starter's `*:read`) into a `team` role that
every employee holds. Never grant by default: `envelope:sign`, `approve` or
`decline` beyond `member`'s own-envelope scope; `envelope_approval:grant` to any
workflow, API key or agent task; `submit`, `void` or `resend` to an agent task
(they email outside people); `envelope_approval_rule` writes outside `esignAdmin`.

## 5. Workflows

| Workflow | Trigger | Steps | Repeat-safe because |
| --- | --- | --- | --- |
| `sealEnvelope` (`esignWorker`) | `after(envelope.sign)` and `after(envelope.approve)` when status changes to `sealing`; `cron("*/15 * * * *")` with no envelope as the sweep | Sweep: `pendingWork`, then each `sealing` envelope. Per envelope: one step lists its items, one step per item runs `seal`, a last step runs `complete`. The sweep catches one envelope's failure and continues. | `seal` returns an existing seal; `complete` is a no-op once completed. |
| `envelopeTimers` (`esignWorker`) | `cron("0 7 * * *")`, daily | `pendingWork`, then `expire` each overdue envelope and `remind` each due one, one step per envelope. | Both check their condition again; a reminder is due only after `remindEveryDays`. |

Emails on send, hand-over, decline and void need no workflow: the action that
makes the change calls `User.sendSignInLink`, which is durable once the action
commits. Keep PDF and crypto libraries out of the top level of the files a
workflow imports; the seal step loads its module with `await import(...)`.

### How a document is sealed

`envelope_document.seal` does this in `prepare`, one document per call, within
the 60-second deadline (hence the size and page limits at `addDocument`):

1. Open `frozenPdf` with `Files.open` and check its SHA-256 equals `sha256`.
2. With `pdf-lib`, draw each field's value at its rectangle: typed text in an
   embedded font that covers the recipients' scripts, drawn signatures as SVG
   paths, checkmarks. Draw a small "Envelope <id>" line on every page. Draw on
   top only; never remove or reflow frozen content.
3. Append the certificate of completion (below).
4. Save without object streams. Add a document timestamp signature dictionary
   (`/Type /DocTimeStamp`, `/SubFilter /ETSI.RFC3161`) with a fixed-size
   `/Contents` placeholder of at least 16 KB and a `/ByteRange` written to a
   fixed width, then fill in the real byte offsets without moving any byte.
5. Compute SHA-256 over the two byte ranges. Send a DER `TimeStampReq`
   (version 1, SHA-256 message imprint, a random 8-byte nonce, `certReq` true)
   to the timestamp authority connection with
   `content-type: application/timestamp-query`.
6. Accept the response only if its status is granted, the token's message
   imprint equals the digest and its nonce equals the one sent. Read `genTime`.
7. Write the token, hex-encoded, into `/Contents`. Hash the final bytes.
8. Stage the bytes twice: to this item's `sealedPdf`, and to the `pdf` of a new
   drive version (purpose `signed`) with the item's `sealIntent` as its create
   intent. The handler re-reads the item and envelope with `forUpdate`, creates
   the version, attaches both files, and records the event.

Any PDF reader then shows a valid document timestamp, and any change to the
file breaks it. The company holds no private key.

### The certificate of completion

Appended to each sealed PDF and shown on the completed signing page, in the
envelope's language, all times in UTC: envelope id and title; sender; sent and
completed times; for each document, its title and the SHA-256 of the frozen
PDF; for each signer and approver, their name, email, capacity, kind, order,
notified, viewed and signed times, IP address, browser and system in words,
verification method, consent version and the signature as drawn or typed; the
consent text; the event history; and the timestamp authority.

## 6. Data flow (pipeline)

None by default. `Envelope` replicates to the warehouse and declares a count
metric, so "envelopes completed last quarter by sender" or "median days to
complete" are metric queries or a small model over the replicated table.
`EnvelopeRecipient`, `EnvelopeSignature` and `EnvelopeEvent` hold emails, IP
addresses and signature images. Exclusions are a workspace setting, not code:
before their first deploy, pause replication, deploy, then resume with these
three excluded (see the foundation and your project's
`docs/ontology-replication.md`).

Demo data comes from a seed script that calls the same actions: it generates two
invented PDFs with `pdf-lib` ("Mutual NDA" and "Order Form" for Northwind),
adds them through drive's actions, creates a draft with Ada Example
(`ada@example.com`) and Grace Sample (`grace@example.com`), and places fields.
It never submits outside development: submitting emails people. Tests generate
their PDFs the same way and replace the timestamp authority with
`Connections.test`.

## 7. Screens (app)

| Page | Who | What they see and do |
| --- | --- | --- |
| `/envelopes` | Senders, admins | Tabs: drafts, awaiting approval, out, completed, ended. Each row: title, company, progress ("1 of 2 signed"), whose turn, sent and due dates. New envelope. |
| `/envelopes/new?document=…` | Senders | Opened from a drive document or a deal. Creates a draft with that document. |
| `/envelopes/<id>/edit` | Sender | Four steps on one page: documents (add from drive, reorder, remove), recipients (name, email, kind, order, party, capacity; suggestions from the deal's contacts and the company's signatories), fields (each page with drag-and-drop fields, one color per party), message, due date and reminders. "Send" shows exactly who gets what and when, and whether approval is needed. |
| `/envelopes/<id>` | Sender, admins, approvers | Status, recipients in order with their state and times, the audit trail, approvals with notes. Resend, void with reason. When completed: sealed PDFs and the certificate. |
| `/sign/<id>` | Recipients | The documents as PDF pages, their own fields highlighted, one bar that always says the next step and takes them there. Consent text with a checkbox, typed or drawn signature, Finish. Decline with a reason. Approvers get Approve and Decline. Viewers read. Afterwards: who still has to act; "the signed PDF is being prepared" while sealing; then download. Works on a phone. |
| `/sign` | Outside recipients | The envelopes sent to them. Where `/` sends a member who holds no team role. |
| `/envelopes/<id>/approve` | Approvers | The frozen documents, the rules that asked, the value. Grant, or return with a comment. |
| `/settings/signing` | Admins | Approval rules; the consent wording and limits from configuration, read-only. |
| `/verify` | Team | Drop a PDF: the browser hashes it and the page shows the envelope it belongs to, or that it matches none. |

The signing page's Server Functions read the IP address and user agent from the
request headers (`x-forwarded-for`, first entry, and `user-agent`) and pass them
to `recordView`, `sign`, `approve` and `decline`. Downloads go through a Route
Handler that asks `segmentstream.ontology.envelopeDocument.files.download(id,
"sealedPdf")` as the signed-in person and redirects to the grant.

## 8. The company agent

Once built, a member can ask the workspace agent:

- "What is waiting for signature, and on whom?" and "Has Northwind signed the
  order form?" (reads)
- "Send the Northwind NDA in the drive to Grace Sample, grace@example.com; Ada
  signs for us after her." The agent runs `createDraft`, `addDocument`,
  `setRecipients` and, when the person gives positions (or a saved field layout
  exists, a variation), `placeFields`; otherwise it returns the draft's link so
  the person places fields on the page. Then `submit`.
- "Remind Grace", "Void it, the price changed", "Show me the evidence for the
  signed MSA" (events and certificate).
- An approver: "What needs my approval?" then `grant` or `returnForChanges`.

With confirmation: `submit`, `resend`, `void`, `discardDraft`,
`envelope_approval.grant` and `returnForChanges`. Before `submit` the agent lists
each recipient's name, full email, kind and order in a message, because the
confirmation card does not show emails, and it never guesses a name or address
the person did not give or a record does not hold. It never calls `sign`,
`approve` or `decline`: an act is the recipient's own, on the signing page, and
the agent's instructions say so.

## 9. Build order

1. Confirm drive is built: versions are immutable, file versions point at a
   file revision, online versions are printed on the server. Add the `signing`
   and `signed` lock values and the `signed` version purpose. Check: a document
   locked `signing` cannot be edited, given a new version or trashed.
2. Narrow `member` to the recipient grants; move team reads into a `team` role.
   Check: a member with no role reads no company, contact or document.
3. Declare the seven entities, `config.ts` and the email templates. Run
   `npm --prefix ontology run check`. Before the first deploy, have the
   person exclude recipients, signatures and events from replication.
4. Preparing actions and their tests: a draft with two generated PDFs, three
   recipients and fields. Check the refusals in INVARIANTS.md.
5. `submit`, the send, and approval rules with `grant` and `returnForChanges`.
   Check in development that links are recorded, not sent.
6. Recipient actions and `signingPage`: order, parallel signers, idempotent
   sign, hash mismatch, decline.
7. Sealing: stamping, certificate, document timestamp, token check, the
   `timestamp_authority` connection, `seal` and `complete`, the `sealEnvelope`
   workflow. Check: the sealed test PDF opens in a PDF reader with a valid
   timestamp once deployed.
8. `void`, `resend`, `remind`, `expire` and `envelopeTimers`.
9. The screens, the signing page first; try it on a phone.
10. The agent's instructions and the seed script.
11. Deploy. The public timestamp authority connects without configuration.
    Send one envelope to yourself and a colleague, sign both, open the sealed
    PDF, and verify it on `/verify`.

## 10. Sketch

Invented names. Full APIs: your project's `docs/ontology.md` (actions, scoped
permissions, workflows, file transfers) and `docs/connections.md`.

```ts
// ontology/esign/schema.ts: entities only, no Node-only imports, so workflows can import it.
import { entity, p, rel, User } from "@segmentstream/ontology";

export const Envelope = entity("envelope", {
  id: "ent_envelope",
  label: "Envelope",
  plural: "Envelopes",
  title: "title",
  description:
    "One sending of one or more frozen PDFs for signature, with its recipients in signing order. " +
    "Changed only by its actions. Nothing changes once it is completed, declined, voided or expired.",
  writes: "actions",
  properties: {
    title: p.text({ managed: true, maxLength: 300, description: "What is sent, as recipients see it." }),
    status: p.select(
      [
        { value: "draft", label: "Draft", description: "Being prepared; nobody outside has seen it." },
        { value: "sent", label: "Out for signature", description: "Recipients act in order." },
        { value: "sealing", label: "Sealing", description: "Everyone acted; sealed PDFs are being made." },
        { value: "completed", label: "Completed", description: "Sealed. Final." },
        // … awaitingApproval, declined, voided, expired, as in section 2
      ],
      { default: "draft", managed: true, description: "Where the envelope is. Set only by its actions." },
    ),
    dueAt: p.timestamp({ optional: true, managed: true, description: "Signing closes at this time." }),
  },
  relationships: {
    sender: rel.one(User, { onDelete: "restrict", inverse: "sentEnvelopes", phrase: ["is sent by", "sends"], description: "Who sent it." }),
  },
  indexes: [["status", "createdAt"]],
});

// EnvelopeRecipient's link to the member; scopes walk its inverse (me.envelopeRecipients.envelope):
//   user: rel.one(User, { optional: true, onDelete: "setNull", inverse: "envelopeRecipients", … })
```

```ts
// ontology/esign/envelope-actions.ts: the guarded act of signing.
import { action, ActionRejected, p, User } from "@segmentstream/ontology";
import { Effect, Schema } from "effect";

import { CONSENT } from "./config";
import { Envelope, EnvelopeDocument, EnvelopeEvent, EnvelopeRecipient, EnvelopeSignature } from "./schema";
import { filledValues, handOver, sameHashes } from "./signing";

const reject = (message: string) => new ActionRejected({ message });

export const EnvelopeWithActions = Envelope.actions((self) => ({
  sign: action({
    description:
      "Sign every document of the envelope as the signed-in recipient, from the signing page only; an agent " +
      "never calls it. Refused when you are not its signer, out of turn, after the due date, without consent to " +
      "the current wording, with a required field empty, or when a document's hash differs from the one sent. " +
      "Signing again with the same hashes returns the first signature.",
    input: Schema.Struct({
      envelope: self.ref,
      typedName: p.text({ maxLength: 200, description: "The signer's full name as typed." }),
      drawing: p.text({ optional: true, maxLength: 20000, description: "A drawn signature: SVG path data only." }),
      values: Schema.Record(Schema.String, Schema.String),
      documents: Schema.Array(Schema.Struct({ item: Schema.String, sha256: Schema.String })),
      consentVersion: p.integer({ description: "The consent version the page showed and the signer accepted." }),
      ip: p.text({ maxLength: 100, description: "Read by the app's server from the request." }),
      userAgent: p.text({ maxLength: 500, description: "Read by the app's server from the request." }),
    }),
    hints: { destructive: false, irreversible: true, idempotent: true },
    writes: [self, EnvelopeRecipient, EnvelopeSignature, EnvelopeEvent, User], // User: handOver sends sign-in links
    handler: ({ input, principal }) =>
      Effect.gen(function* () {
        // The row lock serialises parallel signers, so exactly one of them hands over.
        const envelope = yield* self.get(input.envelope, { forUpdate: true });
        // The scope is checked on writes of the envelope only: find the caller's own row.
        const [me] = yield* EnvelopeRecipient.find({ where: { envelopeId: envelope.id, userId: principal.id }, limit: 1 });
        if (me === undefined || me.kind !== "signer") return yield* reject("You are not a signer of this envelope.");
        const [earlier] = yield* EnvelopeSignature.find({ where: { key: me.id }, limit: 1 });
        if (earlier !== undefined) {
          if (sameHashes(earlier.documents, input.documents)) return { signature: earlier.id };
          return yield* reject("You have already signed this envelope.");
        }
        if (envelope.status !== "sent") return yield* reject(`The envelope is ${envelope.status}; it cannot be signed.`);
        if (envelope.dueAt !== null && Date.parse(envelope.dueAt) <= Date.now()) {
          return yield* reject("The due date has passed. Ask the sender to send it again.");
        }
        const people = yield* EnvelopeRecipient.find({
          where: { envelopeId: envelope.id, kind: { in: ["signer", "approver"] } },
          limit: 21, // submit allows 20
        });
        const ahead = people.filter((o) => o.order < me.order && o.status !== "signed" && o.status !== "approved");
        if (ahead.length > 0) return yield* reject(`Not your turn yet: waiting for ${ahead.map((o) => o.name).join(", ")}.`);
        if (input.consentVersion !== CONSENT.version) return yield* reject("The consent wording changed. Reload and sign again.");
        const items = yield* EnvelopeDocument.find({ where: { envelopeId: envelope.id }, limit: 11 });
        for (const item of items) {
          const seen = input.documents.find((entry) => entry.item === item.id);
          if (seen?.sha256 !== item.sha256) return yield* reject(`'${item.title}' differs from the version sent. Reload the page.`);
        }
        const values = yield* filledValues(items, me, input); // rejects a required field left empty, by its label
        const now = new Date().toISOString();
        const documents = input.documents.map((d) => ({ item: d.item, sha256: d.sha256 }));
        const signature = yield* EnvelopeSignature.create({
          key: me.id, kind: "signature", envelope: envelope.id, recipient: me.id, typedName: input.typedName.trim(),
          email: me.email, values, drawing: input.drawing ?? null, documents, signedAt: now,
          consentVersion: CONSENT.version, consentText: CONSENT.text, ip: input.ip, userAgent: input.userAgent,
          verification: `Signed in with a link or code sent to ${me.email}`,
        });
        yield* EnvelopeRecipient.update(me, { status: "signed", actedAt: now });
        yield* EnvelopeEvent.create({
          kind: "signed", at: now, envelope: envelope.id, recipient: me.id, actor: principal.id,
          ip: input.ip, userAgent: input.userAgent, detail: { documents },
        });
        yield* handOver(envelope, people, me.id, now); // notifies the next order, or sets status "sealing"
        return { signature: signature.id };
      }),
  }),
}));
```

```ts
// ontology/index.ts: member is everyone who signs in, outside recipients included.
const sentToMe = { id: { in: me.envelopeRecipients.envelope } };

export default defineOntology({
  // entities, roles, workflows, connections: [timestampAuthority], signIn …
  member: {
    permissions: [
      { permission: "envelope:read", where: sentToMe },
      { permission: "envelope:recordView", where: sentToMe },
      { permission: "envelope:sign", where: sentToMe },
      { permission: "envelope:approve", where: sentToMe },
      { permission: "envelope:decline", where: sentToMe },
      { permission: "envelope_document:read", where: { envelope: { in: me.envelopeRecipients.envelope } } },
      "envelope:signingPage", // read-only: its prepare checks who is asking
    ],
  },
  // emails: signatureRequest, envelopeShared, … each with replyTo set (see PITFALLS.md)
});
```

```ts
// ontology/workflows/seal-envelope.ts
import { after, changed, cron, p, run, workflow } from "@segmentstream/ontology/workflows";
import { Schema } from "effect";

import { EnvelopeWithActions } from "../esign/envelope-actions";

async function sealEnvelope(input: { envelope?: string }) {
  "use workflow";
  const envelopes = input.envelope === undefined ? await stalled() : [input.envelope];
  for (const envelope of envelopes) {
    try {
      for (const item of await itemsOf(envelope)) await seal(item);
      await complete(envelope);
    } catch {
      // The next sweep tries again; one broken envelope never blocks the others.
    }
  }
}

// One document per step. pdf-lib and crypto load here, never at the top of a workflow file.
async function seal(item: { id: string; intent: string }) {
  "use step";
  const { EnvelopeDocumentWithActions } = await import("../esign/seal-actions");
  return run(EnvelopeDocumentWithActions.actions.seal({ item: item.id }, { createIntent: item.intent }));
}
// itemsOf, complete and stalled are steps of the same shape: a find, envelope.complete, envelope.pendingWork.

export default workflow("sealEnvelope", {
  description: "Seal each document of a fully signed envelope with its certificate and an RFC 3161 timestamp.",
  role: "esignWorker",
  input: Schema.Struct({ envelope: p.text({ optional: true, description: "The envelope; empty for the sweep." }) }),
  run: sealEnvelope,
  triggers: [
    after("lastSignature", EnvelopeWithActions.actions.sign, {
      description: "The last signature moved the envelope to sealing.",
      when: changed("status", { to: "sealing" }),
      input: (event) => ({ envelope: event.input.envelope }),
    }),
    // … the same trigger on EnvelopeWithActions.actions.approve
    cron("sweep", "*/15 * * * *", { description: "Seal envelopes whose run was lost.", input: {} }),
  ],
});
```

```python
# connections/connections.py: public, no credentials; only a SHA-256 digest leaves the workspace.
from segmentstream_connections import ApiKeyConnection

connections = (
    ApiKeyConnection(
        key="timestamp_authority",
        name="RFC 3161 timestamp authority",
        provider="rfc3161-timestamp",
        public=True,
        apis={"tsa": "https://freetsa.org/"},
    ),
)
```

```ts
// ontology/connections.ts, then the call in seal's prepare (listed in its `connections`).
export const timestampAuthority = connection("timestamp_authority", {
  description: "Public RFC 3161 timestamp authority. Receives only the SHA-256 of a sealed PDF's signed bytes.",
});

const response = yield* timestampAuthority.post("/tsr", {
  api: "tsa",
  headers: { "content-type": "application/timestamp-query" },
  body: timestampRequest(digest, nonce), // DER TimeStampReq: SHA-256 imprint, nonce, certReq
});
if (!response.ok) return yield* reject(`The timestamp authority answered ${response.status}; the sweep retries.`);
const token = readToken(response.body, { digest, nonce }); // granted, same imprint, same nonce; genTime
if (!token.ok) return yield* reject(token.reason);
```
