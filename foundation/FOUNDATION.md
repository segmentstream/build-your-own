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
| `isProspect`, `isCustomer`, `isFormerCustomer`, `isSupplier`, `isPartner` | boolean, managed, default false | What the company is to the business, in any mix over time. One flag per value: the SDK has no multi-select property, and a `find` filters booleans directly. Set by people through an action. |
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
| `emailStatus` | select, managed | `ok`, `bounced`, `complained`, `invalid`. Set by delivery events; an admin may reset it to `ok` with a reason, for example after a mailbox is fixed. |

Consent to marketing email belongs to the email-marketing blueprint, not here.

### Members

People who sign in are the workspace's members (the SDK's built-in `User`).
Relationships such as `owner` or `assignee` point at members. Never copy a
member's name or email into another record; reference the member.

## Actions

| Action | Who | What it does |
| --- | --- | --- |
| `company.find_or_create_by_domain` | members, intake keys | Finds the company by normalized domain or creates it. Idempotent. |
| `company.update` | members | Changes descriptive properties. |
| `company.set_relationships` | members | Sets the relationship flags (`isCustomer`, ...), with an optional reason kept in history. |
| `company.merge_into` | admin | Moves every related record from a duplicate to the kept company, then deletes the duplicate. Each blueprint that relates its records to Company extends it to move them. Refuses when legal identities conflict. |
| `contact.find_or_create_by_email` | members, intake keys | Finds the contact by lowercased email or creates it; links a company found by the email's domain when the domain is not a free mail provider. Idempotent. |
| `contact.update` | members | Changes descriptive properties. |

The two finders are authored actions: `upsert_by_<property>` is reserved for an
entity's generated upsert, which matches the value as given and links nothing.

## Roles

- One role per job, named for the job: `sales`, `marketing`, `finance`,
  `support`, `admin`. A member can hold several.
- One narrow role per machine caller: `intake` for a website form's API key, one
  role per workflow that writes records. A machine role holds only the
  permissions its caller needs.
- Destructive and irreversible permissions (`merge_into`, deletes, sending,
  signing, posting to the ledger) are granted explicitly, never through a broad
  role by accident.

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
