import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server.js";
import { POST } from "../app/api/pczt/inspect/route.ts";
import { maxPcztLength } from "../lib/pczt.ts";

function request(body: string, client: string, contentLength = Buffer.byteLength(body)) {
  return new NextRequest("http://localhost/api/pczt/inspect", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": String(contentLength),
      "X-Forwarded-For": client
    },
    body
  });
}

test("PCZT gateway rejects invalid JSON, malformed base64, and oversized bodies", async () => {
  const malformedJson = await POST(request("{", "198.51.100.1"));
  assert.equal(malformedJson.status, 400);
  assert.deepEqual(await malformedJson.json(), { error: "Request body must be valid JSON" });

  const malformedPczt = await POST(request(JSON.stringify({ pczt: "not base64" }), "198.51.100.2"));
  assert.equal(malformedPczt.status, 400);
  assert.deepEqual(await malformedPczt.json(), { error: "Enter a valid base64-encoded PCZT" });

  const oversized = await POST(request("{}", "198.51.100.3", maxPcztLength + 1_025));
  assert.equal(oversized.status, 413);
  assert.deepEqual(await oversized.json(), { error: "Request body is too large" });
});

test("PCZT gateway forwards only pczt_inspect with server-side authentication", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.ZALLET_RPC_URL;
  const originalUser = process.env.ZALLET_RPC_USER;
  const originalPassword = process.env.ZALLET_RPC_PASSWORD;
  const fixture = Buffer.from("PCZT public route fixture").toString("base64");
  let forwardedBody: Record<string, unknown> | undefined;
  let forwardedAuthorization = "";

  process.env.ZALLET_RPC_URL = "https://inspector.example/rpc";
  process.env.ZALLET_RPC_USER = "server-user";
  process.env.ZALLET_RPC_PASSWORD = "server-password";
  globalThis.fetch = async (_input, init) => {
    forwardedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    forwardedAuthorization = new Headers(init?.headers).get("authorization") || "";
    return Response.json({ result: { transparent: { outputs: [] } } });
  };

  try {
    const response = await POST(request(JSON.stringify({ pczt: fixture }), "198.51.100.4"));
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.method, "pczt_inspect");
    assert.deepEqual(payload.inspection, { transparent: { outputs: [] } });
    assert.deepEqual(forwardedBody, {
      jsonrpc: "2.0",
      id: "pczt_inspect",
      method: "pczt_inspect",
      params: [fixture]
    });
    assert.match(forwardedAuthorization, /^Basic /);
    assert.equal(JSON.stringify(payload).includes("server-password"), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.ZALLET_RPC_URL;
    else process.env.ZALLET_RPC_URL = originalUrl;
    if (originalUser === undefined) delete process.env.ZALLET_RPC_USER;
    else process.env.ZALLET_RPC_USER = originalUser;
    if (originalPassword === undefined) delete process.env.ZALLET_RPC_PASSWORD;
    else process.env.ZALLET_RPC_PASSWORD = originalPassword;
  }
});

test("PCZT gateway reports upstream failures without inventing inspection data", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.ZALLET_RPC_URL;
  process.env.ZALLET_RPC_URL = "https://inspector.example/rpc";
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });

  try {
    const fixture = Buffer.from("PCZT upstream failure fixture").toString("base64");
    const response = await POST(request(JSON.stringify({ pczt: fixture }), "198.51.100.5"));
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: "Upstream RPC returned HTTP 503" });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.ZALLET_RPC_URL;
    else process.env.ZALLET_RPC_URL = originalUrl;
  }
});
