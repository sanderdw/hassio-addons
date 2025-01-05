ARG BUILD_FROM=busybox:dummy
FROM $BUILD_FROM
ARG BUILD_ARCH
ARG HA_RELEASE

RUN apt-get install -y jq
RUN \
    mkdir -p /usr/src/bashio \
    && curl -L -f -s "https://github.com/hassio-addons/bashio/archive/v0.16.2.tar.gz" \
        | tar -xzf - --strip 1 -C /usr/src/bashio \
    && mv /usr/src/bashio/lib /usr/lib/bashio \
    && ln -s /usr/lib/bashio/bashio /usr/bin/bashio \
    \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /usr/src/*
COPY run.sh /
RUN chmod a+x /run.sh
ENTRYPOINT ["/run.sh"]

# Labels
LABEL \
    io.hass.name="Metabase" \
    io.hass.description="Home Assistant Add-on: Metabase" \
    io.hass.arch=$BUILD_ARCH \
    io.hass.type="addon" \
    io.hass.version=${HA_RELEASE} \
    maintainer="Sander de Wildt <sanderdw@gmail.com>" \
    org.opencontainers.image.title="Metabase" \
    org.opencontainers.image.description="Home Assistant Add-on: Metabase" \
    org.opencontainers.image.vendor="Sanderdw's add-on repository" \
    org.opencontainers.image.authors="Sander de Wildt <sanderdw@gmail.com>" \
    org.opencontainers.image.licenses="GNU Affero General Public License (AGPL)" \
    org.opencontainers.image.url="https://github.com/sanderdw/hassio-addons" \
    org.opencontainers.image.source="https://github.com/sanderdw/hassio-addons" \
    org.opencontainers.image.documentation="https://raw.githubusercontent.com/sanderdw/hassio-addons/master/README.md" \
    org.opencontainers.image.version=${HA_RELEASE}