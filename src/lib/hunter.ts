// Hunter.io enrichment: email finder (named person) or domain search (no named person).
import type { Lead, EmailStatus } from "@/contract/types";
import { env } from "./env";
import { isPersonName } from "./names";
import { search } from "./tavily";

const BASE = "https://api.hunter.io/v2";

type Verification = { status?: string | null } | null | undefined;
const mapStatus = (v: Verification, score: number | null): EmailStatus => {
  const s = v?.status;
  if (s === "valid") return "verified";
  if (s === "invalid") return "invalid";
  if (s === "accept_all") return "risky";
  if (score == null) return "unknown";
  return score >= 90 ? "verified" : score >= 50 ? "risky" : "unknown";
};

async function get(path: string, params: Record<string, string>) {
  const q = new URLSearchParams({ ...params, api_key: env("HUNTER_API_KEY") });
  const res = await fetch(`${BASE}/${path}?${q}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as { errors?: { details?: string }[] }).errors?.[0]?.details ?? `HTTP ${res.status}`;
    throw new Error(`Hunter ${path}: ${msg}`);
  }
  return (body as { data: Record<string, unknown> }).data;
}

const target = (lead: Lead): Record<string, string> =>
  lead.company.domain ? { domain: lead.company.domain } : { company: lead.company.name };

/** Mutates and returns the lead with contact details filled in. Returns a short log line. */
export async function enrichLead(lead: Lead): Promise<string> {
  const named = isPersonName(lead.person.name);

  if (named) {
    const d = await get("email-finder", { ...target(lead), full_name: lead.person.name });
    const email = (d.email as string) ?? null;
    const score = (d.score as number) ?? null;
    if (d.domain && !lead.company.domain) lead.company.domain = String(d.domain);
    lead.person.email = email;
    lead.person.emailConfidence = email ? score : null;
    lead.person.emailStatus = email ? mapStatus(d.verification as Verification, score) : "unknown";
    lead.person.linkedinUrl = (d.linkedin_url as string) ?? lead.person.linkedinUrl;
    return email ? `${lead.person.name} -> ${email} (${lead.person.emailStatus}, ${score ?? "?"}%)` : `${lead.person.name}: no email found`;
  }

  // No named buyer: find the most senior finance contact at the company.
  const d = await get("domain-search", { ...target(lead), department: "finance", limit: "10" });
  if (d.domain && !lead.company.domain) lead.company.domain = String(d.domain);
  type E = { value: string; first_name?: string; last_name?: string; position?: string; seniority?: string; confidence?: number; linkedin?: string; verification?: Verification };
  const emails = ((d.emails as E[]) ?? []).filter((e) => e.first_name && e.last_name);
  const rank = (e: E) => (e.seniority === "executive" ? 0 : e.seniority === "senior" ? 1 : 2);
  const best = emails.sort((a, b) => rank(a) - rank(b) || (b.confidence ?? 0) - (a.confidence ?? 0))[0];
  if (!best) {
    lead.person.emailStatus = "unknown";
    return `${lead.company.name}: no finance contacts found`;
  }
  lead.person.name = `${best.first_name} ${best.last_name}`;
  lead.person.title = best.position || lead.person.title;
  lead.person.email = best.value;
  lead.person.emailConfidence = best.confidence ?? null;
  lead.person.emailStatus = mapStatus(best.verification, best.confidence ?? null);
  lead.person.linkedinUrl = best.linkedin ?? null;
  lead.person.source = {
    url: `https://${lead.company.domain || d.domain || ""}`,
    title: `Hunter.io domain search: ${lead.company.name}`,
    snippet: `${lead.person.name}, ${lead.person.title} (public sources indexed by Hunter)`,
  };
  return `${lead.company.name}: found ${lead.person.name} (${lead.person.title}) -> ${best.value}`;
}

// ---------- Fallback when Hunter is unavailable (restricted account, no credits, no data) ----------

/**
 * 1) Find the person's public LinkedIn profile via Tavily (validated: must be a linkedin.com/in URL
 *    whose title contains the person's last name).
 * 2) If we know name + domain, propose the most common pattern first.last@domain,
 *    clearly marked unverified (status "unknown", low confidence).
 */
export async function fallbackEnrich(lead: Lead): Promise<string> {
  const notes: string[] = [];
  if (isPersonName(lead.person.name)) {
    const last = lead.person.name.trim().split(/\s+/).pop()!.toLowerCase();
    try {
      const rs = await search(`${lead.person.name} ${lead.company.name} LinkedIn`, 5);
      const hit = rs.find((r) => /linkedin\.com\/in\//i.test(r.url) && r.title.toLowerCase().includes(last));
      if (hit) {
        lead.person.linkedinUrl = hit.url.split("?")[0];
        notes.push("LinkedIn found");
      }
    } catch {
      /* ignore */
    }
    if (lead.company.domain && !lead.person.email) {
      const parts = lead.person.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z\s-]/g, "")
        .split(/\s+/)
        .filter((p) => p.length > 1);
      if (parts.length >= 2) {
        lead.person.email = `${parts[0]}.${parts[parts.length - 1]}@${lead.company.domain}`;
        lead.person.emailStatus = "unknown";
        lead.person.emailConfidence = 30;
        notes.push(`pattern guess ${lead.person.email} (unverified)`);
      }
    }
  }
  if (!lead.person.email) lead.person.emailStatus = "unknown";
  return `${lead.person.name} @ ${lead.company.name}: fallback ${notes.length ? notes.join(", ") : "found nothing"}`;
}
