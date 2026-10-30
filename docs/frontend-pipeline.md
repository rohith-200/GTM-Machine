# Person B: lead pipeline

The Pipeline is built on `feat/person-b-pipeline` from updated `main`, after Outbox PR #7 was merged.

## Flow

- `/pipeline` reads leads from the shared workspace cache or `GET /api/leads`.
- The board always shows all six contract stages: matched, contacted, replied, meeting booked, closed won, and closed lost.
- Cards are ordered by fit score within each stage. They include company and buyer context, fit tier and score, and the AI/Rep attribution.
- Move a card by dragging it into another stage or using its accessible **Move lead** selector. Both call `POST /api/leads/stage`.
- Successful writes use the returned lead to update the shared cache without removing other leads. A failed write restores that lead's previous stage and shows the API error, so the change can be retried.

The frozen contract remains unchanged. The board keeps narrow-screen overflow inside its own horizontal scroll area, and the stage selector is available when dragging is inconvenient.

## Sample-data check

Use the existing fixture mode and Load demo data. Moving a stage updates the sample lead's `stage`, `lastActor`, and timestamp through the existing route. No external integrations are used.

Checks: `npm run lint`, `npm run typecheck`, `npm run test:frontend`, and `npm run build`.

When opening a PR, include `@tenki-reviewer` in the title, description, and a PR comment.
