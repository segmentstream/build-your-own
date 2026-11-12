# Email marketing: interview

Ask these in one message. Offer the default with each; skip what the person
already said. Never ask for API keys, passwords or real subscriber lists in chat.

### 1. What kinds of email do you send, and may anyone receive one without having signed up?

- **Why:** each kind becomes a topic people can join or leave on its own, and
  its consent basis decides who receives it.
- **Changes:** the topic list in `email-topics.ts` and `TOPIC_BASIS`. A topic
  existing customers receive unless they leave becomes `optOut`; everything else
  is `optIn`.
- **Default:** two topics, `newsletter` and `productUpdates`, both `optIn`.

### 2. How do people sign up today?

- **Why:** every opt-in must arrive through `contact.subscribe` with its source
  and evidence.
- **Changes:** website forms get an intake API key (from the website's server,
  never the browser) and a `source` per form; sign-up in the product calls the
  same action; double opt-in adds a confirmation step (VARIATIONS.md).
- **Default:** one website form, single opt-in, with the form's name as
  `source` and the consent wording's version in `evidence`.

### 3. Which tool are you leaving, and does it hold unsubscribes, bounces or complaints?

- **Why:** the old tool's opt-outs must arrive before the first send, or people
  who left get mailed again.
- **Changes:** the `importSubscribers` workflow and a connection to that tool,
  or a one-time import of its export through the same actions.
- **Default:** import every list as `explicit: false`, and every unsubscribe,
  bounce and complaint, before the first campaign.

### 4. Which provider sends your email, and from which domain?

- **Why:** the provider decides the connection, the webhook format, the
  idempotency support and whether opens and clicks can be read back. The domain
  needs SPF, DKIM and DMARC before mail lands in inboxes.
- **Changes:** the connection declaration, the send call, the `emailEvents`
  parser, `checkDomain`.
- **Default:** Resend, sending from a marketing subdomain such as
  `news.example.com`, separate from the domain of transactional and personal
  mail.

### 5. Who writes campaigns, and who approves them before they go out?

- **Why:** approval is a separate permission; the approver confirms the exact
  count of recipients.
- **Changes:** who holds `marketing` and `campaignApprover`; whether one person
  may approve their own draft (four-eyes, VARIATIONS.md).
- **Default:** marketing drafts; one or two named people hold
  `campaignApprover`; an approver may approve their own draft.

### 6. Which audiences do you need first?

- **Why:** each becomes a segment rule; the conditions it needs decide which CRM
  fields the rule language exposes.
- **Changes:** the rule schema's conditions and the first segments, written by
  the agent from the person's words.
- **Default:** one topic audience per topic, and "current customers" (contacts
  of companies whose relationships include `customer`).

### 7. Who must never get marketing email?

- **Why:** suppression beats every audience; it is easier to set up before the
  first send than after a complaint.
- **Changes:** a suppression audience (staff, competitors, partners) and
  suppressed domains or addresses.
- **Default:** a suppression audience for the company's own domain, plus any
  address someone asked never to contact again.

### 8. How often may one person receive a campaign at most?

- **Why:** the frequency cap leaves out anyone another campaign reached
  recently.
- **Changes:** the company default for `frequencyCapDays`. Keep it shorter than
  your regular cadence: a weekly newsletter with a seven-day cap excludes its
  own readers.
- **Default:** 3 days; a campaign may set 0 for no cap.

### 9. Which countries are your recipients in?

- **Why:** consent rules, the sender identification in the footer and how fast
  an opt-out must apply differ by country (VARIATIONS.md). This build does not
  give legal advice; the person confirms their own obligations.
- **Changes:** topic bases, double opt-in, consent expiry, the sender footer.
- **Default:** `optIn` topics, single opt-in with evidence, a footer with the
  company's legal name and postal address, opt-outs applied immediately.

### 10. Do you want opens and clicks?

- **Why:** they need tracking pixels and rewritten links, they are inflated by
  privacy features of mail apps, and some countries treat pixels like cookies.
- **Changes:** provider tracking settings, the `bronze/email_events` ingestion,
  the `silver/email_engagement` model and `EmailEngagement`.
- **Default:** off. Results show sent, delivered, bounced, complaints and
  unsubscribes.

### 11. What should the emails look like?

- **Why:** one layout in code wraps every campaign; the agent writes only the
  body.
- **Changes:** `email-layout.ts`: logo URL, colours, fonts, footer, and the
  allowed body tags.
- **Default:** a plain single-column layout with the logo, the heading, the
  body and the sender's footer, plus a plain-text part.

## Decisions a person makes every time

- **Approving a send**, with its exact recipient count and time. Never an agent
  on its own initiative, never a workflow or an API key.
- **Subscribing someone on their behalf**, with written evidence of their
  request.
- **Importing a list** and the consent it carries.
- **Lifting a suppression** or resetting a bounced or complained address.
- **Discarding a campaign**, or erasing a contact (which first adds a
  suppression).
