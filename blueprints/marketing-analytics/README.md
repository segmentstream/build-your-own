# Marketing analytics

Web, product and marketing analytics as one data chain you own: your own tracker,
sessions, an identity graph, ad costs stitched to visits, declared conversions and
attribution. It replaces Google Analytics and the attribution reports inside ad
platforms.

## What you get

- Every page view and conversion lands in your own warehouse, collected by your own
  first-party tracker on the browser and the server, with no third-party tag.
- Channel reports you can explain row by row: each session's source, medium and
  campaign follow written rules, and each conversion shows the visits it was credited to.
- Spend, clicks, CPC, CTR, CPA and ROAS per platform, campaign and channel, from Google
  Ads and Meta costs joined to the sessions they paid for.
- First-click and last-click attribution computed side by side, over one identity graph
  that links a person's browsers when they sign in or leave an email.
- A report of which AI assistants, AI crawlers and search bots read which pages, kept
  apart from human traffic so bots never inflate your numbers.
- Data-quality pages that show tracking gaps, unmatched paid traffic and identity
  conflicts before they turn into wrong decisions.
- A parity kit for the weeks you run your previous tool side by side, so every
  difference is measured and explained rather than argued about.
- Answers from the workspace agent, such as "what did paid social cost per lead last
  month under last click?", computed from the same metrics as the reports.

## Build it

```text
Read https://github.com/segmentstream/build-your-own/blob/main/AGENTS.md and follow it.
Build our Marketing analytics from the marketing-analytics blueprint.
```

## How it fits

- **crm**: website leads carry a submission ID that the CRM's lead records too, so a
  lead in the CRM shows its first click and campaign, and won deals can become offline
  conversions.
- **ad-fraud-detection**: adds the full invalid-traffic rules on top of the same hits
  and sessions; this blueprint ships only the basic split of people, agents and bots.
- **email-marketing**: campaign links carry UTM tags, so email shows up as its own
  channel with its conversions.
- **company-agent**: the workspace agent answers analytics questions in chat with the
  metrics declared here.

## What it is not

- Not a tag manager or an audience tool: it does not fire third-party pixels, build
  remarketing audiences or send conversions back to ad platforms by default.
- Not real time: reports are rebuilt on a schedule, by default once a day after the
  ad platforms settle the previous day's costs.
- Advanced attribution models, budget and portfolio optimization, and incrementality
  experiments are not part of this blueprint; SegmentStream offers them as a service.

## Authors

- [SegmentStream](https://github.com/segmentstream)
