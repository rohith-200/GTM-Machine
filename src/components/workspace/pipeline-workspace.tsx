"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { ArrowRight, GripVertical, LoaderCircle, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import type { Lead, Stage } from "@/contract/types";
import { ActorBadge, TierBadge } from "@/components/shared/status-badges";
import { api } from "@/lib/api";
import { mergeLeadUpdates, stageLabels } from "@/lib/lead-state";
import { useCachedApi } from "@/lib/use-cached-api";
import { useWorkspace } from "./workspace-provider";

const stages: Stage[] = ["matched", "contacted", "replied", "meeting_booked", "closed_won", "closed_lost"];
const selectLeads = (response: { leads: Lead[] }) => response.leads;
const isStage = (value: string): value is Stage => stages.some(stage => stage === value);

function PipelineCard({
  lead,
  busy,
  onMove,
}: {
  lead: Lead;
  busy: boolean;
  onMove: (leadId: string, stage: Stage) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id: `lead:${lead.id}`,
    data: { leadId: lead.id },
    disabled: busy,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return <article ref={setNodeRef} style={style} className={`pipeline-card ${isDragging ? "is-dragging" : ""}`} aria-busy={busy}>
    <div className="pipeline-card-top">
      <TierBadge tier={lead.tier} />
      <div className="pipeline-card-tools">
        {busy && <LoaderCircle size={13} className="spin pipeline-card-saving" aria-label="Saving stage" />}
        <button
          ref={setActivatorNodeRef}
          className="pipeline-drag-handle"
          type="button"
          disabled={busy}
          {...attributes}
          {...listeners}
          aria-label={`Drag ${lead.company.name} to another stage`}
          title="Drag to move, or use Move lead"
        ><GripVertical size={16} aria-hidden="true" /></button>
      </div>
    </div>
    <h3>{lead.company.name || "Unnamed company"}</h3>
    <p className="pipeline-person">{lead.person.name || "Buyer unavailable"}<span>{lead.person.title || "Title unavailable"}</span></p>
    <div className="pipeline-card-footer">
      <span className="pipeline-fit">{lead.fitScore}<small>/ 100 fit</small></span>
      <ActorBadge actor={lead.lastActor} />
    </div>
    <label className="pipeline-move-label" htmlFor={`move-${lead.id}`}>Move lead</label>
    <select
      id={`move-${lead.id}`}
      className="pipeline-stage-select"
      value={lead.stage}
      disabled={busy}
      onChange={event => { if (isStage(event.target.value)) onMove(lead.id, event.target.value); }}
    >
      {stages.map(stage => <option key={stage} value={stage}>{stageLabels[stage]}</option>)}
    </select>
  </article>;
}

function PipelineColumn({
  stage,
  leads,
  pendingIds,
  onMove,
}: {
  stage: Stage;
  leads: Lead[];
  pendingIds: Set<string>;
  onMove: (leadId: string, stage: Stage) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage });
  return <section ref={setNodeRef} className={`pipeline-column ${isOver ? "is-drop-target" : ""}`} aria-label={`${stageLabels[stage]} stage`}>
    <header className="pipeline-column-heading">
      <h2>{stageLabels[stage]}</h2>
      <span aria-label={`${leads.length} ${leads.length === 1 ? "lead" : "leads"}`}>{leads.length}</span>
    </header>
    <div className="pipeline-column-cards">
      {leads.map(lead => <PipelineCard key={lead.id} lead={lead} busy={pendingIds.has(lead.id)} onMove={onMove} />)}
      {leads.length === 0 && <p className="pipeline-column-empty">Drop a lead here, or move one with its stage menu.</p>}
    </div>
  </section>;
}

