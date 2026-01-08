ARG BUILD_FROM
FROM $BUILD_FROM
ARG BUILD_ARCH
ARG HA_RELEASE

ENV LANG=C.UTF-8

RUN apk add --no-cache jq

RUN \
    mkdir -p /usr/src/bashio \
    && curl -L -f -s "https://github.com/hassio-addons/bashio/archive/refs/tags/v0.17.5.tar.gz" \
        | tar -xzf - --strip 1 -C /usr/src/bashio \
    && mv /usr/src/bashio/lib /usr/lib/bashio \
    && ln -s /usr/lib/bashio/bashio /usr/bin/bashio \
    \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /usr/src/*

# HOMEASSISTANT Add-On OVERRIDES
COPY rootfs /
RUN chmod a+x /etc/s6-overlay/s6-rc.d/set-hassio-vars/run

ENV DUID=0
ENV DGID=0

# Labels
LABEL \
  io.hass.version=$HA_RELEASE \
  io.hass.type="addon" \
  io.hass.arch=$BUILD_ARCH
