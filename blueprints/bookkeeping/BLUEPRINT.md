# Bookkeeping: design

## 1. Purpose

Keep a company's books: one general ledger per legal entity, fed by sales invoices,
supplier bills, expenses, payments, fixed assets and month-end revaluation, and read
as a trial balance, general ledger, profit and loss, balance sheet and aged
receivables and payables. Every posting is the same kind of record, a balanced
journal, whatever produced it, so the reports cannot disagree with each other.

This is bookkeeping software, not tax or accounting advice. The build ends with a
qualified accountant reviewing the setup (see Build order).

## 2. Records (ontology)

Conventions for every entity below:

- **Money is integer minor units** (`p.integer`) of a named currency, as the
  foundation stores it: cents, pence, yen, with the currency as its lowercase ISO
  4217 code (`eur`). Use the ISO 4217 exponent of each currency (0 for JPY, 2 for
  most, 3 for KWD), never `p.number` and never a float. Ledger amounts are
  signed: debit positive, credit negative.
- **Every entity declares `writes: "actions"`.** There are no generated writes:
  money, numbering and lifecycles have rules, and only the actions below enforce them.
- **Every finance record belongs to one book** through `book: rel.one(Book)`, except
  currency rates (shared by books with the same base currency) and documents.
- **Outstanding amounts, balances and "paid" are never stored.** They are the
  `journal_line` metrics, filtered to a document, an account or a period.
- Dates are `p.date`. Customers and suppliers are the foundation's `Company`, billing
  people `Contact`, and people who act are members (`User`).

### Book

One legal entity's books, set by people through actions: `code` (unique, such as
`main`), `name`, `baseCurrency` (ISO 4217 code of every `amountMinor`; fixed once a
journal is posted), `fiscalYearStartMonth` (1–12; revenue and expense restart at zero
on its first day), `timeZone` (IANA zone that decides "today" and month ends; workflows
run in UTC), `lockDate` (managed: the last closed day), `lockChangeReason` (managed),
`nextJournalNumber`, `invoicePrefix` and `creditNotePrefix` (such as `INV-`, `CN-`),
`nextInvoiceNumber` and `nextCreditNoteNumber` (managed), `issuerName`,
`issuerAddress`, `issuerTaxId`, `issuerRegistration` (the legal entity as printed on
its invoices) and `rateLookbackDays` (default 7: how far back a posting may take the
latest earlier rate).

### LedgerAccount

One account of a book's chart. The default starter chart is under "Chart of accounts"
in VARIATIONS.md.

| Property | Type | Meaning |
| --- | --- | --- |
| `code` | text | Unique within the book (compound unique index on book and code). |
| `name` | text | |
| `accountClass` | select | `asset`, `liability`, `equity`, `revenue`, `expense`. Fixed once posted lines exist. |
| `accountType` | select | Report grouping: `bank`, `cash`, `card`, `receivable`, `payable`, `currentAsset`, `fixedAsset`, `accumulatedDepreciation`, `currentLiability`, `nonCurrentLiability`, `tax`, `equity`, `revenue`, `otherIncome`, `costOfSales`, `expense`, `otherExpense`. |
| `currency` | text, optional | Set only on an account that holds money in a currency other than the base (a foreign bank, card or loan). Empty means base currency. |
| `systemRole` | select, optional | The account postings use automatically: `receivables`, `payables`, `owedToPeople`, `retainedEarnings`, `realisedFx`, `unrealisedFx`, `rounding`, `assetDisposal`, `openingBalance`. At most one active account per role per book. |
| `evidencePolicy` | select | `document` (each posting needs its source document) or `statement` (a bank or authority statement is enough: bank fees, tax payments, loans, transfers between own accounts). |
| `status` | select | `active` or `archived`. Nothing posts to an archived account. |

### TaxRate and CurrencyRate

A tax rate is what document lines carry: `name`, `percent` (decimal text, such as
`"20"`), `account` (the ledger account its tax posts to), `appliesTo` (`sales`,
`purchases`, `both`), `status`. The percent is fixed once a posted line uses the rate;
a new percent is a new rate. Tax returns and treatments are a variation.

A currency rate is the rate the books use for a day, not a market feed:
`baseCurrency`, `currency`, `date`, `rate` (decimal text: units of `currency` per one
unit of `baseCurrency`), `source` (`published` or `manual`), `note`. Unique on base,
currency and date. Recorded by the daily rates workflow or an accountant. It is a
stored record, not a warehouse table, because postings read it inside their
transaction and its history must show who set which rate.

### Journal

