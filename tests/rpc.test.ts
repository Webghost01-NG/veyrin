import assert from "node:assert/strict";
import test from "node:test";
import { callRpc, networkMethods, RpcError, validateRpcUrl } from "../lib/rpc.ts";

test("validateRpcUrl requires HTTPS except for explicit loopback", () => {
  assert.equal(validateRpcUrl("https://example.com/rpc"), "https://example.com/rpc");
  assert.equal(validateRpcUrl("http://127.0.0.1:28232", true), "http://127.0.0.1:28232/");
  assert.throws(() => validateRpcUrl("http://example.com/rpc", true), RpcError);
  assert.throws(() => validateRpcUrl("file:///tmp/socket"), RpcError);
});

test("callRpc rejects a method outside its allowlist before making a request", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error("fetch must not run");
  };
  try {
    await assert.rejects(
      callRpc({
        endpoint: "https://example.com/rpc",
        method: "sendrawtransaction" as never,
        allowedMethods: networkMethods
      }),
      /RPC method is not allowed/
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("callRpc returns a result and normalizes upstream JSON-RPC errors", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ result: { blocks: 42 } }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    assert.deepEqual(await callRpc({
      endpoint: "https://example.com/rpc",
      method: "getblockchaininfo",
      allowedMethods: networkMethods
    }), { blocks: 42 });

    globalThis.fetch = async () => new Response(JSON.stringify({
      error: { code: -32601, message: "Method not found" }
    }), { status: 200, headers: { "Content-Type": "application/json" } });
    await assert.rejects(
      callRpc({
        endpoint: "https://example.com/rpc",
        method: "getnetworkinfo",
        allowedMethods: networkMethods
      }),
      /Method not found/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
