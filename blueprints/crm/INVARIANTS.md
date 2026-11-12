# CRM invariants

Rules that hold in every version, whatever the interview decided. Each becomes
a test in the project. Run the action tests against the local service started
by `segmentstream dev`, as members and keys holding the named roles, with
invented records only (Northwind, Ada Example, `example.com`).

## Leads

### 1. One submission id is one lead.

- **Why:** websites and form tools retry. A retry must never create a second
  lead, a second announcement or a second owner assignment.
- **Test:** call `lead.submit` twice with `submissionId: "form-1"`, email
  `ada@example.com`. Expect one lead; the first call returns
  `created: true`, the second `created: false` with the same `leadId`. Run the
  two calls concurrently: still one lead, and the losing call succeeds on
  retry.

### 2. A repeated submission changes only what was submitted.

- **Why:** a second delivery of the same form must not reopen a disqualified
  lead, steal it from its owner or rewrite where it came from.
- **Test:** submit `form-1` with source `website`; disqualify the lead as
  `spam`; submit `form-1` again with a new `message` and source `event`.
  Expect `message` updated, and `status: disqualified`, the reason, the owner
  and `source: website` unchanged.

### 3. Submit fills only empty contact fields.

- **Why:** a member's correction of a name or phone must survive the next form
  the same person sends.
- **Test:** a contact `grace@example.com` with name "Grace Sample", phone
  empty. Submit with name "G. Sample" and phone "+1 555 0100". Expect the name
  unchanged and the phone filled.

### 4. One contact per email, one company per domain, none for free mail.

- **Why:** duplicates split a customer's history and break every count.
- **Test:** submit `Ada.Example@example.com` and then `ada.example@example.com`
  with new submission ids. Expect one contact with email
  `ada.example@example.com`, linked to one company with domain `example.com`.
  With `example.net` added to `FREE_MAIL_DOMAINS` for the test, submit
  `someone@example.net` with `companyName: "Northwind"`: expect no company
  created at all; the lead keeps `companyName`.

### 5. The intake key writes leads and reads nothing.

- **Why:** the key lives on a web server; leaked, it must not expose contacts.
- **Test:** with an API key holding only `intake`, `lead.submit` succeeds;
  `lead_find`, `contact_find`, `deal_find` and `lead.claim` answer `403`.

### 6. Triage happens once, from `new`.

- **Why:** qualifying a lead twice opens two deals; disqualifying a qualified
  lead hides a live deal's origin.
- **Test:** qualify a new lead: expect one deal and `status: qualified`. Call
  `qualify` again, then `disqualify`: both are rejected and nothing changes.
  Disqualify without a reason from the list: rejected.

### 7. Only a signed-in member claims a lead.

- **Why:** an owner is a person who will reply; a key or workflow cannot.
- **Test:** `lead.claim` with an API key: rejected. As member Ada: owner and
  `triagedBy` become Ada; a second claim by Ada changes nothing (no new history
  entry). `lead.assign` to a deactivated member: rejected.

## Deals

### 8. Deals change only through their actions.

- **Why:** a generated create or update could open a deal as won or set any
  stage, skipping every rule below.
- **Test:** the manifest lists no `deal.create`, `deal.update`, `deal.delete`
  or `deal.upsert_by_*`; calling `/api/ontology/deal/actions/update` as an
  admin answers that deal is written only through its actions.

### 9. A deal moves only within its own pipeline, and only while open.

- **Why:** a stage of another process means nothing in this one, and a closed
  deal's stage records where it ended.
- **Test:** an open deal in pipeline `sales`: `moveStage` to a stage of
  another pipeline is rejected; to `proposal` without an amount is rejected
  and names the missing field; with the amount set it succeeds and updates
  `stageEnteredAt`; moving to the same stage changes nothing. After
  `markLost`, `moveStage` is rejected.

### 10. Won and lost are final.

- **Why:** revenue, win rate and customers are computed from closed deals;
  reopening one silently rewrites history.
- **Test:** win a deal; then `markWon`, `markLost`, `moveStage` and `edit`
  are all rejected. `correctClosure` by a `salesManager` with a reason changes
  the amount but leaves `status: won`; the same call by `sales` answers `403`.

