// 6. GET /api/competitors — REAL (Neo4j)
import type { Competitor } from "@/contract/types";
import { handle } from "@/lib/http";
import { useFixtures as fixturesEnabled } from "@/lib/env";
import { loadCompetitors } from "@/lib/repo";
import { store } from "@/lib/stub-store";

export async function GET() {
  return handle<{ competitors: Competitor[] }>(async () => ({
    competitors: fixturesEnabled() ? store().competitors : await loadCompetitors(),
  }));
}
