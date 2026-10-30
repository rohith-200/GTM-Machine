# Person B: office foundation

The frontend lives on `feat/person-b-frontend`. All data is requested from the existing `/api` routes; the frontend never imports backend fixtures or calls enrichment, model, search, or database vendors.

## Completed in this milestone

- Shared layout, navigation to all six routes, warm paper styling, and a procedural 3D office.
- Each object and its accessible label navigate to the matching route. Route changes move the camera to the corresponding station. Browser back/forward uses the same route-driven camera state.
- Office map and Focus mode. Reduced-motion preferences disable camera travel and interface animation. A missing WebGL context leaves navigation and forms usable.
- Lazy-loaded Three.js, capped rendering resolution, rendering only during transitions or resizing, and resource cleanup on unmount.
- One browser API helper that unwraps `ApiResponse<T>`, preserves error codes/messages, handles network and malformed-response errors, and supports cancellation.
- Tier, confidence, email-status, source-link, and actor components in `src/components/shared/status-badges.tsx`.
- Collapsible Agent Thinking panel on every route, with non-overlapping 1.5-second polling, timestamp cursors, ID deduplication, cancellation, reconnect handling, and bounded history. Loading demo data resets the polling cursor.
- Product intake submitted to `POST /api/icp`, with validation, a disabled/loading submit button, recoverable errors, and preserved form state during navigation.
- Basic customer-profile display. It uses the ICP returned by the POST directly; opening `/icp` separately reads `GET /api/icp`.
- Header action connected to `POST /api/demo/load`.

## Subsequent milestones

The four other routes intentionally have labeled foundation screens rather than fabricated campaign results. Continue with ICP segment decisions and discovery, then the leads table, outreach review, Kanban, and analytics using the frozen contract.

## Local development and checks

```text
npm ci
npm run dev
npm run lint
npm run typecheck
npm run test:frontend
npm run build
```

On this Windows workstation, the preinstalled Node 24.14.1 hit a Turbopack stylesheet-worker crash; the same build succeeded with the bundled Node 24.22.1. If the worker exits before connecting, run Next with the working Node runtime. No build configuration or backend changes were needed.

Backend integrations and API behavior remain owned by Person A. Real ICP generation requires the backend environment settings; `USE_FIXTURES=true` enables the existing sample-data mode for local checks without external API calls. No credential values are included in this repository.

After syncing the real-ICP backend from main, five server files import `useFixtures` as `fixturesEnabled` to prevent React's hook lint rule from misidentifying that plain environment helper. Its export name, behavior, and the frozen shared contract are unchanged.

When opening the frontend PR, include `@tenki-reviewer` in its title, description, and a PR comment, as requested by the team.
