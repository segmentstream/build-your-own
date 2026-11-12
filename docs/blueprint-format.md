# Blueprint format

A blueprint describes one piece of company software well enough that a coding
agent can build a version of it for a specific company on SegmentStream. It is
not a template to fork. The agent reads it, asks the person what differs in
their company, and writes their own version in their own project.

Every blueprint lives in `blueprints/<id>/` and has the same files. Each file
has one job, so an agent can load only what it needs.

| File | Reader | Job |
| --- | --- | --- |
| `blueprint.json` | Scripts, agents | Machine-readable metadata, merged into `registry.json` |
| `README.md` | People | What you get, who it is for, the prompt to start |
| `BLUEPRINT.md` | Agents, builders | The design: purpose, records, actions, roles, workflows, data flow, screens, the agent's skills |
| `INTERVIEW.md` | Agents | The questions to ask before building, and what each answer changes |
| `INVARIANTS.md` | Agents, reviewers | Rules that must hold in every version, each with how to test it |
| `VARIATIONS.md` | Agents | Where companies legitimately differ, the options, and the default |
| `PITFALLS.md` | Agents | Mistakes already made on the platform, and how to avoid them |

Shared files live outside the blueprints. [`kernel/`](../kernel/) holds files an
agent copies into a project without changing them, such as the test harness;
[testing](testing.md) says how to use them. A blueprint refers to them and never
keeps its own copy. Reference implementations (`workspace/`) and screenshots
(`screens/`) are added per blueprint as they are extracted; `blueprint.json`
says which exist.

## blueprint.json

```json
{
  "id": "crm",
  "version": "0.1.0",
  "title": "CRM",
  "tagline": "Companies, contacts, leads and a deal pipeline shaped to how you sell.",
  "replaces": ["HubSpot", "Salesforce"],
  "status": "preview",
  "dependsOn": ["foundation"],
  "worksWith": ["email-marketing", "company-agent"],
  "connections": {
    "required": [],
    "optional": ["hubspot", "gmail", "telegram"]
  },
  "components": ["ontology", "app", "agent"],
  "sdks": ["@segmentstream/ontology", "@segmentstream/app"],
  "reference": false,
  "screens": [],
  "testedWith": {
    "@segmentstream/ontology": "0.92.1",
    "@segmentstream/app": "0.38.1"
  },
  "authors": ["segmentstream"]
}
```

- `version`: the blueprint's version. `0.x` while `preview`, `1.0.0` from
  `stable`. Raise the minor version for an addition a built project can skip,
  and the major version when an invariant changes meaning or a record changes in
  a way built projects must follow. Every change gets an entry in
  [CHANGELOG.md](../CHANGELOG.md), which is how an agent updates a project built
  from an earlier version.
- `testedWith`: the SDK versions of the last build that followed the blueprint
  end to end and passed every invariant test. Optional; leave it out until such a
  build exists.

- `status`: `preview` (the design is sound, details may move) or `stable` (a
  version of it runs in production on SegmentStream for at least one company,
  and the invariants are settled). New blueprints start as `preview`. A status
  describes the design's origin, never a warranty of software built from it.
- `replaces`: the products people search for when they want this software,
  most widely used first. Each becomes an entry in `docs/alternatives.md` and a
  search term ("<product> alternative"); list every well-known one.
- `dependsOn`: blueprints, or `foundation`, that must exist in the project first.
- `components`: which project folders the blueprint touches: `ontology`, `app`,
  `pipeline`, `connections`, `events`, `agent`.
- `authors`: GitHub handles of the people or organizations who wrote it. Also
  listed under **Authors** at the end of the blueprint's README.

To start a new blueprint, copy `docs/blueprint-template/` to
`blueprints/<id>/`. See [CONTRIBUTING.md](../CONTRIBUTING.md).

## README.md

For a person deciding whether to build it. At most one screen of reading.

1. `# <Title>: build your own <best-known product> alternative` and a
   one-sentence lead: what it is and what it replaces. Then a line
   `**Alternative to** <every product in replaces>`.
