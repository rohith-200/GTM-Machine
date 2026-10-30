// Reading/writing leads & competitors in Neo4j, mapped to the frozen contract.
import type { Lead, Competitor, Citation, Signal, SignalType, Message } from "@/contract/types";
import { run } from "./neo4j";
import { useFixtures } from "./env";
import { store } from "./stub-store";

const parse = <T>(s: unknown, d: T): T => {
  try {
    return typeof s === "string" ? (JSON.parse(s) as T) : d;
  } catch {
    return d;
  }
};
const EMPTY_CITE: Citation = { url: "", title: "", snippet: "" };

type Row = {
  l: Record<string, unknown>;
  p: Record<string, unknown>;
  c: Record<string, unknown>;
  signals: Record<string, unknown>[];
};

function toLead({ l, p, c, signals }: Row): Lead {
  const sigs: Signal[] = signals
    .filter((s) => s && s.id)
    .map((s) => ({
      id: String(s.id),
      type: (s.type as SignalType) ?? "other",
      description: String(s.description ?? ""),
      date: (s.date as string) ?? null,
      source: parse<Citation>(s.sourceJson, EMPTY_CITE),
    }))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return {
    id: String(l.id),
    company: {
      id: String(c.id),
      name: String(c.name ?? ""),
      domain: String(c.domain ?? ""),
      industry: String(c.industry ?? ""),
      employeeCount: (c.employeeCount as number) ?? null,
      hqLocation: (c.hqLocation as string) ?? null,
      signals: sigs,
      sources: parse<Citation[]>(c.sourcesJson, []),
    },
    person: {
      id: String(p.id),
      name: String(p.name ?? ""),
      title: String(p.title ?? ""),
      companyId: String(c.id),
      linkedinUrl: (p.linkedinUrl as string) ?? null,
      email: (p.email as string) ?? null,
      emailStatus: (p.emailStatus as Lead["person"]["emailStatus"]) ?? "not_enriched",
      emailConfidence: (p.emailConfidence as number) ?? null,
      source: parse<Citation>(p.sourceJson, EMPTY_CITE),
    },
    stage: (l.stage as Lead["stage"]) ?? "matched",
    fitScore: Number(l.fitScore ?? 0),
    tier: (l.tier as Lead["tier"]) ?? "C",
    fitReason: String(l.fitReason ?? ""),
    lastActor: (l.lastActor as Lead["lastActor"]) ?? "ai",
    updatedAt: String(l.updatedAt ?? ""),
  };
}

export async function loadLeads(ids?: string[]): Promise<Lead[]> {
  const rows = await run<Row>(
    `MATCH (l:Lead)-[:FOR_PERSON]->(p:Person)-[:WORKS_AT]->(c:Company)
     WHERE $ids IS NULL OR l.id IN $ids
     OPTIONAL MATCH (c)-[:HAS_SIGNAL]->(s:Signal)
     WITH l, p, c, collect(s {.*}) AS signals
     RETURN l {.*} AS l, p {.*} AS p, c {.*} AS c, signals
     ORDER BY l.fitScore DESC`,
    { ids: ids ?? null },
  );
  return rows.map(toLead);
}

export async function loadCompetitors(): Promise<Competitor[]> {
  const rows = await run<{ x: Record<string, unknown> }>(`MATCH (x:Competitor) RETURN x {.*} AS x ORDER BY x.name`);
  return rows.map(({ x }) => ({
    id: String(x.id),
    name: String(x.name ?? ""),
    website: String(x.website ?? ""),
    category: (x.category as Competitor["category"]) ?? "direct",
    positioning: String(x.positioning ?? ""),
    pricing: (x.pricing as string) ?? null,
    differentiators: parse<string[]>(x.differentiatorsJson, []),
    sources: parse<Citation[]>(x.sourcesJson, []),
  }));
}

/** Persist the mutable parts of a lead (stage, attribution, contact details). */
export async function saveLeadState(lead: Lead) {
  await run(
    `MATCH (l:Lead {id: $id})-[:FOR_PERSON]->(p:Person)-[:WORKS_AT]->(c:Company)
     SET c.domain = $domain, l.stage = $stage, l.lastActor = $lastActor, l.updatedAt = $updatedAt,
         p.name = $name, p.title = $title, p.email = $email, p.emailStatus = $emailStatus,
         p.emailConfidence = $emailConfidence, p.linkedinUrl = $linkedinUrl`,
    {
      id: lead.id, domain: lead.company.domain, stage: lead.stage, lastActor: lead.lastActor, updatedAt: lead.updatedAt,
      name: lead.person.name, title: lead.person.title, email: lead.person.email,
      emailStatus: lead.person.emailStatus, emailConfidence: lead.person.emailConfidence,
      linkedinUrl: lead.person.linkedinUrl,
    },
  );
}

