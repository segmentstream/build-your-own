# Drive

Your company's own document store and online editor: folders, uploaded files and
documents written in the browser, with versions, sharing and an access log. It
replaces Google Drive and Google Docs for company documents.

## What you get

- One folder tree for every company document, with company folders, a personal
  folder for each member and confidential areas (such as HR) that only their own
  role can open.
- Contracts, policies and offers written online, by several people at once,
  without losing anyone's edit. Templates with fields fill themselves in.
- Every saved version kept for good, with a PDF printed once and a fingerprint,
  so you can always show exactly what a document said on a given day.
- Sharing with colleagues and outsiders by email or by link, as viewer,
  commenter or editor, with an end date and downloads on or off. Revoking ends
  access at once.
- Comments, suggested edits and internal notes that people outside the company
  never see, with mentions that email only people who can open the document.
- A log of who opened and downloaded each shared document, access requests that
  wait for the owner, a trash that empties itself after a retention period, and
  legal hold that stops anything from being deleted.
- Documents linked to the records they concern: a company, a contact, a deal,
  an invoice. Each record's page lists its documents, filtered by what the viewer
  may open.
- Your workspace agent finds, reads, drafts and files documents from chat, and
  shares them only after you confirm the exact people.

## Build it

```text
Read https://github.com/segmentstream/build-your-own/blob/main/AGENTS.md and follow it.
Build our Drive from the drive blueprint.
```

## How it fits

- **[E-signature](../e-signature/)** depends on Drive: an envelope signs a
  frozen Drive version, and the sealed PDF comes back as the document's newest
  version.
- **[CRM](../crm/)**: link documents to companies, contacts and deals, and
  prepare a contract from a deal with a template.
- **[Bookkeeping](../bookkeeping/)**: invoices, bills and receipts are Drive
  documents linked to the records they evidence.
- **[Company agent](../company-agent/)**: files the documents people send in
  chat and sends stored files back to the chat.
- Builds on the shared [foundation](../../foundation/FOUNDATION.md): documents
  link to its companies and contacts, and access is granted to its members.

## What it is not

- Not live co-editing with cursors. People edit the same document at the same
  time and their changes merge block by block; a conflict on the same paragraph
  is shown, never lost.
- Not an Office editor. Word, Excel and other files are stored, versioned,
  shared and downloaded, not edited in place.
- Not a vault against your own builders. People who write the workspace's code
  or run its pipelines can reach stored content; confidential areas protect
  documents from colleagues and outsiders, not from them.
