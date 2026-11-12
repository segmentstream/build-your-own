# Ad fraud and bot detection: invariants

Each rule holds in every version. Pipeline tests run the models on invented events:
documentation addresses (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24, 2001:db8::/32),
browser IDs such as `b-ada`, and invented user agents. `CHROME` below is a Chrome 130
desktop user agent, and a "plain request" is a server-only document request with that UA,
`Sec-Fetch-Mode: navigate`, `Sec-Fetch-Dest: document`, `Accept-Language: en-US`, IP
198.51.100.1, a JA4 whose second part is `8daaf6152771`, path `/deep`, no page view.
Run the warehouse builtins (`NET.SAFE_IP_FROM_STRING`, `NET.IP_TRUNC`, `TO_JSON_STRING`)
as test macros so the same expressions execute offline.

## Rules and precedence

1. **Each documented combination gets its class and reason.**
   - Why: the catalogue is the specification; a refactor must not move a single case.
   - Test: one hit each, with lists `openai_chatgpt_user`, `openai_searchbot` and
     `openai_gptbot` on 192.0.2.0/24 and `anthropic_bots` on 2001:db8::/32. Expect
     (class, reason): tracker page view → `human`, `js_confirmed`; page view with
     `webdriver` true → `script`, `ua_automation`; your internal tool prefix → `internal`,
     `internal_test`; `curl/8.0`, `Bun/1.2`, `Python-urllib/3.12` → `script`,
     `ua_scripted_client`; `HeadlessChrome/130` → `script`, `ua_automation`;
     `NovelBot/1.0` → `script`, `ua_generic_bot`; no `Sec-Fetch-Mode` →
     `spoofed`, `no_fetch_metadata`; JA4 `t13d591000_a33745022dd6` → `spoofed`,
     `ja4_ua_mismatch`; Sec-CH-UA `"Chromium";v="122"` → `spoofed`,
     `client_hints_mismatch`; landing on `/` → `human_likely`, `human_behaviour`; the
     plain request → `unverified`, `browser_unverified`; `ChatGPT-User/1.0` from
     192.0.2.1 → `ai_assistant`, `ua_declared_agent`, verified; the same from
     198.51.100.1 → `spoofed`, `ua_spoofed_agent`, verified false; `Claude-User/1.0`
     from 2001:db8::1, `OAI-SearchBot` from 192.0.2.8, `GPTBot` from 192.0.2.9 → their
     classes, `ua_declared_agent`; `Amazonbot/0.1` → `ai_training`, verification null;
     `Googlebot/2.1` → `search_crawler`; `Twitterbot/1.0` → `link_preview`;
     `StackDetectorBot/1.0` → `tool`; a page view with `Signature-Agent:
     "https://chatgpt.com"` → `autonomous_agent`, `signature_agent_declared`. Every
     reason is in `reason_codes` and has a non-null entry in `rule_evidence`.

2. **The spoof check runs before the declared-agent rule.**
   - Why: otherwise any script that writes "ChatGPT-User" passes as a verified fetcher.
   - Test: in invariant 1, the off-list `ChatGPT-User` is `spoofed` with
     `class_reason` `ua_spoofed_agent`, never `ua_declared_agent`.

3. **A hit records every contradiction, not only the decisive one.**
   - Why: the proof must show all evidence; the first match only sets the class.
   - Test: a page view with Chrome 149's UA and Sec-CH-UA
     `"HeadlessChrome";v="151", "Chromium";v="151"` has class `script` and both
     `ua_automation` and `client_hints_mismatch` in `reason_codes`;
     `rule_evidence.ua_automation.sec_ch_ua` equals the header. An ordinary
     `"Chromium";v="130"` page view has no `ua_automation`.

4. **Weak rules never set a class; two points make a session suspicious.**
   - Why: VPNs, privacy builds and TLS proxies are common among real customers.
   - Test: a page view with no Accept-Language and JA4 `x_bad_x` is `human`,
     `weak_score` 2, `suspicious`. Two page views of one browser ID, each without
     Accept-Language, give a session `weak_score` 1 and `valid`; one without
     Accept-Language plus one with a bad JA4 give 2 and `suspicious`.

5. **One invalid hit makes the session invalid.**
   - Why: a script that loads one real page alongside its requests must not pass.
   - Test: browser ID `mixed` with a tracker page view and a `curl/8.0` request: the
     session is `script`, `invalid`, primary reason `ua_scripted_client`. Browser ID
     `internal` with an internal-prefix request and a tracker page view: class
     `internal`. Session `hits` sum to the input hits.

