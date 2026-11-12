# Testing a build

Every invariant in a blueprint becomes a test in the project. This page says how
to write and run those tests on a laptop, before anyone has SegmentStream access.

## Milestones

A build moves through three milestones. Each one ends with every check green.

| Milestone | Needs | What runs |
| --- | --- | --- |
| **M1. Local** | Node 24 and the SegmentStream CLI | Ontology check, typecheck and build; the invariant tests on the in-process harness; the app's typecheck, tests and build; pipeline validation and model tests on DuckDB; the agent's typecheck. Sample data only, no external effects. |
| **M2. Linked** | A linked workspace (`segmentstream link`) | `segmentstream dev` to click through every screen with sample data, and metric queries against real definitions. |
| **M3. Deployed** | The person's approval | `segmentstream deploy`, connections authorized, history loaded. |

M1 needs no account. A person without access gets a project at M1 with every
invariant tested, and stops there (AGENTS.md step 8).

## Set up the ontology tests

1. Copy the kernel files without changing them:

   | From this repository | To the project |
   | --- | --- |
   | [`kernel/ontology/test/ontology-harness.ts`](../kernel/ontology/test/ontology-harness.ts) | `ontology/test/ontology-harness.ts` |
   | [`kernel/ontology/vitest.config.ts`](../kernel/ontology/vitest.config.ts) | `ontology/vitest.config.ts` |

2. Add the development dependencies and the test script. `@effect/sql-pg` must
   have exactly the version of `effect` that the project already uses:

   ```sh
   cd ontology
   EFFECT=$(node -p "require('./package.json').dependencies.effect")
   npm install --save-dev vitest@3.2.4 @electric-sql/pglite@0.4.6 "@effect/sql-pg@$EFFECT"
   npm pkg set scripts.test="vitest run"
   ```

3. Write tests in `ontology/test/*.test.ts` and run them with
   `npm --prefix ontology test`.

## The harness

`openOntology(ontology)` creates a PostgreSQL database inside the test process
(PGlite), migrates it with the SDK's own migration, and returns a handle. Actions
run through the SDK's own pipeline: the permission check, input decoding, the
transaction, history and workflow starts. Nothing leaves the process.

| Method | Use |
| --- | --- |
| `member(email, roles, name?)` | A signed-in member holding the roles |
| `apiKey(name, roles)` | A service user and its API key, holding exactly the roles |
| `workflowUser(workflow)` | The user a workflow runs as |
| `run(principal, entity, action, input)` | Runs an action; returns `{ ok: true, result }` or `{ ok: false, tag, message }` |
| `ok(principal, entity, action, input)` | Runs an action and throws unless it succeeds |
| `http(key, method, path, body?)` | A request to the real ontology service, for status codes and routes |
| `record(entity, id)`, `find(entity, where, limit?)` | Reads that skip permission checks, for assertions |
| `query(sql, ...params)` | Plain SQL, for assertions only |
| `deactivate(userId)`, `close()` | Deactivates a member; closes the database |

Actions that call a connection, such as an email provider or a timestamp
authority, get stubbed answers. A call to a connection without a stub fails the
action, so a test can never reach a real provider:

```ts
import { Connections } from "@segmentstream/ontology";
import { Effect } from "effect";

const sent: string[] = [];
const o = await openOntology(ontology, {
  connections: Connections.test({
    email: (request) => {
      sent.push(request.text);
      return Effect.succeed({ status: 200, json: { id: "message-1" } });
    },
  }),
});
```

- Names may be written as in code (`salesManager`, `findOrCreateByEmail`) or on
  the wire (`sales_manager`). Top-level input keys are converted; values are not.
- A refused action answers with a `tag`: `PermissionDenied` when the role lacks
  the permission, `NotFound` when a scope hides the record, `InvalidInput` when
  the input does not decode, or the action's own error.
