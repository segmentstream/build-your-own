# Drive: invariants

Rules that must hold in every version of Drive. Each one is a bug if broken.
Tests run on the harness in [testing](../../docs/testing.md) and use invented members (Ada Example, a teammate; Grace Sample, an outsider;
an `hr` holder; a `drive_admin`), the folders `Clients/Northwind` and `HR`, and
invented files. "Fixtures" below means that set.

1. **Every action that returns content asks `accessOf` first.**
   Why: actions run with their own authority, so a read inside a handler is never
   checked by the platform; the access function is the only check.
   Test: for each read action (`open`, `readContent`, `readVersion`,
   `share.list`, `accessLog`) and each fixture without access, call it on a
   document in `Clients/Northwind`. Expected: refused with a message that names
   no title or content. Repeat with a revoked share and with an expired one.

2. **The role fence never admits more than `accessOf` allows.**
   Why: `document_find`, `get`, MCP tools and file downloads are checked only by
   role scopes; if the fence is wider, people read around the actions.
   Test: for every fixture and every document of a seeded tree (owned,
   team-open, restricted, trashed, shared directly, shared through a folder two
   levels up, `hr`), compare the ids `document_find` returns with the ids where
   `accessOf` is at least `viewer`. Expected: equal sets. Do the same for
   `document_version_find` and for `files.download`, which answers 404 outside.

3. **No role reads a confidential class except that class's own roles.**
   Why: a wildcard (`*:read`, `*:*`) covers every entity, and an unscoped grant
   wins over every scope; one careless role opens every HR file.
   Test: load the deployed manifest and assert that no role, `member` included,
   holds `*:read`, `*:*`, `document:*`, `document_version:*`, or an unscoped
   read of any Drive entity, and that only the `hr` role's scopes name `hr`.

4. **Confidential documents never open through a folder share or a link.**
   Why: one folder share or a forwarded link must not reach people documents.
   Test: share the folder above `HR` with Grace, or try a link on an `hr`
   document. Expected: the link is refused; Grace's `accessOf` on any `hr`
   document is `none` and `document_find` returns none of them.

5. **Moving a document to another class ends every share, link and request.**
   Why: access granted for a general document must not survive it becoming HR.
   Test: share a document with Grace, create a link and a waiting request, move it
   into `HR` as an admin of both classes. Expected: all three are `revoked`;
   Grace gets `none`. As a `drive_admin` without `hr`: the move is refused.

6. **Revoking a share ends it and everything derived from it, at once.**
   Why: a link opened by ten people, or a colleague an outsider invited, must not
   keep access after the source is withdrawn.
   Test: Grace redeems a link; her colleague is approved through her share.
   Revoke the link. Expected: Grace's and the colleague's shares are `revoked` in
   the same transaction, and their next `open` is refused.

7. **Access derived from a share never exceeds it.**
   Why: an outsider must not widen what they were given by passing it on.
   Test: Grace holds `commenter` until a date with downloads off. Her invited
   colleague, approved with `editor` and no end, gets at most `commenter`, the
   same end and no downloads; narrowing Grace's share narrows the colleague's.

8. **An expired share opens nothing through any action from its expiry instant,
   and nothing anywhere after the next sweep.**
   Why: an end date is a promise to the owner.
   Test: give Grace a share ending at T. At T plus one second, `open` is refused.
   Run the sweep. Expected: the share is `expired` and `document_find` as Grace
   returns nothing.

9. **People outside the company never receive an internal comment or note.**
   Why: internal notes hold negotiating positions and opinions about the reader.
   Test: post an internal comment and a note as Ada, a shared comment as Ada and a
   comment as Grace. As Grace, call every action that returns comments. Expected:
   only the two shared ones. Grace's own comment is `shared` whatever she asks for,
   and a note from her is refused.

10. **Versions never change.**
    Why: a version is the record of what a document said; signatures and audits
    rely on it.
    Test: no action writes `snapshot`, `sha256` or `fileRevision` of an existing
    version. `print` on a printed version changes nothing and answers
    `attached: false`. `sha256` equals the SHA-256 of the canonical snapshot JSON,
    recomputed in the test, or of the file bytes.

11. **A concurrent edit is merged or refused, never lost.**
    Why: two people editing one contract is normal.
    Test: Ada and a colleague load a section; each changes a different block and
    saves. Expected: both changes are in the section. Both change the same block:
    the second save reports a conflict and the first text stays. `editContent`
    with a stale `expectedRevisions` is refused and writes nothing.

12. **Legal hold stops deletion and change until an admin of the class lifts it.**
    Why: a hold is a legal duty; one deletion can be sanctioned.
    Test: hold a document. Expected refusals: `trash`, `purge`, `editContent`,
    `saveSections`, comment `withdraw`, `move` to another class. A sweep past the
    retention date leaves it in place. Only a class admin lifts the hold.

13. **Purge happens only after the retention period, and only from the trash.**
    Why: the trash is the undo for deletion.
    Test: with 30 days' retention, purge a document trashed 29 days ago: refused.
    At 31 days without a hold: the document, its versions, sections, comments,
    shares, links and events are gone. A restored document is never purged.

14. **Each email goes out at most once.**
    Why: workflows repeat; people must not get the same email twice.
    Test: run `driveNotify` twice for one share and `driveMentions` twice for one
    comment. Expected: one notification record and one send per recipient.

15. **Outsiders cannot make the system email addresses they type.**
    Why: Drive must not become a spam relay.
    Test: Grace invites a colleague: a `requested` share; the document's
    approvers are emailed and the invited address is not. `redeemLink` with one address 3 times in 10 minutes:
    one email. 31 addresses through one link in an hour: 30 emails.
    `askForAccess` on an unknown id and on a document Grace cannot see: the same
    answer, and nothing is created for the unknown id.

16. **Sharing never brings back a deactivated account or adds a role beyond
    `guest`.**
    Why: a returning former employee would otherwise regain every role they held.
    Test: deactivate a member, then share with their address. Expected: refused,
    the member stays inactive, roles unchanged. Sharing with a new address
    invites a member whose only role is `guest`.

17. **A link token is shown once and stored only as its hash.**
    Why: a database read must not hand out working links.
    Test: create a link; the answer contains the token; the share stores only
    `tokenHash`, and no record or history row contains the token. `reset` makes
    the old token open nothing.

18. **Mentions reach only teammates who can open the document.**
    Why: a mention must not leak a document's title to someone outside its access.
    Test: Ada mentions a teammate without access: refused, naming them. Grace
    mentioning anyone: refused.

19. **A document's class is always its folder's.**
    Why: the fence filters on the document's class; a mismatch shows HR files to
    the team.
    Test: after `draft`, `upload`, `move` and `fileSubmission` into `HR`, each
    document's `confidentiality` is `hr`. A teammate without `hr`
    cannot draft or move into `HR`.

20. **Linking a document reveals nothing.**
    Why: a company page lists linked documents for whoever views it.
    Test: link a restricted document to Northwind. As a teammate without access,
    `document_find` filtered by `links: { some: { companyId } }` returns nothing
    and the company page shows no title.

21. **Drive content never reaches the warehouse.**
    Why: raw warehouse SQL and app credentials ignore ontology permissions.
    Test: after deploying, list the warehouse's `ontology` dataset. Expected: no
    view for any Drive entity id.
