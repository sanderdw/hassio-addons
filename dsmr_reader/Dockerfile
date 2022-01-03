ARG BUILD_FROM
FROM $BUILD_FROM

ENV LANG C.UTF-8

# HOMEASSISTANT Add-On helper for bash
COPY bash.sh /app/bash.sh
RUN chmod a+x /app/bash.sh
# HOMEASSISTANT Add-On OVERRIDES
COPY 20-set-app-defaults /etc/cont-init.d/20-set-app-defaults
RUN chmod a+x /etc/cont-init.d/20-set-app-defaults

# Labels
LABEL \
    io.hass.name="${BUILD_NAME}" \
    io.hass.description="${BUILD_DESCRIPTION}" \
    io.hass.arch="${BUILD_ARCH}" \
    io.hass.type="addon" \
    io.hass.version=${BUILD_VERSION} \
    maintainer="Sander de Wildt <sanderdw@gmail.com>" \
    org.opencontainers.image.title="${BUILD_NAME}" \
    org.opencontainers.image.description="${BUILD_DESCRIPTION}" \
    org.opencontainers.image.vendor="Sanderdw's add-on repository" \
    org.opencontainers.image.authors="Sander de Wildt <sanderdw@gmail.com>" \
    org.opencontainers.image.licenses="None" \
    org.opencontainers.image.url="https://github.com/sanderdw/hassio-addons" \
    org.opencontainers.image.source="https://github.com/sanderdw/hassio-addons" \
    org.opencontainers.image.documentation="https://raw.githubusercontent.com/sanderdw/hassio-addons/master/README.md" \
    org.opencontainers.image.created=${BUILD_DATE} \
    org.opencontainers.image.revision=${BUILD_REF} \
    org.opencontainers.image.version=${BUILD_VERSION}