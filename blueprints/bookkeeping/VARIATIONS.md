# Bookkeeping: variations

Where companies legitimately differ. Each variation lists its options, what each
changes, and the default this blueprint takes. Country law (tax, invoicing rules,
retention, payroll) is always a variation, decided with the company's accountant,
never a default.

## Chart of accounts

- **Neutral starter chart** (default when not migrating). Codes and names, with the
  system role or evidence policy in brackets: 1000 Bank, 1010 Cash, 1100 Accounts
  receivable (`receivables`), 1200 Prepayments, 1500 Equipment, 1510 Accumulated
  depreciation, 2000 Accounts payable (`payables`), 2100 Tax payable, 2110 Tax
  recoverable, 2300 Owed to people (`owedToPeople`), 2900 Opening balance clearing
  (`openingBalance`), 3000 Owner's capital, 3100 Retained earnings
  (`retainedEarnings`), 4000 Sales, 4900 Other income, 5000 Cost of sales, 6000
  General expenses, 6100 Rent, 6200 Software, 6300 Travel, 6400 Bank fees
  (`statement`), 6500 Depreciation, 7000 Realised currency gains (`realisedFx`), 7010
  Unrealised currency gains (`unrealisedFx`), 7020 Rounding (`rounding`), 7100 Gain or
  loss on disposal (`assetDisposal`).
- **The previous system's chart** (default when migrating): imported with
  `ledger_account.importChart`, then each system role assigned.
- **A national or industry standard chart**: some countries prescribe one. The
  accountant provides it as a file; it is imported the same way. Nothing in the
  posting path depends on codes, only on classes, types and system roles.

## Legal entities

- **One book** (default).
- **Several books**, one per legal entity, each with its own base currency, numbering
  and lock date. Pages and reports gain a book filter; when different teams keep
  different entities, scope roles to books through a path from `me` (such as a
  book-assignment record): a scope cannot name a literal book id, and metric
  queries refuse path scopes, so those teams read figures through the report
  actions, which check the caller's book themselves.
- **Intercompany and consolidation**: postings between entities are ordinary
  journals in each book against intercompany accounts. Consolidated reports and
  eliminations are out of scope.

## Tax on documents and tax returns

- **No tax** builds no tax rates; tax columns are hidden.
- **Tax on lines** (default): a rate's percent and the account its tax posts to;
  invoices compute tax per line; bills and expenses take the tax the document prints.
- **Tax returns** (future blueprint): extend `tax_rate` with a treatment that maps to
  return boxes (standard, zero-rated, exempt, reverse charge, outside scope), add a
  `tax_return` record that sums `journal_line.taxAmount` and net amounts by treatment
  for a period, stamps the lines it reported so a late line is reported once, freezes
  the filed figures and moves the lock date to the period end. Reverse charge posts
  the notional tax on the tax account both ways. Filing to a tax authority, its
  formats and its correction limits are country-specific.
- **Tax-inclusive prices**, **rounding per document instead of per line**, compound
  and withholding taxes: changes to how lines compute tax, decided with the
  accountant.

## Bank feeds and reconciliation (future blueprint)

The first version records payments from documents and statements typed in by
people. The extension points:

- A `bank_account` record behind each money account, and a `bank_line` record per
  real bank movement, imported by a workflow that reads the bank or aggregator page by
  page through a connection, keyed by the bank's own id so reruns add nothing.
- `journal_line.bankLine`: a line on a money account names the bank line it records.
  A bank line is reconciled when the posted lines naming it add up to its amount.
- `journal.recordPayment` gains an optional `bankLine` input; nothing else in the
  posting path changes.
- Reconciliation compares the bank's balance with the ledger balance and lists bank
  lines not yet posted and ledger lines that name no bank line.
