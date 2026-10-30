// 11. POST /api/leads/stage — STUB
import type { StageRequest, Lead } from "@/contract/types";
import { handle, readBody, requireFields, ApiError, now } from "@/lib/http";
import { store, stubEvent } from "@/lib/stub-store";

export async function POST(req: Request) {
  return handle<{ lead: Lead }>(async () => {
    const body = await readBody<StageRequest>(req);
    requireFields(body, ["leadId", "stage"]);
    const lead = store().leads.find((l) => l.id === body.leadId);
    if (!lead) throw new ApiError("NOT_FOUND", "Lead not found");
    const from = lead.stage;
    lead.stage = body.stage;
    lead.lastActor = "rep";
    lead.updatedAt = now();
    stubEvent("rep", "stage_changed", `${from} -> ${body.stage}`, lead.id);
    return { lead };
  });
}
