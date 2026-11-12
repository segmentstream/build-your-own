# Ad fraud and bot detection: interview

Ask these in one message, after the marketing-analytics interview. Offer the
default for each.

1. **Which ad platforms do you pay for clicks on, and which matter most?**
   - Why: platforms differ in click IDs, click-level reports and what they let
     you exclude.
   - Changes: Google Ads adds the `ad_clicks` real adapter and phantom-click
     reports. Other platforms are reported through their click IDs on
     sessions, without click-level reports.
   - Default: Google Ads, with the `sample` click adapter until the connection
     is authorized.

2. **Where is your website served, and can code run on the server for every
   page request?** (Vercel, Cloudflare, another host or CDN, a site builder.)
   - Why: the strongest evidence (IP, TLS fingerprint, client hints,
     signature headers) exists only on the server.
   - Changes: on Vercel, the tracker's server part as it is. On another edge,
     map its request metadata to the same fields. With no server code, a
     browser-only build: scripts that never run JavaScript stay invisible.
   - Default: the tracker's server part on document requests.

3. **Do you send conversions back to ad platforms today?** (Offline
   conversions, enhanced conversions, a conversions API.)
   - Why: this is where invalid traffic does the most damage.
   - Changes: each existing feed gets the `effective_verdict` filter
     (invariant 16). Retracting conversions already sent is a variation.
   - Default: add the filter to every feed marketing-analytics built.

4. **Which outcome do you trust as proof of a real person?** (A paid order, a
   qualified lead, a booked call.)
   - Why: outcomes are the ground truth for reviews, the
     `invalid_with_outcomes` check and any decider's calibration.
   - Changes: which marketing-analytics outcome fills `outcomes`.
   - Default: the outcome marketing-analytics counts as a conversion.

5. **How should AI agents that browse or fetch for a person be treated?**
   - Why: an assistant reading your page for a buyer is not fraud, but it is
     not a human click either.
   - Changes: the verdict for the `agent` group (valid, suspicious or invalid)
     and whether their outcomes count.
   - Default: their own group, suspicious, outcomes counted and flagged.

6. **Which of your own traffic should be set apart?** (Office networks, uptime
   monitors, QA robots, test form submissions, preview hosts.)
   - Why: your team and your tools inflate both traffic and "fraud".
   - Changes: Known source records, added through the app after deploy, never
     written into code.
   - Default: none at first; add them as reviewers find them.

7. **Who reviews verdicts, and who may see raw evidence such as IP addresses
   and user agents?**
   - Why: IP addresses are personal data; reviewers need them, report readers
     do not.
   - Changes: who holds `traffic_analyst`, and whether `marketing` also reads
     Exclusion candidates.
   - Default: one or two analysts hold `traffic_analyst`; marketing reads
     reports without raw evidence.

8. **Rules only, or a decision model for the grey zone?**
   - Why: rules settle the certain cases; a model weighs context findings,
     unverified browsers and agents.
   - Changes: whether `decision_requests` and a decider asset are built, and
     which connection it uses.
   - Default: rules only, in shadow mode, for the first weeks.

9. **Where are your visitors, and what do your privacy notice and consent
   banner say?**
   - Why: collecting request evidence and keeping IP addresses is regulated
     differently by jurisdiction.
   - Changes: whether the tracker waits for consent, how long raw IPs are
     kept, whether reports truncate addresses (VARIATIONS.md).
   - Default: request evidence collected for fraud prevention as your privacy
     notice states; raw IPs only in analyst-only tables.

10. **How fresh must verdicts be?**
    - Why: every scheduled run wakes the pipeline service and costs compute.
    - Changes: the schedule of marketing-analytics' `web_analytics` job, which
      carries the verdict models.
    - Default: marketing-analytics' existing `web_analytics` and `references`
      schedules.

## Decisions a person makes every time

Never automate these, and never let the agent do them without the person's
explicit confirmation:

- Pushing an exclusion (address, network, placement) to an ad platform, and
  removing one.
- Retracting or restating a conversion already sent to an ad platform.
- Filing an invalid-click refund claim with evidence.
- Adding a known source, which removes matching traffic from human counts.
- Deleting evidence or shortening its retention.
