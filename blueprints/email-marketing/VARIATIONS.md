# Email marketing: variations

Where companies legitimately differ. Each variation lists the options, what each
changes in the build, and the default this blueprint takes. Nothing here is
legal advice: the person confirms their own obligations, ideally with counsel.

## Email provider

- **Resend** (default): `ResendConnection`, `POST /emails` with an
  `Idempotency-Key` header, events by webhook. Resend signs webhooks with Svix,
  which webhook triggers do not check, so `emailEvents` uses a token URL. Reading
  domains needs a full-access key; a sending-only key can only send.
- **Amazon SES, Postmark, SendGrid, Mailgun, Brevo**: an `ApiKeyConnection` (or
  the provider's own connection where one exists) and a different send call,
  event parser and bounce taxonomy. Check whether the provider accepts an
  idempotency key. If it does not, add a `sending` status that a committed action
  sets before the call, and treat a message found `sending` after a crash as
  uncertain: look it up in the provider by a header you set (the message id)
  before sending again.
- **Changes:** `connections/connections.py`, `ontology/connections.ts`, the
  `send` and `sendTest` calls, the `emailEvents` parser, `checkDomain`, and the
  `real` engagement adapter.

**Default:** Resend.

## Consent rules by country

Topic bases, opt-in confirmation, consent expiry and the footer follow the law
where recipients are. Common patterns, to be confirmed by the person:

- **EU, EEA and UK** (GDPR with the ePrivacy rules, PECR in the UK): marketing
  email to individuals needs prior opt-in consent, with proof of how and when it
  was given. A soft opt-in for an existing customer's similar products can justify
  an `optOut` topic if the person could refuse at collection and can leave in every
  email. Rules for business addresses differ by country.
- **United States** (CAN-SPAM): opt-out based. Identify the sender, include a
  valid postal address, honour an opt-out within 10 business days, no misleading
  subjects. `optOut` topics are lawful there; mailbox providers still punish
  unwanted mail.
- **Canada** (CASL): express or implied consent; implied consent expires (two
  years after a purchase, six months after an inquiry). Add `expiresAt` to
  `Subscription` and treat an expired record as `noConsent`.
- **Germany and some other countries**: double opt-in is expected in practice as
  proof of consent.
- **Australia** (Spam Act): consent, sender identification, and an unsubscribe
  honoured within five working days.

**Default:** every topic `optIn`, single opt-in with evidence, a footer with the
legal name and postal address, opt-outs applied at once.

## Opt-in confirmation

- **Single opt-in** (default): `contact.subscribe` records `subscribed` with its
  source and evidence.
- **Double opt-in:** `subscribe` records `pending` and sends one confirmation
  email through its own small action (not a campaign); the link carries a token
  that a webhook workflow passes to `contact.confirmSubscription`, which records
  `subscribed` with the confirmation time in `evidence`. Pending records expire
  after a set number of days and never receive campaigns.

**Default:** single opt-in.

## Approval

- **Separate permission** (default): `campaignApprover` approves, including
  their own drafts.
- **Four eyes:** add `lastEditedBy` (set by `draft` and `edit`) and refuse
  approval by that member.
- **Two approvals above a size:** campaigns planning more than a set count need a
  second approver; record both.
- **Channels:** an approval through the workspace agent always shows Confirm and
  Cancel, because `approve` is irreversible. Permissions belong to the member,
  not the channel; a company that wants approvals only in the app has no
  supported switch for it today. Report that as a need rather than relying on
  agent instructions.

**Default:** separate permission, one approver, any channel.

## Audiences

- **Segments and topic audiences** (default).
- **Static lists:** a `rel.many` from `Audience` to `Contact`, filled by an
  action from, for example, an event's attendees. Consent still applies at
  preparation.
- **One person per company:** the preparation keeps one contact per company (the
  CRM's main contact, else the first by id) for account-based mail.
- **Size before preparing:** by default a size is learned by preparing a draft,
  which sends nothing, and `preview` shows the first page. A company that wants a
  number on every audience adds a counting workflow that pages the members and
  records a dated snapshot (`memberCount`, `countedAt`, the rule it counted). It
  is a snapshot shown with its time and never decides anything.

**Default:** segments and topic audiences; sizes from preparation.

## Opens and clicks

- **Off** (default): results show sent, delivered, bounced, complaints and
  unsubscribes, all from `EmailMessage`.
- **On:** turn on the provider's open and click tracking; build
  `bronze/email_events`, `silver/email_engagement` and `EmailEngagement`. Opens
  are inflated by mail apps that load images in advance; clicks are more
  reliable. Some countries treat tracking pixels like cookies and require
  consent. A provider that reports engagement only by webhook cannot feed the
  warehouse directly, because an event stream accepts only its own envelope: read
  engagement from the provider's API instead, or leave it off.

**Default:** off.

## Content and layout

- **Layout in code** (default): `email-layout.ts` renders every campaign; tests
  check the unsubscribe link and headers.
- **Provider templates:** a template id on the sender, with variables for the
  heading, body, preview text and unsubscribe link. Tests can no longer see the
  final HTML; keep the header and link checks on the request.
- **Several languages:** a campaign per language, with a `language` condition in
  the rule language, or a body per language chosen by a contact property.
- **Several brands:** a sender per brand with its own domain, footer and topics.

**Default:** one layout in code, one language.

## Scale and timing

- **Default pace:** pages of 50, 5,000 messages per run, the clock resuming
  every 15 minutes. Comfortable up to tens of thousands of recipients.
- **Large lists:** use the provider's batch endpoint with a `sendBatch` action
  over a fixed set of message ids and one idempotency key per batch; ramp volume
  up over weeks on a new domain.
- **Local send time:** `plan` sets a `sendAfter` per message from the contact's
  time zone; `sendPage` skips messages not yet due and the clock resumes them.
- **Frequency cap:** company default (3 days), per campaign, or per topic.

**Default:** default pace, one send time, a 3-day cap.

## Unsubscribe page

- **Two choices** (default): "emails like this one" or "all marketing email".
- **Every topic:** a leave button per topic, each posting that topic. The page
  reads no records, so it cannot show the current choices.

**Default:** two choices.

## Automated sequences

Not built by default. A welcome series or drip sequence uses the same records: an
action trigger on `contact.subscribe` starts a per-contact workflow that `sleep`s
between steps and sends each step as an `EmailMessage` through the same consent
and suppression checks, with its own approved content.

## Transactional email

Out of scope. If the company sends receipts or notices from the same project,
give them a sender of kind `transactional`, a separate subdomain, and a send path
that checks `emailStatus` but never marketing consent, so a person who left the
newsletter still gets their invoice.
