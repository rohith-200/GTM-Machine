// Your network (people who can make intros) + warm-path graph queries.
import type { WarmPath } from "@/contract/types";
import network from "@/data/network.json";
import { run, logAgent } from "./neo4j";

type Conn = { name: string; relationship?: string; pastCompanies: string[] };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * Upsert network people and link them (PREVIOUSLY_EMPLOYED_AT) to companies.
 * A past company that matches a discovered Company links to it; otherwise a
 * persistent network Company node is created (isNetwork: true).
 * Safe to run any time; runs automatically after each discovery.
 */
export async function linkNetwork(): Promise<number> {
  const conns = (network as { connections: Conn[] }).connections ?? [];
  let links = 0;
  for (const c of conns) {
    const pid = `net_${slug(c.name)}`;
    await run(
      `MERGE (p:Person {id: $pid}) SET p.name = $name, p.title = $rel, p.isConnection = true`,
      { pid, name: c.name, rel: c.relationship ?? "Your network" },
    );
    for (const co of c.pastCompanies) {
      const rows = await run<{ n: number }>(
        `MATCH (p:Person {id: $pid})
         OPTIONAL MATCH (d:Company)
           WHERE coalesce(d.isNetwork, false) = false
             AND (toLower(d.name) CONTAINS toLower($co) OR toLower($co) CONTAINS toLower(d.name))
         WITH p, collect(d) AS found
         FOREACH (d IN found | MERGE (p)-[:PREVIOUSLY_EMPLOYED_AT]->(d))
         FOREACH (_ IN CASE WHEN size(found) = 0 THEN [1] ELSE [] END |
           MERGE (n:Company {id: $nid}) SET n.name = $co, n.isNetwork = true
           MERGE (p)-[:PREVIOUSLY_EMPLOYED_AT]->(n))
         RETURN size(found) AS n`,
        { pid, co, nid: `netco_${slug(co)}` },
      );
      links += rows[0]?.n ?? 0;
    }
  }
  if (links) await logAgent("graph", `Linked your network: ${links} connection(s) to discovered companies`, "success");
  return links;
}

const REL_TEXT: Record<string, string> = {
  WORKS_AT: "works at",
  PREVIOUSLY_EMPLOYED_AT: "previously worked at",
};

export async function warmPaths(leadId: string): Promise<WarmPath[]> {
  const rows = await run<{ hops: { name: string; type: "Person" | "Company"; me: boolean }[]; rels: string[]; dirs: boolean[] }>(
    `MATCH (l:Lead {id: $leadId})-[:FOR_PERSON]->(p:Person)
     MATCH path = (p)-[:WORKS_AT|PREVIOUSLY_EMPLOYED_AT*1..4]-(k:Person {isConnection: true})
     WITH path, nodes(path) AS ns, relationships(path) AS rs
     ORDER BY length(path) ASC
     LIMIT 3
     RETURN [n IN ns | {name: coalesce(n.name, ''), type: CASE WHEN n:Person THEN 'Person' ELSE 'Company' END,
                        me: coalesce(n.isConnection, false)}] AS hops,
            [r IN rs | type(r)] AS rels,
            [i IN range(0, size(rs) - 1) | startNode(rs[i]) = ns[i]] AS dirs`,
    { leadId },
  );
  return rows.map(({ hops, rels, dirs }) => {
    // Sentence per edge, always phrased "<person> <relation> <company>".
    const parts = rels.map((r, i) => {
      const [a, b] = dirs[i] ? [hops[i], hops[i + 1]] : [hops[i + 1], hops[i]];
      const who = a.me ? `${a.name} (your network)` : a.name;
      return `${who} ${REL_TEXT[r] ?? r.toLowerCase()} ${b.name}`;
    });
    return {
      leadId,
      description: `${parts.join("; ").replace(/\.$/, "")}. Ask ${hops[hops.length - 1].name} for an intro.`,
      hops: hops.map(({ name, type }) => ({ name, type })),
    };
  });
}
