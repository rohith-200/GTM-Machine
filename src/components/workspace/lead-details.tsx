"use client";

import { useState, type RefObject } from "react";
import { ArrowRight, Building2, LoaderCircle, MapPin, RefreshCw, Users, Waypoints } from "lucide-react";
import type { Lead, WarmPath } from "@/contract/types";
import { ActorBadge, EmailStatusIcon, SourceLink, TierBadge } from "@/components/shared/status-badges";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatSignalDate, stageLabels } from "@/lib/lead-state";
import { useCachedApi } from "@/lib/use-cached-api";
import { useWorkspace } from "./workspace-provider";

const selectPaths = (response: { paths: WarmPath[] }) => response.paths;

function LeadDetailBody({ lead }: { lead: Lead }) {
  const { dataVersion } = useWorkspace();
  const [paths, setPaths] = useState<WarmPath[] | undefined>(undefined);
  const warm = useCachedApi<WarmPath[], { paths: WarmPath[] }>(`/api/graph/warm-paths?leadId=${encodeURIComponent(lead.id)}`, paths, setPaths, dataVersion, true, selectPaths);
  return <div className="lead-detail-scroll">
    <div className="lead-detail-badges"><TierBadge tier={lead.tier} /><span className="status-badge status-neutral">{stageLabels[lead.stage]}</span><ActorBadge actor={lead.lastActor} /></div>
    <section className="detail-section"><div className="detail-section-title"><Building2 size={15} /><h3>Company</h3></div><dl className="lead-facts"><div><dt>Industry</dt><dd>{lead.company.industry || "—"}</dd></div><div><dt>Domain</dt><dd>{lead.company.domain || "—"}</dd></div><div><dt><Users size={12} />Employees</dt><dd>{lead.company.employeeCount === null ? "—" : lead.company.employeeCount.toLocaleString()}</dd></div><div><dt><MapPin size={12} />Headquarters</dt><dd>{lead.company.hqLocation ?? "—"}</dd></div></dl></section>
    <section className="detail-section"><h3>Why this lead fits</h3><p className="fit-explanation">{lead.fitReason || "—"}</p><p className="muted-text">Fit score: {lead.fitScore} / 100</p></section>
    <section className="detail-section"><h3>Decision-maker</h3><div className="buyer-detail"><strong>{lead.person.name || "—"}</strong><span>{lead.person.title || "—"}</span><span className="contact-address">{lead.person.email ?? "—"}</span><EmailStatusIcon status={lead.person.emailStatus} />{lead.person.emailConfidence !== null && <span className="muted-text">Email confidence: {lead.person.emailConfidence} / 100</span>}<SourceLink source={lead.person.source} />{lead.person.linkedinUrl && <SourceLink source={{ url: lead.person.linkedinUrl, title: "LinkedIn profile", snippet: lead.person.name }} />}</div></section>
    <section className="detail-section"><h3>Buying signals</h3>{lead.company.signals.length ? lead.company.signals.map(signal => <article className="signal-evidence" key={signal.id}><div className="signal-evidence-meta"><span>{signal.type.replaceAll("_", " ")}</span><span>{formatSignalDate(signal.date)}</span></div><p>{signal.description}</p>{signal.source.snippet && <blockquote>{signal.source.snippet}</blockquote>}<SourceLink source={signal.source} /></article>) : <p className="detail-empty-copy">No buying signals were returned for this company.</p>}</section>
    <section className="detail-section"><h3>Company sources</h3><div className="detail-sources">{lead.company.sources.length ? lead.company.sources.map((source, index) => <div key={`${source.url}-${index}`}><SourceLink source={source} />{source.snippet && <p>{source.snippet}</p>}</div>) : <p className="detail-empty-copy">No company sources were returned.</p>}</div></section>
    <section className="detail-section"><div className="detail-section-title"><Waypoints size={15} /><h3>Warm introduction paths</h3></div>{warm.loading && <p className="detail-loading" role="status"><LoaderCircle size={14} className="spin" />Looking for connections…</p>}{warm.error && <div className="inline-error" role="alert"><p>{warm.error}</p><button className="text-button" onClick={warm.retry}><RefreshCw size={12} />Retry connections</button></div>}{paths?.length === 0 && <p className="detail-empty-copy">No warm introduction was found for this lead.</p>}{paths?.map((path, index) => <article className="warm-path" key={`${path.leadId}-${index}`}><p>{path.description}</p><ol aria-label="Introduction path">{path.hops.map((hop, hopIndex) => <li key={`${hop.name}-${hopIndex}`}><span><strong>{hop.name}</strong><small>{hop.type}</small></span>{hopIndex < path.hops.length - 1 && <ArrowRight size={12} aria-hidden="true" />}</li>)}</ol></article>)}</section>
  </div>;
}

export function LeadDetails({ lead, open, onOpenChange, returnFocus }: { lead: Lead | null; open: boolean; onOpenChange: (open: boolean) => void; returnFocus: RefObject<HTMLButtonElement | null> }) {
  return <Sheet open={open && !!lead} onOpenChange={onOpenChange}>{lead && <SheetContent className="lead-detail-sheet" finalFocus={returnFocus}><SheetHeader className="lead-detail-heading"><div className="eyebrow">From the filing cabinet</div><SheetTitle>{lead.company.name}</SheetTitle><SheetDescription>{lead.person.name} · {lead.person.title}</SheetDescription></SheetHeader><LeadDetailBody key={`${lead.id}`} lead={lead} /></SheetContent>}</Sheet>;
}
