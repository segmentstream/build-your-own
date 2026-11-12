# CRM

Leads, deals and customers on your own company records, with the pipeline,
stages and rules your team actually uses. It replaces HubSpot, Salesforce and
similar sales CRMs.

## What you get

- Every form submission becomes one lead, exactly once, however often the
  website retries. The person and their company are found or created for you.
- New leads reach the right owner by your routing rules, and the team chat
  hears about each one once, with a link to it.
- Triage in a few clicks: take a lead, qualify it into a deal, or disqualify it
  with a reason you can report on later.
- Deal pipelines with your own stages and entry rules. Won and lost are final,
  each with a date and a reason, so your numbers do not drift.
- Amounts always carry their currency. Pipeline, win rate and revenue reports
  never add euros to dollars.
- Customers are worked out from won deals, never typed in, so the list is
  always right.
- Ask the company agent "what is stuck in proposal?" or "log my call with
  Northwind" from your team chat, with your own permissions.

## Build it

```text
Read https://github.com/segmentstream/build-your-own/blob/main/AGENTS.md and follow it.
Build our CRM from the crm blueprint.
```

## How it fits

- **foundation** (required): the CRM builds on its companies, contacts and
  members, and never creates a second copy of them.
- **company-agent**: the team chat for lead and deal announcements, and the
  agent that answers pipeline questions and logs activities.
- **marketing-analytics**: joins each lead to the website session and campaign
  that brought it, by the lead's submission id.
- **email-marketing**: audiences built from leads, deals and customers; consent
  stays there.
- **e-signature**: send the contract for a deal and see it signed on the deal.

## What it is not

- Not a marketing automation suite: no email sequences, scoring models or
  landing pages in the first version. They are variations or other blueprints.
- Not billing: subscriptions, invoices and renewals of existing customers
  belong to bookkeeping. The CRM ends when a deal is won.
- Not a two-way sync with another CRM. It can import your history once; after
  that it is the system of record.

## Authors

- [SegmentStream](https://github.com/segmentstream)
