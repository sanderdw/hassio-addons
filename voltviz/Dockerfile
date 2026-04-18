ARG BUILD_FROM=ghcr.io/sanderdw/voltviz:0.13.3
FROM $BUILD_FROM
ARG BUILD_ARCH
ARG HA_RELEASE

# Install jq for reading add-on config
RUN apk add --no-cache jq

# Add ingress configuration and entrypoint for Home Assistant
COPY rootfs/ /
COPY run.sh /
RUN chmod a+x /run.sh

EXPOSE 8099

CMD ["/run.sh"]

# Labels
LABEL \
    io.hass.name="VoltViz" \
    io.hass.description="Home Assistant Add-on: VoltViz" \
    io.hass.arch=$BUILD_ARCH \
    io.hass.type="addon" \
    io.hass.version=${HA_RELEASE} \
    maintainer="Sander de Wildt <sanderdw@gmail.com>" \
    org.opencontainers.image.title="VoltViz" \
    org.opencontainers.image.description="Home Assistant Add-on: VoltViz" \
    org.opencontainers.image.vendor="Sanderdw's add-on repository" \
    org.opencontainers.image.authors="Sander de Wildt <sanderdw@gmail.com>" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/sanderdw/hassio-addons" \
    org.opencontainers.image.source="https://github.com/sanderdw/hassio-addons" \
    org.opencontainers.image.documentation="https://raw.githubusercontent.com/sanderdw/hassio-addons/master/voltviz/README.md" \
    org.opencontainers.image.version=${HA_RELEASE}
