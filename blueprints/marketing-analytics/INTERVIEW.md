# Interview

Ask these in one message. Offer the default with each question and skip what the person
already said.

## 1. Which sites and apps should be tracked, and how are they built?

- **Why**: the stream admits only declared origins, the session rules need the list of
  the company's own domains, and server events need middleware the site can run.
- **Answers change**: each origin goes into `auth.Origin(...)` and the internal-domain
  list; a site on Next.js gets the tracker's browser and server parts as in the sketch;
  another framework or host gets the browser tracker plus its own server snippet
  (VARIATIONS.md, "Site stack"); a signed-in product app gets its own stream for product
  analytics; several brands on separate domains share one stream and get a `site` field.
- **Default**: one marketing site on Next.js, its apex and `www` origins.

## 2. Which time zone do you report in, and which time zone are your ad accounts in?

- **Why**: ad platforms report spend per day in the ad account's time zone. Sessions
  must use the same days, or spend and conversions of a day will not line up.
- **Answers change**: the one calendar every daily asset uses. Ad accounts in several
  time zones need a choice: report in the main account's zone and accept edge effects
  for the others, or keep costs at day grain in each account's zone and say so.
- **Default**: the time zone of the main ad account; UTC if there are no ad accounts.

## 3. What counts as a conversion, and where does it happen?

- **Why**: conversions are declared in code, each with a business ID that makes it
  count once.
- **Answers change**: one declaration per answer. A website form becomes `lead` from a
  server-side `lead_submitted` with the form's submission ID; a sign-up becomes
  `signed_up` with the account ID; an online order becomes `purchase` with the order ID,
  value and currency; a deal won in the CRM becomes an offline conversion read from the
  CRM's records (VARIATIONS.md, "Conversion sources").
- **Default**: `lead` from website forms.

## 4. Should the same person count again if they convert twice?

- **Why**: some businesses want every order, others one lead per person per month.
- **Answers change**: the counting policy per conversion: `once_per_occurrence`,
  `occurrence_after_days(n)`, or `person_window_days(n)`, which needs the identity graph.
- **Default**: every distinct business ID counts once; no person window.

## 5. How do visitors identify themselves?

- **Why**: the identity graph links a person's browsers only through keys you collect.
- **Answers change**: sign-in adds `user_id` (exclusive); forms that ask for an email add
  `email_sha256`; neither means visitor-level analytics only, which is valid. Click IDs
  as weak keys can be turned off.
- **Default**: `email_sha256` from forms, `user_id` if the site has sign-in, click IDs
  on with a one-day window.

## 6. Which ad platforms and accounts do you use, and how are your ads tagged?

- **Why**: each platform needs a connection and an adapter to the cost contract, and
  stitching works only as well as the ads' tags.
- **Answers change**: Google Ads and Meta adapters as described; others as variations.
  Auto-tagging (`gclid`) enables click matching; UTM templates that carry campaign and
  ad IDs (for example `utm_id={campaignid}` and `utm_content={creative}`) enable ID
  matching; untagged ads are reported but their sessions stay unmatched. List manager
  accounts separately from the accounts that spend.
- **Default**: Google Ads and Meta, with a recommended tagging template the agent writes
  out for the person to apply in each platform.

## 7. Which attribution window and default model should reports show?

- **Why**: both first and last click are computed; the reports need one to show first.
- **Answers change**: the window per conversion (longer for considered purchases) and
  the model the overview opens with. The agent always names the model.
- **Default**: 90 days; last click shown first, first click one switch away.

## 8. Which currencies do your ad accounts and your sales use?

- **Why**: money is never converted implicitly; CPA and ROAS need one currency.
- **Answers change**: one currency means one filter everywhere; several mean reports pick
  a currency, or a reporting-currency conversion with dated rates is added
  (VARIATIONS.md, "Currencies").
- **Default**: report each currency separately.

## 9. Do you need visitor consent before setting analytics cookies, and how long may you keep raw data?

- **Why**: the anonymous ID is a first-party cookie; in many countries it needs consent.
  Raw captures hold IP addresses and user agents.
- **Answers change**: the middleware sets `ss_aid` only after consent, or never
  (cookieless mode); the stream's `retention_days`; a deletion procedure for a visitor's
  data on request.
- **Default**: set the cookie only when the site's consent banner allows it; without
  consent, events still arrive with no anonymous ID and each hit is its own session.
  Keep raw captures as long as the privacy policy says; no expiry if it says nothing.

## 10. Are you replacing another analytics tool, and for how long can it run alongside?

- **Why**: the parity kit needs both systems over the same days, and history may be
  imported.
- **Answers change**: the parity reference adapter (GA4 export, a sheet of the previous
  tool's daily export); an optional GA4 history import up to the cutover day.
- **Default**: run both for at least two full weeks with the parity kit; no import.

## 11. Roughly how many page views a month, and how fresh must reports be?

- **Why**: decides the refresh shape and schedule.
- **Answers change**: the default daily shape fits any size; small sites may choose a
  full rebuild every hour (VARIATIONS.md, "Refresh"); intraday needs a separate model.
- **Default**: daily, after the ad platforms settle the previous day.

## 12. Who should see the reports, and should everyone see conversion-level rows?

- **Why**: conversion and session rows carry pseudonymous person IDs.
- **Answers change**: who holds `marketing` and `analytics_admin`; whether `member` keeps
  analytics reads.
- **Default**: the marketing team holds `marketing`; one owner holds `analytics_admin`;
  other members see nothing of analytics.

## Decisions that need a person every time

- Turning on collection on a live site, and any change to consent or cookie behavior.
- Deleting data: shortening retention, purging a visitor's data on request, or a backfill
  that would replace dates whose raw captures have expired.
- Switching an adapter from `sample` to `real`, which rebuilds every retained date.
- Changing a conversion's counting policy, an attribution window or the identity policy:
  each one rewrites past numbers in every report.
- Sending anything back to an ad platform, such as offline conversions or audiences. This
  blueprint does not, and adding it needs explicit approval of what is sent.
