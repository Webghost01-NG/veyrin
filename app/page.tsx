import { NetworkPulse } from "@/components/NetworkPulse";
import { PcztLab } from "@/components/PcztLab";
import { SignalField } from "@/components/SignalField";

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Veyrin home"><span>V</span>VEYRIN</a>
        <nav aria-label="Primary navigation"><a href="#network">Network</a><a href="#lab">Intent Lab</a><a href="#evidence">Method</a></nav>
        <a className="header-action" href="#lab">Open inspector ↗</a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="hero-kicker">A SAFETY LAYER FOR ZCASH TRANSACTIONS</span>
          <h1>Consent,<br />before <em>cryptography.</em></h1>
          <p>See exactly what a PCZT commits to before anyone signs it. Veyrin turns opaque transaction data into recipients, values, fees, privacy exposure and an immutable intent fingerprint.</p>
          <div className="hero-actions"><a href="#lab">Inspect a PCZT <span>↗</span></a><a href="#network">Watch live Zcash</a></div>
          <div className="hero-proof"><span>NO KEYS</span><span>NO SIGNING</span><span>LIVE JSON-RPC</span></div>
        </div>
        <SignalField />
      </section>

      <NetworkPulse />
      <PcztLab />

      <section className="method-section" id="evidence">
        <span className="section-index">03 / THE TRUST BOUNDARY</span>
        <div className="method-grid">
          <h2>Your key never<br />crosses the line.</h2>
          <div className="method-flow">
            <div><span>01</span><strong>Observe</strong><p>QuickNode supplies current chain evidence through four read-only RPC methods.</p></div>
            <div><span>02</span><strong>Decode</strong><p>Zallet&apos;s pczt_inspect reveals the commitment without requesting spending authority.</p></div>
            <div><span>03</span><strong>Compare</strong><p>Browser-side SHA-256 fingerprints and semantic diffs expose any returned mutation.</p></div>
          </div>
        </div>
        <blockquote>Never sign an envelope<br />you cannot explain.</blockquote>
      </section>

      <footer><a className="wordmark" href="#top"><span>V</span>VEYRIN</a><p>See before you sign.</p><a href="https://github.com/Webghost01-NG/veyrin" target="_blank" rel="noreferrer">Source code ↗</a></footer>
    </main>
  );
}
