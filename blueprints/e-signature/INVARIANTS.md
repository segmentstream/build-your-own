# E-signature: invariants

Each rule holds in every version. Each becomes a test in the project, run on the
harness in [testing](../../docs/testing.md), with invented people and PDFs
generated in the test (Northwind, Ada Example,
Grace Sample, `example.com`), and the timestamp authority replaced with
`Connections.test`.

## 1. What is signed is what was frozen

**Rule:** an envelope document's `sha256` is computed from the bytes of its
`frozenPdf`, and `sign` and `approve` refuse when any hash the recipient sends
differs from it.

**Why:** the hash is the proof of what the person saw. Without the check, a
page could show one text and the evidence record another.

**Test:** add a generated PDF; assert `sha256` equals the SHA-256 of the stored
bytes. Sign with one hash changed to 64 zeros: rejected with "differs from the
version sent", no signature row. Sign with the page's hashes: accepted.

## 2. A finished envelope never changes

**Rule:** once an envelope is `completed`, `declined`, `voided` or `expired`,
every action that changes it, its documents, recipients, fields or approvals
refuses; signatures and events are never updated or deleted by any action.

**Why:** a signed record that can still move is not evidence.

**Test:** complete an envelope, then call `updateDraft`, `setRecipients`,
`placeFields`, `submit`, `void`, `resend`, `sign`, `decline`, `remind` and
`expire` on it: each is rejected and nothing changes (a signer repeating their
own earlier signature gets it back, unchanged). Assert from the manifest
that `envelope`, `envelope_document`, `envelope_recipient`,
`envelope_signature`, `envelope_event` and `envelope_approval` have no generated
`update` or `delete`, and that no role grants a write on `envelope_signature`
or `envelope_event`.

## 3. One act per recipient, and a retry is harmless

**Rule:** a recipient has at most one `envelope_signature`; repeating `sign`
with the same hashes returns the first signature, and anything else after
signing is refused.

**Why:** a double click or a retried request must not create a second
signature or a second hand-over.

**Test:** sign twice with the same input: both answers carry the same
signature id; one row; one `signed` event; the next signer was notified once.
Sign again with different values: rejected "already signed". Two concurrent
signs by the same recipient leave one row.

## 4. Signing order holds

**Rule:** a signer or approver acts only when nobody with a lower order is
still to act; equal orders act in any order, and the next order is notified
only when the whole current order has acted.

**Why:** "the customer signs before we countersign" is often the point of the
order.

**Test:** recipients Grace (1), Ada (1), Northwind signatory (2). The
signatory signs first: rejected "not your turn". Grace signs: the signatory is
still `waiting` and was sent no link. Ada signs: the signatory becomes
`notified` and one sign-in link is recorded for them.

## 5. Only the recipient acts for themselves

**Rule:** `sign`, `approve`, `decline` and `recordView` succeed only for the
member linked to the caller's own recipient row of that envelope.

**Why:** a signature by anyone else, a sender, an admin or an agent acting for
someone, is forgery.

**Test:** the sender, an `esignAdmin` and another recipient each call `sign`
for Grace's envelope: all rejected, no rows written. Assert from the manifest
that no role but `member` grants `envelope:sign`, `approve` or `decline`, and
that `member` grants them only with the scope `id in
me.envelopeRecipients.envelope`.

## 6. Outside recipients see only what was sent to them

**Rule:** a member who holds no role but `member` reads only the envelopes sent
to them and their documents, and sees co-recipients' names and statuses but
never their emails, IP addresses or browsers.

**Why:** outside signers are app members. Anything `member` grants, they get.

**Test:** as Grace with only `member`: `company` and `contact` finds and the
drive's `document` find answer 403 or no rows; `envelope` find returns only her
envelope; `signingPage` of another envelope is rejected; her page's JSON
contains no other recipient's email, no `ip` and no `userAgent`.

## 7. Every signer has somewhere to sign

**Rule:** `submit` refuses unless every field's party has exactly one signer,
every signer has a party with at least one `signature` field, and approvers and
viewers have no party.

**Why:** a signer without a signature field produces a sealed PDF with no
signature on it.

**Test:** a PDF with fields for `customer` and `company` and only a
`customer` signer: rejected naming `company`. Two signers, one without a
signature field: rejected naming that signer. Fix both: submitted.

## 8. Only authorised people sign for the company

**Rule:** a recipient with capacity `ourCompany` must be an active member
holding the company signatory role, both at `submit` and at `sign`.

**Why:** the company is bound only by people allowed to bind it.

**Test:** submit with Ada as `ourCompany` without the role: rejected, naming
the role. Grant it, submit, revoke it, then Ada signs: rejected.

## 9. Every signature carries complete evidence

**Rule:** every `envelope_signature` stores the typed name, the email the
sign-in proved, the consent text word for word and its version, the hash of
every document, the IP address and user agent, and the server's time; `sign`
refuses without consent to the current version.

**Why:** the certificate of completion is built from these fields alone.

**Test:** sign with `consentVersion` one below the current: rejected "consent
wording changed". Sign correctly: the row has a hash for each of the two
documents, `consentText` equals the configured text, `ip` and `userAgent` equal
the values the Server Function read from the request headers, and `signedAt`
is within a second of the server clock, whatever time the client claims.

