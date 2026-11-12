// Runs this ontology's actions in tests, on a real PostgreSQL that lives in the test process
// (PGlite): no database server, no Cloud, no network. Each `openOntology()` call migrates a fresh
// database with the SDK's own migration, then runs actions through the SDK's own pipeline:
// permission check, input decoding, transaction, history and workflow starts.
//
// Copied verbatim from the build-your-own kernel. Needs these dev dependencies:
//   @electric-sql/pglite, @effect/sql-pg at the same version as `effect`, vitest.
// Invented data only.

import { PGlite } from "@electric-sql/pglite";
import * as PgClient from "@effect/sql-pg/PgClient";
import {
  backendLayer,
  configFromEnv,
  type ConnectionTransport,
  createOntologyService,
  createServiceUser,
  grantMemberRoles,
  makeOntologyRuntime,
  migrate,
  type Ontology,
  type OntologyServiceRuntime,
  permissionsOf,
  principalScopes,
  type Principal,
  reconcileWorkflowUsers,
  resolvePrincipalByApiKey,
  resolveWorkflowUser,
  runAction,
  setMemberActive,
  sqlServiceRuntime,
} from "@segmentstream/ontology";
import { Cause, Effect, Exit, Layer, ManagedRuntime, Semaphore, Stream } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { SqlClient, type SqlConnection } from "effect/unstable/sql";
import { SqlError, UnknownError } from "effect/unstable/sql/SqlError";

const WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";

export interface ActionFailure {
  readonly ok: false;
  /** The error's tag, such as `PermissionDenied`, `NotFound`, `InvalidInput` or the action's own error. */
  readonly tag: string;
  readonly message: string;
}
export interface ActionSuccess<R> {
  readonly ok: true;
  readonly result: R;
  readonly edits: ReadonlyArray<unknown>;
}
export type ActionAnswer<R> = ActionSuccess<R> | ActionFailure;

export interface TestOntology {
  /** Runs an action as the principal. Names may be camelCase (`salesManager`) or wire (`sales_manager`). */
  run<R = Record<string, unknown>>(principal: Principal, entity: string, action: string, input: unknown): Promise<ActionAnswer<R>>;
  /** Runs an action and throws unless it succeeds. */
  ok<R = Record<string, unknown>>(principal: Principal, entity: string, action: string, input: unknown): Promise<R>;
  /** Plain SQL, for assertions only. Never write records this way. */
  query<T = Record<string, unknown>>(text: string, ...params: ReadonlyArray<unknown>): Promise<ReadonlyArray<T>>;
  /** One record as the runtime decodes it, read without permission checks. */
  record(entity: string, id: string): Promise<Record<string, unknown>>;
  /** Records matching a find query (wire names, limit at most 200), read without permission checks. */
  find(entity: string, where: Record<string, unknown>, limit?: number): Promise<ReadonlyArray<Record<string, unknown>>>;
  /** A signed-in member holding the roles, created on first use. */
  member(email: string, roles: ReadonlyArray<string>, name?: string): Promise<Principal>;
  /** A service user whose API key holds exactly the roles. */
  apiKey(name: string, roles: ReadonlyArray<string>): Promise<{ readonly principal: Principal; readonly key: string }>;
  /** The keyless user a workflow runs as, as deploy creates it. */
  workflowUser(workflow: string): Promise<Principal>;
  deactivate(userId: string): Promise<void>;
  /** A request to the real ontology service (REST routes, `/mcp`) with a bearer API key. */
  http(key: string, method: string, path: string, body?: unknown): Promise<{ readonly status: number; readonly body: unknown }>;
  close(): Promise<void>;
}

export interface OpenOptions {
  /**
   * Answers for the connections actions call, such as an email provider:
   * `Connections.test({ email: (request) => Effect.succeed({ status: 200, json: { id: "message-1" } }) })`.
   * A call to a connection without a stub fails the action.
   */
  readonly connections?: Layer.Layer<ConnectionTransport>;
}

