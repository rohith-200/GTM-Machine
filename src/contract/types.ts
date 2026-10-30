// FROZEN CONTRACT — agreed at 11:20. Do not rename, remove or retype anything.

// ---------- Envelope ----------
export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

// ---------- Primitives ----------
export type Stage =
  | "matched" | "contacted" | "replied"
  | "meeting_booked" | "closed_won" | "closed_lost";
export type Tier = "A" | "B" | "C";
export type Actor = "ai" | "rep";
export type EmailStatus = "verified" | "risky" | "invalid" | "unknown" | "not_enriched";
export type MessageStatus = "pending_approval" | "approved" | "rejected" | "sent" | "failed";
export type SignalType = "funding" | "hiring" | "exec_hire" | "tech_change" | "expansion" | "other";

export interface Citation {
  url: string;
  title: string;
  snippet: string;
}

export interface Field<T> {
  value: T;
  confidence: number; // 0.00 - 1.00
}

// ---------- ICP ----------
export interface Persona {
  title: string;
  seniority: "c_level" | "vp" | "director" | "manager" | "ic";
  department: string;
}

export interface ExpansionSegment {
  id: string;
  name: string;
  rationale: string;
  evidence: Citation[];
  status: "suggested" | "accepted" | "dismissed";
}

export interface ICP {
  id: string;
  productSummary: string;
  industries: Field<string[]>;
  companySize: Field<{ minEmployees: number; maxEmployees: number; revenueBand: string }>;
  personas: Field<Persona[]>;
  triggerEvents: Field<string[]>;
  regions: Field<string[]>;
  negativeSignals: string[];
  expansionSegments: ExpansionSegment[];
  createdAt: string;
}

// ---------- Discovery ----------
export interface Signal {
  id: string;
  type: SignalType;
  description: string;
  date: string | null;
  source: Citation;
}

export interface Company {
  id: string;
  name: string;
  domain: string;
  industry: string;
  employeeCount: number | null;
  hqLocation: string | null;
  signals: Signal[];
  sources: Citation[];
}

export interface Person {
  id: string;
  name: string;
  title: string;
  companyId: string;
  linkedinUrl: string | null;
  email: string | null;
  emailStatus: EmailStatus;
  emailConfidence: number | null; // 0 - 100 from Hunter
  source: Citation;
}

export interface Lead {
  id: string;
  company: Company;
  person: Person;
  stage: Stage;
  fitScore: number; // 0 - 100
  tier: Tier;
  fitReason: string;
  lastActor: Actor;
  updatedAt: string;
}

export interface Competitor {
  id: string;
  name: string;
  website: string;
  category: "direct" | "indirect" | "alternative";
  positioning: string;
  pricing: string | null;
  differentiators: string[];
  sources: Citation[];
}

// ---------- Outreach ----------
export interface Message {
  id: string;
  leadId: string;
  channel: "email" | "linkedin";
  subject: string | null; // null for linkedin
  body: string;
  signalUsed: string;
  status: MessageStatus;
  editedByRep: boolean;
  createdAt: string;
  sentAt: string | null;
}

// ---------- Tracking ----------
export interface ActivityEvent {
  id: string;
  leadId: string | null;
  actor: Actor;
  action: string; // e.g. "stage_changed", "message_sent"
  detail: string;
  timestamp: string;
}

export interface AgentLog {
  id: string;
  step: "icp" | "discover" | "graph" | "enrich" | "draft" | "send";
  message: string;
  level: "info" | "success" | "warn" | "error";
  timestamp: string;
}

export interface WarmPath {
  leadId: string;
  description: string;
  hops: { name: string; type: "Person" | "Company" }[];
}

export interface Analytics {
  stageCounts: Record<Stage, number>;
  conversion: { from: Stage; to: Stage; rate: number }[]; // rate 0.00 - 1.00
  byTier: { tier: Tier; leads: number; contacted: number; replied: number }[];
  actions: { ai: number; rep: number };
  messages: { drafted: number; approved: number; rejected: number; sent: number };
}

// ---------- Request bodies (frozen too) ----------
export interface IcpRequest { productDescription: string; customers: string; pricing: string }
export interface SegmentRequest { icpId: string; segmentId: string; status: ExpansionSegment["status"] }
export interface DiscoverRequest { icpId: string }
export interface LeadIdsRequest { leadIds: string[] }
export interface ReviewRequest {
  messageId: string;
  action: "approve" | "edit" | "reject";
  subject: string | null;
  body: string | null;
}
export interface StageRequest { leadId: string; stage: Stage }
