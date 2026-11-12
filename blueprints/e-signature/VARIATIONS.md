# E-signature: variations

Where companies legitimately differ. Each variation lists the options, what
each changes, and the default this blueprint takes. Nothing here is legal
advice: when a variation turns on the law, the person confirms with counsel.

## Legal strength of the signature

E-signature law differs by country and by kind of document. The blueprint does
not decide what a court accepts; it decides what evidence exists.

| Option | What it is, in short | What changes in the build |
| --- | --- | --- |
| **Simple electronic signature with strong evidence** (default) | Any electronic sign of intent: a typed or drawn name, with consent, identity checked by email, and an audit trail. The EU's eIDAS calls this a simple electronic signature; the US ESIGN Act and UETA accept electronic signatures generally, with exceptions. | Nothing. |
| **Advanced electronic signature** (eIDAS) | Uniquely linked to and identifying the signer, made with data under their sole control, and detecting later change. In practice a per-signer certificate. | Each signer signs through a certificate provider or a remote signing service, through a connection. The seal adds a PAdES signature per signer instead of drawn ink only. Identity verification becomes stronger (see below). |
| **Qualified electronic signature** (eIDAS) | An advanced signature with a qualified certificate on a qualified device, equal to a handwritten one across the EU. Issued only by a qualified trust service provider. | Integrate a provider's signing flow; this blueprint keeps envelopes, order, evidence and storage. A qualified timestamp authority for the seal. |
| **US consumer transactions** (ESIGN) | Before a consumer signs electronically, specific disclosures and consent: the right to paper, how to withdraw consent, hardware and software needed. | A consumer consent step before the first signature, recorded as its own event; the consent text grows; a paper-copy request action. |
| **Documents excluded from e-signature** | Many countries exclude or restrict some documents: wills, family law matters, some real estate deeds, court documents, certain notices; some need a witness or notary. | No code. The senders' guide and the agent's instructions list the kinds to check with counsel. A witness or notary step is a variation below. |

## How recipients prove who they are

| Option | Changes |
| --- | --- |
| Email link or code (default) | The platform's sign-in link to the recipient's email; an expired link falls back to a code by email. |
| Plus an access code | `accessCodeHash` on the recipient, set by the sender, shared by phone; `signingPage` asks for it; `sign` refuses without it; evidence says "email and access code". |
| Plus an SMS code | A connection to an SMS provider such as Vonage; an action sends a code to the recipient's phone and stores its hash; `sign` checks it. |
| Identity verification | A connection to an ID provider; the recipient verifies before signing; the provider's reference goes into the signature's evidence. |
| Company single sign-on for internal signers | Internal signers sign in with the company's identity provider; outside recipients keep email. |

## Who signs for the company

| Option | Changes |
| --- | --- |
| One company, one `companySignatory` role (default) | As designed. |
| Several legal entities | One signatory role per entity in code, the entity's legal name in config, and `capacity: ourCompany` names the entity. |
| Signing limits | A limit per role or per person in config; `submit` refuses an envelope above the signer's limit. |
| Two company signatures required | A rule in `submit`: at least two `ourCompany` signers above a value. |

## Internal approval

| Option | Changes |
| --- | --- |
| No rules (default to start), self-approval refused | As designed. |
| Self-approval allowed | Small companies where the founder sends and approves: remove the sender check from `grant`. |
| Rules by document type, value or template change | Add `templateChanged` to rules when the drive has templates: applies when the document's text differs from its template's. |
| Approvers in sequence | An `order` on approvals; `grant` notifies the next approver role instead of sending. |

## Recipients

| Option | Changes |
| --- | --- |
| Signer, approver, viewer (default) | As designed. |
| Copy only at the end | A `cc` kind that is notified only by `complete`. |
| In-person signing | A member hosts a signing on their device; evidence records the host and that it was in person. |
| Witness | A `witness` kind that signs after a named signer, with its own field kind. |
| Correcting a recipient | A `correctRecipient` action that changes the email of someone who has not acted and sends them a new link. Default: void and send again. |

## Fields and documents

| Option | Changes |
| --- | --- |
| Fields placed per envelope (default) | As designed. |
| Saved layouts | A field layout saved on a drive document or template, copied by `addDocument`; lets the agent send without placing fields. |
| Anchor text | Fields placed where the PDF contains a marker such as `[[sign:customer]]`; `addDocument` finds the text positions. |
| Online documents from the drive | Fields come from markers in the drive's text and are measured when the drive prints the PDF; the envelope still signs the printed PDF. |

## The seal

| Option | Changes |
| --- | --- |
| Public RFC 3161 timestamp, no company key (default) | As designed. |
| Commercial or qualified timestamp authority | A credentialed connection instead of the public one. |
| Company seal | The sealed PDF is also signed with the company's own certificate (PAdES), kept in a key management service reached through a connection. Needs key custody and renewal. |
| Long-term validation | Embed the timestamp authority's certificate chain and revocation data (a document security store), so the seal verifies after certificates expire. |
| PDF/A | Produce PDF/A for archives, with fonts embedded and the evidence attached. |
| Editions after signing | By default a signed document stays locked and an amendment is a new document. Alternatively, let drive add a version to a `signed` document, which sets the lock back to `none` and leaves the sealed version in history. |
| A separate certificate file | Store the certificate of completion as its own PDF next to each sealed document. |

## Delivery and language

| Option | Changes |
| --- | --- |
| Links only, platform email (default) | `User.sendSignInLink` with the workspace's templates; the sealed PDF is downloaded from the signing page. |
| Attachments | A mail connection such as Resend; `complete` attaches sealed PDFs up to a size limit and falls back to a link. |
| One language (default English) | One set of templates and consent. |
| Several languages | `language` on envelope and recipient; templates whose words are filled per language; consent per language with its own version; dates in the recipient's format. |

## Visibility, retention and scale

| Option | Changes |
| --- | --- |
| Sender, admins and pending approvers see an envelope (default) | As designed. |
| Everyone in a team role | Grant `envelope:read` unscoped to `team`. |
| Follow the drive | Read an envelope when the member may read all its documents in the drive; decided in `signingPage` and a read action. |
| Keep everything (default) | As designed. |
| Retention policy | A legal hold flag and a retention period per document type; nothing is deleted under hold. |
| Outside recipients keep access (default) | They can download their sealed copies later. |
| Outside access ends | A workflow deactivates outside members a set number of days after their last envelope completes. |
| Bulk send | One document to many separate recipients becomes one envelope each, created by a workflow from a list. |
| Public verification | `/verify` open to anyone, answering only whether a file matches a sealed envelope and when it was sealed. Default: members only. |
