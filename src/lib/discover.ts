// Discovery: Tavily search -> Nebius extraction -> scoring -> Neo4j.
import { z } from "zod";
import type { ICP, Lead, Competitor, Citation, Signal, Tier } from "@/contract/types";
import { chatJSON } from "./llm";
import { search, toCitation, type SearchResult } from "./tavily";
import { logAgent, logEvent } from "./neo4j";
import { clearDiscovery, writeDiscovery } from "./repo";
import { ApiError, newId, now } from "./http";
import { isPersonName } from "./names";
import { linkNetwork } from "./network";

const MAX_LEADS = 10;
const SIGNAL_TYPES = ["funding", "hiring", "exec_hire", "tech_change", "expansion", "other"] as const;

// ---------- 1. Queries ----------
function buildQueries(icp: ICP) {
  const inds = [
    ...icp.industries.value,
    ...icp.expansionSegments.filter((s) => s.status === "accepted").map((s) => s.name),
  ];
  const titles = icp.personas.value.map((p) => p.title);
  const triggers = icp.triggerEvents.value;
  const year = new Date().getFullYear();
  const pick = <T,>(a: T[], i: number, d: T) => (a.length ? a[i % a.length] : d);

  const leadQueries = [
    `${pick(inds, 0, "mid-size")} company appoints new ${pick(titles, 0, "CFO")} ${year}`,
    `${pick(inds, 1, "mid-size")} company names ${pick(titles, 1, "VP Finance")} ${year}`,
    `${pick(inds, 2, "mid-size")} company hires ${pick(titles, 0, "Controller")} announcement`,
    `${pick(inds, 0, "mid-size")} companies ${pick(triggers, 0, "expansion")} ${year}`,
    `${pick(inds, 1, "mid-size")} company ${pick(triggers, 1, "funding round")} ${year}`,
    ...icp.expansionSegments
      .filter((s) => s.status === "accepted")
      .slice(0, 1)
      .map((s) => `${s.name} company new ${pick(titles, 0, "CFO")} ${year}`),
  ].slice(0, 6);

  const short = icp.productSummary.split(/\s+/).slice(0, 12).join(" ");
  const competitorQueries = [`${short} software competitors alternatives`, `${short} pricing plans`];
  return { leadQueries, competitorQueries, titles };
}

async function runSearches(queries: string[], max: number): Promise<SearchResult[]> {
  const settled = await Promise.allSettled(
    queries.map(async (q) => {
      await logAgent("discover", `Searching Tavily: ${q}`);
      return search(q, max);
    }),
  );
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const s of settled) {
    if (s.status === "rejected") {
      await logAgent("discover", `Search failed: ${(s.reason as Error).message}`, "warn");
      continue;
    }
    for (const r of s.value) if (!seen.has(r.url)) (seen.add(r.url), out.push(r));
  }
  return out;
}

const sourcesBlock = (rs: SearchResult[], chars = 700) =>
  rs.map((r, i) => `[${i + 1}] ${r.title} | ${r.url}\n${r.content.replace(/\s+/g, " ").slice(0, chars)}`).join("\n\n");

// ---------- 2. Extraction schemas ----------
const idx = z.coerce.number().int().catch(0);
const RawCompanies = z.object({
  companies: z
    .array(
      z.object({
        name: z.coerce.string(),
        domain: z.coerce.string().catch(""),
        industry: z.coerce.string().catch(""),
        employeeCount: z.coerce.number().int().nullable().catch(null),
        hqLocation: z.string().nullable().catch(null),
        person: z
          .object({ name: z.coerce.string(), title: z.coerce.string().catch(""), sourceIndex: idx })
          .nullable()
          .catch(null),
        signals: z
          .array(
            z.object({
              type: z.enum(SIGNAL_TYPES).catch("other"),
              description: z.coerce.string(),
              date: z.string().nullable().catch(null),
              sourceIndex: idx,
            }),
          )
          .catch([]),
        companySourceIndexes: z.array(idx).catch([]),
        negativeSignalMatched: z.coerce.boolean().catch(false),
        fitReason: z.coerce.string().catch(""),
      }),
    )
    .catch([]),
});

