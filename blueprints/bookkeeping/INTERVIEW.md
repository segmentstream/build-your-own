# Bookkeeping: interview

Ask these in one message, in plain words, with the default for each. Skip what the
person already said. Never ask for bank credentials, passwords or real records in
chat; real records arrive through the app and connections after deploy. Say once, at
the start, that this builds bookkeeping software, not tax or accounting advice, and
that their accountant should review the setup before they rely on it.

## 1. Which companies keep books here, and in which currency?

- **Why**: each legal entity is one book with one base currency and its own numbering.
  The base currency cannot change once anything is posted.
- **Changes**: one `book` record per entity, its `baseCurrency`, `timeZone` and invoice
  prefixes. Several books add a book filter to every page and report.
- **Default**: one book in the currency of the country where the company is
  registered, in that country's time zone.

## 2. When does your financial year start?

- **Why**: profit and loss restarts at zero on that day, and earlier results become
  retained earnings.
- **Changes**: `fiscalYearStartMonth` on the book; the default period of every report.
- **Default**: January.

## 3. Are you moving from another accounting system, and from which date?

- **Why**: the conversion date decides what is imported and which periods are locked.
- **Changes**: *opening balances only* adds an opening journal and the open invoices
  and bills one by one; *full history* imports every month's journals through the
  same actions; both add the migration check against the previous system. With a
  read-only connection the check reads that system directly; otherwise it reads the
  previous system's export from a Google Sheet the person fills.
- **Default**: opening balances at the last month end the previous system closed,
  with open invoices and bills recorded individually. History stays in the old
  system for reference.

## 4. Which chart of accounts should we start from?

- **Why**: every posting and report uses it, and accountants often have a standard
  one for the country or industry.
- **Changes**: the chart imported with `ledger_account.importChart`: the previous
  system's chart, the accountant's file, or the neutral starter chart in
  VARIATIONS.md.
- **Default**: the previous system's chart when migrating, otherwise the starter
  chart, reviewed by the accountant before the first posting.

## 5. Do you charge or pay sales tax, VAT or GST?

- **Why**: tax on invoice and bill lines posts to tax accounts, and amounts must match
  what the documents print.
- **Changes**: *no* builds no tax rates and hides tax columns; *yes* adds `tax_rate`
  records with their percent and account. Tax returns, reverse charge and
  tax-inclusive prices are variations, built only if asked.
- **Default**: tax rates on lines, with the rates and accounts the accountant gives;
  returns are prepared outside this app.

## 6. Do you invoice, pay or hold money in other currencies?

- **Why**: foreign postings need a recorded rate for their date, and foreign balances
  are revalued at month end.
- **Changes**: which currencies `recordDailyRates` records, and whether the
  `exchangeRates` connection and month-end revaluation are built at all.
- **Default**: rates from a public central-bank style source for the currencies you
  use, recorded daily, and revaluation of foreign money and open foreign documents at
  every month end.

## 7. Who does what: bookkeeping, approving bills, closing months?

- **Why**: roles decide who may draft, who may post or approve, and who may close or
  reopen a period.
- **Changes**: which members get `bookkeeper`, `accountant`, `financeOwner` and
  `financeAdmin`; whether an outside accountant is invited; whether bills need a
  second approver (a variation).
- **Default**: the owner is `financeOwner` and `financeAdmin`; the person who does
  the books is `bookkeeper`; the outside accountant is `accountant`. One approver.

## 8. How do people spend company money, and how do receipts reach you?

- **Why**: this decides the payment accounts (cards, cash) and whether people pay
  for things themselves and are paid back.
- **Changes**: `card` and `cash` accounts, the `owedToPeople` account, and whether
  any member may record their own expenses. With the company-agent blueprint,
  receipts sent in chat become expenses.
- **Default**: company bank and card accounts, plus reimbursement of people who paid
  personally; every member may record their own expenses as drafts.

## 9. What counts as enough evidence for a payment?

- **Why**: an expense or payment without its receipt or invoice is a gap your
  accountant or a tax inspector will ask about.
- **Changes**: the rule behind `evidenceStatus`, which accounts are `statement`
  accounts, and who may accept incomplete evidence.
- **Default**: an invoice, receipt or contract makes evidence complete; bank fees,
  tax payments, loans and transfers between own accounts need only the statement;
  an accountant may accept a gap with a written reason.

## 10. Do you own equipment or other assets you depreciate?

- **Why**: assets are depreciated monthly by a workflow, by the policy you set.
- **Changes**: `fixed_asset` records, their accounts, method and life, and the
  `monthEndClose` workflow.
- **Default**: straight line over a useful life the accountant gives per kind of
  asset, starting the month of purchase, no depreciation in the month of disposal.

## 11. Which documents are sensitive, and who may see them?

- **Why**: payslips, identity papers and medical receipts must not be visible to
  everyone who can see the books.
- **Changes**: a confidential class in Drive, or without Drive a `restricted_document`
  entity, who may read it, and its exclusion from warehouse replication.
- **Default**: no restricted documents until one is needed; then only the finance
  owner reads them.

## 12. How should the workspace agent help each day?

- **Why**: a daily digest and questions to the owner save the most time, but every
  message goes to a person.
- **Changes**: whether `bookkeepingDigest` is built, which chat it posts to and when,
  and whom questions are usually for.
- **Default**: a weekday morning digest in the finance chat; questions are stored and
  sent only when a member asks the agent to send them.

## Decisions that need a person every time

Whatever the answers, these never run without a person's explicit decision at the
time, and no workflow or agent task role is granted them:

- issuing an invoice, and sending anything to a customer or supplier;
- approving a bill or an expense, and accepting incomplete evidence;
- posting a manual journal or a payment, reversing a journal, voiding a document;
- closing a period, and above all reopening one;
- deleting or discarding anything, and the apply step of an import;
- changing a book's settings, the chart of accounts or a tax rate.
