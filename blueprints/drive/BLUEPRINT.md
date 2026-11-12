# Drive: design

## 1. Purpose

Drive is the company's one place for documents: uploaded files and documents written
in the app, in one folder tree. It keeps every version, prints online versions to
PDF, shares through explicit, expiring grants and records who opened what. Access is
decided on the server for every read, whoever asks: the app, the workspace agent or
an MCP client. SegmentStream runs this design in production for its own documents.

## 2. Records (ontology)

Every Drive entity is stored and `writes: "actions"`, except `document_type` and
`drive_settings`, which admins edit with generated writes. All are excluded from
replication before their first deploy (section 6). "Managed" values are set by actions.

### Folder (`document_folder`)

| Property | Type | Meaning |
| --- | --- | --- |
| `name` | text | The name shown. No `/`; unique among its siblings. |
| `path` | text, unique, managed | The full path, `Clients/Northwind/2026`. Kept in step by rename and move. |
| `kind` | select, managed | `shared` (a company folder) or `personal` (a member's own folder, made on first use; folders inside it are personal too). |
| `confidentiality` | select, managed | `general`, or a confidential class such as `hr`. Chosen when a top-level folder is made, inherited by every folder and document inside, never changed in place. |
| `defaultTeamAccess` | select | The team access new documents in it start with: `viewer` for company folders, `restricted` for personal ones. |
| `key` | text, unique, optional, managed | A stable key for a folder that filing rules use, so renaming or moving it never breaks filing. |

Relationships: `parent` (folder, optional, `restrict`), `ancestors` (`rel.many` to
folder: every folder above this one, kept by `add` and `move`; inverse
`descendants`), `owner` (member; the owner of a personal folder), `company`
(foundation Company, optional: the company whose folder this is, shown on its page).

### Document (`document`)

| Property | Type | Meaning |
| --- | --- | --- |
| `title` | text | Readable title. |
| `format` | select, managed | `file` or `online`. Set at creation. |
| `confidentiality` | select, managed | Always its folder's. Changed only by moving it, by an admin of both classes. |
| `teamAccess` | select, managed | What every teammate may do with a `general` document beyond its shares: `restricted` (nothing), `viewer`, `commenter`, `editor`. |
| `file` | blob, optional | The uploaded file. Each new edition is a new revision of this property; earlier revisions stay downloadable. |
| `sha256`, `fileName`, `contentType`, `sizeBytes` | managed | The current edition's facts, copied from the stored file so lists need no file read. |
| `revision`, `latestVersion` | integer, managed | Raised by every saved edit of an online document; the newest version's number. |
| `isTemplate` | boolean, managed | An online document new documents are copied from. |
| `lock` | select, managed | `none` or `final` (marked final: content edits refused). E-signature adds its own values. |
| `documentDate`, `data` | date, json, optional | The date the document carries; structured facts by its type's data schema, such as an amount (integer minor units with a lowercase ISO 4217 currency, as the foundation stores money) and a term. |
| `trashedAt` | timestamp, optional, managed | When it went to the trash; empty when it is not there. |
| `legalHold`, `legalHoldReason` | boolean, text, managed | Under legal hold, and why. |
| `intakeStatus` | select, optional, managed | For a submitted file: `received`, `filed`, `needsInfo`, `duplicate`. |

Relationships: `folder` (required, `restrict`), `owner` (member, optional,
`restrict`: who manages it; empty for intake until filed), `type` (document type,
optional), `template` (the document it was copied from, optional, `setNull`),
`submittedBy` (member, optional), `trashedBy` (member, optional).

### Section (`document_section`)

A part of an online document's live content, so that editing one part of a long
document saves only that part: `title`, `position` (number), `revision`
(integer, raised by each saved edit of it), `blocks` (json). Relationship
`document` (`cascade`). Index on `document, position`.

**Content model.** A section is a list of blocks stored as ProseMirror JSON:
headings, paragraphs, list items, quotes, tables, small inline images, dividers
and page breaks. Every block has a stable id. Inline text carries marks (bold,
italic, link), `{{variables}}` for templates and references to other blocks.
Numbering styles are `plain`, `legal` (1. / 1.1 / (a)) and `none`. A block's
fingerprint is the SHA-256 of its canonical JSON (keys sorted). Keep this model,
its Markdown conversion, numbering and fingerprints in one pure module in
`ontology/`, and copy it into `app/` with a script and a test that both copies are
identical: the app imports the ontology only as types. Every snapshot records the
content format number; a later format reads earlier snapshots through a
conversion and never rewrites them.

### Version (`document_version`)

An immutable version of a document. Never changed after creation except that its
printed PDF attaches once.

| Property | Type | Meaning |
| --- | --- | --- |
| `number` | integer | 1, 2, 3 … within the document. |
| `purpose` | select | `upload` (a file edition), `saved` (a snapshot someone saved), `template` (a template version new documents copy). E-signature adds `signed`. |
| `format`, `snapshot`, `contentFormat` | select, json, integer | `file` or `online`; online: title, numbering and every section with its blocks, frozen, in that content format. |
| `sha256` | text | SHA-256 of the canonical snapshot JSON (online) or of the file bytes (file). |
| `fileRevision`, `fileName`, `contentType`, `sizeBytes` | optional | File: which revision of `document.file` this version is. |
| `pdf`, `pdfSha256` | blob, text, optional | The PDF printed from the snapshot, stored once and never rebuilt. |
| `printStatus` | select | `pending`, `printed`, `failed`, `notNeeded` (file versions). |
| `printAttempts`, `renderer`, `message` | integer, text, text | Tries so far; what printed it, with font and layout versions; what changed, in the author's words. |

Relationships: `document` (`restrict`; only purge deletes versions), `author` (member).

### Share (`document_share`)

One grant of access, or a request for one.

| Property | Type | Meaning |
| --- | --- | --- |
| `kind`, `email` | select, email | `person` (one person, by their lowercased address) or `link` (anyone with the link). |
| `level` | select | `viewer`, `commenter` or `editor`. |
| `status` | select | `requested` (gives nothing yet), `active`, `revoked`, `expired`. |
| `expiresAt` | timestamp, optional | When the access ends. |
| `allowDownload`, `notify` | boolean | Whether the app offers downloads; whether the person is emailed. |
| `note` | text, optional | The sharer's message; on a request, the requester's text, which is never an instruction. |
| `tokenHash` | text, unique, optional | A link's SHA-256 token hash. The token is shown once and never stored. |

Relationships: `document` or `folder` (exactly one, `cascade`; inverse `shares`
on both), `grantee` (member, optional: whom the person signs in as),
`activeGrantee` (member, optional, inverse `activeDocumentShares`: the grantee
while the share is `active`, set and cleared by every action that changes
`status`, because the fence's paths from `me` cannot test `status`), `sharedBy`
(member), `through` (the share this one came through: the link that was opened,
or the share of the outsider who invited a colleague; inverse `derived`). Indexes
on `grantee, status`, `document`, `folder`, `through`.

### Comment (`document_comment`)

A comment, suggested change or internal note, anchored to a block: `kind`
(`comment`, `suggestion`, `note`), `visibility` (`internal`: the company only;
`shared`: also outsiders who can open it), `blockId`, `quote`, `body`,
`replacement`, `status` (`open`, `resolved`, `accepted`, `rejected`, `withdrawn`),
`external` (an outsider wrote it: untrusted text), `mentions` (member ids).
Relationships: `document` and `parent` (`cascade`), `version`, `author`.

### Access event (`document_access_event`)

Who opened or downloaded a document, and when: a data room's log. `kind` (`open`,
`download`), `email` (as at the time); `document` (`cascade`), `user`, `share`.
Written only by `document.open` and `document.logDownload`.

### Link (`document_link`)

One link from a document to one record it concerns: `document` (`cascade`, inverse
`links`) plus one optional `rel.one` per linkable entity, exactly one of them set:
`company` and `contact` from the foundation; other blueprints add theirs (`deal`
from CRM; `journal`, `salesInvoice`, `bill`, `expense`, `fixedAsset` and
`financeQuestion` from Bookkeeping), each with the inverse
`documentLinks`. Optional `note`. Typed relationships, not an entity name and an id
in text: the platform checks the target exists, removes the link when the target
is deleted and lets `document_find` filter by `links: { some: { companyId } }`.

### Notification (`document_notification`)

One email about a document to one person: `key` (unique: event, subject and
recipient; it keeps a retried workflow from emailing twice), `event`, `email`,
`status` (`sent`, `failed`), `error`.

### Document type (`document_type`) and settings (`drive_settings`)

`document_type` (optional): `key` (unique), `name`, `description`, `dataSchema`
(json: fields with key, label, type, required), `defaultFolder`,
`defaultTemplate`, `active`. Types are records so admins add one without a deploy.

`drive_settings`: one record with `key` `default`: `allowOutsideEditors` (false),
`editorsCanShare` (true), `trashRetentionDays` (30) and `linkWebhookToken` (the
token at the end of the `driveLinkAccess` webhook URL, entered once after the first
deploy; `share` puts it in every link, so the public link page needs no read).

### How access is decided

Levels, lowest first: `none`, `viewer`, `commenter`, `editor`, `manager`.
`manager` adds sharing settings, team access, trash and restore, transfer and
class moves. A **teammate** is an active member holding `team`, `drive_admin` or a
confidential class's role; everyone else, `guest` holders included, is outside.

One function, `accessOf(document, caller)`, returns the caller's level, whether
they may download, the share it came from and whether they are outside. It takes
the best of:

1. The admin role of the document's class (`drive_admin` for `general`, `hr` for
   `hr`): `manager`, also in the trash.
