# Veyrin

**See before you sign.** Veyrin is a keyless review layer for Zcash PCZTs (Partially Created Zcash Transactions). It combines a live network witness with human-readable transaction inspection and before/after mutation detection.

Veyrin never connects to a personal wallet, asks for a seed phrase, or exposes a signing method.

## What it does

- Displays current Zcash block height, best block hash, difficulty, synchronization progress, mempool size, node version, peer count, and network solution rate.
- Shows a per-method RPC flight recorder with success state and latency.
- Hashes each live RPC snapshot into a reproducible SHA-256 evidence fingerprint.
- Sends a base64 PCZT to Zallet's read-only `pczt_inspect` method.
- Surfaces recipient, value, fee, pool, privacy-policy, proof, and signature fields.
- Produces a browser-side SHA-256 intent fingerprint.
- Compares two inspected PCZTs and lists every decoded field mutation.
- Includes a provenance-linked public empty PCZT vector for keyless decoder verification; it is labelled as a test vector, never presented as live transaction data.

## RPC methods

| Method | Service | Purpose |
| --- | --- | --- |
| `getblockchaininfo` | Zcash node via QuickNode | Height, best block, difficulty, sync progress |
| `getnetworkinfo` | Zcash node via QuickNode | Node and protocol version, peers |
| `getrawmempool` | Zcash node via QuickNode | Current mempool size |
| `getmininginfo` | Zcash node via QuickNode | Network solution rate |
| `pczt_inspect` | Zallet v0.1.0-beta.3 | Decode a PCZT without signing it |

The public network endpoint is an explicit four-method read-only integration. The Zallet route exposes only `pczt_inspect`; arbitrary RPC forwarding is deliberately impossible.

## Architecture

```text
Browser
  ├─ GET /api/network ────────> QuickNode Zcash RPC
  │                              ├─ getblockchaininfo
  │                              ├─ getnetworkinfo
  │                              ├─ getrawmempool
  │                              └─ getmininginfo
  │
  ├─ POST /api/pczt/inspect ──> loopback/private Zallet beta.3
  │                              └─ pczt_inspect only
  │
  └─ Web Crypto API
                                 └─ local SHA-256 intent fingerprints
```

The QuickNode URL and Zallet credentials are server-only variables. They are never included in the client bundle. Zallet should remain on loopback or a private network because its RPC transport is plaintext HTTP.

## Run locally

Requirements: Node.js 20.9 or later.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set this required variable in `.env.local`:

```dotenv
QUICKNODE_ZCASH_URL=https://your-endpoint.zec-mainnet.quiknode.pro/your-token/
```

The application opens at `http://localhost:3000`.

The development process is capped at approximately 1.5 GiB of old-space memory. It does not sync a local mainnet node.

### Optional PCZT inspection

Use Zallet `v0.1.0-beta.3` or later, which includes the PCZT RPC methods. Keep its RPC listener on loopback, then configure:

```dotenv
ZALLET_RPC_URL=http://127.0.0.1:28232/
ZALLET_RPC_USER=your-local-rpc-user
ZALLET_RPC_PASSWORD=your-local-rpc-password
```

No mnemonic or spending key is required by Veyrin. Do not enter wallet material into the application.

## Verification

```bash
npm run typecheck
npm run build
```

Manual checks should cover the live RPC evidence, refresh behavior, honest configuration/upstream failures, PCZT validation, inspector output, comparison output, and responsive layouts.

## Security boundary

- No signing, proving, extraction, broadcasting, key import, or wallet-unlock RPC is allowed.
- No user-provided RPC method reaches either upstream service.
- RPC URLs and credentials remain server-side.
- Endpoint URLs are required to use HTTPS, except explicit loopback HTTP for local Zallet.
- RPC calls have bounded timeouts; PCZT request size is bounded.
- Both public routes apply lightweight, bounded in-memory rate limiting; provider-level limits remain the production backstop.
- Untrusted inspection content is rendered by React, not injected as HTML.
- `pczt_inspect` reports creator-recorded metadata; Zallet documents that final cryptographic verification occurs during extraction. Veyrin states this limitation in the interface.

## Thirty-second explanation

**Technical:** Veyrin is a Next.js safety layer around five real Zcash RPC methods. Four node calls produce a live chain witness and latency ledger. Zallet's `pczt_inspect` decodes unsigned transaction commitments. The browser fingerprints each envelope and semantically diffs two inspections to expose recipient, value, fee, policy, proof, or signature changes—without ever accepting a private key.

**Plain language:** A Zcash transaction can pass between people before it is signed. Veyrin opens that unsigned envelope, explains who gets what and what becomes visible, then warns you if anything changed before it came back. It watches the real Zcash network, but it never touches your wallet keys.

## Current limitations

- PCZT inspection requires a separately operated Zallet beta.3 service.
- Inspection describes metadata recorded by the PCZT creator and is not equivalent to final transaction extraction or consensus verification.
- Veyrin intentionally cannot sign or broadcast a transaction.
