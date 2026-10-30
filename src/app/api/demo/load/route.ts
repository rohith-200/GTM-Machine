// POST /api/demo/load — STUB: resets the in-memory store to the fixtures.
// Later this loads the saved demo run into Neo4j.
import { handle } from "@/lib/http";
import { reset } from "@/lib/stub-store";

export async function POST() {
  return handle<{ loaded: true }>(async () => {
    reset();
    return { loaded: true };
  });
}
