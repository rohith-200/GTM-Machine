// 9. GET /api/messages?status= — STUB
import type { NextRequest } from "next/server";
import type { Message, MessageStatus } from "@/contract/types";
import { handle } from "@/lib/http";
import { store } from "@/lib/stub-store";

export async function GET(req: NextRequest) {
  return handle<{ messages: Message[] }>(async () => {
    const status = req.nextUrl.searchParams.get("status") as MessageStatus | null;
    const all = [...store().messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { messages: status ? all.filter((m) => m.status === status) : all };
  });
}
