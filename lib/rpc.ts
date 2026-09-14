export const networkMethods = [
  "getblockchaininfo",
  "getnetworkinfo",
  "getrawmempool",
  "getmininginfo"
] as const;

export const zalletMethods = ["pczt_inspect"] as const;

type RpcMethod = (typeof networkMethods)[number] | (typeof zalletMethods)[number];

export class RpcError extends Error {
  status: number;
  code?: number;

  constructor(message: string, status = 500, code?: number) {
    super(message);
    this.name = "RpcError";
    this.status = status;
    this.code = code;
  }
}
export function validateRpcUrl(value: string | undefined, allowLoopbackHttp = false) {
  if (!value) {
    throw new RpcError("RPC endpoint is not configured", 503);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RpcError("RPC endpoint configuration is invalid", 503);
  }

  const loopback = ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(allowLoopbackHttp && loopback)) {
    throw new RpcError("RPC endpoint must use HTTPS or loopback HTTP", 503);
  }

  return url.toString();
}

interface RpcCallOptions {
  endpoint: string;
  method: RpcMethod;
  params?: unknown[];
  allowedMethods: readonly RpcMethod[];
  auth?: { user?: string; password?: string };
  timeoutMs?: number;
}

export async function callRpc<T>({
  endpoint,
  method,
  params = [],
  allowedMethods,
  auth,
  timeoutMs = 8_000
}: RpcCallOptions): Promise<T> {
  if (!allowedMethods.includes(method)) {
    throw new RpcError("RPC method is not allowed", 400);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Veyrin/0.1"
  };

  if (auth?.user && auth.password) {
    headers.Authorization = `Basic ${Buffer.from(`${auth.user}:${auth.password}`).toString("base64")}`;
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: method, method, params }),
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new RpcError(`Upstream RPC returned HTTP ${response.status}`, 502);
    }

    const payload = (await response.json()) as {
      result?: T;
      error?: { code?: number; message?: string };
    };
    if (payload.error) {
      throw new RpcError(payload.error.message || "The RPC method failed", 502, payload.error.code);
    }
    if (!("result" in payload)) {
      throw new RpcError("The RPC response did not contain a result", 502);
    }
    return payload.result as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new RpcError("The RPC request timed out", 504);
    }
    if (error instanceof RpcError) {
      throw error;
    }
    throw new RpcError("The RPC endpoint could not be reached", 502);
  } finally {
    clearTimeout(timeout);
  }
}
