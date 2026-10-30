"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, ArrowLeft, ArrowRight, Check, FolderOpen, LoaderCircle, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";
import type { Competitor, ExpansionSegment, ICP, Lead } from "@/contract/types";
import { api } from "@/lib/api";
import { useCachedApi } from "@/lib/use-cached-api";
import { scrollToOffice } from "@/lib/office-navigation";
import { ConfidenceBadge, SourceLink } from "@/components/shared/status-badges";
import { useWorkspace } from "./workspace-provider";

export function IcpReview() {
  const { icp, setIcp, setLeads, setCompetitors, clearDiscovery, dataVersion, setActivityOpen } = useWorkspace();
  const { error, retry } = useCachedApi<ICP | null>("/api/icp", icp, setIcp, dataVersion);
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const operation = useRef<AbortController | null>(null);
  const router = useRouter();
  useEffect(() => () => operation.current?.abort(), [dataVersion]);

  async function decideSegment(segment: ExpansionSegment, status: ExpansionSegment["status"]) {
    if (!icp || operation.current) return;
    const controller = new AbortController(); operation.current = controller;
    setPending(segment.id); setActionError(null);
    try {
      const updated = await api<ICP>("/api/icp/segment", { method: "POST", signal: controller.signal, body: JSON.stringify({ icpId: icp.id, segmentId: segment.id, status }) });
      if (controller.signal.aborted) return;
      setIcp(updated); clearDiscovery();
      toast.success(status === "accepted" ? `${segment.name} accepted` : status === "dismissed" ? `${segment.name} dismissed` : "Segment decision reset");
    } catch (caught) {
      if (controller.signal.aborted) return;
      const message = caught instanceof Error ? caught.message : "Could not save your decision.";
      setActionError(message); toast.error(message);
    } finally { if (operation.current === controller) operation.current = null; setPending(null); }
  }

  async function findLeads() {
    if (!icp || operation.current) return;
    const controller = new AbortController(); operation.current = controller;
    setPending("discovery"); setActionError(null); setActivityOpen(true);
    try {
      const result = await api<{ leads: Lead[]; competitors: Competitor[] }>("/api/discover", { method: "POST", signal: controller.signal, body: JSON.stringify({ icpId: icp.id }) });
      if (controller.signal.aborted) return;
      setLeads(result.leads); setCompetitors(result.competitors);
      toast.success(result.leads.length ? `Found ${result.leads.length} ${result.leads.length === 1 ? "lead" : "leads"}` : "Discovery complete — no matching leads yet");
      router.push("/leads", { scroll: false }); scrollToOffice();
    } catch (caught) {
      if (controller.signal.aborted) return;
      const message = caught instanceof Error ? caught.message : "Could not discover leads. Please try again.";
      setActionError(message); toast.error(message);
    } finally { if (operation.current === controller) operation.current = null; setPending(null); }
  }

  if (icp === undefined && !error) return <div className="workspace-empty" role="status"><LoaderCircle className="spin" size={27} /><h1>Opening your customer folder…</h1><p>Your profile will be ready to review here.</p></div>;
  if (error && icp === undefined) return <div className="workspace-empty"><FolderOpen size={30} /><h1>We couldn’t open that folder.</h1><p role="alert">{error}</p><button className="office-button" onClick={retry}><RefreshCw size={14} />Try again</button></div>;
  if (!icp) return <div className="workspace-empty"><FolderOpen size={30} /><h1>A fresh customer folder.</h1><p>Start with your product brief to generate your ideal customer profile.</p><Link className="office-button primary-button" href="/"><ArrowLeft size={14} />Write your brief</Link></div>;

  return <>
    <div className="page-heading"><div className="eyebrow">Your ideal customer profile</div><h1>The people you can help most.</h1><p>{icp.productSummary}</p></div>
    <div className="profile-grid">
      <section className="profile-card"><div className="profile-card-top"><h2>Industries</h2><ConfidenceBadge confidence={icp.industries.confidence} /></div><div className="profile-values">{icp.industries.value.length ? icp.industries.value.map(value => <span key={value}>{value}</span>) : "—"}</div></section>
      <section className="profile-card"><div className="profile-card-top"><h2>Company size</h2><ConfidenceBadge confidence={icp.companySize.confidence} /></div><p className="profile-primary">{icp.companySize.value.minEmployees.toLocaleString()}–{icp.companySize.value.maxEmployees.toLocaleString()} employees</p><p className="muted-text">{icp.companySize.value.revenueBand || "—"}</p></section>
      <section className="profile-card"><div className="profile-card-top"><h2>Decision-makers</h2><ConfidenceBadge confidence={icp.personas.confidence} /></div>{icp.personas.value.length ? icp.personas.value.map(persona => <div className="persona-line" key={`${persona.title}-${persona.department}`}><span>{persona.title}</span><small>{persona.department}</small></div>) : "—"}</section>
      <section className="profile-card"><div className="profile-card-top"><h2>Buying signals</h2><ConfidenceBadge confidence={icp.triggerEvents.confidence} /></div><ul className="simple-list">{icp.triggerEvents.value.map(signal => <li key={signal}>{signal}</li>)}</ul>{!icp.triggerEvents.value.length && "—"}</section>
      <section className="profile-card"><div className="profile-card-top"><h2>Regions</h2><ConfidenceBadge confidence={icp.regions.confidence} /></div><p>{icp.regions.value.join(" · ") || "—"}</p></section>
      <section className="profile-card"><div className="profile-card-top"><h2>Exclude companies with</h2></div><ul className="simple-list">{icp.negativeSignals.map(signal => <li key={signal}>{signal}</li>)}</ul>{!icp.negativeSignals.length && <p className="muted-text">No exclusions specified.</p>}</section>
    </div>
    {!!icp.expansionSegments.length && <section className="expansion-section"><h2>Worth exploring next</h2><p className="muted-text">Accept the adjacent customer segments you want to explore, or dismiss the ones that don’t fit.</p>{icp.expansionSegments.map(segment => <article className={`expansion-card segment-${segment.status}`} key={segment.id} aria-busy={pending === segment.id}><div><h3>{segment.name}</h3><span className={`status-badge ${segment.status === "accepted" ? "status-success" : "status-neutral"}`}>{pending === segment.id ? "Saving…" : segment.status}</span></div><p>{segment.rationale}</p><div className="source-list">{segment.evidence.map(source => <SourceLink key={source.url} source={source} />)}</div><div className="segment-actions" role="group" aria-label={`Decision for ${segment.name}`}><button className="office-button" aria-label={`Accept ${segment.name}`} aria-pressed={segment.status === "accepted"} disabled={pending !== null || segment.status === "accepted"} onClick={() => decideSegment(segment, "accepted")}>{pending === segment.id ? <LoaderCircle size={13} className="spin" /> : <Check size={13} />}Accept</button><button className="office-button" aria-label={`Dismiss ${segment.name}`} aria-pressed={segment.status === "dismissed"} disabled={pending !== null || segment.status === "dismissed"} onClick={() => decideSegment(segment, "dismissed")}><X size={13} />Dismiss</button>{segment.status !== "suggested" && <button className="text-button" aria-label={`Reset decision for ${segment.name}`} disabled={pending !== null} onClick={() => decideSegment(segment, "suggested")}>Reset decision</button>}</div></article>)}</section>}
    {actionError && <div className="inline-error" role="alert">{actionError} Your profile is still here; you can try again.</div>}
    {pending === "discovery" && <div className="discovery-progress" role="status"><span className="discovery-progress-icon"><Search size={20} /></span><div><h2>Finding your next customers…</h2><p>Researching companies, matching buyers, and collecting sources. This can take a minute or two.</p><button type="button" className="text-button" onClick={() => setActivityOpen(true)}><Activity size={13} />Follow progress in Agent Thinking</button></div><div className="discovery-progress-track" aria-hidden="true"><span /></div></div>}
    <div className="form-actions"><Link className="text-button" href="/" scroll={false} onClick={scrollToOffice}><ArrowLeft size={14} />Back to your brief</Link><button className="office-button primary-button large-button" onClick={findLeads} disabled={pending !== null}>{pending === "discovery" ? <><LoaderCircle size={15} className="spin" />Finding leads…</> : <>Find leads<ArrowRight size={15} /></>}</button></div>
  </>;
}
