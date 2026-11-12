# Company agent

An AI agent that lives in your team's Slack, Telegram or WhatsApp and works on
your company's own records, with the permissions of whoever asks. It replaces
"AI agent for business" products and Copilot-style assistants that run on a
shared account and someone else's copy of your data.

## What you get

- Ask in the chat you already use and get answers from your own records, each
  with a link to the record it came from.
- Each person connects their chat account once. From then on the agent acts as
  them: it sees what they may see, does what their roles allow, and history
  names them.
- It changes records only through your actions. Anything destructive,
  irreversible or external, such as sending, signing, paying or deleting, waits
  for the person to press Confirm.
- Send it an invoice, a contract, a scan or a spreadsheet: it reads the file and
  files it on the right record.
- Every group has a purpose, so the agent knows what each chat is for, where to
  post, and when to stay quiet.
- Routines run on a schedule: a morning summary of what needs attention,
  bookkeeping proposals, follow-ups. They report in the right chat and keep a
  record of every run.
- When a decision belongs to a person, it asks that person and keeps the answer.
- Every blueprint you build becomes a new skill.

## Build it

```text
Read https://github.com/segmentstream/build-your-own/blob/main/AGENTS.md and follow it.
Build our company agent from the company-agent blueprint.
```

## How it fits

It needs the `foundation` for members, companies and contacts. On its own it
answers questions about those records. Each other blueprint adds skills:
`crm` (pipeline questions, follow-ups), `bookkeeping` (bank lines, bills and
proposals), `drive` (filing documents sent in chat), `e-signature` (sending for
signature), `email-marketing` (campaign drafts), `marketing-analytics` and
`ad-fraud-detection` (answers from metrics). Build those first or later; the
agent picks up their actions when they deploy.

## What it is not

- Not a general chatbot. It has no web browsing, and its file sandbox has no
  network, so nothing it reads can send company data out.
- Not an autopilot. It sends nothing to customers, signs nothing and moves no
  money unless a person asks and confirms. Unattended routines get a narrow role
  and mostly propose.
- Not every channel. The platform's agent channels are Telegram, Slack and
  WhatsApp; your project's `docs/agent.md` lists what your SDK supports.

## Authors

- [SegmentStream](https://github.com/segmentstream)
