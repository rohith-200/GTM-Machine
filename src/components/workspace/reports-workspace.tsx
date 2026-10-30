"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, Bot, LoaderCircle, Mail, RefreshCw, Send, UserRound, Users } from "lucide-react";
import type { ActivityEvent, Analytics, Stage } from "@/contract/types";
import { ActorBadge } from "@/components/shared/status-badges";
import { stageLabels } from "@/lib/lead-state";
import { useCachedApi } from "@/lib/use-cached-api";
import { useWorkspace } from "./workspace-provider";

const stages: Stage[] = ["matched", "contacted", "replied", "meeting_booked", "closed_won", "closed_lost"];
const selectEvents = (response: { events: ActivityEvent[] }) => response.events;

function formatAction(action: string) {
  const words = action.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

function PanelHeader({
  eyebrow,
  title,
  titleId,
  onRefresh,
  loading,
  refreshLabel,
}: {
  eyebrow: string;
  title: string;
  titleId: string;
  onRefresh: () => void;
  loading: boolean;
  refreshLabel: string;
}) {
  return <div className="report-panel-heading">
    <div><span className="eyebrow">{eyebrow}</span><h2 id={titleId}>{title}</h2></div>
    <button className="icon-button report-refresh" type="button" onClick={onRefresh} disabled={loading} aria-label={refreshLabel} title={refreshLabel}>
      {loading ? <LoaderCircle size={14} className="spin" /> : <RefreshCw size={14} />}
    </button>
  </div>;
}

function PanelState({ loading, error, retry, label }: { loading: boolean; error: string | null; retry: () => void; label: string }) {
  if (loading) return <div className="report-panel-state" role="status"><LoaderCircle size={17} className="spin" />Loading {label}…</div>;
  if (error) return <div className="report-panel-error" role="alert"><p>{error}</p><button className="text-button" type="button" onClick={retry}><RefreshCw size={12} />Try again</button></div>;
  return null;
}

function ReportsContent({ dataVersion }: { dataVersion: number }) {
  const [analytics, setAnalytics] = useState<Analytics | undefined>(undefined);
  const [events, setEvents] = useState<ActivityEvent[] | undefined>(undefined);
  const analyticsRequest = useCachedApi<Analytics>("/api/analytics", analytics, setAnalytics, dataVersion);
  const activityRequest = useCachedApi<ActivityEvent[], { events: ActivityEvent[] }>("/api/activity", events, setEvents, dataVersion, true, selectEvents);

  function refreshAnalytics() {
    setAnalytics(undefined);
    analyticsRequest.retry();
  }

  function refreshActivity() {
    setEvents(undefined);
    activityRequest.retry();
  }

  const totalLeads = analytics ? stages.reduce((total, stage) => total + analytics.stageCounts[stage], 0) : undefined;
  const maxStageCount = analytics ? Math.max(...stages.map(stage => analytics.stageCounts[stage]), 0) : 0;
  const actionTotal = analytics ? analytics.actions.ai + analytics.actions.rep : undefined;

  return <>
    <div className="page-heading">
      <div className="eyebrow">Monitor / Your reports</div>
      <h1>See the work adding up.</h1>
      <p>Follow conversations, outreach, and the work behind every next step.</p>
    </div>

    <section className="report-summary" aria-label="Workspace snapshot">
      {analytics ? <>
        <article className="report-summary-card"><Users size={16} aria-hidden="true" /><span>Leads tracked</span><strong>{totalLeads}</strong></article>
        <article className="report-summary-card"><Mail size={16} aria-hidden="true" /><span>Messages drafted</span><strong>{analytics.messages.drafted}</strong></article>
        <article className="report-summary-card"><Send size={16} aria-hidden="true" /><span>Messages sent</span><strong>{analytics.messages.sent}</strong></article>
        <article className="report-summary-card"><Activity size={16} aria-hidden="true" /><span>Recorded actions</span><strong>{actionTotal}</strong></article>
      </> : <div className="report-summary-state" role="status">
        {analyticsRequest.loading || !analyticsRequest.error
          ? <><LoaderCircle size={16} className="spin" />Loading workspace snapshot…</>
          : <>Workspace snapshot unavailable.</>}
      </div>}
    </section>

    <div className="report-grid">
      {analytics ? <>
        <section className="report-panel report-panel-funnel" aria-labelledby="report-funnel-title">
          <PanelHeader eyebrow="Lead movement" title="Pipeline funnel" titleId="report-funnel-title" onRefresh={refreshAnalytics} loading={analyticsRequest.loading} refreshLabel="Refresh pipeline report" />
          <ol className="report-stage-list">
            {stages.map(stage => {
              const count = analytics.stageCounts[stage];
              const width = maxStageCount ? (count / maxStageCount) * 100 : 0;
              return <li className="report-stage-row" key={stage}>
                <span>{stageLabels[stage]}</span>
                <span className="report-stage-track" aria-hidden="true"><span style={{ width: `${width}%` }} /></span>
                <strong>{count}</strong>
              </li>;
            })}
          </ol>
          <div className="report-conversion">
            <h3>Step-to-step conversion</h3>
            <div className="report-conversion-list">
              {analytics.conversion.map(item => <div className="report-conversion-row" key={`${item.from}-${item.to}`}>
                <span>{stageLabels[item.from]} <ArrowRight size={12} aria-hidden="true" /> {stageLabels[item.to]}</span>
                <strong>{Math.round(item.rate * 100)}%</strong>
              </div>)}
            </div>
          </div>
        </section>

        <section className="report-panel" aria-labelledby="report-tier-title">
          <PanelHeader eyebrow="Lead quality" title="By fit tier" titleId="report-tier-title" onRefresh={refreshAnalytics} loading={analyticsRequest.loading} refreshLabel="Refresh tier report" />
          <div className="report-tier-list">
            {analytics.byTier.map(item => <article className={`report-tier-card report-tier-${item.tier.toLowerCase()}`} key={item.tier}>
              <div className="report-tier-heading"><span>Tier {item.tier}</span><strong>{item.leads} <small>{item.leads === 1 ? "lead" : "leads"}</small></strong></div>
              <dl><div><dt>Contacted</dt><dd>{item.contacted}</dd></div><div><dt>Replied</dt><dd>{item.replied}</dd></div></dl>
            </article>)}
          </div>
          {totalLeads === 0 && <p className="report-inline-note">Discover leads to see your fit-tier breakdown. <Link href="/leads">Open lead research<ArrowRight size={12} /></Link></p>}
        </section>

        <section className="report-panel" aria-labelledby="report-messages-title">
          <PanelHeader eyebrow="Outreach" title="Message outcomes" titleId="report-messages-title" onRefresh={refreshAnalytics} loading={analyticsRequest.loading} refreshLabel="Refresh message report" />
          <dl className="report-message-list">
            <div><dt>Drafted</dt><dd>{analytics.messages.drafted}</dd></div>
            <div><dt>Approved (includes sent)</dt><dd>{analytics.messages.approved}</dd></div>
            <div><dt>Rejected</dt><dd>{analytics.messages.rejected}</dd></div>
            <div><dt>Sent</dt><dd>{analytics.messages.sent}</dd></div>
          </dl>
        </section>

        <section className="report-panel" aria-labelledby="report-actions-title">
          <PanelHeader eyebrow="Work ownership" title="AI and rep actions" titleId="report-actions-title" onRefresh={refreshAnalytics} loading={analyticsRequest.loading} refreshLabel="Refresh action report" />
          <div className="report-action-counts">
            <div><span><Bot size={15} aria-hidden="true" />AI actions</span><strong>{analytics.actions.ai}</strong></div>
            <div><span><UserRound size={15} aria-hidden="true" />Rep actions</span><strong>{analytics.actions.rep}</strong></div>
          </div>
          <p className="report-inline-note">Counts reflect actions recorded by the workspace.</p>
        </section>
      </> : <section className="report-panel report-panel-funnel" aria-labelledby="report-funnel-title">
        <PanelHeader eyebrow="Lead movement" title="Pipeline funnel" titleId="report-funnel-title" onRefresh={refreshAnalytics} loading={analyticsRequest.loading} refreshLabel="Refresh pipeline report" />
        <PanelState loading={analyticsRequest.loading} error={analyticsRequest.error} retry={analyticsRequest.retry} label="analytics" />
      </section>}

      <section className="report-panel report-panel-activity" aria-labelledby="report-activity-title">
        <PanelHeader eyebrow="Workspace history" title="Recent activity" titleId="report-activity-title" onRefresh={refreshActivity} loading={activityRequest.loading} refreshLabel="Refresh recent activity" />
        <PanelState loading={activityRequest.loading && !events} error={!events ? activityRequest.error : null} retry={activityRequest.retry} label="activity" />
        {events && (events.length ? <ol className="report-activity-list">
          {events.map(event => <li className="report-activity-item" key={event.id}>
            <ActorBadge actor={event.actor} />
            <div className="report-activity-copy"><strong>{formatAction(event.action)}</strong><p>{event.detail}</p></div>
            <time dateTime={event.timestamp}>{formatTimestamp(event.timestamp)}</time>
          </li>)}
        </ol> : <div className="report-empty-activity"><Activity size={19} /><p>No activity has been recorded yet.</p><Link href="/leads">Explore leads<ArrowRight size={12} /></Link></div>)}
      </section>
    </div>
  </>;
}

export function ReportsWorkspace() {
  const { dataVersion } = useWorkspace();
  return <ReportsContent key={dataVersion} dataVersion={dataVersion} />;
}
