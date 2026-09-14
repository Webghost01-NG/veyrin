import assert from "node:assert/strict";
import test from "node:test";
import { collectNetworkSnapshot, NetworkSnapshotError, type NetworkMethod } from "../lib/network.ts";

test("collectNetworkSnapshot preserves successful data during a partial upstream failure", async () => {
  const responses: Partial<Record<NetworkMethod, unknown>> = {
    getblockchaininfo: {
      chain: "main",
      blocks: 3_480_000,
      headers: 3_480_000,
      bestblockhash: "0000proof",
      difficulty: 123,
      verificationprogress: 1
    },
    getnetworkinfo: { subversion: "/Zebra:test/", protocolversion: 170_120, connections: 8 },
    getmininginfo: { networksolps: 99_000 }
  };
  let tick = 0;
  const snapshot = await collectNetworkSnapshot(
    async (method) => {
      if (method === "getrawmempool") throw new Error("temporary mempool failure");
      return responses[method];
    },
    () => tick++,
    () => "2026-09-14T00:00:00.000Z"
  );

  assert.equal(snapshot.height, 3_480_000);
  assert.equal(snapshot.nodeVersion, "/Zebra:test/");
  assert.equal(snapshot.mempoolSize, null);
  assert.equal(snapshot.evidence.filter((entry) => entry.ok).length, 3);
  assert.equal(snapshot.evidence.find((entry) => entry.method === "getrawmempool")?.error, "temporary mempool failure");
  assert.match(snapshot.snapshotFingerprint, /^[0-9a-f]{64}$/);
});

test("collectNetworkSnapshot rejects when every RPC call fails", async () => {
  await assert.rejects(
    collectNetworkSnapshot(async () => { throw new Error("offline"); }),
    (error) => error instanceof NetworkSnapshotError && error.evidence.length === 4
  );
});
