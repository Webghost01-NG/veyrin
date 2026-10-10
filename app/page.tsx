import { NetworkPulse } from "@/components/NetworkPulse";
import { PcztLab } from "@/components/PcztLab";
import { SignalField } from "@/components/SignalField";

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Veyrin home"><span>V</span>VEYRIN</a>
        <nav aria-label="Primary navigation"><a href="#network">Network</a><a href="#lab">Attack Lab</a><a href="#evidence">Method</a></nav>
        <a className="header-action" href="#lab">Run Attack Lab ↗</a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="hero-kicker">A SAFETY LAYER FOR ZCASH TRANSACTIONS</span>
          <h1>Consent,<br />before <em>cryptography.</em></h1>
          <p>Compare what a remote Zallet decoder reports before anyone signs. Veyrin separates raw PCZT byte evidence, decoded-field changes, and the checks that still require a trusted wallet.</p>
          <div className="hero-actions"><a href="#lab">Run an attack <span>↗</span></a><a href="#network">Watch live Zcash</a></div>
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
            <div><span>02</span><strong>Decode</strong><p>A remote Zallet <code>pczt_inspect</code> reports creator-recorded fields without requesting spending authority.</p></div>
            <div><span>03</span><strong>Compare</strong><p>Browser-side byte hashes and type-preserving response diffs expose evidence without claiming final verification.</p></div>
          </div>
        </div>
        <blockquote>Never sign an envelope<br />you cannot explain.</blockquote>
      </section>

      <footer><a className="wordmark" href="#top"><span>V</span>VEYRIN</a><p>See before you sign.</p><a href="https://github.com/Webghost01-NG/veyrin" target="_blank" rel="noreferrer">Source code ↗</a></footer>
    </main>
  );
}
