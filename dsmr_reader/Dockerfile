ARG BUILD_FROM
FROM $BUILD_FROM
ARG BUILD_ARCH
ARG HA_RELEASE

ENV LANG C.UTF-8

RUN apk add --no-cache jq

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
