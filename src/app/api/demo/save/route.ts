// POST /api/demo/save — helper (not in the frontend contract): snapshot the current run.
import { handle } from "@/lib/http";
import { saveSnapshot } from "@/lib/snapshot";

export async function POST() {
  return handle(async () => saveSnapshot());
}
