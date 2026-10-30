// 3. POST /api/icp/segment — STUB
import type { SegmentRequest, ICP } from "@/contract/types";
import { handle, readBody, requireFields, ApiError } from "@/lib/http";
import { store } from "@/lib/stub-store";

export async function POST(req: Request) {
  return handle<ICP>(async () => {
    const body = await readBody<SegmentRequest>(req);
    requireFields(body, ["icpId", "segmentId", "status"]);
    const icp = store().icp;
    if (!icp || icp.id !== body.icpId) throw new ApiError("NOT_FOUND", "ICP not found");
    const seg = icp.expansionSegments.find((s) => s.id === body.segmentId);
    if (!seg) throw new ApiError("NOT_FOUND", "Segment not found");
    seg.status = body.status;
    return icp;
  });
}
