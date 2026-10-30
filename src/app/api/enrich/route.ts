// 7. POST /api/enrich — STUB
import type { LeadIdsRequest, Lead } from "@/contract/types";
import { handle, readBody, requireFields, now } from "@/lib/http";
import { store, stubLog } from "@/lib/stub-store";

export async function POST(req: Request) {
  return handle<{ leads: Lead[] }>(async () => {
    const body = await readBody<LeadIdsRequest>(req);
    requireFields(body, ["leadIds"]);
    await new Promise((r) => setTimeout(r, 800));
    const out: Lead[] = [];
    for (const lead of store().leads.filter((l) => body.leadIds.includes(l.id))) {
      if (lead.person.emailStatus === "not_enriched") {
        const [first, ...rest] = lead.person.name.toLowerCase().split(" ");
        lead.person.email = `${first}.${rest.join("")}@${lead.company.domain}`;
        lead.person.emailStatus = "verified";
        lead.person.emailConfidence = 94;
        lead.updatedAt = now();
      }
      stubLog("enrich", `Hunter: ${lead.person.name} -> ${lead.person.emailStatus}`, "success");
      out.push(lead);
    }
    return { leads: out };
  });
}
