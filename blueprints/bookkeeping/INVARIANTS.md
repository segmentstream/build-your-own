# Bookkeeping: invariants

Rules that hold in every version, whatever the company. Each one becomes a test in
the project, run against the ontology with invented records (a book `main` in a
two-decimal base currency, a starter chart, rates for one foreign currency). Amounts
below are minor units.

## The ledger

### 1. Every posted journal balances to zero in base currency

- **Why**: an unbalanced entry makes the trial balance and balance sheet wrong for
  ever, and nothing downstream can find it.
- **Test**: post lines of +1000 and −999. Expect a rejection that names the
  difference and no journal. Post +1000 and −1000: expect `posted`. Also reject one
  line, more than 200 lines, and lines that are all zero.

### 2. A posted journal never changes; corrections are new journals

- **Why**: the books are evidence. A silent edit destroys the audit trail that the
  record history and the reversal provide.
- **Test**: post a journal, then call every action that writes `journal` or
  `journal_line` with it as input. Expect each to refuse or to write a new journal,
  and the original's date, lines, accounts and amounts to be unchanged.

### 3. A reversal is the exact opposite, posted once, and never itself reversed

- **Why**: a second reversal, or a reversal of a reversal, silently re-posts or
  doubles an entry.
- **Test**: reverse a journal on a later date. Expect each account's net effect of
  the pair to be zero and `reversalOf` set. Reverse it again: refused. Reverse the
  reversal: refused. Reverse dated before the original: refused.

### 4. A journal a document or asset owns is undone only through its owner

- **Why**: reversing an invoice's recognition directly leaves an `issued` invoice
  with nothing owed, and the next payment over-settles it.
- **Test**: issue an invoice and call `journal.reverse` on its recognition. Expect a
  refusal that names `sales_invoice.void`. The same for a bill, an expense and an
  asset disposal.

### 5. Nothing posts on or before the lock date

- **Why**: a closed period has been reported to someone; a late posting changes
  figures they already rely on.
- **Test**: close through 31 March. Expect a refusal from every posting path dated 31
  March (manual journal, draft post, reversal, issue, approve, void, payment,
  allocation, depreciation, revaluation, disposal), and success on 1 April.

### 6. Only `book.reopenTo` moves the lock date earlier, with a reason

- **Why**: reopening a closed period is the most dangerous change in the books and
  must be deliberate, attributed and explained.
- **Test**: call `book.closeThrough` with an earlier date: refused. Call
  `book.reopenTo` without a reason: refused. With a reason and `financeAdmin`: the
  lock date moves and the history shows the member and the reason. A member with
  only `financeOwner` is refused.

### 7. Journal numbers are unique and consecutive per book, given only at posting

- **Why**: gaps and duplicates are what auditors look for first.
- **Test**: post three journals concurrently in one book. Expect numbers n, n+1, n+2
  with no duplicate. A saved draft has no number. A refused posting consumes none.

### 8. Every line belongs to its journal's book, on an active account, with the journal's date and status

- **Why**: metrics filter lines alone; a line in another book or with a stale
  `posted` flag moves money between companies or into drafts.
- **Test**: post a line on another book's account: refused. Post on an archived
  account: refused. After `postDraft`, expect every line's `posted`, `date` and
  `book` to equal the journal's.

### 9. A repeated key returns the first journal and never posts twice

- **Why**: retries, workflows and imports call again after uncertain answers.
- **Test**: post with key `k` twice: one journal, the second answer `replayed`. Post
  key `k` with a different amount: refused, naming the key. Run `monthEndClose` twice
  for the same month: one depreciation journal and one revaluation journal per book.

## Money and currencies

### 10. Money is integer minor units with each currency's exponent

- **Why**: floats drift, and a fixed factor of 100 is wrong for currencies with zero
  or three decimals.
- **Test**: in a two-decimal base book, convert 1000 units of a zero-decimal currency
  at a rate of 150 per base unit: expect 667 base minor units (6.67). Convert 1000
  minor units of a three-decimal currency at 0.5: expect 200. No money property is
  `p.number`.

### 11. A foreign posting uses a recorded rate, or is refused

- **Why**: a guessed rate of 1, or a rate fetched mid-transaction, makes amounts
  unrepeatable and unauditable.
- **Test**: post a foreign line with no rate within `rateLookbackDays`: refused,
  naming the currency and date. Record a rate four days earlier: the posting uses
  it. Replace that rate afterwards: the posted line's `amountMinor` is unchanged.

### 12. Currency amounts travel with their lines

- **Why**: revaluation and foreign outstanding amounts are sums of currency amounts;
  a line without one silently drops money from them.
- **Test**: a line with `currency` but no `currencyAmountMinor`, or the opposite:
  refused. Opposite signs: refused. A line on an account whose `currency` is set,
  without that currency: refused. A control line naming a base-currency invoice still
  carries the invoice's currency and amount.

### 13. Revaluation brings every foreign monetary balance to the date's rate, and nothing else

- **Why**: unrevalued foreign money misstates the balance sheet; revaluing
  non-monetary items invents gains.
