# Contributing

This repository grows through people who know a business from the inside. If
you have run, built or implemented the software an industry depends on (an ERP,
a booking system, a practice management tool, the books of a particular kind of
company), you know what a generic SaaS product gets wrong about it. A blueprint
is the way to share that knowledge so anyone's coding agent can build it right.

There are four ways to help, from smallest to largest.

## Request a blueprint

Open an issue with the **Request a blueprint** form. Describe the job the
software does for your company, the tool it would replace, and who uses it.
Add a thumbs-up to existing requests you need too. We build the most-wanted
ones first. [Wanted blueprints](docs/wanted.md) lists the ones we already know
people want.

Requests for one company's bespoke system are better served by a SegmentStream
pilot, where our engineers build the first version with you:
https://segmentstream.com/enterprise

## Report a problem

Open an issue with the **Build problem** form when an agent built something
wrong from a blueprint, or a blueprint contradicts the platform. Include the
blueprint, the agent you used, what you asked, and what went wrong. Never
include credentials, customer data or exports.

## Improve a blueprint

Most improvements are small and valuable: a missing invariant, a pitfall you
hit, a variation for your country or industry, a better interview question.
Open a pull request against the blueprint's files. Run `node scripts/check.mjs`
first.

## Contribute a blueprint

### 1. Propose it

Open an issue with the **Propose a blueprint** form before you write. Say what
the software does, who you are in that business, and what you would include and
leave out. A maintainer replies within a week: whether it overlaps an existing
blueprint, what it should depend on, and anything to settle first. This saves
you from writing something that has to be split or merged later.

### 2. Write it with your agent

You do not need to write the files by hand. Copy the template and let your
coding agent interview you:

```sh
git clone https://github.com/segmentstream/build-your-own
cd build-your-own
cp -r docs/blueprint-template blueprints/<id>
```

```text
Read CONTRIBUTING.md, docs/blueprint-format.md, foundation/FOUNDATION.md and two
existing blueprints in blueprints/. Then interview me about <the business> and
write the blueprint in blueprints/<id>/. Ask about the records, the rules that
must never break, what differs between companies, and the mistakes people make.
Run node scripts/check.mjs when you are done.
```

Your knowledge is the valuable part; the agent handles the format. Expect a few
rounds of answering its questions.

### 3. Meet the bar

A blueprint is merged when it is:

- **Specific.** Records with their properties and meaning, actions with their
  checks, roles, workflows and the build order: enough for an agent to build a
  working first version without guessing.
- **Universal.** It serves any company in that business. Choices that differ by
  country, size or customer type are written down as variations with a default,
  not built into the design.
- **Safe.** Every rule that would be a bug if broken is an invariant with a test.
  Money, messages to customers, signatures, deletion and access always need a
  human decision.
- **Built on the platform and the foundation.** It uses the shared Company,
  Contact and member records, and follows the platform rules in a project's
  `AGENTS.md`. It names its dependencies on other blueprints instead of copying
  them.
- **Clean.** Invented data only (Northwind, Ada Example, `example.com`). No real
  customers, people, amounts, IDs or internal hostnames. `node scripts/check.mjs`
  passes.

### 4. Review and status

A maintainer reviews the design, the invariants and the platform details, and
may try building it with an agent. New blueprints are merged as `preview`. A
blueprint becomes `stable` once a version of it runs in production on
SegmentStream for at least one company, whether ours, a customer's or yours.

### Credit and ownership

Add yourself to `authors` in the blueprint's `blueprint.json` with your GitHub
handle; the blueprint's README credits its authors. The author of a new
blueprint is asked to review later changes to it. Blueprints are maintained in
this repository; we keep them current as the platform changes.

## Licence

By contributing you agree that your contribution is licensed under the
Apache License 2.0 and provided on the terms of the [disclaimer](DISCLAIMER.md).