2. **What you get**: five to eight bullets of outcomes, not features.
3. **Build it**: the prompt to paste into a coding agent, in a code block:

   ```text
   Read https://github.com/segmentstream/build-your-own/blob/main/AGENTS.md and follow it.
   Build our <title> from the <id> blueprint.
   ```

4. **How it fits**: which other blueprints it works with and why.
5. **What it is not**: two or three honest limits. When the software has legal,
   tax or financial effect, one of them says it is not professional advice and
   what a professional should review.
6. **Authors**: the GitHub handles from `blueprint.json`.

## BLUEPRINT.md

The design an agent builds from. Plain, specific, no marketing. Sections, in
this order:

1. **Purpose.** Two or three sentences: the job this software does for a company.
2. **Records (ontology).** Each entity: what one record is, its key properties
   (name, type, meaning), its relationships, and whether people or machines set
   its values. Entities that only read warehouse tables are marked as such.
3. **Actions.** Each action: who calls it, its input, what it checks, what it
   changes. Actions are the only way records change.
4. **Roles.** Each role: who holds it and the permissions it needs. Name the
   permissions an agent must never get by default.
5. **Workflows.** What runs on its own: the trigger (action, schedule, webhook),
   the steps, and what is idempotent.
6. **Data flow (pipeline).** For blueprints with warehouse data: sources, the
   contract tables every source writes, models, grain and keys of each table,
   partitioning, checks, jobs and schedules.
7. **Screens (app).** Each page: what a person sees and can do. No styling.
8. **The company agent.** What a person can ask the workspace agent once this is
   built, and which actions it may call with confirmation.
9. **Build order.** Numbered steps from an empty project to a working version,
   each ending in something the person can check.
10. **Sketch.** Short code in the real SDK syntax for the parts that are easy to
    get wrong: the core entity, one guarded action, one role, one workflow
    trigger, one ingestion or model. Invented names and data only. Point to the
    project's own docs for the full API instead of repeating it.

The platform's rules are in the project's `AGENTS.md`, `docs/` and
`.agents/skills/`, which `segmentstream init` writes into every project. A
blueprint relies on them and never contradicts them.

## INTERVIEW.md

Eight to twelve questions, asked in one message before building. For each:

- the question, in plain words a founder or operator understands;
- why it matters;
- what each typical answer changes in the build;
- the default if the person has no opinion.

End with the questions that need a human decision every time (money, sending to
customers, signing, deleting).

## INVARIANTS.md

Numbered rules that must hold in every version, whatever the company. For each:

- the rule in one sentence;
- why it exists;
- how to test it (the test to write, with its input and expected result), in a
  form the harness in [testing](testing.md) can run at milestone M1. Say so when
  part of a rule can only be checked at M2, and test the rest at M1.

Only rules that would be a bug if broken. Preferences belong in VARIATIONS.md.

Numbers are permanent: a project's tests are named after them (`crm 1. one
submission id is one lead`). Add new invariants at the end. A retired invariant
keeps its number, marked **Retired** with the reason.

## VARIATIONS.md

Where companies legitimately differ: industry, size, country, sales motion,
tools they keep. For each variation: the options, what each changes, and the
default this blueprint takes. Country-specific law (tax, payroll, e-signature
regulation) is described here as a variation, never built in as the default.

## PITFALLS.md

Mistakes already made by agents building this kind of software on the platform.
For each: the symptom, the cause, and what to do instead. Keep only pitfalls
that a careful agent could still fall into.

## Writing rules

- English. Short sentences, plain words, specific nouns. No emoji.
- Universal: write for any company that needs this software, of any size or
  industry. Industry and country specifics go to VARIATIONS.md.
- Invented data only: Northwind as the company, Ada Example and Grace Sample as
  people, `example.com` addresses, round invented amounts.
- Never include names of real customers, people, partners or counterparties,
  real amounts, IDs, internal hostnames, private repository paths or
  credentials. Public products named as what a blueprint replaces or connects
  to (HubSpot, DocuSign, Google Ads, Resend, Stripe) are fine.
- Name platform concepts as the platform does: workspace, entity, property,
  relationship, action, role, permission, workflow, ingestion, model, job,
  schedule, connection, event stream, metric, the workspace agent.