- **Test**: a foreign bank account holds 100000 foreign minor units carried at 80000
  base, and a foreign invoice is open. Revalue at 1.2 foreign per base: the account's
  balance becomes 83333 with −3333 on `unrealisedFx`; the invoice's base outstanding
  moves to the new rate and its currency outstanding is unchanged. A fixed asset
  bought in that currency is not touched. A book without foreign money posts nothing
  and needs no currency accounts.

## Documents and payments

### 14. Outstanding amounts are computed from posted lines, never stored

- **Why**: a stored "paid" flag drifts the moment a payment is reversed.
- **Test**: issue an invoice of 1200, pay 500, then reverse the payment. Expect
  outstanding 1200 in the document's currency from the `currencyBalance` metric, and
  no property on `sales_invoice` that changed during the payment or reversal.

### 15. Nothing settles more than is outstanding, or in the wrong direction

- **Why**: over-settlement hides money received twice or paid to the wrong document.
- **Test**: an invoice of 1200 with 1000 already paid: a payment settling 300
  against it is refused; 200 succeeds. Two concurrent payments of 200 each against
  the remaining 200: exactly one succeeds. A payment out settling a sales invoice is
  refused.

### 16. Settling a foreign document relieves its base carrying amount and posts the difference to realised gains

- **Why**: otherwise the control account keeps a base balance on a document owing
  nothing.
- **Test**: a bill of 10000 foreign minor units is recognised at 8000 base and paid in
  full when they cost 7692 base. Expect the bill's payables lines to total 0 in both
  currencies, the bank line −7692, and −308 (a credit: a gain) on `realisedFx`.

### 17. An issued invoice never changes; it is corrected by a credit note

- **Why**: the customer holds the issued document; the books must hold the same one.
- **Test**: issue an invoice, then rename its customer company and call every
  `sales_invoice` action that edits drafts. Expect refusals for the invoice, and its
  number, date, lines, totals and bill-to details unchanged.

### 18. Invoice numbers are consecutive per book and series, never reused

- **Why**: many jurisdictions require gapless numbering, and a reused number is two
  documents with one identity.
- **Test**: issue two invoices, void the first, issue a third: numbers are
  `INV-0001`, `INV-0002`, `INV-0003` and the voided one keeps `INV-0001`. Discarding a
  draft consumes nothing. Credit notes run in their own series.

### 19. Only a member issues an invoice, and only when nothing settles it can it be voided

- **Why**: an invoice is a legal document sent in the company's name; unattended
  programs must not create one, and voiding a paid invoice loses the payment's match.
- **Test**: call `sales_invoice.issue` as a workflow user or an API key: refused. As a
  member with `bookkeeper`: issued. Part-pay it and void: refused. Reverse the payment
  and void: voided, recognition reversed in the same transaction.

### 20. A supplier's document number is entered once per book

- **Why**: entering the same supplier invoice twice pays it twice.
- **Test**: enter a bill numbered `A-100` from a supplier; enter it again with a new
  key: refused, naming the existing bill. A voided or discarded bill does not block it.

## Reports, assets and evidence

### 21. The trial balance is in balance at every date, and the balance sheet balances

- **Why**: this is the check accountants run first; it proves the ledger is whole.
- **Test**: after the full demo seed, for each month end of the year,
  `book.trialBalance` returns `outOfBalance` 0, and assets equal liabilities plus
  equity plus retained and current earnings. Revenue and expense accounts open the
  next fiscal year at zero, and the year's result appears in retained earnings.

### 22. Drafts appear in no report and no metric

- **Why**: a draft is a proposal; counting it reports money that does not exist.
- **Test**: save a draft journal of 5000 to revenue. Expect `balance`, the trial
  balance, profit and loss and ageing unchanged until it is posted.

### 23. Depreciation never goes below residual and posts once per month

- **Why**: over-depreciation misstates assets; double posting halves the asset.
- **Test**: an asset costing 3600, residual 0, life 3 months, depreciated for four
  months: accumulated depreciation is exactly 3600 and the fourth month posts nothing.
  Repeat a month: the same journal is returned. An asset whose cost is not in the
  ledger is skipped and listed. Disposal removes cost and accumulated depreciation and
  posts the difference to `assetDisposal`.

### 24. Evidence status is computed by actions, and answers change no books

- **Why**: an evidence level a caller can type in, or an owner's chat answer that
  posts, removes the control it exists for.
- **Test**: `expense.record` with an `evidenceStatus` in its input: refused or
  ignored. Attach a receipt: `complete`. Detach it: `missing`. Record an answer on a
  question about that expense: no `journal`, `journal_line`, `expense` or `bill` write
  appears in history.

### 25. Finance records are readable only through finance roles

- **Why**: books hold salaries, margins and personal data; the platform's default
  member read covers every entity.
- **Test**: a member with no finance role calls `journal_find`, `query_metrics` on
  `journal_line.balance` and `book.trialBalance`: each is refused. A `financeViewer`
  reads them and cannot post. Only a role that names `restricted_document:read` (or
  Drive's role for the confidential class) reads a restricted document, and that
  entity is absent from warehouse replication.
