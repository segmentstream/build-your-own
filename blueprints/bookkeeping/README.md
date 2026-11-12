# Bookkeeping

Your company's own books: one general ledger behind sales invoices, supplier bills,
expenses with their receipts, payments, fixed assets and foreign currencies, with the
reports an accountant reads. It replaces the bookkeeping core of Xero, QuickBooks and
similar small-business accounting tools.

## What you get

- Every money event, from an invoice to depreciation, is one balanced journal in one
  ledger, so the trial balance, profit and loss and balance sheet always agree.
- Posted entries never change. Mistakes are corrected by reversal, and every change
  keeps its author and reason.
- Closed periods stay closed: a lock date stops anything from posting into a month
  your accountant has signed off.
- Invoices are numbered without gaps, and each one shows what is still owed. Aged
  receivables and payables come from the same ledger.
- Expenses carry their receipts, and each shows whether its evidence is complete,
  partial or missing, so the gaps are known long before year end.
- Fixed assets depreciate every month, and foreign-currency balances are revalued at
  each month end, without anyone running a script.
- Your team and the workspace agent work from the same records: "what is overdue?",
  "file this receipt", "post depreciation for March".

## Build it

```text
Read https://github.com/segmentstream/build-your-own/blob/main/AGENTS.md and follow it.
Build our Bookkeeping from the bookkeeping blueprint.
```

## How it fits

- **CRM**: customers and suppliers are the shared Company records, so a company's
  page can show its invoices, bills and what it owes.
- **Drive**: receipts, supplier invoices and contracts are Drive documents linked to
  the records they evidence. Without Drive, this blueprint builds a minimal document
  store that Drive later extends.
- **Company agent**: the daily bookkeeping assistant. It files receipts sent in chat,
  answers questions about the books, chases missing evidence and asks the owner the
  questions only the owner can answer.

## What it is not

- It is bookkeeping software, not tax or accounting advice. A qualified accountant
  should review the chart of accounts, tax rates, depreciation policies and opening
  balances before you rely on the books.
- The first version has no bank feeds or bank reconciliation, no tax returns and no
  payroll. They are described as extensions and are future blueprints.
- It keeps the books of each legal entity separately. It does not consolidate groups,
  track inventory or replace an audit.
