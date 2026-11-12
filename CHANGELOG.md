# Changelog

What changed in each blueprint, newest first. An agent updating a project built
from an earlier version reads the entries since the version recorded in the
project's `BLUEPRINTS.md` (see [AGENTS.md](AGENTS.md#updating-a-build)).

Each entry names the blueprint and its new version, what changed, and what a
project built from the previous version should do.

## Initial release

| Blueprint | Version |
| --- | --- |
| [Marketing analytics](blueprints/marketing-analytics/) | 1.0.0 |
| [CRM](blueprints/crm/) | 0.1.0 |
| [Email marketing](blueprints/email-marketing/) | 1.0.0 |
| [Bookkeeping](blueprints/bookkeeping/) | 1.0.0 |
| [Ad fraud detection](blueprints/ad-fraud-detection/) | 1.0.0 |
| [Company agent](blueprints/company-agent/) | 0.1.0 |
| [Drive](blueprints/drive/) | 1.0.0 |
| [E-signature](blueprints/e-signature/) | 1.0.0 |

The CRM and marketing analytics blueprints were built end to end by a coding
agent from these files before release, to milestone M1 with every invariant
tested, and corrected where the agent stumbled. Their `testedWith` records the
SDK versions of those builds. The test harnesses in [`kernel/`](kernel/), the
shared [pipeline notes](docs/pipeline-notes.md) and the marketing analytics
worked example in `fixtures/` came out of those builds.
