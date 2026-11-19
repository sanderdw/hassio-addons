# https://contributors.home-assistant.io/apps/guides/dockerfile/
ARG BUILD_FROM=metabase/metabase:v0.65.5.1
FROM ${BUILD_FROM}
ARG BUILD_ARCH
ARG BUILD_VERSION

# nginx serves Metabase to Home Assistant ingress (rootfs/etc/nginx).
RUN apk add --no-cache jq nginx

RUN \
    mkdir -p /usr/src/bashio \
    && curl -L -f -s "https://github.com/hassio-addons/bashio/archive/refs/tags/v0.19.0.tar.gz" \
        | tar -xzf - --strip 1 -C /usr/src/bashio \
    && mv /usr/src/bashio/lib /usr/lib/bashio \
    && ln -s /usr/lib/bashio/bashio /usr/bin/bashio \
    \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /usr/src/*
COPY rootfs /
COPY run.sh /
RUN chmod a+x /run.sh

# Home Assistant shows the app as starting, without "Open web UI", until Metabase answers. Java
# needs a minute or more to start, longer on a Raspberry Pi or during a migration: check every
# 5 seconds for the first 15 minutes, then every minute.
HEALTHCHECK --interval=60s --timeout=5s --start-period=900s --start-interval=5s --retries=3 \
    CMD curl -fsS -o /dev/null http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["/run.sh"]

# Labels
LABEL \
    io.hass.name="Metabase" \
    io.hass.description="Home Assistant App: Metabase" \
    io.hass.arch=${BUILD_ARCH} \
    io.hass.type="app" \
    io.hass.version=${BUILD_VERSION} \
    maintainer="Sander de Wildt <sanderdw@gmail.com>" \
    org.opencontainers.image.title="Metabase" \
    org.opencontainers.image.description="Home Assistant App: Metabase" \
    org.opencontainers.image.vendor="Sanderdw's app repository" \
    org.opencontainers.image.authors="Sander de Wildt <sanderdw@gmail.com>" \
    org.opencontainers.image.licenses="GNU Affero General Public License (AGPL)" \
    org.opencontainers.image.url="https://github.com/sanderdw/hassio-addons" \
    org.opencontainers.image.source="https://github.com/sanderdw/hassio-addons" \
    org.opencontainers.image.documentation="https://raw.githubusercontent.com/sanderdw/hassio-addons/main/metabase/DOCS.md" \
    org.opencontainers.image.version=${BUILD_VERSION}