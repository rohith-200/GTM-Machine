// Sample data that matches the frozen contract exactly.
// Stub routes return these. Later, real routes fall back to them when USE_FIXTURES=true.
import type {
  ICP, Lead, Competitor, Message, ActivityEvent, AgentLog, WarmPath, Analytics,
} from "./types";

export const fxIcp: ICP = {
  id: "icp_01",
  productSummary: "Automated invoice reconciliation for finance teams of 5 to 50 people.",
  industries: { value: ["Logistics", "Wholesale Distribution", "Manufacturing"], confidence: 0.82 },
  companySize: { value: { minEmployees: 200, maxEmployees: 2000, revenueBand: "$50M-$500M" }, confidence: 0.74 },
  personas: {
    value: [
      { title: "VP Finance", seniority: "vp", department: "Finance" },
      { title: "Controller", seniority: "director", department: "Finance" },
    ],
    confidence: 0.88,
  },
  triggerEvents: { value: ["New CFO hired", "Hiring AP clerks", "ERP migration"], confidence: 0.69 },
  regions: { value: ["United States", "Canada"], confidence: 0.6 },
  negativeSignals: ["Hiring freeze", "Under 50 employees"],
  expansionSegments: [
    {
      id: "seg_01",
      name: "Healthcare billing teams",
      rationale: "High invoice volume and manual reconciliation, same pain as logistics.",
      evidence: [{ url: "https://example.com/healthcare-ap", title: "AP automation in healthcare", snippet: "Healthcare AP teams process thousands of invoices monthly..." }],
      status: "suggested",
    },
    {
      id: "seg_02",
      name: "Construction subcontractor payables",
      rationale: "Many small vendors and change orders make reconciliation slow.",
      evidence: [{ url: "https://example.com/construction-payables", title: "Construction payables survey", snippet: "Contractors report reconciliation as a top back-office pain..." }],
      status: "suggested",
    },
  ],
  createdAt: "2026-10-30T11:42:00Z",
};

export const fxLeads: Lead[] = [
  {
    id: "lead_01",
    company: {
      id: "co_01",
      name: "Acme Freight",
      domain: "acmefreight.com",
      industry: "Logistics",
      employeeCount: 650,
      hqLocation: "Chicago, IL",
      signals: [
        {
          id: "sig_01",
          type: "exec_hire",
          description: "Appointed a new CFO in September 2026",
          date: "2026-09-14",
          source: { url: "https://acmefreight.com/news/new-cfo", title: "Acme Freight names new CFO", snippet: "Acme Freight today announced..." },
        },
        {
          id: "sig_02",
          type: "hiring",
          description: "Hiring 3 accounts payable specialists",
          date: "2026-10-02",
          source: { url: "https://acmefreight.com/careers", title: "Careers at Acme Freight", snippet: "Accounts Payable Specialist (3 openings)..." },
        },
      ],
      sources: [{ url: "https://acmefreight.com/about", title: "About Acme Freight", snippet: "Acme Freight is a mid-size carrier..." }],
    },
    person: {
      id: "pe_01",
      name: "Jordan Lee",
      title: "VP Finance",
      companyId: "co_01",
      linkedinUrl: null,
      email: null,
      emailStatus: "not_enriched",
      emailConfidence: null,
      source: { url: "https://acmefreight.com/leadership", title: "Leadership team", snippet: "Jordan Lee, VP Finance..." },
    },
    stage: "matched",
    fitScore: 86,
    tier: "A",
    fitReason: "Logistics, 650 employees, new CFO in the last 60 days.",
    lastActor: "ai",
    updatedAt: "2026-10-30T11:55:00Z",
  },
  {
    id: "lead_02",
    company: {
      id: "co_02",
      name: "Northline Distributors",
      domain: "northline.example",
      industry: "Wholesale Distribution",
      employeeCount: 420,
      hqLocation: "Toronto, ON",
      signals: [
        {
          id: "sig_03",
          type: "tech_change",
          description: "Migrating to a new ERP in Q1 2027",
          date: "2026-08-21",
          source: { url: "https://northline.example/press/erp", title: "Northline selects new ERP", snippet: "Northline will move its finance stack..." },
        },
      ],
      sources: [{ url: "https://northline.example/about", title: "About Northline", snippet: "Northline distributes industrial supplies..." }],
    },
    person: {
      id: "pe_02",
      name: "Priya Raman",
      title: "Controller",
      companyId: "co_02",
      linkedinUrl: "https://www.linkedin.com/in/example-priya",
      email: "priya.raman@northline.example",
      emailStatus: "verified",
      emailConfidence: 91,
      source: { url: "https://northline.example/team", title: "Our team", snippet: "Priya Raman, Controller..." },
    },
    stage: "contacted",
    fitScore: 68,
    tier: "B",
    fitReason: "Distribution, 420 employees, ERP migration planned.",
    lastActor: "rep",
    updatedAt: "2026-10-30T12:20:00Z",
  },
  {
    id: "lead_03",
    company: {
      id: "co_03",
      name: "Brightway Plastics",
      domain: "brightway.example",
      industry: "Manufacturing",
      employeeCount: null,
      hqLocation: null,
      signals: [],
      sources: [{ url: "https://brightway.example", title: "Brightway Plastics", snippet: "Custom injection molding..." }],
    },
    person: {
      id: "pe_03",
      name: "Sam Ortiz",
      title: "Finance Manager",
      companyId: "co_03",
      linkedinUrl: null,
      email: null,
      emailStatus: "unknown",
      emailConfidence: null,
      source: { url: "https://brightway.example/contact", title: "Contact Brightway", snippet: "Sam Ortiz, Finance Manager..." },
    },
    stage: "matched",
    fitScore: 44,
    tier: "C",
    fitReason: "Manufacturing fit, but size unknown and no recent signals.",
    lastActor: "ai",
    updatedAt: "2026-10-30T11:56:00Z",
  },
];

