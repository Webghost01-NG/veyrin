"use client";

import { FormEvent, useMemo, useState } from "react";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

interface InspectionPayload {
  method: string;
  inspectedAt: string;
  inspection: JsonValue;
}

interface Finding {
  path: string;
  value: string;
}

// Public canonical vector published by AngryDavee/pczt-interop. It contains an
// empty v5 transaction and no key material; it exists only to verify decoding.
const publicEmptyVector = "UENaVAEAAAAFis6ctQK0oduWDAAAhQGDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

function flatten(value: JsonValue, path: string[] = [], result: Finding[] = []): Finding[] {
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, [...path, String(index)], result));
  } else if (value !== null && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => flatten(item, [...path, key], result));
  } else {
    result.push({ path: path.join(" / "), value: String(value) });
  }
  return result;
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value.trim());
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function inspect(pczt: string): Promise<InspectionPayload> {
  const response = await fetch("/api/pczt/inspect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pczt: pczt.trim() })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "PCZT inspection failed");
  return payload as InspectionPayload;
}

export function PcztLab() {
  const [mode, setMode] = useState<"inspect" | "compare">("inspect");
  const [primary, setPrimary] = useState("");
  const [returned, setReturned] = useState("");
  const [result, setResult] = useState<InspectionPayload | null>(null);
  const [comparison, setComparison] = useState<InspectionPayload | null>(null);
  const [fingerprints, setFingerprints] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const findings = useMemo(() => result ? flatten(result.inspection).filter((entry) =>
    /(fee|value|amount|address|recipient|memo|privacy|proof|signature|signed|pool|input|output)/i.test(entry.path)
  ).slice(0, 24) : [], [result]);

  const changes = useMemo(() => {
    if (!result || !comparison) return [];
    const before = new Map(flatten(result.inspection).map((entry) => [entry.path, entry.value]));
    const after = new Map(flatten(comparison.inspection).map((entry) => [entry.path, entry.value]));
    return [...new Set([...before.keys(), ...after.keys()])]
      .filter((path) => before.get(path) !== after.get(path))
      .map((path) => ({ path, before: before.get(path) || "∅", after: after.get(path) || "∅" }));
  }, [result, comparison]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (!primary.trim()) throw new Error("Paste the PCZT you expect to sign.");
      if (mode === "compare" && !returned.trim()) throw new Error("Paste the returned PCZT to compare.");
      const [first, second, firstHash, secondHash] = await Promise.all([
        inspect(primary),
        mode === "compare" ? inspect(returned) : Promise.resolve(null),
        digest(primary),
        mode === "compare" ? digest(returned) : Promise.resolve("")
      ]);
      setResult(first);
      setComparison(second);
      setFingerprints([firstHash, secondHash].filter(Boolean));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Inspection failed");
    } finally {
      setLoading(false);
    }
  }

  const privacyPolicy = findings.find((entry) => /privacy.*policy/i.test(entry.path));
  const dangerousPolicy = privacyPolicy && ["NoPrivacy", "AllowFullyTransparent"].includes(privacyPolicy.value);

  return (
    <section className="lab-section" id="lab" aria-labelledby="lab-title">
      <div className="section-intro light-intro">
        <div>
          <span className="section-index">02 / INTENT LAB</span>
          <h2 id="lab-title">Make the invisible<br /><em>reviewable.</em></h2>
        </div>
        <p>Veyrin does not sign. It exposes the human intent recorded inside a PCZT, then lets you compare what left your hands with what came back.</p>
      </div>

      <div className="lab-shell">
        <div className="lab-tabs" role="tablist" aria-label="PCZT tools">
          <button className={mode === "inspect" ? "active" : ""} onClick={() => setMode("inspect")} type="button">Inspect</button>
          <button className={mode === "compare" ? "active" : ""} onClick={() => setMode("compare")} type="button">Compare mutations</button>
          <span>NO SIGNING AUTHORITY</span>
        </div>

        <form className="lab-form" onSubmit={submit}>
          <div className="sample-line">
            <button type="button" onClick={() => { setPrimary(publicEmptyVector); setMode("inspect"); }}>
              Load public PCZT vector
            </button>
            <a href="https://github.com/AngryDavee/pczt-interop/blob/main/vectors/empty_v5.json" target="_blank" rel="noreferrer">View provenance ↗</a>
          </div>
          <label>
            <span>{mode === "compare" ? "01 / EXPECTED PCZT" : "BASE64 PCZT"}</span>
            <textarea value={primary} onChange={(event) => setPrimary(event.target.value)} placeholder="Paste the transaction envelope…" rows={7} spellCheck={false} />
            <small>{primary.trim().length.toLocaleString()} characters</small>
          </label>
          {mode === "compare" && (
            <label>
              <span>02 / RETURNED PCZT</span>
              <textarea value={returned} onChange={(event) => setReturned(event.target.value)} placeholder="Paste the version returned by another party…" rows={7} spellCheck={false} />
              <small>{returned.trim().length.toLocaleString()} characters</small>
            </label>
          )}
          <button className="primary-action" disabled={loading} type="submit">
            <span>{loading ? "Separating intent…" : mode === "compare" ? "Reveal every mutation" : "Reveal transaction intent"}</span>
            <span>↗</span>
          </button>
          {error && <p className="lab-error" role="alert">{error}</p>}
        </form>

        <div className="lab-output" aria-live="polite">
          {!result ? (
            <div className="empty-state">
              <div className="intent-rings"><i /><i /><i /></div>
              <span>AWAITING ENVELOPE</span>
              <p>Recipients, values, fees, privacy policy and proof/signature state will resolve here.</p>
            </div>
          ) : (
            <>
              <div className={`verdict ${dangerousPolicy ? "danger" : ""}`}>
                <span>{dangerousPolicy ? "PRIVACY ALERT" : mode === "compare" ? "MUTATION VERDICT" : "INSPECTION COMPLETE"}</span>
                <strong>{mode === "compare" ? `${changes.length} field${changes.length === 1 ? "" : "s"} changed` : privacyPolicy?.value || "Human review required"}</strong>
                <p>{dangerousPolicy ? "The recorded policy permits material disclosure. Verify the exact commitment before signing." : "Zallet decoded creator-recorded metadata. This is a review aid, not final cryptographic verification."}</p>
              </div>
              <div className="fingerprint-row">
                {fingerprints.map((entry, index) => <div key={entry}><span>{index ? "RETURNED FINGERPRINT" : "INTENT FINGERPRINT"}</span><code>{entry}</code></div>)}
              </div>
              {mode === "compare" ? (
                <div className="change-list">
                  {changes.length === 0 ? <p className="no-changes">No decoded field mutations detected.</p> : changes.slice(0, 30).map((entry) => (
                    <div className="change-row" key={entry.path}>
                      <code>{entry.path}</code><del>{entry.before}</del><ins>{entry.after}</ins>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="finding-grid">
                  {findings.length ? findings.map((entry) => (
                    <div key={`${entry.path}-${entry.value}`}><span>{entry.path}</span><code title={entry.value}>{entry.value}</code></div>
                  )) : <p className="no-changes">Decoded successfully. Open the exact evidence below.</p>}
                </div>
              )}
              <details className="raw-evidence"><summary>Exact pczt_inspect response</summary><pre>{JSON.stringify(result.inspection, null, 2)}</pre></details>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
