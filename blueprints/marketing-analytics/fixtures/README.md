# Fixture day

One invented day, 2026-03-10, at Northwind (`www.example.com`), reported in
`Europe/Berlin` (UTC+1 that day). Run it as one test: load the inputs, run the models on
DuckDB with the harness in [testing](../../../docs/testing.md), and compare the outputs
with the expected rows. Every expected row follows from the rules in
[BLUEPRINT.md](../BLUEPRINT.md); the notes below say which.

## Inputs

| File | Contract | Rows |
| --- | --- | --- |
| `inputs/web_events.json` | `silver/web_events` (BLUEPRINT 6.3) | 15 events of three visitors |
| `inputs/cost_data.json` | `silver/cost_data` (6.8) | One Google Ads ad and one Meta ad, that day |
| `inputs/google_ads_click_view.json` | the `click_view` table (6.8) | `gclid-1` → campaign 111, ad group 222, ad 444 |

The day:

- **visitor-1** clicks a Google ad (`gclid-1`, UTMs `google / cpc / spring_sale`,
  `utm_id=111`), views a second page in the app (`spa`), signs in, and buys `order-1`
  (120.00 EUR). The thank-you page sends `order-1` a second time. At 11:00 local the same
  visitor comes back from the newsletter (`newsletter / email / march_news`) and buys
  `order-2` (45.50 EUR).
- **visitor-2** clicks a Meta ad whose `utm_content` carries the ad ID (`ad_333444`) and
  signs up for the newsletter (`sub-1`).
- A visitor without consent (no anonymous ID) opens `/sale` and buys `order-3`
  (30.00 EUR).

The declared conversions are `purchase` (from `purchase`, occurrence `order_id`) and
`newsletter_signup` (from `lead_submitted` with `form` = `newsletter`, occurrence
`submission_id`), both `once_per_occurrence`, with first and last click over 90 days.

## Expected

| File | Key | Why these rows |
| --- | --- | --- |
| `expected/sessions.json` | `session_id` | Four sessions. A session's ID is its first hit's ID, a page view here. `view-2` (SPA, internal referrer) has no signal and stays in `view-1`'s session. The newsletter visit changes the signature and starts `view-3`. The consent-less hit is its own `(direct)` session. |
| `expected/stitched_sessions.json` | `session_id` | `view-1` matches by `click_id` although its `utm_id` and UTM tuple also match (invariant 26). `view-4` matches the Meta ad by ID evidence: the token `333444` equals its ad ID; `ad`, `trail` and `shoes` match nothing. Email and direct sessions are not paid-looking and have no code. |
| `expected/conversion_report.json` | `conversion_instance_id` | `purchase-2` repeats `order-1`: credit 0, `duplicate` (invariant 14). `purchase-4` has no anonymous ID, so no session and `unverified`. Instance IDs are `<name>\|<event_id>`. Values are minor units. |
| `expected/attribution_report.json` | `model`, `conversion_instance_id` | `order-2`: first click is the Google session, last click the newsletter session. `order-1` happened before the newsletter visit, so both models credit the Google session. `order-3` is `(unattributed)` in both models; `purchase-2` has no credit and no row (invariant 18). |

Each expected file lists only the columns it checks; compare those columns and ignore the
rest. Timestamps are UTC in ISO 8601 with `Z`, dates are `YYYY-MM-DD`, money in inputs is a
decimal string and in outputs integer minor units, and `null` is NULL.

## Loading

Columns a row leaves out are NULL. Type each value by the contract the table uses, then
build the table with the harness's `table(con, rows, schema)`:

```python
import json
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path


def load(path: Path, schema) -> list[dict]:
    def typed(value, dtype):
        if value is None:
            return None
        if dtype.is_timestamp():
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dtype.is_date():
            return date.fromisoformat(value)
        if dtype.is_decimal():
            return Decimal(value)
        return value

    return [{c: typed(row.get(c), schema[c]) for c in schema.names} for row in json.loads(path.read_text())]


events = table(con, load(FIXTURES / "inputs/web_events.json", WEB_EVENTS_SCHEMA), WEB_EVENTS_SCHEMA)
```

Copy the files into the project's `pipeline/tests/fixtures/`. They hold invented data
only. When a variation changes a rule they depend on (session timeout, channel rules,
counting policy), change the expected rows in the project and say why in `BLUEPRINTS.md`.
