// In-memory state for the stub phase. Resets when the dev server restarts.
// Each stub route reads and writes here, so Person B sees realistic behaviour
// (approving moves the lead, dragging a card sticks, and so on).
// Real routes replace this with Neo4j one by one.
import {
  fxIcp, fxLeads, fxCompetitors, fxMessages, fxEvents, fxAgentLogs, fxWarmPaths,
} from "@/contract/fixtures";
import type {
  ICP, Lead, Competitor, Message, ActivityEvent, AgentLog, WarmPath, Actor,
} from "@/contract/types";
import { newId, now } from "./http";
import { useFixtures } from "./env";
import { logAgent, logEvent } from "./neo4j";

const clone = <T>(x: T): T => structuredClone(x);

type Store = {
  icp: ICP | null;
  leads: Lead[];
  competitors: Competitor[];
  messages: Message[];
  events: ActivityEvent[];
  logs: AgentLog[];
  warmPaths: WarmPath[];
};

const g = globalThis as unknown as { __stub?: Store };

export function store(): Store {
  if (!g.__stub) reset();
  return g.__stub!;
}

export function reset() {
  g.__stub = {
    icp: clone(fxIcp),
    leads: clone(fxLeads),
    competitors: clone(fxCompetitors),
    messages: clone(fxMessages),
    events: clone(fxEvents),
    logs: clone(fxAgentLogs),
    warmPaths: clone(fxWarmPaths),
  };
}

export function stubEvent(actor: Actor, action: string, detail: string, leadId: string | null) {
  store().events.unshift({ id: newId("ev"), leadId, actor, action, detail, timestamp: now() });
  if (!useFixtures()) void logEvent(actor, action, detail, leadId);
}

export function stubLog(step: AgentLog["step"], message: string, level: AgentLog["level"] = "info") {
  store().logs.unshift({ id: newId("log"), step, message, level, timestamp: now() });
  if (!useFixtures()) void logAgent(step, message, level);
}
