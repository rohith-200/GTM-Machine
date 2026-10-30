// POST /api/graph/link-network — helper: re-link src/data/network.json after editing it.
import { handle } from "@/lib/http";
import { linkNetwork } from "@/lib/network";

export async function POST() {
  return handle(async () => ({ links: await linkNetwork() }));
}
