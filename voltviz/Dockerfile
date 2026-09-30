# The app version mirrors the upstream VoltViz image it wraps
ARG BUILD_VERSION
FROM ghcr.io/sanderdw/voltviz:${BUILD_VERSION}
ARG BUILD_ARCH
ARG BUILD_VERSION

# Install jq and bash for reading app config
RUN apk add --no-cache jq bash

RUN \
    mkdir -p /usr/src/bashio \
    && curl -L -f -s "https://github.com/hassio-addons/bashio/archive/refs/tags/v0.17.5.tar.gz" \
        | tar -xzf - --strip 1 -C /usr/src/bashio \
    && mv /usr/src/bashio/lib /usr/lib/bashio \
    && ln -s /usr/lib/bashio/bashio /usr/bin/bashio \
    \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /usr/src/*

# Add ingress configuration and entrypoint for Home Assistant
COPY rootfs/ /
COPY run.sh /
RUN chmod a+x /run.sh

EXPOSE 8099

CMD ["/run.sh"]

# Labels
LABEL \
    io.hass.name="VoltViz" \
    io.hass.description="Home Assistant App: VoltViz" \
    io.hass.arch=$BUILD_ARCH \
    io.hass.type="app" \
    io.hass.version=${BUILD_VERSION} \
    maintainer="Sander de Wildt <sanderdw@gmail.com>" \
    org.opencontainers.image.title="VoltViz" \
    org.opencontainers.image.description="Home Assistant App: VoltViz" \
    org.opencontainers.image.vendor="Sanderdw's app repository" \
    org.opencontainers.image.authors="Sander de Wildt <sanderdw@gmail.com>" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/sanderdw/hassio-addons" \
    org.opencontainers.image.source="https://github.com/sanderdw/hassio-addons" \
    org.opencontainers.image.documentation="https://raw.githubusercontent.com/sanderdw/hassio-addons/main/voltviz/DOCS.md" \
    org.opencontainers.image.version=${BUILD_VERSION}
