ARG BUILD_FROM
FROM $BUILD_FROM
ARG BUILD_ARCH
ARG HA_RELEASE

ENV LANG C.UTF-8

RUN apk add --no-cache jq

# HOMEASSISTANT Add-On OVERRIDES
COPY rootfs /
RUN chmod a+x /etc/cont-init.d/01-set-hassio-vars
COPY config.json /app/ha_addon_version.json

ENV DUID=0
ENV DGID=0

# Labels
LABEL \
    io.hass.name="DSMR Reader" \
    io.hass.description="Used for reading the smart meter DSMR P1 port (https://dsmr-reader.readthedocs.io)" \
    io.hass.arch=$BUILD_ARCH \
    io.hass.type="addon" \
    io.hass.version=$HA_RELEASE \
    maintainer="Sander de Wildt <sanderdw@gmail.com>" \
    org.opencontainers.image.title="DSMR Reader" \
    org.opencontainers.image.description="Used for reading the smart meter DSMR P1 port (https://dsmr-reader.readthedocs.io)" \
    org.opencontainers.image.vendor="Sanderdw's add-on repository" \
    org.opencontainers.image.authors="Sander de Wildt <sanderdw@gmail.com>" \
    org.opencontainers.image.licenses="GNU Affero General Public License (AGPL)" \
    org.opencontainers.image.url="https://github.com/sanderdw/hassio-addons" \
    org.opencontainers.image.source="https://github.com/sanderdw/hassio-addons" \
    org.opencontainers.image.documentation="https://raw.githubusercontent.com/sanderdw/hassio-addons/master/README.md" \
    org.opencontainers.image.version=""
