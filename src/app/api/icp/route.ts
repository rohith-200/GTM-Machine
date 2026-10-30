// 1. POST /api/icp  and  2. GET /api/icp  — STUB
import type { IcpRequest, ICP } from "@/contract/types";
import { handle, readBody, requireFields, now } from "@/lib/http";
import { store, stubLog } from "@/lib/stub-store";
import { fxIcp } from "@/contract/fixtures";

export async function POST(req: Request) {
  return handle<ICP>(async () => {
    const body = await readBody<IcpRequest>(req);
    requireFields(body, ["productDescription"]);
    await new Promise((r) => setTimeout(r, 1200)); // feel like an LLM call
    const icp: ICP = { ...structuredClone(fxIcp), createdAt: now() };
    store().icp = icp;
    stubLog("icp", "Generated ICP with 3 industries and 2 personas", "success");
    return icp;
  });
}

export async function GET() {
  return handle<ICP | null>(async () => store().icp);
}
