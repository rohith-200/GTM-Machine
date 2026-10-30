// 14. GET /api/analytics — REAL (computed from Neo4j)
import type { Analytics, Stage, Tier, Lead, Message } from "@/contract/types";
import { handle } from "@/lib/http";
import { useFixtures } from "@/lib/env";
import { loadLeads, loadMessages } from "@/lib/repo";
import { run } from "@/lib/neo4j";
import { store } from "@/lib/stub-store";

const ORDER: Stage[] = ["matched", "contacted", "replied", "meeting_booked", "closed_won"];

function compute(leads: Lead[], messages: Message[], actions: { ai: number; rep: number }): Analytics {
  const stageCounts: Record<Stage, number> = { matched: 0, contacted: 0, replied: 0, meeting_booked: 0, closed_won: 0, closed_lost: 0 };
  for (const l of leads) stageCounts[l.stage]++;
  const reached = (s: Stage) =>
    leads.filter((l) => l.stage !== "closed_lost" && ORDER.indexOf(l.stage) >= ORDER.indexOf(s)).length;
  const conversion = ORDER.slice(0, -1).map((from, i) => {
    const to = ORDER[i + 1];
    const base = reached(from);
    return { from, to, rate: base ? Math.round((reached(to) / base) * 100) / 100 : 0 };
  });
  const byTier = (["A", "B", "C"] as Tier[]).map((tier) => {
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
    actions,
    messages: {
      drafted: messages.length,
      approved: messages.filter((m) => m.status === "approved" || m.status === "sent").length,
      rejected: messages.filter((m) => m.status === "rejected").length,
      sent: messages.filter((m) => m.status === "sent").length,
    },
  };
}

export async function GET() {
  return handle<Analytics>(async () => {
    if (useFixtures()) {
      const s = store();
      return compute(s.leads, s.messages, {
        ai: s.events.filter((e) => e.actor === "ai").length,
        rep: s.events.filter((e) => e.actor === "rep").length,
      });
    }
    const [leads, messages, counts] = await Promise.all([
      loadLeads(),
      loadMessages(),
      run<{ actor: string; n: number }>(`MATCH (e:Event) RETURN e.actor AS actor, count(*) AS n`),
    ]);
    const actions = { ai: 0, rep: 0 };
    for (const c of counts) if (c.actor === "ai" || c.actor === "rep") actions[c.actor] = c.n;
    return compute(leads, messages, actions);
  });
}