const RawPeople = z.object({
  people: z
    .array(z.object({ company: z.coerce.string(), name: z.coerce.string(), title: z.coerce.string().catch(""), sourceIndex: idx }))
    .catch([]),
});

const RawCompetitors = z.object({
  competitors: z
    .array(
      z.object({
        name: z.coerce.string(),
        website: z.coerce.string().catch(""),
        category: z.enum(["direct", "indirect", "alternative"]).catch("direct"),
        positioning: z.coerce.string().catch(""),
        pricing: z.string().nullable().catch(null),
        differentiators: z.array(z.coerce.string()).catch([]),
        sourceIndexes: z.array(idx).catch([]),
      }),
    )
    .catch([]),
});

const cleanDomain = (d: string) =>
  d.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0].trim();

// ---------- 3. Scoring ----------
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
function score(icp: ICP, ind: string, emp: number | null, title: string, hasPerson: boolean, signals: Signal[]) {
  const iw = new Set(words(ind));
  const industry = icp.industries.value.some((x) => words(x).some((w) => iw.has(w))) ? 30 : ind ? 12 : 5;
  const { minEmployees, maxEmployees } = icp.companySize.value;
  const size = emp == null ? 8 : emp >= minEmployees && emp <= maxEmployees ? 20 : emp >= minEmployees * 0.5 && emp <= maxEmployees * 2 ? 10 : 2;
  const tw = new Set(words(title));
  const persona = !hasPerson ? 0 : icp.personas.value.some((p) => words(p.title).every((w) => tw.has(w))) ? 20
    : icp.personas.value.some((p) => words(p.title).some((w) => tw.has(w))) ? 12 : 5;
  const signal = Math.min(30, signals.length * 12);
  const total = Math.min(100, industry + size + persona + signal);
  const tier: Tier = total >= 75 ? "A" : total >= 50 ? "B" : "C";
  return { total, tier };
}

