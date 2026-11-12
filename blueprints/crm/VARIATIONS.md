# CRM variations

Where companies legitimately differ. Each variation lists the options, what
each changes, and the default this blueprint builds.

## Sales motion

| Option | Changes | |
| --- | --- | --- |
| Sell to companies | Deals require a company; companies come from email domains; customers are companies. | **Default** |
| Sell to people | No company from emails; deals hang on a contact; customers are people. The lead form asks what a person-buyer needs (budget, timing, the thing they want). | |
| Both | Company optional on deals; the customer view keys by company, else person. | |

Industry fields (a property type in real estate, a course and intake date in
education, a vehicle in a dealership) are extra optional properties on `Lead`
and `Deal`, chosen in the interview, with descriptions. They never replace the
core properties.

## Leads or not

| Option | Changes | |
| --- | --- | --- |
| Leads, then deals | Everything in this blueprint. | **Default** |
| Deals only | For pure outbound teams: no `Lead`, no intake; `deal.open` is the start, activities record the first touch. | |
| Leads only | For teams that close in one conversation: `qualify` is replaced by `lead.markWon` with an amount, and the customer view reads won leads. Keep the money and finality rules. | |

## Intake paths

| Option | Changes | |
| --- | --- | --- |
| Website server with an API key | The site's server calls `lead.submit` with an `intake` key and a submission id it generates once per form and reuses on retry. | **Default** |
| Form tool webhook | A `webhook(...)` workflow receives the form tool's delivery (a token URL, or a signature where the provider signs), parses it in a step, and calls `lead.submit` with the tool's response id as `submissionId`. Its role holds `lead:submit` only. | |
| Shared inbox | A Gmail connection per mailbox; a workflow syncs threads into `Conversation` and `Message` records keyed by provider ids, and a new inbound thread from an unknown sender calls `lead.submit` with the thread id. A conversation's status says who owes the next reply. An agent task may draft a reply into a draft field; a member edits and sends it through an action. Nothing is sent without a member. | |
| Chat or phone | A provider's webhook (WhatsApp, a call-tracking tool) feeds the same `lead.submit`, keyed by the provider's conversation or call id. | |
| Manual only | Members type leads in the app; `submissionId` is generated per form open. | |

Spam control is the website's job (a challenge, rate limits). The CRM may add
a list of disposable email domains that `lead.submit` rejects.

## Pipelines and stages

| Option | Changes | |
| --- | --- | --- |
| One pipeline, stages in code | `PIPELINES` in `crm-config.ts`; a change is a reviewed deploy. | **Default** |
| Several pipelines | One per product, team or region, each with its own stages; a stage value belongs to one pipeline only (`partner_negotiation`, not a second `negotiation`). A deal's pipeline is set when it opens. Add `deal.changePipeline` (first stage of the new one, reason kept) only if teams hand deals over. | |
| Stages as records | A `Stage` entity managed by `salesManager`, for teams that change their process weekly. Costs: descriptions are no longer reviewed code, and removing a stage needs an action that moves its deals first. | |
| Stage history for analytics | A `DealStageChange` record written by `moveStage`, `markWon` and `markLost`: from, to, when, by whom. Enables time-in-stage and stage-to-stage conversion in a model. Record history alone is not in the warehouse. | |
| Forecast | A probability per stage in config, applied in a warehouse model to give a weighted pipeline per currency. Never stored on the deal. | |

## Products and money

| Option | Changes | |
| --- | --- | --- |
| A product select on leads and deals, one amount per deal | As built. | **Default** |
| Line items | A `DealLine` entity (product, quantity, unit price in minor units) written by deal actions; the deal's amount is checked against its lines with a fresh metric query when it is won. Quotes as documents come from the e-signature blueprint. | |
| One currency | `CURRENCY_OPTIONS` has one value; amounts still carry it. | **Default** |
| Several currencies | Reports group by currency. A converted total in a reporting currency needs exchange rates and a warehouse model; take them from the bookkeeping blueprint rather than a rate typed on the deal. | |
| Recurring revenue | Annual or monthly contract value on the deal as a separate property, with the term. Renewals of existing customers are new deals in a renewal pipeline; billing stays in bookkeeping. | |

