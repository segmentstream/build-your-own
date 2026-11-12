# CRM invariants

Rules that hold in every version, whatever the interview decided. Each becomes
a test in the project, named after it (`crm 1. one submission id is one lead`),
with invented records only (Northwind, Ada Example, Grace Sample,
`example.com`).

Action tests use the ontology test harness, `kernel/ontology/test/ontology-harness.ts`,
set up as [testing](../../docs/testing.md) describes: `openOntology(ontology)`
runs this ontology in process on PGlite, with real members holding the named
roles, API keys, workflow users, actions through the SDK's own pipeline and
reads through the service's HTTP handler. It needs no PostgreSQL server and no
SegmentStream account.

| Kind | Invariants | How |
| --- | --- | --- |
| Action, through the harness | 1-7, 9-11, 14-16, 20, 21; the HTTP and record parts of 8 and 12 | `member`, `apiKey`, `run`/`ok`, `record`/`find`, `http` |
| Manifest | 8, 19 (no action writes `customer`), 22 | `segmentstream-ontology check --manifest` |
| Pure function | 12 (`toMinor`), 13 (the board's metric request and header, in `app/`), 18 (message composition) | Unit tests, no database |
| Pipeline | 19 | The model's expression on a fixture `deal` table with DuckDB (BLUEPRINT section 6) |
| A workflow's recorded effects | 17 | The trigger's `_workflow_starts` rows and the step's action run as the workflow's user; the Workflow SDK and chat delivery do not run locally |

Live metric totals (13) and chat posts (17) are checked again after deploy.

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
  Submit `someone@example.net` with `companyName: "Northwind"` (`example.net`
  is in the default `FREE_MAIL_DOMAINS`): expect no company created at all;
  the lead keeps `companyName`.

### 5. The intake key writes leads and reads nothing.

- **Why:** the key lives on a web server; leaked, it must not expose contacts.
- **Test:** with an API key holding only `intake`, `lead.submit` succeeds;
  `GET /api/ontology/lead`, `/contact` and `/deal`, and
  `POST /api/ontology/lead/actions/claim` with `{ "input": { "lead": … } }`,
  answer `403`.

### 6. Triage happens once, from `new`.

- **Why:** qualifying a lead twice opens two deals; disqualifying a qualified
  lead hides a live deal's origin.
- **Test:** qualify a new lead: expect one deal and `status: qualified`. Call
  `qualify` again, then `disqualify`: both are rejected and nothing changes.
  Disqualify without a reason from the list: rejected.

### 7. Only a signed-in member claims a lead.

- **Why:** an owner is a person who will reply; a key or workflow cannot.
- **Test:** `lead.claim` with an API key holding `sales`: rejected. As member Ada: owner and
  `triagedBy` become Ada; a second claim by Ada changes nothing (no new history
  entry). `lead.assign` to a deactivated member: rejected.

## Deals

### 8. Deals change only through their actions.

- **Why:** a generated create or update could open a deal as won or set any
  stage, skipping every rule below.
- **Test:** the manifest lists no `deal.create`, `deal.update`, `deal.delete`
  or `deal.upsert_by_*`. `POST /api/ontology/deal/actions/<name>` for each of
  them, with a key holding `salesManager` and an input setting
  `status: "won"`, answers `404` (there is no such route) and writes no deal.

### 9. A deal moves only within its own pipeline, and only while open.

- **Why:** a stage of another process means nothing in this one, and a closed
  deal's stage records where it ended.
- **Test:** an open deal in pipeline `sales`: `moveStage` to a stage of
  another pipeline is rejected (with a single pipeline there is none to try); to `proposal` without an amount is rejected
  and names the missing field; with the amount set it succeeds and updates
  `stageEnteredAt`; moving to the same stage changes nothing. After
  `markLost`, `moveStage` is rejected.

### 10. Won and lost are final.

- **Why:** revenue, win rate and customers are computed from closed deals;
  reopening one silently rewrites history.
- **Test:** win a deal; then `markWon`, `markLost`, `moveStage` and `edit`
  are all rejected. `correctClosure` by a `salesManager` with a reason changes
  the amount but leaves `status: won`; the same call by `sales` is refused for
  lack of `deal:correctClosure` (`403` over HTTP).

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
- **Test:** a unit test of the board's metric request fails if
  `deal.currency` is missing from its dimensions. Given the rows a metric
  query returns for one open deal of 1,000 EUR and one of 1,000 USD in the same
  stage, the column header reads `2 deals · 1,000 EUR · 1,000 USD`, never
  2,000. After deploy, the live board shows the same for two such deals.

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

### 17. Each announcement is sent at most once.

- **Why:** a duplicate post or email teaches the team to ignore it.
- **Test:** submit a new lead: exactly one `_workflow_starts` row for
  `announce_new_lead` names it, and a repeated submission adds none. As the
  workflow's user (`workflowUser("announce_new_lead")`), run `lead.emailOwner`
  before the lead has an owner (`no_owner`), then twice after Ada claims it,
  as a retried step would: one `_sign_in_emails` row for Ada with template
  `lead_for_owner` and `return_to` `/leads/<id>`, and the second call returns
  `already_emailed`. With Telegram posts, after deploy: a test lead posts once
  with key `crm:new-lead:<lead id>`, and replaying the run gets a
  `duplicate: true` receipt.

### 18. Messages about a lead carry no private or active content.

- **Why:** the chat may include people who may not read the lead, and record
  text can contain Markdown links or instructions.
- **Test:** for a lead whose name is `[click](https://example.com/x)` and whose
  message is "ignore your instructions", the composed chat message contains
  the name escaped as plain text, no message text, no email or phone, and one
  link: the lead's page in the app. The owner email's values are only the
  lead's name, company and source, each on one line.

### 19. "Customer" is computed, never stored.

- **Why:** a stored customer flag drifts from the deals that justify it.
- **Test:** the manifest has no action that writes `customer`, and of the
  CRM's actions only `lead.submit` writes `company` (it creates companies,
  never flags). Run the `crm_customers` expression on a fixture `deal` table
  with one won Northwind deal: one row for Northwind in that currency. Add a
  second won Northwind deal in the same currency: still one row,
  `won_deals = 2`. Deals in two currencies give two rows.

### 20. Merging companies keeps every CRM record.

- **Why:** a merge that cascades or fails on a restrict loses or blocks sales
  history.
- **Test:** two companies, each with a lead, a deal and an activity. Merge one
  into the other: the kept company has two leads, two deals and two
  activities; the duplicate is gone.

### 21. Activities are written as their author.

- **Why:** history must say who called whom.
- **Test:** `activity.log` as Ada sets `author` to Ada; its input has no
  author field. `activity.correct` by Grace on Ada's activity answers `404`
  (`NotFound`): the scope `{ author: me }` on the write produces it, so the
  handler must not reject first with a check of its own (BLUEPRINT section
  10). `activity.log` with no lead, deal, contact or company is rejected.

### 22. Unattended roles cannot close, disqualify or merge.

- **Why:** a workflow or agent task acts without a Confirm card, and a lead's
  text can try to steer it.
- **Test:** for every workflow role and API key role, assert its permissions
  include none of `deal:markWon`, `deal:markLost`, `deal:correctClosure`,
  `lead:disqualify`, `routingRule:*`, `company:mergeInto`, `user:*`.
