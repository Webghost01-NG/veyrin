"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  buildPcztReviewVerdict,
  comparePcztBytes,
  diffInspections,
  fingerprintPcztBytes,
  formatInspectionValue,
  selectReviewFindings,
  type JsonValue,
  type PcztByteComparison
} from "@/lib/pczt";
import {
  keystoneExpectedPczt,
  pcztAttackScenarios,
  pcztFixtureProvenance,
  type PcztAttackScenario
} from "@/lib/pczt-fixtures";

interface InspectionPayload {
  method: string;
  inspectedAt: string;
  inspection: JsonValue;
}

interface FingerprintEvidence {
  expected: string;
  returned?: string;
}

interface ComparedInputs {
  expected: string;
  returned: string;
}

type LabMode = "attack" | "inspect" | "compare";

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
  const [mode, setMode] = useState<LabMode>("attack");
  const [primary, setPrimary] = useState("");
  const [returned, setReturned] = useState("");
  const [result, setResult] = useState<InspectionPayload | null>(null);
  const [comparison, setComparison] = useState<InspectionPayload | null>(null);
  const [fingerprints, setFingerprints] = useState<FingerprintEvidence | null>(null);
  const [comparedInputs, setComparedInputs] = useState<ComparedInputs | null>(null);
  const [activeScenario, setActiveScenario] = useState<PcztAttackScenario["id"] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const findings = useMemo(() => result ? selectReviewFindings(result.inspection) : [], [result]);

  const changes = useMemo(() => {
    if (!result || !comparison) return [];
    return diffInspections(result.inspection, comparison.inspection);
  }, [result, comparison]);

  const byteComparison = useMemo<PcztByteComparison | null>(() => {
    if (!comparedInputs) return null;
    return comparePcztBytes(comparedInputs.expected, comparedInputs.returned);
  }, [comparedInputs]);

  const verdict = useMemo(() => {
    if (!comparison || !byteComparison) return null;
    return buildPcztReviewVerdict(changes, !byteComparison.identical);
  }, [byteComparison, changes, comparison]);

  const privacyPolicy = findings.find((entry) => /privacy.*policy/i.test(entry.path));
  const dangerousPolicy = privacyPolicy && ["NoPrivacy", "AllowFullyTransparent"].includes(privacyPolicy.value);

  function resetEvidence() {
    setResult(null);
    setComparison(null);
    setFingerprints(null);
    setComparedInputs(null);
    setError("");
  }

  function changeMode(nextMode: LabMode) {
    setMode(nextMode);
    setActiveScenario(null);
    resetEvidence();
  }

  async function executeInspection(expectedPczt: string, returnedPczt?: string) {
    setLoading(true);
    setError("");
    setResult(null);
    setComparison(null);
    setFingerprints(null);
    setComparedInputs(null);

    try {
      if (!expectedPczt.trim()) throw new Error("Paste the PCZT you expect to sign.");
      if (returnedPczt !== undefined && !returnedPczt.trim()) {
        throw new Error("Paste the returned PCZT to compare.");
      }

      const [first, second, firstHash, secondHash] = await Promise.all([
        inspect(expectedPczt),
        returnedPczt === undefined ? Promise.resolve(null) : inspect(returnedPczt),
        fingerprintPcztBytes(expectedPczt),
        returnedPczt === undefined ? Promise.resolve(undefined) : fingerprintPcztBytes(returnedPczt)
      ]);

      setResult(first);
      setComparison(second);
      setFingerprints({ expected: firstHash, returned: secondHash });
      if (returnedPczt !== undefined) {
        setComparedInputs({ expected: expectedPczt, returned: returnedPczt });
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Inspection failed";
      setError(`${message} No inspection result was substituted.`);
    } finally {
      setLoading(false);
    }
  }

  async function runScenario(scenario: PcztAttackScenario) {
    setMode("attack");
    setActiveScenario(scenario.id);
    setPrimary(keystoneExpectedPczt);
    setReturned(scenario.returnedPczt);
    await executeInspection(keystoneExpectedPczt, scenario.returnedPczt);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setActiveScenario(null);
    await executeInspection(primary, mode === "compare" ? returned : undefined);
  }

  const isComparison = Boolean(result && comparison && byteComparison && verdict);

  return (
    <section className="lab-section" id="lab" aria-labelledby="lab-title">
      <div className="section-intro light-intro">
        <div>
          <span className="section-index">02 / PRE-CALL ATTACK LAB</span>
          <h2 id="lab-title">See the switch<br /><em>before signing.</em></h2>
        </div>
        <p>Run genuine PCZTs through the live Zallet-backed inspector, compare its decoded reports, and stop on review-critical changes. No keys enter Veyrin.</p>
      </div>

      <div className="lab-shell">
        <div className="lab-tabs" role="tablist" aria-label="PCZT tools">
          <button className={mode === "attack" ? "active" : ""} onClick={() => changeMode("attack")} type="button" role="tab" aria-selected={mode === "attack"}>Attack Lab</button>
          <button className={mode === "inspect" ? "active" : ""} onClick={() => changeMode("inspect")} type="button" role="tab" aria-selected={mode === "inspect"}>Inspect</button>
          <button className={mode === "compare" ? "active" : ""} onClick={() => changeMode("compare")} type="button" role="tab" aria-selected={mode === "compare"}>Custom compare</button>
          <span>NO SIGNING AUTHORITY</span>
        </div>

        <aside className="network-context" aria-label="Network context">
          <span>SEPARATE NETWORK CONTEXTS</span>
          <strong>Live dashboard: Zcash mainnet · PCZT inspector: isolated Zebra regtest</strong>
          <p>Zallet renders a transparent script address with the inspector&apos;s regtest prefix, so a <code>tm…</code> address can appear beside creator-recorded <code>t1…</code> user metadata. That difference alone is not evidence of tampering. Only same-field changes between the expected and returned inspections drive the comparison verdict.</p>
        </aside>

        <aside className="trust-boundary" aria-labelledby="trust-boundary-title">
          <div className="trust-heading">
            <strong id="trust-boundary-title">Trust boundary &amp; limitations</strong>
            <span>READ BEFORE USING A REAL PCZT</span>
          </div>
          <div className="trust-grid">
            <div><span>IN YOUR BROWSER</span><p>Base64 is decoded locally. SHA-256 and byte-difference counts are computed over the decoded PCZT bytes.</p></div>
            <div><span>VEYRIN SERVER</span><p>The PCZT is sent to Veyrin&apos;s allowlisted gateway, then to the configured remote Zallet inspector. This is not offline decoding.</p></div>
            <div><span>ZALLET REPORT</span><p><code>pczt_inspect</code> returns decoded, creator-recorded fields. Veyrin compares those responses but does not authenticate them.</p></div>
            <div><span>NOT VERIFIED</span><p>No signature, proof, extraction, consensus validity, or shielded recipient is verified. Confirm final intent in a trusted signing flow.</p></div>
          </div>
        </aside>

        <div className="lab-form">
          {mode === "attack" ? (
            <div className="attack-picker">
              <div className="attack-intro">
                <strong>Choose an attack. One click runs both PCZTs.</strong>
                <p>Each returned envelope is a deterministic mutation of the public Keystone transport fixture and has been independently decoded by the deployed Zallet path.</p>
              </div>
              <div className="attack-list">
                {pcztAttackScenarios.map((scenario, index) => (
                  <button
                    className={activeScenario === scenario.id ? "attack-row active" : "attack-row"}
                    disabled={loading}
                    key={scenario.id}
                    onClick={() => runScenario(scenario)}
                    type="button"
                  >
                    <span className="attack-number">0{index + 1}</span>
                    <span className="attack-copy"><strong>{scenario.name}</strong><small>{scenario.threat}</small></span>
                    <span className="attack-outcome">EXPECT {scenario.expectedOutcome.toUpperCase()}</span>
                    <span className="attack-run">{loading && activeScenario === scenario.id ? "RUNNING…" : "RUN ATTACK"}</span>
                  </button>
                ))}
              </div>
              <div className="fixture-proof">
                <span>FIXTURE POLICY</span>
                <p>Recipient swap and fee escalation are included because real Zallet decoded both. An unexpected-output case is withheld until a valid second-output PCZT can pass the same check.</p>
                <a href={pcztFixtureProvenance} target="_blank" rel="noreferrer">Open public fixture provenance ↗</a>
              </div>
            </div>
          ) : (
            <form className="manual-form" onSubmit={submit}>
              <div className="sample-line">
                <button type="button" onClick={() => { setPrimary(keystoneExpectedPczt); setReturned(""); resetEvidence(); }}>
                  Load public fixture
                </button>
                <a href={pcztFixtureProvenance} target="_blank" rel="noreferrer">Fixture provenance ↗</a>
              </div>
              <label>
                <span>{mode === "compare" ? "EXPECTED PCZT" : "BASE64 PCZT"}</span>
                <textarea value={primary} onChange={(event) => setPrimary(event.target.value)} placeholder="Paste the transaction envelope…" rows={7} spellCheck={false} />
                <small>{primary.trim().length.toLocaleString()} characters</small>
              </label>
              {mode === "compare" && (
                <label>
                  <span>RETURNED PCZT</span>
                  <textarea value={returned} onChange={(event) => setReturned(event.target.value)} placeholder="Paste the version returned by another party…" rows={7} spellCheck={false} />
                  <small>{returned.trim().length.toLocaleString()} characters</small>
                </label>
              )}
              <button className="primary-action" disabled={loading} type="submit">
                <span>{loading ? "WAITING FOR ZALLET…" : mode === "compare" ? "COMPARE BOTH PCZTS" : "INSPECT THIS PCZT"}</span>
                <span aria-hidden="true">↗</span>
              </button>
            </form>
          )}
          {error && <p className="lab-error" role="alert"><strong>INSPECTION FAILED</strong><span>{error}</span></p>}
        </div>

        <div className="lab-output" aria-live="polite" aria-busy={loading}>
          {!result ? (
            <div className="empty-state">
              <div className="intent-rings"><i /><i /><i /></div>
              <span>{loading ? "ZALLET IS DECODING" : "AWAITING ENVELOPE"}</span>
              <p>{loading ? "Both envelopes must return real inspection data before Veyrin shows a verdict." : "Run a supplied attack or inspect your own PCZT. Failures remain visible; Veyrin never inserts fallback evidence."}</p>
            </div>
          ) : (
            <>
              <div className={`verdict ${verdict?.code === "review-blocked" || dangerousPolicy ? "danger" : ""}`}>
                <span>{isComparison ? "AUTOMATED PRE-SIGN REVIEW" : "DECODER STATUS"}</span>
                <strong>{isComparison ? verdict!.label : dangerousPolicy ? "REVIEW BLOCKED — PRIVACY POLICY" : "DECODED — HUMAN VERIFICATION REQUIRED"}</strong>
                <p>{isComparison ? verdict!.summary : "Zallet returned creator-recorded fields. Decoding is not cryptographic verification or approval to sign."}</p>
              </div>

              <div className="evidence-layers" aria-label="Evidence layers">
                <article>
                  <span>1 / RAW PCZT BYTES</span>
                  <strong>{byteComparison ? byteComparison.identical ? "IDENTICAL" : `${byteComparison.changedByteCount.toLocaleString()} BYTES DIFFER` : "HASHED LOCALLY"}</strong>
                  <p>{byteComparison ? `${byteComparison.beforeLength} → ${byteComparison.afterLength} bytes${byteComparison.firstChangedOffset === null ? "" : ` · first change at offset ${byteComparison.firstChangedOffset}`}` : "SHA-256 covers decoded PCZT bytes, not the Base64 text."}</p>
                </article>
                <article>
                  <span>2 / DECODED FIELDS</span>
                  <strong>{comparison ? `${changes.length.toLocaleString()} FIELD${changes.length === 1 ? "" : "S"} CHANGED` : `${findings.length.toLocaleString()} REVIEW FIELDS`}</strong>
                  <p>Reported by remote Zallet <code>pczt_inspect</code>; Veyrin displays and compares the returned JSON.</p>
                </article>
                <article className="unverified-layer">
                  <span>3 / TRANSACTION INTENT</span>
                  <strong>NOT CRYPTOGRAPHICALLY VERIFIED</strong>
                  <p>Rule matches can block review, but only a trusted signing and validation flow can verify final transaction intent.</p>
                </article>
              </div>

              {fingerprints && (
                <div className="fingerprint-row">
                  <div><span>EXPECTED · SHA-256 OF DECODED PCZT BYTES</span><code title={fingerprints.expected}>{fingerprints.expected}</code></div>
                  {fingerprints.returned && <div><span>RETURNED · SHA-256 OF DECODED PCZT BYTES</span><code title={fingerprints.returned}>{fingerprints.returned}</code></div>}
                </div>
              )}

              {comparison ? (
                <div className="change-list">
                  <div className="change-heading"><span>DECODED FIELD</span><span>EXPECTED</span><span>RETURNED</span></div>
                  <p className="change-count"><strong>{changes.length.toLocaleString()}</strong> total decoded field change{changes.length === 1 ? "" : "s"} · every detected change is shown</p>
                  {changes.length === 0 ? <p className="no-changes">The Zallet inspection responses are identical.</p> : changes.map((entry, index) => (
                    <div className="change-row" key={`${entry.path}-${index}`}>
                      <code title={entry.path}>{entry.path}</code><del title={formatInspectionValue(entry.before)}>{formatInspectionValue(entry.before)}</del><ins title={formatInspectionValue(entry.after)}>{formatInspectionValue(entry.after)}</ins>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="finding-grid">
                  {findings.length ? findings.map((entry) => (
                    <div key={`${entry.path}-${entry.value}`}><span>{entry.path}</span><code title={entry.value}>{entry.value}</code></div>
                  )) : <p className="no-changes">Decoded successfully. Open the exact response below.</p>}
                </div>
              )}

              <details className="raw-evidence"><summary>{comparison ? "Expected raw pczt_inspect response" : "Raw pczt_inspect response"}</summary><pre>{JSON.stringify(result.inspection, null, 2)}</pre></details>
              {comparison && (
                <details className="raw-evidence"><summary>Returned raw pczt_inspect response</summary><pre>{JSON.stringify(comparison.inspection, null, 2)}</pre></details>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
