// 8. POST /api/drafts — STUB
import type { LeadIdsRequest, Message } from "@/contract/types";
import { handle, readBody, requireFields, newId, now } from "@/lib/http";
import { store, stubLog } from "@/lib/stub-store";

export async function POST(req: Request) {
  return handle<{ messages: Message[] }>(async () => {
    const body = await readBody<LeadIdsRequest>(req);
    requireFields(body, ["leadIds"]);
    await new Promise((r) => setTimeout(r, 1000));
    const s = store();
    const created: Message[] = [];
    for (const lead of s.leads.filter((l) => body.leadIds.includes(l.id))) {
      const first = lead.person.name.split(" ")[0];
      const signal = lead.company.signals[0]?.description ?? `${lead.company.industry} finance team`;
      const base = { leadId: lead.id, signalUsed: signal, status: "pending_approval" as const, editedByRep: false, createdAt: now(), sentAt: null };
      created.push(
        { ...base, id: newId("msg"), channel: "email", subject: `Quick idea for ${lead.company.name}`,
          body: `Hi ${first},\n\nNoticed: ${signal}. Teams in that spot usually want faster reconciliation.\n\nWorth a 15-minute look next week?\n\nBest,\nSam` },
        { ...base, id: newId("msg"), channel: "linkedin", subject: null,
          body: `Hi ${first}, saw the news at ${lead.company.name} (${signal.toLowerCase()}). Would love to connect.` },
      );
      stubLog("draft", `Drafted email + LinkedIn for ${lead.person.name}`, "success");
    }
    s.messages.unshift(...created);
    return { messages: created };
  });
}