/** Migrates a fresh in-process database for this ontology. Call once per test file. */
export async function openOntology(ontology: Ontology, options: OpenOptions = {}): Promise<TestOntology> {
  const db = new PGlite();
  const sqlLayer = pgliteSqlLayer(db);
  const runtime = ManagedRuntime.make(sqlLayer);
  const exec = <A, E>(effect: Effect.Effect<A, E, SqlClient.SqlClient>) => runtime.runPromise(effect);

  await exec(Effect.flatMap(SqlClient.SqlClient, (sql) => migrate({ sql, target: ontology.manifest, workspaceId: WORKSPACE_ID })));
  await exec(reconcileWorkflowUsers(ontology, { workspaceId: WORKSPACE_ID }));

  const serviceRuntime: OntologyServiceRuntime = {
    generatedActions: sqlServiceRuntime.generatedActions,
    connect: (input) =>
      backendLayer(input.ontology, input.blobStorage, input.workflowStarter, input.deployment, input.signInLinks).pipe(
        Layer.provide(sqlLayer),
      ),
  };
  const service = createOntologyService(ontology, {
    ...configFromEnv({
      SEGMENTSTREAM_ONTOLOGY_DATABASE_URL: "postgresql://in-process/test",
      SEGMENTSTREAM_URL: "http://127.0.0.1:9",
      SEGMENTSTREAM_APPLICATION_ID: "app_local_test",
      SEGMENTSTREAM_WORKSPACE_ID: WORKSPACE_ID,
      SEGMENTSTREAM_ORGANIZATION_ID: "org_local_test",
    }),
    runtime: serviceRuntime,
  });

  const self: TestOntology = {
    async run<R>(principal: Principal, entity: string, action: string, input: unknown): Promise<ActionAnswer<R>> {
      const request = runAction(ontology, { entity: wire(entity), action: wire(action), input: wireKeys(input), principal });
      const outcome = await runtime.runPromiseExit(
        options.connections === undefined ? request : request.pipe(Effect.provide(options.connections)),
      );
      if (Exit.isSuccess(outcome)) {
        const { validation, result, edits } = outcome.value;
        if (!validation.ok) {
          const message = validation.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
          return { ok: false, tag: "InvalidInput", message };
        }
        return { ok: true, result: result as R, edits };
      }
      const failure = Cause.findErrorOption(outcome.cause);
      if (failure._tag === "Some") {
        const error = failure.value as { readonly _tag?: string; readonly message?: string };
        return { ok: false, tag: error._tag ?? "Error", message: error.message ?? String(error) };
      }
      throw new Error(`${entity}.${action} died: ${Cause.pretty(outcome.cause)}`);
    },
    async ok<R>(principal: Principal, entity: string, action: string, input: unknown): Promise<R> {
      const answer = await self.run<R>(principal, entity, action, input);
      if (!answer.ok) throw new Error(`${entity}.${action} failed: ${answer.tag}: ${answer.message}`);
      return answer.result;
    },
    async query<T>(text: string, ...params: ReadonlyArray<unknown>): Promise<ReadonlyArray<T>> {
      return (await db.query<T>(text, [...params])).rows;
    },
    record: (entity, id) =>
      exec(Effect.flatMap(SqlClient.SqlClient, (sql) => makeOntologyRuntime(ontology, sql).get({ entity: wire(entity), id }))),
    find: async (entity, where, limit = 200) =>
      (
        await exec(
          Effect.flatMap(SqlClient.SqlClient, (sql) =>
            makeOntologyRuntime(ontology, sql).query({ entity: wire(entity), query: { where, limit } }),
          ),
        )
      ).items,
    async member(email, roles, name) {
      const summary = await exec(grantMemberRoles(ontology, { email, name, roles: roles.map(wire) }));
      const held = ["member", ...summary.roles];
      return {
        id: summary.id,
        kind: "member",
        roles: held,
        permissions: permissionsOf(ontology.roles, held),
        ...principalScopes(ontology.roles, held),
      };
    },
    async apiKey(name, roles) {
      const created = await exec(createServiceUser(ontology, { name, roles: roles.map(wire), keyLabel: name }));
      const principal = await exec(resolvePrincipalByApiKey(ontology, created.apiKey.key));
      return { principal, key: created.apiKey.key };
    },
    workflowUser: (workflow) => exec(resolveWorkflowUser(ontology, { workspaceId: WORKSPACE_ID, workflow })),
    async deactivate(userId) {
      await exec(setMemberActive(ontology, { id: userId, active: false }));
    },
    async http(key, method, path, body) {
      const response = await service.handler(
        new Request(`http://localhost${path}`, {
          method,
          headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
      );
      const text = await response.text();
      try {
        return { status: response.status, body: JSON.parse(text) as unknown };
      } catch {
        return { status: response.status, body: text };
      }
    },
    async close() {
      await service.dispose();
      await runtime.dispose();
      await db.close();
    },
  };
  return self;
}

/** An Effect SQL client on one PGlite database. One transaction runs at a time, as on one connection. */
function pgliteSqlLayer(db: PGlite): Layer.Layer<SqlClient.SqlClient> {
  const lock = Semaphore.makeUnsafe(1);
  const fail = (cause: unknown) =>
    new SqlError({ reason: new UnknownError({ cause, message: cause instanceof Error ? cause.message : String(cause), operation: "query" }) });
  const rows = (sql: string, params: ReadonlyArray<unknown>) =>
    Effect.tryPromise({ try: async () => (await db.query<Record<string, unknown>>(sql, [...params])).rows, catch: fail });
  const connection: SqlConnection.Connection = {
    execute: (sql, params, transform) => Effect.map(rows(sql, params), (r) => (transform ? transform(r) : r)),
    executeUnprepared: (sql, params, transform) => Effect.map(rows(sql, params), (r) => (transform ? transform(r) : r)),
    executeRaw: (sql, params) => rows(sql, params),
    executeValues: (sql, params) => Effect.map(rows(sql, params), (r) => r.map((row) => Object.values(row))),
    executeValuesUnprepared: (sql, params) => Effect.map(rows(sql, params), (r) => r.map((row) => Object.values(row))),
    executeStream: (sql, params, transform) =>
      Stream.fromIterableEffect(Effect.map(rows(sql, params), (r) => (transform ? transform(r) : r))),
  };
  // A transaction holds the database until it ends; statements outside one wait for it.
  const held = Effect.acquireRelease(lock.take(1), () => lock.release(1)).pipe(Effect.as(connection));
  return Layer.effect(
    SqlClient.SqlClient,
    SqlClient.make({
      acquirer: held,
      transactionAcquirer: held,
      compiler: PgClient.makeCompiler(),
      spanAttributes: [],
    }),
  ).pipe(Layer.provide(Reactivity.layer));
}

/** `salesManager` is `sales_manager` on the wire. */
export function wire(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** Top-level input keys in wire form; values, such as JSON answers, keep their keys. */
function wireKeys(input: unknown): unknown {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return input;
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [wire(key), value]));
}

export type { Principal };
