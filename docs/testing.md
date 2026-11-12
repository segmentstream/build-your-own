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

A test calls a model through its declaration, `model.function(...)`, with
tables of invented rows on DuckDB, so it runs the same Ibis expression the
pipeline compiles for the warehouse. A model that reads a table with
`warehouse.table(...)`, such as a replicated ontology entity, keeps its
transformation in a plain function that takes that table; the test calls the
plain function.

1. Copy [`kernel/pipeline/tests/warehouse_harness.py`](../kernel/pipeline/tests/warehouse_harness.py)
   to `pipeline/tests/warehouse_harness.py` without changing it, and add an
   empty `pipeline/tests/__init__.py`.
2. Create `pipeline/tests/conftest.py` with one line:

   ```python
   from tests.warehouse_harness import con, warehouse  # noqa: F401  (pytest fixtures)
   ```

3. Add the development dependencies, with the Ibis version the pipeline SDK
   already uses, and tell pytest where the code is:

   ```sh
   IBIS=$(segmentstream uv run --directory pipeline python -c "import ibis; print(ibis.__version__)" | tail -1)
   segmentstream uv add --directory pipeline --dev "ibis-framework[duckdb]==$IBIS" pytest
   ```

   ```toml
   # pipeline/pyproject.toml
   [tool.pytest.ini_options]
   pythonpath = ["."]
   testpaths = ["tests"]
   ```

4. Run `segmentstream uv run --directory pipeline pytest`.

| Helper | Use |
| --- | --- |
| `con` | A fresh DuckDB, with BigQuery functions the models call defined as macros |
| `warehouse` | Stands in for `s.WarehouseResource`: `materialize_scratch`, `release_scratch`, `execute`, `iterate` |
| `table(con, rows, schema)` | A table of invented rows with an exact schema, also when empty or with NULLs |
| `ingest(con, ingestion, ...)` | Runs a row ingestion's function and loads its rows |
| `rows(con, expression, order_by)` | The result as a list of dicts |
| `bigquery_sql(expression)` | Compiles for BigQuery; call it on every model's output to catch what only BigQuery rejects |
| `Context(days)` | Stands in for `s.Context` with partition keys |

```python
from datetime import date

from models.crm_customers import customers_from_deals
from tests.warehouse_harness import bigquery_sql, rows, table

DEALS = {
    "id": "string",
    "company_id": "string",
    "primary_contact_id": "string",
    "status": "string",
    "amount_minor": "int64",
    "currency": "string",
    "closed_on": "date",
}


def deal(deal_id, status, amount_minor, currency):
    return {"id": deal_id, "company_id": "company-1", "primary_contact_id": "contact-1", "status": status,
            "amount_minor": amount_minor, "currency": currency, "closed_on": date(2026, 10, 1)}


def test_crm_19_one_row_per_customer_and_currency(con):
    deals = table(
        con,
        [deal("deal-1", "won", 100000, "eur"), deal("deal-2", "won", 50000, "usd"), deal("deal-3", "lost", 70000, "eur")],
        DEALS,
    )
    result = customers_from_deals(deals)
    bigquery_sql(result)
    assert {(r["currency"], r["won_amount_minor"]) for r in rows(con, result)} == {("eur", 100000), ("usd", 50000)}
```

A blueprint may ship a worked example in its `fixtures/` folder: invented input
rows and the output rows its rules produce. Load them with `table` and compare
with `rows`; a build that disagrees has a bug or a deviation to record.

Also validate the definitions on every run:

```sh
segmentstream uv run --directory pipeline python -c "import segmentstream as s; from definitions import defs; s.validate(defs)"
```

[Pipeline notes](pipeline-notes.md) lists Ibis and SDK mistakes that tests
alone do not explain.

## App checks

```sh
npm --prefix app run typecheck
npm --prefix app run build
```

An app that publishes page navigation (`withPageCatalog` and
`page.navigation.json` files) cannot build locally with app SDK 0.38.1: the
build needs a page catalog, and the catalog stops matching once the build
rewrites its own workflow files. For such an app, run the typecheck and validate
the navigation files with the catalog's `generate`, as the CRM blueprint shows;
`segmentstream deploy` builds and verifies the catalog itself.

## What cannot run at M1

- Screens in a browser: `segmentstream dev` needs a linked workspace.
- The workflow engine, chat delivery and scheduled runs.
- Metric queries through the service.
- Connections to providers, and sign-in.

Test what each of these depends on at M1, and exercise the rest at M2.
