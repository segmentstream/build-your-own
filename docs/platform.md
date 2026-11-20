# What the platform supports

Short answers for people, and the coding agents working for them, who want to know whether their
software fits [SegmentStream](https://segmentstream.com) before they build. Each holds for every
workspace today. To check anything not listed here, install the CLI and run
`segmentstream init ./segmentstream-starter`: it writes the workspace starter without signing in
or going online, and its `AGENTS.md`, `docs/` and `.agents/skills/` describe every part of the
platform. An agent whose sandbox cannot reach segmentstream.com asks the person to allow that
domain in the sandbox's network settings.

**Can people open pages without signing in?** Yes. The paths listed in `publicPaths` in
`app/src/proxy.ts` are open to anyone, such as a landing page or a public form, and each covers
the paths under it, so `/` opens the whole app. Every other page asks for sign-in.
[Apps and sign-in](https://segmentstream.com/platform/apps)

**Who can sign in?** By default only the members you invite, with an email code. The ontology's
`signUp` lets strangers sign up by email, Telegram or WhatsApp with the roles you name.

**Can visitors of a website talk to the agent without an account?** Yes. Declare `guest` in the
ontology with the website's address, and its visitors chat with the company agent as guests, with
only the permissions you give guests, an optional bot check, and daily limits on turns and model
spend. [Company agent](https://segmentstream.com/platform/agent)

**Can the app use our own domain?** Yes. Every app is online at its workspace's address under
segmentstream.app. To serve it at a domain you own, run `segmentstream domain connect example.com`,
publish the DNS records it prints, declare the host in `app/domains.json` and deploy; HTTPS,
sign-in and redirects follow. `segmentstream domain buy` orders a new domain for the workspace.
[Your own domain](https://segmentstream.com/developers/cli#your-own-domain)

**Which framework does the app use?** Next.js with the App Router, version 16.4.1 or later, and
React 19, in the `app/` folder of the workspace's Git repository. `segmentstream deploy` builds
and hosts it. [App SDK](https://segmentstream.com/developers/app-sdk)

**Where does the data live?** In the company database: the entities declared in `ontology/`, each
changed through an action that checks roles and keeps history. Files are stored on records. The
app's own file system keeps nothing between requests, so an app writes no data files.

**Where does work that takes minutes run?** In a workflow, started on a schedule, after an action
changes a record, from a webhook or from the app. Its steps are durable and retried on their own,
so writing a report with a model does not depend on a request staying open. Pipeline jobs are for
warehouse data. [Workflows](https://segmentstream.com/platform/workflows)

**How does code call an AI model such as Claude?** Through AI Gateway: a workflow step calls a
model with the AI SDK, and the company agent uses the model named for each role. There is no API
key to create or store, and models are billed at each provider's list price with no markup.
[AI Gateway](https://segmentstream.com/platform/ai-gateway)

**Where do credentials for other services go?** In connections. Calls go through the platform, so
the credential never reaches the code, its logs or an agent's context.
[Connections](https://segmentstream.com/platform/connections)

**What does it cost?** Usage-based, in US dollars, with no seats; AI models at list price. New
accounts start with free platform usage, with no card needed.
[Pricing](https://segmentstream.com/pricing)