## Missing data is unknown

6. **A missing, stale or unreadable list never makes a spoofer.**
   - Why: a failed download must not turn every real crawler into a bot.
   - Test: `GPTBot` with its list 61 days old, `Perplexity-User` with no list,
     `ChatGPT-User` with IP `not-an-ip`, and with no IP: `identity_verified` null, class
     not `spoofed`; the stale case has `ip_ranges_fresh` false.

7. **Absence is only evidence where the browser version guarantees presence.**
   - Why: older browsers, consent banners and older events lack fields honestly.
   - Test: Chrome 79 without Sec-Fetch headers → `unverified`; Safari 16.3 without
     `Sec-Fetch-Mode` → `unverified`; Safari 16.4 without `Sec-Fetch-Dest` and Firefox 90
     without `Sec-Fetch-Mode` → `no_fetch_metadata`; Chrome UA plus `Edg/130` with JA4
     `x_not_chrome_x` → `unverified` (only Chrome's family is compared); an event without
     signature fields has null `signature_agent`; `no_asset_request` never appears.

8. **Shared addresses are protected by a single tracker run.**
   - Why: offices, carriers and NAT put many real people behind one IP.
   - Test: 20 one-hit browser IDs from 203.0.113.1, none with a page view → all
     `cookieless_scanner`. 20 from 203.0.113.2 where one ran the tracker → none
     `spoofed`. Two hits with no IP → `hits_per_ip_day` 0 for both. 60 no-JS hits from
     203.0.113.5 in one hour → all `ip_velocity`.

9. **Client hints contradict only what they can.**
   - Why: Chrome OS and non-Chromium browsers send different hints legitimately.
   - Test: the plain request with `Sec-CH-UA-Platform: "macOS"`, with
     `Sec-CH-UA-Mobile: ?1`, with `"Chromium";v="122"` and with `"Google Chrome";v="122"`
     → `client_hints_mismatch`. A Chrome OS UA with `"Chrome OS"` is not compared on
     platform.

## Networks and verification

10. **Overlapping ranges never multiply hits, and bounds are exact.**
    - Why: a cloud range containing a crawler range would double the hit and its session.
    - Test: lists `aws` 192.0.0.0/8 (cloud), `openai_chatgpt_user` 192.0.2.0/24 and
      192.0.2.0/25, `anthropic_bots` 2001:db8:1::/48. `ChatGPT-User` from 192.0.2.255 and
      `Claude-User` from 2001:db8:1:ffff:ffff:ffff:ffff:ffff are verified; from
      192.0.3.0 and 2001:db8:2:: they are `spoofed`. Output rows equal input rows.

11. **A claim is not verification.**
    - Why: any script can send a crawler user agent or a `Signature-Agent` header.
    - Test: a signed request has method `signature_host_declared` and
      `vendor_ip_verified` false. In the agent report, a verified `ChatGPT-User` hit adds
      1 to `ai_fetches`; a signed hit adds 1 to `hits_with_signature` and 0 to
      `ai_fetches`.

## Conversions

12. **A form post is judged with the form profile.**
    - Why: a post has no page view, navigation headers or history; page-load rules would
      condemn every real lead.
    - Test: JA4 `t13d3013h2_1d37bd780c83_8537cf56674e` on both a page view and the
      browser ID's submission 9.506 s later: conversion `human`, counted,
      `ja4_ua_mismatch_js` in its reasons and `ja4_ua_mismatch_post` in the request's,
      no `ja4_ua_mismatch`. The same JA4 on a page request without a page view: the
      session is `spoofed`, the conversion `invalid`, not counted. A lone submission with
      that JA4 and no session: request codes exactly `browser_unverified`,
      `ja4_ua_mismatch_post`; not invalid; `seconds_from_first_hit` null.

13. **The conversion session is the containing one, within 24 hours.**
    - Why: the verdict must describe the visit that submitted, not another one.
    - Test: sessions of one browser ID from −10 s to +10 s, at −1 s, and at −86,401 s; a
      submission at 0 links to the first, with `seconds_from_first_hit` 10. With only the
      oldest, it links to none.

14. **Timing rules are strict and independent.**
    - Why: thresholds are documented to the second; joining them would double-count.
    - Test: with a page view, submissions at 2.999 s and 3 s give `fast_form` and
      nothing; without a page view, 9.506 s gives `no_js_session` and 2 s gives both.

15. **Counting follows one policy.**
    - Why: marketing numbers and the proof must agree on what a conversion is.
    - Test: `counted` equals (group in `human`, `agent`, `unverified` and verdict not
      `invalid`) on every row. A signed `chatgpt.com` submission is `autonomous_agent`,
      counted, `submitted_via_agent` true. A `curl/8` submission from a human's browser
      ID is `script`, not counted. A submission whose session was one no-JS hit from a
      cloud range is group `unverified`, `invalid`, not counted. Marketing-analytics
      gives every uncounted conversion `invalid_traffic`.

16. **A confirmed test submission exempts nothing else.**
    - Why: a broad exemption is a hole any visitor could use.
    - Test: a submission whose ID is on the confirmed list is `internal`, `invalid`,
      request primary reason `internal_test`, with that ID in its evidence; the page
      request of the same browser ID keeps its own class (`spoofed` in the fixture).

## Rebuilds and reports

17. **Nothing is dropped, and empty inputs give empty outputs.**
    - Why: invalid traffic is the evidence; filtering it hides fraud.
    - Test: every hit appears once in `traffic_hits`, every session once in
      `traffic_sessions`, every conversion once in each conversion table, whatever the
      verdict. With no events, every model and report returns zero rows without error.

18. **Rebuilds are deterministic and correct the past.**
    - Why: verdicts feed decisions; they must be reproducible and current.
    - Test: browser ID `returning` with one plain request is `unverified`; add a second
      the next day and both become `human_likely`. Reordering the input gives identical
      rows.

19. **Every verdict names its rule and version.**
    - Why: without them, drift cannot be told from a rule change.
    - Test: every invalid session has a `primary_reason` that is a catalogue key; every
      hit, rule row, session and conversion carries `rules_version`; rule rows are unique
      per (`hit_id`, `rule_id`), and each `evidence` parses as a JSON object.

20. **Report totals reconcile with Silver.**
    - Why: dashboards that disagree are not believed.
    - Test: five sessions, one of them holding three conversions, plus one conversion
      with no session: `invalid_traffic_report` sums to 5 sessions and to the Silver hit
      count, and its `conversions` to the conversions that have a session; the three
      conversions add 3 to `conversions` and 1 to `sessions`. The verification query of
      BLUEPRINT.md 6.13 returns zeros on the fixture.

## Reference data

21. **Lists change all or nothing, and only through declared connections.**
    - Why: a half-loaded list silently changes verdicts; undeclared hosts bypass review.
    - Test: with a mocked client, HTTP 503, a body with no prefixes and a connection
      error each raise. An AWS body yields `192.0.2.0/24` from `192.0.2.1/24`, with
      `start_ip` 192.0.2.0 and `end_ip` 192.0.2.255. A CSV over 2 MiB streams and parses.
      Azure makes exactly two requests, the second to the linked
      `download.microsoft.com/download/...json`, recorded as `source_url`. Every list's
      URL starts with a declared API base of its connection. No model after the
      ingestions declares a connection.

22. **Catalogues are unique and complete.**
    - Why: a duplicate key splits counts; a missing list silently disables verification.
    - Test: rule keys, agent keys and (`list_key`, `cidr`) pairs are unique; every
      expected list is present. `ip_ranges_fresh` passes on fresh lists and fails with
      `aws` removed or with every snapshot 61 days old.

23. **Checks catch what they promise.**
    - Why: a check that never fails is decoration.
    - Test: one `MysteryBot/1.0` hit fails `agent_coverage`; removing a primary reason
      fails `session_hit_consistency`; an invalid yesterday after a valid day before
      fails `verdict_drift`, a single day passes; one human-looking invalid conversion
      fails `false_positive_guard`.

24. **Raw evidence stays in Silver.**
    - Why: IP addresses are personal data, and Gold and entities are shared widely.
    - Test: no Gold table this blueprint writes or extends, and no entity property, holds
      an IP, a full user agent, a JA4 or an evidence JSON; the agent report rows have no
      `ip` column. The evidence pages refuse a member without the evidence permission.

25. **Nothing leaves the workspace.**
    - Why: the default is shadow mode; acting on verdicts is a person's decision.
    - Test: no action, workflow or destination in this blueprint sends an exclusion, a
      conversion change or a message; `s.describe` lists connections only on
      `ref_ip_ranges`.
