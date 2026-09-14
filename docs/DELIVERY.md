# Delivery plan

## Phase 1 — Foundation

- Next.js App Router and TypeScript
- Low-memory local scripts
- Responsive landing experience
- Server-only environment boundary

Exit: typecheck and production build pass.

## Phase 2 — Live network witness

- Four-method QuickNode allowlist
- Normalized partial-failure handling
- Current network measurements
- Per-method status and latency evidence

Exit: all four calls return current values from the deployed application.

## Phase 3 — Intent lab

- Zallet beta.3 compatibility check
- Keyless `pczt_inspect`
- Human-readable commitment view
- Browser-side intent fingerprint
- Two-envelope semantic diff

Exit: an authentic PCZT can be inspected and a changed version produces a deterministic mutation report.

## Phase 4 — Judge-proof shipping

- Desktop and mobile verification
- Public deployment
- Recorded fallback demo
- Screenshots and submission copy
- RPC evidence and limitations documented

Exit: a judge can open the URL and immediately see live Zcash data, then reproduce the PCZT review flow from the README.

## Resource policy

- Never synchronize mainnet locally on the development machine.
- Keep local Zallet/Zebra verification short-lived and stop containers after evidence is captured.
- Cap Next.js development at 1.5 GiB and production build at 2 GiB.
- Prefer remote QuickNode reads and hosted builds.
- Never run proving or signing workloads.