/** While some routes are still stubs: make the in-memory store mirror Neo4j leads. */
export async function syncStoreFromDb() {
  if (useFixtures()) return;
  store().leads = await loadLeads();
}

/** Remove the previous discovery run, keeping seeded network people/companies. */
export async function clearDiscovery() {
  await run(
    `MATCH (n)
     WHERE n:Lead OR n:Signal OR n:Competitor OR n:Message
        OR (n:Person AND coalesce(n.isConnection, false) = false)
        OR (n:Company AND coalesce(n.isNetwork, false) = false)
     DETACH DELETE n`,
  );
}

export async function writeDiscovery(icpId: string, leads: Lead[], competitors: Competitor[]) {
  const rows = leads.map((ld) => ({
    c: {
      id: ld.company.id, name: ld.company.name, domain: ld.company.domain, industry: ld.company.industry,
      employeeCount: ld.company.employeeCount, hqLocation: ld.company.hqLocation,
      sourcesJson: JSON.stringify(ld.company.sources),
    },
    p: {
      id: ld.person.id, name: ld.person.name, title: ld.person.title, companyId: ld.company.id,
      linkedinUrl: ld.person.linkedinUrl, email: ld.person.email, emailStatus: ld.person.emailStatus,
      emailConfidence: ld.person.emailConfidence, sourceJson: JSON.stringify(ld.person.source),
    },
    l: {
      id: ld.id, stage: ld.stage, fitScore: ld.fitScore, tier: ld.tier, fitReason: ld.fitReason,
      lastActor: ld.lastActor, updatedAt: ld.updatedAt,
    },
    signals: ld.company.signals.map((s) => ({
      id: s.id, type: s.type, description: s.description, date: s.date, sourceJson: JSON.stringify(s.source),
    })),
  }));

  await run(
    `MATCH (icp:ICP {id: $icpId})
     UNWIND $rows AS r
     CREATE (c:Company) SET c = r.c
     CREATE (p:Person) SET p = r.p
     CREATE (l:Lead) SET l = r.l
     CREATE (p)-[:WORKS_AT]->(c)
     CREATE (l)-[:FOR_PERSON]->(p)
     CREATE (l)-[:MATCHED_TO]->(icp)
     WITH c, r
     UNWIND r.signals AS s
     CREATE (sg:Signal) SET sg = s
     CREATE (c)-[:HAS_SIGNAL]->(sg)`,
    { icpId, rows },
  );

  await run(
    `MERGE (prod:Product {id: 'product'})
     WITH prod
     UNWIND $comps AS cp
     CREATE (x:Competitor) SET x = cp
     CREATE (x)-[:COMPETES_WITH]->(prod)`,
    {
      comps: competitors.map((x) => ({
        id: x.id, name: x.name, website: x.website, category: x.category, positioning: x.positioning,
        pricing: x.pricing, differentiatorsJson: JSON.stringify(x.differentiators), sourcesJson: JSON.stringify(x.sources),
      })),
    },
  );
}

// ---------- Messages ----------

const toMessage = (m: Record<string, unknown>): Message => ({
  id: String(m.id),
  leadId: String(m.leadId),
  channel: (m.channel as Message["channel"]) ?? "email",
  subject: (m.subject as string) ?? null,
  body: String(m.body ?? ""),
  signalUsed: String(m.signalUsed ?? ""),
  status: (m.status as Message["status"]) ?? "pending_approval",
  editedByRep: Boolean(m.editedByRep),
  createdAt: String(m.createdAt ?? ""),
  sentAt: (m.sentAt as string) ?? null,
});

export async function loadMessages(opts: { status?: string | null; id?: string } = {}): Promise<Message[]> {
  const rows = await run<{ m: Record<string, unknown> }>(
    `MATCH (m:Message)
     WHERE ($status IS NULL OR m.status = $status) AND ($id IS NULL OR m.id = $id)
     RETURN m {.*} AS m ORDER BY m.createdAt DESC, m.channel ASC`,
    { status: opts.status ?? null, id: opts.id ?? null },
  );
  return rows.map(({ m }) => toMessage(m));
}

export async function saveMessages(msgs: Message[]) {
  await run(
    `UNWIND $msgs AS mm
     MERGE (m:Message {id: mm.id})
     SET m = mm
     WITH m, mm
     MATCH (l:Lead {id: mm.leadId})
     MERGE (l)-[:CONTACTED_VIA]->(m)`,
    { msgs },
  );
}
