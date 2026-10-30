"use client";

import { useEffect, useState } from "react";
import { Activity, Check, CircleAlert, LoaderCircle, RefreshCw, X } from "lucide-react";
import type { AgentLog } from "@/contract/types";
import { api } from "@/lib/api";
import { useWorkspace } from "./workspace-provider";

export function AgentPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dataVersion } = useWorkspace();
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    let cursor: string | undefined;
    let first = true;
    async function poll() {
      try {
        if (document.visibilityState === "hidden") return;
        const since = cursor ? `?since=${encodeURIComponent(new Date(Date.parse(cursor) - 1).toISOString())}` : "";
        const result = await api<{ logs: AgentLog[] }>(`/api/agent-log${since}`, { signal: controller.signal });
        if (disposed) return;
        const batch = result.logs;
        const replace = first;
        setLogs(previous => {
          const combined = new Map((replace ? [] : previous).map(log => [log.id, log]));
          for (const log of batch) combined.set(log.id, log);
          return [...combined.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 100);
        });
        first = false;
        for (const log of batch) if (!cursor || log.timestamp > cursor) cursor = log.timestamp;
        setError(null);
        setConnected(true);
      } catch (caught) {
        if (!disposed && !(caught instanceof Error && caught.name === "AbortError")) {
          setError(caught instanceof Error ? caught.message : "Could not load activity.");
          setConnected(false);
        }
      } finally {
        if (!disposed) timer = setTimeout(poll, 1500);
      }
    }
    void poll();
    return () => { disposed = true; controller.abort(); clearTimeout(timer); };
  }, [dataVersion, retry]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <aside className={`agent-panel ${open ? "is-open" : ""}`} id="agent-panel" aria-labelledby="agent-title" inert={!open}>
      <div className="agent-panel-heading"><div><div className="eyebrow">From your agents</div><h2 id="agent-title"><Activity size={17} aria-hidden="true" />Agent Thinking</h2></div><button className="icon-button" onClick={onClose} aria-label="Close agent activity"><X size={17} /></button></div>
      <p className="panel-description">A running record of searches, checks, and completed work.</p>
      <div className="connection-status"><span className={`connection-dot ${connected ? "is-connected" : ""}`} />{connected ? "Connected · Updates every 1.5s" : error ? "Connection interrupted" : "Connecting to activity…"}</div>
      {error && <div className="inline-error" role="alert"><p>{error}</p><button className="text-button" onClick={() => setRetry(value => value + 1)}><RefreshCw size={13} />Retry connection</button></div>}
      <div className="agent-log-list" aria-label="Agent activity entries">
        {!logs.length && <div className="agent-empty">{connected ? <Activity size={24} /> : <LoaderCircle size={24} className="spin" />}<h3>{connected ? "A fresh page." : "Opening the activity log…"}</h3><p>{connected ? "Generate a customer profile to start seeing agent activity here." : "Your workspace stays available while we connect."}</p></div>}
        {logs.map(log => {
          const Icon = log.level === "success" ? Check : log.level === "warn" || log.level === "error" ? CircleAlert : Activity;
          return <article className={`agent-entry log-${log.level}`} key={log.id}><span className="agent-entry-icon"><Icon size={13} aria-hidden="true" /></span><div><div className="agent-entry-meta"><span>{log.step}</span><time dateTime={log.timestamp}>{new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div><p>{log.message}</p><span className="sr-only">{log.level}</span></div></article>;
        })}
      </div>
      <div className="agent-panel-foot">Activity from your backend · Up to 100 recent entries</div>
    </aside>
  );
}
