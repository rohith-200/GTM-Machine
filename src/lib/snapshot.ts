// Save / restore a complete demo run in Neo4j (works locally and on any host).
import type { ActivityEvent, AgentLog, Competitor, ICP, Lead, Message } from "@/contract/types";
import { run } from "./neo4j";
import { loadIcp, saveIcp } from "./icp";
import { loadLeads, loadCompetitors, loadMessages, saveMessages, clearDiscovery, writeDiscovery, saveLeadState } from "./repo";
import { linkNetwork } from "./network";
import { now } from "./http";

type Snapshot = {
  savedAt: string;
  icp: ICP;
  leads: Lead[];
  competitors: Competitor[];
  messages: Message[];
  events: ActivityEvent[];
  logs: AgentLog[];
};

export async function saveSnapshot() {
  const icp = await loadIcp();
  if (!icp) throw new Error("Nothing to save: run the pipeline first");
  const [leads, competitors, messages, events, logs] = await Promise.all([
    loadLeads(),
    loadCompetitors(),
    loadMessages(),
    run<ActivityEvent>(`MATCH (e:Event) RETURN e.id AS id, e.leadId AS leadId, e.actor AS actor, e.action AS action, e.detail AS detail, e.timestamp AS timestamp ORDER BY e.timestamp`),
    run<AgentLog>(`MATCH (l:AgentLog) RETURN l.id AS id, l.step AS step, l.message AS message, l.level AS level, l.timestamp AS timestamp ORDER BY l.timestamp`),
  ]);
  const snap: Snapshot = { savedAt: now(), icp, leads, competitors, messages, events, logs };
  await run(`MERGE (s:DemoSnapshot {id: 'demo'}) SET s.json = $json, s.savedAt = $at`, { json: JSON.stringify(snap), at: snap.savedAt });
  return { savedAt: snap.savedAt, leads: leads.length, messages: messages.length, events: events.length };
}

export async function loadSnapshot(): Promise<boolean> {
  const rows = await run<{ json: string }>(`MATCH (s:DemoSnapshot {id: 'demo'}) RETURN s.json AS json`);
  if (!rows[0]) return false;
  const snap = JSON.parse(rows[0].json) as Snapshot;

  await clearDiscovery();
  await run(`MATCH (n) WHERE n:ICP OR n:Event OR n:AgentLog DETACH DELETE n`);
  await saveIcp(snap.icp);
  await writeDiscovery(snap.icp.id, snap.leads, snap.competitors);
  for (const l of snap.leads) await saveLeadState(l); // restores stage, attribution, enrichment
  if (snap.messages.length) await saveMessages(snap.messages);
  await run(
    `UNWIND $events AS e CREATE (x:Event) SET x = e
     WITH x, e OPTIONAL MATCH (l:Lead {id: e.leadId})
     FOREACH (_ IN CASE WHEN l IS NULL THEN [] ELSE [1] END | CREATE (x)-[:ABOUT]->(l))`,
    { events: snap.events },
  );
  await run(`UNWIND $logs AS l CREATE (x:AgentLog) SET x = l`, { logs: snap.logs });
  await linkNetwork();
  return true;
}