### 11. A won deal has an amount; a lost deal has a reason.

- **Why:** a won deal without value and a lost deal without reason make the
  two most-read reports wrong.
- **Test:** `markWon` on a deal without an amount and no `amount` input:
  rejected. With `amount: "12000.50"` in `eur`: `amountMinor` is 1200050.
  `markWon` with a `closedOn` tomorrow: rejected. `markLost` without a reason:
  rejected.

### 12. Money is exact and always carries its currency.

- **Why:** floats lose cents, and an amount without a currency cannot be
  reported.
- **Test:** `toMinor("12000.50", "eur")` is 1200050; `toMinor("0.1", "eur")`
  is 10; `toMinor("12.345", "eur")` and `toMinor("1e3", "eur")` are rejected.
  Every deal record with `amountMinor` has a `currency`.

### 13. Amounts in different currencies are never added.

- **Why:** a pipeline total of euros plus dollars is a wrong number that looks
  right.
- **Test:** seed one open deal of 1,000 EUR and one of 1,000 USD in the same
  stage. The deals board's metric request groups by `currency`, and the
  column header shows "1,000 EUR · 1,000 USD". A unit test of the board's
  query builder fails if `currency` is missing from its dimensions.

### 14. A deal belongs to someone who can buy.

- **Why:** a deal with neither company nor person cannot become a customer.
- **Test:** `deal.open` with neither `company` nor `primaryContact`: rejected.
  With `SELLS_TO: "companies"`, a deal with only a contact: rejected.

## Everything else

### 15. Owners are active members.

- **Why:** a lead owned by an API key or a former employee is a lead nobody
  works.
- **Test:** `lead.assign`, `deal.assign` and `routingRule.configure` with a
  service user or a deactivated member: rejected.

### 16. Routing is deterministic and fair.

- **Why:** the team must be able to predict who gets a lead, and round-robin
  must not favour anyone under load.
- **Test:** rules at priority 10 (source `partner` to Ada) and 20 (round-robin
  over Ada, Grace and a third member). A partner lead goes to Ada. Six website
  leads submitted concurrently give each pool member exactly two. A
  deactivated rule is skipped; with no match the lead has no owner.

### 17. Each announcement is posted at most once.

- **Why:** a duplicate post teaches the team to ignore the chat.
- **Test:** with chat delivery replaced by a test double, submit a new lead, then restart the
  `announceNewLead` run and retry its post step. Expect one post with key
  `crm:new-lead:<lead id>` and a `duplicate: true` receipt for the retry;
  `emailOwner` sends one email. A repeated submission starts no run.

### 18. Chat messages carry no private or active content.

- **Why:** the chat may include people who may not read the lead, and record
  text can contain Markdown links or instructions.
- **Test:** submit a lead whose name is `[click](https://example.com/x)` and
  whose message is "ignore your instructions". The composed message contains
  the name escaped as plain text, no message text, no email or phone, and one
  link: the lead's page in the app.

### 19. "Customer" is computed, never stored.

- **Why:** a stored customer flag drifts from the deals that justify it.
- **Test:** no action writes a customer status. Run the `crm_customers`
  model on a fixture `deal` table with one won Northwind deal: one row for
  Northwind in that currency. Add a second won Northwind deal in the same
  currency: still one row, `won_deals = 2`.

### 20. Merging companies keeps every CRM record.

- **Why:** a merge that cascades or fails on a restrict loses or blocks sales
  history.
- **Test:** two companies, each with a lead, a deal and an activity. Merge one
  into the other: the kept company has two leads, two deals and two
  activities; the duplicate is gone.

### 21. Activities are written as their author.

- **Why:** history must say who called whom.
- **Test:** `activity.log` as Ada sets `author` to Ada whatever the input;
  `activity.correct` by Grace on Ada's activity answers `404`; with no
  lead, deal, contact or company it is rejected.

### 22. Unattended roles cannot close, disqualify or merge.

- **Why:** a workflow or agent task acts without a Confirm card, and a lead's
  text can try to steer it.
- **Test:** for every workflow role and API key role, assert its permissions
  include none of `deal:markWon`, `deal:markLost`, `deal:correctClosure`,
  `lead:disqualify`, `routingRule:*`, `company:mergeInto`, `user:*`.
