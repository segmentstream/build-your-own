# Pipeline notes every pipeline blueprint shares

Lessons from building pipelines with the SegmentStream pipeline SDK and Ibis. They
apply to every blueprint with a `pipeline/` part. A blueprint keeps only its own
rules and links here. How to set up and run the tests is in [testing](testing.md).

## The starter

- **Remove the starter's commerce sample** when the blueprint replaces it:
  `pipeline/ingestion/raw_orders.py` and `raw_customers.py`, the models
  `normalized_orders`, `customer_revenue` and `revenue_summary`, the `refresh` job, the
  ontology's `order.ts` (its source is `silver/normalized_orders`), the app's revenue
  card (it reads `gold.revenue_summary`) and the README's revenue walkthrough. Leaving
  any of them fails at run time, not at validation. The synced `docs/` still name the
  sample files; that is expected, do not edit synced files.
- **Package every folder you add.** `pipeline/pyproject.toml` installs only the
  `ingestion` and `models` packages. Add shared modules and checks to
  `[tool.setuptools.packages.find] include`, for example
  `["ingestion", "ingestion.*", "models", "models.*", "marketing", "marketing.*", "checks", "checks.*"]`.
- **Know which SDK you run.** The project's `docs/` can describe a newer pipeline SDK
  than `pipeline/pyproject.toml` pins, and the root `pyproject.toml` pins another one
  for discovery scripts only. Before relying on a feature, check it exists in the pinned
  version (`segmentstream uv run --directory pipeline python -c "import segmentstream as s; print(dir(s))"`).
  The `events/` component pins its own SDK and does not follow the pipeline's.
- **Run tests in the pipeline's environment:** `segmentstream uv run --directory pipeline pytest`.
  The root environment has neither the pipeline SDK in use nor pytest.

## Calling declarations

- A declaration keeps its function: call a model as `model.function(table_a, table_b)`
  and a row ingestion as `list(ingestion.function(context))`. The declared schemas are
  `model.model_schema` and `ingestion.ingestion.schema`.
- Keep each transformation in a plain function of Ibis tables, and let the model call it.
  Tests call the same function with invented rows.
- `context` and `warehouse` are injected parameters. Tests pass the harness's `Context`
  and `DuckWarehouse` (`kernel/pipeline/tests/warehouse_harness.py`).

## Ibis that runs on BigQuery and DuckDB

- **Self-joins need `.view()`.** Joining a table to an expression derived from itself
  (`h.left_join(h.select(...).join(...), ...)`) can make Ibis resolve a column from the
  wrong side. No error is raised; the key comes back NULL for unmatched rows. Take
  `v = t.select(...).view()` before joining it back.
- **Expressions belong to one relation.** After `t = t.join(...)` or `t = t.mutate(...)`,
  expressions built from the earlier `t` raise `IntegrityError` or "Window frame can only
  depend on a single relation". Rebuild them from the new `t`, or name columns as strings
  in `group_by`, `order_by` and windows. In an aggregate after a filter, use the filtered
  table's columns (`f = t.filter(...); f.group_by(...).aggregate(n=f.count())`).
- **`hexdigest` has no BigQuery rule** in Ibis 12; it fails only when compiled for the
  warehouse. Build readable keys by joining parts with `|`. `.hash()` compiles, but its
  value differs between BigQuery and DuckDB, so use it only where tests do not compare it.
- **DATE cannot be redefined on DuckDB.** For a local date, declare a builtin named
  `DATETIME(timestamp, time_zone)` and take `.date()`; the harness defines `datetime` as a
  DuckDB macro. BigQuery receives `DATE(DATETIME(ts, 'Europe/Berlin'))`.
- **JSON arrays need a builtin.** `.array` and `unwrap_as("array<json>")` have no BigQuery
  rule, and `cast("array<json>")` compiles to a cast BigQuery rejects. Declare a builtin
  named `JSON_QUERY_ARRAY(json) -> array<json>` (it compiles to `JSON_EXTRACT_ARRAY`), and
  in the test that needs it run
  `con.raw_sql("CREATE MACRO json_query_array(j) AS json_extract(j, '$[*]')")`.
- **NULL in a sort key or a flag.** `a & b` is NULL when `b` is NULL, and NULL sorts last.
  Coalesce every boolean used in `order_by`, `ifelse` or `filter` that decides precedence.
- **`row_number()` starts at 0** in Ibis. Keep the first row with `== 0`.
- **Fixtures with NULL decimals:** `ibis.memtable(list_of_dicts)` fails when a decimal
  column holds `None`. Build fixtures with the harness's `table(con, rows, schema)`,
  which goes through pyarrow with the exact schema.
- **Compile every model for BigQuery in a test** (`bigquery_sql(expression)` in the
  harness). DuckDB accepts expressions BigQuery rejects, and the reverse.

## SDK patterns

- **Assets generated from a registry.** When a registry in code decides which assets
  exist (one per declared conversion, one per conversion and model), build them in a
  factory and give each its `key=`; inputs still resolve by parameter name. A consumer
  that reads every generated table cannot list them as parameters, so give its function
  an explicit signature:

  ```python
  import inspect

  import ibis.expr.types as ir
  import segmentstream as s

  NAMES = tuple(f"conversions_{c.name}" for c in CONVERSIONS)


  def with_inputs(function, names, *, warehouse=False):
      """A `**tables` function with one keyword parameter per input table."""
      params = [inspect.Parameter("warehouse", inspect.Parameter.KEYWORD_ONLY, annotation=s.WarehouseResource)] if warehouse else []
      params += [inspect.Parameter(n, inspect.Parameter.KEYWORD_ONLY, annotation=ir.Table) for n in names]
      function.__signature__ = inspect.Signature(params, return_annotation=ir.Table)
      function.__annotations__ = {"return": ir.Table}
      return function


  def _report(**tables):
      return union_all([tables[name] for name in NAMES])


  conversion_report = s.model(
      tier=s.Tier.Gold, key="conversion_report", partitioning=s.Partitioning.Unpartitioned, schema=SCHEMA,
  )(with_inputs(_report, NAMES))
  ```

- **Check factories need `inputs=`.** A check's table argument must match its target's
  name. A factory that checks several tables with one function names the argument
  explicitly: `s.asset_check(asset=asset, name="no_sample_rows", inputs={"target": asset})`.
  A check reads its target table only, so put what it compares into that table.
- **A check that enforces only in some setups** takes the setting as a factory argument
  (`no_sample_rows(asset, enforce=REAL_ADAPTERS)`), and records it in its metadata.
- **Refuse before returning.** A model that raises before it returns its expression
  leaves the previous table in place. Validate with `warehouse.execute(...)` on counts,
  then return.
- **`warehouse.iterate`** needs a convergence check that is one scalar over one relation:
  `current.anti_join(following, [...all columns...]).count() > 0`.
- **An external table on another calendar.** A table partitioned by UTC days cannot be a
  daily input of a model on a local calendar. Declare it `s.Partitioning.Unpartitioned`
  and filter its partition column in the model.
- **Snapshot history.** A SnapshotHistory ingestion writes its rows and a ledger,
  `<table>__snapshots` (`snapshot_id`, `snapshot_at`, `completed_at`, `scopes` as a JSON
  array of scope objects, `row_count`). The SDK has no selector for it yet: declare the
  ledger with `s.external_table(key="<table>__snapshots", partitioning=s.Partitioning.Unpartitioned)`
  and pick the latest ledger row per scope, empty captures included. The data rows carry
  `_snapshot_id`, `_snapshot_at` and `_snapshot_date`. The marketing-analytics blueprint
  has a sketch (`gold/campaigns`).
