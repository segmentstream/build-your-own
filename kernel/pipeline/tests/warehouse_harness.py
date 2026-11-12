"""Run the pipeline's own Ibis expressions on DuckDB, with invented rows.

A test calls a model through its declaration, `model.function(...)`, so it runs
the exact expression the pipeline compiles for the warehouse. `bigquery_sql`
also compiles it for BigQuery, which catches expressions DuckDB accepts and
BigQuery does not.

Copied verbatim from the build-your-own kernel. Use it from tests/conftest.py:

    from tests.warehouse_harness import con, warehouse  # noqa: F401  (pytest fixtures)

Needs the dev dependencies ibis-framework[duckdb] (the version the pipeline SDK
uses) and pytest. Invented data only.
"""

from collections.abc import Callable, Iterable
from datetime import date
from typing import Any

import ibis
import ibis.expr.types as ir
import pyarrow as pa
import pytest

# BigQuery functions the models may call, defined on DuckDB under the same name.
# DATE cannot be redefined on DuckDB: convert with DATETIME(ts, tz) and .date().
MACROS = ("CREATE MACRO datetime(ts, tz) AS timezone(tz, ts)",)

_counter = 0


def _name(prefix: str) -> str:
    global _counter
    _counter += 1
    return f"{prefix}_{_counter}"


class DuckWarehouse:
    """The methods of s.WarehouseResource that models call, on one DuckDB connection."""

    def __init__(self, con: ibis.BaseBackend):
        self.con = con

    def materialize_scratch(self, expression: ir.Table) -> ir.Table:
        return self.con.create_table(_name("scratch"), obj=expression, overwrite=True)

    def release_scratch(self, table: ir.Table) -> None:
        self.con.drop_table(table.op().name, force=True)

    def execute(self, expression: ir.Expr, *, limit: int | None = None) -> Any:
        return self.con.execute(expression, limit=limit)

    def iterate(
        self,
        initial: ir.Table,
        *,
        step: Callable[[ir.Table], ir.Table],
        changed: Callable[[ir.Table, ir.Table], ir.BooleanScalar],
        max_iterations: int = 1000,
    ) -> ir.Table:
        """Same contract as the SDK: materialize each state until `changed` is false."""
        current = self.materialize_scratch(initial)
        for _ in range(max_iterations):
            expression = step(current)
            if expression.schema() != initial.schema():
                raise AssertionError("Iteration must preserve the initial table schema.")
            following = self.materialize_scratch(expression)
            has_changes = self.execute(changed(current, following))
            if has_changes is None:
                raise AssertionError("Iteration convergence returned NULL.")
            self.release_scratch(current)
            current = following
            if not bool(has_changes):
                return current
        raise AssertionError(f"Iteration did not converge within {max_iterations} iterations.")


class Context:
    """A stand-in for s.Context that carries the partition keys of a run."""

    def __init__(self, days: Iterable[date]):
        self.partition_keys = [day.isoformat() for day in days]


@pytest.fixture
def con() -> ibis.BaseBackend:
    """A fresh in-memory DuckDB with the BigQuery macros."""
    connection = ibis.duckdb.connect()
    for macro in MACROS:
        connection.raw_sql(macro)
    return connection


@pytest.fixture
def warehouse(con: ibis.BaseBackend) -> DuckWarehouse:
    return DuckWarehouse(con)


def table(con: ibis.BaseBackend, rows: list[dict], schema: Any) -> ir.Table:
    """A table of invented rows with an exact schema, also when `rows` is empty or has NULLs."""
    schema = ibis.schema(schema)
    data = pa.Table.from_pylist(
        [{name: row.get(name) for name in schema.names} for row in rows], schema=schema.to_pyarrow()
    )
    return con.create_table(_name("fixture"), obj=data, overwrite=True)


def ingest(con: ibis.BaseBackend, declaration: Any, *args: Any) -> ir.Table:
    """Runs a row ingestion's function and loads its rows with the declared schema."""
    return table(con, list(declaration.function(*args)), declaration.ingestion.schema)


def rows(con: ibis.BaseBackend, expression: ir.Table, order_by: Any = None) -> list[dict]:
    """The rows of an expression as dicts, in a stable order when `order_by` is given."""
    if order_by is not None:
        expression = expression.order_by(order_by)
    return con.to_pyarrow(expression).to_pylist()


def bigquery_sql(expression: ir.Expr) -> str:
    """Compiles for BigQuery; fails on expressions only BigQuery rejects, such as hexdigest."""
    return ibis.to_sql(expression, dialect="bigquery")
