// Run: npm run test-keys   (reads .env.local)
import OpenAI from "openai";
import neo4j from "neo4j-driver";

const env = process.env;
const results = [];
const check = async (name, fn) => {
  try {
    const detail = await fn();
    results.push(["OK  ", name, detail]);
  } catch (e) {
    results.push(["FAIL", name, e?.message ?? String(e)]);
  }
};

await check("Nebius LLM", async () => {
  if (!env.NEBIUS_MODEL) throw new Error("NEBIUS_MODEL is empty: copy a model name from the Nebius dashboard");
  const llm = new OpenAI({ baseURL: "https://api.studio.nebius.com/v1/", apiKey: env.NEBIUS_API_KEY });
  const r = await llm.chat.completions.create({
    model: env.NEBIUS_MODEL,
    messages: [{ role: "user", content: 'Reply with JSON only: {"ok": true}' }],
    response_format: { type: "json_object" },
    max_tokens: 20,
  });
  return r.choices[0].message.content?.trim();
});

await check("Tavily search", async () => {
  const r = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.TAVILY_API_KEY}` },
    body: JSON.stringify({ query: "logistics company appoints new CFO", max_results: 2 }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return `${j.results?.length ?? 0} results, first: ${j.results?.[0]?.url}`;
});

await check("Hunter", async () => {
  const r = await fetch(`https://api.hunter.io/v2/account?api_key=${env.HUNTER_API_KEY}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return `plan: ${j.data?.plan_name}, searches: ${JSON.stringify(j.data?.requests?.searches ?? "?")}`;
});

await check("Neo4j", async () => {
  const driver = neo4j.driver(env.NEO4J_URI, neo4j.auth.basic(env.NEO4J_USER, env.NEO4J_PASSWORD));
  try {
    await driver.verifyConnectivity();
    const res = await driver.executeQuery("RETURN 1 AS ok");
    return `connected, RETURN 1 -> ${res.records[0].get("ok")}`;
  } finally {
    await driver.close();
  }
});

await check("One (withone.ai)", async () => {
  if (!env.ONE_API_KEY) throw new Error("ONE_API_KEY is empty");
  return "key present; confirm Gmail shows as connected in app.withone.ai (real send is tested in step 10)";
});

console.log("");
for (const [status, name, detail] of results) console.log(`${status}  ${name.padEnd(18)} ${detail}`);
console.log("");
process.exit(results.some(([s]) => s === "FAIL") ? 1 : 0);
