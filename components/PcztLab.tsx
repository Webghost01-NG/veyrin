"use client";

import { FormEvent, useMemo, useState } from "react";
import { diffInspections, selectReviewFindings, type JsonValue } from "@/lib/pczt";

interface InspectionPayload {
  method: string;
  inspectedAt: string;
  inspection: JsonValue;
}

// Public PCZT transport fixture published by Keystone. It contains no private
// key material. The second vector changes only the transparent output recipient
// fields, providing a deterministic tamper-detection demonstration.
const publicExpectedVector = "UENaVAEAAAAFis6ctQK0oduWDAEAyI0GhQEAAAEAxJUV9imWJJIzMwGTs9VTxEOo1FgzYwGSJJYp9hWVxAAB/////w8AAACgjQYZdqkUAQAAAAAAAAAAAAAAAAAAAAAAAACIrAAAAQEDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWsgICACIWBgIAIgICAgAgAAAAAAAAAAaCNBhl2qRQBAAAAAAAAAAAAAAAAAAAAAAAAAIisAAABI3QxSHh0Z1hZVFBXMko4QmU5MUhYUzc3TUZneDU3cWtIcnZLAAAAAPvC9DAMAfC3gg0A4zR8jaTuYUZ0N2y8RTWdqlT5tUk+AAADAAGuKTXx39iiSu18cN9946Zo63pJsTGYgN3iu9kDGuXYLwAA";
const publicRecipientMutation = "UENaVAEAAAAFis6ctQK0oduWDAEAyI0GhQEAAAEAxJUV9imWJJIzMwGTs9VTxEOo1FgzYwGSJJYp9hWVxAAB/////w8AAACgjQYZdqkUAQAAAAAAAAAAAAAAAAAAAAAAAACIrAAAAQEDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGf3qhTxd6fgBYxmxyQuCGSIvT0QAAAAAAAAAAAAAAAAAAWsgICACIWBgIAIgICAgAgAAAAAAAAAAaCNBhl2qRRn96oU8Xen4AWMZsckLghkiL09EIisAAABI3QxVE1MSjdrMk40TmFycWs1RmQ1dVVvODJOWFNNYktSZ0NjAAAAAPvC9DAMAfC3gg0A4zR8jaTuYUZ0N2y8RTWdqlT5tUk+AAADAAGuKTXx39iiSu18cN9946Zo63pJsTGYgN3iu9kDGuXYLwAA";

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

  const findings = useMemo(() => result ? selectReviewFindings(result.inspection) : [], [result]);

  const changes = useMemo(() => {
    if (!result || !comparison) return [];
    return diffInspections(result.inspection, comparison.inspection);
  }, [result, comparison]);

  const mutationKind = changes.some((entry) => /(address|recipient)/i.test(entry.path))
    ? "Recipient mutation detected"
    : `${changes.length} field${changes.length === 1 ? "" : "s"} changed`;

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
          <button className={mode === "inspect" ? "active" : ""} onClick={() => setMode("inspect")} type="button" role="tab" aria-selected={mode === "inspect"}>Inspect</button>
          <button className={mode === "compare" ? "active" : ""} onClick={() => setMode("compare")} type="button" role="tab" aria-selected={mode === "compare"}>Compare mutations</button>
          <span>NO SIGNING AUTHORITY</span>
        </div>

        <form className="lab-form" onSubmit={submit}>
          <div className="sample-line">
            <div className="sample-actions">
              <button type="button" onClick={() => { setPrimary(publicExpectedVector); setReturned(""); setResult(null); setComparison(null); setMode("inspect"); }}>
                Load inspection demo
              </button>
              <button type="button" onClick={() => { setPrimary(publicExpectedVector); setReturned(publicRecipientMutation); setResult(null); setComparison(null); setMode("compare"); }}>
                Load recipient mutation
              </button>
            </div>
            <a href="https://github.com/KeystoneHQ/keystone-sdk-base/blob/master/packages/ur-registry-zcash/__tests__/ZcashPCZT.test.ts" target="_blank" rel="noreferrer">Public fixture provenance ↗</a>
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
                <strong>{mode === "compare" ? mutationKind : privacyPolicy?.value || "Human review required"}</strong>
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
