// POST /api/demo/load — restore the saved demo snapshot (or reset fixtures in fixture mode).
import { handle, ApiError } from "@/lib/http";
import { useFixtures } from "@/lib/env";
import { loadSnapshot } from "@/lib/snapshot";
import { reset } from "@/lib/stub-store";

export const maxDuration = 60;

export async function POST() {
  return handle<{ loaded: true }>(async () => {
    if (useFixtures()) {
      reset();
      return { loaded: true };
    }
    if (!(await loadSnapshot())) throw new ApiError("NOT_FOUND", "No saved demo yet. Call POST /api/demo/save after a good run.");
    return { loaded: true };
  });
}
