# Ad fraud and bot detection: invariants

Each rule holds in every version. Pipeline tests run the models on invented
events (documentation addresses such as 192.0.2.10 and 2001:db8::1, browser
IDs such as `b-ada`, invented user agents); ontology tests call the actions.

1. **Nothing is dropped.** Every marketing-analytics hit appears once in
   `traffic_hits` and every session once in `traffic_sessions`, whatever its
   verdict.
   - Why: invalid traffic is the evidence. A filter that drops it hides fraud
     and makes reports disagree with marketing-analytics.
   - Test: ten hits in four sessions, including a curl request, a crawler and
     an internal hit. Expect ten distinct `hit_id`s, four sessions, and session
     `hits` summing to ten.

2. **Every invalid verdict has its proof.** Each session has exactly one
   verdict (`valid`, `suspicious`, `invalid`); an invalid one has a primary
   reason that is a decisive rule in the catalogue, with at least one rule
   match carrying non-empty evidence.
   - Why: a verdict nobody can explain cannot be trusted, reviewed or used as
     a refund claim.
   - Test: over the fixture, every invalid session has a `rule_match` row whose
     `rule_key` equals its `primary_reason` and whose `evidence` parses as a
     non-empty JSON object; every `rule_key` exists in `ref_traffic_rules`.

3. **Every verdict names what produced it.** `rules_version`, `decided_by` and
   `decider_version` are never null.
   - Why: rules and deciders change; without versions, drift cannot be told
     from a change in traffic.
   - Test: run with `RULES_VERSION` set to a test value; every hit, match and
     session carries it.

4. **One decisive hit decides the session.** A decisive finding on any hit
   makes the session invalid, whatever its other hits show.
   - Why: a script that loads one real page alongside its requests must not
     pass as human.
   - Test: one browser ID with a tracker-confirmed hit and a `curl/8.0` hit in
     the same session. Expect `invalid`, primary reason `http_library`.

5. **Context counts once per session.** `contextFindings` counts distinct
   context rules, never hits.
   - Why: counting per hit turns every long human visit into a suspect.
   - Test: five hits that each fire `cloud_network` give 1; adding one hit
     that fires `hints_mismatch` gives 2.

6. **Context alone never invalidates.** Network kind (cloud, hosting, VPN,
   Tor, Private Relay, carrier), address volume and hint inconsistencies never
   make a session invalid under the `rules` decider.
   - Why: corporate VPNs, Private Relay and mobile carriers put many real
     customers behind one address.
   - Test: a tracker-confirmed browser on a cloud range, firing
     `address_burst` and `hints_mismatch`. Expect not `invalid`.

7. **Absence is not evidence.** A missing signal (tracker blocked or refused
   consent, a field older events lack, a null IP or user agent field) never
   fires a rule on its own.
   - Why: consent banners, ad blockers and tracker upgrades would otherwise
     flood reports with false bots.
   - Test: a server-only hit with a browser user agent and null client fields
     gives `unverified`, `suspicious`; an event without signature fields
     does not fire `declared_agent`; a null IP fires no network or burst rule
     and joins no other null-IP hit's counts.

8. **A claim is not verification.** `vendor_ip_verified` is true only when the
   address is on that vendor's own fresh list. A user agent or a
   `Signature-Agent` header alone never verifies, and only verified hits count
   as AI fetches.
   - Why: any script can send "ChatGPT-User" or a signer header.
   - Test: a GPTBot user agent from an address on another vendor's list is not
     verified; a recognized `Signature-Agent` from an unlisted address has
     method `signature_declared` and is not verified; neither adds to
     `verifiedFetches`.

9. **Missing reference data is unknown, never spoofed.** A missing, stale or
   unreadable list, or a missing or malformed IP, gives null verification and
   never fires `crawler_ip_mismatch`.
   - Why: a failed download must not turn every real crawler into a spoofer.
   - Test: GPTBot user agent with a list older than the freshness window, with
     no list, and with IP `not-an-ip`: all null, none spoofed. With a fresh
     list and an outside address: `crawler_ip_mismatch`, class `spoofed`.

10. **Overlapping ranges never multiply hits.** Each hit gets one display
    network, and range bounds are exact for both address families.
    - Why: a cloud range containing a crawler range would otherwise double
      the hit and its session.
    - Test: an address inside 192.0.0.0/8 (cloud), 192.0.2.0/24 and
      192.0.2.0/25 (a crawler list) gives one row, verified for that vendor.
      The first and last addresses of 2001:db8:1::/48 match; 2001:db8:2:: does
      not.