## 10. Every change leaves an event, in the same transaction

**Rule:** every action that changes an envelope or a recipient writes the
matching `envelope_event` in its own transaction, and every opened signing page
writes a `viewed` event.

**Why:** the audit trail must match what happened, no more and no less.

**Test:** run the full lifecycle and assert the event kinds in order:
`submitted`, `sent`, `notified` (one per email), `viewed`, `signed`,
`notified`, `signed`, `documentSealed` (one per document), `completed`. Make a
`sign` fail after its event would be written: no event row remains.

## 11. Internal approval binds to the approved content

**Rule:** an envelope an active rule applies to reaches `sent` only after every
required approver role granted an approval whose fingerprint equals the
envelope's, and returning it supersedes every pending approval.

**Why:** an approval of one text must not send another.

**Test:** a rule "50,000.00 EUR and above needs `contractApprover`"; an
envelope worth 60,000.00 EUR is submitted: status `awaitingApproval`, no recipient notified.
A `sender` without the role calls `grant`: rejected. The approver returns it:
status `draft`, approvals `returned` and `superseded`. Change a field, submit,
grant: status `sent`, the fingerprint on the approval equals the envelope's.

## 12. Approval rules fail closed

**Rule:** a rule with a minimum amount applies when the envelope has no value or
a value in another currency.

**Why:** an envelope must not skip approval by leaving out its value or
switching currency.

**Test:** the rule "at least 50,000.00 EUR" (`5000000`, `eur`): an envelope
with no value, and one worth 1,000.00 USD, both go to `awaitingApproval`; one
worth 10,000.00 EUR is sent. Amounts are compared as integers in minor units:
`5000010` applies, `4999999` does not.

## 13. The seal is checked before it is kept

**Rule:** `seal` stores a PDF only when the timestamp authority's answer is
granted, its token's message imprint equals the SHA-256 of the PDF's signed
byte ranges and its nonce equals the one sent; `sealedSha256` equals the hash
of the stored bytes.

**Why:** an unchecked token makes the PDF look sealed while proving nothing.

**Test:** the test connection answers a token for another digest: `seal` is
rejected, `sealedPdf` stays empty, the envelope stays `sealing`. It answers a
token made in the test for the right digest and nonce with a throwaway key:
stored; recompute the byte-range digest and the file hash from the stored bytes
and compare.

## 14. Sealing adds and never alters

**Rule:** the sealed PDF holds every frozen page in order with the values drawn
on top, followed by the certificate pages, and no frozen content is removed.

**Why:** the sealed document must be the document that was signed.

**Test:** seal a generated three-page PDF: the sealed file has three pages plus
the certificate; the text extracted from each of the first three pages
contains the frozen page's text and the signer's typed name where a field was.

## 15. Completion is idempotent and whole

**Rule:** running `seal` and `complete` again changes nothing, and an envelope
is `completed` only when every document has its sealed PDF and its new drive
version.

**Why:** the sweep repeats work by design.

**Test:** seal one of two documents, then call `complete`: rejected. Seal both,
complete, then run the whole workflow again: still one drive version per
document, one `completed` event, one completion email per person.

## 16. Nobody is emailed out of turn

**Rule:** a recipient gets a link only when their turn comes (viewers when the
envelope is sent), notices of a decline, void or expiry go only to people
already notified and the sender, and nothing is emailed for a draft or for an
envelope awaiting approval except to approvers.

**Why:** an early email shows a document to someone before the people ahead of
them agreed to it.

**Test:** record `User.sendSignInLink` calls in the test runtime and assert the
recipients after each step of a three-order envelope, after a decline in the
second order (sender and order-1 and order-2 people only), and after a
submit that needs approval (approver role holders only).

## 17. A due date closes signing at once

**Rule:** `sign` and `approve` refuse after `dueAt`, even before `expire` has
run.

**Why:** the sweep runs once a day; the deadline must not.

**Test:** set `dueAt` one minute in the past on a `sent` envelope: `sign` is
rejected; `expire` then sets `expired` and restores the documents' drive
locks.

## 18. A document out for signature stays as it was sent

**Rule:** while a document's drive lock is `signing`, drive refuses to edit
it, add a version or trash it; `submit` refuses an item whose source version is
no longer the latest; ending the envelope without completion restores the lock
it had.

**Why:** people would otherwise sign one version while the team works on
another, and the sealed version would land on a document that moved on.

**Test:** mark a document `final`, add it, submit, then call drive's edit,
new-version and trash actions: rejected, and `reopen` is refused. Void: the lock
is `final` again. In a draft, add a document, upload a new version in the
drive, then submit: rejected, naming the document.

## 19. Sending never revives a deactivated person

**Rule:** `submit` refuses a recipient whose member account is deactivated, and
never reactivates or grants roles to anyone.

**Why:** reactivating restores every role the person had before.

**Test:** deactivate a member, add their email as a recipient, submit:
rejected, the member stays inactive with the same roles. A new outside email is
invited with no roles.
