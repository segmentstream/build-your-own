# Foundation

The records and conventions every blueprint shares. Build the foundation once,
before the first blueprint that depends on it. Later blueprints add to these
entities; they never create a second company or contact table.

## Records

### Company

An organization the business deals with: a prospect, customer, supplier,
partner or any mix of these over time.

| Property | Type | Meaning |
| --- | --- | --- |
| `name` | text | The name people use. |
| `legalName` | text, optional | The registered name, for invoices and contracts. |
| `domain` | text, unique, optional | Primary web domain, lowercase, without `www.`. The natural key for upserts. |
| `additionalDomains` | json, optional | Other domains that belong to the same company, as a JSON list of lowercase domains. (`p.list` exists only on the built-in `User`.) |
| `countryCode` | text, optional | ISO 3166-1 alpha-2 country of the headquarters. |
| `registrationNumber`, `registrationCountry` | text, optional | Legal registration, when finance or contracts need it. |
| `taxId` | text, optional | VAT or tax number, when invoices need it. |
| `isProspect`, `isCustomer`, `isFormerCustomer`, `isSupplier`, `isPartner` | boolean, managed, default false | What the company is to the business, in any mix over time. One flag per value: the SDK has no multi-select property, and a `find` filters booleans directly. Set by people through `setRelationships`. |
| `relationshipsNote` | text, optional, managed | Why the flags last changed. Written by `setRelationships` with the flags, so the record's history shows the reason beside the change. |
| `owner` | relationship to a member, optional | The person responsible for the relationship. |

Facts computed from other records (revenue to date, open deals, last activity)
are metrics or warehouse tables, never stored properties.

### Contact

A person the business talks to: at a company, or on their own.

| Property | Type | Meaning |
| --- | --- | --- |
| `email` | email, unique | Lowercased. The natural key for upserts. |
| `name` | text, optional | Full name as the person gave it. |
| `jobTitle` | text, optional | |
| `phone` | text, optional | As given; do not reformat. |
| `countryCode` | text, optional | ISO 3166-1 alpha-2. |
| `company` | relationship to Company, optional | Where they work. |
| `emailStatus` | select, managed | `ok`, `bounced`, `complained`, `invalid`. Set by delivery events; an admin resets it to `ok` with `resetEmailStatus`, for example after a mailbox is fixed. |
| `emailStatusNote` | text, optional, managed | Why `emailStatus` last changed, written with it. |

Consent to marketing email belongs to the email-marketing blueprint, not here.

A reason is never a free-floating input: history records the changes an action
makes, not its input. Keep a reason as a managed property written in the same
action as the change, as `relationshipsNote` and `emailStatusNote` are, or as a
record of its own (a blueprint's activity or note).

### Members

People who sign in are the workspace's members (the SDK's built-in `User`).
Relationships such as `owner` or `assignee` point at members. Never copy a
member's name or email into another record; reference the member.

## Actions

Action names are camelCase in code (`findOrCreateByDomain`) and snake_case on
the wire (`company.find_or_create_by_domain`, MCP tool
`company_find_or_create_by_domain`). Permissions in roles use the code name:
`company:findOrCreateByDomain`.

| Action | Granted to | What it does |
| --- | --- | --- |
| `company.findOrCreateByDomain` | job roles | Finds the company by normalized domain or creates it. Refuses a free mail domain. Idempotent. |
| `company.update` | job roles | The generated update: changes descriptive properties. Managed flags stay out of it. |
| `company.setRelationships` | job roles | Sets the relationship flags given, and `relationshipsNote` when a reason is given. |
| `company.mergeInto` | `admin` | Moves every related record from a duplicate to the kept company, then deletes the duplicate. Each blueprint that relates its records to Company extends it to move them. Refuses when legal identities conflict. |
| `contact.findOrCreateByEmail` | job roles | Finds the contact by lowercased email or creates it, filling only empty fields; links a company found by the email's domain when the domain is not a free mail provider. Idempotent. |
| `contact.update` | job roles | The generated update: changes descriptive properties. |
| `contact.resetEmailStatus` | `admin` | Sets `emailStatus` to `ok` with a required reason in `emailStatusNote`. Refused when it is already `ok`. |
| `contact.delete` | `admin` | The generated delete: erases a person. Cascades to the records blueprints declare `cascade`, such as the CRM's leads and activities. |

Company and Contact keep their generated writes (`writes: "generated"`), so
descriptive edits need no authored action. Grant only `update`, and `delete` of
contacts to `admin`. Never grant `company:create` or `contact:create`: the
generated create and `upsert_by_domain`/`upsert_by_email` (which need `create`
too) match the value as given, skip normalization and the free mail check, and
create duplicates. The finders are authored actions for that reason, under
names of their own: `upsert_by_<property>` is reserved for the generated upsert.

## Roles

| Role | Holder | Foundation permissions |
| --- | --- | --- |
| `member` | Every active member | `*:read` by default. A blueprint narrows it before members who should not read its records join. |
| Job roles: `sales`, `marketing`, `finance`, `support` | Members, by job; one member may hold several | `company:read`, `contact:read`, `company:findOrCreateByDomain`, `company:update`, `company:setRelationships`, `contact:findOrCreateByEmail`, `contact:update` |
| `admin` | One or two members who keep records clean | `company:read`, `contact:read`, `company:mergeInto`, `contact:resetEmailStatus`, `contact:delete`; answers app feedback (`feedback: { builders: ["admin"] }`) |
| Machine roles, such as `intake` | One API key or one workflow each | Only what that caller runs. A website key gets a blueprint's submit action, which finds or creates companies and contacts inside it, not the finders themselves: a key that can call `findOrCreateByEmail` learns which emails exist. |

