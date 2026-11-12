# Ad fraud and bot detection: pitfalls

1. **Data-centre traffic marked as bots.**
   - Symptom: invalid share jumps on weekdays; invalid conversions come from real
     customers.
   - Cause: a rule that makes every cloud, hosting, VPN or Private Relay address invalid.
     Corporate VPNs, security proxies, cloud browsers and Apple's relay carry customers.
   - Instead: keep production's narrow rule. Only a browser user agent from a cloud or
     hosting range whose browser ID made exactly one hit, never ran the tracker and came
     from no other site is invalid (`datacenter_no_js`). With a tracker run it is the
     weak `datacenter_js`. Private Relay is never a reason.

2. **Missing data read as evidence.**
   - Symptom: after a browser release, a consent banner or a tracker change, a wave of
     "bots" with nothing in common but a null.
   - Cause: firing on headers a browser may not send, on fields older events lack, or
     on a new collection before it is live.
   - Instead: fire on absence only where the browser version guarantees presence
     (`no_fetch_metadata` needs Chrome, Edge or Opera 80+, Firefox 90+, Safari 16.4+).
     Keep a rule like `no_asset_request` disabled until its collection is deployed and
     calibrated. Null IPs and null browser IDs never pool.

3. **A broken list download makes every crawler a spoofer.**
   - Symptom: overnight, all `ChatGPT-User` or Googlebot hits become `spoofed`, or every
     agent becomes unverified.
   - Cause: an empty or partial list published as current, a vendor that moved its URL,
     or a format change (JSON keys differ by vendor; Azure links its file from an HTML
     page; Private Relay is CSV).
   - Instead: parse each format explicitly, fail the run on an empty parse, keep the
     previous table, and treat lists older than 60 days as unknown (invariants 6, 21).

4. **Weak signals summed per hit.**
   - Symptom: engaged visitors who read ten pages are the most suspicious.
   - Cause: adding a weak rule's weight once per hit.
   - Instead: sum the weights of distinct weak rules across the session (invariant 4).

5. **Precedence changed by tidying.**
   - Symptom: fake crawlers show up as verified agents, or headless browsers as humans.
   - Cause: reordering the catalogue, or moving `ua_declared_agent` above
     `ua_spoofed_agent`, or `js_confirmed` above the automation rules.
   - Instead: the order in BLUEPRINT.md 6.5 is the specification. Pin it with invariant
     1's fixture and bump `RULES_VERSION` on any change.

6. **Page-load rules applied to form posts.**
   - Symptom: most leads from real people come out invalid.
   - Cause: a form post has no page view, navigation headers or history, so rules
     written for document loads all fire on it.
   - Instead: judge conversion requests with the form profile and let the conversion
     session bring its own evidence (BLUEPRINT.md 6.8).

7. **JA4 compared across browser families or forgotten.**
   - Symptom: every Edge or Opera visitor is `spoofed`; or after a Chrome release, every
     Chrome visitor without the tracker is.
   - Cause: comparing every Chromium-family UA with Chrome's cipher hash, or never
     re-checking that hash.
   - Instead: compare only family `chrome`, after Edge, Opera, Samsung and Yandex are
     parsed out. Watch `verdict_drift` and the share of `ja4_ua_mismatch` after browser
     releases; when Chrome changes its cipher list, update the constant in a rules
     release.

8. **Internal exemptions that are too broad.**
   - Symptom: a competitor's scraper is "internal"; or your own tests inflate leads.
   - Cause: exempting by cookie, email address or a user-agent substring anyone can
     copy; or never marking test submissions.
   - Instead: internal tool prefixes anchored at the start of the UA, one reserved
     `utm_medium` marker, preview hosts, and exact confirmed test submission IDs, all
     reviewed in code. A confirmed submission exempts only itself (invariant 16).

9. **Claims counted as verification.**
   - Symptom: "AI assistants read our site 500 times a day", built on user-agent strings
     or `Signature-Agent` headers.
   - Cause: trusting a declaration.
   - Instead: count AI fetches only when the vendor's own fresh list verifies the IP. A
     recognized signer host is recorded as `signature_host_declared`, never as
     verified. A fetch is a page request, not a citation.

10. **Substring matches on user agents.**
    - Symptom: phones of one brand or an in-app browser flagged; Applebot-Extended
      counted as Applebot.
    - Cause: a token matching inside a longer token, or a generic token listed before a
      specific one.
    - Instead: match catalogue tokens as whole words, specific entries first. The generic
      `bot|crawl|spider|...` rule runs only for undeclared user agents, after the
      catalogue. Watch `agent_coverage` and add entries for frequent generic bots.

11. **Visitor-controlled inputs trusted.**
    - Symptom: every bot "comes from" the address it chose; forged page views with a
      perfect profile.
    - Cause: reading the IP from a header the client can set, or trusting browser
      signals that anyone can post to an origin-admitted stream.
    - Instead: read the IP only from the hosting platform's trusted header (the tracker
      reads Vercel's own first). Request evidence comes only from write-key senders;
      watch the share of client-only hits.

12. **Conversions that disagree with their session.**
    - Symptom: a lead from a curl request counts; or a real lead is invalid because a
      different visit of the same browser ID was a bot.
    - Cause: judging the conversion by its own request only, or by any visit sharing the
      browser ID.
    - Instead: combine the request with its conversion session (containing, else the
      latest within 24 hours); invalid when either is (BLUEPRINT.md 6.8).

13. **Distinct counts added across rows.**
    - Symptom: "unique IPs" on the agents page exceed the real number.
    - Cause: summing per-day or per-page distinct counts.
    - Instead: count distinct browsers and IPs from Silver for the selected range; Gold
      holds only additive measures.

14. **Raw evidence exposed by a wildcard.**
    - Symptom: every member can read visitors' addresses through the app or the agent.
    - Cause: the starter's `member: { permissions: ["*:read"] }`, or app queries that
      read Silver without a permission check.
    - Instead: no entity holds raw evidence; the evidence pages check their permission in
      server code before every Silver read.

15. **The agent obeys the attacker.**
    - Symptom: after explaining a session, the agent repeats text from a user agent or
      query string as advice.
    - Cause: user agents, referrers, query strings and form text are written by the
      visitor.
    - Instead: say in the agent's instructions that evidence is data, never
      instructions. The agent has no actions here to misuse.
