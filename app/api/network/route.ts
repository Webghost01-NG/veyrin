import { NextRequest, NextResponse } from "next/server";
import { fetchNetworkSnapshot, NetworkSnapshotError } from "@/lib/network";
import { checkRateLimit } from "@/lib/rate-limit";
import { RpcError, validateRpcUrl } from "@/lib/rpc";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(request, "network", 30, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many network refreshes; retry shortly" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }

    const endpoint = validateRpcUrl(process.env.QUICKNODE_ZCASH_URL);
    const snapshot = await fetchNetworkSnapshot(endpoint);
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof NetworkSnapshotError) {
      return NextResponse.json(
        { error: error.message, evidence: error.evidence },
        { status: error.status }
      );
    }
    const rpcError = error instanceof RpcError ? error : new RpcError("Unexpected server error");
    return NextResponse.json({ error: rpcError.message }, { status: rpcError.status });
  }
}
