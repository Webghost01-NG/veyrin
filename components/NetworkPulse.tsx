"use client";

import { useCallback, useEffect, useState } from "react";

interface Evidence {
  method: string;
  ok: boolean;
  latencyMs: number | null;
  error: string | null;
}

interface NetworkData {
  source: string;
  observedAt: string;
  snapshotFingerprint: string;
  totalLatencyMs: number;
  chain: string;
  height: number | null;
  bestBlockHash: string | null;
  difficulty: number | null;
  syncProgress: number | null;
  nodeVersion: string | number | null;
  protocolVersion: number | null;
  peers: number | null;
  mempoolSize: number | null;
  networkSolPerSecond: number | null;
  evidence: Evidence[];
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("en");

function value<T>(input: T | null, format: (entry: T) => string = String) {
  return input === null ? "—" : format(input);
}

export function NetworkPulse() {
  const [data, setData] = useState<NetworkData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/network", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Live network data is unavailable");
      setData(payload as NetworkData);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Live network data is unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  return (
    <section className="network-section" id="network" aria-labelledby="network-title">
      <div className="section-intro">
        <div>
          <span className="section-index">01 / NETWORK WITNESS</span>
          <h2 id="network-title">Proof that the network<br />is coming through.</h2>
        </div>
        <button className="text-button" onClick={() => void refresh()} disabled={loading}>
          {loading ? "Observing…" : "Refresh evidence ↗"}
        </button>
      </div>

      <div className="witness-line">
        <span className={`live-mark ${error ? "is-error" : ""}`} />
        <span>{error ? "RPC unavailable" : data ? `Live ${data.chain} observation` : "Connecting to Zcash"}</span>
        <code title={data?.bestBlockHash || ""}>{data?.bestBlockHash || "Awaiting best block hash"}</code>
        <span>{data ? `${data.totalLatencyMs} ms` : "—"}</span>
      </div>

      <div className="metric-stage">
        <article className="height-feature">
          <span>BLOCK HEIGHT</span>
          <strong>{data ? value(data.height, integer.format) : "—"}</strong>
          <small>{data?.observedAt ? `Observed ${new Date(data.observedAt).toLocaleTimeString()}` : "Live RPC measurement"}</small>
        </article>
        <div className="metric-list">
          <div><span>Difficulty</span><strong>{data ? value(data.difficulty, compact.format) : "—"}</strong></div>
          <div><span>Mempool</span><strong>{data ? value(data.mempoolSize, integer.format) : "—"}</strong></div>
          <div><span>Network Sol/s</span><strong>{data ? value(data.networkSolPerSecond, compact.format) : "—"}</strong></div>
          <div><span>Peers</span><strong>{data ? value(data.peers, integer.format) : "—"}</strong></div>
          <div className="metric-wide"><span>Node</span><strong>{data ? value(data.nodeVersion) : "—"}</strong></div>
          <div><span>Verified</span><strong>{data?.syncProgress !== null && data?.syncProgress !== undefined ? `${(data.syncProgress * 100).toFixed(4)}%` : "—"}</strong></div>
        </div>
      </div>

      {error && <p className="error-message" role="status">{error}</p>}

      <div className="rpc-flight-recorder">
        <div className="recorder-heading"><span>RPC FLIGHT RECORDER</span><span>METHOD / STATUS / LATENCY</span></div>
        {(data?.evidence || [
          { method: "getblockchaininfo", ok: false, latencyMs: null, error: null },
          { method: "getnetworkinfo", ok: false, latencyMs: null, error: null },
          { method: "getrawmempool", ok: false, latencyMs: null, error: null },
          { method: "getmininginfo", ok: false, latencyMs: null, error: null }
        ]).map((entry) => (
          <div className="recorder-row" key={entry.method}>
            <code>{entry.method}</code>
            <span className={entry.ok ? "status-ok" : loading ? "status-wait" : "status-fail"}>
              {entry.ok ? "RESPONSE VERIFIED" : loading ? "PENDING" : "FAILED"}
            </span>
            <span>{entry.latencyMs === null ? "—" : `${entry.latencyMs} ms`}</span>
          </div>
        ))}
        {data?.snapshotFingerprint && (
          <div className="snapshot-seal">
            <span>SNAPSHOT SHA-256</span>
            <code title={data.snapshotFingerprint}>{data.snapshotFingerprint}</code>
          </div>
        )}
      </div>
    </section>
  );
}
