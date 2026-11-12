# Drive: interview

Ask these in one message before building. Each has a default, so "no opinion" is
a fine answer.

1. **Who in the company uses Drive, and should everyone see company documents by
   default, or only what is shared with them?**
   Why: this sets the `team` role's holders and each folder's
   `defaultTeamAccess`.
   Changes: "everyone reads company documents" gives company folders `viewer`;
   "need to know" gives `restricted` everywhere, so only owners, admins and
   shares open a document. A company where every member is staff and nobody
   outside signs in may put the team permissions on `member` instead.
   Default: company folders `viewer`, personal folders `restricted`; employees
   hold `team`.

2. **Do you share documents with people outside the company: clients,
   investors, auditors, contractors? By email only, or also by link? May they
   ever edit?**
   Why: outsiders become app members with the `guest` role, which forces
   `member` to read nothing.
   Changes: "never" drops `guest`, link sharing, the link page, the webhook and
   access requests from outsiders. "Email only" drops links. "They may edit"
   sets `allowOutsideEditors`.
   Default: by email and by link, as viewer or commenter, never editor.

3. **Which documents are confidential, and who may read each kind?** For
   example HR files, board papers, legal matters, payroll.
   Why: each confidential class is a confidentiality value, a top-level folder
   and a role that reads and administers it.
   Changes: one class and role per answer (`hr`, `board`, `legal`); classes are
   never opened through folder shares or links.
   Default: one class, `hr`, held by the people team.

4. **Should Drive admins be able to open everyone's personal files?**
   Why: admins recover a departed colleague's work, but some companies promise
   privacy for personal folders.
   Changes: "no" narrows the admin's read scope to exclude personal folders and
   adds `transferOwnership` for a deactivated member's files instead.
   Default: yes; admins read every `general` document, personal ones included.

5. **How are your folders organised today, and do you want documents filed
   automatically?** For example `Clients/<company>/<year>` or by department.
   Why: this decides the seed folders and whether filing rules exist.
   Changes: automatic filing adds rule-made folders found by their stable `key`,
   so renames never break filing, and a `filedBy: auto | manual` flag.
   Default: the company's top folders created by hand; no automatic filing.

6. **What do you write online, and what do you only upload? Do you use templates
   with fields, such as contracts or offer letters?**
   Why: the online editor, templates and document types are the largest part of
   the build.
   Changes: "only uploads" skips sections, the editor, printing and templates.
   Templates add `{{variables}}`; types add structured `data` such as an amount.
   Default: both; templates with variables; types added later by admins.

7. **How should printed PDFs look: paper size, margins, letterhead, fonts and
   languages?**
   Why: printing is code, and the fonts must cover every character you write.
   Changes: the page layout constants, the embedded fonts and the letterhead.
   Default: A4, a neutral sans-serif font with wide language coverage, no
   letterhead.

8. **How long should deleted documents stay in the trash, and do any documents
   have to be kept for a set number of years?**
   Why: purge is automatic; some records must legally be kept.
   Changes: `trashRetentionDays`, and per-type retention that refuses trashing
   before the end date.
   Default: 30 days in the trash; no per-type retention.

9. **Who may put documents on legal hold?**
   Why: a hold blocks deletion and change for everyone.
   Changes: a separate `legal` role instead of the class admins.
   Default: the admins of each class.

10. **Which records should documents link to?** Companies and contacts come with
    the foundation; deals, invoices, bills or employees come from other blueprints.
    Why: links are how people find a company's or a deal's documents.
    Changes: one optional relationship on `document_link` per target and a
    Documents tab on that record's page.
    Default: companies and contacts, plus whatever installed blueprints offer.

11. **Where do files come from besides the app: chat, an email inbox, an existing
    Google Drive or Dropbox? How large is the largest file you keep?**
    Why: each source is an intake path; size sets the file limit.
    Changes: chat filing through the agent; a mailbox connection and a workflow
    that files attachments; a one-time import workflow that keeps each file's
    original path. Larger files raise `maxBytes`, up to the platform's limit.
    Default: app uploads and chat; 100 MiB per file.

## Decisions a person makes every time

These are never defaults and never run unattended. The agent asks, names the
exact records and people, and waits for confirmation:

- Sharing a document or folder with someone outside the company, or creating or
  resetting a link: who, which level, until when, downloads on or off.
- Approving an access request or an invited colleague.
- Moving a document into or out of a confidential class.
- Placing a legal hold.
- Shortening the trash retention, or lifting a hold so that a document can be
  deleted.
- Importing real files from another system into the workspace.
