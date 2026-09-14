import { createHash } from "node:crypto";
import { callRpc, networkMethods, RpcError } from "./rpc.ts";

export type NetworkMethod = (typeof networkMethods)[number];

export interface RpcEvidence {
  method: NetworkMethod;
  ok: boolean;
  latencyMs: number | null;
  error: string | null;
}

export interface NetworkSnapshot {
  source: string;
  observedAt: string;
  snapshotFingerprint: string;
  totalLatencyMs: number;
  chain: string;
  height: number | null;
  headers: number | null;
  bestBlockHash: string | null;
  difficulty: number | null;
  syncProgress: number | null;
  nodeVersion: string | number | null;
  protocolVersion: number | null;
  peers: number | null;
  mempoolSize: number | null;
  networkSolPerSecond: number | null;
  evidence: RpcEvidence[];
}

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

type RpcRunner = (method: NetworkMethod, params: unknown[]) => Promise<unknown>;

const calls: ReadonlyArray<{ method: NetworkMethod; params: unknown[] }> = [
  { method: "getblockchaininfo", params: [] },
  { method: "getnetworkinfo", params: [] },
  { method: "getrawmempool", params: [false] },
  { method: "getmininginfo", params: [] }
];

export class NetworkSnapshotError extends RpcError {
  evidence: RpcEvidence[];

  constructor(evidence: RpcEvidence[]) {
    super("No Zcash RPC method returned successfully", 502);
    this.evidence = evidence;
  }
}

export async function collectNetworkSnapshot(
  runRpc: RpcRunner,
  now = () => performance.now(),
  observedAt = () => new Date().toISOString()
): Promise<NetworkSnapshot> {
  const startedAt = now();
  const settled = await Promise.allSettled(
    calls.map(({ method, params }) => {
      const callStartedAt = now();
      return runRpc(method, params).then((value) => ({ value, latencyMs: Math.round(now() - callStartedAt) }));
    })
  );

  const evidence = settled.map((result, index): RpcEvidence => ({
    method: calls[index].method,
    ok: result.status === "fulfilled",
    latencyMs: result.status === "fulfilled" ? result.value.latencyMs : null,
    error: result.status === "rejected"
      ? result.reason instanceof Error ? result.reason.message : "RPC call failed"
      : null
  }));

  if (evidence.every((entry) => !entry.ok)) {
    throw new NetworkSnapshotError(evidence);
  }

  const values = Object.fromEntries(
    settled.map((result, index) => [
      calls[index].method,
      result.status === "fulfilled" ? result.value.value : null
    ])
  );
  const blockchain = (values.getblockchaininfo || {}) as BlockchainInfo;
  const network = (values.getnetworkinfo || {}) as NetworkInfo;
  const mining = (values.getmininginfo || {}) as MiningInfo;
  const mempool = values.getrawmempool;
  const timestamp = observedAt();
  const height = blockchain.blocks ?? mining.blocks ?? null;
  const bestBlockHash = blockchain.bestblockhash || null;
  const difficulty = blockchain.difficulty ?? null;
  const mempoolSize = Array.isArray(mempool) ? mempool.length : null;
  const networkSolPerSecond = mining.networksolps ?? mining.networkhashps ?? null;
  const snapshotFingerprint = createHash("sha256").update(JSON.stringify({
    observedAt: timestamp,
    height,
    bestBlockHash,
    difficulty,
    mempoolSize,
    networkSolPerSecond
  })).digest("hex");

  return {
    source: "Zcash JSON-RPC via QuickNode",
    observedAt: timestamp,
    snapshotFingerprint,
    totalLatencyMs: Math.round(now() - startedAt),
    chain: blockchain.chain || mining.chain || "unknown",
    height,
    headers: blockchain.headers ?? null,
    bestBlockHash,
    difficulty,
    syncProgress: blockchain.verificationprogress ?? null,
    nodeVersion: network.subversion || network.version || null,
    protocolVersion: network.protocolversion ?? null,
    peers: network.connections ?? null,
    mempoolSize,
    networkSolPerSecond,
    evidence
  };
}

export function fetchNetworkSnapshot(endpoint: string) {
  return collectNetworkSnapshot((method, params) =>
    callRpc<unknown>({ endpoint, method, params, allowedMethods: networkMethods, timeoutMs: 15_000 })
  );
}
