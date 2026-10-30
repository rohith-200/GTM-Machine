import { AlertCircle, Bot, Check, CircleHelp, ExternalLink, Mail, ShieldAlert, UserRound, X } from "lucide-react";
import type { Actor, Citation, EmailStatus, Tier } from "@/contract/types";

export function TierBadge({ tier }: { tier: Tier }) {
  return <span className={`status-badge tier-${tier.toLowerCase()}`}>Tier {tier}</span>;
}

export function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null) return <span className="status-badge status-neutral">Confidence unavailable</span>;
  const level = confidence >= 0.75 ? "success" : confidence >= 0.5 ? "warning" : "danger";
  return <span className={`status-badge status-${level}`}>{Math.round(confidence * 100)}% confidence</span>;
}

const emailStatuses = {
  verified: { label: "Verified email", Icon: Check, color: "success" },
  risky: { label: "Risky email", Icon: ShieldAlert, color: "warning" },
  invalid: { label: "Invalid email", Icon: X, color: "danger" },
  unknown: { label: "Email unverified", Icon: CircleHelp, color: "neutral" },
  not_enriched: { label: "Not enriched", Icon: Mail, color: "neutral" },
} satisfies Record<EmailStatus, { label: string; Icon: typeof Check; color: string }>;

export function EmailStatusIcon({ status }: { status: EmailStatus }) {
  const { label, Icon, color } = emailStatuses[status];
  return <span className={`status-badge status-${color}`}><Icon size={12} aria-hidden="true" />{label}</span>;
}

export function SourceLink({ source }: { source: Citation | null }) {
  if (!source) return <span className="muted-text">—</span>;
  let safe = false;
  try { safe = ["http:", "https:"].includes(new URL(source.url).protocol); } catch { /* Unusable evidence stays non-clickable. */ }
  if (!safe) return <span className="source-link muted-text"><AlertCircle size={13} aria-hidden="true" />Source unavailable</span>;
  return <a className="source-link" href={source.url} target="_blank" rel="noopener noreferrer" title={source.snippet}><ExternalLink size={13} aria-hidden="true" /><span>{source.title || "View source"}</span><span className="sr-only"> (opens in a new tab)</span></a>;
}

export function ActorBadge({ actor }: { actor: Actor }) {
  const Icon = actor === "ai" ? Bot : UserRound;
  return <span className="status-badge status-neutral"><Icon size={12} aria-hidden="true" />{actor === "ai" ? "AI" : "Rep"}</span>;
}
