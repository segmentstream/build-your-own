# E-signature: interview

Ask these in one message, after the drive interview. Offer the default for each.

## 1. What do you send for signature, and roughly how many a month?

- **Why:** the kinds of documents decide the approval rules, the field layouts
  worth saving, and whether any document needs more than a simple signature.
- **Changes:** contracts and order forms to customers suggest a value on the
  envelope, approval by amount and a link to deals. Offer letters and HR forms
  suggest a separate approver and restricted visibility. Supplier or partner
  agreements suggest that the other side often signs first. A few hundred a
  month or more suggests saved field layouts (VARIATIONS.md).
- **Default:** any PDF from the drive; fields placed per envelope; no saved
  layouts.

## 2. Who may sign on behalf of your company, and for which legal entities?

- **Why:** a signature "for Northwind Ltd" is only worth something if the
  person may bind the company.
- **Changes:** one company: one `companySignatory` role. Several legal
  entities: one signatory role per entity, and `capacity: ourCompany` names the
  entity. Signing limits by amount: a check in `submit` against the envelope's
  value.
- **Default:** one company, one `companySignatory` role, no amount limit.

## 3. Which envelopes need someone's approval before they go out, and who approves?

- **Why:** approval is the control that stops a wrong price or a risky clause
  from reaching a customer.
- **Changes:** each answer becomes an `EnvelopeApprovalRule` and an approver
  role: "contracts above 50,000 need finance", "every offer letter needs HR",
  "any NDA not on our template needs legal". Whether the sender may approve
  their own envelope.
- **Default:** no rules at first; one `contractApprover` role ready to use;
  self-approval refused.

## 4. In which countries are you and the people who sign, and do any documents need more than a simple electronic signature?

- **Why:** e-signature law differs by country and by kind of document. This
  build gives a simple electronic signature with strong evidence; some
  documents need an advanced or qualified signature, a witness, a notary or
  paper.
- **Changes:** nothing in the core. It decides which variations to add (a
  qualified signature provider, consumer consent disclosures, a witness step)
  and which documents the senders' guide says not to send through this tool.
  This is not legal advice: suggest the person confirms with their counsel.
- **Default:** simple electronic signature for business documents; the guide
  lists the kinds of documents to check with counsel first.

## 5. How should people outside your company prove who they are?

- **Why:** the email link proves control of an inbox. Some companies want a
  second factor for valuable or sensitive documents.
- **Changes:** email link only; plus an access code the sender shares by phone;
  plus a code by SMS (needs an SMS connection such as Vonage); or an identity
  verification provider.
- **Default:** a sign-in link or code sent to the recipient's email.

## 6. How long should people have to sign, and how often should they be reminded?

- **Why:** without a due date, forgotten envelopes stay out forever and block
  edits to their documents.
- **Changes:** the defaults in `config.ts`, and whether senders can change them
  per envelope.
- **Default:** due in 30 days; a reminder every 3 days to whoever's turn it is;
  senders may change both.

## 7. In which languages do your signers read, and has a lawyer reviewed your consent wording?

- **Why:** the consent to sign electronically and the emails are what the
  signer agrees to. Every signature records the exact words.
- **Changes:** one language: one set of templates and one consent text. Several:
  a language per recipient, consent per language, and templates whose words are
  filled per language.
- **Default:** English only, with the blueprint's plain consent wording, marked
  for review by counsel.

## 8. Which timestamp authority should seal your documents?

- **Why:** the timestamp is what makes the sealed PDF verifiable by anyone. A
  qualified authority gives stronger legal presumptions in some countries.
- **Changes:** the URL in the `timestamp_authority` connection, or a
  credentialed connection for a paid or qualified service.
- **Default:** a free public RFC 3161 authority reachable over HTTPS, such as
  FreeTSA.

## 9. Who inside your company should see an envelope?

- **Why:** envelopes can hold salaries, prices and personal data.
- **Changes:** sender and admins only; everyone in a team role; or whoever may
  read all of its documents in the drive.
- **Default:** the sender and `esignAdmin`; approvers while it waits for them.

## 10. Do you use the CRM, and should a completed contract change anything there?

- **Why:** sending from a deal saves retyping, and a signed contract often
  means a won deal.
- **Changes:** with the CRM: the `deal` relationship, "Send for signature" on a
  deal suggesting its contacts, and optionally a CRM workflow that moves the
  deal when its envelope completes. Without it: company links only.
- **Default:** link envelopes to the company and, if the CRM exists, the deal;
  never change a deal automatically unless asked.

## 11. How should people receive the final signed PDF?

- **Why:** some recipients expect the PDF attached to an email.
- **Changes:** a link to the completed signing page (no mail connection needed),
  or attachments through your own mail provider (a connection such as Resend),
  with a size limit.
- **Default:** a link; the sealed PDF is downloaded from the signing page.

## Decisions a person makes every time

These are never defaults and never automatic. The agent asks, shows exactly
what will happen, and waits for a yes:

- **Sending** an envelope: the exact recipients, their emails, kinds and order.
  It emails people outside the company.
- **Approving** an envelope internally: the approver confirms the content they
  reviewed.
- **Voiding** an envelope, with its reason; recipients are told.
- **Signing, approving as a recipient or declining:** only the recipient, on
  the signing page. Never an agent, never on someone's behalf.
- **Discarding** a draft, and any change to the consent wording.
- **Running the seed script** anywhere but development: submitting emails
  people.
