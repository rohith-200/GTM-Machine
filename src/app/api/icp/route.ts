// 1. POST /api/icp  and  2. GET /api/icp  — REAL (Nebius + Tavily + Neo4j)
import type { IcpRequest, ICP } from "@/contract/types";
import { handle, readBody, requireFields, now } from "@/lib/http";
import { useFixtures as fixturesEnabled } from "@/lib/env";
import { generateIcp, loadIcp } from "@/lib/icp";
import { store } from "@/lib/stub-store";
import { fxIcp } from "@/contract/fixtures";

export const maxDuration = 60;

export async function POST(req: Request) {
  return handle<ICP>(async () => {
    const body = await readBody<IcpRequest>(req);
    requireFields(body, ["productDescription"]);
    if (fixturesEnabled()) {
      const icp = { ...structuredClone(fxIcp), createdAt: now() };
      store().icp = icp;
      return icp;
    }
    return generateIcp({
      productDescription: body.productDescription,
      customers: body.customers ?? "",
      pricing: body.pricing ?? "",
    });
  });
}

export async function GET() {
  return handle<ICP | null>(async () => (fixturesEnabled() ? store().icp : loadIcp()));
}
