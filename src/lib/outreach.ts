// Draft generation with Nebius: one email + one LinkedIn note per lead, built on its top signal.
import { z } from "zod";
import type { ICP, Lead, Message } from "@/contract/types";
import { chatJSON } from "./llm";
import { newId, now } from "./http";

const Raw = z.object({
  email: z.object({ subject: z.coerce.string(), body: z.coerce.string() }),
  linkedin: z.object({ body: z.coerce.string() }),
});

const tone = (title: string) =>
  /chief|cfo|ceo|president|vp|vice/i.test(title)
    ? "Executive reader: max 90 words, business outcome first, no jargon, one low-friction CTA."
    : "Manager reader: max 120 words, concrete workflow pain and time saved, one clear CTA.";

export async function draftForLead(lead: Lead, icp: ICP | null): Promise<Message[]> {
  const signal = lead.company.signals[0];
  const signalText = signal?.description ?? `${lead.company.industry} finance team`;
  const sender = process.env.SENDER_NAME || "The team";
  const raw = Raw.parse(
    await chatJSON({
      system:
        "You write short, specific B2B cold outreach. Reference the prospect's real trigger event in the first line. No flattery, no buzzwords, no fake familiarity, no made-up stats. Plain text only. Respond with one JSON object.",
      user: `OUR PRODUCT: ${icp?.productSummary ?? "(see context)"}
PROSPECT: ${lead.person.name}, ${lead.person.title} at ${lead.company.name} (${lead.company.industry})
TRIGGER SIGNAL: ${signalText}${signal?.date ? ` (${signal.date})` : ""}
WHY THEY FIT: ${lead.fitReason}
TONE: ${tone(lead.person.title)}
SIGN OFF AS: ${sender}

Write:
1) email: subject under 8 words; body that opens with the trigger, links it to one pain our product removes, ends with a question CTA. Use \\n for line breaks. Greet by first name.
2) linkedin: connection note under 280 characters, references the trigger, no pitch-heavy language.

JSON: {"email":{"subject":"","body":""},"linkedin":{"body":""}}`,
      temperature: 0.6,
      maxTokens: 700,
    }),
  );
  const base = { leadId: lead.id, signalUsed: signalText, status: "pending_approval" as const, editedByRep: false, createdAt: now(), sentAt: null };
  return [
    { ...base, id: newId("msg"), channel: "email", subject: raw.email.subject, body: raw.email.body.replace(/\\n/g, "\n") },
    { ...base, id: newId("msg"), channel: "linkedin", subject: null, body: raw.linkedin.body.slice(0, 300) },
  ];
}

/** Run async work over items with limited parallelism. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        try {
          out[k] = { status: "fulfilled", value: await fn(items[k]) };
        } catch (reason) {
          out[k] = { status: "rejected", reason };
        }
      }
    }),
  );
  return out;
}
