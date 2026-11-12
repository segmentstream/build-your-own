# Contributing

## Request a blueprint

Open a discussion in the **Blueprint requests** category. Describe the job the
software does for your company, the tool it would replace, and who uses it.
Upvote requests you need too. We build the most-wanted ones first.

Requests for one company's bespoke system are better served by a SegmentStream
pilot, where our engineers build the first version with you:
https://segmentstream.com/enterprise

## Report a problem

Open an issue when an agent built something wrong from a blueprint, or a
blueprint contradicts the platform. Include the blueprint, the agent you used,
what you asked, and what went wrong. Never include credentials, customer data
or exports.

## Improve a blueprint

Pull requests are welcome. Before you open one:

1. Read `docs/blueprint-format.md` and follow it.
2. Keep blueprints universal. Company-, industry- or country-specific behaviour
   belongs in `VARIATIONS.md`, not in the default design.
3. Use invented data only (Northwind, Ada Example, `example.com`).
4. Run `node scripts/check.mjs`. It validates every blueprint and rejects
   private data patterns.

By contributing you agree that your contribution is licensed under the
Apache License 2.0.
