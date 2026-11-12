# Company agent: interview

Ask these in one message, with the default for each. Skip what the person
already said. Never ask for bot tokens, passwords or real records in chat; the
person authorizes connections in the console after deploy.

## 1. Where does your team talk?

Slack, Telegram, WhatsApp, or several?

- Why: the channel decides the connection, how groups and threads work, and how
  members link their accounts.
- Changes: Telegram is set up by `segmentstream agent init`. Slack needs a
  Slack app created from the console. WhatsApp chats are one person each, so
  there are no groups and messages outside a 24-hour window are limited. Several
  channels share one agent and one set of instructions. Routines post to team
  chats through the built-in delivery, which today serves Telegram; check your
  `docs/agent.md` before promising scheduled posts elsewhere.
- Default: the tool the team already uses most; Telegram if none.

## 2. Which group chats should it join, and what is each one for?

For example: the whole team, sales, finance, a place to drop documents.

- Why: every group gets a `purpose` and a "when to use" text. The agent reads
  them to decide when to speak there, and routines use them to find where to
  post.
- Changes: the purposes (`team`, `sales`, `finance`, `filing`, ...), the routing
  examples in `groups.smart.instructions.append`, and which routine posts where.
  A group's members see everything the agent says there, so finance work needs
  its own group.
- Default: one team chat, plus one chat per department that has its own records,
  plus direct messages for everyone.

## 3. Which languages does the team write in, and which language should records be in?

- Why: the agent answers in each sender's language, but text it writes into
  records (notes, reasons, question context) should be one language so the
  records read the same for everyone. The pairing, confirmation and notice texts
  must exist in every language the team uses.
- Changes: the locales in `segmentstream.json`, the voice section of the
  instructions, and the routine prompts' language.
- Default: mirror the sender; records and routine messages in English.

## 4. Who should be able to use it, and with which roles?

- Why: the agent has no permissions of its own. It does exactly what the person
  asking may do. If roles are too broad, the agent is too.
- Changes: which members are invited, their roles, and whether `member` keeps a
  broad read such as `*:read` (routines inherit it).
- Default: invited members only, each with the job roles from the foundation;
  `member` reads only what everyone may read.

## 5. What should it call itself, and what do people call it in groups?

- Why: in groups the router decides from names and context whether a message is
  for the agent.
- Changes: `agentAliases`, the instructions' first line, the routing examples.
- Default: "Agent", plus the company's name followed by "agent".

## 6. What should happen to files people send?

File them only when asked, file every business document automatically in a
filing chat, or file everything everywhere?

- Why: casual sharing of a draft should not create records, but a team that
  forwards every invoice wants them kept without asking.
- Changes: the file intake rules in the instructions, the `filing` chat, which
  file-taking actions exist (the `drive` blueprint's upload, a bills action).
- Default: file when asked, when answering the agent's request, or in the filing
  chat.

## 7. Which private documents may be discussed in groups?

- Why: everything the agent reads in a group stays in that group's session.
- Changes: the private-files rule in the instructions (ask for a direct message,
  or file without describing contents).
- Default: payslips, identity papers and contracts are handled only in direct
  messages.

## 8. Which actions may it do without asking, and which must always ask?

- Why: the platform confirms destructive, irreversible and external actions;
  everything classified as routine runs at once.
- Changes: the `hints` and `confirm` cards of every action. Stricter companies
  mark more actions irreversible.
- Default: notes, statuses, links and drafts run at once; sending, signing,
  posting money, deleting and merging always ask.

## 9. Which routines do you want, when, and where should they report?

For example a weekday morning summary, bookkeeping proposals, follow-ups on
open questions.

- Why: each routine is a workflow with its own role, schedule and destination
  chat.
- Changes: the workflows, their roles and audiences, the cron times (written in
  UTC from the company's time zone) and the days they run.
- Default: a weekday morning summary to the team chat before the working day
  starts, in the company's time zone.

## 10. May routines change records on their own, or only propose?

- Why: an unattended task runs everything its role permits without a card, and
  records it reads may contain text written by outsiders.
- Changes: the routine roles. "Propose only" grants reads, questions and the
  post; "act on certain cases" adds a few named actions with rules that make
  them certain.
- Default: propose only. Domain blueprints may add narrowly defined automatic
  steps when the person agrees.

## 11. Who decides questions the agent cannot answer?

- Why: questions need an addressee, and answers need a decider.
- Changes: who receives `question:resolve` in each area, and whom routines
  address.
- Default: the owner of the record concerned; otherwise the role that owns the
  area (finance for money, sales for deals).

## 12. How much may one conversation cost?

- Why: each session has a model cost cap; a stronger model for some roles costs
  more.
- Changes: `limits.sessionUsage`, `models.chat.default` and `byRole`.
- Default: the starter's model and a cap of 2 US dollars per session, after which
  the member is asked to continue.

## Always a human decision

Whatever the answers, the agent never decides these on its own, and routines
never do them unattended:

- sending anything to a customer, supplier or other outsider;
- signing, or sending a document for signature;
- moving money, posting to the ledger beyond rules the company agreed, filing
  a tax return;
- deleting or merging records;
- granting or revoking access, inviting or deactivating members;
- posting in a chat other than the one the request came from.
