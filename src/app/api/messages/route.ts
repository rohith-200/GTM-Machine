// 9. GET /api/messages?status= — REAL (Neo4j)
import type { NextRequest } from "next/server";
import type { Message } from "@/contract/types";
import { handle } from "@/lib/http";
import { useFixtures } from "@/lib/env";
import { loadMessages } from "@/lib/repo";
import { store } from "@/lib/stub-store";

export async function GET(req: NextRequest) {
  return handle<{ messages: Message[] }>(async () => {
    const status = req.nextUrl.searchParams.get("status");
    if (useFixtures()) {
      const all = store().messages;
      return { messages: status ? all.filter((m) => m.status === status) : all };
    }
    return { messages: await loadMessages({ status }) };
  });
}
