# Email marketing: invariants

Each rule holds in every version. Each becomes a test in the project. Tests run
the actions against a development database or an in-memory runtime, with the
email provider replaced by `Connections.test({ <provider>: (request) => … })`
that records every request. Data is invented: Northwind, Ada Example
(`ada@example.com`), Grace Sample (`grace@example.com`).

### 1. Consent is checked again just before each message is sent.

**Why.** People unsubscribe, bounce or complain between preparation and sending,
sometimes days apart for a scheduled campaign.

**Test.** Prepare a `newsletter` campaign that plans Ada, approve it, then call
`contact.unsubscribe` for Ada and `newsletter`. Run `emailMessage.send` for her
message. Expect status `skipped`, reason `topicUnsubscribed`, and zero provider
requests.

### 2. The email status overrides every subscription.

**Why.** A bounced, complained or invalid address must never be mailed again,
whatever a form or an import said about topics.

**Test.** Ada is subscribed to `newsletter` and her `emailStatus` is `complained`.
Plan her into a `newsletter` campaign. Expect `excluded` with `emailComplained`.
Repeat for `bounced` and `invalid`.

### 3. A global opt-out overrides every topic, including `optOut` topics.

**Why.** "Stop all marketing email" means all of it, including topics added after
the person left.

**Test.** Set Ada's `marketingOptOutAt`. With `productUpdates` declared `optOut`
and no subscription record, plan Ada into a `productUpdates` campaign. Expect
`excluded` with `optedOutAll`.

### 4. An `optIn` topic reaches only people with a `subscribed` record.

**Why.** Without a record there is no consent to show.

**Test.** Ada has no record for `newsletter` (`optIn`). Plan her. Expect
`excluded` with `noConsent`. Record her subscription and prepare again. Expect
`planned`.

### 5. A new opt-in to one topic never restores another topic.

**Why.** A person who left all marketing and later joins one newsletter agreed to
that newsletter only.

**Test.** Ada has `marketingOptOutAt` set; `productUpdates` is `optOut`. Call
`contact.subscribe` for `newsletter`. Expect `marketingOptOutAt` empty, a
`newsletter` record `subscribed`, and a `productUpdates` record `unsubscribed`.
Plan her into a `productUpdates` campaign: `excluded`, `topicUnsubscribed`.

### 6. Suppression beats every audience, at preparation and at sending.

**Why.** Erasure requests, staff and competitors must stay out even when a rule or
a subscription would include them.

**Test.** Ada is subscribed and in the campaign's audience. (a) Add a suppression
for `ada@example.com`; plan her: `excluded`, `suppressedAddress`. (b) Lift it;
add a suppression for the domain: same result. (c) Lift it; make a segment
containing Ada a suppression audience: `excluded`, `suppressionAudience`, with the
audience's name in `reasonDetail`. (d) Plan her cleanly, then add the address
suppression before `send`: `skipped`, zero provider requests.

### 7. A suppressed address is stored only as a digest.

**Why.** The suppression list must outlive an erased contact without keeping the
address.

**Test.** `suppression.add` for `grace@example.com`. Expect `value` to equal the
SHA-256 hex digest of the lowercased address and no field to contain the address.
`suppression.check` for `Grace@example.com` (another case) reports it suppressed.

### 8. Every audience member gets exactly one message, planned or excluded with a reason.

**Why.** Nobody is dropped silently; the people left out and why are part of what
the approver reviews.

**Test.** An audience of Ada (subscribed), Grace (unsubscribed) and a third
invented contact who is also in an extra audience of the campaign. Prepare. Expect
three messages: two `planned`, Grace `excluded` with `topicUnsubscribed`, and no
contact twice.

### 9. Only messages of the campaign's current preparation are sent.

**Why.** Preparation freezes the recipient list; a message from an earlier
preparation reflects an audience that no longer applies.

**Test.** A message `planned` with `preparation: 1` on a `sending` campaign whose
`preparation` is 2. Run `send`. Expect status unchanged and zero provider
requests.

### 10. An edit returns a prepared campaign to draft, and only a ready campaign can be approved.

**Why.** What was approved must be what is sent.

**Test.** On a `ready` campaign, `edit` the subject. Expect `draft` and a newer
`contentChangedAt`. `approve` it: refused, status unchanged. `edit` a `sending`
campaign: refused.

### 11. Approval names the reviewed count; any other count, or zero, is refused.

**Why.** The approver approves a list, not a campaign name; a re-preparation
between review and approval changes the list.

**Test.** A `ready` campaign with three planned messages. `approve` with
`plannedCount: 2`: refused with a message naming 3, status `ready`. With
`plannedCount: 3`: `sending`, `approvedBy` is the caller. A `ready` campaign with
no planned message: refused.

### 12. Only people holding `campaignApprover` can approve.

**Why.** Approval is a separate decision from drafting; a script, an API key or a
workflow must never start a send.

**Test.** `approve` as a member holding only `marketing`: `403`. A structural test
over `roles.ts` and the workflows: no role other than `campaignApprover` grants
`campaign:approve` or `campaign:*`, and no workflow's role does.

### 13. Every campaign email carries a personal unsubscribe link and one-click headers.

