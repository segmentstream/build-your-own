# Email marketing: pitfalls

Mistakes already made building this kind of software on the platform, and what
to do instead.

### 1. Consent checked only when the audience is resolved

- **Symptom:** a person unsubscribes on Monday and still gets the campaign
  scheduled for Wednesday.
- **Cause:** the consent check ran in preparation only.
- **Instead:** `emailMessage.send` reads the contact, the topic's subscription and
  the suppressions again in its `prepare`, and records `skipped` with the reason.

### 2. Consent written into audience rules

- **Symptom:** one segment mails people who unsubscribed; another leaves out a
  topic's default subscribers.
- **Cause:** each rule carried its own consent condition, and one forgot it.
- **Instead:** rules say who a campaign may reach; `plan` and `send` apply consent
  and suppression to every audience with one function.

### 3. One workflow step per recipient

- **Symptom:** a large campaign stops part-way; the run fails at the workflow
  runtime's per-run limits on steps and events.
- **Cause:** every message was its own step, so step count grew with the list.
- **Instead:** one step per page of messages, each sent by its own idempotent
  action call; end a run after a set number of messages and let the cron-driven
  clock resume it through an action trigger, since a workflow cannot start another.

### 4. Duplicates after a retry

- **Symptom:** some people receive the same campaign two or three times.
- **Cause:** the provider call happened, the transaction that records `sent`
  failed, and the retried step sent again with a new or missing idempotency key.
- **Instead:** derive the key from the message, `campaign-message-<id>`, never from
  the request. Provider deduplication windows are limited (Resend keeps keys for
  24 hours), so resume a stalled campaign within hours, and on providers without
  keys use the `sending` status described in VARIATIONS.md.

### 5. Throttling treated as failure, or failure treated as throttling

- **Symptom:** hundreds of messages marked `failed` during a burst, or one bad
  address retried until the run gives up.
- **Cause:** every non-2xx answer handled the same way.
- **Instead:** `429`, `5xx` and an unreachable proxy fail the call as retryable and
  leave the message `planned`; other `4xx` answers mark it `failed` with the
  provider's text. Pace sends to the provider's rate limit.

### 6. Provider events received in an app route

- **Symptom:** bounces are accepted from anyone, or nothing can be written
  because the route has no identity.
- **Cause:** a Next.js route handler took the provider's webhook.
- **Instead:** a `webhook(...)` trigger on an ontology workflow. A provider whose
  signature scheme the platform does not check gets a token URL; treat that URL
  as a credential. Expect repeats and any order: rank events, ignore transient
  bounces.

### 7. Unsubscribing on a GET, or behind sign-in

- **Symptom:** people are unsubscribed from emails they never opened, or the
  unsubscribe link lands on a sign-in page.
- **Cause:** security gateways and link scanners open every link in an email; the
  page was not in the app's `publicPaths`.
- **Instead:** the footer link opens a public page that posts the choice; the
  `List-Unsubscribe` URL accepts only the one-click POST. Add the page to
  `publicPaths`, and keep it free of record reads.

### 8. Counts stored on campaigns and audiences

- **Symptom:** "Sent: 1,200" on the campaign while the messages say 1,150; the
  approver approves a number that no longer matches the list.
- **Cause:** counters incremented by workflows that retried or were superseded.
- **Instead:** results are metric queries over `EmailMessage`; `approve` counts the
  planned messages fresh with `EmailMessage.queryMetrics` in its transaction.

### 9. Old lists imported as consent, without their opt-outs

- **Symptom:** the first campaign brings a wave of complaints from people who had
  left the previous tool.
- **Cause:** subscribers were imported as explicit opt-ins; unsubscribes, bounces
  and complaints were left behind.
- **Instead:** import lists as `explicit: false` and import every opt-out, bounce
  and complaint before the first send. An import never overrides a person's own
  choice.

### 10. An erased or merged contact comes back subscribed

- **Symptom:** a person who asked to be forgotten is mailed after the next
  import.
- **Cause:** deleting the contact deleted its opt-out with it.
- **Instead:** any action that erases a contact adds an address suppression (a
  digest, not the address) first. A merge keeps the stricter state: the opt-outs
  and the worst email status of both contacts.

### 11. Test emails to customers

- **Symptom:** a customer receives "[Test] October update" with placeholders
  unfilled.
- **Cause:** `sendTest` accepted any address, and the agent picked a recipient
  from the audience.
- **Instead:** tests go only to active members' addresses, and write no message.

### 12. Agent-written HTML trusted

- **Symptom:** a preview runs a script in the app, or a contact named with markup
  breaks the layout.
- **Cause:** the body was rendered into the page directly; personal values were
  inserted unescaped.
- **Instead:** refuse tags outside the allow-list at `draft` and `edit`, escape
  every personal value, and preview in an `iframe` with `sandbox` and no scripts.

### 13. Sending from an unauthenticated or shared domain

- **Symptom:** campaigns land in spam or are rejected; after one bad campaign,
  invoices stop arriving too.
- **Cause:** the From domain lacked aligned SPF, DKIM and DMARC, or marketing
  shared the domain of transactional and personal mail.
- **Instead:** send marketing from its own verified subdomain, check it with
  `checkDomain` before the first send, and keep complaints low: large mailbox
  providers require one-click unsubscribe from bulk senders and act on spam rates
  well under one percent.

### 14. A campaign stuck in `preparing`

- **Symptom:** a campaign cannot be prepared, edited or approved after a deploy
  or a failed run.
- **Cause:** `prepare` was allowed only from `draft` and `ready`, and the workflow
  that would finish the preparation stopped.
- **Instead:** allow `prepare` from `preparing`. The new preparation number
  supersedes the stuck run: its next page sees the new number and stops, and its
  `completePreparation`, if it gets that far, changes nothing.
