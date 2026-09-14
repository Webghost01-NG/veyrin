import { NextRequest, NextResponse } from "next/server.js";
import { callRpc, RpcError, validateRpcUrl, zalletMethods } from "../../../../lib/rpc.ts";
import { checkRateLimit } from "../../../../lib/rate-limit.ts";
import { maxPcztLength, validPcztBase64 } from "../../../../lib/pczt.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(request, "pczt", 12, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many inspections; retry shortly" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > maxPcztLength + 1_024) {
      throw new RpcError("Request body is too large", 413);
    }

    const body = (await request.json()) as { pczt?: unknown };
    const pczt = typeof body.pczt === "string" ? body.pczt.trim() : body.pczt;
    if (!validPcztBase64(pczt)) {
      throw new RpcError("Enter a valid base64-encoded PCZT", 400);
    }

    const endpoint = validateRpcUrl(process.env.ZALLET_RPC_URL, true);
    const inspection = await callRpc<unknown>({
      endpoint,
      method: "pczt_inspect",
      params: [pczt],
      allowedMethods: zalletMethods,
      auth: {
        user: process.env.ZALLET_RPC_USER,
        password: process.env.ZALLET_RPC_PASSWORD
      },
      timeoutMs: 45_000
    });

    return NextResponse.json({
      method: "pczt_inspect",
      inspectedAt: new Date().toISOString(),
      inspection
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }
    const rpcError = error instanceof RpcError ? error : new RpcError("Unexpected server error");
    return NextResponse.json({ error: rpcError.message }, { status: rpcError.status });
  }
}
