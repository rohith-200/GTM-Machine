# Person B: discovery and lead research

Implemented on `feat/person-b-discovery`, including the backend changes merged into main through `9aac432`. This follows the [office foundation](frontend-milestone.md).

## User flow

1. Open the ICP brief. Accept, dismiss, or reset an expansion segment. Decisions are saved before discovery can start; failed saves retain the last saved profile.
2. Choose **Find leads**. A research progress panel appears and Agent Thinking opens. Successful discovery moves to the filing cabinet with the returned leads and competitors already available.
3. Review companies in descending fit-score order. The table shows decision-makers, tiers, buying signals, email status/confidence, and evidence links. Narrow screens scroll the table without widening the page.
4. Select a company to open its research sheet: company facts, fit reason, contact details, all buying signals and sources, and warm introduction paths. Escape closes the sheet and restores focus to the company button.
5. Select individual leads or all leads, then choose **Enrich selected**. Updates merge into the existing results without dropping other companies. Failed requests preserve selection for retry.
6. Switch to **Competitors** for positioning, category, public pricing, differentiators, and sources. Missing values remain visible as placeholders.

## API use

| Action | Route | Body or query |
| --- | --- | --- |
| Open an uncached profile | `GET /api/icp` | — |
| Save segment decision | `POST /api/icp/segment` | `icpId`, `segmentId`, `status` |
| Discover companies and competitors | `POST /api/discover` | `icpId` |
| Open uncached lead results | `GET /api/leads` | — |
| Open uncached competitor research | `GET /api/competitors` | — |
| Enrich selected leads | `POST /api/enrich` | `leadIds` |
| Find introductions for an open lead | `GET /api/graph/warm-paths` | `leadId` |

Discovery results populate the shared workspace cache directly. Opening the results page does not immediately overwrite the POST response with a GET. New product briefs and saved segment decisions invalidate discovery caches. Loading demo data resets caches and selection. Requests are cancelled on unmount or workspace reset; repeated clicks cannot submit overlapping mutations in the same screen.

The frontend uses the frozen contract and local `/api` routes. It does not import backend fixtures or contact external vendors. No package dependencies or shared contract types were changed. Newly merged server routes alias the existing `useFixtures` import to `fixturesEnabled`, preventing React hook lint false positives without changing behavior.

## Validation

- `npm run lint`: zero errors; one existing warning in `src/lib/discover.ts`.
- `npm run typecheck`: passed.
- `npm run test:frontend`: 10 tests passed, including partial enrichment merging and unknown dates.
- Production build: passed with the working bundled Node 24.22.1 runtime and `USE_FIXTURES=true`. Existing API handlers log `NEXT_PRERENDER_INTERRUPTED` during build; Next correctly lists those routes as dynamic and completes successfully.
- Chrome browser checks against the actual local routes in sample-data mode: saved decisions, duplicate-click prevention, discovery handoff, score ordering, evidence links, sheet keyboard/focus behavior, warm-path query, selection, partial enrichment, competitors, empty discovery results, demo reset, and no page overflow at widths 1024, 736, 390, and 320.
- Browser checks also simulated failed saves/discovery/enrichment and delayed responses to verify recovery. A controlled enrichment response verified email updates because the backend's sample enrichment returns the existing contact unchanged.

Live vendor calls and macOS were not exercised in these checks. Use Person A's environment configuration for live discovery and enrichment; `USE_FIXTURES=true` is only for local sample-data checks.

Next frontend milestone: draft outreach for selected leads and build the Outbox approval/edit/reject workflow. Pipeline and reports follow after that. Include `@tenki-reviewer` in the PR title, description, and a PR comment when submitting this branch.
