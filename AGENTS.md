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
it, and `docs/testing.md` once. Do not build anything yet.

## 4. Interview the person

Ask the questions in each blueprint's `INTERVIEW.md` in one message. Skip what
the person already told you and merge overlapping questions across blueprints.
Put first the questions that need a human decision (money, messages to
customers, signatures, deletion, access); for the rest, state the default you
will take, so the person can answer "defaults are fine". Ask in plain words;
never ask for passwords, API keys or real customer records in chat.

## 5. Plan, then wait

Write a plan of at most one page: the entities, actions, roles, workflows,
pipeline assets, connections and screens you will build; the variations you
chose and why; what you leave out. Promise only what the platform can do today;
each blueprint's VARIATIONS.md and PITFALLS.md say where it cannot. Say that
the software will be the company's own, and name the parts a qualified
professional should check: anything with legal, tax or financial effect. Wait
for the person to approve or change the plan.

## 6. Build

1. Follow each blueprint's "Build order". Build the foundation first.
2. Set up the tests as `docs/testing.md` describes. Copy the files in `kernel/`
   without changing them.
3. Write the tests for the blueprint's invariants before or with the code they
   protect. Every invariant in `INVARIANTS.md` becomes a test, named after it:
   `crm 1. one submission id is one lead`.
4. Use invented data in code, tests and demos. Warehouse sources get a `sample`
   adapter that generates invented data and a `real` adapter that reads through
   a connection; both write the same contract table.
5. Never put credentials, real records, exports or customer names in the
   repository. Connections hold credentials; real data arrives through
   connections, event streams and actions.
6. Keep a build record in `BLUEPRINTS.md` at the project root, and add a line
   pointing to it below the managed block of the project's `AGENTS.md`. For each
   blueprint record: its id and `version`, the date you read it, the variations
   you chose and the answer that chose each, every deviation from the blueprint
   and why, and the test that covers each invariant. Update it with every change.

## 7. Check

A build reaches three milestones; `docs/testing.md` lists what runs at each.

- **M1, local:** `npm --prefix ontology run check` with no errors or warnings,
  the ontology's typecheck, build and tests, the app's typecheck and build
  (see `docs/testing.md` for apps with page navigation),
  pipeline validation and tests, and the agent's typecheck. M1 needs no
  SegmentStream account. Run these checks after every meaningful step.
- **M2, linked:** with a linked workspace, exercise every changed screen and
  action with `segmentstream dev`, as the project's README describes.
- **M3, deployed:** step 8.

Trigger nothing with an external effect (an email, a signature request, a
ledger posting, a payment) that the person has not approved.

## 8. Deploy

1. Show the person what will be deployed and get explicit approval.
2. If no workspace is linked, run `segmentstream link`. Creating a workspace
   needs the person to confirm the region (`eu` or `us`); it cannot be changed.
3. Commit, then run `segmentstream deploy`.
4. List the connections the person must authorize (in the console, or with
   `segmentstream connection authorize <key>`), then run the jobs that load
   history once they are authorized.

If the person has no SegmentStream access yet, stop at M1: the project, plan,
build record and passing tests are ready, and they can request access at
https://segmentstream.com/#waitlist.

## 9. Report

Tell the person, briefly: what was built, how to open it, what each role can
do, which connections are pending, what you left out and every deviation from
the blueprint, which milestone the build reached, and which blueprints would
extend it. Suggest a first thing to try with real data. Remind the person that
the software is theirs to review and test, and name the parts a qualified
professional should check before they rely on it.

## Updating a build

When the person asks to bring their software up to date with a blueprint, read
`BLUEPRINTS.md` in their project and the entries of `CHANGELOG.md` in this
repository since the version it records. Propose the changes that apply to their
build, wait for approval, apply them with their tests, and update the record.

## When you are unsure

- Prefer the project's rules, then the blueprint's invariants, then its
  defaults.
- Ask instead of guessing when an answer changes money, messages to customers,
  signatures, deletion or access.
- Never tell the person that what you built is compliant, legally valid,
  secure, audited, certified or equivalent to a named product. Say what it does
  and which tests pass, and name who should check the rest.
- If a blueprint is wrong or out of date, say so and suggest the person opens an
  issue in this repository with what happened.
