// 7. POST /api/enrich — REAL (Hunter.io)
import type { LeadIdsRequest, Lead } from "@/contract/types";
import { handle, readBody, requireFields, now } from "@/lib/http";
import { useFixtures } from "@/lib/env";
import { loadLeads, saveLeadState } from "@/lib/repo";
import { enrichLead, fallbackEnrich } from "@/lib/hunter";
import { logAgent, logEvent } from "@/lib/neo4j";
import { mapLimit } from "@/lib/outreach";
import { store } from "@/lib/stub-store";

export const maxDuration = 60;

export async function POST(req: Request) {
  return handle<{ leads: Lead[] }>(async () => {
    const body = await readBody<LeadIdsRequest>(req);
    requireFields(body, ["leadIds"]);
    if (useFixtures()) return { leads: store().leads.filter((l) => body.leadIds.includes(l.id)) };

    const leads = await loadLeads(body.leadIds);
    await logAgent("enrich", `Enriching ${leads.length} leads with Hunter.io`);
    await mapLimit(leads, 3, async (lead) => {
      try {
        const line = await enrichLead(lead);
        await logAgent("enrich", line, lead.person.email ? "success" : "warn");
        if (!lead.person.email) await logAgent("enrich", await fallbackEnrich(lead), "info");
      } catch (e) {
        await logAgent("enrich", `${lead.company.name}: ${(e as Error).message}`, "warn");
        try {
          await logAgent("enrich", await fallbackEnrich(lead), lead.person.email || lead.person.linkedinUrl ? "info" : "warn");
        } catch (e2) {
          lead.person.emailStatus = "unknown";
          await logAgent("enrich", `Fallback failed: ${(e2 as Error).message}`, "error");
        }
      }
      lead.updatedAt = now();
      await saveLeadState(lead);
    });
    const found = leads.filter((l) => l.person.email).length;
    await logEvent("ai", "leads_enriched", `Enriched ${leads.length} leads, ${found} emails found`, null);
    return { leads };
  });
}
