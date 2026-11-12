# Ad fraud and bot detection: interview

Ask these in one message, after the marketing-analytics interview. Offer the default for
each.

1. **Where is your website served, and can code run on the server for every page
   request?** (Vercel, Cloudflare, another host or CDN, a site builder.)
   - Why: IP, TLS fingerprint, client hints, Fetch Metadata and signature headers exist
     only on the server; half the rules read them.
   - Changes: on Vercel, the tracker's server part as it is; on another edge, a sender
     mapping its metadata to the same fields; with no server code, browser-only evidence
     and most request rules silent.
   - Default: the tracker's server part on every document request.

2. **Which forms and sign-ups count as conversions, and do they post through your own
   server?**
   - Why: a conversion sent with the visitor's request is judged by its own request and
     its session; one without request evidence takes its session's class only.
   - Changes: which marketing-analytics conversions get the form profile.
   - Default: every conversion sent from the site's server with the visitor's request.

3. **How should AI agents be treated?**
   - Why: an assistant fetching your page for a buyer is not fraud, but it is not a
     visit either.
   - Changes: the verdicts for `ai_assistant` and `autonomous_agent` and whether their
     conversions count (VARIATIONS.md).
   - Default: production's: assistant fetches invalid and shown on the agents page;
     autonomous agents suspicious, their conversions counted and flagged.

4. **What traffic is your own?** Tools that call your site (their user-agent prefix),
   a `utm_medium` value your team uses for test links, preview-deployment hosts, your
   domains, and how test form submissions are marked.
   - Why: your team and tools inflate traffic and "fraud".
   - Changes: the internal-traffic constants in pipeline code.
   - Default: localhost and your host's preview suffix; your marketing-analytics domain
     list; other values added as they are found, each in a rules release.

5. **Who may see raw evidence such as IP addresses and user agents?**
   - Why: IPs are personal data; reviewers need them, report readers do not.
   - Changes: the permission the evidence pages check, or a separate evidence
     permission.
   - Default: whoever may read leads (with the crm blueprint) or conversions.

6. **Where are your visitors, and what do your privacy notice and consent banner say?**
   - Why: collecting request evidence and keeping IPs is regulated differently by
     jurisdiction.
   - Changes: consent handling in the tracker, retention, truncated exports.
   - Default: evidence collected for fraud prevention as your notice states; raw IPs only
     in Silver and on the evidence pages.

7. **How fresh must verdicts be?**
   - Why: each scheduled run costs compute.
   - Changes: the cron of marketing-analytics' `web_analytics` and `references`
     schedules.
   - Default: marketing-analytics' daily rebuild and weekly lists; production's hourly
     rebuild and daily lists when same-day answers matter.

8. **Which ad platforms do you pay for clicks, and do you want click-level evidence?**
   - Why: sessions are judged on every platform through their click IDs; phantom clicks
     need click-level reports, which production has not built.
   - Changes: whether the click-report variation is built, with the `google_ads`
     connection.
   - Default: click IDs on sessions only; platform as a report dimension.

9. **Do you send conversions back to ad platforms today?**
   - Why: a bot's form fill sent to bidding teaches it to buy more bots.
   - Changes: every such feed sends only `counted` conversions.
   - Default: apply that filter to every feed marketing-analytics built.

10. **Do you want reviews or internal sources kept as records?**
    - Why: production fixes mistakes in code; some teams want analysts to record
      decisions live.
    - Changes: the `verdictReview` and `knownSource` variations, with their actions.
    - Default: neither, for the first weeks of shadow mode.

## Decisions a person makes every time

Never automate these, and never let the agent do them without the person's explicit
confirmation:

- Pushing an exclusion (address, network, placement) to an ad platform, or removing one.
- Retracting or restating a conversion already sent to an ad platform.
- Filing an invalid-click refund claim with evidence.
- Changing a rule, threshold or internal-traffic constant, which reclassifies all
  history on the next run.
- Deleting evidence or shortening its retention.
