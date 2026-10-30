# Person B: workspace reports

The Reports monitor at `/dashboard` uses only the existing local endpoints:

- `GET /api/analytics` for stage counts, conversion rates, lead fit tiers, message outcomes, and AI/rep action totals.
- `GET /api/activity` for the workspace activity timeline.

All displayed totals come from those responses; the frontend does not substitute sample metrics. Analytics and activity load independently, with retry/refresh controls and empty/loading/error states. A workspace reset remounts the report data cache so a new product context fetches fresh values.

The analytics API's approved-message count includes messages already sent; the dashboard labels this to avoid implying the counts are mutually exclusive.

The dashboard preserves the shared office shell and uses responsive, accessible HTML/CSS panels rather than adding a chart dependency.

When opening a PR, include `@tenki-reviewer` in the title, description, and a PR comment.
