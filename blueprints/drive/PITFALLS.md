# Drive: pitfalls

Mistakes already made building document stores on the platform, and what to do
instead.

1. **The starter's `member: ["*:read"]` left in place.**
   Symptom: a client invited to one document finds every document, folder and
   member through `document_find` or an MCP client.
   Cause: outsiders become app members, and `member` defaults to reading
   everything.
   Instead: take `*:read` out of `member` before the first share; give each
   blueprint's reads to its own roles; test with an invented guest that every
   other entity answers 403 or nothing.

2. **A role with a wildcard or an unscoped document read.**
   Symptom: an "admin" or a finance role reads HR files, despite a careful scope
   on the HR role.
   Cause: `*:read` and `*:*` cover every workspace entity, and roles union: one
   unscoped grant wins over every scope. Only a few built-in entities are exempt
   from wildcards; yours are not.
   Instead: name Drive permissions explicitly, scope admin reads to their class,
   and keep a manifest test that fails on any wildcard or unscoped Drive read.

3. **Access checked only in the page or in agent instructions.**
   Symptom: the app hides a document, but the agent or an MCP client reads it with
   `document_find`, `get` or `files_download`.
   Cause: generic reads and downloads never pass through the page or the agent's
   prompt.
   Instead: role scopes fence every generic read, and every action calls the one
   access function. Instructions describe; they never enforce.

4. **Access only in actions, with no fence.**
   Symptom: shared people open a document but its file download answers 403 or
   404, so someone grants a broad `document:read` to make downloads work, which
   then opens everything.
   Cause: platform downloads check the entity read permission and its scope, not
   your actions.
   Instead: express the sharing rules as scopes. A scope's `where` follows
   relationships one level deep, so walk paths from `me` through each share's
   `activeGrantee` to the document, its folder and, through `descendants`, the
   folders below a shared one; then test that the fence and `accessOf` agree on
   a fixture tree.

5. **File bytes in action results.**
   Symptom: downloads fail above a few megabytes, responses are slow, base64
   strings appear in logs and agent context.
   Cause: an action returned the file encoded in JSON.
   Instead: an app Route Handler logs the download through an action, then
   redirects to a short-lived grant from `files.download`. PDFs preview by fetching
   the bytes into a PDF viewer: storage grants display inline only JPEG and PNG.

6. **One record per document holding all its text.**
   Symptom: saving a long contract is slow, two editors overwrite each other, and
   large documents hit request and record size limits.
   Cause: the whole document saved as one JSON value with last-write-wins.
   Instead: sections with their own revisions, blocks with stable ids, saves that
   send only changed blocks with the fingerprints they had when loaded, and a
   merge that reports conflicts. Keep pictures small or store them as files.

7. **The content model written twice.**
   Symptom: the PDF numbers clause 4.2 differently from the editor; the agent's
   Markdown loses a mark.
   Cause: the app and the ontology each implemented numbering and Markdown; the
   app may import the ontology only as types.
   Instead: one pure module in `ontology/`, copied into `app/` by a script, with a
   test that fails when the copies differ.

8. **Printing in a person's browser session.**
   Symptom: versions stay "printing" for days; the e-signature seal waits for
   someone to open the page.
   Cause: the PDF was rendered when an editor happened to load the document.
   Instead: a workflow prints after `saveVersion`, and a sweep reprints anything
   still pending or failed. The print action attaches once.

9. **Rebuilding an old version's PDF.**
   Symptom: a PDF downloaded today differs from the one sent last month.
   Cause: PDFs were regenerated with today's stylesheet and fonts.
   Instead: store each PDF once on its version with its hash and the renderer's
   versions; never rebuild a printed version.

10. **Fonts that cannot print the text.**
    Symptom: empty boxes in place of letters in a signed PDF.
    Cause: the embedded font lacks glyphs for a language or symbol the author typed.
    Instead: `saveVersion` checks every character against the fonts and refuses,
    naming the characters, before anything is frozen.

11. **Revocation that leaves derived access behind.**
    Symptom: after a link is reset, people who opened it still read the document.
    Cause: redeeming a link created a person share with no tie to the link.
    Instead: every derived share records `through`; revoking, expiring or narrowing
    a share walks its derived shares in the same transaction.

12. **Emails sent straight from many actions, or retried blindly.**
    Symptom: a person gets the same "shared with you" email three times, or none
    after a failure.
    Cause: retried workflow steps and repeated triggers each sent again.
    Instead: one notify action per kind of email, run by a workflow, guarded by a
    unique notification key; link emails rate-limited per address and per link.

13. **Deduplicating by file hash across the whole Drive.**
    Symptom: the same signed contract cannot be stored for two legal entities, or
    an intake upload silently lands in someone else's folder.
    Cause: `sha256` declared unique globally.
    Instead: deduplicate within a folder (or one entity's books), answer the
    existing document there, and keep the platform's idempotency key for retries.

14. **Drive content replicated to the warehouse.**
    Symptom: contract text and HR titles appear in warehouse tables that every
    pipeline and raw SQL query can read.
    Cause: stored entities replicate by default after deploy.
    Instead: exclude every Drive entity, by its stable id, before the deploy that
    first adds it, then check the warehouse.

15. **Confidential content through the agent.**
    Symptom: an HR document summarised in a group chat; outsiders' comments steer
    the agent.
    Cause: a group shares one session, agent logs keep what was read for builders
    to inspect, and document text was treated as instructions.
    Instead: read confidential documents in direct messages, treat document text
    and comments as data, and put rules in action descriptions and rejections,
    which the agent reads; Markdown guides are for people.