// ---------- 4. Main ----------
export async function discover(icp: ICP): Promise<{ leads: Lead[]; competitors: Competitor[] }> {
  const { leadQueries, competitorQueries, titles } = buildQueries(icp);
  await logAgent("discover", `Built ${leadQueries.length} lead queries and ${competitorQueries.length} competitor queries from the ICP`);

  const [leadResults, compResults] = await Promise.all([runSearches(leadQueries, 6), runSearches(competitorQueries, 5)]);
  const results = leadResults.slice(0, 26);
  if (!results.length) throw new ApiError("UPSTREAM_FAILED", "Search returned no results");
  await logAgent("discover", `Collected ${results.length} unique lead sources, ${compResults.length} competitor sources`, "success");

  const cite = (rs: SearchResult[], i: number): Citation | null => (i >= 1 && i <= rs.length ? toCitation(rs[i - 1]) : null);

  // Companies + competitors extracted in parallel.
  await logAgent("discover", "Extracting companies, people and buying signals with Nebius");
  const [rawCo, rawComp] = await Promise.all([
    chatJSON({
      system:
        "You extract B2B sales prospects from web sources. Only use facts stated in the sources. Never invent people, numbers or events. Respond with one JSON object.",
      user: `IDEAL CUSTOMER PROFILE
Product: ${icp.productSummary}
Industries: ${icp.industries.value.join(", ")}
Company size: ${icp.companySize.value.minEmployees}-${icp.companySize.value.maxEmployees} employees
Buyer titles: ${titles.join(", ")}
Trigger events: ${icp.triggerEvents.value.join(", ")}
Disqualifiers: ${icp.negativeSignals.join(", ")}

SOURCES
${sourcesBlock(results)}

TASK: List up to ${MAX_LEADS} real operating companies from the sources that could buy this product.
Exclude news publishers, investors, recruiters, software vendors and the product's competitors.
Strongly prefer companies inside the size range. SKIP household-name enterprises and Fortune 1000 companies that are far larger than the range.
industry = the company's OWN primary industry in 1-3 words (e.g. "Freight trucking", "Food manufacturing"). Do NOT copy the ICP industry list.
For each: person = a named employee from the sources (prefer buyer titles), else null (JSON null, not the string "null"). person.name must be a real human name like "Jane Smith", NEVER a job title.
Signals must each cite the source index they come from. date as YYYY-MM-DD or null.
employeeCount = stated in sources or your best widely-known estimate, else null.
domain = the official website domain ONLY if you are certain (e.g. ametek.com). Never derive it from a stock ticker. Else "".
negativeSignalMatched = true if a disqualifier applies.

Return JSON:
{"companies":[{"name":"","domain":"","industry":"","employeeCount":null,"hqLocation":null,"person":{"name":"","title":"","sourceIndex":1},"signals":[{"type":"funding|hiring|exec_hire|tech_change|expansion|other","description":"","date":null,"sourceIndex":1}],"companySourceIndexes":[1],"negativeSignalMatched":false,"fitReason":"one short sentence"}]}`,
      temperature: 0.1,
      maxTokens: 3000,
    }).then((r) => RawCompanies.parse(r)),
    compResults.length
      ? chatJSON({
          system: "You are a competitive intelligence analyst. Use only the sources. Respond with one JSON object.",
          user: `OUR PRODUCT: ${icp.productSummary}

SOURCES
${sourcesBlock(compResults, 600)}

List 3-4 competitors or alternatives (category: direct, indirect, or alternative such as spreadsheets/manual work).
differentiators = 2 short points on how OUR product is different or better. pricing only if a source states it, else null.
Return JSON: {"competitors":[{"name":"","website":"https://","category":"direct","positioning":"","pricing":null,"differentiators":[""],"sourceIndexes":[1]}]}`,
          temperature: 0.2,
          maxTokens: 1500,
        })
          .then((r) => RawCompetitors.parse(r))
          .catch(async (e) => {
            await logAgent("discover", `Competitor analysis failed: ${(e as Error).message}`, "warn");
            return { competitors: [] };
          })
      : Promise.resolve({ competitors: [] }),
  ]);

  const realName = (n?: string | null) => !!n && !/^(null|none|unknown|n\/a|not (yet )?identified)$/i.test(n.trim());
  let companies = rawCo.companies
    .filter((c) => realName(c.name))
    .map((c) => ({ ...c, person: c.person && isPersonName(c.person.name) ? c.person : null }));
  // Drop companies far above the size range (e.g. global enterprises).
  const tooBig = companies.filter((c) => c.employeeCount != null && c.employeeCount > icp.companySize.value.maxEmployees * 10);
  if (tooBig.length) {
    await logAgent("discover", `Dropped ${tooBig.length} companies far above the size range: ${tooBig.map((c) => c.name).join(", ")}`, "warn");
    companies = companies.filter((c) => !tooBig.includes(c));
  }
  const dropped = companies.filter((c) => c.negativeSignalMatched).length;
  companies = companies.filter((c) => !c.negativeSignalMatched).slice(0, MAX_LEADS);
  if (dropped) await logAgent("discover", `Dropped ${dropped} companies matching disqualifiers`, "warn");
  await logAgent("discover", `Extracted ${companies.length} candidate companies`, "success");

  // Second pass: find a named buyer for companies without one.
  const missing = companies.filter((c) => !c.person).slice(0, 5);
  const peopleResults: SearchResult[] = [];
  const found = new Map<string, { name: string; title: string; source: Citation | null }>();
  if (missing.length) {
    await logAgent("discover", `Looking up buyers at ${missing.length} companies without a named contact`);
    const per = await Promise.allSettled(
      missing.map((c) => search(`"${c.name}" ${titles.slice(0, 2).join(" OR ")}`, 3)),
    );
    per.forEach((s) => s.status === "fulfilled" && peopleResults.push(...s.value));
    if (peopleResults.length) {
      try {
        const rp = RawPeople.parse(
          await chatJSON({
            system: "Extract named employees from sources. Never invent names. Respond with one JSON object.",
            user: `COMPANIES: ${missing.map((c) => c.name).join("; ")}
TARGET TITLES: ${titles.join(", ")}
SOURCES
${sourcesBlock(peopleResults, 500)}
For each company where a source names a current employee with a finance/target title, return them.
JSON: {"people":[{"company":"","name":"","title":"","sourceIndex":1}]}`,
            temperature: 0,
            maxTokens: 800,
          }),
        );
        for (const p of rp.people.filter((x) => isPersonName(x.name))) found.set(p.company.toLowerCase(), { name: p.name, title: p.title, source: cite(peopleResults, p.sourceIndex) });
        await logAgent("discover", `Identified ${rp.people.length} additional buyers`, "success");
      } catch (e) {
        await logAgent("discover", `Buyer lookup failed: ${(e as Error).message}`, "warn");
      }
    }
  }

  // Build contract objects.
  const ts = now();
  const leads: Lead[] = companies.map((c) => {
    const companyId = newId("co");
    const companySources = c.companySourceIndexes.map((i) => cite(results, i)).filter((x): x is Citation => !!x);
    const fallbackSource = companySources[0] ?? toCitation(results[0]);
    const signals: Signal[] = c.signals
      .map((s) => ({ s, src: cite(results, s.sourceIndex) }))
      .filter(({ src }) => !!src)
      .map(({ s, src }) => ({
        id: newId("sig"),
        type: s.type,
        description: s.description,
        date: s.date && /^\d{4}-\d{2}-\d{2}$/.test(s.date) ? s.date : null,
        source: src!,
      }));
    const extra = found.get(c.name.toLowerCase());
    const person = c.person
      ? { name: c.person.name, title: c.person.title, source: cite(results, c.person.sourceIndex) ?? fallbackSource }
      : extra
        ? { name: extra.name, title: extra.title, source: extra.source ?? fallbackSource }
        : null;
    const { total, tier } = score(icp, c.industry, c.employeeCount, person?.title ?? "", !!person, signals);
    return {
      id: newId("lead"),
      company: {
        id: companyId,
        name: c.name,
        domain: cleanDomain(c.domain),
        industry: c.industry,
        employeeCount: c.employeeCount,
        hqLocation: c.hqLocation,
        signals,
        sources: companySources.length ? companySources : [fallbackSource],
      },
      person: {
        id: newId("pe"),
        name: person?.name ?? "Not yet identified",
        title: person?.title || titles[0] || "Finance leader",
        companyId,
        linkedinUrl: null,
        email: null,
        emailStatus: "not_enriched",
        emailConfidence: null,
        source: person?.source ?? fallbackSource,
      },
      stage: "matched",
      fitScore: total,
      tier,
      fitReason: c.fitReason || `${c.industry} company with ${signals.length} recent signal(s).`,
      lastActor: "ai",
      updatedAt: ts,
    };
  });
  leads.sort((a, b) => b.fitScore - a.fitScore);

  const competitors: Competitor[] = rawComp.competitors.map((x) => ({
    id: newId("cmp"),
    name: x.name,
    website: x.website,
    category: x.category,
    positioning: x.positioning,
    pricing: x.pricing,
    differentiators: x.differentiators,
    sources: x.sourceIndexes.map((i) => cite(compResults, i)).filter((s): s is Citation => !!s),
  }));

  const tiers = (t: Tier) => leads.filter((l) => l.tier === t).length;
  await logAgent("discover", `Scored ${leads.length} leads: ${tiers("A")} Tier A, ${tiers("B")} Tier B, ${tiers("C")} Tier C`, "success");

  await clearDiscovery();
  await writeDiscovery(icp.id, leads, competitors);
  await logAgent(
    "graph",
    `Wrote ${leads.length} companies, ${leads.length} people, ${leads.reduce((n, l) => n + l.company.signals.length, 0)} signals, ${competitors.length} competitors to Neo4j`,
    "success",
  );
  await linkNetwork();
  await logEvent("ai", "leads_discovered", `Discovered ${leads.length} leads from ${results.length} sources`, null);
  return { leads, competitors };
}
