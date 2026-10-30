"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, FolderOpen, LoaderCircle, RefreshCw } from "lucide-react";
import type { ICP } from "@/contract/types";
import { api } from "@/lib/api";
import { scrollToOffice } from "@/lib/office-navigation";
import { ConfidenceBadge, SourceLink } from "@/components/shared/status-badges";
import { useWorkspace } from "./workspace-provider";

export function IcpReview() {
  const { icp, setIcp } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (icp !== undefined) return;
    const controller = new AbortController();
    api<ICP | null>("/api/icp", { signal: controller.signal }).then(value => { if (!controller.signal.aborted) { setIcp(value); setError(null); } }).catch(caught => { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Could not load your profile."); });
    return () => controller.abort();
  }, [icp, setIcp, retry]);

  if (icp === undefined && !error) return <div className="workspace-empty" role="status"><LoaderCircle className="spin" size={27} /><h1>Opening your customer folder…</h1><p>Your profile will be ready to review here.</p></div>;
  if (error && icp === undefined) return <div className="workspace-empty"><FolderOpen size={30} /><h1>We couldn’t open that folder.</h1><p role="alert">{error}</p><button className="office-button" onClick={() => { setError(null); setRetry(value => value + 1); }}><RefreshCw size={14} />Try again</button></div>;
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
    {!!icp.expansionSegments.length && <section className="expansion-section"><h2>Worth exploring next</h2><p className="muted-text">Adjacent customer segments suggested by the research.</p>{icp.expansionSegments.map(segment => <article className="expansion-card" key={segment.id}><div><h3>{segment.name}</h3><span className="status-badge status-neutral">{segment.status}</span></div><p>{segment.rationale}</p><div className="source-list">{segment.evidence.map(source => <SourceLink key={source.url} source={source} />)}</div></article>)}</section>}
    <div className="form-actions"><Link className="text-button" href="/" scroll={false} onClick={scrollToOffice}><ArrowLeft size={14} />Back to your brief</Link><Link className="office-button" href="/leads" scroll={false} onClick={scrollToOffice}>Open leads workspace<ArrowRight size={15} /></Link></div>
  </>;
}
