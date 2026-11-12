# CRM pitfalls

Mistakes already made building CRMs on the platform, and what to do instead.

## 1. Deals created as won through the back door

- **Symptom:** deals appear already won, without a close date or amount, or
  jump from the first stage to the last; customers appear that nobody sold to.
- **Cause:** `Deal` kept its generated `create` and `update`. Anyone with those
  permissions, an agent included, can set any stage or status.
- **Instead:** `writes: "actions"` on `Deal` and `Lead`. Deals open through
  `lead.qualify` and `deal.open`, which always start open.

## 2. Every stage move asks for confirmation, or none does

- **Symptom:** the agent shows a Confirm card for "move to proposal", or
  closes a deal as won without one.
- **Cause:** one `moveStage` action that also accepts won and lost. Hints are
  static per action, so it is either always irreversible or never.
- **Instead:** won and lost are a `status`, set by `markWon` and `markLost`,
  which are irreversible; `moveStage` handles open stages and is routine.

## 3. Cents go missing, or the check refuses the currencies

- **Symptom:** 0.1 + 0.2 style totals, amounts like 11999.999999; or `check`
  fails with "option values must be lowercase snake_case".
- **Cause:** `p.number` is stored as a float. Currency select values written
  as `EUR`.
- **Instead:** `amountMinor` as `p.integer` in the currency's minor unit,
  converted from decimal text without floating point; select values `eur`,
  `usd` with labels `EUR`, `USD`.

## 4. The board is slow and its totals add euros to dollars

- **Symptom:** the deals page takes seconds once there are a few hundred deals,
  and the header shows one total across currencies.
- **Cause:** the page pages through every deal and sums amounts in the app.
- **Instead:** each column is one `find` page; counts and amounts come from one
  metric query grouped by `stage` and `currency`. Totals lag writes by the
  replication delay; show that, never "fix" it by adding cards up.

## 5. New-lead alerts arrive twice, or never

- **Symptom:** duplicate posts after a timeout; or no post when the website's
  background job died; or a post saying "qualified" for a lead that is not.
- **Cause:** the alert was sent by the website after its call, or from an
  action's `prepare` before the transaction committed, or by editing the post
  before the write.
- **Instead:** an `after(Lead.actions.submit)` workflow posts with
  `AgentChat.actions.postMessage` and a key built from the lead id. Never send
  from `prepare` for a write that may still fail; never resend an `uncertain`
  post.

## 6. A notification sender built from scratch

- **Symptom:** a `notification` entity, a Telegram client in ontology code,
  bot tokens in environment variables, chat ids in constants.
- **Cause:** not knowing the platform posts exact text to agent chats.
- **Instead:** the built-in `chat_post_message` through the agent's Telegram
  connection, with the chat found by `purpose`. Posts cannot be edited and
  carry no buttons; link to the app.

## 7. A link in the chat that changes a record

- **Symptom:** opening a link from the chat (or a link preview fetched by the
  chat app) claims or disqualifies a lead.
- **Cause:** a page that runs an action on load from a query parameter.
- **Instead:** `?do=claim` opens a dialog; the member confirms, and the
  action runs as them. A GET never writes.

## 8. Lead text steering the agent or the chat

- **Symptom:** an unattended agent task disqualifies leads or posts odd text
  after reading a submission; a chat message shows a link the team did not
  write.
- **Cause:** the lead's message went into a prompt as instructions, or into a
  Markdown post unescaped, and the workflow's role held more than it needed.
- **Instead:** prompts say record text is data; chat messages carry escaped
  names only, never the message; unattended roles hold no closing, triage or
  merge permission.

## 9. Duplicate leads from retries

- **Symptom:** two or three identical leads a few seconds apart.
- **Cause:** the website generated a new `submissionId` on every request, or
  none at all, so retries looked like new submissions.
- **Instead:** generate the id once when the form is shown or first
  submitted, and reuse it on every retry. `lead.submit` requires it.

## 10. The website key reads every contact

- **Symptom:** a key found in the website's code or logs lists the CRM.
- **Cause:** the key was put in browser JavaScript, or given `sales` "to make
  it work".
- **Instead:** the key lives on the website's server only and holds `intake`,
  which grants `lead:submit` and nothing else. A static site uses a form
  tool's webhook instead.

## 11. Owners and chat ids in code

- **Symptom:** routing breaks in dev, or a former employee keeps getting
  leads until someone deploys.
- **Cause:** member ids, emails or chat ids written as constants.
- **Instead:** `RoutingRule` records name members; the chat is found by
  `purpose`; both change through actions without a deploy.

## 12. A company called gmail.com

- **Symptom:** hundreds of unrelated contacts share one company.
- **Cause:** company-by-domain without a free-mail check.
- **Instead:** `FREE_MAIL_DOMAINS` in config, extended for the company's
  market; free-mail leads keep the typed `companyName`, and qualifying asks for
  the company.

## 13. The deploy fails over the starter's lead

- **Symptom:** the migration rolls back with a removed select option, or a new
  `lead` entity is refused.
- **Cause:** the starter's `lead` was deployed with statuses `new`,
  `contacted`, `pilot`, `won`, `lost`, and the CRM declared new options or a
  new `id` under the same name.
- **Instead:** keep the starter's entity `id`; move existing records to the
  new statuses through an action before removing old options, or keep them
  until no record holds them.

## 14. Merge breaks on CRM records

- **Symptom:** merging two companies fails with a restrict error, or the
  merged company loses its leads and activities.
- **Cause:** the foundation's merge did not know about the CRM's relationships
  to `Company`.
- **Instead:** every relationship to `Company` that the CRM adds is moved by
  `company.merge_into`; its test covers each one.

## 15. A customer flag that drifts

- **Symptom:** a company marked customer with no won deal, or a new customer
  missing from the list.
- **Cause:** "customer" stored as a status that some action had to keep in
  step with deals, and one path forgot.
- **Instead:** compute it: the Customers page lists companies with a won deal,
  and the `crm_customers` model feeds the numbers. Lifetime value, last
  activity and open deal counts are metrics, never properties.
