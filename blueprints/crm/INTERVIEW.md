# CRM interview

Ask these in one message, in plain words, and offer the default for each. Skip
what the person already said. Answers become `ontology/crm-config.ts`, the
routing rules and the roles; none of them is ever a real customer record.

## 1. Who buys from you: companies, individual people, or both?

- **Why it matters:** it decides whether a deal must have a company, whether a
  lead from a personal email address is normal or a warning sign, and whether a
  customer is a company or a person.
- **What changes:** `companies` makes `company` required on deals and creates
  companies from email domains. `people` never creates companies from emails;
  deals hang on a contact. `both` allows either, and the customer view keys by
  company when there is one, else by person.
- **Default:** companies.

## 2. Where do leads come from today, and which should arrive by themselves?

- **Why it matters:** each source is a `source` option for reports, and each
  automatic channel is an intake path to build.
- **What changes:** the `SOURCE_OPTIONS` list. A website with its own server
  gets an API key with the `intake` role. A form tool (Tally, Jotform, Webflow
  and the like) gets a webhook workflow. A shared inbox, chat widget or phone
  log is a variation. Manual entry needs nothing extra.
- **Default:** website, referral, event, outbound, partner, import, other; the
  website's server calls `lead.submit` with a key.

## 3. What happens to a new lead in its first day, and how fast should someone answer?

- **Why it matters:** triage is the CRM's busiest moment. The response target
  drives the morning digest, and the disqualify reasons become a report.
- **What changes:** `RESPONSE_TARGET_HOURS`, `DISQUALIFY_REASONS`, the triage
  rules in the lead descriptions (and the `lead.md` guide for people), and
  whether qualifying needs an amount.
- **Default:** answer within 24 hours; reasons spam, duplicate, not a fit, no
  response, other; qualifying needs no amount.

## 4. Who should get each new lead?

- **Why it matters:** an unowned lead is a lost lead, and fair distribution
  matters to a sales team.
- **What changes:** the first routing rules (by source, product or country;
  one owner or a round-robin pool), entered after deploy through
  `routingRule.configure`, never in code.
- **Default:** no rules; new leads wait unassigned in the inbox and anyone in
  `sales` claims them.

## 5. What do you sell, and do different products, teams or regions sell differently?

- **Why it matters:** a pipeline is one sales process. Two processes in one
  pipeline make every stage report meaningless.
- **What changes:** `PRODUCT_OPTIONS`, `PIPELINE_OPTIONS` and `PIPELINES`; a
  pipeline tab per process on the deals board; the pipeline `qualify` offers
  first.
- **Default:** one product option and one pipeline called Sales.

## 6. For each process, what are the steps from first conversation to a signed deal, and what must you know before each step?

- **Why it matters:** stages are only useful when everyone agrees what they
  mean, and entry rules keep forecasts honest.
- **What changes:** `STAGE_OPTIONS` with a description per stage that says when
  a deal is in it, the stage order, and each stage's required fields (amount,
  expected close date). Won and lost are never stages. Ask once per pipeline:
  each pipeline has its own stages, and a stage value belongs to one pipeline
  only, so a repeated name gets a prefix (`partner_negotiation`).
- **Default:** discovery, proposal, negotiation; proposal and negotiation need
  an amount and an expected close date. A second pipeline with no answer gets
  the same steps, prefixed with its name.

## 7. Which currencies do you price in, and when do you know a deal's value?

- **Why it matters:** amounts in different currencies never add up, and a won
  deal without a value breaks every revenue number.
- **What changes:** `CURRENCY_OPTIONS`, `MINOR_DIGITS`, `HOME_CURRENCY`; the
  stage that first requires an amount. Winning always requires one.
- **Default:** one currency, the home one, with an amount required from
  proposal on.

## 8. When you lose a deal, what are the usual reasons?

- **Why it matters:** lost reasons are the most useful report a CRM gives a
  founder, and only a fixed list can be counted.
- **What changes:** `LOST_REASONS`; free text goes in the closing note.
- **Default:** price, competitor, no decision, timing, not a fit, other.

## 9. Who should see and change which records?

- **Why it matters:** small teams want everyone to see everything; larger ones
  keep reps to their own records and managers over all.
- **What changes:** whether `member` reads CRM records; whether `sales` changes
  any deal or only its own (scoped permissions on `owner: me`); who holds
  `salesManager`.
- **Default:** everyone in `sales` sees and changes every lead and deal; one
  `salesManager` corrects closed deals and edits routing.

## 10. Where should the team hear about new leads and won deals, and what may that chat see?

- **Why it matters:** a notification is useful only where people look, and a
  group chat often includes people who should not read a lead's message.
- **What the platform can do today:** the company agent answers paired members
  in Telegram, Slack and WhatsApp, but workflows post to team chats only in
  Telegram. With Slack, WhatsApp or no team chat, the plan offers owner emails
  and never promises chat posts.
- **What changes:** with Telegram, whether the announcement and digest
  workflows are built, the chat whose purpose is `sales`, whether owners also
  get an email, and the fields the message may carry. Otherwise only the owner
  email.
- **Default:** in Telegram, post to the `sales` chat with name, company, source
  and a link, and email the owner; otherwise email the owner only.

## 11. What do you have today that must come over?

- **Why it matters:** an import decides the first impression, and duplicates
  created by a careless import take weeks to clean up.
- **What changes:** an import workflow keyed by the old system's ids
  (HubSpot through its connection, or a spreadsheet you upload), mapping old
  stages to new ones and old owners to members.
- **Default:** start empty; import later as a variation.

## 12. What may the agent do without asking?

- **Why it matters:** the agent acts as the person who asks; a Confirm card
  is the only pause before an irreversible change.
- **What changes:** the `hints` on actions and the agent's CRM instructions.
- **Default:** reads, claims, stage moves, next steps and logged activities
  run at once; qualifying, disqualifying, won, lost and corrections show a
  card.

## Always a human decision

Whatever the answers, these are never automatic and never granted to an
unattended workflow or agent task:

- Marking a deal won or lost, and correcting a closed deal's amount or date.
- Disqualifying a lead.
- Sending any email or message to a lead or contact.
- Merging or deleting companies and contacts, and erasing a person's data.
- Importing records into production, and changing who receives new leads.