export function PipelineWorkspace() {
  const { leads, setLeads, dataVersion } = useWorkspace();
  const leadRequest = useCachedApi<Lead[], { leads: Lead[] }>("/api/leads", leads, setLeads, dataVersion, true, selectLeads);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const movingIds = useRef(new Map<string, AbortController>());
  const version = useRef(dataVersion);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const sortedLeads = [...(leads ?? [])].sort((a, b) => b.fitScore - a.fitScore);
  useEffect(() => {
    version.current = dataVersion;
    const activeRequests = movingIds.current;
    return () => {
      for (const controller of activeRequests.values()) controller.abort();
      activeRequests.clear();
    };
  }, [dataVersion]);

  async function moveLead(leadId: string, stage: Stage) {
    const currentLead = leads?.find(lead => lead.id === leadId);
    if (!currentLead || currentLead.stage === stage || movingIds.current.has(leadId)) return;
    const requestVersion = dataVersion;
    const controller = new AbortController();
    movingIds.current.set(leadId, controller);
    setPendingIds(current => new Set(current).add(leadId));
    setActionError(null);
    setLeads(current => current?.map(lead => lead.id === leadId
      ? { ...lead, stage, lastActor: "rep" }
      : lead));

    try {
      const result = await api<{ lead: Lead }>("/api/leads/stage", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({ leadId, stage }),
      });
      if (requestVersion !== version.current) return;
      setLeads(current => current ? mergeLeadUpdates(current, [result.lead]) : current);
      toast.success(`${result.lead.company.name} moved to ${stageLabels[result.lead.stage]}`, {
        description: "Stage updated by you.",
      });
    } catch (caught) {
      if (requestVersion !== version.current) return;
      if (controller.signal.aborted) {
        setLeads(current => current?.map(lead => lead.id === leadId && lead.stage === stage
          ? { ...lead, stage: currentLead.stage, lastActor: currentLead.lastActor }
          : lead));
        return;
      }
      const message = caught instanceof Error ? caught.message : "Could not update this lead’s stage.";
      setLeads(current => current?.map(lead => lead.id === leadId && lead.stage === stage
        ? { ...lead, stage: currentLead.stage, lastActor: currentLead.lastActor }
        : lead));
      setActionError(message);
      toast.error(message);
    } finally {
      if (movingIds.current.get(leadId) === controller) movingIds.current.delete(leadId);
      setPendingIds(current => {
        const next = new Set(current);
        next.delete(leadId);
        return next;
      });
    }
  }

  function finishDrag(event: DragEndEvent) {
    const leadId = event.active.data.current?.leadId;
    const stage = event.over?.id;
    if (typeof leadId !== "string" || typeof stage !== "string" || !isStage(stage)) return;
    void moveLead(leadId, stage);
  }

  if (leadRequest.loading && leads === undefined) return <div className="research-empty" role="status"><LoaderCircle size={25} className="spin" /><h2>Opening your conversation board…</h2><p>Loading leads and their current stages.</p></div>;
  if (leadRequest.error && leads === undefined) return <div className="research-empty"><Users size={25} /><h2>We couldn’t load the pipeline.</h2><p role="alert">{leadRequest.error}</p><button className="office-button" type="button" onClick={leadRequest.retry}><RefreshCw size={13} />Try again</button></div>;
  if (leads?.length === 0) return <div className="research-empty"><Users size={26} /><h2>Your board is ready for its first lead.</h2><p>Discover companies in the customer profile workspace. Your matched leads will appear here.</p><Link className="office-button primary-button" href="/leads">Open lead research<ArrowRight size={14} /></Link></div>;

  return <>
    <div className="page-heading"><div className="eyebrow">Wall board / Your conversations</div><h1>A place for every conversation.</h1><p>Move each lead as the relationship develops. Every stage change is recorded as a rep action.</p></div>
    <div className="pipeline-toolbar">
      <span className="selection-copy" role="status" aria-live="polite">{sortedLeads.length} {sortedLeads.length === 1 ? "lead" : "leads"} across six stages</span>
      <span className="pipeline-instructions">Drag a card or use its Move lead menu.</span>
    </div>
    {leadRequest.error && leads !== undefined && <div className="outbox-context-error" role="alert"><span>Couldn’t refresh leads. Showing the saved board.</span><button className="text-button" type="button" onClick={leadRequest.retry}><RefreshCw size={12} />Retry</button></div>}
    {actionError && <div className="inline-error" role="alert">{actionError} The lead was returned to its previous stage; you can try again.</div>}
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={finishDrag}>
      <div className="pipeline-board" aria-label="Lead pipeline board">
        {stages.map(stage => <PipelineColumn
          key={stage}
          stage={stage}
          leads={sortedLeads.filter(lead => lead.stage === stage)}
          pendingIds={pendingIds}
          onMove={moveLead}
        />)}
      </div>
    </DndContext>
  </>;
}
