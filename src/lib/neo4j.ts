// Neo4j: single database for the whole app.
import neo4j, { type Driver } from "neo4j-driver";
import type { Actor, AgentLog } from "@/contract/types";
import { env } from "./env";
import { newId, now } from "./http";

const g = globalThis as unknown as { __neo4j?: Driver; __schemaReady?: Promise<void> };

export function driver(): Driver {
  if (!g.__neo4j) {
    g.__neo4j = neo4j.driver(
      env("NEO4J_URI"),
      neo4j.auth.basic(env("NEO4J_USER"), env("NEO4J_PASSWORD")),
      { disableLosslessIntegers: true }, // return plain JS numbers
    );
  }
  return g.__neo4j;
}

/** Run a Cypher query and get plain objects back, one per row. */
export async function run<T = Record<string, unknown>>(
  cypher: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  await ensureSchema();
  const res = await driver().executeQuery(cypher, params);
  return res.records.map((r) => r.toObject() as T);
}

/** Unique constraints so MERGE is fast and ids never duplicate. Runs once per server process. */
function ensureSchema(): Promise<void> {
  if (!g.__schemaReady) {
    const labels = ["ICP", "Company", "Person", "Lead", "Signal", "Competitor", "Product", "Message", "Event", "AgentLog"];
    g.__schemaReady = (async () => {
      for (const l of labels) {
        await driver().executeQuery(
          `CREATE CONSTRAINT ${l.toLowerCase()}_id IF NOT EXISTS FOR (n:${l}) REQUIRE n.id IS UNIQUE`,
        );
      }
    })().catch((e) => {
      g.__schemaReady = undefined; // retry next time
      throw e;
    });
  }
  return g.__schemaReady;
}

/** Agent Thinking panel line. Never throws: logging must not break the pipeline. */
export async function logAgent(step: AgentLog["step"], message: string, level: AgentLog["level"] = "info") {
  try {
    await run(
      `CREATE (:AgentLog {id: $id, step: $step, message: $message, level: $level, timestamp: $ts})`,
      { id: newId("log"), step, message, level, ts: now() },
    );
  } catch (e) {
    console.warn("logAgent failed:", (e as Error).message);
  }
}

/** Audit/attribution event. Links to the Lead when it exists. Never throws. */
export async function logEvent(actor: Actor, action: string, detail: string, leadId: string | null) {
  try {
    await run(
      `CREATE (e:Event {id: $id, actor: $actor, action: $action, detail: $detail, leadId: $leadId, timestamp: $ts})
       WITH e
       OPTIONAL MATCH (l:Lead {id: $leadId})
       FOREACH (_ IN CASE WHEN l IS NULL THEN [] ELSE [1] END | CREATE (e)-[:ABOUT]->(l))`,
      { id: newId("ev"), actor, action, detail, leadId, ts: now() },
    );
  } catch (e) {
    console.warn("logEvent failed:", (e as Error).message);
  }
}