11. **Reference lists change all or nothing, and only in their own job.** A
    failed or empty fetch fails the `references` run and leaves the previous
    table; classification models declare no connections.
    - Why: a half-loaded list silently changes verdicts, and a fetch inside
      the scheduled rebuild makes analytics depend on vendors' uptime.
    - Test: a list returning HTTP 500, and one returning a body with no
      prefixes, both raise. `s.describe` lists no connections on any model
      from `traffic_hits` onwards.

12. **Rebuilds are deterministic and correct the past.** The same inputs give
    identical tables; a late event, a list change, a rule change or a review
    reclassifies earlier dates.
    - Why: verdicts feed money decisions; they must be reproducible and
      current.
    - Test: run twice and compare every row. Then add a late `curl` hit,
      dated two days back, to a valid session; it becomes invalid.

13. **Rules settle, deciders judge only the rest.** A decider's answer is used
    only for sessions without a decisive finding, and only for the evidence
    hash it answered.
    - Why: a model must not talk a spoofed crawler back into a human, and an
      answer about old evidence is not an answer about new evidence.
    - Test: a decider fixture answering `valid` for a session with
      `crawler_ip_mismatch` leaves it invalid; an answer for a stale hash is
      ignored and the rules' answer applies.

14. **Decision requests carry no identifiers.** No IP, browser ID, click ID,
    email or full user agent leaves the warehouse for a decider.
    - Why: the decider needs the evidence, not the person.
    - Test: the `decision_requests` schema has none of those columns, and no
      value in the fixture's rows matches an IPv4 or IPv6 pattern.

15. **Reviews change only the effective verdict.** A review sets
    `effective_verdict`; the computed verdict, reasons and evidence stay as
    computed, and withdrawing the review restores the computed one.
    - Why: reviews are labels for calibrating rules; overwriting the computed
      verdict would hide what the rules got wrong.
    - Test: review an invalid session as `valid`: effective `valid`, verdict
      still `invalid`, reasons unchanged. Withdraw: effective `invalid`.

16. **Invalid sessions never count as conversions.** Marketing-analytics'
    conversion counting gives them `invalid_traffic`, attribution skips them,
    and every conversion feed to an ad platform reads `effective_verdict` and
    leaves out `invalid`.
    - Why: a bot's form fill sent to an ad platform teaches bidding to buy
      more bots.
    - Test: a feed fixture with three conversions, one from an invalid
      session, sends two.

17. **Known sources apply only while active and unexpired, and never make
    traffic human.** The treatments are `internal` and `tool` only.
    - Why: an allow-list that turns an address into "human" is a hole any
      attacker on that network can use.
    - Test: an `ip_network` source expired yesterday, and a retired one, leave
      matching sessions unchanged; an active one makes them `internal`.

18. **`known_source.add` refuses over-broad values.**
    - Why: one careless entry could mark a whole country's traffic internal.
    - Test: `10.0.0.0/8` refused; token `Mozilla` refused; token `ab` refused;
      `198.51.100.0/24` accepted; adding it twice returns the same record.

19. **Raw evidence stays behind its permission.** Of this blueprint's
    entities, only Traffic hit, Rule match and Exclusion candidate hold raw
    IPs or full user agents; app code that reads them checks
    `traffic_hit:read` first.
    - Why: IP addresses are personal data, and reports are shared widely.
    - Test: `traffic_sessions`, `ad_click_matches` and every gold table except
      `exclusion_candidates` have no column holding an IP or a full user
      agent; the proof route, called by a user without the permission,
      returns no IP.

20. **A phantom click had no hit at all.** A click is phantom only when no hit
    (matched, client-only or server-only) carried its click ID within the
    window; each click matches at most one session.
    - Why: counting server-only arrivals as phantom blames the ad platform for
      visitors whose tracker was blocked.
    - Test: three clicks: one matched by a `matched` hit, one by a server-only
      hit, one by none. Expect one phantom; a click ID seen in two sessions
      matches the earlier one only.

21. **Report totals reconcile.** Sessions summed by any dimension equal the
    total for the range; distinct counts (browsers, addresses) are never
    summed across rows.
    - Why: dashboards that disagree with each other are not believed.
    - Test: `invalidSessions` grouped by channel sums to the ungrouped value;
      one address seen on two pages counts as one distinct address for the
      range.
