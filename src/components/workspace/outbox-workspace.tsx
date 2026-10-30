"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Clock3, Copy, LoaderCircle, Mail, MessageSquareText, Pencil, RefreshCw, Send, X } from "lucide-react";
import { toast } from "sonner";
import type { Lead, Message, MessageStatus, ReviewRequest } from "@/contract/types";
import { SourceLink } from "@/components/shared/status-badges";
import { api } from "@/lib/api";
import { mergeLeadUpdates, mergeMessages } from "@/lib/lead-state";
import { scrollToOffice } from "@/lib/office-navigation";
import { useCachedApi } from "@/lib/use-cached-api";
import { useWorkspace } from "./workspace-provider";

const selectMessages = (response: { messages: Message[] }) => response.messages;
const selectLeads = (response: { leads: Lead[] }) => response.leads;

const statusLabels: Record<MessageStatus, string> = {
  pending_approval: "Waiting for review",
  approved: "Approved for manual send",
  rejected: "Rejected",
  sent: "Sent",
  failed: "Send failed",
};

const statusTones: Record<MessageStatus, string> = {
  pending_approval: "status-warning",
  approved: "status-success",
  rejected: "status-neutral",
  sent: "status-success",
  failed: "status-danger",
};

function formatMessageDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
}

function MessageCard({
  message,
  lead,
  busy,
  active,
  onReview,
  onCopy,
}: {
  message: Message;
  lead: Lead | undefined;
  busy: boolean;
  active: boolean;
  onReview: (request: ReviewRequest) => Promise<Message | null>;
  onCopy: (body: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(message.subject ?? "");
  const [body, setBody] = useState(message.body);
  const [editError, setEditError] = useState<string | null>(null);
  const bodyInput = useRef<HTMLTextAreaElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const signal = lead?.company.signals.find(item => item.description === message.signalUsed);
  const canEdit = message.status === "pending_approval" || message.status === "failed";
  const canApprove = message.status === "pending_approval" || (message.status === "failed" && message.channel === "email");

  useEffect(() => {
    if (editing) bodyInput.current?.focus();
    else if (restoreFocus.current) {
      restoreFocus.current = false;
      editButton.current?.focus();
    }
  }, [editing]);

  function startEditing() {
    setSubject(message.subject ?? "");
    setBody(message.body);
    setEditError(null);
    setEditing(true);
  }

  async function saveEdit() {
    if (!body.trim()) {
      setEditError("Add message text before saving.");
      return;
    }
    const updated = await onReview({
      messageId: message.id,
      action: "edit",
      subject: message.channel === "email" ? subject : null,
      body,
    });
    if (updated) {
      restoreFocus.current = true;
      setEditing(false);
      setEditError(null);
    }
  }

  async function review(action: "approve" | "reject") {
    await onReview({ messageId: message.id, action, subject: message.subject, body: message.body });
  }

  function cancelEdit() {
    restoreFocus.current = true;
    setEditing(false);
    setEditError(null);
  }

  const buyer = lead?.person.name || "Buyer details unavailable";
  const company = lead?.company.name || "Company details unavailable";

  return <article className="outbox-card" aria-busy={busy}>
    <header className="outbox-card-header">
      <div className="outbox-channel">{message.channel === "email" ? <Mail size={15} /> : <MessageSquareText size={15} />}<span>{message.channel === "email" ? "Email" : "LinkedIn"}</span></div>
      <div className="outbox-card-badges">
        <span className={`status-badge ${statusTones[message.status]}`}>{statusLabels[message.status]}</span>
        {message.editedByRep && <span className="status-badge status-neutral"><Pencil size={11} />Edited by you</span>}
      </div>
    </header>

    <div className="outbox-recipient">
      <h3>{buyer}</h3>
      <p>{lead ? `${lead.person.title || "Buyer"} · ${company}` : company}</p>
    </div>

    {message.channel === "email" && <div className="outbox-subject-row">
      <span className="eyebrow">Subject</span>
      {editing
        ? <input className="outbox-subject-input" aria-label={`Subject for ${buyer}`} value={subject} onChange={event => setSubject(event.target.value)} />
        : <p>{message.subject || "—"}</p>}
    </div>}

    <div className="outbox-body">
      <div className="eyebrow">Message</div>
      {editing
        ? <textarea ref={bodyInput} aria-label={`Message for ${buyer}`} rows={8} value={body} onChange={event => { setBody(event.target.value); setEditError(null); }} />
        : <p>{message.body}</p>}
    </div>

    <div className="outbox-evidence">
      <div><span className="eyebrow">Signal used</span><p>{message.signalUsed || "—"}</p></div>
      <div className="outbox-evidence-link">
        <SourceLink source={signal?.source ?? null} />
        <Link className="text-button" href="/leads" scroll={false} onClick={scrollToOffice}>Review lead evidence</Link>
      </div>
    </div>

    <div className="outbox-card-meta">
      <span><Clock3 size={12} />Drafted {formatMessageDate(message.createdAt)}</span>
      {message.sentAt && <span><Send size={12} />Sent {formatMessageDate(message.sentAt)}</span>}
    </div>

    {message.status === "failed" && <p className="outbox-failure" role="status">The email was not sent. You can edit it or deliberately retry.</p>}

    {editError && <p className="inline-error" role="alert">{editError}</p>}
    {editing ? <div className="outbox-actions">
      <button className="office-button primary-button" type="button" disabled={busy} onClick={saveEdit}>{active ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />}{active ? "Saving edit…" : "Save edit"}</button>
      <button className="office-button" type="button" disabled={busy} onClick={cancelEdit}><X size={14} />Cancel</button>
    </div> : <div className="outbox-actions">
      {canEdit && <button ref={editButton} className="office-button" type="button" disabled={busy} onClick={startEditing}><Pencil size={14} />Edit</button>}
      {canEdit && <button className="office-button" type="button" disabled={busy} onClick={() => review("reject")}><X size={14} />Reject</button>}
      {canApprove && <button className="office-button primary-button" type="button" disabled={busy} onClick={() => review("approve")}>{active ? <LoaderCircle size={14} className="spin" /> : message.channel === "email" ? <Send size={14} /> : <Check size={14} />}{active ? "Updating…" : message.channel === "email" ? message.status === "failed" ? "Retry send" : "Approve and send" : "Approve for manual send"}</button>}
      {message.channel === "linkedin" && message.status === "approved" && <button className="office-button primary-button" type="button" disabled={busy} onClick={() => onCopy(message.body)}><Copy size={14} />Copy message</button>}
      {message.status === "sent" && <span className="outbox-locked"><Check size={13} />This email was sent.</span>}
      {message.status === "rejected" && <span className="outbox-locked">This message was rejected.</span>}
      {message.status === "approved" && message.channel === "email" && <span className="outbox-locked">This email has already been approved.</span>}
    </div>}
  </article>;
}

export function OutboxWorkspace() {
  const { messages, setMessages, leads, setLeads, dataVersion, setActivityOpen } = useWorkspace();
  const messageRequest = useCachedApi<Message[], { messages: Message[] }>("/api/messages", messages, setMessages, dataVersion, true, selectMessages);
  const leadRequest = useCachedApi<Lead[], { leads: Lead[] }>("/api/leads", leads, setLeads, dataVersion, !!messages?.length, selectLeads);
  const [reviewedLeads, setReviewedLeads] = useState<{ version: number; byId: Record<string, Lead> }>({ version: dataVersion, byId: {} });
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => operation.current?.abort(), [dataVersion]);

  const leadById = new Map((leads ?? []).map(lead => [lead.id, lead]));
  const leadOverrides = reviewedLeads.version === dataVersion ? reviewedLeads.byId : {};
  const waiting = (messages ?? []).filter(message => message.status === "pending_approval");
  const recent = (messages ?? []).filter(message => message.status !== "pending_approval");

  async function review(request: ReviewRequest): Promise<Message | null> {
    if (operation.current) return null;
    const controller = new AbortController();
    operation.current = controller;
    setReviewingId(request.messageId);
    setActionError(null);
    setActivityOpen(true);
    try {
      const result = await api<{ message: Message; lead: Lead }>("/api/messages/review", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify(request),
      });
      if (controller.signal.aborted) return null;
      setMessages(current => mergeMessages(current, [result.message]));
      setLeads(current => current === undefined ? current : mergeLeadUpdates(current, [result.lead]));
      setReviewedLeads(current => ({
        version: dataVersion,
        byId: { ...(current.version === dataVersion ? current.byId : {}), [result.lead.id]: result.lead },
      }));

      if (request.action === "approve" && result.message.channel === "email" && result.message.status === "failed") {
        const message = "Approval was recorded, but the email could not be sent. Edit it or retry when ready.";
        setActionError(message);
        toast.error(message);
      } else if (request.action === "edit") {
        toast.success("Your edits are saved. The message is still waiting for approval.");
      } else if (request.action === "reject") {
        toast.success("Message rejected.");
      } else if (result.message.channel === "email" && result.message.status === "sent") {
        toast.success("Email approved and sent.");
      } else if (result.message.channel === "linkedin" && result.message.status === "approved") {
        toast.success("Approved for manual sending. Copy it when you’re ready.");
      } else {
        toast.success("Review updated.");
      }
      return result.message;
    } catch (caught) {
      if (controller.signal.aborted) return null;
      const message = caught instanceof Error ? caught.message : "Could not update this message.";
      setActionError(message);
      toast.error(message);
      return null;
    } finally {
      if (operation.current === controller) operation.current = null;
      setReviewingId(null);
    }
  }

  async function copyMessage(body: string) {
    try {
      await navigator.clipboard.writeText(body);
      toast.success("LinkedIn message copied.");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not copy the message. Select and copy it instead.");
    }
  }

  return <>
    <div className="page-heading"><div className="eyebrow">Letter tray / Human review</div><div className="outbox-heading-row"><h1>Your outreach, ready for a human touch.</h1>{messages !== undefined && <span className="outbox-count" role="status"><Clock3 size={13} />{waiting.length} waiting for review</span>}</div><p>Read the buyer context, check the signal, and decide what happens next.</p></div>

    <div className="outbox-safety-note"><strong>Nothing sends automatically.</strong><span>Drafting and editing only save text. Approving an email sends it; approving LinkedIn prepares it for you to copy and send manually.</span></div>
    {actionError && <div className="inline-error" role="alert">{actionError}</div>}
    {leadRequest.error && leads === undefined && <div className="outbox-context-error" role="alert"><span>Lead context could not be loaded. Message review is still available.</span><button className="text-button" type="button" onClick={leadRequest.retry}><RefreshCw size={12} />Retry context</button></div>}

    {messageRequest.loading && messages === undefined && <div className="research-empty" role="status"><LoaderCircle size={25} className="spin" /><h2>Opening the letter tray…</h2><p>Loading messages that need your review.</p></div>}
    {messageRequest.error && messages === undefined && <div className="research-empty"><Mail size={25} /><h2>We couldn’t load your messages.</h2><p role="alert">{messageRequest.error}</p><button className="office-button" type="button" onClick={messageRequest.retry}><RefreshCw size={13} />Try again</button></div>}
    {messages !== undefined && messages.length === 0 && <div className="research-empty"><Mail size={25} /><h2>Your letter tray is empty.</h2><p>Select leads in the filing cabinet to create outreach drafts. Drafts are not sent until you approve them here.</p><Link className="office-button primary-button" href="/leads" scroll={false} onClick={scrollToOffice}>Choose leads</Link></div>}
    {messages !== undefined && messages.length > 0 && <>
      {leadRequest.loading && <p className="outbox-context-loading" role="status"><LoaderCircle size={13} className="spin" />Loading buyer and company details…</p>}
      <section className="outbox-section" aria-labelledby="outbox-waiting-heading">
        <div className="outbox-section-heading"><div><div className="eyebrow">Your decision</div><h2 id="outbox-waiting-heading">Waiting for review</h2></div><span>{waiting.length}</span></div>
        {waiting.length ? <div className="outbox-list">{waiting.map(message => <MessageCard key={message.id} message={message} lead={leadOverrides[message.leadId] ?? leadById.get(message.leadId)} busy={reviewingId !== null} active={reviewingId === message.id} onReview={review} onCopy={copyMessage} />)}</div> : <p className="outbox-quiet-empty">Nothing needs your approval right now.</p>}
      </section>
      {recent.length > 0 && <section className="outbox-section outbox-history" aria-labelledby="outbox-recent-heading"><div className="outbox-section-heading"><div><div className="eyebrow">Your decisions</div><h2 id="outbox-recent-heading">Recent messages</h2></div><span>{recent.length}</span></div><div className="outbox-list">{recent.map(message => <MessageCard key={message.id} message={message} lead={leadOverrides[message.leadId] ?? leadById.get(message.leadId)} busy={reviewingId !== null} active={reviewingId === message.id} onReview={review} onCopy={copyMessage} />)}</div></section>}
    </>}

    <div className="research-bottom-link"><Link className="text-button" href="/leads" scroll={false} onClick={scrollToOffice}>Back to lead research</Link><span className="muted-text">Every send follows a human approval.</span></div>
  </>;
}
