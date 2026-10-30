import type { Lead, Stage } from "@/contract/types";

export function mergeLeadUpdates(current: Lead[], updates: Lead[]): Lead[] {
  const byId = new Map(updates.map(lead => [lead.id, lead]));
  return current.map(lead => byId.get(lead.id) ?? lead).sort((a, b) => b.fitScore - a.fitScore);
}

export const stageLabels: Record<Stage, string> = {
  matched: "Matched", contacted: "Contacted", replied: "Replied", meeting_booked: "Meeting booked", closed_won: "Closed won", closed_lost: "Closed lost",
};

export function formatSignalDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}