A dated, balanced set of lines; the only kind of posting. `number` (managed, given at
posting, consecutive and unique within the book; drafts have none), `date`, `status`
(`draft`, in no report, or `posted`, never changing again), `kind` (for lists only:
`manual`, `salesInvoice`, `salesCredit`, `bill`, `supplierCredit`, `expense`,
`payment`, `allocation`, `depreciation`, `disposal`, `revaluation`, `opening`,
`reversal`; no report depends on it), `reference` (narration), `sourceRef` (free text
such as the previous system's number; nothing reads it), `key` (idempotency, unique
within the book), `postedAt`, `postedBy` (User), `evidenceWaiver` (why it needs no
document, as a person decided). Relationships: `counterparty` (Company), `reversalOf`
(Journal, inverse `reversals`).

### JournalLine

One line: an account and a signed base-currency amount. Posted lines make every report.

| Property | Type | Meaning |
| --- | --- | --- |
| `book`, `date`, `posted` | managed | Copies of the journal's, so metric filters and indexes read the line alone. |
| `position` | integer | Order in the journal. |
| `amountMinor` | integer | Base currency, debit positive. |
| `currency`, `currencyAmountMinor` | text, integer, optional | The transaction currency and the same amount in it, same sign. Always set on a line that names a document (in the document's currency) or posts to an account with a `currency`. |
| `taxAmountMinor` | integer, optional | Base-currency tax belonging to this net line, with its `taxRate`, for tax reporting. |
| `description` | text, optional | |

Relationships, all `rel.one`, optional unless stated: `journal` (required, inverse
`lines`), `ledgerAccount` (required), `taxRate`, `counterparty` (Company),
`salesInvoice`, `bill`, `expense` (control lines that recognise or settle that
document), `fixedAsset` (cost, depreciation and disposal lines), `owedTo` (User, on
lines of the `owedToPeople` account).

Metrics (all filtered to `posted = true`, `unit: "number"`, minor units):
`balance` (sum of `amountMinor`), `debits`, `credits`, `currencyBalance` (sum of
`currencyAmountMinor`, always grouped or filtered by currency), `taxAmount`,
`lines` (count). Indexes: book, account and date; book and date; journal and position.

### SalesInvoice and SalesInvoiceLine

A customer invoice or credit note: `kind` (`invoice`, `creditNote`), `origin`
(`issuedHere`, numbered by the book, or `recordedFromElsewhere`, issued by a shop, a
payment provider or the previous system under its own number), `status` (managed:
`draft`, `issued`, `voided`, `discarded`; paid is a metric, not a status), `number`
(managed, set at issue, never reused), `date`, `dueDate`, `currency`, `subtotalMinor`,
`taxMinor`, `totalMinor` (managed, fixed at issue), `billToName`, `billToAddress`,
`billToTaxId` (copied from the Company at issue, so a later rename never changes an
issued invoice), `reference` (the customer's order number), `notes` (printed terms),
`key` (unique). Relationships: `customer` (Company), `billingContact` (Contact),
`paymentInstruction`, `credits` (the invoice a credit note corrects), `recognition`
(Journal). Lines: `lineNo`, `description`, `quantity` (decimal text),
`unitPriceMinor`, `netMinor`, `taxRate`, `taxMinor`, `account` (revenue).

### Bill and BillLine

A supplier invoice or supplier credit note: `kind`, `status` (`draft`, `approved`,
`voided`, `discarded`), `supplier` (Company), `supplierName` (as printed), `number`
(the supplier's), `date`, `dueDate`, `currency`, totals, `recognition`, `key`,
`evidenceStatus` (managed: `complete`, `missing`, `accepted`). Lines: `lineNo`,
`description`, `netMinor`, `taxRate`, `taxMinor`, `account`, `fixedAsset` (optional,
for an asset bought on the bill). A supplier's number is entered once per book.

### Expense

Spend recorded from a receipt rather than a supplier bill: a card purchase, a cash
payment or something a person paid for themselves. `date`, `description`, `payeeName` (as on the receipt), `currency`, `grossMinor`,
`taxMinor`, `account` and `taxRate` (one account per expense: a receipt with several
kinds of spend is several expenses linked to one document), `paidBy` (`company`, from
`paymentAccount`, a bank, card or cash account; or `person`, owed back to
`paidByMember`), `paidAmountMinor` (what the payment account was charged, in its
currency, when that differs from the receipt's), `status` (managed: `draft`,
`approved`, `voided`), `evidenceStatus` (managed: `complete`, `partial`, `missing`,
`accepted`, `notRequired`; recomputed by the actions that change its inputs, never set
by callers), `evidenceGaps` (managed, in words), `evidenceAcceptedBy` and
`evidenceAcceptanceReason` (a person's decision that incomplete evidence is enough),
`supplier` (Company, optional), `recognition` (Journal).

Evidence status, by default: `complete` when an invoice, receipt or contract is
linked; `partial` when only weaker evidence is (a payment proof, a statement extract,
a screenshot); `missing` when nothing is; `accepted` when a permitted person accepted
the gap with a reason; `notRequired` when the expense posts only to `statement`
accounts. Stricter policies are a variation.

### FixedAsset

An asset of a book and its depreciation policy: `name`, `number`, `status`
(`registered`, `disposed`), `costAccount`, `accumulatedDepreciationAccount`,
`depreciationExpenseAccount`, `acquiredOn`, `costMinor` (base currency),
`residualMinor`, `method` (`straightLine`, `decliningBalance`, `none`),
`usefulLifeMonths` or `annualRatePercent`, `depreciationStartsOn`, `openingDate` and
`openingAccumulatedMinor` (for an asset carried over from another system),
`disposedOn`, `disposal` (Journal). Its cost, depreciation and disposal are ordinary
journal lines naming it; accumulated depreciation is the opening amount plus those
lines.

### PaymentInstruction

How customers pay: `name`, `currency`, `printedText` (bank details exactly as printed
on invoices), `status` (`active`, `retired`). Details missing from the source stay
empty; nobody invents them.

### Document and DocumentLink

When the drive blueprint is built, evidence files are its `document` records.
Without it, build a minimal `document` (title, `kind`, `file` as `p.blob`,
`receivedOn`, `counterparty`, a managed SHA-256 for deduplication) that Drive later
extends under the same name; never a second file table. `kind` is `invoice`,
`receipt`, `contract`, `paymentProof`, `statement` or `other`; classifying a file is
not accepting it.

`document_link` joins one document to one record it evidences: a journal, sales
invoice, bill, expense, fixed asset or finance question. One file may evidence
several records, and a record may have several files.

Sensitive files (identity papers, payslips, medical receipts) go to a confidential
class with Drive; without it, to a separate `restricted_document` entity with its own
read permission, excluded from warehouse replication before its first deploy (a
workspace setting, not code; the foundation describes the steps). Their
contents are never copied into descriptions, notes or questions.

### FinanceQuestion

A question only a person outside the books can answer, such as "what was this card
payment for?". The company-agent blueprint's `question` lifecycle, in an entity of its
own so only finance roles read it: `key` (unique), `text`, `context`, `status`
(`open`, `asked`, `answered`, `resolved`, `dropped`), `batch` and `order` (a queue
put to one person one question at a time), `answer` (verbatim), `askedAt`,
`answeredAt`, `resolution`; `addressee` and `raisedBy` (User); optional subject
`journal`, `expense`, `bill` or `salesInvoice`. An answer is evidence, not authority:
recording it changes no ledger record.

## 3. Actions

### The posting path

Every action that posts calls one internal function, `recordJournal`. Its checks are
the only rules a posting must pass, and they are the same for every caller:

1. Two to 200 lines, not all zero, summing to exactly zero in base currency.
2. `currency` and `currencyAmountMinor` given together, with the same sign as the base
   amount (a zero currency amount is allowed for revaluation lines). A line on an
   account with a `currency` is in that currency. A line naming a document carries
   the document's currency.
3. Lock the book row (`forUpdate`). The date is after the lock date.
4. A repeated `key` returns the journal it posted when the date, accounts and amounts
   match, and is refused otherwise.
5. Every account belongs to the book and is active. Every linked document, asset and
   tax rate belongs to the book.
6. Each document a line names is locked. Apart from its own recognition, lines may
   settle it only when it is issued or approved, never beyond its outstanding amount
   or in the wrong direction (a fresh `JournalLine.queryMetrics` over the lines
   naming it, inside the transaction).
7. Take `nextJournalNumber`, create the journal and its lines with `createMany`.

Foreign amounts convert at the `currency_rate` of the date, or the latest earlier one
within `rateLookbackDays`. Without one the posting is refused and names the missing
rate. Conversion rounds half away from zero using both currencies' exponents. When a
document's lines convert separately, their base amounts are allocated so they sum
exactly to the converted total.

### Book and chart

| Action | Who | Checks and effect |
| --- | --- | --- |
| `book.open` | finance owner | Creates a book with its settings and numbering. |
| `book.configure` | finance owner | Changes settings. Refuses a new base currency once a journal is posted, and a `nextJournalNumber` already used. |
| `book.closeThrough` | finance owner | Moves the lock date forward only. |
| `book.reopenTo` | finance admin | Moves the lock date earlier; a reason is required and kept in history. |
| `book.trialBalance` | readers | Read-only: `hints: { readOnly: true }`, `connections: []`, a `prepare` computing with `JournalLine.queryMetrics`, no handler. For every account: opening at `from` (default the fiscal year start), movement, closing at `date`; revenue and expense accounts open each year at zero, earlier results are `retainedEarnings`; `outOfBalance` must be zero. |
| `book.ageing` | readers | Read-only. Receivables or payables at a date: outstanding per document (document and base currency) by due-date bucket (current, 1–30, 31–60, 61–90, over 90), plus control-account money no document names, per counterparty, as `unallocated`. |
| `book.revalue` | accountant, month-end workflow | Month-end revaluation, below. Key `revaluation:<date>`. |
| `book.missingEvidence` | readers | Read-only, one page at a time: expenses and bills whose evidence is not complete or accepted, and posted manual or payment journals on `document` accounts with no linked file and no waiver. |
| `ledger_account.add`, `update`, `archive`, `restore` | accountant | Class and currency cannot change once posted lines exist. |
| `ledger_account.setSystemRole`, `setEvidencePolicy` | accountant | One active account per role per book. |
| `ledger_account.importChart` | finance owner | Up to 200 accounts per call, upserted by book and code. |
| `ledger_account.ledger` | readers | Read-only. One account's posted lines in a period with opening and running balance, 200 per page. |
| `tax_rate.add`, `update`, `archive` | accountant | Percent is fixed once used. |
| `currency_rate.record` | accountant, rates workflow | Up to 200 rates per call, keyed by base, currency and date; an equal rate is unchanged, a different one replaces it and history keeps the old. Posted journals keep their amounts. |

### Journals, payments and allocations

| Action | Who | Checks and effect |
| --- | --- | --- |
| `journal.post` | accountant | A complete manual journal in one call, through the posting path. |
| `journal.saveDraft`, `postDraft`, `deleteDraft` | bookkeeper saves, accountant posts | Drafts have no number and appear in no metric. Only drafts can be deleted. |
| `journal.reverse` | accountant | Posts the exact opposite, once, dated on or after the original and after the lock date. Refuses a reversal, and refuses a journal a document or asset owns (recognition, disposal), naming the owner's action instead. |
| `journal.recordPayment` | bookkeeper | Money in or out of one bank, cash or card account: `amountMinor` in that account's currency, optional `baseAmountMinor` (the bank's own conversion), `settles` (documents with amounts in their own currency), `otherLines` (fees, coded directly), and an optional remainder left on the counterparty's account. One journal of kind `payment`; settling a foreign document relieves its base carrying amount in proportion and posts the difference to `realisedFx`. A document in another currency than the money account must be the only one settled. Key required. Reversing it reopens what it settled, since outstanding amounts are computed. |
| `journal.allocate` | bookkeeper | Settles documents against each other without money: a credit note, or a counterparty's unallocated money, against invoices or bills of the same currency. Key required. |
| `journal.waiveEvidence`, `requireEvidence` | accountant | Records or clears why one posted journal needs no document. |
| `journal.inspect` | readers | Read-only: one journal with its lines. |

### Sales invoices

| Action | Who | Checks and effect |
| --- | --- | --- |
| `sales_invoice.draft`, `updateDraft` | bookkeeper | Customer, currency, date, due days, lines; tax computed per line from its rate. Repeated `key` returns the draft. |
| `sales_invoice.issue` | bookkeeper, members only | Refuses a service principal. Locks the book, takes the series' next number, copies the bill-to details, posts the recognition journal (revenue and tax against `receivables`, the control line naming the invoice) on the invoice date. Sends nothing. |
| `sales_invoice.record` | bookkeeper | A document already issued elsewhere under its own number: posts its recognition at once. A repeated key, or the same number in the book, returns the existing one. |
| `sales_invoice.void` | accountant | Only when nothing settles it. Reverses the recognition on a date after the lock date and sets `voided` in one transaction. The number stays used. |
| `sales_invoice.discardDraft` | bookkeeper | Drafts only; no number was used. |

A credit note is drafted with `kind: creditNote` and optionally `credits`, issued in
its own series, then allocated to the invoice or refunded with `recordPayment`.

### Bills, expenses, assets and questions

| Action | Who | Checks and effect |
| --- | --- | --- |
| `bill.enter` | bookkeeper | Draft with coded lines; optional `document` to link; refuses a supplier number already entered in the book. A line may stay uncoded in a draft. |
| `bill.approve` | accountant | Every line coded; lines add up to the total; posts the recognition (expenses and tax against `payables`) on the bill date. |
| `bill.void` | accountant | Only when nothing settles it; reverses the recognition. |
| `bill.discard` | bookkeeper | Drafts only. |
| `expense.record` | bookkeeper, any member for their own | Draft from a receipt; links the document; computes evidence status. |
| `expense.approve` | accountant | Posts: expense and recoverable tax against the payment account (company) or against `owedToPeople` naming the expense and `owedTo` the member (person). Repaid later with `recordPayment` settling the expense. |
| `expense.void` | accountant | Only when nothing repaid it; reverses the recognition. |
| `expense.acceptEvidence`, `withdrawAcceptance` | accountant | Members only, with a reason; recomputes evidence status. |
| `document_link.attach`, `detach` | bookkeeper | Links or unlinks a file and a record of the same book; recomputes the record's evidence status. With Drive these are Drive's own `attach` and `detach`, extended with the book check and the recomputation. |
| `fixed_asset.register` | accountant | Records the asset and policy. Posts nothing: its cost is posted by the bill or journal line that names it. |
| `fixed_asset.postDepreciation` | accountant, month-end workflow | One journal for a book and month, dated the month end, key `depreciation:<month>`. Refuses a month that has not ended in the book's time zone or is inside the lock date. Straight line follows a schedule: accumulated after n months is round((cost − residual) × n / life), and each month charges what brings the asset to it, so a missed month catches up. Declining balance charges net book value × rate / 12. Never below residual. Skips, and lists, an asset whose cost is not yet in the ledger. Up to 99 assets per journal. |
| `fixed_asset.dispose` | accountant | Requires depreciation through the month before disposal. Posts the disposal: removes cost and accumulated depreciation, books proceeds to the given account and the difference to `assetDisposal`. Sets `disposed`. |
| `fixed_asset.reverseDisposal` | accountant | Reverses the disposal journal and returns the asset to `registered`. |
| `finance_question.raise` | bookkeeper, digest workflow | Keyed; a repeat returns the existing question. Stores it and contacts nobody. |
| `finance_question.markAsked`, `recordAnswer` | bookkeeper | After the message was sent; the answer verbatim with optional documents. Writes only the question and its links. |
| `finance_question.resolve`, `drop`, `reopen` | accountant | Resolve names what was done through the normal actions, or that nothing was needed. |
| `payment_instruction.register`, `retire` | finance owner | Retired instructions stay on issued invoices. |

### Month-end revaluation

`book.revalue` revalues what is monetary and foreign at a date: every active account
with a `currency` (its carrying `balance` against `currencyBalance` at the date's
rate), and every open foreign document (a control line naming the document, currency
amount zero, base difference). Differences post to `unrealisedFx`. It is cumulative:
each run brings the carrying amount to the current rate, so a missed or stale month is
corrected by the next. Fixed assets, prepayments, equity, revenue and expenses are
never revalued. A missing rate refuses the run and names it.

### Descriptions and hints

Every action states its rules in its description and names the failed rule and how
to succeed in each rejection. Declare `writes` on each action and `hints` on all:
posting, issuing and voiding are `irreversible: true`; discarding drafts and
reopening periods are `destructive: true`; reads are `readOnly: true`.

## 4. Roles

Roles are named for jobs. The foundation's single `finance` job is split in four here;
a company that wants one role gives `finance` the `accountant` permissions. Finance
records are confidential, so `member` must not keep the default `*:read`: list the
non-finance entities members read by name.

| Role | Holder | Permissions |
| --- | --- | --- |
| `financeViewer` | Managers, investors' accountants | `read` on every finance entity except `restricted_document`; the read-only report actions. |
| `bookkeeper` | Whoever does the day-to-day | Viewer, plus drafting and issuing invoices, entering bills, recording expenses, payments and allocations, saving journal drafts, attaching documents, asking and answering questions. |
| `accountant` | Internal or outside accountant | Bookkeeper, plus posting and reversing journals, approving and voiding, fixed assets, revaluation, rates, the chart, tax rates, accepting evidence, waivers, closing questions. |
| `financeOwner` | Owner or finance lead | Accountant, plus books, payment instructions, closing periods and `restricted_document:read`. |
| `financeAdmin` | One or two people | `book:reopenTo` only, granted alongside another finance role. |
| `ratesFeed` | `recordDailyRates` workflow | `currency_rate:record`, `currency_rate:read`, `book:read`. |
| `monthEnd` | `monthEndClose` workflow | `fixed_asset:postDepreciation`, `book:revalue`, `book:read`. |
| `financeDigest` | `bookkeepingDigest` workflow | Finance reads, the read-only report actions, `finance_question:raise` and `markAsked`, the company agent's `routine_run` actions, `agent_chat:read` (to find the chat by purpose) and `agent_chat:post_message`. |

No workflow, agent task or API key role holds issue, void, reverse, approve, post,
close, reopen, accept evidence, waive or restricted reads, or `*:*`. Pipeline workers
have full ontology permissions, which is why nothing in the pipeline posts.

## 5. Workflows

- **`recordDailyRates`**, cron daily at a quiet hour (`40 4 * * *`). One step per
  base currency reads the last few days from the public rates source through the
  `exchangeRates` connection and records every published currency with
  `currency_rate.record`, deriving cross rates through the source's own base (noted
  on the rate). Keyed by base, currency and date, so overlapping runs change nothing.
- **`monthEndClose`**, cron on the 1st to 7th (`15 5 1-7 * *`). For each book, a step
  works out the previous month in the book's time zone and calls
  `fixed_asset.postDepreciation`, then `book.revalue`. Both are keyed, so later runs
  return the journals already posted. A refusal (a closed period, a missing rate)
  fails only that book's step. It never moves the lock date: closing is a person's job.
- **`bookkeepingDigest`**, weekdays, as a routine of the company-agent blueprint: an
  `agentTask` with the `financeDigest` role summarises drafts waiting, overdue
  invoices, missing evidence and open questions; a later step posts it to the chat
  whose purpose is `finance`. It changes no books.

Every step tolerates a repeat: steps call keyed actions or check before they write.

## 6. Data flow (pipeline)

The books are ontology records; reports read them fresh through the read-only
actions, or through metric queries over the replicated `journal_line`. Work whose
output is records (daily rates, depreciation, revaluation) is a workflow (section 5);
work whose output is warehouse tables is a pipeline job. The pipeline adds two
things, neither of which writes records:

- **`gold/account_balances_monthly`** (model): movement and cumulative closing per
  book, account and month (the key), from the replicated `ontology.journal_line`,
  posted lines only. Unpartitioned, replaced whole; for multi-year comparisons,
  dashboards and exports. Job `ledger_reporting`, daily.
- **Migration check**, while moving from another system:
  `bronze/previous_trial_balances` (ingestion), the previous system's closing balance
  per book, month end and account code, with two adapters writing the same table:
  `sample` (invented balances matching the demo seed) and `real` (a read-only
  connection such as `xero`, or the previous system's export put in a Google Sheet
  and read through a `GoogleSheetsConnection`; the warehouse takes no file uploads
  and the repository never holds the export).
  `gold/trial_balance_vs_previous` (model) lists every difference from
  `account_balances_monthly` at each month end. Job `migration_check`, run by hand.
  Check: no difference without a written reason.

Demos use a seed script that calls the same actions as people with invented records:
Northwind as the book, a few customers and suppliers, rates, invoices, a bill,
receipts and an asset.

## 7. Screens (app)

Every page reads a `find` page, a read-only action or one metric query, filtered by
book. Add `page.navigation.json` beside each page so the agent can link to it.

- **Finance home**: per book the lock date, drafts waiting for issue or approval,
  overdue receivables, records missing evidence and open questions.
- **Journals**: list by status, kind, date and number; detail with lines, files,
  history and reverse; a new-journal form that posts only when the difference is zero.
- **Sales invoices**: list with each listed invoice's outstanding amount (one metric
  query filtered to the page's ids); detail with lines, postings and payments; issue,
  void, discard, credit note, record payment; a print view of an issued invoice.
- **Bills** and **expenses**: lists (expenses with evidence badges), details with the
  files, evidence status and gaps; forms with the file beside the lines.
- **Payments**: record a payment against documents; allocate credits or unallocated money.
- **Fixed assets**: register, schedule, postings, dispose, post a month.
- **Reports**: trial balance, general ledger, profit and loss with a comparative
  period, balance sheet, aged receivables and payables; each exports CSV.
- **Questions**: the queue by batch and order. **Settings**: books, chart, tax rates,
  currency rates, payment instructions, close and reopen periods.

## 8. The company agent

Members can ask the workspace agent, which acts as them:

- "What is overdue, and from whom?" (`book.ageing`); "profit and loss for last
  quarter against the one before" (`book.trialBalance` twice); "the ledger for
  software since January" (`ledger_account.ledger`).
- "File this receipt; I paid it myself." (stores the file, `expense.record`)
- "Enter this supplier invoice as a draft." (`bill.enter`); "draft an invoice for Ada
  Example's company: 10 hours at 100" (`sales_invoice.draft`).
- "Which expenses are missing receipts?" (`book.missingEvidence`)
- "Ask Grace Sample what the card payment of 120 on the 3rd was for."
  (`finance_question.raise`, then a chat message the requester confirms)

Issuing, approving, posting, voiding, reversing, recording payments and closing
periods run only on a permitted member's explicit request, with the confirmation
card. The agent's instructions and the descriptions of `journal` and the posting
actions say (the agent reads descriptions, not entity guides): state
the book, period and currency; convert minor units once; a failed read or a missing
rate leaves a figure unknown, never zero; a refused posting is a real problem, reported
and never worked around; never post plug entries; an owner's answer is recorded on
the question and is not permission to post.

## 9. Build order

1. Build the foundation. Check: a Company and a Contact exist.
2. `Book`, `LedgerAccount`, `Journal`, `JournalLine` and the posting path, with the
   invariant tests for balance, lock date, numbering, keys and reversal. Start the
   seed script and extend it at every step. Check: post a seed journal and read it back.
3. `book.trialBalance`, `ledger_account.ledger` and the report pages. Check: the
   seed's trial balance is out of balance by zero.
4. `CurrencyRate`, foreign postings, the `exchangeRates` connection and
   `recordDailyRates`. Check: a foreign journal converts at the seed rate; a date
   without a rate is refused.
5. `TaxRate`, `PaymentInstruction`, sales invoices, `recordPayment`, `allocate`,
   `book.ageing`. Check: issue, part-pay and age a seed invoice; void refuses while it
   is part-paid.
6. Documents, bills, expenses, evidence status and `book.missingEvidence`. Check: an
   expense without a receipt shows `missing`; attaching one makes it `complete`.
7. `FixedAsset`, depreciation, disposal, `book.revalue` and `monthEndClose`. Check:
   three months of depreciation stop at the residual; revaluation posts the expected
   difference.
8. `FinanceQuestion`, the finance roles, `member` without `*:read`, and
   `restricted_document` if needed. Check: a viewer can read but not post; a member
   without a finance role sees no journal.
9. Agent instructions, the posting rules in descriptions and, with the
   company-agent blueprint, `bookkeepingDigest`. Check: ask the agent for the trial balance.
10. When migrating, the import and the migration check. Check: the comparison is clean.
11. Hand the setup to a qualified accountant for review: chart, tax rates, asset
    policies, opening balances, roles. Deploy after their review.

**Importing history** is a script that calls the same actions, in four stages.
*Plan*: read the export (kept outside the repository) and the live books; write a
local plan of every call with its key. *Dry run*: check accounts, rates and open
periods, and show totals per account. *Apply*: call in order, save progress after
each call, re-read an uncertain write by its key before retrying, stop on drift.
*Validate*: the migration check is clean and the opening balance clearing account is
zero. VARIATIONS.md has the opening-balance method.

## 10. Sketch

Invented names; your project's `docs/ontology.md`, `docs/ontology-metrics.md` and
`docs/models.md` have the full API. The line entity, with its copied filters and
metrics (imports of the other entities omitted):

```ts
// ontology/journal-line.ts
import { entity, m, p, rel } from "@segmentstream/ontology";

const posted = { property: "posted", operator: "equals", value: true } as const;

export const JournalLine = entity("journal_line", {
  id: "ent_journal_line",
  label: "Journal line",
  plural: "Journal lines",
  title: "description",
  description:
    "One line of a journal: an account and a signed base-currency amount, debit positive. " +
    "Only posted lines count in reports. Written only by the posting path.",
  writes: "actions",
  properties: {
    date: p.date({ managed: true, description: "The journal's date." }),
    posted: p.boolean({ default: false, managed: true, description: "True once the journal is posted." }),
    position: p.integer({ managed: true, description: "Order of the line in its journal." }),
    amountMinor: p.integer({ managed: true, description: "Base currency minor units, debit positive." }),
    currency: p.text({ optional: true, managed: true, maxLength: 3, description: "Transaction currency, lowercase ISO 4217 (eur)." }),
    currencyAmountMinor: p.integer({ optional: true, managed: true, description: "The amount in `currency`, same sign." }),
    description: p.text({ optional: true, managed: true, maxLength: 2000, description: "What the line is for." }),
  },
  relationships: {
    book: rel.one(() => Book, { inverse: "journalLines", onDelete: "restrict", description: "The journal's book." }),
    journal: rel.one(() => Journal, { inverse: "lines", onDelete: "restrict", description: "The journal." }),
    ledgerAccount: rel.one(() => LedgerAccount, { inverse: "lines", onDelete: "restrict", description: "The account." }),
    salesInvoice: rel.one(() => SalesInvoice, {
      optional: true, inverse: "journalLines", onDelete: "restrict",
      description: "On a receivables line: the invoice it recognises or settles.",
    }),
  },
  metrics: {
    balance: m.sum("amountMinor", { where: [posted], unit: "number", description: "Posted balance. Filter one book." }),
    currencyBalance: m.sum("currencyAmountMinor", {
      where: [posted], unit: "number", description: "Posted amount in transaction currency. Group or filter by currency.",
    }),
  },
  indexes: [["book", "ledgerAccount", "date"], ["journal", "position"]],
});
```

A guarded action, in `SalesInvoice`'s `.actions((self) => ({ … }))`; `reverseJournal`
is the posting path's reversal:

```ts
void: action({
  description:
    "Void an issued invoice that nothing has paid or credited: its recognition is reversed on " +
    "`date`, which must be after the book's lock date. The number stays used.",
  hints: { destructive: false, irreversible: true, idempotent: true },
  writes: [self, Journal, JournalLine, Book],
  input: Schema.Struct({ invoice: self.ref, date: p.date({ description: "Date of the reversal." }) }),
  handler: ({ input, principal }) =>
    Effect.gen(function* () {
      const invoice = yield* self.get(input.invoice, { forUpdate: true });
      if (invoice.status === "voided") return { invoice: invoice.id, journal: null };
      if (invoice.status !== "issued" || invoice.recognitionId == null) {
        return yield* new ActionRejected({ message: `A ${invoice.status} invoice cannot be voided.` });
      }
      // In the invoice's currency, the lines naming it add up to its total only while nothing settles it.
      const [open] = yield* JournalLine.queryMetrics({ metrics: ["currencyBalance"], where: { salesInvoiceId: invoice.id } });
      const recognised = invoice.kind === "creditNote" ? -invoice.totalMinor : invoice.totalMinor;
      if (Number(open?.currencyBalance ?? 0) !== recognised) {
        return yield* new ActionRejected({ message: "Payments or credit notes settle this invoice; reverse them first." });
      }
      const reversal = yield* reverseJournal(invoice.recognitionId, input.date, principal);
      yield* self.update(invoice, { status: "voided" });
      return { invoice: invoice.id, journal: reversal.journal };
    }),
}),
```

A workflow's role, and the month-end trigger with one keyed step:

```ts
// ontology/roles.ts
export const monthEnd = role("monthEnd", {
  description: "Held by the monthEndClose workflow: posts depreciation and revaluation, nothing else.",
  permissions: ["book:read", "fixed_asset:postDepreciation", "book:revalue"],
});

// ontology/workflows/month-end-close.ts
import { cron, run, workflow } from "@segmentstream/ontology/workflows";

import { FixedAsset } from "../fixed-asset";

async function monthEndClose() {
  "use workflow";
  for (const book of await listBooks()) {
    const month = await previousMonth(book.timeZone); // a step: reads the clock in the book's zone
    await depreciate(book.id, month); // keyed per book and month: a repeat returns the same journal
    await revalue(book.id, month);
  }
}

async function depreciate(book: string, month: string) {
  "use step";
  return run(FixedAsset.actions.postDepreciation({ book, month }));
}
// listBooks, previousMonth and revalue are steps of the same shape.

export default workflow("monthEndClose", {
  description: "Post last month's depreciation and revaluation for every book, once.",
  role: "monthEnd",
  run: monthEndClose,
  triggers: [cron("firstWeek", "15 5 1-7 * *", { description: "05:15 UTC on the 1st to 7th.", input: {} })],
});
```

The monthly balances model over the replicated lines. The cumulative closing is right
for balance sheet accounts; reports restart revenue and expense at each fiscal year,
as `book.trialBalance` does. Months without movement are absent.

```python
# pipeline/models/account_balances_monthly.py
import ibis
import segmentstream as s

SCHEMA = ibis.schema({"book_id": "string", "ledger_account_id": "string", "month": "date",
                      "movement_minor": "int64", "closing_minor": "int64"})
SQL = """
WITH monthly AS (
  SELECT book_id, ledger_account_id, DATE_TRUNC(date, MONTH) AS month, SUM(amount_minor) AS movement_minor
  FROM ontology.journal_line WHERE posted GROUP BY 1, 2, 3
)
SELECT *, SUM(movement_minor) OVER (PARTITION BY book_id, ledger_account_id ORDER BY month) AS closing_minor
FROM monthly
"""


@s.model(tier=s.Tier.Gold, partitioning=s.Partitioning.Unpartitioned, schema=SCHEMA,
         description="Posted movement and cumulative closing per book, account and month.")
def account_balances_monthly(warehouse: s.WarehouseResource):
    return warehouse.backend.sql(SQL, schema=SCHEMA)
```
