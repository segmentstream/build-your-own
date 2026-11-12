# E-signature

Send documents for signature and get back a sealed PDF that anyone can verify:
envelopes, signing order, a signing page for people outside your company, an
audit trail of every view and action, and a trusted timestamp on the final file.
It replaces DocuSign, Adobe Acrobat Sign and similar tools.

## What you get

- Send one or more PDFs from your drive in one envelope, to signers, approvers
  and people who only need a copy, in the order you choose. Equal positions
  sign in parallel.
- People outside your company sign from an emailed link on any device. They
  need no account and see only what was sent to them.
- What people sign is frozen when you send it. Each signature records the
  fingerprint of every document the signer saw, so nobody can later swap a page.
- Every send, email, view, signature, decline, void and seal is recorded with
  its time, the person, their IP address and browser. The record cannot be
  edited.
- Envelopes that need a manager's or lawyer's approval wait for it before they
  go out, and the approval is tied to the exact content that was approved.
- When the last person signs, each document becomes one sealed PDF: the
  original pages with the signatures in place, a certificate of completion, and
  an RFC 3161 timestamp that any PDF reader checks. It is stored as a new,
  unchangeable version of the document.
- Reminders, due dates, decline with a reason, and void by the sender happen on
  their own or in one click, and everyone concerned is told.
- Your workspace agent prepares envelopes, says who has not signed yet and
  sends reminders, always after you confirm. It never signs for anyone.

## Build it

```text
Read https://github.com/segmentstream/build-your-own/blob/main/AGENTS.md and follow it.
Build our E-signature from the e-signature blueprint.
```

## How it fits

- **[Drive](../drive/)** (required): documents and their versions live there.
  An envelope signs a drive version, and the sealed PDF comes back to the drive
  as the document's newest version.
- **[CRM](../crm/)**: send a contract from a deal, see a company's envelopes,
  and let the CRM move a deal forward when its contract is completed.
- **[Bookkeeping](../bookkeeping/)**: a signed order form or contract becomes
  the evidence behind invoices and schedules.
- **[Company agent](../company-agent/)**: ask in chat what is waiting for
  signature, prepare an envelope, remind or void, with a confirmation.
- Builds on the shared [foundation](../../foundation/FOUNDATION.md): recipients
  link to its contacts, envelopes to its companies.

## What it is not

- Not legal advice. The default is a simple electronic signature with strong
  evidence. Advanced or qualified signatures (for example under eIDAS) need a
  certificate provider; see the variations.
- Not a certificate authority. Your company holds no signing key by default;
  the seal comes from a public timestamp authority.
- No in-person signing, witnesses, notaries or bulk sending to thousands of
  people out of the box.

## Authors

- [SegmentStream](https://github.com/segmentstream)
