# Email marketing: design

## 1. Purpose

Email marketing lets a company send campaigns to the people in its own records,
only to those who agreed to hear about a topic, and prove it afterwards. A
campaign goes from draft, to a preparation that freezes its recipients and records
why everyone else is left out, to a person's approval, to a send that checks
consent again for every message. Provider events turn bounces, complaints and
unsubscribes into records; results are metrics over the messages. SegmentStream
runs this design in production, with Resend as the provider.

## 2. Records (ontology)

```text
Contact (foundation) ──< Subscription            one per contact and topic
        └──< EmailMessage >── Campaign ──> EmailSender
                                  ├──> Audience           the main audience
                                  └──< extra audiences    up to 10
Suppression                       addresses and domains, independent of contacts
EmailEngagement (warehouse)       opens and clicks per message, optional
```

Every entity here except `EmailSender` declares `writes: "actions"`.

### Topics (code, not an entity)

A topic is a kind of email a person can choose: a newsletter, product updates,
event invitations. Topics are a `p.select` list in `ontology/email-topics.ts`,
shared by every entity below. `TOPIC_BASIS` gives each its consent basis: `optIn`
(default) reaches only contacts with a `subscribed` record; `optOut` reaches
everyone without an `unsubscribed` record, only where the law allows it
(VARIATIONS.md). A new topic or basis is a reviewed code change.

### Contact (foundation): what this blueprint adds

The foundation owns `email` and `emailStatus` (`ok`, `bounced`, `complained`,
`invalid`): delivery events set it and it overrides every subscription. Added here:

| Property | Type | Meaning | Set by |
| --- | --- | --- | --- |
| `marketingOptOutAt` | timestamp, optional | When the person left all marketing email. Empty: not opted out. Overrides every topic. | `contact.unsubscribe` without a topic, `emailMessage.unsubscribe` with scope `all` |
| `marketingOptOutSource` | text, optional | Where they left: `unsubscribe-page`, `request:email`, `import:old-tool`. | Same |
| `emailStatusReason` | text, optional | Why `emailStatus` last changed: the provider's bounce description, or a member's reason for resetting it. | `emailMessage.recordDelivery`, `contact.recordDeliveryProblem`, `contact.resetEmailStatus` |

### Subscription

One contact's choice for one topic. Stored, private, written only by actions.

| Property | Type | Meaning | Set by |
| --- | --- | --- | --- |
| `topic` | select (topics) | The topic. | Action |
| `status` | select: `subscribed`, `unsubscribed` | The current choice. | Action |
| `explicit` | boolean | True when the person chose it (a form, the unsubscribe page, a documented request). False for an import. | Action |
| `changedBy` | select: `contact`, `member`, `import`, `provider` | Who made the last change, derived from the caller, never from input. | Action |
| `changedAt` | timestamp | When the status last changed. | Action |
| `source` | text | Where: `form:footer`, `unsubscribe-link:<campaign>`, `import:<list>`. | Action |
| `evidence` | json, optional | Proof kept with the choice: form submission id, consent wording version, confirmation time of a double opt-in. | Action |

Relationship `contact` (cascade). Unique index on `(contact, topic)`. No delete
action: consent is changed, never removed, and history keeps every earlier value.

### Suppression

An address or domain that never receives marketing email, whatever an audience
or subscription says. It outlives the contact: an erased person stays out of
every re-import.

| Property | Type | Meaning |
| --- | --- | --- |
| `kind` | select: `address`, `domain` | What `value` holds. |
| `value` | text, unique | For an address, the SHA-256 hex digest of the lowercased address, never the address. For a domain, the lowercased domain. |
| `reason` | select: `erasure`, `doNotContact`, `internal`, `legal`, `other` | Why. |
| `note` | text, optional | Context a colleague needs, without the address itself. |
| `status`, `liftedAt` | select (`active`, `lifted`), timestamp | Lifted entries no longer suppress. |

### Audience

A rule for who a campaign may reach, resolved at every preparation. Never consent.

| Property | Type | Meaning |
| --- | --- | --- |
| `name` | text, unique | Short name: "Customers in Germany". |
| `description` | text | The rule in plain words, as the person asked for it. |
| `kind` | select: `segment`, `topicSubscribers` | A segment has a rule; a topic audience is every subscriber of `topic`. |
| `topic` | select (topics), optional | For `topicSubscribers`. |
| `rule` | json, managed | For a segment: conditions in the closed rule language below. |
| `suppresses` | boolean, managed | True for a suppression audience: every campaign leaves its members out. |

