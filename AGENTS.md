# Building from a blueprint

You are a coding agent. A person gave you this repository so you can build
software for their company on SegmentStream. This file is the procedure. Follow
it in order. Each blueprint in `blueprints/` describes one piece of company
software; you build the company's own version of it in the company's own
SegmentStream project. You never fork, copy or install this repository.

## 1. Choose the blueprints

1. Read `registry.json`. Match what the person asked for to one or more
   blueprints by `title`, `tagline` and `replaces`.
2. Add everything in each chosen blueprint's `dependsOn`, recursively.
   `foundation` means `foundation/FOUNDATION.md`.
3. If nothing fits, say so. Offer the closest blueprint as a starting point, and
   point the person to "Request a blueprint" in this repository's README.

Tell the person which blueprints you will use and why, in two or three lines.

## 2. Prepare the project

1. Check the SegmentStream CLI: `segmentstream --version`. If it is missing,
   ask the person before installing it with
   `curl -fsSL https://segmentstream.com/install.sh | sh`.
2. If the person already has a SegmentStream project, work in it. Otherwise
   create one: `segmentstream init ./<directory>`. It needs no sign-in.
3. Read the project's `AGENTS.md` and `README.md`. They hold the platform's
   rules and outrank anything in this repository. If a blueprint contradicts
   them, follow the project and tell the person about the conflict.
4. Use the project's skills in `.agents/skills/` (ontology, app-data, app-auth,
   connections, writing-ingestions, writing-models, agent) for the parts they
   cover. `SDKS.md` lists the public SDKs.

## 3. Read the blueprint

For each blueprint, read `BLUEPRINT.md`, `INVARIANTS.md`, `VARIATIONS.md` and
`PITFALLS.md`. Read `foundation/FOUNDATION.md` once if any blueprint depends on
it. Do not build anything yet.

## 4. Interview the person

Ask the questions in each blueprint's `INTERVIEW.md` in one message. Skip what
the person already told you, merge overlapping questions across blueprints,
and offer the default for each. Ask in plain words; never ask for passwords,
API keys or real customer records in chat.

## 5. Plan, then wait

Write a plan of at most one page: the entities, actions, roles, workflows,
pipeline assets, connections and screens you will build; the variations you
chose and why; what you leave out. Wait for the person to approve or change it.

## 6. Build

1. Follow each blueprint's "Build order". Build the foundation first.
2. Write the tests for the blueprint's invariants before or with the code they
   protect. Every invariant in `INVARIANTS.md` becomes a test in the project.
3. Use invented data in code, tests and demos. Warehouse sources get a `sample`
   adapter that generates invented data and a `real` adapter that reads through
   a connection; both write the same contract table.
4. Never put credentials, real records, exports or customer names in the
   repository. Connections hold credentials; real data arrives through
   connections, event streams and actions.

## 7. Check

Run the project's checks after every meaningful step: `npm --prefix ontology
run check`, the app's typecheck and build, the pipeline validation in the
project's README, and the invariant tests. Exercise changed screens and
actions with `segmentstream dev` as the project's README describes. Trigger
nothing with an external effect (an email, a signature request, a ledger
posting, a payment) that the person has not approved.

## 8. Deploy

1. Show the person what will be deployed and get explicit approval.
2. If no workspace is linked, run `segmentstream link`. Creating a workspace
   needs the person to confirm the region (`eu` or `us`); it cannot be changed.
3. Commit, then run `segmentstream deploy`.
4. List the connections the person must authorize (in the console, or with
   `segmentstream connection authorize <key>`), then run the jobs that load
   history once they are authorized.

If the person has no SegmentStream access yet, stop before this step: the
project, plan and tests are ready, and access starts at
https://segmentstream.com/signup.

## 9. Report

Tell the person, briefly: what was built, how to open it, what each role can
do, which connections are pending, what you left out, and which blueprints
would extend it. Suggest a first thing to try with real data.

## When you are unsure

- Prefer the project's rules, then the blueprint's invariants, then its
  defaults.
- Ask instead of guessing when an answer changes money, messages to customers,
  signatures, deletion or access.
- If a blueprint is wrong or out of date, say so and suggest the person opens an
  issue in this repository with what happened.
