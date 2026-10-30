// ICP generation (Nebius) + evidence (Tavily) + storage (Neo4j).
import { z } from "zod";
import type { ICP, IcpRequest, ExpansionSegment } from "@/contract/types";
import { chatJSON } from "./llm";
import { search, toCitation } from "./tavily";
import { run, logAgent, logEvent } from "./neo4j";
import { newId, now } from "./http";

// ---------- Normalising whatever the model returns into the contract ----------
const conf = z.preprocess((v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0.5;
  const c = n > 1 ? n / 100 : n;
  return Math.round(Math.max(0, Math.min(1, c)) * 100) / 100;
}, z.number());

const strArr = z.array(z.coerce.string()).catch([]);
const int = (d: number) => z.coerce.number().transform((n) => Math.round(n)).catch(d);

const RawIcp = z.object({
  productSummary: z.coerce.string().catch(""),
  industries: z.object({ value: strArr, confidence: conf }).catch({ value: [], confidence: 0.3 }),
  companySize: z
    .object({
      value: z.object({ minEmployees: int(50), maxEmployees: int(1000), revenueBand: z.coerce.string().catch("Unknown") }),
      confidence: conf,
    })
    .catch({ value: { minEmployees: 50, maxEmployees: 1000, revenueBand: "Unknown" }, confidence: 0.3 }),
  personas: z
    .object({
      value: z
        .array(
          z.object({
            title: z.coerce.string(),
            seniority: z.enum(["c_level", "vp", "director", "manager", "ic"]).catch("manager"),
            department: z.coerce.string().catch(""),
          }),
        )
        .catch([]),
      confidence: conf,
    })
    .catch({ value: [], confidence: 0.3 }),
  triggerEvents: z.object({ value: strArr, confidence: conf }).catch({ value: [], confidence: 0.3 }),
  regions: z.object({ value: strArr, confidence: conf }).catch({ value: [], confidence: 0.3 }),
  negativeSignals: strArr,
  expansionSegments: z
    .array(
      z.object({
        name: z.coerce.string(),
        rationale: z.coerce.string().catch(""),
        searchQuery: z.coerce.string().catch(""),
      }),
    )
    .catch([]),
});

const SYSTEM = `You are a senior B2B go-to-market strategist. From a product description you infer a precise Ideal Customer Profile.
Be specific (real industry names, real job titles). Confidence is 0.00-1.00 and must reflect how directly the input supports each field:
explicitly stated = 0.85+, strongly implied = 0.6-0.84, a reasonable guess = below 0.6.
Respond with ONE JSON object only.`;

const SHAPE = `{
  "productSummary": "one sentence, what it does and for whom",
  "industries": { "value": ["3-5 target industries"], "confidence": 0.0 },
  "companySize": { "value": { "minEmployees": 0, "maxEmployees": 0, "revenueBand": "$10M-$100M" }, "confidence": 0.0 },
  "personas": { "value": [ { "title": "VP Finance", "seniority": "c_level|vp|director|manager|ic", "department": "Finance" } ], "confidence": 0.0 },
  "triggerEvents": { "value": ["3-5 observable buying signals, e.g. new CFO hired, hiring AP clerks, ERP migration"], "confidence": 0.0 },
  "regions": { "value": ["target countries/regions"], "confidence": 0.0 },
  "negativeSignals": ["2-4 disqualifiers, e.g. hiring freeze, under 50 employees"],
  "expansionSegments": [ { "name": "adjacent non-obvious segment", "rationale": "why the same pain exists there", "searchQuery": "web search query to find evidence for this segment" } ]
}`;

export async function generateIcp(req: IcpRequest): Promise<ICP> {
  await logAgent("icp", "Reading product description, customers and pricing");
  const raw = await chatJSON({
    system: SYSTEM,
    user: `PRODUCT:\n${req.productDescription}\n\nEXISTING CUSTOMERS:\n${req.customers || "(none given)"}\n\nPRICING:\n${req.pricing || "(none given)"}\n\nReturn JSON in exactly this shape (2-3 expansionSegments):\n${SHAPE}`,
    temperature: 0.3,
    maxTokens: 1800,
  });
  const p = RawIcp.parse(raw);
  await logAgent(
    "icp",
    `Inferred ${p.industries.value.length} industries, ${p.personas.value.length} personas, ${p.triggerEvents.value.length} trigger events`,
    "success",
  );

  // Evidence for expansion segments, in parallel. A failed search just means no evidence.
  const segs = p.expansionSegments.slice(0, 3);
  await logAgent("icp", `Searching Tavily for evidence on ${segs.length} expansion segments`);
  const expansionSegments: ExpansionSegment[] = await Promise.all(
    segs.map(async (s) => {
      let evidence: ExpansionSegment["evidence"] = [];
      try {
        evidence = (await search(s.searchQuery || `${s.name} ${p.productSummary}`, 3)).map(toCitation);
      } catch (e) {
        await logAgent("icp", `Evidence search failed for "${s.name}": ${(e as Error).message}`, "warn");
      }
      return { id: newId("seg"), name: s.name, rationale: s.rationale, evidence, status: "suggested" as const };
    }),
  );

  const icp: ICP = {
    id: newId("icp"),
    productSummary: p.productSummary || req.productDescription.slice(0, 200),
    industries: p.industries,
    companySize: p.companySize,
    personas: p.personas,
    triggerEvents: p.triggerEvents,
    regions: p.regions,
    negativeSignals: p.negativeSignals,
    expansionSegments,
    createdAt: now(),
  };

  await saveIcp(icp, req.productDescription);
  await logAgent("graph", "Saved ICP and Product to Neo4j", "success");
  await logEvent("ai", "icp_generated", `ICP generated: ${icp.industries.value.join(", ")}`, null);
  return icp;
}

export async function saveIcp(icp: ICP, productDescription?: string) {
  await run(
    `MERGE (i:ICP {id: $id})
     SET i.json = $json, i.createdAt = $createdAt
     MERGE (p:Product {id: 'product'})
     SET p.summary = $summary
     ${productDescription !== undefined ? ", p.description = $desc" : ""}`,
    { id: icp.id, json: JSON.stringify(icp), createdAt: icp.createdAt, summary: icp.productSummary, desc: productDescription ?? null },
  );
}

export async function loadIcp(id?: string): Promise<ICP | null> {
  const rows = id
    ? await run<{ json: string }>(`MATCH (i:ICP {id: $id}) RETURN i.json AS json`, { id })
    : await run<{ json: string }>(`MATCH (i:ICP) RETURN i.json AS json ORDER BY i.createdAt DESC LIMIT 1`);
  return rows[0] ? (JSON.parse(rows[0].json) as ICP) : null;
}
