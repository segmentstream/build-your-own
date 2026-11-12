# Kernel

Files a coding agent copies into a SegmentStream project without changing them.
They are the same for every blueprint, so they live here once.

| File | Copy to | What it does |
| --- | --- | --- |
| [`ontology/test/ontology-harness.ts`](ontology/test/ontology-harness.ts) | `ontology/test/ontology-harness.ts` | Runs the ontology's actions in tests on a PostgreSQL inside the test process: real migration, permission checks, transactions, history and workflow starts, with stubbed connections, no server and no account |
| [`ontology/vitest.config.ts`](ontology/vitest.config.ts) | `ontology/vitest.config.ts` | Test runner settings for the harness |
| [`pipeline/tests/warehouse_harness.py`](pipeline/tests/warehouse_harness.py) | `pipeline/tests/warehouse_harness.py` | Runs the pipeline's own Ibis expressions on DuckDB with invented rows, stands in for the warehouse resource, and compiles each model for BigQuery |

[Testing](../docs/testing.md) says how to set them up and how to test each kind
of invariant.

If a kernel file does not work with the SDK versions in your project, do not
patch your copy: report it with the **Build problem** form, naming the versions.