**Why.** People must be able to leave from any email; mailbox providers require
RFC 8058 one-click unsubscribe from bulk senders.

**Test.** Render a message with token `tok-1`. Expect the HTML and the plain text
to contain the page link with `t=tok-1`, and headers `List-Unsubscribe` (the
endpoint with `t=tok-1&scope=topic`) and `List-Unsubscribe-Post:
List-Unsubscribe=One-Click`. With a sender whose `unsubscribeEndpoint` is empty,
`sendTest` and `approve` are refused.

### 14. A person receives a campaign at most once.

**Why.** Retries, resumed runs and re-preparations must never mail anyone twice.

**Test.** Run `send` twice for one planned message with a stub answering `200`.
Expect one provider request, carrying `Idempotency-Key: campaign-message-<id>`,
and status `sent`. Prepare the campaign again: the message stays `sent`, and a
second `plan` for the same contact creates no second message.

### 15. A throttle or outage leaves the message planned; only a permanent refusal fails it.

**Why.** A `429` or `5xx` marked as failed loses recipients; a permanent error
retried forever blocks the send.

**Test.** Stub `429`: `send` fails with a retryable error and the message stays
`planned`. Stub `503`: same. Stub `422`: status `failed`, reason
`providerRejected`, the provider's error in `reasonDetail`.

### 16. A cancelled campaign sends nothing more.

**Why.** Cancel is the emergency stop.

**Test.** Cancel a `sending` campaign with planned messages. Run `send` for one:
status unchanged, zero provider requests. `completeSending` makes no change.

### 17. Test sends go only to active members and write no message.

**Why.** A test skips consent checks; it must never reach a customer, and must
not count in results.

**Test.** `sendTest` to `grace@example.com` when Grace is not a member: refused.
To an active member's address: one provider request with `[Test]` in the subject,
`testSentAt` set, and no `EmailMessage` created.

### 18. Unsubscribe links work without sign-in, only through POST, and only for their own recipient.

**Why.** A person must be able to leave without an account; a link scanner's GET
must not unsubscribe anyone; a token must not reach anyone else.

**Test.** Call `emailMessage.unsubscribe` as the `emailUnsubscriber` workflow user
with Ada's token and `scope: topic`: Ada's topic record is `unsubscribed`,
explicit, `changedBy: contact`; Grace's records are unchanged. Repeat: no further
change. Scope `all`: Ada's `marketingOptOutAt` is set. An unknown token: no
change. A GET to the unsubscribe page writes nothing.

### 19. Bounces and complaints set the address's status, in rank order, whatever email caused them.

**Why.** A late "delivered" must not hide a complaint, and a bounce of a
non-campaign email still means the address is dead.

**Test.** `recordDelivery` `complained`, then `delivered`, for one message:
`delivery` stays `complained`, Ada's `emailStatus` is `complained`. A `bounced`
event with a provider id that matches no message: Grace's `emailStatus` becomes
`bounced`. A transient bounce reaching `emailEvents`: no change.

### 20. Imports never override a person's own choice and never count as their consent.

**Why.** An old list is weaker evidence than what the person did themselves, and
re-importing must not re-subscribe people who left.

**Test.** Ada has an explicit `unsubscribed` record for `newsletter`.
`importSubscriptions` lists her as `subscribed`: unchanged, counted as
`kept_explicit`. Grace is new: her record is `subscribed`, `explicit: false`,
`changedBy: import`. Neither import touches `emailStatus`.

### 21. Every consent change records who, when and where, from the caller.

**Why.** A company must be able to show how it got each consent and when it was
withdrawn.

**Test.** Call `contact.subscribe` with the intake key: `changedBy: contact`,
`changedAt` set, `source` as given. As a member: `changedBy: member`, and the call
is refused without `evidence`. A caller-supplied `changedBy` is not accepted by the
input schema. The record's history lists both changes.

### 22. An audience rule never decides consent, and an empty or broken rule reaches nobody.

**Why.** A rule that forgot consent would mail unsubscribed people; a rule with no
conditions, or one that no longer decodes, would otherwise reach everyone.

**Test.** `defineSegment` with `{}` or with an empty `anyOf` group: refused.
Store a rule that does not decode: `preview` returns no members and marks the
rule broken. A segment whose filter matches unsubscribed Grace includes her in
`preview`, and preparation excludes her with `topicUnsubscribed`.

### 23. Personal values are escaped, and the body keeps to the allowed tags.

**Why.** A contact's name is untrusted text; agent-written HTML may contain
anything.

**Test.** Render for a contact named `<b>Ada</b>`: the body contains
`&lt;b&gt;Ada&lt;/b&gt;`. `draft` with a `<script>` or `<iframe>` in `body`:
refused. A placeholder without a fallback, `{{firstName}}`: refused.

### 24. A campaign that sent anything is kept, and results are never stored counters.

**Why.** The campaign and its messages are the record of what the company sent;
stored totals drift from the messages.

**Test.** `discard` a cancelled campaign with one `sent` message: refused. With
only `planned` messages: deleted with them. Structural: `Campaign` declares no
integer property except `preparation` and `frequencyCapDays`; after three sends
and two `delivered` events, `EmailMessage.queryMetrics` for the campaign returns
`sent` 3 and `delivered` 2.