- Name a role for the job, never for a person.
- Destructive and irreversible permissions (`mergeInto`, deletes, sending,
  signing, posting to the ledger) are granted by name, never through a broad
  role or a wildcard.
- `user:*` permissions (inviting, granting roles) go only to a role written for
  member administration, never to a job role or a machine role.

## Conventions

- **Actions are the only way records change.** Every write goes through an
  action with a permission, so people, apps and agents are held to the same
  rules and every change has a history.
- **Who sets the value decides where it lives.** A value a person or agent
  decides is a property on a record. A value a provider reports or a model
  computes is a warehouse table. A number over many records is a metric.
- **Natural keys make actions idempotent.** Upserts take a natural key (domain,
  email, a source ID, a submission ID). Retrying a call never creates a second
  record.
- **Money is an integer in the currency's minor units plus an ISO 4217
  currency.** Store `1250.00 EUR` as `125000` with currency `eur` (`p.integer`,
  which is a 64-bit integer). Never `p.number`, which is a float, and never an
  amount without its currency. Accept and show amounts as decimals at the edges.
- **Time is stored in UTC** and shown in the member's time zone. Dates that are
  dates (an invoice date, a period end) are stored as dates, not timestamps.
- **Descriptions are policy.** Entity, property and action descriptions say
  what the value means and when the action is refused. People, agents and MCP
  clients read them.
- **The repository never holds business data.** Tests and demos use invented
  data. Real records arrive through connections, event streams and actions.
- **Private entities stay out of the warehouse.** Stored entities replicate to
  the warehouse by default. Exclusions of entities, fields or relationships are
  a workspace setting, not code (see the project's
  `docs/ontology-replication.md`). Exclude a private entity before it is first
  deployed: pause replication, deploy, then resume with the entity excluded.
  Exclusions stop new exports; they do not erase what was exported earlier.

## Platform notes every blueprint shares

Lessons from building on `@segmentstream/ontology` that no single blueprint
owns. Blueprints rely on them without repeating them.

- **Select option values are snake_case.** Entity, property, relationship,
  action and metric names are camelCase in code, but option values are
  lowercase snake_case: `not_a_fit`, `round_robin`, `eur`. `check` refuses
  camelCase values in action inputs (`option values must be lowercase
  snake_case`). Over HTTP, the CLI and MCP, every name is snake_case:
  `lead.mark_won`, role `sales_manager`.
- **Entities whose actions read each other need type annotations.** When an
  action of entity A reads entity B and B relates back to A (a merge, a
  qualify), `tsc` fails with TS7022/TS7023/TS7024 ("implicitly has type any").
  A thunk in `writes` infers the entity's type and closes the loop, so annotate
  it, and give every helper that uses entity handles an explicit return type:

  ```ts
  // ontology/effects.ts
  import type { ActionError, AnyEntity, OntologyRuntime } from "@segmentstream/ontology";
  import type { Effect } from "effect";

  /** The result type of a helper that reads or writes records inside an action. */
  export type RecordEffect<A> = Effect.Effect<A, ActionError, OntologyRuntime>;

  export function findOrCreateCompany(domain: string, name?: string): RecordEffect<{ readonly id: string; readonly created: boolean }> {
    // …
  }

  // In an action: writes: [self, (): AnyEntity => Contact, (): AnyEntity => Lead],
  ```

  Thunks in relationships (`rel.one(() => Company, …)`) need no annotation, and
  `p.ref("company", …)` names a target by its name without importing it.
- **Share Effect helpers; do not call an action from another action.** When two
  actions need the same rule, such as finding a contact by email, write it once
  as a function returning an Effect over entity handles and call it from both
  handlers. Each calling action lists the helper's entities in its `writes`.
- **"Defaults to now" is set in the action.** Properties have no now-default;
  the handler writes `input.occurredAt ?? new Date().toISOString()`.
- **The starter warns `feedback-unanswerable`.** `check` must end with no
  warnings: set `feedback: { builders: ["admin"] }` in `defineOntology` once an
  `admin` role exists.
- **A `find` filter follows one relationship.** A filter through two, such as a
  document's links to bills to the bill's supplier, is refused, and the screen
  shows an error or nothing. Read the related ids first (the company's bill
  ids), then match by id: `{ links: { some: { billId: { in: billIds } } } }`.
  Keep id lists short, and split long ones across several `or` branches.
- **A `find` reads at most 200 records.** A larger `limit` makes the action
  fail as a defect with "The query does not fit <entity>", which does not name
  the limit. Overflow probes ask for one more than the decision allows, so the
  largest page a decision may use is 199.
- **Included relationships are untyped.** `find({ include: ["owner"] })`
  returns the related records at run time, in handlers and in the app's client,
  but the record type does not show them. Read them as `unknown` and narrow,
  without type assertions:

  ```ts
  const [rule] = yield* RoutingRule.find({ where: { id }, include: ["pool"], limit: 1 });
  const pool: unknown = rule !== undefined && "pool" in rule ? rule.pool : [];
  const ids = Array.isArray(pool)
    ? pool.flatMap((item: unknown) =>
        typeof item === "object" && item !== null && "id" in item && typeof item.id === "string" ? [item.id] : [],
      )
    : [];
  ```
