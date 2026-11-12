# Company agent: variations

Where companies legitimately differ. Each variation lists the options, what
each changes, and the default this blueprint takes.

## Channels

| Option | Changes |
| --- | --- |
| Telegram (default when the team has no preference) | `segmentstream agent init` sets it up; groups, topics, voice, exact posts from routines, file sending back to the chat. |
| Slack | A Slack app created from the console; conversations live in threads; approvals and questions are buttons only the asked member can press. |
| WhatsApp | One person per chat, no groups; replies outside Meta's 24-hour window need approved templates. Good for field staff who live in WhatsApp. |
| Several | One agent, one instructions file; each channel's connection in `segmentstream.json`. |

Microsoft Teams and email are not agent channels on the platform today; check
your `docs/agent.md`. Email can still reach the agent's work: a workflow on a
mailbox connection or a provider webhook stores each message on a record and
hands the agent a task, whose drafts a member sends.

## Group routing

- **Conversation routing** (default): a small decision model reads the last
  messages and replies only when the agent is the likely addressee and an answer
  is needed. Tune with `thresholds.reply`, and add a `defer` band to let the
  main model decide doubtful messages (each costs a turn).
- **Mention only** (`groups.mode: "mention"`, where your channel honours it;
  see `docs/agent.md`): quieter, but people must tag the agent; for large, busy
  groups.
- **Per chat**: `groups.chats` specializes one chat, such as a stricter
  threshold in the all-hands group.

## Session scope (Telegram)

- **One session per chat** (default): a reply to a colleague and a fresh
  message share history, so the agent follows a conversation it started.
- **One session per thread**: separate histories per reply thread, for groups
  that run several conversations at once. Slack always works in threads.

## File intake

- **On request** (default): file when asked, when the file answers the agent's
  request, or in a `filing` chat.
- **Automatic in every chat**: every business document is filed on arrival.
  Right for a small team that forwards everything; add the private-data rule
  below.
- **Submission only**: members without finance access may submit an invoice
  file through a narrow action that files it privately and returns only a
  status, with no reads of bills or bank lines.

## Private documents in groups

- **Direct message only** (default): in a group the agent asks for a direct
  message and does not describe the file.
- **File, never echo**: in a small trusted group the agent files identity papers
  or payslips through a restricted action and replies with the link only, never
  repeating numbers or dates of birth in text.

## Confirmation strictness

- **Platform classes** (default): routine reversible actions run at once;
  destructive, irreversible and external ones show a card.
- **Stricter**: mark more actions irreversible (stage changes in a regulated
  sale, price changes). Expect more cards.
- **Four eyes**: a proposal record that one member prepares and another
  approves, with the action run on approval. Build it in the domain blueprint
  that needs it, not in the agent.

## Routine autonomy

- **Propose only** (default): routines read, write a message, raise questions.
- **Act on certain cases**: a routine role gains a few named actions whose
  rules make the case certain, such as posting a bank line that matches an
  approved bill exactly. Every action it took is listed in the message so a
  member can reply "undo that one".

## Routine delivery

- **Post to the purpose's chat** (default).
- **Direct messages**: each addressee gets their own items
  (`telegram:private:<member id>`), useful when people do not read the group.
- **Record only**: the routine run is kept and shown in the app; nobody is
  messaged. The fallback where the channel cannot take exact posts.
- **Fewer messages**: one team summary that only links to each job chat's own
  summary, for teams that want a single morning message to read first.

## Questions to people

- **Ad hoc** (default): the agent or a routine raises a question when it needs
  one.
- **Batches**: an owner queues several questions for one person; the agent
  sends one at a time, waits for the answer, records it verbatim, clarifies if
  needed, then sends the next. Add `batch` and `order` properties and a "next
  open question" read.

## Models and cost

- **One model** (default): the starter's model for every session; preview
  deployments use a small model.
- **By role**: `models.chat.byRole` gives, say, finance a stronger model. The
  model is chosen when a session starts and never changes inside it.
- **Reasoning and caps**: `reasoning` in `agent.ts`; `limits.sessionUsage` for
  the cost cap, or no cap for a small trusted team.
- Voice messages: on by default (`models.stt`), off with `false`.

## Links in replies

- **App links** (default): labeled links to the record's page, from reads or
  the navigation catalog.
- **Open inside the chat app**: on Telegram, a small agent tool turns an app
  URL into a Mini App link after checking, as the member, that the record exists
  and is readable. The tool returns finished Markdown so the model never
  rebuilds the encoded link.

## Replies while working

- **Final reply only**: quiet chats; long tasks look silent.
- **Interim messages** (`channels.telegram.interimMessages: true`, default in
  this blueprint): one short line before a task of minutes. The instructions
  must forbid text alongside `segmentstream__no_reply`.

## Voice in gendered languages

Where the team's language marks the speaker's grammatical gender, choose one
form for the agent and state it in the voice section, so the agent does not
switch between forms.

## Sandbox

- **Base toolset** (default): PDFs, scans, spreadsheets, archives, OCR.
- **Documents toolset**: also edits and converts DOCX and PDF; switch
  `sandbox.ts` when the agent drafts documents.
- **Off**: `"sandbox": false` when the agent never works with files.

## Observability depth

- **Platform logs** (default): redacted tool calls for 30 days, session figures,
  router evidence.
- **Full traces**: an eve OpenTelemetry instrumentation that records inputs and
  outputs explains every wrong answer, but keeps message contents for longer and
  in more places. Agree on it with the team first.

## Country and time

Nothing in the agent is country-specific. Routines need the company's time
zone, working days and public holidays; cron expressions are UTC, so a step
computes the local business day, and a holiday calendar (a small entity or a
list in code) skips days off.
