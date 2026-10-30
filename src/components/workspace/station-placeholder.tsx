import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { stations, type StationPath } from "@/components/office/stations";

const copy = {
  "/leads": { title: "Your next customers live here.", description: "This cabinet is the home for company research, buying signals, and verified contact details.", next: "Review your customer profile", href: "/icp" },
  "/review": { title: "Give every message a human touch.", description: "Your outbox brings outreach drafts together for review before anything is sent.", next: "Visit the leads workspace", href: "/leads" },
  "/pipeline": { title: "A place for every conversation.", description: "Follow your leads from the first match to a meeting and a customer.", next: "Visit the leads workspace", href: "/leads" },
  "/dashboard": { title: "See the work adding up.", description: "Your campaign reports and activity history will come together at this monitor.", next: "Start with your product brief", href: "/" },
};

export function StationPlaceholder({ path }: { path: Exclude<StationPath, "/" | "/icp"> }) {
  const station = stations.find(station => station.href === path)!;
  const Icon = station.icon, text = copy[path];
  return <div className="workspace-empty"><div className="empty-station-icon"><Icon size={30} strokeWidth={1.3} /></div><div className="eyebrow">{station.object} / Workspace foundation</div><h1>{text.title}</h1><p>{text.description}</p><span className="milestone-note">The office and navigation are ready. This station’s tools are the next milestone.</span><Link className="office-button" href={text.href}><ArrowLeft size={14} />{text.next}</Link></div>;
}