- Suggestions (same amount as an open document, the payee's earlier coding) are a
  read action that stores nothing; posting stays a person's decision or a narrow,
  rule-bound workflow.

## Payroll (future blueprint)

Pay runs are posted as ordinary journals through `journal.post` (gross pay, employer
costs and the liabilities to employees and authorities) and paid with
`journal.recordPayment`. Payslips and employee records are `restricted_document` and
restricted entities, excluded from replication. Pay calculation is country law.

## Exchange rates

- **Source**: a public central-bank style source (default), the bank's own rates,
  monthly average rates, or manual rates only.
- **Lookback**: how many days back a posting may take the latest earlier rate
  (default 7).
- **Bank's own conversion**: `recordPayment` takes `baseAmountMinor` when the bank
  states what it charged in base currency (default: accepted when given).

## Revaluation method

- **Cumulative adjustment** (default, runs in production at SegmentStream): each month
  end brings the carrying amount to the current rate; settlements realise the
  difference from the carrying amount.
- **Reversing**: post the revaluation at month end and its reversal on the next day.
  Simpler to read per month; requires the reversal to post even when the next period
  is locked soon after.
- **No revaluation**: for books with no foreign money.

## Depreciation

- **Methods**: straight line by months (default), declining balance by an annual
  rate, units of production (add a usage input per month), or none.
- **Conventions**: depreciation from the month of purchase (default) or the month
  after; nothing in the month of disposal (default) or a full or partial month.
- **Capitalisation threshold**: below an amount the accountant sets, purchases are
  expensed, not registered.
- **Asset classes** with default accounts and lives, so registering an asset needs
  fewer inputs.

## Approval and separation of duties

- **One approver** (default): a member with `accountant` approves bills and expenses,
  including ones they entered.
- **Four eyes**: the approver must differ from the person who entered it, always or
  above an amount set on the book.
- **Owner approval above a threshold**: a second approval action that a role holds.

## Invoices

- **Numbering**: one series per book and kind (default), a series per year, or a
  prefix per legal requirement. Some jurisdictions require registered numbering,
  e-invoicing through an authority, or a fiscal device; those are country variations.
- **Printed content**: what the law requires on an invoice (tax identifiers,
  wording, language) comes from the accountant.
- **Delivery**: a print view the member downloads and sends (default), or email
  through the email blueprint, always confirmed by a member.
- **Sales recorded elsewhere**: a shop or payment provider issues its own documents;
  a workflow records each with `sales_invoice.record` under its number and settles it
  with the payout.

## Evidence policy

- **Source document makes evidence complete** (default).
- **Source document and proof of payment** both required for `complete`, as some tax
  authorities expect.
- **Thresholds**: below an amount, no receipt is needed.
- **Retention**: how long files are kept is country law; the default keeps them.

## Moving from another system

- **Opening balances** (default): an `opening` journal at the conversion date carries
  every balance except receivables and payables; each open invoice and bill is
  recorded individually (`sales_invoice.record`, `bill.enter` and `bill.approve`) on
  its original date, coded to the opening balance clearing account; fixed assets are
  registered with `openingDate` and `openingAccumulatedMinor` and their opening cost
  and depreciation lines name them. The clearing account must end at zero.
- **Full history**: every month's journals through `journal.post` with the old
  system's number in `sourceRef` and a key per old journal, then the migration check
  month by month.
- **No migration**: a new company starts with an opening capital journal.

## Accounting basis and period-end entries

- **Accrual basis** (default): income when invoiced, costs when billed.
- **Cash basis reporting**: a report that counts revenue and costs when paid, from
  the payment journals' settled documents. The ledger stays the same.
- **Accruals, prepayments and deferred revenue**: monthly releases built like
  depreciation: a plan on the line, one keyed journal per book and month posted by
  `monthEndClose`.
- **Year-end closing journal**: by default retained earnings are computed, not
  posted; some accountants want an explicit closing journal.

## Analysis on lines

Departments, projects, classes or locations as tracking options on journal lines,
with report filters. Not built by default.
