# Email marketing: build your own Mailchimp and Klaviyo alternative

Campaign email to the people in your own records, sent only to contacts with a
recorded consent for the topic, with a separate approval before anything goes out. It is built to replace
Mailchimp, Klaviyo and similar tools for newsletters and one-off campaigns.

**Alternative to** Mailchimp, Klaviyo, HubSpot Marketing Hub, ActiveCampaign, Brevo, Kit (formerly ConvertKit), MailerLite, Campaign Monitor and Omnisend: built by your own coding agent on [SegmentStream](https://segmentstream.com), shaped to how your company works.

## What you get

- One list of people, your own contacts, with a consent record per topic that
  says who decided it, when and where. No second copy of your list in a
  marketing tool.
- Audiences written as rules over your own companies, contacts and deals, such
  as "customers in Germany who have not received the spring launch". They are
  resolved again every time a campaign is prepared.
- Before anything is sent you see exactly who will receive the campaign and why
  everyone else is left out: unsubscribed, bounced, suppressed, emailed
  recently.
- Drafting and approving are separate permissions. The approver confirms the
  exact number of recipients they reviewed, and an edit sends the campaign back
  to draft.
- One-click unsubscribe in every email, honoured even for a campaign that is
  already sending. Bounces and spam complaints stop future email to the address
  automatically.
- Results per campaign (delivered, bounced, complaints, unsubscribes, and opens
  and clicks if you turn them on) computed from the messages, never typed in.
- Your workspace agent drafts campaigns and audiences from plain words, and
  explains why a person did or did not get an email.

## What the platform runs for you

- The connection to your email provider: credentials stay in SegmentStream and
  your code never sees them.
- Durable workflows that prepare and send each campaign, survive restarts, and
  record every run.
- Webhook endpoints for unsubscribe links and the provider's delivery events.
- A history of every consent change, with who made it, the record you will want
  when a regulator or an unhappy recipient asks.

## Build it

```text
Read https://github.com/segmentstream/build-your-own/blob/main/AGENTS.md and follow it.
Build our Email marketing from the email-marketing blueprint.
```

## How it fits

- **[CRM](../crm/)**: audiences use the CRM's companies, contacts, leads and
  deals. Without it, audiences use the foundation's companies and contacts only.
- **[Company agent](../company-agent/)**: lets the team ask for a campaign or an
  audience in chat, and lets an approver review and approve with a confirmation.
- Builds on the shared [foundation](../../foundation/FOUNDATION.md): the
  contact's email address and email status are the foundation's.

## What it is not

- Not transactional email (receipts, password resets, invoices). Those keep
  their own sender and never depend on marketing consent.
- Not a drag-and-drop email designer. Content is short HTML in one layout your
  project owns; the agent writes it, people review a preview.
- No automated journeys or drip sequences by default. They can be added with
  the same records; see the variations.
- Not legal advice. Consent and anti-spam rules (GDPR, CAN-SPAM and others)
  differ by country; your version follows the rules you choose, so check them
  with whoever advises you on privacy.

## Authors

- [SegmentStream](https://github.com/segmentstream)
