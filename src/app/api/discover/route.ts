// 4. POST /api/discover — REAL (Tavily + Nebius + Neo4j)
import type { DiscoverRequest, Lead, Competitor } from "@/contract/types";
import { handle, readBody, requireFields, ApiError } from "@/lib/http";
import { useFixtures as fixturesEnabled } from "@/lib/env";
import { loadIcp } from "@/lib/icp";
import { discover } from "@/lib/discover";
import { store } from "@/lib/stub-store";

export const maxDuration = 120;

export async function POST(req: Request) {
  return handle<{ leads: Lead[]; competitors: Competitor[] }>(async () => {
    const body = await readBody<DiscoverRequest>(req);
    requireFields(body, ["icpId"]);
    if (fixturesEnabled()) {
      const s = store();
      return { leads: [...s.leads].sort((a, b) => b.fitScore - a.fitScore), competitors: s.competitors };
    }
    const icp = await loadIcp(body.icpId);
    if (!icp) throw new ApiError("NOT_FOUND", "ICP not found");
    const result = await discover(icp);
    // Keep still-stubbed routes (enrich, drafts, review) working on the real leads.
    const s = store();
    s.leads = result.leads;
    s.competitors = result.competitors;
    s.messages = [];
    return result;
  });
}
