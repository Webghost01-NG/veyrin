# Veyrin

> See before you sign.

Veyrin is a keyless safety and review layer for Zcash Partially Created Zcash Transactions (PCZTs). It combines a live Zcash network witness, human-readable PCZT inspection, deterministic intent fingerprints, and before/after mutation detection in one focused application.

**Live application:** [https://veyrin.vercel.app](https://veyrin.vercel.app)

**Repository:** [https://github.com/Webghost01-NG/veyrin](https://github.com/Webghost01-NG/veyrin)

Veyrin never asks for a seed phrase, imports a spending key, signs a transaction, or broadcasts one.

## The problem

PCZTs let multiple tools or people collaborate on a Zcash transaction before it is finalized. That flexibility creates a human-consent problem: an encoded transaction envelope is difficult to understand, and a change made between handoff and signing can be hard to notice.

Veyrin turns that opaque envelope into reviewable evidence:

1. Observe the real Zcash network and prove the application is connected to a node.
2. Decode creator-recorded PCZT intent using Zallet's read-only inspection RPC.
3. Fingerprint the original and returned envelopes in the browser.
4. Reveal decoded field changes before anyone supplies signing authority.

This is deliberately a review boundary, not another wallet.

## Challenge compliance

| Requirement | Implementation | Status |
| --- | --- | --- |
| Landing page | Responsive Next.js interface with a reactive privacy signal | Complete |
| Connect to a Zcash node | Server-side QuickNode Zcash JSON-RPC integration | Live |
| Use at least 3 RPC methods | Four live node methods, plus one allowlisted Zallet method | Complete |
| Display live blockchain data | Height, block hash, difficulty, sync, mempool, peers, version, solution rate | Live |

The network witness is backed by mainnet QuickNode data. The Intent Lab is backed by Zallet `v0.1.0-beta.3`; it does not use a mock decoder or hard-coded inspection response.

## What judges can see immediately

- Current block height and best block hash.
- Network difficulty and estimated solutions per second.
- Node version, protocol version, peer count, and synchronization progress.
- Current mempool transaction count.
- A four-method RPC flight recorder with individual success state and latency.
- A SHA-256 fingerprint of every observed live-network snapshot.
- An Intent Lab for PCZT inspection and decoded before/after comparison.
- A provenance-linked public PCZT test vector containing no wallet key material.
- A second valid PCZT in which only the transparent recipient metadata changes.
- A visible `Recipient mutation detected` verdict with the old and new addresses.
- Honest upstream errors when a service is unavailable; fabricated fallback data is never shown.

### Live network evidence

![Veyrin displaying four verified live Zcash RPC responses, current block height, block hash, difficulty, mempool, peers, node version, sync progress, network solution rate, and snapshot fingerprint](docs/screenshots/live-network-witness.png)

### Real recipient-mutation evidence

![Veyrin comparing two Zallet-decoded public PCZTs and visibly flagging the changed recipient addresses](docs/screenshots/recipient-mutation-detected.png)

Both screenshots were captured from the production Next.js build running the real API routes. The network values came from QuickNode mainnet; the PCZT comparison passed through an authenticated Zallet beta.3 instance.

## Sixty-second judge path

No local setup, wallet, or secret is required:

1. Open [veyrin.vercel.app](https://veyrin.vercel.app).
2. In **Network Witness**, confirm the four flight-recorder rows say `RESPONSE VERIFIED` and press **Refresh evidence** to produce a new observation and SHA-256 fingerprint.
3. Open **Intent Lab** and press **Load inspection demo**, then **Reveal transaction intent**. Zallet decodes the bundled public PCZT.
4. Press **Load recipient mutation**, then **Reveal every mutation**.
5. Confirm the verdict says **Recipient mutation detected** and shows the expected and returned addresses side by side.
6. Notice the explicit **NO SIGNING AUTHORITY** boundary: Veyrin reviews creator-recorded intent; it neither signs nor claims final consensus validation.

## RPC integrations

| Method | Service | Data or capability used |
| --- | --- | --- |
| `getblockchaininfo` | Zcash node through QuickNode | Chain, block height, headers, best block hash, difficulty, verification progress |
| `getnetworkinfo` | Zcash node through QuickNode | Node build, protocol version, connected peers |
| `getrawmempool` | Zcash node through QuickNode | Current mempool transaction IDs, reduced to a count |
| `getmininginfo` | Zcash node through QuickNode | Current network solution rate |
| `pczt_inspect` | Zallet `v0.1.0-beta.3+` | Read-only decoding of a base64 PCZT |

Both gateways use hard-coded method allowlists. A browser request cannot select or forward an arbitrary RPC method.

## The two experiences

### 1. Live network witness

The browser requests `GET /api/network`. The server calls the four Zcash node methods concurrently, records individual latency and failure information, normalizes the useful values, and returns one evidence snapshot. Partial upstream failure does not erase successful measurements. If every method fails, the route returns an honest `502` error.

Each response receives a server-generated SHA-256 snapshot fingerprint over the observation time, height, best block hash, difficulty, mempool count, and network solution rate. The fingerprint is evidence of exactly what this application observed together; it is not a Zcash consensus commitment.

### 2. PCZT Intent Lab

The Intent Lab has two modes:

- **Inspect:** Send one base64 PCZT through the allowlisted `pczt_inspect` gateway and surface transaction fields relevant to human review.
- **Compare mutations:** Inspect an expected envelope and a returned envelope, flatten their decoded structures, and list every field whose value was added, removed, or changed.

The browser independently calculates SHA-256 fingerprints of the exact encoded envelopes. Veyrin highlights fee, value, address, recipient, memo, privacy-policy, pool, proof, input, output, and signature-related paths while retaining the complete raw inspection response for technical review.

`pczt_inspect` describes metadata contained in the PCZT. It is not final cryptographic or consensus verification, which occurs later in the transaction lifecycle.

### Public vector and controlled mutation

The expected envelope comes from [Keystone's public Zcash PCZT transport test](https://github.com/KeystoneHQ/keystone-sdk-base/blob/master/packages/ur-registry-zcash/__tests__/ZcashPCZT.test.ts). It is public test data, not a transaction created from a Veyrin wallet.

The returned envelope is a controlled, still-decodable mutation of that fixture. Its transparent output script and matching creator-recorded `user_address` were changed together. Zallet independently decodes both envelopes; Veyrin does not hard-code the two decoded addresses. The semantic diff then reports exactly these review-relevant paths:

```text
transparent / outputs / 0 / address
transparent / outputs / 0 / user_address
```

This proves a meaningful transaction-intent change while keeping all wallet and signing material out of the demonstration.

## Architecture

```text
Browser
  |
  |-- GET /api/network
  |      `-- Veyrin server-only route
  |             `-- QuickNode Zcash JSON-RPC
  |                    |-- getblockchaininfo
  |                    |-- getnetworkinfo
  |                    |-- getrawmempool
  |                    `-- getmininginfo
  |
  |-- POST /api/pczt/inspect
  |      `-- Veyrin server-only route
  |             `-- authenticated HTTPS edge on Render
  |                    `-- loopback Zallet beta.3
  |                           `-- pczt_inspect
  |
  `-- Web Crypto API
         `-- local SHA-256 intent fingerprints
```

QuickNode URLs and Zallet credentials remain server-only. They are never returned by an API route or included in the browser bundle.

The hosted inspector also runs an ephemeral two-block Zebra regtest dependency on loopback because Zallet requires chain context to start. It creates only a service-encryption identity and an empty encrypted database. Its startup script never invokes mnemonic generation/import, account creation, address generation, signing, extraction, or broadcast operations. The pinned keyless patch preserves Zallet's PCZT decoder while sourcing its network parameters directly from the already-validated chain handle, avoiding unrelated wallet-database contention on fractional CPU.

## Technology choices

- Next.js App Router
- React
- TypeScript in strict mode
- Native CSS with a strict warm-ivory-and-graphite colour system
- Web Crypto API for browser-side SHA-256
- Node.js `crypto` for server-side observation fingerprints
- Vercel for the public web and API deployment
- QuickNode for remote Zcash mainnet RPC
- Render Blueprint for the isolated keyless inspector service
- Zebra `6.2.3` regtest as Zallet's minimal ephemeral chain dependency
- Zallet `v0.1.0-beta.3` for read-only PCZT inspection

The application intentionally has no state database and no client-side dependency beyond React. Node memory is capped in the npm scripts to keep local development practical on low-RAM hardware.

## Repository structure

```text
app/
  api/network/route.ts       Four-method Zcash network gateway
  api/pczt/inspect/route.ts  Single-method Zallet inspection gateway
  globals.css                Complete responsive visual system
  layout.tsx                 Metadata and document shell
  page.tsx                   Landing-page composition
components/
  NetworkPulse.tsx           Live metrics and RPC flight recorder
  PcztLab.tsx                PCZT inspection, fingerprints, and semantic diff
  SignalField.tsx            Pointer-reactive hero visualization
lib/
  network.ts                  Concurrent snapshot normalization and failure isolation
  pczt.ts                     Validation, review-field selection, and deterministic diff
  rate-limit.ts              Bounded in-memory request limiting
  rpc.ts                     URL validation, allowlists, timeouts, RPC client
services/zallet-inspector/    Keyless Zebra + Zallet + authenticated edge container
tests/                        Node, route, validation, and mutation-diff tests
render.yaml                   One-service Render Blueprint
scripts/                      Dependency-free README screenshot capture
docs/screenshots/             Verified network and recipient-mutation evidence
docs/DELIVERY.md             Milestones, phases, and resource policy
```

## Run locally

### Requirements

- Node.js 22.x
- npm
- A Zcash QuickNode HTTPS endpoint
- Optional: Zallet `v0.1.0-beta.3` or later for the Intent Lab

### Installation

```bash
git clone https://github.com/Webghost01-NG/veyrin.git
cd veyrin
npm install
cp .env.example .env.local
```

Add your QuickNode endpoint to `.env.local`:

```dotenv
QUICKNODE_ZCASH_URL=https://your-endpoint.zec-mainnet.quiknode.pro/your-token/
```

Start the application:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The development process caps V8 old-space memory at approximately 1.5 GiB. Veyrin uses a remote mainnet node and does not require the development computer to synchronize the Zcash blockchain.

## Zallet configuration

Run Zallet `v0.1.0-beta.3` or later with its RPC listener restricted to loopback or a private network. Then set:

```dotenv
ZALLET_RPC_URL=http://127.0.0.1:28232/
ZALLET_RPC_USER=your-local-rpc-user
ZALLET_RPC_PASSWORD=your-local-rpc-password
```

Veyrin only needs the `pczt_inspect` RPC. It does not need a mnemonic, spending key, viewing key, or signing permission. Do not paste wallet material into the application or commit it to the repository.

For a reproducible local inspector that does not create a user wallet:

```bash
docker build -t veyrin-zallet-inspector services/zallet-inspector
docker run --rm -p 10000:10000 \
  -e ZALLET_RPC_USER=local-reviewer \
  -e ZALLET_RPC_PASSWORD='a-long-random-service-password' \
  veyrin-zallet-inspector
```

Then use `ZALLET_RPC_URL=http://127.0.0.1:10000/`. The container's full behavior and security boundary are documented in [`services/zallet-inspector/README.md`](services/zallet-inspector/README.md).

## Environment variables

| Variable | Required | Scope | Description |
| --- | --- | --- | --- |
| `QUICKNODE_ZCASH_URL` | Yes | Server only | Full authenticated QuickNode Zcash endpoint |
| `ZALLET_RPC_URL` | For PCZT inspection | Server only | HTTPS endpoint, or loopback HTTP during local development |
| `ZALLET_RPC_USER` | If Zallet requires it | Server only | Basic-auth username |
| `ZALLET_RPC_PASSWORD` | If Zallet requires it | Server only | Basic-auth password |

Never prefix these variables with `NEXT_PUBLIC_`.

## API behavior

### `GET /api/network`

Returns a current normalized network observation:

```json
{
  "source": "Zcash JSON-RPC via QuickNode",
  "observedAt": "ISO-8601 timestamp",
  "snapshotFingerprint": "SHA-256 hex digest",
  "totalLatencyMs": 120,
  "chain": "main",
  "height": 3480000,
  "bestBlockHash": "...",
  "difficulty": 0,
  "syncProgress": 1,
  "nodeVersion": "/Zebra:x.y.z/",
  "protocolVersion": 0,
  "peers": 0,
  "mempoolSize": 0,
  "networkSolPerSecond": 0,
  "evidence": []
}
```

The numbers above illustrate the response shape only. Veyrin never hardcodes them as production results.

### `POST /api/pczt/inspect`

Request:

```json
{ "pczt": "base64-encoded-pczt" }
```

Successful response:

```json
{
  "method": "pczt_inspect",
  "inspectedAt": "ISO-8601 timestamp",
  "inspection": {}
}
```

Malformed JSON, invalid base64, oversized input, missing configuration, timeouts, and upstream RPC failures return distinct non-`200` statuses with concise error messages.

## Security boundary

- No signing, proving, extraction, broadcasting, key import, wallet creation, or wallet-unlock method is exposed.
- No user-provided RPC method reaches either upstream service.
- RPC endpoints and credentials remain in server-only environment variables.
- The QuickNode endpoint must use HTTPS.
- Zallet may use HTTP only when its hostname is explicit loopback: `localhost`, `127.0.0.1`, or `::1`.
- Network calls time out individually after 15 seconds; PCZT inspection allows 240 seconds end to end so a sleeping hosted inspector can wake and finish a CPU-bound decode without fabricating a fallback. The private service keeps its internal Zallet and proxy deadlines below that outer limit.
- PCZT input is base64-validated and length-bounded before forwarding.
- Public routes have bounded in-memory per-client rate limiting.
- React renders untrusted inspection values as text; no raw HTML injection is used.
- There is no analytics SDK, wallet connector, persistent user database, or key storage.
- Hosted Zebra and Zallet RPC listeners bind only to container loopback.
- The hosted edge accepts only `POST /`, applies a 2 MiB body limit and rate limit, and rejects invalid Basic authentication.
- The container exits for automatic restart if either Zebra or Zallet stops.
- The public edge binds immediately for host port discovery, but `/healthz` remains unavailable until startup mines a two-block ephemeral regtest and successfully runs `pczt_inspect` against the public fixture.

The in-memory limiter is intentionally lightweight and instance-local. Production provider limits remain the backstop when traffic spans multiple serverless instances.

The hosted image compiles pinned Zallet beta.3 commit `987382f` with a narrow,
auditable opt-out for its background proving-key warmer. Veyrin's RPC allowlist
cannot call prove, extract, sign, or broadcast methods, so generating those keys
only starves inspection on fractional-CPU hosts. The patch does not modify
`pczt_inspect`; see `services/zallet-inspector/zallet-keyless.patch`.

## Verification

```bash
npm test
npm run typecheck
npm run build
```

The automated suite currently covers 12 behaviors:

- Four-method concurrency with successful data preserved during a partial upstream failure.
- Honest failure when every node RPC call fails.
- HTTPS/loopback endpoint policy and hard RPC allowlists.
- Successful RPC results and normalized upstream JSON-RPC errors.
- PCZT validation for malformed and oversized input.
- The actual Next.js PCZT route's JSON parsing, body limit, server-side authentication, fixed `pczt_inspect` method, success response, and upstream error response.
- A clean GitHub Actions container build that starts the keyless inspector, waits for readiness, decodes the public PCZT through real Zallet, verifies its recipient, and rejects missing authentication.
- Deterministic recipient mutation detection, including added, removed, and empty values.
- Selection of fields that are relevant to human review.

Manual verification covers:

- Live node measurements and all four RPC evidence rows.
- Refresh behavior and 30-second automatic observations.
- Partial and total upstream failures.
- Invalid JSON, invalid base64, oversized PCZT, and unavailable Zallet errors.
- PCZT findings, fingerprints, raw evidence, and mutation comparisons.
- Desktop and mobile layouts.
- Absence of server endpoint secrets from generated browser bundles.

## Deployment

The public application is deployed on Vercel:

**[Open Veyrin](https://veyrin.vercel.app)**

### 1. Deploy the keyless inspector on Render

The root [`render.yaml`](render.yaml) defines a free Docker web service:

1. In Render, create a **Blueprint** from this repository.
2. Enter `ZALLET_RPC_USER` and `ZALLET_RPC_PASSWORD` when prompted. Use service credentials, never a wallet secret.
3. Wait for `/healthz` to report ready and copy the service's `https://…onrender.com/` URL.
4. Keep the service on HTTPS. Do not publish Zallet's plaintext loopback port.

The measured local steady-state footprint of the complete Zebra + Zallet + nginx container is about 217 MiB, below Render free tier's 512 MiB memory limit. Free services may sleep between requests; the Veyrin gateway's longer inspection timeout accommodates a cold wake.

### 2. Deploy the web application on Vercel

1. Import this repository into Vercel.
2. Keep the detected framework as Next.js.
3. Add `QUICKNODE_ZCASH_URL` as an encrypted server-side environment variable.
4. Add `ZALLET_RPC_URL`, `ZALLET_RPC_USER`, and `ZALLET_RPC_PASSWORD` as encrypted server-side environment variables.
5. Deploy without exposing any value as a `NEXT_PUBLIC_` variable.

After deployment, run the [sixty-second judge path](#sixty-second-judge-path) against the public URL. A successful health check alone is insufficient: both PCZTs must decode and the changed recipient must appear.

## Thirty-second pitch

**Technical:** Veyrin is a Next.js safety layer around five allowlisted Zcash RPC methods. Four concurrent node calls create a live chain witness and latency ledger. Zallet's `pczt_inspect` decodes unsigned transaction commitments. Browser-side SHA-256 fingerprints and a semantic diff reveal recipient, value, fee, policy, proof, or signature mutations without accepting private keys.

**Plain language:** A Zcash transaction can move between people before it is signed. Veyrin opens that unsigned envelope, explains what is inside, and warns you if anything changed when it came back. It also proves it is watching the real Zcash network—and it never touches your wallet keys.

## Known limitations

- `pczt_inspect` reports creator-recorded metadata and is not equivalent to final extraction or consensus validation.
- In-memory rate-limit state is not shared between serverless instances.
- The mutation view identifies every decoded field change but only gives the recipient mutation a named verdict; it does not assign financial risk scores.
- The hosted inspector intentionally uses an ephemeral regtest dependency because public fixture inspection does not need mainnet synchronization or persistent wallet state.
- Veyrin intentionally cannot sign or broadcast a transaction.

## References

- [Zcash documentation](https://zcash.readthedocs.io/)
- [QuickNode Zcash documentation](https://www.quicknode.com/docs/zcash)
- [Zallet RPC documentation](https://zcash.github.io/zallet/rpc/)
- [Zallet releases](https://github.com/zcash/zallet/releases)
- [Keystone public PCZT transport fixture](https://github.com/KeystoneHQ/keystone-sdk-base/blob/master/packages/ur-registry-zcash/__tests__/ZcashPCZT.test.ts)
- [Z3 node and wallet stack](https://github.com/ZcashFoundation/z3)

## License

Veyrin is released under the [MIT License](LICENSE).
