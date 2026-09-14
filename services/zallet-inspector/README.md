# Keyless Zallet inspector

This container runs a minimal Zebra regtest chain and Zallet `v0.1.0-beta.3`
behind an HTTPS-terminating platform edge. Its only purpose is to make
`pczt_inspect` available to Veyrin's server route.

It creates an ephemeral age encryption identity and an empty encrypted wallet
database because Zallet requires both to start. It deliberately never calls
`generate-mnemonic`, `import-mnemonic`, account creation, address generation,
signing, or broadcast methods. It therefore contains no user wallet or spending
authority.

The public edge accepts only `POST /`, applies request-size and rate limits, and
passes HTTP Basic authentication to Zallet. Zallet and Zebra both listen on
loopback inside the container. The public edge binds during initialization so the
host can discover its port, while `GET /healthz` returns `503` until a real fixture
passes one long, bounded `pczt_inspect` readiness call. This avoids stacking
CPU-bound inspections on small hosts. The ready response contains no chain or
wallet data.

The image builds the pinned upstream Zallet beta.3 commit and applies
`zallet-keyless.patch`. That patch adds one opt-out around Zallet's background
Sapling/Orchard proving-key warmer. Veyrin never proves, extracts, or signs, and
free fractional-CPU hosts otherwise spend minutes warming keys for methods the
allowlist cannot call. The `pczt_inspect` implementation is unchanged. The
upstream commit and patch are both visible and reproducible from the Dockerfile.

## Local proof

```bash
docker build -t veyrin-zallet-inspector services/zallet-inspector
docker run --rm -p 10000:10000 \
  -e ZALLET_RPC_USER=local-reviewer \
  -e ZALLET_RPC_PASSWORD='use-a-long-random-value' \
  veyrin-zallet-inspector
```

Point Veyrin's server-only `ZALLET_RPC_URL` at `http://127.0.0.1:10000/`.
Production must use the HTTPS URL supplied by the hosting platform.
