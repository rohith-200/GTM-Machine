// 13a. GET /api/activity — STUB
import type { ActivityEvent } from "@/contract/types";
import { handle } from "@/lib/http";
import { store } from "@/lib/stub-store";

export async function GET() {
  return handle<{ events: ActivityEvent[] }>(async () => ({
    events: [...store().events].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 100),
  }));
}
