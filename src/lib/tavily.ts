// Tavily web search -> contract Citations.
import type { Citation } from "@/contract/types";
import { env } from "./env";

export type SearchResult = Citation & { content: string };

export async function search(query: string, maxResults = 5): Promise<SearchResult[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env("TAVILY_API_KEY")}` },
    body: JSON.stringify({ query, max_results: maxResults, search_depth: "basic" }),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { results?: { url: string; title: string; content: string }[] };
  return (data.results ?? []).map((r) => ({
    url: r.url,
    title: r.title ?? r.url,
    snippet: (r.content ?? "").replace(/\s+/g, " ").slice(0, 240),
    content: r.content ?? "",
  }));
}

export const toCitation = ({ url, title, snippet }: SearchResult): Citation => ({ url, title, snippet });
