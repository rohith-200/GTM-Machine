# Person B: outreach drafts and Outbox

The Outbox is built on `feat/person-b-outbox` from the latest `main`, after discovery PR #5 and backend PR #6 were merged.

## Flow

1. Select leads in `/leads` and choose **Draft outreach**. This sends `POST /api/drafts` with the selected `leadIds`, opens Agent Thinking, merges returned messages into the shared cache, and moves to `/review`.
2. The Outbox loads all messages with `GET /api/messages` when it has no cached draft response. Pending messages are shown before prior decisions.
3. Each message includes its buyer, company, channel, subject when relevant, signal, and a citation when the signal matches the lead research. The lead research link remains available when no matching citation is present.
4. **Edit** opens local subject/body fields. **Save edit** sends `POST /api/messages/review` with action `edit`; it does not approve or send.
5. **Approve and send** is an explicit action for email. It may send through the configured backend integration. LinkedIn approval only approves the draft for manual sending; **Copy message** is available after approval.
6. **Reject** is explicit. Review responses update the shared message cache and any already-loaded lead cache. A `failed` message response is shown as a send failure, not a successful send.

The frozen contract at `src/contract/types.ts` is unchanged. Message cache data is cleared on demo reset and when a new product brief is submitted.

## Sample-data check

Use the existing backend fixture mode (`USE_FIXTURES=true`) and Load demo data. The fixture route skips external email sending. Drafting, saving edits, opening messages, and navigation do not approve messages. Do not run browser checks with live send credentials.

Checks: `npm run lint`, `npm run typecheck`, `npm run test:frontend`, and `npm run build`.

When opening a PR, include `@tenki-reviewer` in the title, description, and a PR comment.
