// 5. GET /api/leads — REAL (Neo4j)
import type { Lead } from "@/contract/types";
import { handle } from "@/lib/http";
import { useFixtures as fixturesEnabled } from "@/lib/env";
import { loadLeads } from "@/lib/repo";
import { store } from "@/lib/stub-store";

export async function GET() {
  return handle<{ leads: Lead[] }>(async () => ({
    leads: fixturesEnabled() ? [...store().leads].sort((a, b) => b.fitScore - a.fitScore) : await loadLeads(),
  }));
}
