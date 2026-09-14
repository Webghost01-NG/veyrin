import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { callRpc, networkMethods, RpcError, validateRpcUrl } from "@/lib/rpc";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface BlockchainInfo {
  chain?: string;
  blocks?: number;
  headers?: number;
  bestblockhash?: string;
  difficulty?: number;
  verificationprogress?: number;
}

interface NetworkInfo {
  subversion?: string;
  version?: number;
  protocolversion?: number;
  connections?: number;
}

interface MiningInfo {
  chain?: string;
  blocks?: number;
  networksolps?: number;
  networkhashps?: number;
}

const calls = [
  { method: "getblockchaininfo" as const, params: [] },
  { method: "getnetworkinfo" as const, params: [] },
  { method: "getrawmempool" as const, params: [false] },
  { method: "getmininginfo" as const, params: [] }
];

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
    const startedAt = performance.now();
    const settled = await Promise.allSettled(
      calls.map(({ method, params }) => {
        const callStartedAt = performance.now();
        return callRpc<unknown>({ endpoint, method, params, allowedMethods: networkMethods })
          .then((value) => ({ value, latencyMs: Math.round(performance.now() - callStartedAt) }));
      })
    );

    const evidence = settled.map((result, index) => ({
      method: calls[index].method,
      ok: result.status === "fulfilled",
      latencyMs: result.status === "fulfilled" ? result.value.latencyMs : null,
      error: result.status === "rejected" ? (result.reason as Error).message : null
    }));
    const values = Object.fromEntries(
      settled.map((result, index) => [
        calls[index].method,
        result.status === "fulfilled" ? result.value.value : null
      ])
    );

    if (evidence.every((entry) => !entry.ok)) {
      return NextResponse.json(
        { error: "No Zcash RPC method returned successfully", evidence },
        { status: 502 }
      );
    }

    const blockchain = (values.getblockchaininfo || {}) as BlockchainInfo;
    const network = (values.getnetworkinfo || {}) as NetworkInfo;
    const mining = (values.getmininginfo || {}) as MiningInfo;
    const mempool = values.getrawmempool;
    const observedAt = new Date().toISOString();
    const snapshotFingerprint = createHash("sha256").update(JSON.stringify({
      observedAt,
      height: blockchain.blocks ?? mining.blocks ?? null,
      bestBlockHash: blockchain.bestblockhash || null,
      difficulty: blockchain.difficulty ?? null,
      mempoolSize: Array.isArray(mempool) ? mempool.length : null,
      networkSolPerSecond: mining.networksolps ?? mining.networkhashps ?? null
    })).digest("hex");

    return NextResponse.json(
      {
        source: "Zcash JSON-RPC via QuickNode",
        observedAt,
        snapshotFingerprint,
        totalLatencyMs: Math.round(performance.now() - startedAt),
        chain: blockchain.chain || mining.chain || "unknown",
        height: blockchain.blocks ?? mining.blocks ?? null,
        headers: blockchain.headers ?? null,
        bestBlockHash: blockchain.bestblockhash || null,
        difficulty: blockchain.difficulty ?? null,
        syncProgress: blockchain.verificationprogress ?? null,
        nodeVersion: network.subversion || network.version || null,
        protocolVersion: network.protocolversion ?? null,
        peers: network.connections ?? null,
        mempoolSize: Array.isArray(mempool) ? mempool.length : null,
        networkSolPerSecond: mining.networksolps ?? mining.networkhashps ?? null,
        evidence
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const rpcError = error instanceof RpcError ? error : new RpcError("Unexpected server error");
    return NextResponse.json({ error: rpcError.message }, { status: rpcError.status });
  }
}
