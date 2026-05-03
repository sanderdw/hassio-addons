ARG BUILD_FROM
FROM $BUILD_FROM
ARG BUILD_ARCH
ARG HA_RELEASE

ENV LANG=C.UTF-8

RUN apt-get update && apt-get install -y --no-install-recommends jq && rm -rf /var/lib/apt/lists/*

RUN \
    mkdir -p /usr/src/bashio \
    && curl -L -f -s "https://github.com/hassio-addons/bashio/archive/refs/tags/v0.17.5.tar.gz" \
        | tar -xzf - --strip 1 -C /usr/src/bashio \
    && mv /usr/src/bashio/lib /usr/lib/bashio \
    && ln -s /usr/lib/bashio/bashio /usr/bin/bashio \
    \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /usr/src/*

# HOMEASSISTANT app OVERRIDES
COPY rootfs /
RUN chmod a+x /etc/s6-overlay/s6-rc.d/set-hassio-vars/run

# Enable iframe support for HA Ingress (upstream CONTAINER_ENABLE_IFRAME is broken in v6)
RUN SETTINGS_FILE=$(find /app -path "*/dsmrreader/settings*" -name "*.py" | head -1) && \
    if [ -n "$SETTINGS_FILE" ]; then \
        if grep -q "X_FRAME_OPTIONS" "$SETTINGS_FILE"; then \
            sed -i "s/^X_FRAME_OPTIONS.*/X_FRAME_OPTIONS = 'ALLOWALL'/" "$SETTINGS_FILE"; \
        else \
            echo "X_FRAME_OPTIONS = 'ALLOWALL'" >> "$SETTINGS_FILE"; \
        fi; \
    fi

ENV DUID=0
ENV DGID=0

# Labels
LABEL \
  io.hass.version=$HA_RELEASE \
  io.hass.type="addon" \
  io.hass.arch=$BUILD_ARCH
