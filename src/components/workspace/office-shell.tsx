"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { Activity, ArrowUpRight, Focus, Layers2, LoaderCircle, Map, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { stations, type StationPath } from "@/components/office/stations";
import { api } from "@/lib/api";
import { scrollToOffice } from "@/lib/office-navigation";
import { AgentPanel } from "./agent-panel";
import { useWorkspace } from "./workspace-provider";

const OfficeScene = dynamic(() => import("@/components/office/office-scene"), {
  ssr: false,
  loading: () => <div className="scene-loading"><span className="connection-dot" />Opening your office…</div>,
});

export function OfficeShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { resetData, activityOpen, setActivityOpen } = useWorkspace();
  const [overviewAt, setOverviewAt] = useState<string | null>(null);
  const [focus, setFocus] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const activityButton = useRef<HTMLButtonElement>(null);
  const overview = overviewAt === pathname && !focus;
  const station = stations.find(station => station.href === pathname) ?? stations[0];
  const StationIcon = station.icon;
  const navigate = useCallback((path: StationPath) => { setOverviewAt(null); router.push(path, { scroll: false }); scrollToOffice(); }, [router]);
  const closeActivity = useCallback(() => { setActivityOpen(false); activityButton.current?.focus(); }, [setActivityOpen]);

  async function loadDemo() {
    if (loadingDemo) return;
    setLoadingDemo(true);
    try {
      await api<{ loaded: true }>("/api/demo/load", { method: "POST" });
      resetData(); router.refresh();
      toast.success("Demo workspace loaded", { description: "Your sample customer profile and leads are ready." });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load demo data."); }
    finally { setLoadingDemo(false); }
  }

  return <div className={`office-app ${focus ? "focus-mode" : ""} ${overview ? "overview-mode" : ""}`}>
    <a href="#main-content" className="skip-link">Skip to workspace</a>
    <header className="app-header">
      <Link className="app-brand" href="/" onClick={() => setOverviewAt(null)}><span className="brand-symbol"><Layers2 size={20} strokeWidth={1.7} /></span><span>GTM Office<small>A place for every step.</small></span></Link>
      <div className="header-actions">
        <button className="office-button subtle-button" onClick={loadDemo} disabled={loadingDemo} title="Load the saved sample workspace">{loadingDemo ? <LoaderCircle size={14} className="spin" /> : <RotateCcw size={14} />}{loadingDemo ? "Loading demo…" : "Load demo data"}</button>
        <span className="header-divider" />
        <button className="office-button" onClick={() => { setFocus(false); setOverviewAt(overview ? null : pathname); }} aria-pressed={overview}><Map size={15} />{overview ? "Back to workspace" : "Office map"}</button>
        <button className="office-button focus-button" onClick={() => { setFocus(value => !value); setOverviewAt(null); }} aria-label="Focus mode" aria-pressed={focus}><Focus size={15} aria-hidden="true" /><span>Focus mode</span></button>
        <button ref={activityButton} className={`office-button ${activityOpen ? "is-active" : ""}`} onClick={() => setActivityOpen(value => !value)} aria-expanded={activityOpen} aria-controls="agent-panel"><Activity size={15} /><span>Agent Thinking</span><span className="activity-indicator" aria-hidden="true" /></button>
      </div>
    </header>
    <div className="workflow-bar"><nav className="workflow-navigation" aria-label="GTM workflow">{stations.map((item, index) => {
      const Icon = item.icon;
      return <Link href={item.href} key={item.href} scroll={false} onClick={() => setOverviewAt(null)} className={`workflow-link ${pathname === item.href && !overview ? "is-active" : ""}`} aria-current={pathname === item.href && !overview ? "page" : undefined}><span className="workflow-number">0{index + 1}</span><Icon size={15} aria-hidden="true" /><span>{item.title}</span></Link>;
    })}</nav><span className="workspace-label">Founder workspace</span></div>
    <div className="room-stage" aria-label={overview ? "Office map" : `${station.object} station`}>
      <OfficeScene activePath={pathname} overview={overview} hidden={focus} onNavigate={navigate} />
      {overview && <div className="office-welcome"><div className="eyebrow">Your office / Six connected stations</div><h1>Every object<br />has a purpose.</h1><p>Choose a labeled object, or use the navigation. Your workspace follows you.</p><button className="office-button primary-button" onClick={() => setOverviewAt(null)}>Return to {station.title.toLowerCase()}<ArrowUpRight size={15} /></button></div>}
      {!overview && <div className="station-caption"><span className="tiny-dot" />At the {station.object.toLowerCase()}<span className="station-caption-rule" /><span>Step {stations.indexOf(station) + 1} of 6</span></div>}
    </div>
    <main id="main-content" className="workspace-paper" key={pathname} hidden={overview} tabIndex={-1}>
      <div className="paper-topline"><div><StationIcon size={14} aria-hidden="true" />{station.object}<span className="breadcrumb-separator">/</span><span>{station.title}</span></div><span className="paper-page-number">0{stations.indexOf(station) + 1} — 06</span></div>
      {children}
      <div className="paper-bottomline"><span>One thoughtful step at a time.</span><span className="paper-mark"><Layers2 size={12} aria-hidden="true" />GTM Office</span></div>
    </main>
    <footer className="app-footer"><span>Clarity for your next conversation.</span><span>Research. Review. Reach out.</span></footer>
    <AgentPanel open={activityOpen} onClose={closeActivity} />
    <Toaster theme="light" richColors position="bottom-right" />
  </div>;
}
