# Ad fraud and bot detection

Your own invalid-traffic detection, running in your warehouse next to your conversions:
every request, session and conversion on your site gets a verdict with the evidence
behind it, replacing click-fraud tools such as ClickCease and black-box traffic
verification contracts.

## What you get

- SegmentStream's complete production rule set, published in full: 17 hard rules in a
  fixed precedence, 9 weighted weak rules (one reserved), every threshold, and the
  class, verdict and GIVT/SIVT logic, recalculated over all your history on each run.
- Every session classed as human, likely human, unverified, AI assistant, autonomous
  agent, crawler, spoofed, script or internal, with a verdict (valid, suspicious,
  invalid) and the rules that decided it.
- A proof for any session or lead: each rule that fired, on which request, with the
  values it saw (user agent against client hints, TLS fingerprint, Fetch Metadata,
  network, script runs, per-address volume).
- Claims checked against 21 public reference lists: a "GPTBot" or "ChatGPT-User" from an
  address its vendor does not publish is caught as spoofed; cloud, hosting and iCloud
  Private Relay ranges are told apart.
- Form submissions judged with their own request and their session, so bots never count
  as leads and real people behind a VPN still do.
- Invalid traffic by reason, class, channel, platform, network and country, and the AI
  agents and crawlers that read your pages, verified.

## Build it

```text
Read https://github.com/segmentstream/build-your-own/blob/main/AGENTS.md and follow it.
Build our Ad fraud and bot detection from the ad-fraud-detection blueprint.
```

## How it fits

- **marketing-analytics** (required): its tracker, hits, sessions and conversions are the
  evidence this blueprint judges; its counting, attribution and reports then read these
  verdicts.
- **crm**: a lead shows its website verdict and opens the proof.
- **company-agent**: ask "how much paid traffic was invalid last week, and why?" or "is
  this GPTBot really OpenAI?" in chat.

## What it is not

- Not real-time blocking. It judges traffic after the fact, in shadow mode; blocking
  belongs to your CDN or firewall.
- No cross-customer reputation: your build sees your own traffic only.
- Rules only. It does not check Web Bot Auth signatures cryptographically, use reverse
  DNS, or report phantom clicks yet; VARIATIONS.md describes how.