- Open one database per test file, in `beforeAll`, and close it in `afterAll`.
  Migration takes a few seconds; tests in a file share the database, so give
  each test its own records.
- Write records only through actions. `query`, `record` and `find` exist to
  check what the actions did.

## An invariant test

Name each test after its invariant, so anyone can match the two: the blueprint
id, the invariant's number and its rule.

```ts
import { afterAll, beforeAll, expect, test } from "vitest";

import ontology from "../index";
import { openOntology, type Principal, type TestOntology } from "./ontology-harness";

let o: TestOntology;
let intake: Principal;

beforeAll(async () => {
  o = await openOntology(ontology);
  ({ principal: intake } = await o.apiKey("website", ["intake"]));
});
afterAll(() => o.close());

test("crm 1. one submission id is one lead", async () => {
  const input = { submissionId: "form-1", email: "ada@example.com", source: "website" };
  const first = await o.ok<{ leadId: string }>(intake, "lead", "submit", input);
  const second = await o.ok<{ leadId: string }>(intake, "lead", "submit", input);

  expect(second.leadId).toBe(first.leadId);
  expect(await o.query("select id from lead where submission_id = $1", "form-1")).toHaveLength(1);
});
```

## How to test each kind of invariant

| Kind | How |
| --- | --- |
| A rule an action enforces | Run the action as the role the invariant names; assert its answer and the records it changed. |
| Who may do what | Run the same action as a member without the role and expect `PermissionDenied`, or as someone a scope excludes and expect `NotFound`. |
| A write path that must not exist | `http(key, "POST", "/api/ontology/<entity>/actions/<action>", { input })` answers 404, and nothing is written. |
| A computed or formatted value | Export the function and test it directly. |
| A workflow | The workflow engine does not run locally. Assert that the trigger started one run per qualifying change and none for a repeat (rows in `_workflow_starts`), and run the step's action as `workflowUser(name)`. |
| A provider call | Stub the connection (above). Assert what the stub received, and that a refused or repeated action calls it no more. |
| An external effect | Never send it in a test. Assert what the action queued instead, such as a row in `_sign_in_emails`, and that a repeat queues nothing. |
| A pipeline model | Run the model's transformation on invented rows with DuckDB, as below. |
| A metric | Metric queries need a linked workspace. At M1, test the model or expression the metric reads; at M2, query the metric. |

## Pipeline tests

Keep each model's transformation in a function that takes Ibis tables and
returns an Ibis table. The model calls it with warehouse tables; a test calls it
with invented rows.

```sh
segmentstream uv add --directory pipeline --dev duckdb pytest
segmentstream uv run --directory pipeline pytest
```

```python
import ibis

from models.customers import customers_from_deals


def test_crm_19_one_row_per_customer_and_currency():
    deals = ibis.memtable(
        [
            {"id": "deal-1", "company_id": "company-1", "status": "won", "amount_minor": 100000, "currency": "eur"},
            {"id": "deal-2", "company_id": "company-1", "status": "won", "amount_minor": 50000, "currency": "usd"},
            {"id": "deal-3", "company_id": "company-1", "status": "lost", "amount_minor": 70000, "currency": "eur"},
        ]
    )
    rows = ibis.duckdb.connect().execute(customers_from_deals(deals)).to_dict("records")
    assert {(r["currency"], r["won_amount_minor"]) for r in rows} == {("eur", 100000), ("usd", 50000)}
```

Also validate the definitions on every run:

```sh
segmentstream uv run --directory pipeline python -c "import segmentstream as s; from definitions import defs; s.validate(defs)"
```

## App checks

```sh
npm --prefix app run typecheck
npm --prefix app run build
```

## What cannot run at M1

- Screens in a browser: `segmentstream dev` needs a linked workspace.
- The workflow engine, chat delivery and scheduled runs.
- Metric queries through the service.
- Connections to providers, and sign-in.

Test what each of these depends on at M1, and exercise the rest at M2.
