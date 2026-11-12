# Public SDKs

Everything a blueprint needs is published under the Apache-2.0 licence. A new
project from `segmentstream init` already depends on the right packages at
current versions; the CLI tells you when a newer release is available, and
`segmentstream sync` refreshes the project's agent docs and skills.

| Package | Registry | Used for | Blueprints |
| --- | --- | --- | --- |
| `segmentstream` CLI | `curl -fsSL https://segmentstream.com/install.sh \| sh` | Create, check, run and deploy projects; authorize connections; query the warehouse | All |
| [`@segmentstream/ontology`](https://www.npmjs.com/package/@segmentstream/ontology) | npm | Entities, properties, relationships, actions, roles, workflows and metrics: the app's backend, its API and MCP tools | All with records |
| [`@segmentstream/app`](https://www.npmjs.com/package/@segmentstream/app) | npm | Sign-in, the ontology client and warehouse queries in the Next.js app | All with screens |
| [`@segmentstream/agent`](https://www.npmjs.com/package/@segmentstream/agent) | npm | The workspace agent in Slack, Telegram or WhatsApp | company-agent, and every blueprint's agent skills |
| [`@segmentstream/web-tracker`](https://www.npmjs.com/package/@segmentstream/web-tracker) | npm | Browser page views and server request evidence sent to an event stream | marketing-analytics, ad-fraud-detection |
| [`segmentstream-pipeline`](https://pypi.org/project/segmentstream-pipeline/) | PyPI (pre-release) | Ingestions, SQL models, checks, jobs and schedules in the warehouse | marketing-analytics, ad-fraud-detection, bookkeeping |
| [`segmentstream-connections`](https://pypi.org/project/segmentstream-connections/) | PyPI | Declaring OAuth and API-key connections to providers | Any blueprint that reads a provider |

Where each one is documented inside a project:

| Topic | Path in a project created by `segmentstream init` |
| --- | --- |
| Platform rules for agents | `AGENTS.md` |
| Choosing where work goes | `docs/concepts.md` |
| Ontology, actions, roles, workflows | `docs/ontology.md`, `.agents/skills/ontology/` |
| Metrics on entities | `docs/ontology-metrics.md` |
| App data and sign-in | `docs/app-data.md`, `docs/app-authentication.md` |
| Connections | `docs/connections.md`, `.agents/skills/connections/` |
| Event streams | `docs/events.md` |
| Ingestions, models, checks, jobs | `docs/ingestion.md`, `docs/models.md`, `docs/checks.md`, `docs/jobs.md` |
| The workspace agent | `docs/agent.md`, `.agents/skills/agent/` |
| The CLI | `docs/cli.md` |

Blueprints name a minimum SDK only when they need a recent capability. Newer
releases are always fine.
