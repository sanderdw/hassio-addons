ARG BUILD_FROM
FROM $BUILD_FROM
ARG BUILD_ARCH
ARG HA_RELEASE

ENV LANG C.UTF-8

RUN apk add --no-cache jq

# Add bashio
RUN \
    curl -J -L -o /tmp/bashio.tar.gz \
        "https://github.com/hassio-addons/bashio/archive/v0.14.3.tar.gz" \
    && mkdir /tmp/bashio \
    && tar zxvf \
        /tmp/bashio.tar.gz \
        --strip 1 -C /tmp/bashio \
    \
    && mv /tmp/bashio/lib /usr/lib/bashio \
    && ln -s /usr/lib/bashio/bashio /usr/bin/bashio \
    && rm -f -r \
        /tmp/*

# HOMEASSISTANT Add-On OVERRIDES
COPY rootfs /
COPY ha/ingress.conf /etc/nginx/http.d/
RUN chmod a+x /etc/cont-init.d/01-set-hassio-vars
COPY config.json /app/ha_addon_version.json

ENV DUID=0
ENV DGID=0

# Labels
LABEL \
  io.hass.version=$HA_RELEASE \
  io.hass.type="addon" \
  io.hass.arch=$BUILD_ARCH
