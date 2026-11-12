# E-signature: pitfalls

Mistakes already made building signing on the platform. Each is easy to repeat.

## 1. Outside signers can read the whole workspace

- **Symptom:** a customer who signed an NDA can list your companies, deals and
  documents through the API or an MCP client.
- **Cause:** outside recipients are app members, and the built-in `member` role
  holds the starter's `*:read`. Every member gets it.
- **Instead:** `member` grants only the recipient permissions scoped to
  envelopes sent to the caller. Put what employees read in a `team` role that
  every employee holds. Test it with a principal that holds only `member`.

## 2. Scoped permissions surprise in both directions

- **Symptom:** the first of two signers signs and nothing is saved (a 404), or
  any member can call `sign` on someone else's envelope.
- **Cause:** a scope bounds only the action's writes of its own entity. A `sign`
  on the recipient entity scoped to `{ user: me }` that also marks the next
  signer's turn writes a row outside the scope, so the whole action answers 404.
  The opposite: reads inside a handler run with the action's authority, so a
  handler that never writes the scoped row is never checked.
- **Instead:** put the recipient's acts on `envelope`, scoped to
  `id in me.envelopeRecipients.envelope`, so the hand-over can write other
  recipients' rows. Start every handler by finding the caller's own recipient
  row (`user = principal.id`) and refusing without it.

## 3. Outside signers get 403 on "Download signed PDF"

- **Symptom:** the signing page shows "completed", but the download fails for
  everyone outside the company.
- **Cause:** file downloads and `Files.open` check the caller's read permission
  and scope on the entity that holds the file. The signer had no read on it.
- **Instead:** keep the frozen and sealed PDFs on `envelope_document` and grant
  `member` its read scoped to envelopes sent to the caller. Test the download
  as an outside recipient, not as an admin.

## 4. Sealing waits for a PDF that only a browser can print

- **Symptom:** everyone has signed, but the envelope never completes until a
  team member happens to open the document.
- **Cause:** online documents were printed to PDF by a headless browser behind a
  team member's page, and the seal needed that PDF.
- **Instead:** printing belongs on the server (the drive blueprint prints in an
  action's `prepare`), and an envelope accepts only a version that already has
  its PDF, copied into the envelope at `addDocument`. Signers sign that PDF and
  its hash. Nothing after sending depends on a person opening a page.

## 5. A deploy loses the run and the envelope stays in "sealing"

- **Symptom:** an envelope fully signed yesterday is still being sealed.
- **Cause:** a workflow run can be lost when a deploy replaces the deployment it
  ran on, and an action trigger fires once.
- **Instead:** a cron sweep every 15 minutes picks up envelopes that stood in
  `sealing` for 10 minutes. Make `seal` and `complete` return what they did
  before, so a repeat is harmless. Send emails from the actions themselves with
  `User.sendSignInLink`, which is durable once the action commits, rather than
  from workflow steps.

## 6. Parallel signers race at the hand-over

- **Symptom:** two signers at the same order sign within a second; the next
  signer is never notified, or is notified twice.
- **Cause:** each `sign` read the other as unsigned, or both decided they were
  last.
- **Instead:** read the envelope with `forUpdate: true` first in every act, so
  acts on one envelope run one after another and exactly one sees the order
  complete.

## 7. Replies to a signing email reach the previous signer, or nobody

- **Symptom:** a customer replies "Can we change clause 4?" and the email goes
  to the other side's signer, or bounces.
- **Cause:** without `replyTo`, a sign-in link email replies to the member whose
  action sent it. The hand-over runs as the signer who just signed; reminders
  run as a workflow, which has no address.
- **Instead:** set `replyTo` on every envelope template to a mailbox the
  company reads, such as `contracts@example.com`, or a variation that fills the
  sender per envelope.

## 8. Signed evidence can be rewritten

- **Symptom:** a role with `*:update`, an admin console or an agent can change a
  signature's IP address or an event's time.
- **Cause:** entities keep generated `create`, `update` and `delete` unless they
  declare otherwise, and wildcard roles cover them.
- **Instead:** `writes: "actions"` on every e-signature entity but the approval
  rules; no action updates or deletes a signature or an event; a test asserts
  this from the manifest.

## 9. The IP address and browser come from the browser

- **Symptom:** the certificate shows the IP address the page claimed, or none.
- **Cause:** the page sent `ip` and `userAgent` as form fields.
- **Instead:** the app's Server Function reads `x-forwarded-for` (first entry)
  and `user-agent` from the request headers and passes them to the action. The
  browser sends neither. The action's input description says so, for anyone
  reading the API.

## 10. A seal that proves nothing

- **Symptom:** the sealed PDF shows "signature invalid" or "document altered" in
  a PDF reader, or the token belongs to another digest.
- **Cause:** the response was stored without checking it; the `/ByteRange`
  changed length when the real offsets were written, moving every byte after
  it; object streams rewrote offsets; or the `/Contents` placeholder was too
  small for a token that carries the authority's certificate chain.
- **Instead:** check the status, the message imprint and the nonce before
  storing. Write `/ByteRange` with fixed-width numbers and pad in place. Save
  without object streams. Reserve at least 16 KB for `/Contents`. Seal one
  document per action, and limit size and pages at `addDocument`, so `prepare`
  stays inside its 60 seconds. Open one sealed PDF in a desktop reader before
  calling it done.

## 11. The workflow build fails on PDF code

- **Symptom:** deploy or the first run fails in the workflow bundle on
  `node:crypto` or a PDF library.
- **Cause:** the `"use workflow"` code is bundled without Node.js modules, and a
  workflow file imported an entity module that imports them at its top.
- **Instead:** keep entity declarations in a module with no Node-only imports.
  Load the PDF and crypto code inside `prepare` or a step with
  `await import(...)`.

## 12. The agent sends to people nobody named

- **Symptom:** a confirmation card reads "Send to Grace" and the envelope goes
  to an address the person never gave.
- **Cause:** the card cannot show email addresses, and the agent filled in a
  likely address or a similar contact.
- **Instead:** before `submit`, the agent lists each recipient's name, full
  email, kind and order in a message, each taken from the person's words or a
  record, and asks. Its instructions forbid guessing an address.

## 13. Sending revives a removed person

- **Symptom:** a former employee or an old guest gets their access back because
  someone sent them a document.
- **Cause:** inviting or reactivating an existing deactivated member restores
  every role they held.
- **Instead:** `submit` refuses a recipient whose account is deactivated and
  says an administrator decides. It never grants roles to existing members.

## 14. Lifecycle values that nothing writes, or that nothing accepts

- **Symptom:** `expired` never appears and reminders never go out although the
  envelope has a due date and a cadence; or completing works in tests and fails
  in production with a value the column rejects.
- **Cause:** a status or setting was declared without the action or schedule
  that uses it; or an action wrote a value that is not one of the select's
  options, and the in-memory test did not check options.
- **Instead:** for each status and setting, name the action or workflow that
  sets or reads it, and test that path. Run the full lifecycle once against a
  real migrated database (`segmentstream dev`) before the first deploy.

## 15. Outside recipients are sent to a sign-up they cannot finish

- **Symptom:** a customer clicks "Review and sign" and lands on an account
  registration or a central login.
- **Cause:** the app declared SegmentStream-only browser sign-in, which may
  require a SegmentStream account.
- **Instead:** keep the starter's email sign-in (codes and links), which needs
  no account. Recipients are invited by the envelope, so `signIn.policy:
  "invited"` admits them.
