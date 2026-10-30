// 14. GET /api/analytics — STUB (computed from the stub store so the dashboard reacts)
import type { Analytics, Stage, Tier } from "@/contract/types";
import { handle } from "@/lib/http";
import { store } from "@/lib/stub-store";

const ORDER: Stage[] = ["matched", "contacted", "replied", "meeting_booked", "closed_won"];

export async function GET() {
  return handle<Analytics>(async () => {
    const { leads, messages, events } = store();
    const stageCounts: Record<Stage, number> = {
      matched: 0, contacted: 0, replied: 0, meeting_booked: 0, closed_won: 0, closed_lost: 0,
    };
    for (const l of leads) stageCounts[l.stage]++;

    // "reached" = leads currently at this stage or any later stage in ORDER
    const reached = (s: Stage) =>
      leads.filter((l) => ORDER.indexOf(l.stage) >= ORDER.indexOf(s) && l.stage !== "closed_lost").length;
    const conversion = ORDER.slice(0, -1).map((from, i) => {
      const to = ORDER[i + 1];
      const base = reached(from);
      return { from, to, rate: base ? Math.round((reached(to) / base) * 100) / 100 : 0 };
    });

    const tiers: Tier[] = ["A", "B", "C"];
    const byTier = tiers.map((tier) => {
      const t = leads.filter((l) => l.tier === tier);
      return {
        tier,
        leads: t.length,
        contacted: t.filter((l) => l.stage !== "matched").length,
        replied: t.filter((l) => ["replied", "meeting_booked", "closed_won"].includes(l.stage)).length,
      };
    });

    return {
      stageCounts,
      conversion,
      byTier,
      actions: {
        ai: events.filter((e) => e.actor === "ai").length,
        rep: events.filter((e) => e.actor === "rep").length,
      },
      messages: {
        drafted: messages.length,
        approved: messages.filter((m) => m.status === "approved" || m.status === "sent").length,
        rejected: messages.filter((m) => m.status === "rejected").length,
        sent: messages.filter((m) => m.status === "sent").length,
      },
    };
  });
}
