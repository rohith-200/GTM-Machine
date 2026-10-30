// 8. POST /api/drafts — REAL (Nebius)
import type { LeadIdsRequest, Message } from "@/contract/types";
import { handle, readBody, requireFields, ApiError } from "@/lib/http";
import { useFixtures } from "@/lib/env";
import { loadLeads, saveMessages } from "@/lib/repo";
import { loadIcp } from "@/lib/icp";
import { draftForLead, mapLimit } from "@/lib/outreach";
import { logAgent, logEvent } from "@/lib/neo4j";
import { store } from "@/lib/stub-store";

export const maxDuration = 90;

export async function POST(req: Request) {
  return handle<{ messages: Message[] }>(async () => {
    const body = await readBody<LeadIdsRequest>(req);
    requireFields(body, ["leadIds"]);
    if (useFixtures()) return { messages: store().messages.filter((m) => body.leadIds.includes(m.leadId)) };

    const [leads, icp] = await Promise.all([loadLeads(body.leadIds), loadIcp()]);
    if (!leads.length) throw new ApiError("NOT_FOUND", "No matching leads");
    await logAgent("draft", `Drafting email + LinkedIn for ${leads.length} leads with Nebius`);
    const results = await mapLimit(leads, 4, async (lead) => {
      const msgs = await draftForLead(lead, icp);
      await logAgent("draft", `Drafted for ${lead.person.name} using signal: ${msgs[0].signalUsed}`, "success");
      return msgs;
    });
    const messages: Message[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") messages.push(...r.value);
      else void logAgent("draft", `Draft failed for ${leads[i].company.name}: ${(r.reason as Error).message}`, "error");
    });
    if (!messages.length) throw new ApiError("UPSTREAM_FAILED", "All drafts failed");
    await saveMessages(messages);
    await logEvent("ai", "messages_drafted", `Drafted ${messages.length} messages, waiting for approval`, null);
    return { messages };
  });
}
