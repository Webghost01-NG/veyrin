FROM zfnd/zebra:6.2.3@sha256:bb2a6029db277ee3a10e951dcc0ddd36b4cbcbe0fad684746d695ee21d53fde2 AS zebra

FROM rust:1.95.0-slim-bookworm@sha256:d7482085ff5b415f84dba5647ae71606650bdef00db7aeb69f4b3d170c3e4082 AS zallet

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential=12.9 \
    ca-certificates=20230311+deb12u1 \
    clang=1:14.0-55.7~deb12u1 \
    git=1:2.39.5-0+deb12u3 \
    libclang-dev=1:14.0-55.7~deb12u1 \
    llvm-dev=1:14.0-55.7~deb12u1 \
    pkg-config=1.8.1-1 \
    protobuf-compiler=3.21.12-3+deb12u1 \
  && rm -rf /var/lib/apt/lists/*

ENV CARGO_INCREMENTAL=0 \
    PROTOC=/usr/bin/protoc
WORKDIR /usr/src/zallet
RUN git clone --filter=blob:none --no-checkout https://github.com/zcash/zallet.git . \
  && git checkout 987382f67e622915228686e9f956c6a9c9a7514c
COPY zallet-keyless.patch /tmp/zallet-keyless.patch
RUN git apply --unidiff-zero --check /tmp/zallet-keyless.patch \
  && git apply --unidiff-zero /tmp/zallet-keyless.patch \
  && CARGO_BUILD_JOBS=2 cargo build --release --locked \
    --manifest-path backends/zaino/Cargo.toml \
    --bin zallet-zaino

FROM fedora:44@sha256:43b29f65a41eb9c35e1cd5323e3bdf3b655c2357a9f4f1ff2f9c2798e5045d80

RUN dnf install --assumeyes --setopt=install_weak_deps=False \
    ca-certificates \
    curl \
    gettext-envsubst \
    libgcc \
    libstdc++ \
    nginx \
    openssl \
    shadow-utils \
    tini \
  && dnf clean all \
  && useradd --create-home --home-dir /var/lib/veyrin --uid 1000 veyrin \
  && mkdir -p /etc/veyrin /var/lib/veyrin /tmp/nginx/client /tmp/nginx/proxy \
  && chown -R veyrin:veyrin /etc/veyrin /var/lib/veyrin /tmp/nginx

COPY --from=zebra /usr/local/bin/zebrad /usr/local/bin/zebrad
COPY --from=zallet /usr/src/zallet/backends/zaino/target/release/zallet-zaino /usr/local/bin/zallet-zaino
COPY --chown=veyrin:veyrin entrypoint.sh /usr/local/bin/veyrin-zallet-entrypoint
COPY --chown=veyrin:veyrin nginx.conf.template /etc/veyrin/nginx.conf.template

RUN chmod 0755 /usr/local/bin/veyrin-zallet-entrypoint

USER veyrin
ENV HOME=/var/lib/veyrin \
    RUST_LOG=error \
    RUST_BACKTRACE=1 \
    ZALLET_SKIP_PROVING_CACHE_WARMUP=1

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD curl --fail --silent http://127.0.0.1:${PORT:-10000}/healthz >/dev/null || exit 1

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/veyrin-zallet-entrypoint"]
