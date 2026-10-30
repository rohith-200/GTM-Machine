"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArrowLeft, ArrowUpRight, Check, ContactRound, ExternalLink, LoaderCircle, MailPlus, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import type { Competitor, Lead, Message } from "@/contract/types";
import { ActorBadge, EmailStatusIcon, SourceLink, TierBadge } from "@/components/shared/status-badges";
import { api } from "@/lib/api";
import { mergeLeadUpdates, mergeMessages } from "@/lib/lead-state";
import { scrollToOffice } from "@/lib/office-navigation";
import { useCachedApi } from "@/lib/use-cached-api";
import { LeadDetails } from "./lead-details";
import { useWorkspace } from "./workspace-provider";

const selectLeads = (response: { leads: Lead[] }) => response.leads;
const selectCompetitors = (response: { competitors: Competitor[] }) => response.competitors;
const categoryLabels = { direct: "Direct", indirect: "Indirect", alternative: "Alternative" };

export function LeadsWorkspace() {
  const { leads, setLeads, setMessages, competitors, setCompetitors, dataVersion, setActivityOpen } = useWorkspace();
  const router = useRouter();
  const [view, setView] = useState<"leads" | "competitors">("leads");
  const leadRequest = useCachedApi<Lead[], { leads: Lead[] }>("/api/leads", leads, setLeads, dataVersion, true, selectLeads);
  const competitorRequest = useCachedApi<Competitor[], { competitors: Competitor[] }>("/api/competitors", competitors, setCompetitors, dataVersion, view === "competitors", selectCompetitors);
  const [selection, setSelection] = useState<{ version: number; ids: Set<string> }>({ version: dataVersion, ids: new Set() });
  const [detail, setDetail] = useState<{ id: string; version: number; open: boolean } | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const selectAll = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const rows = [...(leads ?? [])].sort((a, b) => b.fitScore - a.fitScore);
  const selectedIds = selection.version === dataVersion ? rows.filter(lead => selection.ids.has(lead.id)).map(lead => lead.id) : [];
  const selectedCount = selectedIds.length;
  const allSelected = rows.length > 0 && selectedCount === rows.length;
  const selectedLead = detail?.version === dataVersion ? rows.find(lead => lead.id === detail.id) ?? null : null;
  useEffect(() => { if (selectAll.current) selectAll.current.indeterminate = selectedCount > 0 && !allSelected; }, [selectedCount, allSelected, view]);
  useEffect(() => () => request.current?.abort(), [dataVersion]);

  function toggleLead(id: string) {
    setSelection(current => {
      const ids = new Set(current.version === dataVersion ? current.ids : []);
      if (ids.has(id)) ids.delete(id); else ids.add(id);
      return { version: dataVersion, ids };
    });
  }
  function openDetails(lead: Lead, opener: HTMLButtonElement | null) {
    returnFocus.current = opener;
    setDetail({ id: lead.id, version: dataVersion, open: true });
  }
  async function enrichSelected() {
    if (!selectedIds.length || request.current) return;
    const controller = new AbortController(); request.current = controller;
    setEnriching(true); setActionError(null); setActivityOpen(true);
    try {
      const result = await api<{ leads: Lead[] }>("/api/enrich", { method: "POST", signal: controller.signal, body: JSON.stringify({ leadIds: selectedIds }) });
      if (controller.signal.aborted) return;
      setLeads(current => current === undefined ? current : mergeLeadUpdates(current, result.leads));
      toast.success(`Contact lookup completed for ${result.leads.length} ${result.leads.length === 1 ? "lead" : "leads"}`);
    } catch (caught) {
      if (controller.signal.aborted) return;
      const message = caught instanceof Error ? caught.message : "Could not enrich the selected contacts.";
      setActionError(message); toast.error(message);
    } finally { if (request.current === controller) request.current = null; setEnriching(false); }
  }

  async function draftSelected() {
    if (!selectedIds.length || request.current) return;
    const controller = new AbortController(); request.current = controller;
    setDrafting(true); setActionError(null); setActivityOpen(true);
    try {
      const result = await api<{ messages: Message[] }>("/api/drafts", { method: "POST", signal: controller.signal, body: JSON.stringify({ leadIds: selectedIds }) });
      if (controller.signal.aborted) return;
      setMessages(current => mergeMessages(current, result.messages));
      toast.success(`${result.messages.length} ${result.messages.length === 1 ? "draft" : "drafts"} ready for review`, { description: "Nothing has been sent." });
      router.push("/review", { scroll: false });
      scrollToOffice();
    } catch (caught) {
      if (controller.signal.aborted) return;
      const message = caught instanceof Error ? caught.message : "Could not draft outreach for the selected leads.";
      setActionError(message); toast.error(message);
    } finally { if (request.current === controller) request.current = null; setDrafting(false); }
  }

  return <>
    <div className="page-heading"><div className="eyebrow">Company research / Your lead ledger</div><h1>Your next customers.</h1><p>See why each company fits, check the evidence, and find the right person to reach.</p></div>
    <div className="research-view-switch" role="group" aria-label="Research view"><button type="button" aria-pressed={view === "leads"} onClick={() => setView("leads")}><Archive size={14} />Leads{leads !== undefined && <span>{leads.length}</span>}</button><button type="button" aria-pressed={view === "competitors"} onClick={() => setView("competitors")}><Search size={14} />Competitors{competitors !== undefined && <span>{competitors.length}</span>}</button></div>

    {view === "leads" && <section aria-label="Lead research">
      {leadRequest.loading && <div className="research-empty" role="status"><LoaderCircle size={25} className="spin" /><h2>Opening the filing cabinet…</h2><p>Loading your companies and buyers.</p></div>}
      {leadRequest.error && leads === undefined && <div className="research-empty"><Archive size={25} /><h2>We couldn’t load your leads.</h2><p role="alert">{leadRequest.error}</p><button className="office-button" onClick={leadRequest.retry}><RefreshCw size={13} />Try again</button></div>}
      {leads !== undefined && !rows.length && <div className="research-empty"><Search size={26} /><h2>No matching leads yet.</h2><p>Review your customer profile and try finding leads again.</p><Link className="office-button primary-button" href="/icp" scroll={false} onClick={scrollToOffice}><ArrowLeft size={14} />Review customer profile</Link></div>}
      {!!rows.length && <>
        <div className="leads-toolbar"><span className="selection-copy" role="status" aria-live="polite">{selectedCount ? `${selectedCount} ${selectedCount === 1 ? "lead" : "leads"} selected` : `${rows.length} ${rows.length === 1 ? "lead" : "leads"} · Highest fit first`}</span><div className="leads-toolbar-actions">{selectedCount > 0 && <button className="text-button" disabled={enriching || drafting} onClick={() => setSelection({ version: dataVersion, ids: new Set() })}>Clear selection</button>}<button className="office-button" onClick={enrichSelected} disabled={!selectedCount || enriching || drafting}>{enriching ? <LoaderCircle size={14} className="spin" /> : <ContactRound size={14} />}{enriching ? "Checking contacts…" : "Enrich selected"}</button><button className="office-button primary-button" onClick={draftSelected} disabled={!selectedCount || enriching || drafting}>{drafting ? <LoaderCircle size={14} className="spin" /> : <MailPlus size={14} />}{drafting ? "Drafting outreach…" : "Draft outreach"}</button></div></div>
        {actionError && <div className="inline-error" role="alert">{actionError} Your selected leads are still here; you can retry.</div>}
        <div className="lead-table-scroll" role="region" aria-label="Lead results table" tabIndex={0}><table className="lead-table"><caption className="sr-only">Potential customers, ordered by fit score. Select a company to open its research.</caption><thead><tr><th className="lead-check-cell"><input ref={selectAll} type="checkbox" aria-label="Select all leads" checked={allSelected} disabled={enriching || drafting} onChange={() => setSelection({ version: dataVersion, ids: new Set(allSelected ? [] : rows.map(lead => lead.id)) })} /></th><th>Company</th><th>Decision-maker</th><th>Fit</th><th>Top signal</th><th>Email</th><th>Sources</th></tr></thead><tbody>{rows.map(lead => <tr key={lead.id} className={selectedIds.includes(lead.id) ? "lead-is-selected" : undefined} onClick={event => { if (!(event.target as HTMLElement).closest("a,button,input,label")) openDetails(lead, event.currentTarget.querySelector<HTMLButtonElement>("button")); }}><td className="lead-check-cell"><input type="checkbox" aria-label={`Select ${lead.company.name}`} checked={selectedIds.includes(lead.id)} disabled={enriching || drafting} onChange={() => toggleLead(lead.id)} /></td><td><button className="lead-company-button" aria-label={`View ${lead.company.name} details`} onClick={event => openDetails(lead, event.currentTarget)}>{lead.company.name}<ArrowUpRight size={12} aria-hidden="true" /></button><div className="lead-cell-subtitle">{lead.company.industry || "—"}</div><ActorBadge actor={lead.lastActor} /></td><td><span className="lead-person-name">{lead.person.name || "—"}</span><div className="lead-cell-subtitle">{lead.person.title || "—"}</div></td><td><div className="lead-fit-score">{lead.fitScore}<small>/ 100</small></div><TierBadge tier={lead.tier} /></td><td className="lead-signal-cell">{lead.company.signals[0]?.description ?? "—"}{lead.company.signals[0] && <div><SourceLink source={lead.company.signals[0].source} compact /></div>}</td><td className="lead-email-cell"><span>{lead.person.email ?? "—"}</span><EmailStatusIcon status={lead.person.emailStatus} />{lead.person.emailConfidence !== null && <small>{lead.person.emailConfidence}% confidence</small>}</td><td><div className="lead-source-icons"><SourceLink source={lead.company.sources[0] ?? null} compact /><SourceLink source={lead.person.source} compact /></div></td></tr>)}</tbody></table></div>
        <div className="lead-table-foot"><span><Check size={12} />Source links open in a new tab.</span><span>Select a company to read its full brief.</span></div>
      </>}
    </section>}

    {view === "competitors" && <section aria-label="Competitor research">
      {competitorRequest.loading && <div className="research-empty" role="status"><LoaderCircle size={25} className="spin" /><h2>Opening the market research…</h2></div>}
      {competitorRequest.error && competitors === undefined && <div className="research-empty"><h2>We couldn’t load competitors.</h2><p role="alert">{competitorRequest.error}</p><button className="office-button" onClick={competitorRequest.retry}><RefreshCw size={13} />Try again</button></div>}
      {competitors?.length === 0 && <div className="research-empty"><Search size={25} /><h2>No competitor research yet.</h2><p>Run discovery from your customer profile to research the market.</p><Link className="office-button" href="/icp" scroll={false} onClick={scrollToOffice}>Open customer profile<ArrowUpRight size={14} /></Link></div>}
      {!!competitors?.length && <div className="competitor-grid">{competitors.map(competitor => <article className="competitor-card" key={competitor.id}><div className="competitor-heading"><h2>{competitor.name}</h2><span className="status-badge status-neutral">{categoryLabels[competitor.category]}</span></div><p className="competitor-positioning">{competitor.positioning || "—"}</p><div className="competitor-pricing"><span className="eyebrow">Public pricing</span><p>{competitor.pricing ?? "—"}</p></div><h3>Our differentiators</h3>{competitor.differentiators.length ? <ul className="simple-list">{competitor.differentiators.map((value, index) => <li key={`${value}-${index}`}>{value}</li>)}</ul> : <p className="muted-text">—</p>}<div className="competitor-sources"><SourceLink source={{ url: competitor.website, title: "Company website", snippet: competitor.name }} />{competitor.sources.map((source, index) => <SourceLink key={`${source.url}-${index}`} source={source} />)}</div></article>)}</div>}
    </section>}

    <div className="research-bottom-link"><Link className="text-button" href="/icp" scroll={false} onClick={scrollToOffice}><ArrowLeft size={13} />Back to customer profile</Link><span className="muted-text"><ExternalLink size={12} />Evidence stays beside the work.</span></div>
    <LeadDetails lead={selectedLead} open={!!detail?.open && !!selectedLead} onOpenChange={open => setDetail(current => current ? { ...current, open } : null)} returnFocus={returnFocus} />
  </>;
}
