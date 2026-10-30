// 11. POST /api/leads/stage — REAL (Neo4j)
import type { StageRequest, Lead, Stage } from "@/contract/types";
import { handle, readBody, requireFields, ApiError, now } from "@/lib/http";
import { useFixtures } from "@/lib/env";
import { loadLeads, saveLeadState } from "@/lib/repo";
import { logEvent } from "@/lib/neo4j";
import { store, stubEvent } from "@/lib/stub-store";

const STAGES: Stage[] = ["matched", "contacted", "replied", "meeting_booked", "closed_won", "closed_lost"];

export async function POST(req: Request) {
  return handle<{ lead: Lead }>(async () => {
    const body = await readBody<StageRequest>(req);
    requireFields(body, ["leadId", "stage"]);
    if (!STAGES.includes(body.stage)) throw new ApiError("BAD_REQUEST", "Unknown stage");

    const lead = useFixtures()
      ? store().leads.find((l) => l.id === body.leadId)
      : (await loadLeads([body.leadId]))[0];
    if (!lead) throw new ApiError("NOT_FOUND", "Lead not found");

    const from = lead.stage;
    lead.stage = body.stage;
    lead.lastActor = "rep";
    lead.updatedAt = now();
    if (useFixtures()) {
      stubEvent("rep", "stage_changed", `${from} -> ${body.stage}`, lead.id);
    } else {
      await saveLeadState(lead);
      await logEvent("rep", "stage_changed", `${lead.company.name}: ${from} -> ${body.stage}`, lead.id);
    }
    return { lead };
  });
}