2. The document's owner: `manager`, also in the trash.
3. Nothing else opens a trashed document.
4. A teammate holding `team`, on a `general` document: its `teamAccess`.
5. An `active` share of the document itself whose `expiresAt` has not passed.
6. An `active`, unexpired share of its folder or any folder above it, for a
   `general` document only. Confidential documents open only by a share of the
   document itself.

Shares are read at the moment of the request, so a revoked or expired share gives
nothing at once. Every Drive action that reads or changes a document calls
`accessOf` and refuses below the level it needs, saying what to ask for and never
quoting the document. Given another member's roles, it answers "can Grace open
this?" for mentions and approvers. Role scopes mirror the same rules as the outer
fence around generic reads (`document_find`, `get`, `include`, MCP tools, file
downloads; section 4). The fence is wider only for an expired share the sweep has
not yet marked, for at most one sweep interval.

## 3. Actions

Actions are the only way records change. "Level" is the caller's `accessOf` level
on the document. Each action's description states these checks and every
rejection names the rule that failed.

### Folders

| Action | Who | Checks | Changes |
| --- | --- | --- | --- |
| `document_folder.add` | `drive_admin` and class admins (company folders); the owner (inside a personal folder) | Name without `/`; path free; a top-level folder's class is chosen by an admin of that class | Folder, its `ancestors`, class and default team access from its parent |
| `document_folder.ensurePersonal` | teammates | One per member, by key `personal:<member id>`; idempotent | The member's personal folder |
| `document_folder.rename` | as `add` | Path free | Its path and every path below; refuses past 500 folders |
| `document_folder.move` | as `add` | Not into itself or below; same class on both sides; not a top-level personal folder | Parent, then path and `ancestors` of it and every folder below, in one transaction; refuses past 500 folders |
| `document_folder.remove` | as `add` | Empty: no documents (trashed included) and no folders | Deletes it |

