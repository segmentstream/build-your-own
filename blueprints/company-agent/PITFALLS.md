# Company agent: pitfalls

Mistakes already made by agents building company agents on the platform.

## 1. A schedule in the agent that never runs

- Symptom: a `schedules/` folder in `agent/` deploys cleanly, and the morning
  report never arrives.
- Cause: the platform does not run the agent's own cron jobs.
- Instead: a workflow with a `cron` trigger that hands the agent an
  `agentTask` and posts the answer from a step. Never an external cron service,
  a hosting provider's scheduler or an API key for scheduled work.

## 2. Instructions that name tools which no longer exist

- Symptom: after a rename or an SDK upgrade, the agent calls a tool that is not
  there, or uses retired discovery tools copied from an older agent, and then
  tells the member the data does not exist.
- Cause: instructions are the workspace's own file and are never synced; the
  agent follows them literally.
- Instead: the names test (INVARIANTS.md, rule 19) in the ontology checks, and
  instructions that describe behaviour rather than list tools. Older agents
  answered `[SILENT]` to stay quiet in groups; call `segmentstream__no_reply`.

## 3. Business rules in the instructions, or only in a guide

- Symptom: the agent follows a rule in one chat and not another; or a rule
  written in an entity's Markdown guide is ignored.
- Cause: the instructions grow into a manual of every entity, and guides are for
  people; the agent reads entity and action descriptions through its tools.
- Instead: put the rule in the action (its checks and rejection messages) and in
  the descriptions. Keep the instructions to behaviour that spans tools. If an
  instruction says which tool to use for a change, the entity needs
  `writes: "actions"`.

## 4. Business data in the instructions

- Symptom: instructions name a client, a chat title, a colleague's email or a
  balance threshold. Every member now sees them, and Git keeps them forever.
- Cause: the quickest fix for one conversation was a sentence in the prompt.
- Instead: facts live in records the member may read; destinations are found by
  a chat's `purpose`; thresholds are properties of a settings record or of the
  action. The no-business-data test catches what slips through.

## 5. Asking for approval in prose, or approving twice

- Symptom: the agent writes "Shall I go ahead?" and then also shows a card; or
  runs a destructive action after a typed "yes".
- Cause: confirmation logic written into the instructions.
- Instead: classify every action with `hints` and, for irreversible ones, a
  `confirm` card. The platform asks, only the requester can press, and a press
  after ten minutes cancels. Unclassified actions ask every time, which trains
  people to press Confirm without reading; classify them.

## 6. A routine role that can do too much

- Symptom: a morning task excluded bank lines, deleted drafts or emailed a
  customer because a record's text told it to.
- Cause: the workflow's role was a copy of an admin role, or `member` grants
  `*:read` and more, which every workflow run inherits.
- Instead: one role per routine with a reviewed list, propose-only by default,
  and a narrow `member`. Prompt words like "never exclude" are not a boundary;
  the role is.

## 7. A summary that leaks into the wrong room

- Symptom: finance figures appear in the all-hands chat.
- Cause: the routine read with a broad role and posted to the team chat; or
  someone asked the agent about payroll in a group, and the group's shared
  session kept it.
- Instead: one routine per audience, with reads no wider than that chat's
  members may see; private work in direct messages; the agent only in groups
  whose members may see what is said there.

## 8. Posting to chats with a custom sender

- Symptom: duplicate morning messages after a retry, posts without attribution,
  or a "notification" entity that relays text to the agent.
- Cause: calling the chat provider's API from an action or step.
- Instead: `chat_post_message` from the agent (with its exact-text card) and
  `AgentChat.actions.postMessage` from workflow steps with a stable idempotency
  key. Agent tasks cannot post; never retry an `uncertain` post.

## 9. Finding a chat by its title

- Symptom: the routine posts nowhere after someone renames the group, or posts
  to the wrong one of two similarly named groups.
- Cause: the code looked the chat up by title, or hard-coded its id.
- Instead: set `purpose` on each chat and look it up by purpose; none or
  several is a recorded `no_destination`, never a guess.

## 10. A failed task that looks like a quiet day

- Symptom: no morning message, and nobody notices for a week.
- Cause: the workflow returned early when `agentTask` failed, timed out, was
  `busy` (ten live tasks per workspace) or ran outside production
  (`agent_unavailable`).
- Instead: always record the run, post a one-line notice with the reason plus
  the items code decided, and raise a question for `needs_input`. Spread
  routines across the hour, and never start one agent task per record.

## 11. Treating a refusal or an error as "nothing found"

- Symptom: "there are no unpaid invoices" when the member lacked access or a tool
  call failed.
- Cause: the model read an error or an empty first page as an answer.
- Instead: the instructions say that a refusal and an error are not results,
  totals come from metrics or complete reads, and a partial count is labeled.
  The acceptance scenarios check it.

## 12. Retyped numbers

- Symptom: an amount filed from a statement is off by a digit, or a total is
  added up wrong.
- Cause: the model copied figures from a file or summed them itself.
- Instead: exact sums with `attachments_table` or `query_metrics`; values a
  sandbox script computes go to the action through
  `segmentstream__ontology_call_file`, never retyped.

## 13. Files that expire before anyone keeps them

- Symptom: "I saved it" and the document is not there a day later; or only the
  first file of an album was filed; or the same invoice exists twice.
- Cause: chat attachments last 24 hours, the agent stopped after the first file,
  and the target action did not deduplicate.
- Instead: promote every business file first, through an action that
  deduplicates by SHA-256, and reply with the links the action returned.

## 14. A silent group bot

- Symptom: the agent answers in direct messages but never in a Telegram group.
- Cause: the bot's privacy mode is on, so it never sees group messages; or
  nobody paired, and unlinked people only provide context.
- Instead: turn privacy mode off in BotFather (or make the bot an
  administrator), re-add it, and have each member pair once in a direct message.

## 15. Agent logs are readable by every workspace member

- Symptom: a member is surprised that a colleague read their direct-message
  conversation in the logs.
- Cause: every Cloud member with workspace access can read all agent logs,
  direct messages included, for 30 days.
- Instead: tell the team when the agent goes live, and keep Cloud workspace
  access to the people who operate the workspace.
