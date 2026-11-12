# Drive: variations

Where companies legitimately differ. Each variation lists the options, what each
changes, and the default this blueprint takes.

## Who is inside

- **Options:** a `team` role held by employees (default); every member is staff,
  so `member` holds the team permissions; several teams with their own company
  folders.
- **Changes:** with no outsiders signing in, `member` may hold the team's fenced
  reads and actions, and `guest` disappears. Per-team areas are top-level folders
  with `defaultTeamAccess: restricted` shared with that team's members, or a
  confidential class per team when it must be closed to admins too.
- **Default:** a `team` role; `member` reads nothing of Drive.

## Outside sharing

- **Options:** none; by email only; by email and link (default); outsiders may
  edit (`allowOutsideEditors`); only managers share (`editorsCanShare: false`).
- **Changes:** "none" removes `guest`, links, the link page and webhook, and
  requests from outsiders. Data rooms (a folder shared with investors with an end
  date, downloads off and the access log) need nothing extra.
- **Default:** email and link, viewer or commenter, editors may share.
- **Not built:** watermarking each page with the viewer's email, and view-only
  previews of files with downloads truly blocked (the browser receives the bytes
  of anything it displays).

## Confidential classes

- **Options:** `hr` (default); `board`, `legal`, `payroll`, `equity` or a class
  per client matter; none.
- **Changes:** each class adds a `confidentiality` option, a top-level folder, a
  role holding reads scoped to it and its admin actions, and a line in
  `CLASS_ADMIN`. Classes never open through folder shares or links.
- **Default:** `general` and `hr`.
- **Bookkeeping already built:** if a separate `restricted_document` entity exists
  for sensitive finance files, keep it; Drive's classes cover documents in the tree.

## Admins and personal files

- **Options:** admins read every `general` document, personal ones included
  (default); admins only transfer ownership of a deactivated member's files.
- **Changes:** the second scopes the admin's reads to `{ folder: { kind: "shared" } }`
  plus a transfer action; recovering a leaver's files then needs that action.
- **Default:** admins read personal files.

## Folder model

- **Options:** one tree with folder shares (default); shared drives only, where
  access is granted to a top-level area and never to a folder inside it.
- **Changes:** shared drives replace `ancestors` with one `drive` relationship on
  each folder and document, which makes moves cheaper and the fence simpler, at
  the cost of sharing a subfolder.
- **Default:** one tree.

## Who manages company folders

- **Options:** Drive admins (default); every teammate; the owner named on a
  top-level folder.
- **Changes:** who holds `document_folder:add`, `rename`, `move`, `remove`, and the
  check in each.
- **Default:** admins; members manage their own personal folders.

## Filing rules

- **Options:** by hand (default); automatic by document type, linked company and
  year, such as `Clients/<company>/<year>`.
- **Changes:** rule-made folders carry a stable `key` (`company:<id>/2026`) and are
  found by it, never by path; documents get `filedBy: auto | manual`, and one moved
  by hand stays put; a document type names its default folder.
- **Default:** by hand.

## Printing

- **Options:** a PDF library in the ontology service (default); headless Chromium
  printing the same HTML and stylesheet the editor shows; an HTML-to-PDF service
  through a declared connection.
- **Changes:** Chromium gives a PDF identical to the page but must fit the
  service's bundle size and the 60-second `prepare` limit; a service needs an
  account and sends content outside the workspace.
- **Default:** the in-service library. Paper size is A4 by default; companies in
  the United States and Canada usually want Letter.

## Languages

- **Options:** one language for emails and pages (default English); a language per
  document, used for its emails and its reader page.
- **Changes:** a `language` property and the workspace's texts by language; the
  email templates take every word as a value.
- **Default:** one language.

## Retention and legal hold

- **Options:** trash retention days (default 30); per-type retention ("keep
  invoices 10 years") that refuses trashing before the end date; holds per
  document (default), per folder or per company, placed by a workflow over the
  matching documents; a separate `legal` role for holds.
- **Changes:** retention periods are country law (accounting, employment, tax)
  and belong to the company's settings, never to the default. Holds over a folder
  or company page through the documents in bounded steps and record the matter.
- **Default:** 30 days; holds per document by class admins.

## Edits under legal hold

- **Options:** content frozen while held (default); edits allowed, with a version
  saved automatically before the first edit of each session.
- **Default:** frozen.

## Links to records

- **Options:** companies and contacts (default); deals (CRM); invoices, bills,
  journals and expenses (Bookkeeping); employees, projects, properties.
- **Changes:** one optional relationship on `document_link` per target, and a
  Documents tab on its page.
- **Documents attached to accounting records:** one file may evidence several
  records and the same bytes may evidence two legal entities, so deduplicate by
  `sha256` within one entity's books, never across the whole Drive. Evidence
  rules (which records need a document) belong to Bookkeeping. If Bookkeeping
  built its minimal `document` first, extend that entity under the same name and
  keep its fields.
- **Default:** companies and contacts plus installed blueprints' records.

## Intake

- **Options:** app upload (default); chat through the workspace agent (default
  when the agent is built); an email inbox through a Gmail connection and a
  workflow that files attachments; a narrow `submitter` role or API key that only
  hands in files and sees its receipts.
- **Changes:** the mailbox path reads one page of messages per step and calls
  `document.submit` per attachment, keyed by the message and attachment ids.
- **Default:** app and chat.

## Import from another drive

- **Options:** none (default); a one-time import from Google Drive, Dropbox or a
  file share.
- **Changes:** a workflow reads one page of the source per step through its
  connection, recreates folders, stages each file and records `sourcePath` and
  `sourceUrl` on the document as history only. The old path is not the folder.
  Duplicate bytes in one folder become one document.
- **Default:** none.

## Document types and structured data

- **Options:** none (default at first); types with a data schema such as amount
  (integer minor units), currency (lowercase ISO 4217), term and start date.
- **Changes:** `document_type`, `data` checked against the schema by
  `setDetails`; types can name a default folder and template.
- **Default:** added when the company asks for it.

## Search

- **Options:** titles and details (default); full text across documents.
- **Changes:** full text keeps a bounded `searchText` on each document, written by
  the saving actions and by text extraction from uploaded PDFs, and stays out of
  replication like everything else in Drive.
- **Default:** titles and details; text search inside one document through
  `readContent`.

## Reporting

- **Options:** none (default); counts of documents by type and month for admins.
- **Changes:** replicate only `document` without `title`, `data` and file names,
  and declare count metrics for admin roles, whose reads are scoped by a plain
  property that metric queries apply; they refuse the team and guest fences'
  paths from `me`.
- **Default:** no replication of Drive.

## File size

- **Options:** 100 MiB per file (default); up to the platform's per-file limit for
  video or design files.
- **Default:** 100 MiB.