### Documents

| Action | Who | Checks | Changes |
| --- | --- | --- | --- |
| `document.draft` | teammates | The caller may add to the folder (company folder of their class, or their own personal folder); a template must be online, `isTemplate`, and at least viewable | Online document owned by the caller, team access from the folder, sections blank or copied from the template's latest `template` version with given `{{variables}}` filled |
| `document.upload` | teammates | A completed upload of `file` and its `sha256`; folder as for `draft` (default: the caller's personal folder) | File document, version 1 (`upload`). The same `sha256` already live in that folder answers that document with `created: false` |
| `document.addFileVersion` | editor | A file document; not trashed; lock `none`; no legal hold | New file revision and version; current file facts |
| `document.open` | viewer | Not trashed unless manager | Records an open (once per person per 15 minutes) and answers what the page shows: details, level, sections, versions, comments the caller may see |
| `document.readContent`, `readVersion` | viewer | Read-only. Online; the version belongs to the document | Markdown with block ids, the outline, or blocks matching a query, with section revisions for `editContent`; a version's snapshot, earlier formats converted |
| `document.editContent` | editor | Online; lock `none`; not trashed; no legal hold; `expectedRevisions` still current | Block operations (replace, insert, delete, move, table cells, sections) in one batch; raises revisions |
| `document.saveSections` | editor | As `editContent` | The editor's changed blocks with the fingerprints they had when loaded. A section nobody else changed takes them as they are; otherwise blocks merge one by one and a block both people changed is reported as a conflict and keeps the current text |
| `document.saveVersion` | editor | Online; lock `none`; not empty; every character printable by the PDF fonts (names the ones that are not); snapshot under its size cap | Version `saved` (`template` on a template), `printStatus: pending`; `latestVersion` |
| `document.setDetails` | editor | Title not empty; `data` fits the type's schema | Title, type, document date, data |
| `document.move` | editor, and may add to the target | Another class needs an admin of both classes; that move revokes every share, link and request of the document | Folder, class |
| `document.setTeamAccess` | manager (editor when `editorsCanShare`) | `general` only | Team access |
| `document.transferOwnership` | manager | New owner is an active teammate who can read the class | Owner |
| `document.markTemplate` | class admin | Online | `isTemplate` |
| `document.markFinal`, `reopen` | editor, manager | `reopen` refuses a lock another blueprint set (such as signing) | Lock |
| `document.trash`, `restore` | editor; manager | No legal hold; lock `none` or `final` | Sets or clears `trashedAt`, `trashedBy`. Shares stay but open nothing meanwhile |
| `document.purge` | `drive_sweeper`, class admin | In the trash longer than `trashRetentionDays`; no legal hold | Deletes versions, sections, comments, shares, links, events, then the document |
| `document.setLegalHold` | class admin | A reason to place it | `legalHold`, reason. While held: no trash, purge, content edits, comment withdrawal or class move |
| `document.logDownload` | viewer | Downloads allowed for the caller | Download event (at most 50 per person per day are logged) |
| `document.accessLog` | editor | Read-only | The latest 200 events, each marked inside or outside |
| `document.submit` | `submitter`, teammates | Completed upload and `sha256` | Document in the Inbox folder, `restricted`, no owner, `intakeStatus: received`, `submittedBy` |
| `document.mySubmissions` | `submitter` | Read-only. Own submissions only | Status and reason, nothing else |
| `document.fileSubmission` | `drive_admin` | `received` or `needsInfo` | Moves, names, links and sets the owner: `filed`; or `needsInfo` with a reason; or `duplicate` of a named document |

### Versions

| Action | Who | Checks | Changes |
| --- | --- | --- | --- |
| `document_version.print` | `drive_printer`, `drive_sweeper`, editor | Online version without a PDF. `prepare` renders the snapshot and stages the PDF (`files: [uploads.target(self, "pdf")]`); the handler re-reads the version with `forUpdate` | Attaches `pdf`, `pdfSha256`, `renderer`, `printed`. A version that already has a PDF changes nothing |
| `document_version.markPrintFailed` | printer, sweeper | Not printed | `failed`, `printAttempts` + 1 |

**Rendering.** `print`'s `prepare` lays the snapshot out with the shared content
module and writes the PDF with a library that runs in the ontology service and
embeds the document fonts: no browser, no account. Page size, margins, letterhead
and fonts are code. Printing the app's HTML with headless Chromium or a PDF
service is a variation. Never print from a person's browser session.

### Shares and requests

| Action | Who | Checks | Changes |
| --- | --- | --- | --- |
| `document_share.share` | editor (manager when `editorsCanShare` is off); folders: their admins or the personal folder's owner | Not trashed. Emails valid. Outsiders get `viewer` or `commenter` unless `allowOutsideEditors`. Never a link or a folder share for a confidential class. A deactivated account is refused, never reactivated | Person shares (outsiders are invited as members with only `guest`); sharing with someone whose request waits approves it. One link per document or folder: sharing by link again changes it, `reset` replaces it. Answers a new link once |
| `document_share.change` | as `share` | Active; the same level rules | Level, downloads, expiry; narrows every share derived from it |
| `document_share.revoke` | as `share` | | `revoked`, and every share derived from it, however far it was passed on |
| `document_share.list` | viewer; requests and last opens: editor | Read-only | Direct and inherited shares, waiting requests, when each outsider last opened it |
| `document_share.sharedWithMe` | anyone signed in | Read-only | Active shares to the caller, newest first |
| `document_share.openLink` | anyone signed in | Token hash matches an active, unexpired link of a `general` document or folder | A `person` share for the caller `through` the link, never above it |
| `document_share.redeemLink` | `drive_link_access` | As `openLink`; one email per address per 10 minutes, 30 per link per hour (counted on notification keys); a deactivated account learns nothing | Invites the visitor as `guest`, reuses or creates their share `through` the link, and emails them a sign-in link that opens it. Answers the same for a wrong link |
| `document_share.askForAccess` | anyone signed in | `general` only. Answers the same whether the document exists or not | A `requested` share; asking again adds the note to the waiting one; 10 requests per person per day |
| `document_share.inviteColleague` | outsiders with access | Level at most their own; `general`; 10 per person per document per day | A `requested` share `through` their own; nobody named is emailed |
| `document_share.decide` | editor teammates | `requested` | `active` (expiry and download never beyond the inviter's) or `revoked` |
| `document_share.notify` | `drive_notifier` | Notification key unused | One email through `User.sendSignInLink` and a notification record |
| `document_share.expireDue` | `drive_sweeper` | Up to 100 active shares whose `expiresAt` passed | `expired`, and their derived shares |

### Comments and links

| Action | Who | Checks | Changes |
| --- | --- | --- | --- |
| `document_comment.post` | commenter | A suggestion quotes text and gives new wording. Outsiders: never a note, always `shared`, no mentions. Up to 10 mentions, each an active teammate who can open the document | Comment; a reply takes its thread's visibility |
| `document_comment.edit` | author while they can open it; `withdraw` also editors | No legal hold for `withdraw`; a decided suggestion keeps its wording | Body, or `withdrawn` with the text cleared |
| `document_comment.resolve` | commenter | Not decided or withdrawn | `resolved` or `open` |
| `document_comment.decideSuggestion` | editor teammates | Content editable; the quote is still in the block | Writes the replacement (new revision) and `accepted`, or `rejected` |
| `document_comment.notifyMentions` | `drive_notifier` | Key per comment and member | One email per mention |
| `document_link.attach`, `detach` | editor | Exactly one target, which exists; the same pair again answers the existing link | Creates or deletes the link |

Hints: reads are `readOnly` with `prepare` only. `share`, `notify`, `redeemLink`
and `decide` email people: `irreversible: true`. `revoke`, `trash`, `move` across
classes, `setLegalHold`, `transferOwnership` and `purge` are `destructive: true`.
Everything else is routine (`destructive: false`). Actions that email through
`User.sendSignInLink` or invite through `User.invite` (such as `share`, `decide`,
`redeemLink`, `notify` and `notifyMentions`) list `User` in `writes`: the runtime
refuses a write the action does not declare.

## 4. Roles

| Role | Holder | Permissions |
| --- | --- | --- |
| `team` | Every employee who works in Drive | Fenced reads of `document`, `document_version`, `document_folder` and `document_link`; `document_type`, `drive_settings` and `user` reads; every document, share, comment and link action above that teammates may call (each checked per document by `accessOf`); `document_folder:ensurePersonal` |
| `guest` | People outside the company, invited by a share | Fenced reads through shares only; `document:open`, `readContent`, `readVersion`, `logDownload`; comment `post`, `edit`, `resolve`; share `sharedWithMe`, `openLink`, `askForAccess`, `inviteColleague`. No `user:read` |
| `drive_admin` | Who runs the company's Drive | Reads of every `general` document and what hangs off it, scoped `{ confidentiality: "general" }` (or `{ document: { confidentiality: "general" } }` on versions, sections and comments); folders, types, settings, templates, intake filing, legal hold, transfer, purge |
| `hr` (one role per confidential class) | People who own that class | The same, scoped `{ confidentiality: "hr" }` |
| `submitter` | People or keys that only hand in files | `document:submit`, `document:mySubmissions` |
| `drive_notifier`, `drive_printer`, `drive_sweeper`, `drive_link_access` | One workflow each | Only the actions their workflow calls, and the unscoped reads its steps need (a scoped grant in a workflow's role draws `check`'s `workflow_role_scoped` warning, and `me` there is the workflow's own user) |

**The fence.** The `team` and `guest` reads are scoped permissions whose `where`
mirrors `accessOf` (section 10). A scope's `where`, like any `find`, follows
relationships one level deep, so it cannot reach a share through the document's
folder and that folder's `ancestors`. It walks paths from `me` instead (at most
three hops; see "Scoped permissions" in your project's `docs/ontology.md`):
`me.activeDocumentShares.document` (documents shared with me),
`me.activeDocumentShares.folder` (folders shared with me) and
`me.activeDocumentShares.folder.descendants` (every folder below those). A path
cannot test `status` or `expiresAt`; that is what `activeGrantee` is for. For
`team` the fence also admits documents owned by me and team-open `general`
documents. Version and link reads use `{ document: <the same filter> }`;
team folder reads cover `general` company folders, their own personal folders and
shared folders with everything below them. Sections,
comments, shares, events and notifications have no generic read for `team` or
`guest`: actions that apply `accessOf` read them. A guest's file download is a
normal platform download, checked against the same fence.

**`member` reads nothing of Drive.** Outsiders are app members too. No role,
`member` included, may hold `*:read`, `*:*`, `document:*` or an unscoped read of a
Drive entity, except the admin roles' reads scoped to their own class: a wildcard
covers every entity, and an unscoped grant wins over every scope.

**Never by default.** No workflow role or agent task gets `purge`, `setLegalHold`,
`share`, `revoke`, `transferOwnership` or `move`. The workspace agent acts as the
member and confirms every destructive or irreversible action with them.

## 5. Workflows

| Workflow | Trigger | Steps | Repeats are harmless because |
| --- | --- | --- | --- |
| `driveNotify` | Three `after` triggers on `document_share`, with `when` on `event.action` and the record before and after: a person share created `active` with `notify` by `share`; a request created by `askForAccess` or `inviteColleague`; a request decided by `decide` or `share` | One step: `document_share.notify({ share, event })`. Requests email the approvers: whoever shared the document with the inviter while they can still edit it, else the class admins | The notification key (`event:share:recipient`) is unique; a second run finds it and sends nothing |
| `driveMentions` | `after` on `document_comment` created by `post` with mentions | `document_comment.notifyMentions({ comment })` | Key per comment and member |
| `printVersion` | `after("saved", Document.actions.saveVersion)`, input `event.result.version` | `document_version.print({ version })`; on failure, `markPrintFailed` | `print` attaches once; a second run finds the PDF |
| `driveLinkAccess` | `webhook("driveLinkAccess")`, posted by the public link page | Parse share id, token, email and name (bounded, letters only for the name); `document_share.redeemLink` | The visitor's existing share is reused; emails are limited per address and per link |
| `driveSweep` | `cron("every15Minutes", "*/15 * * * *")` | Pages of up to 100: `expireDue`; versions `pending` over 10 minutes or `failed` with fewer than 3 attempts: `print`; documents in the trash past retention and not held: `purge`, up to 50 per run | Each action re-checks its condition under lock; the next run continues |

`saveVersion` raises `latestVersion`, so `printVersion`'s trigger has a document
edit to fire on; versions other actions freeze (e-signature's) print in the sweep.
Drive uses 5 of the ontology's 20 action triggers, 1 of 20 webhooks and 1 cron.
Emails are the workspace's own templates in `defineOntology({ emails })`, sent with
`User.sendSignInLink`, so one click signs the person in and opens the document.

## 6. Data flow (pipeline)

Drive writes nothing to the warehouse and has no ingestion, model or job.

- **Replication.** Before the deploy that first adds them, exclude every Drive
  entity from ontology replication. Exclusions are a workspace setting, not
  code, and name each entity by its stable `id` (`ent_document`,
  `ent_document_section`, …); the foundation describes the steps and your
  project's docs/ontology-replication.md the mechanism. Raw warehouse SQL ignores ontology permissions, so
  exclusion is the one protection that holds on every path. After the deploy,
  check that the warehouse's `ontology` dataset has no Drive view.
- **Counts.** Folder counts would be metrics over replicated rows, and metric
  queries refuse scopes that follow paths from `me` or to-many relationships, as
  the fence does.
  Lists show one page and "more"; reporting on Drive is a variation.
- **Demo data.** A seed script in `ontology/scripts/`, run against a
  `segmentstream dev` branch and never production, calls the same actions as an
  invented admin: folders `Company`, `Clients/Northwind` and `HR`; a template
  "Mutual NDA" with `{{company.name}}`; a document drafted from it; a PDF generated
  in code and uploaded; a 7-day commenter share with `grace@example.com`; a
  comment and a suggestion. Running it twice changes nothing.

## 7. Screens (app)

- **Drive** (`/drive`): folder tree, breadcrumb, subfolders and one page of
  documents (title, owner, updated, size, lock or hold mark). Search by title;
  filter by type, linked company, owner and date. New document (blank or from a
  template), Upload, New folder; move, trash and download a selection. Recent and
  Templates views.
- **Document** (`/drive/[id]`): an online document opens the editor (a
  ProseMirror-based editor such as Tiptap) with outline, margin comments,
  suggestion mode and autosave that shows merges and conflicts. A file opens a
  preview: JPEG and PNG by inline grant, PDFs by fetching the bytes into a PDF
  viewer (pdf.js), anything else as a card with Download. Panels: Versions (print
  status, PDF, "print again"), Links, Activity (the access log, for editors).
  Header: Share, Save version, and move, rename, team access, final, template,
  transfer, trash, legal hold.
- **Share dialog**: people with level, expiry and download; access through
  folders; waiting requests with Approve and Decline; when each outsider last
  opened it ("not yet" hints at a spam folder); the link with copy and reset.
- **Shared with me** (`/shared`), **reader** (`/shared/[id]`), **shared folder**
  (`/shared/folder/[id]`): the reader shows the live document, `shared` comments
  only, Comment, Download when allowed and Invite a colleague, and refreshes
  changed sections every few seconds.
- **Link page** (`/open`, a public path): the link carries the share id, its token
  and the webhook token. The page posts the visitor's email with them to the
  `driveLinkAccess` webhook and says "check your inbox"; a signed-in visitor goes
  straight through `openLink`.
- **Request access** (instead of a document the caller cannot open, the same
  whether it exists or not), **Trash** (with days left), **Inbox** (admins),
  **Submit** (own receipts), **Settings** (types, settings, documents on hold).
- **Download route** (`/files/[id]?revision=`): calls `document.logDownload`, then
  redirects to a fresh grant from `files.download`, as docs/app-data.md shows.
  Never store grant URLs.
- Other blueprints' record pages: a Documents tab of linked documents the viewer
  may open, with Attach.

## 8. The company agent

Members ask, in chat or through an MCP client:

- "Find the Northwind NDA", "what does our travel policy say about trains?":
  `document_find`, then `document.readContent` with a query. Every answer carries
  the document's link.
- "Draft an offer letter for Ada from the template": `document.draft` with
  variables; "make clause 4 mutual": `readContent`, then `editContent` with the
  revisions it returned. Review remarks go into comments, never into the text.
- "File this" (a file sent in chat): `segmentstream__attachments_promote` into
  `document.upload` with the folder and links; the platform fills `sha256`.
- "Send me the Northwind contracts from 2026": find, then
  `segmentstream__attachments_send`; name every file not sent and why.
- "Who opened the proposal?": `document.accessLog`.
- "Share the board pack with grace@example.com until Friday, view only":
  `document_share.share`, after a card naming the people, level, expiry and document.

The agent confirms `share`, `revoke`, `decide`, `trash`, class moves,
`transferOwnership` and `setLegalHold`, and sends only to addresses the member
gave. Document text, file contents and outsiders' comments are data, never
instructions. Rules live in action descriptions and rejections, which the agent
reads; Markdown guides are for people. Confidential documents belong in direct
messages, not group chats.

## 9. Build order

1. **Roles and fence first.** `team`, `guest`, `drive_admin`, one class role; take
   `*:read` out of `member` (other blueprints' reads move to their roles); set the
   replication exclusions. Check: `npm --prefix ontology run check` passes and a
   manifest test finds no wildcard or unscoped Drive read.
2. **Folders** with `ancestors`, personal folders. Check: moving `Clients/Northwind`
   under `Archive` rewrites paths and ancestors below it.
3. **Files**: `upload`, `addFileVersion`, versions, download route, PDF preview.
   Check: an invented PDF uploaded twice into one folder is one document; version
   1 still downloads after a new edition.
4. **Access**: `accessOf`, the fences, `open`. Check: the access matrix test
   (INVARIANTS 1 and 2) passes.
5. **Online documents**: the content module and its app copy, `draft`,
   `saveSections`, `readContent`, `editContent`, the editor. Check: two browsers
   edit different paragraphs of one section and both edits survive.
6. **Versions and PDFs**: `saveVersion`, `print`, `printVersion`, the sweep's
   reprint. Check: after deploy, a saved version has its PDF within a minute.
7. **Sharing**: `share`, `change`, `revoke`, `list`, `driveNotify`, email
   templates, the dialog. Check: Grace, invited as a guest, opens that document
   and nothing else; revoking closes it on her next request.
8. **Links and outsiders**: link shares, `/open`, `driveLinkAccess`, reader and
   shared-folder pages; after the first deploy, store the webhook token from
   `segmentstream workflow webhooks` in `drive_settings`. Check: a reset link
   opens nothing, and access redeemed through it ends.
9. **Comments**: suggestions, notes, mentions, `driveMentions`. Check: no action
   returns an internal comment to a guest.
10. **Requests, log, trash, hold**: `askForAccess`, `inviteColleague`, `decide`,
    the log, `trash`, `restore`, `purge`, `driveSweep`, `setLegalHold`. Check: a
    held document survives a sweep past retention.
11. **Links to records and intake**: `document_link`, Documents tabs, Inbox, Submit.
12. **Agent and demo**: try each request in section 8 as an invented member; run
    the seed script on a dev branch.

## 10. Sketch

Invented names; run `npm --prefix ontology run check`. docs/ontology.md has the full API.

The document (core properties) with one guarded action, chained as in the starter's `lead.ts`:

```ts
// ontology/drive/document.ts
import { action, ActionRejected, entity, p, rel, User } from "@segmentstream/ontology";
import { Effect, Schema } from "effect";
import { requireLevel } from "./access"; // wraps accessOf and rejects below the level, saying what to ask for
import { DocumentFolder } from "./document-folder";
import { CONFIDENTIALITY, FORMATS, TEAM_ACCESS } from "./options"; // select options, each with a description

export const Document = entity("document", {
  id: "ent_document",
  label: "Document",
  plural: "Documents",
  title: "title",
  writes: "actions",
  description:
    "A company document: an uploaded file or an online document. Who may open it is decided by its class, " +
    "its team access and its shares; document.open reads it. Always give people its link.",
  properties: {
    title: p.text({ maxLength: 300, description: "Readable title." }),
    format: p.select(FORMATS, { default: "file", managed: true, description: "File or online document, set at creation." }),
    confidentiality: p.select(CONFIDENTIALITY, { default: "general", managed: true, description: "Always its folder's class." }),
    teamAccess: p.select(TEAM_ACCESS, { default: "restricted", managed: true, description: "What every teammate may do with a general document." }),
    file: p.blob({ optional: true, maxBytes: 100 * 1024 * 1024, description: "The file; each edition is a revision." }),
    sha256: p.text({ optional: true, managed: true, maxLength: 64, description: "SHA-256 of the current edition." }),
    trashedAt: p.timestamp({ optional: true, managed: true, description: "When it went to the trash; empty otherwise." }),
    legalHold: p.boolean({ default: false, managed: true, description: "While held, nothing may delete or change it." }),
  },
  relationships: {
    folder: rel.one(() => DocumentFolder, { inverse: "documents", onDelete: "restrict", phrase: ["is in", "holds"], description: "Its folder." }),
    owner: rel.one(User, { optional: true, inverse: "ownedDocuments", onDelete: "restrict", phrase: ["is owned by", "owns"], description: "Who manages it." }),
    trashedBy: rel.one(User, { optional: true, inverse: "trashedDocuments", onDelete: "restrict", phrase: ["is trashed by", "trashed"], description: "Who put it in the trash." }),
  },
  indexes: [["folder", "updatedAt"]],
}).actions((self) => ({
  trash: action({
    description:
      "Move a document to the trash. It leaves folders, search and every share at once and is purged after " +
      "the retention period unless restored. Needs editor access. Refused under legal hold.",
    input: Schema.Struct({ document: self.ref }),
    hints: { destructive: true, irreversible: false, idempotent: true },
    writes: [self],
    handler: ({ input, principal }) =>
      Effect.gen(function* () {
        const document = yield* self.get(input.document, { forUpdate: true });
        yield* requireLevel(document, principal, "editor", "move it to the trash");
        if (document.legalHold) {
          return yield* new ActionRejected({ message: "The document is under legal hold; a Drive admin must lift the hold first." });
        }
        if (document.trashedAt !== null) return { id: document.id, trashed: false };
        yield* self.update(document, { trashedAt: new Date().toISOString(), trashedBy: principal.id });
        return { id: document.id, trashed: true };
      }),
  }),
  // draft, upload, open, readContent, editContent, saveSections, saveVersion, … as in section 3.
}));

// document-folder.ts, every folder above, kept by add and move: ancestors: rel.many((): typeof DocumentFolder =>
//   DocumentFolder, { inverse: "descendants", phrase: ["is below", "is above"], description: "Every folder above." }),
```

The one access function every action asks (rules 1 to 6 of section 2):

```ts
// ontology/drive/access.ts
import { Effect } from "effect";
import { DocumentFolder } from "./document-folder";
import { DocumentShare } from "./document-share";

export const LEVELS = ["none", "viewer", "commenter", "editor", "manager"] as const;
export type Level = (typeof LEVELS)[number];
const CLASS_ADMIN: Record<string, string> = { general: "drive_admin", hr: "hr" };
const TEAM_LEVEL: Record<string, Level> = { restricted: "none", viewer: "viewer", commenter: "commenter", editor: "editor" };
type Facts = { id: string; confidentiality: string; teamAccess: string; folderId: string; ownerId: string | null; trashedAt: string | null };

export function accessOf(document: Facts, caller: { id: string; roles: ReadonlyArray<string> }) {
  return Effect.gen(function* () {
    if (caller.roles.includes(CLASS_ADMIN[document.confidentiality] ?? "") || document.ownerId === caller.id) return { level: "manager" as Level, download: true };
    if (document.trashedAt !== null) return { level: "none" as Level, download: false };
    const general = document.confidentiality === "general";
    let best = { level: general && caller.roles.includes("team") ? TEAM_LEVEL[document.teamAccess] ?? "none" : "none", download: true };
    // A folder share reaches general documents only: their folder and every folder above it.
    const above = general ? yield* DocumentFolder.find({ where: { descendants: { some: { id: document.folderId } } }, limit: 50 }) : [];
    const folders = [document.folderId, ...above.map((folder) => folder.id)];
    const shares = yield* DocumentShare.find({
      where: { granteeId: caller.id, status: "active", or: [{ documentId: document.id }, ...(general ? [{ folderId: { in: folders } }] : [])] },
      limit: 50,
    });
    for (const share of shares) {
      if (share.expiresAt !== null && new Date(share.expiresAt).getTime() <= Date.now()) continue; // exact now; the sweep marks it later
      if (LEVELS.indexOf(share.level) > LEVELS.indexOf(best.level)) best = { level: share.level, download: share.allowDownload };
    }
    return best;
  });
}
```

The fence: the `guest` role, and the filter `team` adds to it (rules 2 to 6 of `accessOf`):

```ts
// ontology/drive/roles.ts
import { me, role } from "@segmentstream/ontology";

// A scope follows relationships one level deep, so the fence walks paths from me through each
// share's activeGrantee, which only active shares carry, instead of filtering shares by status.
const myShares = me.activeDocumentShares;
const viaShares = {
  trashedAt: { isNull: true },
  or: [
    { id: { in: myShares.document } },
    { confidentiality: "general", folder: { in: myShares.folder } },
    { confidentiality: "general", folder: { in: myShares.folder.descendants } },
  ],
};
const teamOpen = { trashedAt: { isNull: true }, confidentiality: "general", teamAccess: { in: ["viewer", "commenter", "editor"] } };
export const teamVisible = { or: [{ owner: me }, teamOpen, viaShares] }; // team: document:read and document_version:read

export const guest = role("guest", {
  description: "A person outside the company. Opens only what is shared with them, never internal comments.",
  permissions: [
    { permission: "document:read", where: viaShares },
    { permission: "document_version:read", where: { document: viaShares } },
    { permission: "document_folder:read", where: { or: [{ id: { in: myShares.folder } }, { id: { in: myShares.folder.descendants } }] } },
    "document:open", "document:readContent", "document:readVersion", "document:logDownload",
    "document_comment:post", "document_comment:edit", "document_comment:resolve",
    "document_share:sharedWithMe", "document_share:openLink", "document_share:askForAccess", "document_share:inviteColleague",
  ],
});
```

A workflow trigger:

```ts
// ontology/workflows/print-version.ts
import { after, run, workflow } from "@segmentstream/ontology/workflows";
import { Schema } from "effect";
import { Document } from "../drive/document";
import { DocumentVersion } from "../drive/document-version";

async function printVersion(input: { version: string }) {
  "use workflow";
  return await print(input.version);
}

async function print(version: string) {
  "use step";
  // print attaches once: a repeated run finds the PDF and changes nothing.
  return run(DocumentVersion.actions.print({ version }));
}

export default workflow("printVersion", {
  description: "Print each saved online version to PDF and attach it to the version.",
  role: "drive_printer",
  input: Schema.Struct({ version: Schema.String }),
  run: printVersion,
  triggers: [
    after("saved", Document.actions.saveVersion, {
      description: "saveVersion froze a version of an online document.",
      input: (event) => ({ version: event.result.version }),
    }),
  ],
});
```
