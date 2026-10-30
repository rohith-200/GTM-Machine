// 3. POST /api/icp/segment — REAL (Neo4j)
import type { SegmentRequest, ICP } from "@/contract/types";
import { handle, readBody, requireFields, ApiError } from "@/lib/http";
import { useFixtures } from "@/lib/env";
import { loadIcp, saveIcp } from "@/lib/icp";
import { logEvent } from "@/lib/neo4j";
import { store } from "@/lib/stub-store";

const STATUSES = ["suggested", "accepted", "dismissed"];

export async function POST(req: Request) {
  return handle<ICP>(async () => {
    const body = await readBody<SegmentRequest>(req);
    requireFields(body, ["icpId", "segmentId", "status"]);
    if (!STATUSES.includes(body.status)) throw new ApiError("BAD_REQUEST", "status must be suggested, accepted or dismissed");

    const icp = useFixtures() ? store().icp : await loadIcp(body.icpId);
    if (!icp || icp.id !== body.icpId) throw new ApiError("NOT_FOUND", "ICP not found");
    const seg = icp.expansionSegments.find((s) => s.id === body.segmentId);
    if (!seg) throw new ApiError("NOT_FOUND", "Segment not found");
    seg.status = body.status;

    if (!useFixtures()) {
      await saveIcp(icp);
      await logEvent("rep", `segment_${body.status}`, `Expansion segment "${seg.name}" ${body.status}`, null);
    }
    return icp;
  });
}
