# Ad fraud and bot detection: pitfalls

1. **Data-centre traffic marked as bots.**
   - Symptom: invalid share jumps on weekdays; invalid sessions place orders.
   - Cause: a rule that makes cloud, hosting, VPN or Private Relay addresses
     invalid. Corporate VPNs, security proxies, cloud browsers and Apple's
     relay carry real customers.
   - Instead: network kind is a context finding. Let a decider weigh it with
     the rest, and watch `invalid_with_outcomes`.

2. **Missing data read as evidence.**
   - Symptom: after a consent banner, a tracker upgrade or a new field, a wave
     of "bots" with nothing in common but a null.
   - Cause: rules such as "no tracker run" or "no signature header" firing on
     fields the visitor never had a chance to send, or that older events lack.
   - Instead: a missing signal is unknown. Fire rules on present values that
     contradict each other, never on absence alone (invariant 7). Keep a new
     signal's rule disabled until its collection is live and measured.

3. **A broken list download makes every crawler a spoofer.**
   - Symptom: overnight, all Googlebot or ChatGPT-User hits become `spoofed`,
     or every agent becomes unverified.
   - Cause: an empty or partial list published as current, or a vendor that
     moved its list URL or changed its format (JSON keys differ by vendor;
     some publish CSV).
   - Instead: parse each format explicitly, fail the run on an empty parse,
     keep the previous table, and treat stale lists as unknown (invariants 9
     and 11). Take URLs from the vendor's documentation, not from memory.

4. **Context counted per hit.**
   - Symptom: engaged visitors who read ten pages are the most suspicious.
   - Cause: summing context findings over hits instead of distinct rules.
   - Instead: count distinct context rules per session (invariant 5).

5. **Two definitions of a session.**
   - Symptom: Traffic quality and the marketing reports disagree on sessions
     for the same day.
   - Cause: this blueprint regrouping hits into its own sessions, or pairing
     page views and requests differently.
   - Instead: judge marketing-analytics' hits and sessions by their IDs. Fix
     pairing or session IDs there.

6. **Document rules applied to form posts.**
   - Symptom: most leads from real people come out as bots.
   - Cause: a form submission has no page view of its own, no navigation
     headers and no history, so rules written for page loads all fire.
   - Instead: judge submissions with the form profile, and let the session
     the form belongs to supply its own evidence.

7. **Test traffic hard-coded.**
   - Symptom: a list of office addresses, a QA user agent or a test submission
     ID in pipeline code; it goes stale and nobody knows who added it.
   - Cause: treating a decision about particular traffic as code.
   - Instead: a Known source record, added through `known_source.add` with a
     reason and expiry, read from the replicated view.

8. **The decider asked again on every rebuild.**
   - Symptom: the decision model's bill grows with history; past verdicts
     flicker between runs.
   - Cause: sending every session to the decider on each full rebuild.
   - Instead: key answers by evidence hash and decider version, ask only for
     new hashes, and reuse stored answers (invariant 13).

9. **Claims counted as verification.**
   - Symptom: reports of "AI assistants read our site 50 times a day" built on
     user-agent strings; spoofed crawlers counted as Google.
   - Cause: trusting a user agent or a `Signature-Agent` host.
   - Instead: verify against the vendor's own list; count AI fetches only when
     verified (invariant 8). A fetch is a page request, not a citation.

10. **Visitor-controlled inputs trusted.**
    - Symptom: forged page views with a perfect browser profile; every bot
      "comes from" the same address the attacker chose.
    - Cause: browser signals are self-reported, and anyone can post a page view
      to an origin-admitted stream; an IP read from a client-settable header
      such as `X-Forwarded-For`.
    - Instead: prefer matched hits, watch the share of client-only hits, and
      read the IP only from the hosting platform's trusted source.

11. **Substring matches on user agents.**
    - Symptom: phones of one brand, or one app's in-app browser, flagged as
      bots.
    - Cause: a generic pattern such as `bot` or `crawl` matching inside a
      device or app name, or a short catalogue token matching inside a longer
      one.
    - Instead: match catalogue tokens as whole tokens, most specific first, and
      apply generic patterns only to user agents that are not browsers.

12. **Exclusions that block customers.**
    - Symptom: conversions drop after an exclusion list is uploaded.
    - Cause: excluding Private Relay, carrier NAT or office-proxy addresses
      shared by thousands of people, with no expiry.
    - Instead: never propose shared addresses; give every exclusion an
      expiry; require invalid sessions and zero outcomes; a person approves
      each batch.

13. **Phantom clicks inflated.**
    - Symptom: a third of paid clicks "never arrived".
    - Cause: matching click IDs only against tracker page views, while consent
      banners and ad blockers stop the tracker for real visitors.
    - Instead: match against every hit, server-only included (invariant 20),
      and compare the phantom share with your consent rate before blaming the
      platform.

14. **Raw evidence exposed by a wildcard.**
    - Symptom: every member can list visitors' IP addresses through the
      ontology or the agent.
    - Cause: the starter's `member: { permissions: ["*:read"] }` also covers
      Traffic hit and Rule match, and app warehouse queries skip the user
      check.
    - Instead: list member reads explicitly; check `traffic_hit:read` before
      any app query that returns raw evidence (invariant 19).

15. **The agent obeys the attacker.**
    - Symptom: after explaining a session, the agent proposes a known source
      nobody asked for.
    - Cause: user agents, referrers, query strings and form text are written
      by the visitor, and an agent reading them as instructions.
    - Instead: say in the agent's instructions that evidence is data; give
      `known_source.add` and `verdict_review.review` no non-destructive hints,
      so the agent always asks first; never grant them to a workflow role or
      agent task.
