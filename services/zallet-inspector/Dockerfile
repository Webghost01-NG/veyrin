FROM zfnd/zebra:6.2.3@sha256:bb2a6029db277ee3a10e951dcc0ddd36b4cbcbe0fad684746d695ee21d53fde2 AS zebra

FROM zodlinc/zallet:v0.1.0-beta.3@sha256:54d1a774317371b1e88c8a54712cdfa4aa7d8f20ae2a0205f9a190e502aef0f6 AS zallet

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
COPY --from=zallet /usr/local/bin/zallet-zaino /usr/local/bin/zallet-zaino
COPY --chown=veyrin:veyrin entrypoint.sh /usr/local/bin/veyrin-zallet-entrypoint
COPY --chown=veyrin:veyrin nginx.conf.template /etc/veyrin/nginx.conf.template

RUN chmod 0755 /usr/local/bin/veyrin-zallet-entrypoint

USER veyrin
ENV HOME=/var/lib/veyrin \
    RUST_LOG=error \
    RUST_BACKTRACE=1

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD curl --fail --silent http://127.0.0.1:${PORT:-10000}/healthz >/dev/null || exit 1

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/veyrin-zallet-entrypoint"]
