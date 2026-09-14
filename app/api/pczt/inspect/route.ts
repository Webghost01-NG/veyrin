import { NextRequest, NextResponse } from "next/server";
import { callRpc, RpcError, validateRpcUrl, zalletMethods } from "@/lib/rpc";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const maxPcztLength = 1_500_000;

function validBase64(value: unknown): value is string {
  return typeof value === "string" &&
    value.length >= 16 &&
    value.length <= maxPcztLength &&
    value.length % 4 === 0 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

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
    if (!validBase64(pczt)) {
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
      timeoutMs: 15_000
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