**The rule language** is a closed Effect `Schema` with a described field per
condition, so the agent writes it from a request and the action refuses anything
else. Every given condition must hold. On the contact: `countries`, `emails` (a
fixed list, up to 1,000), `emailDomains`, `jobTitleContains`, `addedSince`,
`addedBefore`. On its company: `companyCountries`, `companyRelationships`
(the foundation's flags: `isCustomer`, `isProspect`, …) and fields the CRM adds. With the crm blueprint:
`deals { stages, wonSince }` and `leads { statuses, sources, since }`, meaning "has
at least one matching". On history: `subscribedTopics`, `sentCampaigns`,
`notSentCampaigns`. `anyOf` takes groups of the same conditions, one of which must
hold; `noneOf` takes groups that exclude.

One function turns a rule into a single contact `find` filter in wire names
(`company: { … }`, `subscriptions: { some: … }`, `email_messages: { none: … }`), so
a segment reaches exactly what `contact_find` returns with that filter. An empty
rule or group is refused: it would reach everyone. A stored rule that no longer
decodes after a schema change reaches nobody and is shown as broken.

### EmailSender

Who a campaign comes from. Keeps its generated writes, held only by `emailAdmin`.

| Property | Type | Meaning |
| --- | --- | --- |
| `name` | text, unique | What it is for: "Newsletter". |
| `fromName`, `fromAddress` | text, email | The From header. The address is on a domain verified with the provider. |
| `replyTo` | email, optional | Where replies go: a monitored mailbox. |
| `defaultTopic` | select (topics) | The topic its campaigns use unless the draft names another. |
| `footer` | text | The company's legal name and postal address, shown in every email it sends. |
| `unsubscribeEndpoint` | url, optional | The `emailUnsubscribe` webhook URL with its token, as `segmentstream workflow webhooks` prints it. Without it, a campaign from this sender cannot be tested or approved. |

### Campaign

One email to one or more audiences, on one topic, from one sender.

| Property | Type | Meaning |
| --- | --- | --- |
| `name` | text | Internal name: "October product update". |
| `topic` | select (topics), managed | Recipients must be allowed this topic. |
| `subject`, `previewText`, `heading` | text, managed | Subject (keep under 60 characters), the inbox preview line, the heading at the top. |
| `body` | text, managed | HTML from a small allow-list (paragraphs, headings, lists, links, images, bold, italic), placed into the layout under the heading. |
| `status` | select, managed | `draft`, `preparing`, `ready`, `scheduled`, `sending`, `sent`, `cancelled`. |
| `preparation` | integer, managed | 0 until the first preparation; each `prepare` starts a new one. Only messages of the current preparation are sent. |
| `preparedAt`, `approvedAt`, `scheduledFor`, `sentAt` | timestamp, managed | When each step happened. |
| `contentChangedAt`, `testSentAt` | timestamp, managed | Whether the last test shows the current content. |
| `frequencyCapDays` | integer, optional | Leave out people sent another campaign in this many days. Empty: the company default; 0: no cap. |

Relationships: `audience` (to Audience, restrict), `extraAudiences` (many to
Audience, at most 10; a person in several gets one email), `sender` (to
EmailSender, restrict), `approvedBy` (to User, set null). The campaign stores no
counts: planned, left out, sent and the rest are metrics of `EmailMessage`.

### EmailMessage

One campaign email to one contact, written by workflows through actions.

| Property | Type | Meaning |
| --- | --- | --- |
| `email` | email, managed | The address as it was when planned. |
| `preparation` | integer, managed | The preparation that last decided this message. |
| `status` | select, managed | `planned`, `excluded`, `sent`, `skipped`, `failed`. |
| `reason` | select, optional | `emailBounced`, `emailComplained`, `emailInvalid`, `optedOutAll`, `topicUnsubscribed`, `noConsent`, `suppressedAddress`, `suppressionAudience`, `recentlyEmailed`, `providerRejected`. |
| `reasonDetail` | text, optional | The suppression audience's name, or the provider's error. |
| `providerMessageId` | text, optional, unique | The provider's id once sent. Joins delivery and engagement events; unique, because `EmailEngagement`'s relationship is matched on it. |
| `sentAt` | timestamp, optional | When the provider accepted it. |
| `delivery` | select, optional | `delivered`, `bounced`, `complained`, from provider events. Opens and clicks are not kept here. |
| `unsubscribeToken` | text, unique | The secret in this message's unsubscribe link. Never shown, never replicated. |
| `unsubscribedAt`, `unsubscribeScope` | timestamp, select (`topic`, `all`) | Set when the person used this message's link. |

Relationships: `campaign` (cascade), `contact` (cascade). Unique index on
`(campaign, contact)`: one message per person per campaign, whatever the
preparation. Metrics (filtered counts): `planned`, `excluded`, `sent`, `skipped`,
`failed`, `delivered`, `bounced`, `complained`, `unsubscribed`. A campaign's
results filter to the campaign; planned and left-out counts also filter to its
current `preparation`.

### EmailEngagement (warehouse-backed, optional)

Only when opens and clicks are tracked (VARIATIONS.md). One row per sent message
from `silver/email_engagement`: `providerMessageId`, `opened`, `clicked`,
`firstOpenedAt`, `firstClickedAt`, `clicks`. Relationship `message` to
`EmailMessage` on `providerMessageId`; metrics `opened` and `clicked` reach the
campaign through it.

## 3. Actions

### The consent check

One pure function, `refusalFor(contact, topic, subscription)`, decides consent
for preparation and sending alike and returns the first reason that applies, in
this order: `emailStatus` not `ok` (`emailBounced`, `emailComplained`,
`emailInvalid`); `marketingOptOutAt` set (`optedOutAll`); the topic
`unsubscribed` (`topicUnsubscribed`); no record for an `optIn` topic
(`noConsent`). `plan` and `send` then check suppression: an active `Suppression`
for the address digest or its domain (`suppressedAddress`), or membership of a
suppression audience (`suppressionAudience`). `plan` alone applies the frequency
cap (`recentlyEmailed`).

### Contact

| Action | Caller | Input | Checks | Changes |
| --- | --- | --- | --- | --- |
| `subscribe` | Intake key (website forms); members on a person's documented request | `email`, `topic`, `source`, `evidence` (required from members) | Refuses an address whose `emailStatus` is not `ok`; refuses disposable domains | Finds or creates the contact as the foundation's `contact.find_or_create_by_email` does. Sets the topic `subscribed`, explicit. If `marketingOptOutAt` is set, clears it and records `unsubscribed` for every `optOut` topic the person has not chosen. Idempotent. |
| `unsubscribe` | Members, on a person's request | `email`, `topic` (empty: all), `source` | The contact exists | Topic: `unsubscribed`, explicit. No topic: sets `marketingOptOutAt` and source. Idempotent. |
| `importSubscriptions` | `subscriberImporter` workflow | `topic`, `source`, up to 50 `{ email, status }` | Keeps any explicit record; never touches `emailStatus`; skips disposable domains | Creates missing contacts; writes `explicit: false` records. Returns counts. |
| `importOptOuts` | `subscriberImporter` workflow | `source`, `since`, up to 50 `{ email, topic? }` | An explicit opt-in recorded here after `since` wins | Records the old tool's unsubscribes as the person's own. |
| `recordDeliveryProblem` | `subscriberImporter` workflow, an address verification service | `email`, `problem` (`bounced`, `complained`, `invalid`), `source` | Never lowers `complained` | Sets `emailStatus` and `emailStatusReason`. |
| `resetEmailStatus` | `emailAdmin` | `email`, `reason` | Status is not `ok`. Destructive: agents confirm | Sets `ok`, keeps the reason. |

### Suppression

| Action | Caller | Input | Checks | Changes |
| --- | --- | --- | --- | --- |
| `add` | `marketing`, `emailAdmin`; any action that erases a contact, first | `email` or `domain`, `reason`, `note` | Exactly one of email and domain | Creates or reactivates the entry by its value. Idempotent. |
| `lift` | `emailAdmin` | `suppression`, `reason` | Destructive: agents confirm | `status: lifted`, `liftedAt`. |
| `check` | `marketing` | `email` | Read-only | Whether the address or its domain is suppressed, and why. |

`emailSender.checkDomain` is read-only: its `prepare` asks the provider whether
the From domain is verified (with Resend, a key that may read domains).

### Audience

| Action | Caller | Input | Checks | Changes |
| --- | --- | --- | --- | --- |
| `defineSegment` | `marketing`, the agent | `name`, `description`, `rule` | The rule decodes and is not empty | Creates a segment. |
| `defineTopicAudience` | `marketing` | `name`, `topic` | | Creates a topic audience. |
| `changeSegment` | `marketing` | `audience`, `rule`, `description` | A segment; the rule decodes and is not empty | Replaces the rule. Prepared campaigns keep their messages until prepared again. |
| `setSuppression` | `emailAdmin` | `audience`, `suppresses` | Segments only | Sets the flag. |
| `preview` | Readers | `audience`, `search`, `after` | Read-only | One page of up to 50 members with email status and next cursor. No total. |
| `explain` | Readers | `audience`, `contact`, `topic` (optional) | Read-only | Member or not, which `anyOf` groups match, and the consent reason a campaign on `topic` would record. |
| `memberships` | Readers | `contact` | Read-only, at most 50 audiences | The audiences the contact is in. |
| `remove` | `marketing` | `audience` | No campaign uses it | Deletes it. |

### Campaign

| Action | Caller | Input | Checks | Changes |
| --- | --- | --- | --- | --- |
| `draft` | `marketing`, the agent | `name`, `audience`, `extraAudiences`, `sender`, `topic`, `subject`, `previewText`, `body`, `frequencyCapDays` | Body uses only allowed tags; every placeholder has a fallback | Creates a `draft`; topic defaults to the sender's. |
| `edit` | `marketing` | Any content, audience or cap field | Status `draft` or `ready` | Applies the change and returns the campaign to `draft`; content changes set `contentChangedAt`. |
| `prepare` | `marketing`, the agent | `campaign` | Status `draft`, `ready` or `preparing` (restarts a stuck preparation) | `preparing`, `preparation + 1`. The `prepareCampaign` workflow starts. Sends nothing. |
| `completePreparation` | `campaignPreparer` | `campaign`, `preparation` | Still `preparing` with that number, else no-op | `ready`, `preparedAt`. |
| `sendTest` | `marketing`, approvers | `campaign`, `to` | `to` is an active member's address; the sender has an unsubscribe endpoint. Irreversible: agents confirm | Sends the rendered email with `[Test]` in the subject, through the provider, with a test token that unsubscribes nobody. Sets `testSentAt`. Writes no message. |
| `approve` | `campaignApprover` only | `campaign`, `plannedCount`, `sendAt` | Status `ready`; `plannedCount` equals a fresh count of planned messages of the current preparation, and is above zero; the sender has an unsubscribe endpoint; `sendAt` within 30 days. Irreversible: agents confirm | `sending`, or `scheduled` with `scheduledFor`; `approvedBy`, `approvedAt`. Repeating by the same approver returns the same result. |
| `startScheduled` | `campaignClock` | `campaign` | `scheduled` and due, else no-op | `sending`. |
| `resumeSending` | `campaignClock` | `campaign` | `sending`, planned messages left, none sent in 15 minutes | Starts a new `sendCampaign` run through its trigger. |
| `cancel` | `marketing`, approvers | `campaign` | Not `sent`. Irreversible while sending: agents confirm | `cancelled`. Messages not yet sent stay unsent. |
| `completeSending` | `campaignSender` | `campaign` | `sending` and no planned message of the current preparation left, else no-op | `sent`, `sentAt`. |
| `discard` | `marketing` | `campaign` | `draft` or `cancelled`, and no message was sent, skipped or failed. Destructive | Deletes the campaign and its messages. A campaign that sent anything is the record of what was sent. |

### EmailMessage

| Action | Caller | Input | Checks | Changes |
| --- | --- | --- | --- | --- |
| `plan` | `campaignPreparer` | `campaign`, `preparation`, `contact` | Campaign still `preparing` with that number | Upserts the message by `(campaign, contact)`: `planned`, or `excluded` with the first reason. A message already `sent` stays sent. New messages get a random `unsubscribeToken`. Idempotent. |
| `send` | `campaignSender` | `message` | In `prepare`: campaign `sending`, message `planned` and of the current preparation, else no-op; consent and suppression again; renders and posts to the provider with `Idempotency-Key: campaign-message-<id>` | Handler, locked: `sent` with `providerMessageId` and `sentAt`; `skipped` with the reason; `failed` on a permanent refusal. A throttle or outage fails the call so the step retries; the message stays `planned`. |
| `recordDelivery` | `emailEvents` workflow | `providerMessageId`, `email`, `event` (`delivered`, `bounced`, `complained`), `detail` | Ranks `complained` over `bounced` over `delivered`; a late event never lowers a higher one | Sets `delivery` on the message if one matches. A bounce or complaint also sets the contact's `emailStatus` and `emailStatusReason`, for campaign and other email alike. Idempotent. |
| `unsubscribe` | `emailUnsubscriber` workflow | `token`, `scope` (`topic`, `all`) | Unknown token: no-op | Topic: the campaign's topic `unsubscribed`, explicit, `changedBy: contact`. All: `marketingOptOutAt`. Records `unsubscribedAt` and scope on the message. Idempotent. |

`sendTest` and `send` share one pure renderer, `ontology/email-layout.ts`: it
fills `{{firstName|there}}` and `{{company|your team}}` (HTML-escaped in the body),
lays out heading, body and the sender's footer, writes the plain-text part, and adds
the personal unsubscribe link and the RFC 8058 headers `List-Unsubscribe` and
`List-Unsubscribe-Post: List-Unsubscribe=One-Click`.

## 4. Roles

| Role | Held by | Permissions |
| --- | --- | --- |
| `marketing` | People who write campaigns and keep the list | Read contacts, companies, subscriptions, audiences, senders, campaigns, messages, suppressions (and deals and leads with the CRM). `contact:subscribe`, `contact:unsubscribe`, every `audience` action except `setSuppression`, `campaign:draft`, `edit`, `prepare`, `sendTest`, `cancel`, `discard`, `suppression:add`, `suppression:check`. |
| `campaignApprover` | People accountable for what the company sends | Read campaigns, messages, audiences, senders. `campaign:approve`, `campaign:cancel`, `campaign:sendTest`. |
| `emailAdmin` | Whoever owns deliverability | `email_sender:*`, `audience:setSuppression`, `suppression:lift`, `contact:resetEmailStatus`. |
| `intake` (foundation) | The website's API key | Adds `contact:subscribe`. |
| `campaignPreparer` | `prepareCampaign` workflow | Reads the rule's entities; `email_message:plan`, `campaign:completePreparation`. |
| `campaignSender` | `sendCampaign` workflow | `campaign:read`, `email_message:read`, `email_message:send`, `campaign:completeSending`. |
| `campaignClock` | `campaignClock` workflow | `campaign:read`, `email_message:read`, `campaign:startScheduled`, `campaign:resumeSending`. |
| `emailUnsubscriber` | `emailUnsubscribe` workflow | `email_message:unsubscribe` only. |
| `emailEvents` | `emailEvents` workflow | `email_message:recordDelivery` only. |
| `subscriberImporter` | `importSubscribers` workflow | `contact:importSubscriptions`, `contact:importOptOuts`, `contact:recordDeliveryProblem`. |

Permissions and role names may be written in camelCase or snake_case:
`emailMessage:send` and `email_message:send` are the same permission, and the SDK
converts both to the snake_case wire form. Keep one spelling within a code file.

If `member` holds `*:read` (the starter's default), list its reads by name so
that subscriptions, messages and suppressions are read only through these roles.
Never grant by default: `campaign:approve` outside `campaignApprover`, and never to
an API key or workflow role; `email_message:send` outside `campaignSender`;
`suppression:lift`, `contact:resetEmailStatus` and `email_sender:*` outside
`emailAdmin`. A workflow that hands the agent a task gets no sending, approving or
consent-writing permission: a prompt can carry a stranger's text.

## 5. Workflows

| Workflow | Trigger | Steps | Repeat-safe because |
| --- | --- | --- | --- |
| `prepareCampaign` | `after(campaign.prepare)` | One step per page of members (200 contacts) of the main audience, then each extra audience: reads the page by the rule's filter, calls `emailMessage.plan` for each contact. Stops if the campaign left this preparation. Last step: `completePreparation`. | `plan` upserts by `(campaign, contact)`; a person in two audiences is planned once. |
| `sendCampaign` | `after(campaign.approve)` to `sending`, `after(campaign.startScheduled)`, `after(campaign.resumeSending)` | One step per page of 50 planned messages of the current preparation, each sent by its own `emailMessage.send` call. Stops when the campaign is no longer `sending`. Ends after 5,000 messages; the clock resumes the rest. Last step: `completeSending`. | Sending takes a message out of the find; `send` is a no-op for a message that is not planned, and the provider deduplicates the idempotency key. |
| `campaignClock` | `cron("*/15 * * * *")` | Starts each due scheduled campaign (`startScheduled`), then resumes each `sending` campaign with planned messages and no send in 15 minutes (`resumeSending`). | Both actions are no-ops when not due. |
| `emailUnsubscribe` | `webhook("emailUnsubscribe")`, token URL | Reads `t` and `scope` from the query, calls `emailMessage.unsubscribe`. | The action is idempotent; an unknown token changes nothing. |
| `emailEvents` | `webhook("emailEvents")` from the provider | Parses the event. Keeps `delivered`, permanent bounces and complaints; ignores transient bounces, opens and clicks. Calls `recordDelivery`. | Ranked, idempotent action; deliveries may repeat and arrive in any order. |
| `importSubscribers` | None; started from the CLI with `list`, `topic`, `source` | One step per page of the old tool's list: `importSubscriptions`, then its unsubscribes, bounces and complaints. | Every import action is idempotent. |

A mail client's one-click POST and the public `/unsubscribe` page both reach
`emailUnsubscribe`. The footer link opens the page with `t` (message token) and `w`
(webhook token); it offers "emails like this one" or "all marketing email" and
posts the choice. Nothing unsubscribes on a GET: link scanners open every link.

## 6. Data flow (pipeline)

**Replication.** Campaign results are metric queries over the replicated
`email_message`. Before the first deploy, exclude `EmailMessage.email` and
`unsubscribeToken` from replication, and `Subscription` and `Suppression` unless
consent is analysed in the warehouse. Exclusions are a workspace setting, not
code; the foundation describes the steps (and your project's
`docs/ontology-replication.md` the mechanism).

**Engagement (optional).** Opens and clicks are reported by the provider, read in
bulk and decide nothing, so they live in the warehouse:

| Asset | Grain and key | Notes |
| --- | --- | --- |
| `bronze/email_events` (ingestion, contract) | One provider event. Key `(provider, event_id)`. | Columns: `provider`, `event_id`, `provider_message_id`, `event_type` (`delivered`, `opened`, `clicked`, `bounced`, `complained`), `occurred_at`, `event_date`, `link_url` (without query string). No recipient address. Daily partitions on `event_date`. |
| `silver/email_engagement` (model) | One sent message. Key `provider_message_id`. | `opened`, `clicked`, `first_opened_at`, `first_clicked_at`, `clicks`. Unpartitioned, rebuilt from the last 90 days of events. Backs `EmailEngagement`. |

Two adapters write the contract, chosen by a constant in the ingestion file:
`sample` yields invented, deterministic events; `real` reads the provider's event
or message-activity API through its connection. Checks: `event_id` unique per
provider, `event_type` in the list, `provider_message_id` not null. Job
`emailEngagement` builds both, scheduled daily with `s.schedule`.

## 7. Screens (app)

- **Campaigns.** Filter by status (ready to approve, scheduled, sending, sent,
  drafts, cancelled); each row shows subject, audiences, planned and left-out
  counts (one metric query grouped by campaign and preparation, keeping each
  campaign's current one) and when it sent or sends.
- **Campaign.** Audiences, topic, From, reply-to, cap, who approved. The email in a
  sandboxed `iframe`, as one chosen recipient reads it or with every fallback.
  "Before you approve": unsubscribe endpoint set, a test after the last edit,
  subject length, preview text, placeholder fallbacks, size against the audience's
  previous campaign. Who will receive it, and who is left out with the reason.
  Controls by permission: Prepare, Send test, Approve (type the planned count; now
  or at a time), Cancel. After sending: sent, delivered, bounced, complaints,
  unsubscribed (and opened, clicked when tracked), each as a share of sent.
- **Audiences** and **Audience**: kind and suppression flag; the rule in plain
  words and as conditions; the first page of members with search and `explain`;
  the campaigns sent to it.
- **Contact panel** on the CRM's contact page: email status and reason, each
  topic with status, source and time, the global opt-out, audiences, messages
  received. Unsubscribe; for admins, reset email status.
- **Suppression** (entries, check an address, lift with a reason) and **Senders**
  (From, footer, unsubscribe endpoint, the provider's domain verification).
- **Public `/unsubscribe`**: no sign-in, reads no records, in the app's
  `publicPaths`. Two choices and a confirmation, in the company's words.

## 8. The company agent

What a person can ask once this is built:

- "Draft a product update to customers in Germany about the new export." The
  agent defines or reuses a segment, drafts, prepares, and answers with planned
  and left-out counts and the main reasons.
- "Why is Grace Sample left out of the spring newsletter?" (`audience.explain`,
  the message's reason). "Send me a test." (`sendTest`, confirmed.)
- "Approve the October update for 1,200 people" from an approver (`approve`,
  confirmed). "Ada Example asked to stop the newsletter." (`contact.unsubscribe`.)
- "How did last month's campaigns do?" (a metric query over `emailMessage`).

Routine, without confirmation: `draft`, `edit`, `prepare`, `defineSegment`,
`changeSegment`, the read-only audience actions, `contact.unsubscribe`,
`suppression.add`. Confirmed: `sendTest`, `approve`, `cancel` while sending,
`discard`, `suppression.lift`, `contact.resetEmailStatus`. Declare `hints` on every
action. The descriptions of `Campaign` and its actions, which reach the agent
through its tools, hold the allowed tags, the placeholder rules and the process:
draft, prepare, test, ask an approver; the company's voice goes in the agent's
instructions. A `guide:` file is for people; the agent does not receive it. The
agent never approves on its own initiative and never subscribes
anyone without the person's own request.

## 9. Build order

1. **Consent.** Topics, the Contact additions, `Subscription`, `subscribe`,
   `unsubscribe`, the consent check, with their invariant tests. Check: tests and
   `npm --prefix ontology run check` pass.
2. **Suppression.** Entity and actions, with tests. Check: `check` reports an
   added address that is stored only as a digest.
3. **Provider and senders.** The provider connection in
   `connections/connections.py` and `ontology/connections.ts` (`delivers: true`),
   `EmailSender`, `checkDomain`. Deploy; the person authorizes the connection and
   creates a sender. Check: `checkDomain` reports the domain verified.
4. **Audiences.** Rule schema, rule-to-filter function, read-only actions, with
   tests that a rule reaches exactly what `contact_find` returns. Check: preview a
   segment on seeded contacts.
5. **Campaigns and messages.** Both entities, the renderer, every action, tests
   with the provider stubbed through `Connections.test`. Check: every invariant
   test passes.
6. **Workflows** and their roles. Deploy; print URLs with `segmentstream workflow
   webhooks`; register `emailEvents` with the provider; set each sender's
   `unsubscribeEndpoint`. Check: `segmentstream workflow list` shows the triggers.
7. **Screens and agent instructions.** Check: in `segmentstream dev`, prepare a seeded
   campaign and see both lists; open `/unsubscribe` signed out; the agent drafts
   and prepares a campaign to an internal audience.
8. **Import** (when leaving another tool): `importSubscribers` per list, with its
   opt-outs, bounces and complaints, before the first send. Check: an address
   unsubscribed in the old tool is left out of a preparation.
9. **First send** to the team's own members, approved by an approver. Check: it
   arrives; the page and one-click unsubscribe work; results show it delivered.
10. **Engagement** (optional): ingestion, model, checks, job, `EmailEngagement`.
    Check: with `sample`, a metric query returns opens and clicks.

A seed script calls the same actions with invented `example.com` contacts; it never sends.

## 10. Sketch

Invented names; your project's `docs/ontology.md` has the full API. The consent
record (`TOPICS` is the `as const` option list of `email-topics.ts`):

```ts
// ontology/subscription.ts
import { entity, p, rel } from "@segmentstream/ontology";

import { Contact } from "./contact";
import { TOPICS } from "./email-topics";

export const Subscription = entity("subscription", {
  id: "ent_subscription",
  label: "Subscription",
  plural: "Subscriptions",
  title: "topic",
  description: "Whether one contact receives one topic, and who decided it, when and where.",
  writes: "actions",
  properties: {
    topic: p.select(TOPICS, { description: "The email topic." }),
    status: p.select(
      [
        { value: "subscribed", description: "Receives this topic." },
        { value: "unsubscribed", description: "Does not receive this topic." },
      ],
      { managed: true, description: "The current choice." },
    ),
    explicit: p.boolean({ managed: true, default: false, description: "The person chose it." }),
    changedBy: p.select(
      [
        { value: "contact", description: "The person: a form or an unsubscribe link." },
        { value: "member", description: "A member, on the person's documented request." },
        { value: "import", description: "An import from another tool." },
        { value: "provider", description: "An event the email provider reported." },
      ],
      { managed: true, description: "Who made the last change, derived from the caller." },
    ),
    changedAt: p.timestamp({ managed: true, description: "When the status last changed." }),
    source: p.text({ managed: true, maxLength: 200, description: "Where, such as form:footer." }),
    evidence: p.json({ optional: true, managed: true, description: "Proof kept with the choice." }),
  },
  relationships: {
    contact: rel.one(() => Contact, {
      inverse: "subscriptions",
      onDelete: "cascade",
      phrase: ["belongs to", "has"],
      description: "The person whose choice this is.",
    }),
  },
  indexes: [{ properties: ["contact", "topic"], unique: true }],
});
```

The guarded approval, counting the frozen recipients fresh in its transaction
(scheduling with `sendAt` left out):

```ts
// In Campaign's .actions((self) => ({ … })). EmailMessage is used only when the handler runs.
approve: action({
  description: "Approve a ready campaign. Refused if it now plans another count than you reviewed.",
  hints: { destructive: false, irreversible: true, idempotent: true },
  writes: [self],
  input: Schema.Struct({
    campaign: self.ref,
    plannedCount: p.integer({ min: 1, description: "The planned messages you reviewed." }),
  }),
  handler: ({ input, principal }) =>
    Effect.gen(function* () {
      const campaign = yield* self.get(input.campaign, { forUpdate: true });
      if (campaign.status !== "ready") {
        return yield* new ActionRejected({ message: `A ${campaign.status} campaign cannot be approved.` });
      }
      const [row] = yield* EmailMessage.queryMetrics({
        metrics: ["planned"],
        where: { campaignId: campaign.id, preparation: campaign.preparation },
      });
      const planned = Number(row?.planned ?? 0);
      if (planned !== input.plannedCount) {
        return yield* new ActionRejected({
          message: `The campaign plans ${planned} messages, not ${input.plannedCount}. Review it again.`,
        });
      }
      const sender = yield* EmailSender.get(campaign.senderId);
      if (sender.unsubscribeEndpoint === null) {
        return yield* new ActionRejected({ message: "The sender has no unsubscribe endpoint yet." });
      }
      const approvedAt = new Date().toISOString();
      yield* self.update(campaign, { status: "sending", approvedBy: principal.id, approvedAt });
      return { campaignId: campaign.id, status: "sending" };
    }),
}),
```

A workflow's role, holding only what it calls:

```ts
// ontology/roles.ts
export const campaignSender = role("campaignSender", {
  description: "Held by the sendCampaign workflow: sends planned messages, marks the campaign sent.",
  permissions: ["campaign:read", "emailMessage:read", "emailMessage:send", "campaign:completeSending"],
});
```

The send workflow, one page per step, started by the approval (the
`startScheduled` and `resumeSending` triggers look the same):

```ts
// ontology/workflows/send-campaign.ts
import { after, changed, p, run, workflow } from "@segmentstream/ontology/workflows";
import { Effect, Schema } from "effect";

import { Campaign } from "../campaign";
import { EmailMessage } from "../email-message";

const PAGE = 50;
const MAX_PER_RUN = 5_000; // campaignClock resumes what one run leaves

// send is idempotent: a retried page re-sends nothing that already went.
async function sendPage(campaignId: string) {
  "use step";
  return run(
    Effect.gen(function* () {
      const campaign = yield* Campaign.get(campaignId);
      if (campaign.status !== "sending") return { sending: false, handled: 0, full: false };
      const messages = yield* EmailMessage.find({
        where: { campaignId, preparation: campaign.preparation, status: "planned" },
        orderBy: [{ field: "id", direction: "asc" }],
        limit: PAGE,
      });
      let handled = 0;
      for (const message of messages) {
        const result = yield* EmailMessage.actions.send({ message: message.id });
        if (result.status !== "planned") handled += 1;
      }
      return { sending: true, handled, full: messages.length === PAGE };
    }),
  );
}

async function complete(campaign: string) {
  "use step";
  return run(Campaign.actions.completeSending({ campaign }));
}

async function sendCampaign(input: { campaign: string }) {
  "use workflow";
  let handled = 0;
  for (;;) {
    const page = await sendPage(input.campaign);
    if (!page.sending) return { completed: false, handled }; // cancelled or finished elsewhere
    handled += page.handled;
    if (!page.full) break;
    if (page.handled === 0 || handled >= MAX_PER_RUN) return { completed: false, handled };
  }
  return { completed: (await complete(input.campaign)).applied, handled };
}

export default workflow("sendCampaign", {
  description: "Send an approved campaign's planned messages, checking consent before each one.",
  role: "campaignSender",
  input: Schema.Struct({ campaign: p.ref(Campaign, { description: "The campaign to send." }) }),
  run: sendCampaign,
  triggers: [
    after("approved", Campaign.actions.approve, {
      description: "A person approved a ready campaign to send now.",
      when: changed("status", { to: "sending" }),
      input: (event) => ({ campaign: event.input.campaign }),
    }),
  ],
});
```

The `sample` adapter of the engagement contract (`real_events` pages the
provider's API through `s.get_connection(...)`; see `docs/ingestion.md`):

```python
# pipeline/ingestion/email_events.py
from collections.abc import Iterator
from datetime import date, datetime, timedelta, timezone

import segmentstream as s

SOURCE = "sample"  # "real" once the provider connection is authorized
SCHEMA = {"provider": "string", "event_id": "string", "provider_message_id": "string", "event_type": "string",
          "occurred_at": "timestamp", "event_date": "date", "link_url": "string"}
DAILY = s.Partitioning.Daily(column="event_date", start_date="2026-01-01", backfill_policy=s.SingleRunBackfillPolicy())


@s.ingestion(tier=s.Tier.Bronze, partitioning=DAILY, schema=SCHEMA, primary_key=("provider", "event_id"))
def email_events(context: s.Context) -> Iterator[s.IngestionRow]:
    """Provider email events, one row each, with no recipient address."""
    for key in context.partition_keys:
        yield from sample_events(date.fromisoformat(key)) if SOURCE == "sample" else real_events(key)


def sample_events(day: date) -> Iterator[s.IngestionRow]:
    nine = datetime(day.year, day.month, day.day, 9, tzinfo=timezone.utc)
    for n in range(20):  # every message delivered, every third opened, every fifth clicked
        message = f"sample-{day.isoformat()}-{n:03d}"
        kinds = ["delivered"] + (["opened"] if n % 3 == 0 else []) + (["clicked"] if n % 5 == 0 else [])
        for step, kind in enumerate(kinds):
            yield {
                "provider": "sample", "event_id": f"{message}-{kind}", "provider_message_id": message,
                "event_type": kind, "occurred_at": nine + timedelta(minutes=n + 10 * step), "event_date": day,
                "link_url": "https://example.com/launch" if kind == "clicked" else None,
            }
```
