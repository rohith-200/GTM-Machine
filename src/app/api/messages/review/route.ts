// 10. POST /api/messages/review — STUB (the human approval gate)
import type { ReviewRequest, Message, Lead } from "@/contract/types";
import { handle, readBody, requireFields, ApiError, now } from "@/lib/http";
import { store, stubEvent, stubLog } from "@/lib/stub-store";

export async function POST(req: Request) {
  return handle<{ message: Message; lead: Lead }>(async () => {
    const body = await readBody<ReviewRequest>(req);
    requireFields(body, ["messageId", "action"]);
    const s = store();
    const message = s.messages.find((m) => m.id === body.messageId);
    if (!message) throw new ApiError("NOT_FOUND", "Message not found");
    const lead = s.leads.find((l) => l.id === message.leadId);
    if (!lead) throw new ApiError("NOT_FOUND", "Lead not found");

    if (body.action === "edit") {
      if (!body.body) throw new ApiError("BAD_REQUEST", "body is required for edit");
      message.subject = message.channel === "email" ? body.subject : null;
      message.body = body.body;
      message.editedByRep = true;
      stubEvent("rep", "message_edited", `Rep edited ${message.channel} draft`, lead.id);
    } else if (body.action === "reject") {
      message.status = "rejected";
      stubEvent("rep", "message_rejected", `Rep rejected ${message.channel} draft`, lead.id);
    } else if (body.action === "approve") {
      if (message.channel === "email") {
        await new Promise((r) => setTimeout(r, 800));
        message.status = "sent";
        message.sentAt = now();
        stubLog("send", `Sent email to ${lead.person.email ?? lead.person.name} via One (Gmail)`, "success");
        stubEvent("rep", "message_sent", `Email approved and sent to ${lead.person.email ?? lead.person.name}`, lead.id);
      } else {
        message.status = "approved";
        stubEvent("rep", "message_approved", "LinkedIn message approved (copy to send)", lead.id);
      }
      if (lead.stage === "matched") lead.stage = "contacted";
      lead.lastActor = "rep";
      lead.updatedAt = now();
    } else {
      throw new ApiError("BAD_REQUEST", "action must be approve, edit or reject");
    }
    return { message, lead };
  });
}