export const fxCompetitors: Competitor[] = [
  {
    id: "cmp_01",
    name: "ReconBot",
    website: "https://reconbot.example",
    category: "direct",
    positioning: "Reconciliation for enterprise ERP users",
    pricing: "From $3,000 per month",
    differentiators: ["We target mid-market", "We are about 2x cheaper"],
    sources: [{ url: "https://reconbot.example/pricing", title: "ReconBot pricing", snippet: "Plans start at..." }],
  },
  {
    id: "cmp_02",
    name: "Spreadsheets + manual review",
    website: "https://example.com/manual",
    category: "alternative",
    positioning: "The status quo for most mid-size finance teams",
    pricing: null,
    differentiators: ["Saves 20+ hours per month", "Fewer missed duplicates"],
    sources: [{ url: "https://example.com/manual", title: "State of AP 2026", snippet: "Most teams still reconcile in spreadsheets..." }],
  },
];

export const fxMessages: Message[] = [
  {
    id: "msg_01",
    leadId: "lead_01",
    channel: "email",
    subject: "Congrats on the new CFO, Jordan",
    body: "Hi Jordan,\n\nSaw Acme Freight brought on a new CFO in September. New finance leaders often look hard at close speed, and reconciliation is usually the slowest part.\n\nWe help logistics finance teams cut reconciliation time by half. Worth a 15-minute look next week?\n\nBest,\nSam",
    signalUsed: "Appointed a new CFO in September 2026",
    status: "pending_approval",
    editedByRep: false,
    createdAt: "2026-10-30T12:40:00Z",
    sentAt: null,
  },
  {
    id: "msg_02",
    leadId: "lead_01",
    channel: "linkedin",
    subject: null,
    body: "Hi Jordan, congrats on the new finance leadership at Acme. I work with logistics finance teams on faster reconciliation and would love to connect.",
    signalUsed: "Appointed a new CFO in September 2026",
    status: "pending_approval",
    editedByRep: false,
    createdAt: "2026-10-30T12:40:00Z",
    sentAt: null,
  },
  {
    id: "msg_03",
    leadId: "lead_02",
    channel: "email",
    subject: "Before the ERP move at Northline",
    body: "Hi Priya,\n\nNoticed Northline is moving to a new ERP. Teams that clean up reconciliation before a migration usually avoid weeks of rework.\n\nOpen to a quick call?\n\nBest,\nSam",
    signalUsed: "Migrating to a new ERP in Q1 2027",
    status: "sent",
    editedByRep: true,
    createdAt: "2026-10-30T12:10:00Z",
    sentAt: "2026-10-30T12:20:00Z",
  },
];

export const fxEvents: ActivityEvent[] = [
  { id: "ev_03", leadId: "lead_02", actor: "rep", action: "message_sent", detail: "Email sent to priya.raman@northline.example via One (Gmail)", timestamp: "2026-10-30T12:20:00Z" },
  { id: "ev_02", leadId: "lead_02", actor: "rep", action: "message_edited", detail: "Rep edited the subject line before approving", timestamp: "2026-10-30T12:18:00Z" },
  { id: "ev_01", leadId: null, actor: "ai", action: "leads_discovered", detail: "Discovered 3 leads from 14 sources", timestamp: "2026-10-30T11:55:00Z" },
];

export const fxAgentLogs: AgentLog[] = [
  { id: "log_05", step: "graph", message: "Wrote 3 companies, 3 people, 3 signals to Neo4j", level: "success", timestamp: "2026-10-30T11:55:00Z" },
  { id: "log_04", step: "discover", message: "Scored leads: 1 Tier A, 1 Tier B, 1 Tier C", level: "info", timestamp: "2026-10-30T11:54:40Z" },
  { id: "log_03", step: "discover", message: "Dropped 2 companies matching negative signals", level: "warn", timestamp: "2026-10-30T11:54:10Z" },
  { id: "log_02", step: "discover", message: "Searching Tavily: logistics companies new CFO 2026", level: "info", timestamp: "2026-10-30T11:51:02Z" },
  { id: "log_01", step: "icp", message: "Generated ICP with 3 industries and 2 personas", level: "success", timestamp: "2026-10-30T11:42:00Z" },
];

export const fxWarmPaths: WarmPath[] = [
  {
    leadId: "lead_01",
    description: "Jordan Lee previously worked at Northwind with Priya Shah, who is in your network.",
    hops: [
      { name: "Jordan Lee", type: "Person" },
      { name: "Northwind", type: "Company" },
      { name: "Priya Shah", type: "Person" },
    ],
  },
];

export const fxAnalytics: Analytics = {
  stageCounts: { matched: 2, contacted: 1, replied: 0, meeting_booked: 0, closed_won: 0, closed_lost: 0 },
  conversion: [
    { from: "matched", to: "contacted", rate: 0.33 },
    { from: "contacted", to: "replied", rate: 0 },
    { from: "replied", to: "meeting_booked", rate: 0 },
    { from: "meeting_booked", to: "closed_won", rate: 0 },
  ],
  byTier: [
    { tier: "A", leads: 1, contacted: 0, replied: 0 },
    { tier: "B", leads: 1, contacted: 1, replied: 0 },
    { tier: "C", leads: 1, contacted: 0, replied: 0 },
  ],
  actions: { ai: 6, rep: 2 },
  messages: { drafted: 3, approved: 1, rejected: 0, sent: 1 },
};
