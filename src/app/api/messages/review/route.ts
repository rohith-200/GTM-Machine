// 10. POST /api/messages/review — REAL (human approval gate + One -> Gmail)
import type { ReviewRequest, Message, Lead } from "@/contract/types";
import { handle, readBody, requireFields, ApiError, now } from "@/lib/http";
import { useFixtures } from "@/lib/env";
import { loadLeads, loadMessages, saveLeadState, saveMessages } from "@/lib/repo";
import { recipientFor, sendEmail, providerName } from "@/lib/mailer";
import { logAgent, logEvent } from "@/lib/neo4j";
import { store } from "@/lib/stub-store";

export const maxDuration = 60;

export async function POST(req: Request) {
  return handle<{ message: Message; lead: Lead }>(async () => {
    const body = await readBody<ReviewRequest>(req);
    requireFields(body, ["messageId", "action"]);
    if (!["approve", "edit", "reject"].includes(body.action)) throw new ApiError("BAD_REQUEST", "action must be approve, edit or reject");

    const message = useFixtures()
      ? store().messages.find((m) => m.id === body.messageId)
      : (await loadMessages({ id: body.messageId }))[0];
    if (!message) throw new ApiError("NOT_FOUND", "Message not found");
    const lead = useFixtures()
      ? store().leads.find((l) => l.id === message.leadId)
      : (await loadLeads([message.leadId]))[0];
    if (!lead) throw new ApiError("NOT_FOUND", "Lead not found");
    if (message.status === "sent" || message.status === "rejected") {
      throw new ApiError("BAD_REQUEST", `Message is already ${message.status}`);
    }

    if (body.action === "edit") {
      if (!body.body) throw new ApiError("BAD_REQUEST", "body is required for edit");
      message.subject = message.channel === "email" ? body.subject ?? message.subject : null;
      message.body = body.body;
      message.editedByRep = true;
      await logEvent("rep", "message_edited", `Rep edited ${message.channel} draft for ${lead.person.name}`, lead.id);
    } else if (body.action === "reject") {
      message.status = "rejected";
      await logEvent("rep", "message_rejected", `Rep rejected ${message.channel} draft for ${lead.person.name}`, lead.id);
    } else if (message.channel === "email") {
      const { to, redirected } = recipientFor(lead.person.email);
      try {
        const bodyText = redirected
          ? `[Demo: intended for ${lead.person.name} <${lead.person.email ?? "no email"}> at ${lead.company.name}]\n\n${message.body}`
          : message.body;
        if (!useFixtures()) await sendEmail(to, message.subject ?? "(no subject)", bodyText);
        message.status = "sent";
        message.sentAt = now();
        await logAgent("send", `Sent via ${providerName()} to ${to}${redirected ? " (test inbox)" : ""}`, "success");
        await logEvent("rep", "message_sent", `Rep approved; email sent to ${to} via ${providerName()}`, lead.id);
      } catch (e) {
        message.status = "failed";
        await logAgent("send", (e as Error).message, "error");
        await logEvent("rep", "message_failed", `Send failed for ${lead.person.name}`, lead.id);
      }
    } else {
      message.status = "approved";
      await logEvent("rep", "message_approved", `LinkedIn note approved for ${lead.person.name} (copy to send)`, lead.id);
    }

    const moved = body.action === "approve" && message.status !== "failed";
    if (moved) {
      if (lead.stage === "matched") lead.stage = "contacted";
      lead.lastActor = "rep";
      lead.updatedAt = now();
    }
    if (!useFixtures()) {
      await saveMessages([message]);
      if (moved) await saveLeadState(lead);
    }
    return { message, lead };
  });
}
