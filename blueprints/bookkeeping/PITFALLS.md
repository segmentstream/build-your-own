# Bookkeeping: pitfalls

Mistakes already made building books on the platform, each with its symptom, its
cause and what to do instead.

## 1. Money stored as a number

- **Symptom**: a trial balance out by one cent; a yen invoice a hundred times too
  large.
- **Cause**: amounts in `p.number` or floats, or a fixed factor of 100 for every
  currency.
- **Instead**: integer minor units with each currency's ISO 4217 exponent, rates as
  decimal text, conversion in one tested function that rounds once.

## 2. A stored balance, total or "paid" status

- **Symptom**: an invoice shows paid after its payment was reversed; ageing and the
  control account disagree.
- **Cause**: a property that copies what the ledger already says, kept in step by
  some actions and forgotten by others.
- **Instead**: outstanding, paid and balances are `journal_line` metrics filtered to
  the document or account. Store only what a person decides: status `issued` or
  `voided`, never `paid`.

## 3. Month-end postings run by pipeline jobs

- **Symptom**: depreciation and revaluation post as the pipeline workers' service
  principal, which holds every ontology permission.
- **Cause**: scheduling record work in `pipeline/` because the job runner was at hand.
- **Instead**: a cron workflow in `ontology/workflows/` with a role that grants only
  the two posting actions it calls. Pipelines write warehouse tables, never records.

## 4. Generic reversal of a document's journal

- **Symptom**: an invoice still `issued` with nothing owed; the next receipt is
  refused as over-settlement or, worse, accepted against another invoice.
- **Cause**: `journal.reverse` called on an invoice's, bill's or disposal's journal.
- **Instead**: `journal.reverse` refuses owned journals and names the owner's action
  (`void`, `reverseDisposal`), which reverses and updates the owner in one transaction.

## 5. Balances computed by paging through lines

- **Symptom**: posting and reports are quick on the seed and time out after a year of
  real postings.
- **Cause**: an action or page reads journal lines page by page to add them up.
- **Instead**: `Entity.queryMetrics` inside the action, through an indexed key
  (`salesInvoiceId`, `ledgerAccountId`, `bookId`), and metric queries in pages. If a
  book grows to many millions of lines, read history from `account_balances_monthly`.

## 6. Racing payments and numbers

- **Symptom**: two payments both settle the last 200 of an invoice; two journals share
  a number.
- **Cause**: outstanding read, or `max(number) + 1` taken, without a lock held until
  the write.
- **Instead**: every posting locks the book row first; every action that writes lines
  naming a document locks the document; journal numbers come from the locked book and
  a unique index on book and number.

## 7. A rate guessed or fetched at posting time

- **Symptom**: foreign invoices posted at a rate of 1; the same call gives different
  amounts on retry; postings fail when the rates source is down.
- **Cause**: a default rate, or a connection call inside the posting action.
- **Instead**: rates are records the daily workflow or an accountant enters in
  advance; a posting without one is refused with the missing currency and date, and
  the bank's own conversion can be given explicitly.

## 8. Revaluing the control account instead of the documents

- **Symptom**: after month end, aged receivables no longer add up to the receivables
  account, by exactly the revaluation.
- **Cause**: one revaluation line per account and currency, naming no document.
- **Instead**: one control line per open foreign document, naming it, with a zero
  currency amount; money accounts are revalued per account. Never revalue fixed
  assets, prepayments, equity, revenue or expenses.

## 9. Opening balances counted twice

- **Symptom**: receivables are double what the previous system showed after the open
  invoices are imported.
- **Cause**: the opening journal carried the receivables total and the open invoices
  were recorded against revenue as well.
- **Instead**: record open documents against the opening balance clearing account,
  leave receivables and payables out of the opening journal, and check that the
  clearing account ends at zero.

## 10. An import that is not repeatable

- **Symptom**: a dropped connection mid-import leaves duplicates, or a rerun posts
  everything again.
- **Cause**: a script that writes without keys, writes to the database directly, or
  keeps going after the live books drifted from its plan.
- **Instead**: plan, dry run, apply, validate. Every call carries a key derived from
  the source record; progress is saved after each call; an uncertain write is read
  back by its key before a retry; the export stays outside the repository.

## 11. The agent works around a refusal

- **Symptom**: the agent moves a date past the lock date, posts a balancing line to
  "suspense", or splits a payment to get under the outstanding amount.
- **Cause**: instructions that say what to post but not that refusals are real
  problems, or a rule kept only in the instructions instead of the action.
- **Instead**: every rule lives in an action and its rejection message; the
  instructions say to report a refusal plainly, never to post plug entries, and to
  leave a figure unknown rather than zero when a read or rate fails.

## 12. An owner's answer treated as an approval

- **Symptom**: the agent posts or accepts evidence because the owner wrote "that's
  fine" in chat.
- **Cause**: answers and decisions share one action, or the agent's role can approve.
- **Instead**: `recordAnswer` writes only the question; an accountant acts through the
  normal actions and closes the question with what was done. A stored question is not
  permission to message anyone either.

## 13. Finance readable by every member

- **Symptom**: a new sales hire sees salaries, margins and the bank balance in the app
  and through the agent.
- **Cause**: `member` kept the default `*:read`, which covers every business entity,
  restricted documents included.
- **Instead**: list `member`'s reads by name, give finance reads through finance
  roles, put sensitive files in Drive's confidential class or a `restricted_document`
  entity with a named permission, and grant warehouse access only to people who may
  read every finance record. Never copy a restricted file's contents into a title, a
  description or a question: every field reaches the warehouse.

## 14. Month ends computed in UTC

- **Symptom**: depreciation for the wrong month on the 1st; an invoice dated the day
  before it was issued.
- **Cause**: dates derived from UTC timestamps, while cron runs in UTC and people work
  in their own zone.
- **Instead**: store dates as `p.date`; work out "today" and "last month" in a
  workflow step from the book's `timeZone`.

## 15. Fresh postings missing from reports

- **Symptom**: the accountant posts a correction and the trial balance page still
  shows the old figure.
- **Cause**: the page reads a metric query over the warehouse replica, which trails
  writes by minutes.
- **Instead**: close checks and report pages use the read-only actions, which compute
  fresh in the database; dashboards may use the replica and say when it was read.

## 16. The seller's identity copied into the book

- **Symptom**: the company's new registered address is on its page, but new invoices
  print the old one; or two books of one company print different legal names.
- **Cause**: the legal name, address and tax id kept as settings on the book (or in
  configuration code) as well as on the company, and only one copy was updated.
- **Instead**: the book relates to one own company and keeps only accounting
  settings. Issuing reads the seller through `book.company`. Only the issued invoice
  keeps a copy, as the snapshot of what it printed.

## 17. An issued invoice's seller edited or re-read

- **Symptom**: after the company moves office, reprinting last year's invoice shows
  the new address, which is not what the customer holds; or someone "fixes" a legal
  name on an issued invoice.
- **Cause**: the print view of an issued invoice reads the live company, or an action
  lets the seller copy change after issue.
- **Instead**: print an issued invoice from its own `seller*` and `billTo*` copies,
  which no action changes after issue. A wrong issued invoice is corrected by a credit
  note and a new invoice.

## 18. A book opened for a customer

- **Symptom**: a book appears for a supplier or a customer, or a company is unmarked
  as own while its books are still kept.
- **Cause**: `book.open` took any company, or `isOwn` was a generated, editable flag.
- **Instead**: `book.open` refuses a company that is not own or already has a book;
  `isOwn` is managed and set only by the foundation's `company.setOwn`, held by
  `admin`, which refuses to clear it on a company that has a book.
