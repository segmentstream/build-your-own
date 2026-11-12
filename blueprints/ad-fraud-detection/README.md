# Ad fraud and bot detection

Your own invalid-traffic detection, running in your warehouse next to your
conversions: every website session gets a verdict with the evidence behind it,
replacing click-fraud tools such as ClickCease and black-box traffic
verification contracts.

## What you get

- Every session on your site classified as human, unverified, AI agent,
  crawler, bot or internal, with a verdict (valid, suspicious, invalid) and
  the rules that decided it.
- A proof for any session: each rule that fired, on which request, with the
  values it saw (user agent, client hints, TLS fingerprint, network, script
  run, request volume).
- Claims checked against evidence: a "Googlebot" or "ChatGPT-User" from an
  address its vendor does not publish is caught as spoofed, with the proof,
  and agents that sign their requests (Web Bot Auth) are recorded as such.
- Invalid and suspicious traffic by channel, campaign, platform, network and
  country, and paid clicks that never reached your site.
- A clean signal for your ad platforms: invalid sessions never count as
  conversions, so bidding stops learning from bots.
- Exclusion candidates (addresses, networks, placements) ranked by invalid
  sessions and outcomes, with shared networks such as Private Relay left out.
- A decision step you own: start with transparent rules, then plug in your own
  scoring or a decision model for the grey zone.

## Build it

```text
Read https://github.com/segmentstream/build-your-own/blob/main/AGENTS.md and follow it.
Build our Ad fraud and bot detection from the ad-fraud-detection blueprint.
```

## How it fits

- **marketing-analytics** (required): its tracker, event stream, hits and
  sessions are the evidence this blueprint judges. Its reports, conversion
  counting and attribution then read these verdicts instead of its basic
  split of people, agents and bots.
- **crm**: leads that came from invalid sessions are flagged, not deleted.
- **company-agent**: ask "how much paid traffic was invalid last week, by
  campaign?" or "why was this session marked invalid?" in chat.

## What it is not

- Not real-time blocking. It judges traffic after the fact, in shadow mode.
  Blocking at the edge belongs to your CDN or firewall.
- No cross-customer reputation. Enterprise vendors see the same attacker across
  thousands of advertisers; your build sees your own traffic only.
- The example rules are starting points and are public, so evaders know them.
  Detection quality comes from the rules and thresholds you tune on your own
  traffic, and keep private.