## Visibility and roles

| Option | Changes | |
| --- | --- | --- |
| Open team | Everyone in `sales` reads and changes every lead and deal. | **Default** |
| Own records | `sales` changes only leads and deals it owns: scoped permissions `{ permission: "deal:moveStage", where: { owner: me }, readsAll: true }` and the same for the other deal and lead actions. Managers keep unscoped grants. | |
| Private by team | Reads scoped too, by an owner's team through a path from `me`. Metric queries refuse some path scopes; check the project's `docs/ontology.md` before choosing. | |
| Whole company reads CRM | `member` keeps `*:read`. | **Default** if the project already has it |
| CRM is sales-only | `member` loses CRM reads; roles grant them. Do this before finance or HR blueprints add members who should not see leads. | |

## Routing

| Option | Changes | |
| --- | --- | --- |
| Claim from the inbox | No rules; members take leads. | **Default** |
| Fixed owner per source, product or country | `routingRule.configure` with method `owner`. | |
| Round-robin | A pool per rule, rotated under a lock. | |
| Account ownership first | A lead from a company that already has an owner goes to that owner before any rule. Add it as the first step of routing. | |

## Notifications

Workflows post to team chats only in Telegram today. The company agent also
answers paired members in Slack and WhatsApp, but a workflow cannot post
there yet, so with those channels only the owner email is available.

| Option | Changes | |
| --- | --- | --- |
| Team chat and owner email | `announceNewLead`, `announceWonDeal`, `salesDigest` post to the Telegram chat with purpose `sales`; owners get a sign-in-link email. | **Default** when the team chat is Telegram |
| Owner email only | `announceNewLead` calls `lead.emailOwner` only; no `announceWonDeal`, no `salesDigest`, no `agent_chat` grants. | **Default** otherwise, including Slack and WhatsApp |
| Updates in thread | Telegram only. On qualify or disqualify, a reply to the original post (`replyTo` with its message id stored on the lead) saying who did what. The original post is never edited. | |
| Per-owner direct messages | Telegram only. The digest goes to each owner's private chat (`telegram:private:<member id>`) instead of the group. | |

## Talking to leads

| Option | Changes | |
| --- | --- | --- |
| No automatic email to submitters | The website shows its own thank-you. | **Default** |
| Confirmation email | A workflow after `submit` sends one email through an email provider connection marked `delivers: true`, keyed `crm:confirmation:<lead id>`. Its words are the company's, in the submitter's language. Consent for anything beyond this one reply belongs to email-marketing. | |
| AI-assisted replies | An agent task drafts a reply from the lead and the reply rules in the agent's instructions (the agent does not receive entity guides); a member approves and sends. The task's role can save a draft and nothing else. | |
| Enrichment | An action calls an enrichment provider in `prepare` for one lead and fills empty company fields. Provider data in bulk belongs in the warehouse. | |

## Bringing data over

| Option | Changes | |
| --- | --- | --- |
| Start empty | | **Default** |
| One-time import from HubSpot | A `HubSpotConnection` with read scopes. A workflow pages companies, contacts and deals, one page per step, carrying only the cursor, and calls upsert actions keyed by HubSpot ids stored in an `externalId` property; stages and owners map through a table the person approves. Closed deals import as won or lost with their dates. Run once in production after a dry run in dev. | |
| Import from Salesforce, Zoho CRM or a spreadsheet | The same workflow shape over that provider's API, or an uploaded file read in steps. | |
| Ongoing two-way sync | Not recommended: two systems of record disagree. If unavoidable, one direction per field, keyed by provider ids, older changes skipped. | |

## Country and law

Defaults are country-neutral. Where they apply, build these as variations:

- **Data protection** (GDPR, CCPA and similar): a lawful-basis and consent
  note on `lead.submit`'s input; a retention sweep that erases leads
  disqualified more than N months ago; a person's erasure through the
  foundation's contact deletion, which cascades to their leads and
  activities.
- **Marketing consent** is the email-marketing blueprint's, never a lead
  property.
- **Contracts and e-signature law** belong to the e-signature blueprint.
- **Phone and address formats** are stored as given; formatting rules are
  display only.
